import http from "http";
import {
  Client,
  GatewayIntentBits,
  Events,
  Collection,
  type ChatInputCommandInteraction,
  type Guild,
} from "discord.js";
import { db } from "@workspace/db";
import {
  usersTable,
  dailyActivityTable,
  botConfigTable,
} from "@workspace/db";
import { sql } from "drizzle-orm";

import * as leaderboard from "./commands/leaderboard.js";
import * as balance from "./commands/balance.js";
import * as shop from "./commands/shop.js";
import * as buy from "./commands/buy.js";
import * as withdraw from "./commands/withdraw.js";
import * as info from "./commands/info.js";
import * as admin from "./commands/admin.js";
import * as invite from "./commands/invite.js";

import {
  addTpPoints,
  getOrCreateUser,
  getBotConfig,
  getInviteByCode,
  updateInviteUses,
  isFirstTimeJoin,
  recordMemberJoin,
  addInviteTpPoints,
} from "./db.js";
import { MIN_MESSAGE_LENGTH, MAX_DAILY_TP, TP_PER_INVITE } from "./config.js";
import { isEventActive, calcTpPerMessage } from "./utils.js";

const token = process.env.DISCORD_BOT_TOKEN;
if (!token) throw new Error("DISCORD_BOT_TOKEN is required");

await ensureSchema();

const GUILD_MEMBERS_ENABLED = process.env.GUILD_MEMBERS_INTENT === "true";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    ...(GUILD_MEMBERS_ENABLED ? [GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildInvites] : []),
  ],
});

const commands = new Collection<
  string,
  { data: { name: string }; execute: Function }
>();

commands.set(leaderboard.data.name, leaderboard);
commands.set(balance.data.name, balance);
commands.set(shop.data.name, shop);
commands.set(buy.data.name, buy);
commands.set(withdraw.data.name, withdraw);
commands.set(info.data.name, info);
commands.set(admin.data.name, admin);
commands.set(invite.data.name, invite);

// Invite use-count cache: guildId -> (inviteCode -> useCount)
const inviteCache = new Map<string, Map<string, number>>();

async function cacheGuildInvites(guild: Guild) {
  try {
    const invites = await guild.invites.fetch();
    const map = new Map<string, number>();
    for (const inv of invites.values()) {
      map.set(inv.code, inv.uses ?? 0);
    }
    inviteCache.set(guild.id, map);
    console.log(`📨 Cached ${map.size} invite(s) for guild ${guild.name}`);
  } catch (err) {
    console.warn(`Could not cache invites for guild ${guild.id}: ${err}`);
  }
}

client.once(Events.ClientReady, async (c) => {
  console.log(`✅ Logged in as ${c.user.tag}`);
  console.log(`📊 Serving ${c.guilds.cache.size} guild(s)`);

  if (GUILD_MEMBERS_ENABLED) {
    for (const guild of c.guilds.cache.values()) {
      await cacheGuildInvites(guild);
    }
    console.log("✅ Invite tracking active");
  } else {
    console.log("⚠️  Invite tracking disabled (set GUILD_MEMBERS_INTENT=true to enable)");
  }

  await registerCommands(c.user.id);
});

client.on(Events.GuildCreate, async (guild) => {
  if (GUILD_MEMBERS_ENABLED) await cacheGuildInvites(guild);
});

client.on(Events.InviteCreate, async (inv) => {
  if (!inviteCache.has(inv.guild!.id)) {
    inviteCache.set(inv.guild!.id, new Map());
  }
  inviteCache.get(inv.guild!.id)!.set(inv.code, inv.uses ?? 0);
});

client.on(Events.InviteDelete, async (inv) => {
  inviteCache.get(inv.guild!.id)?.delete(inv.code);
});

client.on(Events.GuildMemberAdd, async (member) => {
  if (!GUILD_MEMBERS_ENABLED) return;
  try {
    const guild = member.guild;
    const cachedInvites = inviteCache.get(guild.id) ?? new Map<string, number>();

    // Fetch fresh invites to compare
    let freshInvites: Map<string, number>;
    try {
      const fetched = await guild.invites.fetch();
      freshInvites = new Map<string, number>();
      for (const inv of fetched.values()) {
        freshInvites.set(inv.code, inv.uses ?? 0);
      }
    } catch {
      console.warn(`Could not fetch invites for guild ${guild.id}`);
      return;
    }

    // Find which invite's use count went up
    let usedInviteCode: string | null = null;
    for (const [code, freshUses] of freshInvites.entries()) {
      const cachedUses = cachedInvites.get(code) ?? 0;
      if (freshUses > cachedUses) {
        usedInviteCode = code;
        await updateInviteUses(code, freshUses);
        break;
      }
    }

    // Update our cache
    inviteCache.set(guild.id, freshInvites);

    if (!usedInviteCode) return;

    // Look up the inviter from our DB
    const dbInvite = await getInviteByCode(usedInviteCode);
    if (!dbInvite) return;

    // Check if this member has ever joined before (prevent rejoin abuse)
    const firstTime = await isFirstTimeJoin(member.id);
    await recordMemberJoin(member.id);

    if (!firstTime) {
      console.log(`[INVITE] ${member.user.username} rejoined — no TP awarded`);
      return;
    }

    // Award TP to the inviter
    const inviterUser = await getOrCreateUser(dbInvite.inviterDiscordId, "unknown");
    const result = await addInviteTpPoints(dbInvite.inviterDiscordId, inviterUser.username);

    if (result.pointsAdded > 0) {
      console.log(
        `[INVITE] ${member.user.username} joined via ${dbInvite.inviterDiscordId}'s invite — awarded ${result.pointsAdded} TP`
      );
      // Notify the inviter in DM
      try {
        const inviterMember = await guild.members.fetch(dbInvite.inviterDiscordId);
        await inviterMember.send(
          `🎉 **${member.user.username}** joined using your invite link! You earned **${TP_PER_INVITE} TP**.`
        );
      } catch {
        // DMs might be disabled — not critical
      }
    } else {
      console.log(`[INVITE] Daily invite TP cap reached for ${dbInvite.inviterDiscordId}`);
    }
  } catch (err) {
    console.error("Error handling GuildMemberAdd:", err);
  }
});

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;
  if (!message.guild) return;

  const content = message.content.trim();
  if (content.length < MIN_MESSAGE_LENGTH) return;

  const startDate = await getBotConfig("event_start_date").catch(() => null);
  if (!isEventActive(startDate)) return;

  try {
    const points = calcTpPerMessage();
    const result = await addTpPoints(
      message.author.id,
      message.author.username,
      points
    );

    if (result.pointsAdded > 0) {
      console.log(
        `[TP] ${message.author.username} earned ${result.pointsAdded} TP (total: ${result.newTotal})`
      );
    }
  } catch (err) {
    console.error("Error adding TP points:", err);
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = commands.get(interaction.commandName);
  if (!command) return;

  try {
    if (interaction.commandName === "withdraw" || interaction.commandName === "invite") {
      await (command as any).execute(interaction, client);
    } else {
      await command.execute(interaction as ChatInputCommandInteraction);
    }
  } catch (err) {
    console.error(`Error executing /${interaction.commandName}:`, err);
    const msg = "There was an error while executing this command!";
    if (interaction.replied || interaction.deferred) {
      await interaction.editReply(msg).catch(() => {});
    } else {
      await interaction.reply({ content: msg, ephemeral: true }).catch(() => {});
    }
  }
});

client.login(token);

const port = process.env.PORT ? parseInt(process.env.PORT) : 3000;
const server = http.createServer((_req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Discord bot is running!");
});
server.listen(port, () => {
  console.log(`✅ Health server listening on port ${port}`);
});

async function ensureSchema() {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS discord_users (
        id SERIAL PRIMARY KEY,
        discord_id TEXT NOT NULL UNIQUE,
        username TEXT NOT NULL,
        tp_points INTEGER NOT NULL DEFAULT 0,
        hnp_balance NUMERIC(18, 6) NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS discord_daily_activity (
        id SERIAL PRIMARY KEY,
        discord_id TEXT NOT NULL,
        date TEXT NOT NULL,
        points_earned INTEGER NOT NULL DEFAULT 0,
        invite_points_earned INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS discord_opened_boxes (
        id SERIAL PRIMARY KEY,
        discord_id TEXT NOT NULL,
        box_type TEXT NOT NULL,
        rarity TEXT NOT NULL,
        hnp_amount NUMERIC(18, 6) NOT NULL,
        opened_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS discord_withdrawals (
        id SERIAL PRIMARY KEY,
        discord_id TEXT NOT NULL,
        username TEXT NOT NULL,
        hnp_amount NUMERIC(18, 6) NOT NULL,
        wallet_address TEXT NOT NULL,
        requested_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS discord_bot_config (
        id SERIAL PRIMARY KEY,
        key TEXT NOT NULL UNIQUE,
        value TEXT NOT NULL,
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS discord_invites (
        id SERIAL PRIMARY KEY,
        invite_code TEXT NOT NULL UNIQUE,
        inviter_discord_id TEXT NOT NULL,
        guild_id TEXT NOT NULL,
        uses INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS discord_joined_members (
        id SERIAL PRIMARY KEY,
        discord_id TEXT NOT NULL UNIQUE,
        first_joined_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    // Migrate existing table: add invite_points_earned if it doesn't exist
    await db.execute(sql`
      ALTER TABLE discord_daily_activity
        ADD COLUMN IF NOT EXISTS invite_points_earned INTEGER NOT NULL DEFAULT 0;
    `);

    console.log("✅ Database schema ready");
  } catch (err) {
    console.error("Error setting up schema:", err);
    throw err;
  }
}

async function registerCommands(clientId: string) {
  try {
    const { REST, Routes } = await import("discord.js");
    const rest = new REST().setToken(token!);
    const commandData = [
      leaderboard.data,
      balance.data,
      shop.data,
      buy.data,
      withdraw.data,
      info.data,
      admin.data,
      invite.data,
    ].map((cmd) => cmd.toJSON());

    await rest.put(Routes.applicationCommands(clientId), { body: commandData });
    console.log("✅ Slash commands registered globally");
  } catch (err) {
    console.error("Failed to register commands:", err);
  }
}
