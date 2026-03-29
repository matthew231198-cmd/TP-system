import {
  SlashCommandBuilder,
  EmbedBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import { getLeaderboard } from "../db.js";

export const data = new SlashCommandBuilder()
  .setName("leaderboard")
  .setDescription("View the top TP point earners");

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  const leaders = await getLeaderboard(10);

  if (!leaders.length) {
    await interaction.editReply("No users on the leaderboard yet. Start chatting to earn TP points!");
    return;
  }

  const medals = ["🥇", "🥈", "🥉"];
  const description = leaders
    .map((user, i) => {
      const medal = medals[i] ?? `**#${i + 1}**`;
      return `${medal} <@${user.discordId}> — **${user.tpPoints} TP**`;
    })
    .join("\n");

  const embed = new EmbedBuilder()
    .setTitle("🏆 TP Points Leaderboard")
    .setDescription(description)
    .setColor(0xffd700)
    .setFooter({ text: "Earn TP by chatting! Max 100 TP per day." })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}
