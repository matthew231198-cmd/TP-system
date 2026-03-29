import {
  SlashCommandBuilder,
  EmbedBuilder,
  type ChatInputCommandInteraction,
  type Client,
} from "discord.js";
import { getOrCreateUser, deductHnp, logWithdrawal, getBotConfig } from "../db.js";
import { formatHnp } from "../utils.js";
import { MIN_WITHDRAWAL } from "../config.js";

export const data = new SlashCommandBuilder()
  .setName("withdraw")
  .setDescription("Withdraw your HNP balance")
  .addIntegerOption((opt) =>
    opt
      .setName("amount")
      .setDescription(`Amount of HNP to withdraw (whole numbers only, minimum ${MIN_WITHDRAWAL})`)
      .setRequired(true)
      .setMinValue(MIN_WITHDRAWAL)
  );

export async function execute(
  interaction: ChatInputCommandInteraction,
  client: Client
) {
  await interaction.deferReply({ ephemeral: true });

  const amount = interaction.options.getInteger("amount", true);

  if (amount < MIN_WITHDRAWAL) {
    const embed = new EmbedBuilder()
      .setTitle("❌ Amount Too Low")
      .setDescription(`Minimum withdrawal is **${MIN_WITHDRAWAL} HNP**.`)
      .setColor(0xe74c3c);
    await interaction.editReply({ embeds: [embed] });
    return;
  }

  const user = await getOrCreateUser(
    interaction.user.id,
    interaction.user.username
  );

  const currentBalance = parseFloat(user.hnpBalance as string);

  if (currentBalance < amount) {
    const embed = new EmbedBuilder()
      .setTitle("❌ Insufficient HNP Balance")
      .setDescription(
        `You only have **${formatHnp(currentBalance)} HNP** but tried to withdraw **${formatHnp(amount)} HNP**.`
      )
      .setColor(0xe74c3c);
    await interaction.editReply({ embeds: [embed] });
    return;
  }

  const success = await deductHnp(interaction.user.id, amount);
  if (!success) {
    await interaction.editReply("Failed to process withdrawal. Please try again.");
    return;
  }

  await logWithdrawal(interaction.user.id, interaction.user.username, amount);

  const updatedUser = await getOrCreateUser(
    interaction.user.id,
    interaction.user.username
  );

  const withdrawalChannelId = await getBotConfig("withdrawal_channel_id");
  if (withdrawalChannelId) {
    try {
      const channel = await client.channels.fetch(withdrawalChannelId);
      if (channel && channel.isTextBased()) {
        const announcementEmbed = new EmbedBuilder()
          .setTitle("💸 HNP Withdrawal Request")
          .setColor(0xff9800)
          .addFields(
            { name: "👤 User", value: `<@${interaction.user.id}> (${interaction.user.username})`, inline: true },
            { name: "💎 Amount", value: `**${formatHnp(amount)} HNP**`, inline: true }
          )
          .setFooter({ text: "HNP has been deducted from user balance" })
          .setTimestamp();

        await channel.send({ embeds: [announcementEmbed] });
      }
    } catch (err) {
      console.error("Failed to send withdrawal notification:", err);
    }
  }

  const confirmEmbed = new EmbedBuilder()
    .setTitle("✅ Withdrawal Submitted")
    .setDescription("Your withdrawal request has been recorded. The admin will process it.")
    .setColor(0x4caf50)
    .addFields(
      { name: "💎 Withdrawn", value: `**${formatHnp(amount)} HNP**`, inline: true },
      { name: "💰 Remaining Balance", value: `**${formatHnp(updatedUser.hnpBalance as string)} HNP**`, inline: true }
    )
    .setTimestamp();

  await interaction.editReply({ embeds: [confirmEmbed] });
}
