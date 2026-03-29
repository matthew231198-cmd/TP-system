import { REST, Routes } from "discord.js";
import * as leaderboard from "./commands/leaderboard.js";
import * as balance from "./commands/balance.js";
import * as shop from "./commands/shop.js";
import * as buy from "./commands/buy.js";
import * as withdraw from "./commands/withdraw.js";
import * as info from "./commands/info.js";
import * as admin from "./commands/admin.js";

const token = process.env.DISCORD_BOT_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;

if (!token || !clientId) {
  throw new Error("DISCORD_BOT_TOKEN and DISCORD_CLIENT_ID must be set");
}

const commands = [
  leaderboard.data,
  balance.data,
  shop.data,
  buy.data,
  withdraw.data,
  info.data,
  admin.data,
].map((cmd) => cmd.toJSON());

const rest = new REST().setToken(token);

console.log("Registering slash commands globally...");
await rest.put(Routes.applicationCommands(clientId), { body: commands });
console.log("Successfully registered slash commands!");
