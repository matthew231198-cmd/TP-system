import {
  SlashCommandBuilder,
  EmbedBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import { BOX_TYPES, RARITY_COLORS, RARITY_EMOJIS, type BoxType } from "../config.js";
import { getOrCreateUser, deductTp, addHnp, logBoxOpen } from "../db.js";
import { rollRarity, rollHnpAmount, formatHnp } from "../utils.js";

export const data = new SlashCommandBuilder()
  .setName("buy")
  .setDescription("Buy an HNP box from the shop")
  .addStringOption((opt) =>
    opt
      .setName("box")
      .setDescription("The box type to buy")
      .setRequired(true)
      .addChoices(
        { name: "🎁 Fun Box (100 TP)", value: "fun" },
        { name: "📦 Calev Box (200 TP)", value: "calev" },
        { name: "💎 Chate Box (300 TP)", value: "chate" }
      )
  )
  .addIntegerOption((opt) =>
    opt
      .setName("quantity")
      .setDescription("How many boxes to buy")
      .setRequired(false)
      .addChoices(
        { name: "x1 (single)", value: 1 },
        { name: "x3 (triple)", value: 3 }
      )
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  const boxKey = interaction.options.getString("box", true) as BoxType;
  const quantity = interaction.options.getInteger("quantity") ?? 1;
  const box = BOX_TYPES[boxKey];
  const totalCost = box.cost * quantity;

  const user = await getOrCreateUser(
    interaction.user.id,
    interaction.user.username
  );

  if (user.tpPoints < totalCost) {
    const embed = new EmbedBuilder()
      .setTitle("❌ Not Enough TP")
      .setDescription(
        `You need **${totalCost} TP** to buy ${quantity > 1 ? `${quantity}x ` : ""}the ${box.emoji} **${box.name}**, but you only have **${user.tpPoints} TP**.\n\nChat more to earn TP points!`
      )
      .setColor(0xe74c3c);
    await interaction.editReply({ embeds: [embed] });
    return;
  }

  const deducted = await deductTp(interaction.user.id, totalCost);
  if (!deducted) {
    await interaction.editReply("Failed to deduct TP points. Please try again.");
    return;
  }

  if (quantity === 1) {
    const rarity = rollRarity(boxKey);
    const hnpAmount = rollHnpAmount(rarity);

    await addHnp(interaction.user.id, hnpAmount);
    await logBoxOpen(interaction.user.id, boxKey, rarity, hnpAmount);

    const rarityEmoji = RARITY_EMOJIS[rarity];
    const rarityColor = RARITY_COLORS[rarity];
    const rarityLabel = rarity.charAt(0).toUpperCase() + rarity.slice(1);

    const updatedUser = await getOrCreateUser(interaction.user.id, interaction.user.username);

    const embed = new EmbedBuilder()
      .setTitle(`${box.emoji} ${box.name} Opened!`)
      .setDescription(
        `You opened a **${box.name}** and got a ${rarityEmoji} **${rarityLabel}** reward!`
      )
      .setColor(rarityColor)
      .addFields(
        { name: "🎉 Rarity", value: `${rarityEmoji} **${rarityLabel}**`, inline: true },
        { name: "💎 HNP Earned", value: `**${formatHnp(hnpAmount)} HNP**`, inline: true },
        { name: "🎯 Remaining TP", value: `${updatedUser.tpPoints} TP`, inline: true },
        { name: "💰 Total HNP", value: `${formatHnp(updatedUser.hnpBalance as string)} HNP`, inline: true }
      )
      .setFooter({ text: `Cost: ${totalCost} TP` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } else {
    const results: { rarity: string; hnp: number; emoji: string }[] = [];
    let totalHnp = 0;

    for (let i = 0; i < quantity; i++) {
      const rarity = rollRarity(boxKey);
      const hnpAmount = rollHnpAmount(rarity);
      results.push({ rarity, hnp: hnpAmount, emoji: RARITY_EMOJIS[rarity] });
      totalHnp += hnpAmount;
      await addHnp(interaction.user.id, hnpAmount);
      await logBoxOpen(interaction.user.id, boxKey, rarity, hnpAmount);
    }

    const updatedUser = await getOrCreateUser(interaction.user.id, interaction.user.username);

    const resultsText = results
      .map((r, i) => {
        const label = r.rarity.charAt(0).toUpperCase() + r.rarity.slice(1);
        return `**Box ${i + 1}:** ${r.emoji} ${label} — ${formatHnp(r.hnp)} HNP`;
      })
      .join("\n");

    const embed = new EmbedBuilder()
      .setTitle(`${box.emoji} ${quantity}x ${box.name} Opened!`)
      .setDescription(`You opened **${quantity} ${box.name}s**!\n\n${resultsText}`)
      .setColor(0x00bcd4)
      .addFields(
        { name: "💎 Total HNP Earned", value: `**${formatHnp(totalHnp)} HNP**`, inline: true },
        { name: "🎯 Remaining TP", value: `${updatedUser.tpPoints} TP`, inline: true },
        { name: "💰 Total HNP Balance", value: `${formatHnp(updatedUser.hnpBalance as string)} HNP`, inline: true }
      )
      .setFooter({ text: `Cost: ${totalCost} TP (${box.cost} TP × ${quantity})` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }
}
