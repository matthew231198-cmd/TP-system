import {
  SlashCommandBuilder,
  EmbedBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import { BOX_TYPES, HNP_REWARDS, MAX_DAILY_TP, MAX_DAILY_INVITE_TP, MIN_MESSAGE_LENGTH, MIN_WITHDRAWAL, TP_PER_INVITE } from "../config.js";

export const data = new SlashCommandBuilder()
  .setName("info")
  .setDescription("Learn how everything works — TP points, boxes, and HNP withdrawals");

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  const tpEmbed = new EmbedBuilder()
    .setTitle("📖 How Everything Works")
    .setColor(0x5865f2)
    .setDescription("Welcome to the HNP reward system! Here's a complete guide:")
    .addFields(
      {
        name: "🎯 Step 1: Earn TP Points",
        value: [
          `• Chat in the server to earn TP points`,
          `• Each message must be at least **${MIN_MESSAGE_LENGTH} characters** long`,
          `• You earn **1 TP** per valid message`,
          `• Maximum of **${MAX_DAILY_TP} TP per day** from messages`,
          `• Invite friends to earn **${TP_PER_INVITE} TP per new member** (max ${MAX_DAILY_INVITE_TP} TP/day from invites)`,
          `• Use \`/balance\` to check your points`,
          `• Use \`/leaderboard\` to see top chatters`,
        ].join("\n"),
        inline: false,
      },
      {
        name: "🔗 Invite Bonus",
        value: [
          `• Use \`/invite\` to get your personal invite link`,
          `• Earn **${TP_PER_INVITE} TP** every time a **new member** joins through your link`,
          `• Rejoins don't count — only first-time members`,
          `• Invite TP is capped at **${MAX_DAILY_INVITE_TP} TP/day**`,
          `• You'll receive a DM when someone joins using your link`,
        ].join("\n"),
        inline: false,
      },
      {
        name: "🏪 Step 2: Buy HNP Boxes",
        value: [
          `Use \`/buy\` to spend TP and open a box (x1 or x3 at a time):`,
          ``,
          `🎁 **Fun Box** — 100 TP`,
          `> 50% Common | 30% Uncommon | 12% Rare | 6% Epic | 2% Legendary`,
          ``,
          `📦 **Calev Box** — 200 TP`,
          `> 30% Common | 40% Uncommon | 15% Rare | 12% Epic | 3% Legendary`,
          ``,
          `💎 **Chate Box** — 300 TP`,
          `> 20% Common | 50% Uncommon | 10% Rare | 15% Epic | 5% Legendary`,
        ].join("\n"),
        inline: false,
      },
      {
        name: "💎 HNP Rewards by Rarity",
        value: [
          `⚪ **Common**: ${HNP_REWARDS.common.min} – ${HNP_REWARDS.common.max} HNP`,
          `🟢 **Uncommon**: ${HNP_REWARDS.uncommon.min} – ${HNP_REWARDS.uncommon.max} HNP`,
          `🔵 **Rare**: ${HNP_REWARDS.rare.min} – ${HNP_REWARDS.rare.max} HNP`,
          `🟣 **Epic**: ${HNP_REWARDS.epic.min} – ${HNP_REWARDS.epic.max} HNP`,
          `🌟 **Legendary**: ${HNP_REWARDS.legendary.min} – ${HNP_REWARDS.legendary.max} HNP`,
        ].join("\n"),
        inline: false,
      },
      {
        name: "💸 Step 3: Withdraw HNP",
        value: [
          `• Use \`/withdraw <amount>\` to request a withdrawal`,
          `• Minimum withdrawal: **${MIN_WITHDRAWAL} HNP** (whole numbers only)`,
          `• Your HNP balance is deducted immediately`,
          `• A notification is sent to the admin channel`,
          `• The admin team will process your withdrawal`,
          `• Use \`/balance\` to see your current HNP balance`,
        ].join("\n"),
        inline: false,
      },
      {
        name: "🛠️ Useful Commands",
        value: [
          `\`/balance\` — Check your TP & HNP balance`,
          `\`/leaderboard\` — View top TP earners`,
          `\`/shop\` — Browse available boxes & rewards`,
          `\`/buy <box> [quantity]\` — Purchase 1 or 3 boxes`,
          `\`/withdraw <amount>\` — Withdraw HNP`,
          `\`/invite\` — Get your personal invite link`,
          `\`/info\` — This guide`,
        ].join("\n"),
        inline: false,
      }
    )
    .setFooter({ text: "Good luck and happy chatting! 🎉" });

  await interaction.editReply({ embeds: [tpEmbed] });
}
