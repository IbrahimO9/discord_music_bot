import { SlashCommandBuilder } from "discord.js";
import { getVoiceConnection } from "@discordjs/voice";
import { queue } from "../queue.js";
import { guildPlayers, deleteNowPlayingMessage } from "./play.js";

export const stopCommand = {
  data: new SlashCommandBuilder()
    .setName("stop")
    .setDescription("Stop playing and disconnect the bot"),

  async execute(interaction) {
    try {
      if (!interaction.member.voice.channel) {
        return interaction.reply({
          content: "❌ You need to be in a voice channel!",
          flags: 64,
        });
      }

      const connection = getVoiceConnection(interaction.guild.id);

      if (!connection) {
        return interaction.reply({
          content: "❌ Bot is not in a voice channel!",
          flags: 64,
        });
      }

      // Clear queue
      while (queue.hasNext()) {
        queue.next();
      }

      // Delete "Now Playing" message
      await deleteNowPlayingMessage(interaction.guild.id);

      // Cleanup player data
      guildPlayers.delete(interaction.guild.id);

      // Destroy connection
      connection.destroy();

      await interaction.reply("⏹️ Stopped and disconnected!");
    } catch (error) {
      console.error("Error in stop command:", error);
      await interaction.reply({
        content: "❌ An error occurred!",
        flags: 64,
      });
    }
  },
};
