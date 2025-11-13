import { SlashCommandBuilder } from "discord.js";
import { queue } from "../queue.js";
import { guildPlayers } from "./play.js";

export const skipCommand = {
  data: new SlashCommandBuilder()
    .setName("skip")
    .setDescription("Skip the current song"),

  async execute(interaction) {
    try {
      if (!interaction.member.voice.channel) {
        return interaction.reply({
          content: "❌ You need to be in a voice channel!",
          flags: 64,
        });
      }

      if (!queue.hasNext() && queue.list().length === 0) {
        return interaction.reply({
          content: "❌ No songs in queue!",
          flags: 64,
        });
      }

      const guildData = guildPlayers.get(interaction.guild.id);

      if (guildData?.player) {
        guildData.player.stop(); // This will trigger the Idle event and play next
        await interaction.reply("⏭️ Skipped!");
      } else {
        await interaction.reply({
          content: "❌ Nothing is playing!",
          flags: 64,
        });
      }
    } catch (error) {
      console.error("Error in skip command:", error);
      await interaction.reply({
        content: "❌ An error occurred!",
        flags: 64,
      });
    }
  },
};
