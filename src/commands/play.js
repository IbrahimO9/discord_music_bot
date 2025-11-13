import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { queue } from "../queue.js";
import ytSearch from "yt-search";
import { exec } from "child_process";
import { promisify } from "util";
import {
  createAudioPlayer,
  createAudioResource,
  joinVoiceChannel,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  NoSubscriberBehavior,
  entersState,
} from "@discordjs/voice";

const execPromise = promisify(exec);

export const guildPlayers = new Map();

// Detect platform and use correct yt-dlp command
const isWindows = process.platform === 'win32';
const ytDlpCmd = isWindows ? '.\\yt-dlp.exe' : './yt-dlp';

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
    // DEFER IMMEDIATELY - before ANY other operations
    await interaction.deferReply().catch(() => {});

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
          streamUrl: null, // Will fetch when needed
          thumbnail: video.thumbnail,
          requester: interaction.user.username,
          guildId: interaction.guild.id,
          channelId: interaction.channel.id,
        };
        
        queue.add(song);
        await interaction.editReply(`✅ Added to queue: **${song.title}** (Position: ${queue.list().length})`);
        return;
      }
      
      // First song - fetch stream URL now for instant playback
      await interaction.editReply(`🔍 Searching: **${video.title}**...`);
      
      console.log("Fetching stream URL...");
      const { stdout } = await execPromise(`${ytDlpCmd} -f "bestaudio[ext=webm]/bestaudio" --no-playlist -g "${video.url}"`);
      const streamUrl = stdout.trim();
      
      const song = {
        title: video.title,
        url: video.url,
        streamUrl: streamUrl, // Cache the stream URL
        thumbnail: video.thumbnail,
        requester: interaction.user.username,
        guildId: interaction.guild.id,
        channelId: interaction.channel.id,
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
        await interaction.editReply("❌ An error occurred while playing the song!");
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
    // If no cached stream URL, fetch it now
    if (!currentSong.streamUrl) {
      console.log("Fetching stream URL for:", currentSong.title);
      const { stdout } = await execPromise(`${ytDlpCmd} -f "bestaudio[ext=webm]/bestaudio" --no-playlist -g "${currentSong.url}"`);
      currentSong.streamUrl = stdout.trim();
    }
    
    if (!currentSong || !currentSong.streamUrl) {
      throw new Error("Invalid song");
    }
    
    console.log("Playing:", currentSong.title);
    
    // Use cached stream URL
    const resource = createAudioResource(currentSong.streamUrl);
    
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