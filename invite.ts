import {
  SlashCommandBuilder,
  EmbedBuilder,
  type ChatInputCommandInteraction,
  type Client,
  ChannelType,
} from "discord.js";
import { getOrCreateInvite, saveInvite } from "../db.js";

export const data = new SlashCommandBuilder()
  .setName("invite")
  .setDescription("Get your personal invite link for this server — earn 10 TP for each new member you bring!");

export async function execute(
  interaction: ChatInputCommandInteraction,
  client: Client
) {
  await interaction.deferReply({ ephemeral: true });

  if (!interaction.guild) {
    await interaction.editReply("This command can only be used in a server.");
    return;
  }

  const existing = await getOrCreateInvite(interaction.user.id, interaction.guild.id);

  if (existing) {
    try {
      const inv = await interaction.guild.invites.fetch(existing.inviteCode);
      if (inv) {
        const embed = new EmbedBuilder()
          .setTitle("🔗 Your Personal Invite Link")
          .setDescription(`Share this link to invite friends and earn **10 TP per new member**!`)
          .setColor(0x00bcd4)
          .addFields(
            { name: "📨 Your Link", value: `https://discord.gg/${existing.inviteCode}`, inline: false },
            { name: "✅ Valid Invites", value: `**${inv.uses ?? existing.uses}** members joined`, inline: true },
            { name: "📊 Invite TP Cap", value: "100 TP/day from invites", inline: true }
          )
          .setFooter({ text: "Only first-time joins count. Rejoins don't earn TP." })
          .setTimestamp();
        await interaction.editReply({ embeds: [embed] });
        return;
      }
    } catch {
      // invite expired or deleted, recreate below
    }
  }

  // Find a text channel to create invite in
  const textChannel = interaction.guild.channels.cache.find(
    (ch) => ch.type === ChannelType.GuildText && ch.permissionsFor(interaction.guild!.members.me!)?.has("CreateInstantInvite")
  );

  if (!textChannel || textChannel.type !== ChannelType.GuildText) {
    await interaction.editReply("I don't have permission to create invites. Please give me the **Create Invite** permission.");
    return;
  }

  try {
    const invite = await textChannel.createInvite({
      maxAge: 0,
      maxUses: 0,
      unique: true,
      reason: `Personal invite for ${interaction.user.username}`,
    });

    await saveInvite(invite.code, interaction.user.id, interaction.guild.id);

    const embed = new EmbedBuilder()
      .setTitle("🔗 Your Personal Invite Link")
      .setDescription(`Share this link to invite friends and earn **10 TP per new member**!`)
      .setColor(0x00bcd4)
      .addFields(
        { name: "📨 Your Link", value: `https://discord.gg/${invite.code}`, inline: false },
        { name: "✅ Valid Invites", value: "0 members joined (so far!)", inline: true },
        { name: "📊 Invite TP Cap", value: "100 TP/day from invites", inline: true }
      )
      .setFooter({ text: "Only first-time joins count. Rejoins don't earn TP." })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    console.error("Failed to create invite:", err);
    await interaction.editReply("Failed to create invite link. Make sure I have the **Create Invite** permission.");
  }
}
