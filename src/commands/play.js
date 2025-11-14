import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { queue } from "../queue.js";
import ytSearch from "yt-search";
import {
  createAudioPlayer,
  createAudioResource,
  joinVoiceChannel,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  NoSubscriberBehavior,
  entersState,
} from "@discordjs/voice";
import { Readable } from "stream";

export const guildPlayers = new Map();

// Resolve which Piped instance to use (configurable via env)
const pipedBaseUrl = process.env.PIPED_INSTANCE?.replace(/\/$/, "") || "https://piped.video";
const STREAM_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const DEFAULT_HEADERS = {
  accept: "application/json",
  "user-agent": "Mozilla/5.0 (DiscordMusicBot)"
};

// Extract video ID from common YouTube URL shapes
function getYouTubeVideoId(videoUrl) {
  try {
    const url = new URL(videoUrl);
    if (url.hostname === "youtu.be") {
      return url.pathname.replace("/", "");
    }
    if (url.hostname.includes("youtube.com")) {
      if (url.searchParams.get("v")) {
        return url.searchParams.get("v");
      }
      const pathSegments = url.pathname.split("/").filter(Boolean);
      const watchIndex = pathSegments.indexOf("shorts");
      if (watchIndex !== -1 && pathSegments[watchIndex + 1]) {
        return pathSegments[watchIndex + 1];
      }
    }
    return null;
  } catch (error) {
    console.error("Invalid YouTube URL:", videoUrl, error);
    return null;
  }
}

async function fetchPipedStreamUrl(videoUrl) {
  const videoId = getYouTubeVideoId(videoUrl);
  if (!videoId) {
    throw new Error("Unable to parse YouTube video ID");
  }

  const endpoint = `${pipedBaseUrl}/api/v1/streams/${videoId}`;
  const response = await fetch(endpoint, { headers: DEFAULT_HEADERS });

  if (!response.ok) {
    throw new Error(`Failed to fetch stream metadata (${response.status})`);
  }

  const data = await response.json();
  const audioStreams = data?.audioStreams || [];
  if (!audioStreams.length) {
    throw new Error("No audio streams available from Piped");
  }

  // Prefer Opus/WebM streams for lower latency, fall back to highest bitrate
  const preferred = audioStreams.find((stream) => stream.format === "WEBM" && stream.codec?.includes("opus"));
  const streamInfo = preferred || audioStreams.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0];

  if (!streamInfo?.url) {
    throw new Error("Invalid audio stream info from Piped");
  }

  return streamInfo.url;
}

// Helper function to delete "Now Playing" message
export async function deleteNowPlayingMessage(guildId) {
  const guildData = guildPlayers.get(guildId);
  if (guildData?.nowPlayingMessage) {
    try {
      await guildData.nowPlayingMessage.delete();
      guildData.nowPlayingMessage = null;
      console.log("Deleted Now Playing message");
    } catch (err) {
      console.log("Could not delete old message:", err.message);
    }
  }
}

export const playCommand = {
  data: new SlashCommandBuilder()
    .setName("play")
    .setDescription("Play a song from YouTube")
    .addStringOption((option) =>
      option
        .setName("query")
        .setDescription("Song name or URL")
        .setRequired(true)
    ),

  async execute(interaction) {
    let deferred = false;
    try {
      // DEFER IMMEDIATELY - before ANY other operations
      await interaction.deferReply();
      deferred = true;
    } catch (deferError) {
      console.error("Failed to defer reply:", deferError);
      if (interaction.channel) {
        interaction.channel.send("⚠️ I missed that command. Please run /play again!").catch(() => {});
      }
      return;
    }

    try {
      const query = interaction.options.getString("query");

      // Check if user is in a voice channel
      if (!interaction.member.voice.channel) {
        return interaction.editReply("❌ You need to join a voice channel first!");
      }

      // Search for song FIRST (before joining voice)
      const searchResult = await ytSearch(query);
      const video = searchResult.videos[0];
      
      if (!video) {
        return interaction.editReply("❌ No results found!");
      }

      // Check if bot is already playing in this guild
      const existingPlayer = guildPlayers.get(interaction.guild.id);
      const isPlaying = existingPlayer?.player?.state?.status === AudioPlayerStatus.Playing;

      // If already playing, just add to queue without fetching stream URL yet
      if (isPlaying) {
        const song = {
          title: video.title,
          url: video.url,
          streamUrl: null,
          thumbnail: video.thumbnail,
          requester: interaction.user.username,
          guildId: interaction.guild.id,
          channelId: interaction.channel.id,
          lastFetched: null,
        };
        
        queue.add(song);
        await interaction.editReply(`✅ Added to queue: **${song.title}** (Position: ${queue.list().length})`);
        return;
      }
      
      // First song - fetch stream URL now for instant playback
      await interaction.editReply(`🔍 Searching: **${video.title}**...`);
      
      console.log("Fetching stream URL...");
      const streamUrl = await fetchPipedStreamUrl(video.url);
      
      const song = {
        title: video.title,
        url: video.url,
        streamUrl,
        thumbnail: video.thumbnail,
        requester: interaction.user.username,
        guildId: interaction.guild.id,
        channelId: interaction.channel.id,
        lastFetched: Date.now(),
      };

      // Add song to queue
      queue.add(song);

      if (isPlaying) {
        // Bot is already playing, just add to queue
        await interaction.editReply(`✅ Added to queue: **${song.title}** (Position: ${queue.list().length})`);
      } else {
        // Bot is not playing, join voice and start playing
        const connection = joinVoiceChannel({
          channelId: interaction.member.voice.channel.id,
          guildId: interaction.guild.id,
          adapterCreator: interaction.guild.voiceAdapterCreator,
        });

        // Handle connection errors and reconnection
        connection.on(VoiceConnectionStatus.Disconnected, async () => {
          try {
            // Try to reconnect within 5 seconds
            await Promise.race([
              entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
              entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
            ]);
            // Reconnected successfully
          } catch (error) {
            // Failed to reconnect, cleanup
            await deleteNowPlayingMessage(interaction.guild.id);
            connection.destroy();
            guildPlayers.delete(interaction.guild.id);
          }
        });

        await interaction.editReply(`✅ Playing: **${song.title}**`);
        playNextSong(interaction, connection);
      }
    } catch (error) {
      console.error("Error in play command:", error);
      
      try {
        if (deferred && (interaction.deferred || interaction.replied)) {
          await interaction.editReply("❌ An error occurred while playing the song!");
        } else {
          await interaction.reply({ content: "❌ An error occurred while playing the song!", flags: 64 });
        }
      } catch (replyError) {
        console.error("Failed to send error message:", replyError);
      }
    }
  },
};

async function playNextSong(interaction, connection) {
  if (!queue.hasNext()) {
    await deleteNowPlayingMessage(interaction.guild.id);
    interaction.channel.send("✅ Queue finished!");
    guildPlayers.delete(interaction.guild.id);
    connection.destroy();
    return;
  }

  const currentSong = queue.next();
  
  try {
    const needsRefresh =
      !currentSong.streamUrl || !currentSong.lastFetched || Date.now() - currentSong.lastFetched > STREAM_CACHE_TTL;

    if (needsRefresh) {
      console.log("Fetching fresh stream URL for:", currentSong.title);
      currentSong.streamUrl = await fetchPipedStreamUrl(currentSong.url);
      currentSong.lastFetched = Date.now();
    }

    if (!currentSong || !currentSong.streamUrl) {
      throw new Error("Invalid song");
    }
    
    console.log("Playing:", currentSong.title);
    
    const streamResponse = await fetch(currentSong.streamUrl, { headers: DEFAULT_HEADERS });
    if (!streamResponse.ok || !streamResponse.body) {
      throw new Error(`Failed to fetch audio stream (${streamResponse.status})`);
    }

    const nodeStream = Readable.fromWeb(streamResponse.body);
    const resource = createAudioResource(nodeStream);
    
    // Get or create player
    let player = guildPlayers.get(interaction.guild.id)?.player;
    let guildData = guildPlayers.get(interaction.guild.id);
    
    if (!player) {
      player = createAudioPlayer({
        behaviors: {
          noSubscriber: NoSubscriberBehavior.Play,
        },
      });
      
      guildData = { player, connection, nowPlayingMessage: null };
      guildPlayers.set(interaction.guild.id, guildData);
      
      // Set up event listeners only once
      player.on(AudioPlayerStatus.Idle, () => {
        console.log("Song finished, playing next...");
        playNextSong(interaction, connection);
      });

      player.on("error", (error) => {
        console.error("Audio player error:", error);
        interaction.channel.send("❌ Error playing song. Skipping...");
        playNextSong(interaction, connection);
      });
      
      connection.subscribe(player);
    }

    player.play(resource);

    const embed = new EmbedBuilder()
      .setTitle("🎶 Now Playing")
      .setDescription(`[${currentSong.title}](${currentSong.url})`)
      .setThumbnail(currentSong.thumbnail)
      .addFields(
        { name: "Requested by", value: currentSong.requester, inline: true },
        { name: "In Queue", value: `${queue.list().length} songs`, inline: true }
      )
      .setColor(0x00ff00);

    // Create control buttons
    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId("pause")
          .setLabel("Pause")
          .setEmoji("⏸️")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId("resume")
          .setLabel("Resume")
          .setEmoji("▶️")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId("skip")
          .setLabel("Skip")
          .setEmoji("⏭️")
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId("stop")
          .setLabel("Stop")
          .setEmoji("⏹️")
          .setStyle(ButtonStyle.Danger)
      );

    // Delete old "Now Playing" message
    if (guildData.nowPlayingMessage) {
      try {
        await guildData.nowPlayingMessage.delete();
      } catch (err) {
        console.log("Could not delete old message");
      }
    }

    // Send new "Now Playing" message and store it
    const nowPlayingMsg = await interaction.channel.send({ embeds: [embed], components: [row] });
    guildData.nowPlayingMessage = nowPlayingMsg;

  } catch (error) {
    console.error("Error streaming song:", error);
    await deleteNowPlayingMessage(interaction.guild.id);
    interaction.channel.send(`❌ Failed to play. Skipping...`);
    playNextSong(interaction, connection);
  }
}