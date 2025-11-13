import "dotenv/config";
import { Client, GatewayIntentBits, REST, Routes } from "discord.js";
import { playCommand, guildPlayers, deleteNowPlayingMessage } from "./src/commands/play.js";
import { queueCommand } from "./src/commands/queue.js";
import { skipCommand } from "./src/commands/skip.js";
import { stopCommand } from "./src/commands/stop.js";
import { pauseCommand } from "./src/commands/pause.js";
import { resumeCommand } from "./src/commands/resume.js";
import { getVoiceConnection } from "@discordjs/voice";
import { queue } from "./src/queue.js";
import http from "http";

// Create a simple HTTP server to satisfy Render's port requirement
const PORT = process.env.PORT || 3000;
const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Discord Music Bot is running!");
});

server.listen(PORT, () => {
  console.log(`HTTP server running on port ${PORT}`);
});

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates]
});

// ---------- REGISTER COMMANDS ----------
const commands = [
  playCommand.data,
  queueCommand.data,
  skipCommand.data,
  stopCommand.data,
  pauseCommand.data,
  resumeCommand.data,
].map((command) => command.toJSON());

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

client.once("ready", async () => {
  console.log(`✅ Bot is online as ${client.user.tag}`);
  
  try {
    await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), {
      body: commands
    });
    console.log("✅ Commands registered successfully!");
  } catch (error) {
    console.error("❌ Error registering commands:", error);
  }
});

// ---------- COMMAND HANDLER ----------
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  try {
    if (interaction.commandName === "play") {
      await playCommand.execute(interaction);
    } else if (interaction.commandName === "queue") {
      await queueCommand.execute(interaction);
    } else if (interaction.commandName === "skip") {
      await skipCommand.execute(interaction);
    } else if (interaction.commandName === "stop") {
      await stopCommand.execute(interaction);
    } else if (interaction.commandName === "pause") {
      await pauseCommand.execute(interaction);
    } else if (interaction.commandName === "resume") {
      await resumeCommand.execute(interaction);
    }
  } catch (error) {
    console.error("Error executing command:", error);
    
    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply("❌ An error occurred!");
      } else {
        await interaction.reply({
          content: "❌ An error occurred!",
          flags: 64,
        });
      }
    } catch (replyError) {
      console.error("Failed to send error message:", replyError);
    }
  }
});

// ---------- BUTTON HANDLER ----------
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;

  try {
    if (!interaction.member.voice.channel) {
      return interaction.reply({
        content: "❌ You need to be in a voice channel!",
        flags: 64,
      });
    }

    const guildData = guildPlayers.get(interaction.guild.id);

    if (interaction.customId === "pause") {
      if (guildData?.player) {
        guildData.player.pause();
        await interaction.reply({ content: "⏸️ Paused!", flags: 64 });
      } else {
        await interaction.reply({ content: "❌ Nothing is playing!", flags: 64 });
      }
    } else if (interaction.customId === "resume") {
      if (guildData?.player) {
        guildData.player.unpause();
        await interaction.reply({ content: "▶️ Resumed!", flags: 64 });
      } else {
        await interaction.reply({ content: "❌ Nothing is playing!", flags: 64 });
      }
    } else if (interaction.customId === "skip") {
      if (guildData?.player) {
        guildData.player.stop();
        await interaction.reply({ content: "⏭️ Skipped!", flags: 64 });
      } else {
        await interaction.reply({ content: "❌ Nothing is playing!", flags: 64 });
      }
    } else if (interaction.customId === "stop") {
      const connection = getVoiceConnection(interaction.guild.id);
      if (connection) {
        while (queue.hasNext()) {
          queue.next();
        }
        await deleteNowPlayingMessage(interaction.guild.id);
        guildPlayers.delete(interaction.guild.id);
        connection.destroy();
        await interaction.reply({ content: "⏹️ Stopped!", flags: 64 });
      } else {
        await interaction.reply({ content: "❌ Bot is not in a voice channel!", flags: 64 });
      }
    }
  } catch (error) {
    console.error("Error handling button:", error);
    await interaction.reply({ content: "❌ An error occurred!", flags: 64 }).catch(() => {});
  }
});

// ---------- ERROR HANDLING ----------
process.on("unhandledRejection", (error) => {
  console.error("Unhandled promise rejection:", error);
});

// ---------- LOGIN ----------
client.login(process.env.DISCORD_TOKEN);