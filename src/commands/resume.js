import { SlashCommandBuilder } from "discord.js";
import { guildPlayers } from "./play.js";

export const resumeCommand = {
  data: new SlashCommandBuilder()
    .setName("resume")
    .setDescription("Resume the paused song"),

  async execute(interaction) {
    try {
      if (!interaction.member.voice.channel) {
        return interaction.reply({
          content: "❌ You need to be in a voice channel!",
          flags: 64,
        });
      }

      const guildData = guildPlayers.get(interaction.guild.id);

      if (guildData?.player) {
        guildData.player.unpause();
        await interaction.reply("▶️ Resumed!");
      } else {
        await interaction.reply({
          content: "❌ Nothing is playing!",
          flags: 64,
        });
      }
    } catch (error) {
      console.error("Error in resume command:", error);
      await interaction.reply({
        content: "❌ An error occurred!",
        flags: 64,
      });
    }
  },
};
