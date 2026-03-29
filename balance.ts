import {
  SlashCommandBuilder,
  EmbedBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import { getOrCreateUser, getDailyPoints } from "../db.js";
import { formatHnp } from "../utils.js";
import { MAX_DAILY_TP } from "../config.js";

export const data = new SlashCommandBuilder()
  .setName("balance")
  .setDescription("Check your TP points and HNP balance");

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  const user = await getOrCreateUser(
    interaction.user.id,
    interaction.user.username
  );

  const dailyEarned = await getDailyPoints(interaction.user.id);
  const dailyRemaining = Math.max(0, MAX_DAILY_TP - dailyEarned);

  const embed = new EmbedBuilder()
    .setTitle("💰 Your Balance")
    .setColor(0x5865f2)
    .addFields(
      { name: "🎯 TP Points", value: `**${user.tpPoints} TP**`, inline: true },
      { name: "💎 HNP Balance", value: `**${formatHnp(user.hnpBalance as string)} HNP**`, inline: true },
      { name: "📅 TP Earned Today", value: `${dailyEarned} / ${MAX_DAILY_TP} TP`, inline: false },
      { name: "⚡ Remaining Today", value: `${dailyRemaining} TP`, inline: true }
    )
    .setFooter({ text: `User: ${user.username}` })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}
