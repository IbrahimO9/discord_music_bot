import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { queue } from "../queue.js";

export const queueCommand = {
  data: new SlashCommandBuilder()
    .setName("queue")
    .setDescription("View the current music queue"),

  async execute(interaction) {
    try {
      const songs = queue.list();

      if (songs.length === 0) {
        return interaction.reply({
          content: "📭 The queue is empty!",
          ephemeral: true,
        });
      }

      const embed = new EmbedBuilder()
        .setTitle("🎵 Music Queue")
        .setColor(0x0099ff)
        .setDescription(
          songs
            .slice(0, 10)
            .map(
              (song, index) =>
                `**${index + 1}.** [${song.title}](${song.url}) - *Requested by ${song.requester}*`
            )
            .join("\n")
        )
        .setFooter({
          text: `Total songs: ${songs.length}`,
        });

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error("Error in queue command:", error);
      await interaction.reply({
        content: "❌ An error occurred while fetching the queue!",
        ephemeral: true,
      });
    }
  },
};
