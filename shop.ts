import {
  SlashCommandBuilder,
  EmbedBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import { BOX_TYPES, HNP_REWARDS } from "../config.js";

export const data = new SlashCommandBuilder()
  .setName("shop")
  .setDescription("View available HNP boxes in the shop");

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  const embed = new EmbedBuilder()
    .setTitle("🏪 HNP Box Shop")
    .setDescription("Spend your TP points to open boxes and earn HNP!\nUse `/buy <boxtype>` to purchase a box.")
    .setColor(0x00bcd4);

  for (const [key, box] of Object.entries(BOX_TYPES)) {
    const rarities = [
      `⚪ Common: ${(box.rarities.common * 100).toFixed(0)}%`,
      `🟢 Uncommon: ${(box.rarities.uncommon * 100).toFixed(0)}%`,
      `🔵 Rare: ${(box.rarities.rare * 100).toFixed(0)}%`,
      `🟣 Epic: ${(box.rarities.epic * 100).toFixed(0)}%`,
      `🌟 Legendary: ${(box.rarities.legendary * 100).toFixed(0)}%`,
    ].join("\n");

    embed.addFields({
      name: `${box.emoji} ${box.name} — ${box.cost} TP`,
      value: rarities,
      inline: true,
    });
  }

  embed.addFields({
    name: "💎 HNP Rewards by Rarity",
    value: Object.entries(HNP_REWARDS)
      .map(([rarity, { min, max }]) => `**${rarity.charAt(0).toUpperCase() + rarity.slice(1)}**: ${min}–${max} HNP`)
      .join("\n"),
    inline: false,
  });

  await interaction.editReply({ embeds: [embed] });
}
