import {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
} from "discord.js";
import {
  resetAllTpPoints,
  adminAdjustTp,
  getOrCreateUser,
  setBotConfig,
  getBotConfig,
} from "../db.js";

export const data = new SlashCommandBuilder()
  .setName("admin")
  .setDescription("Admin-only management commands")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand((sub) =>
    sub
      .setName("resettp")
      .setDescription("Reset ALL users' TP points to 0 (use before event start)")
  )
  .addSubcommand((sub) =>
    sub
      .setName("adjusttp")
      .setDescription("Add or reduce TP points for a specific user")
      .addUserOption((opt) =>
        opt.setName("user").setDescription("The user to adjust").setRequired(true)
      )
      .addIntegerOption((opt) =>
        opt
          .setName("amount")
          .setDescription("Amount to add (positive) or reduce (negative)")
          .setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("seteventstart")
      .setDescription("Set the event start date (bot won't give points before this date)")
      .addStringOption((opt) =>
        opt
          .setName("date")
          .setDescription("Start date in YYYY-MM-DD format (e.g. 2026-04-01)")
          .setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("setwithdrawalchannel")
      .setDescription("Set the channel where withdrawal notifications are sent")
      .addChannelOption((opt) =>
        opt
          .setName("channel")
          .setDescription("The channel to send withdrawal notifications to")
          .setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("status")
      .setDescription("View current bot configuration")
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    await interaction.editReply("❌ You need Administrator permission to use this command.");
    return;
  }

  const sub = interaction.options.getSubcommand();

  if (sub === "resettp") {
    await resetAllTpPoints();
    const embed = new EmbedBuilder()
      .setTitle("✅ TP Points Reset")
      .setDescription("All users' TP points have been reset to **0**.\nDaily activity records have been cleared.")
      .setColor(0x4caf50)
      .setTimestamp();
    await interaction.editReply({ embeds: [embed] });
    return;
  }

  if (sub === "adjusttp") {
    const targetUser = interaction.options.getUser("user", true);
    const amount = interaction.options.getInteger("amount", true);

    await getOrCreateUser(targetUser.id, targetUser.username);
    const newTotal = await adminAdjustTp(targetUser.id, amount);

    if (newTotal === -1) {
      await interaction.editReply("❌ User not found.");
      return;
    }

    const action = amount >= 0 ? `+${amount}` : `${amount}`;
    const embed = new EmbedBuilder()
      .setTitle("✅ TP Adjusted")
      .setColor(amount >= 0 ? 0x4caf50 : 0xe74c3c)
      .addFields(
        { name: "👤 User", value: `<@${targetUser.id}>`, inline: true },
        { name: "📊 Change", value: `**${action} TP**`, inline: true },
        { name: "🎯 New Total", value: `**${newTotal} TP**`, inline: true }
      )
      .setTimestamp();
    await interaction.editReply({ embeds: [embed] });
    return;
  }

  if (sub === "seteventstart") {
    const dateStr = interaction.options.getString("date", true);
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(dateStr)) {
      await interaction.editReply("❌ Invalid date format. Use YYYY-MM-DD (e.g. `2026-04-01`).");
      return;
    }

    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      await interaction.editReply("❌ Invalid date. Please provide a valid date.");
      return;
    }

    await setBotConfig("event_start_date", dateStr);
    const embed = new EmbedBuilder()
      .setTitle("✅ Event Start Date Set")
      .setDescription(`The event will start on **${dateStr}**.\nTP points will only be awarded on or after this date.`)
      .setColor(0x4caf50)
      .setTimestamp();
    await interaction.editReply({ embeds: [embed] });
    return;
  }

  if (sub === "setwithdrawalchannel") {
    const channel = interaction.options.getChannel("channel", true);
    await setBotConfig("withdrawal_channel_id", channel.id);
    const embed = new EmbedBuilder()
      .setTitle("✅ Withdrawal Channel Set")
      .setDescription(`Withdrawal notifications will now be sent to <#${channel.id}>.`)
      .setColor(0x4caf50)
      .setTimestamp();
    await interaction.editReply({ embeds: [embed] });
    return;
  }

  if (sub === "status") {
    const eventStart = await getBotConfig("event_start_date");
    const withdrawalChannel = await getBotConfig("withdrawal_channel_id");

    const embed = new EmbedBuilder()
      .setTitle("⚙️ Bot Configuration")
      .setColor(0x5865f2)
      .addFields(
        {
          name: "📅 Event Start Date",
          value: eventStart
            ? `**${eventStart}** ${new Date(eventStart) <= new Date() ? "✅ Active" : "⏳ Upcoming"}`
            : "Not set (TP rewards active now)",
          inline: false,
        },
        {
          name: "📢 Withdrawal Channel",
          value: withdrawalChannel ? `<#${withdrawalChannel}>` : "Not set",
          inline: false,
        }
      )
      .setTimestamp();
    await interaction.editReply({ embeds: [embed] });
    return;
  }
}
