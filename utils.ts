import { BOX_TYPES, HNP_REWARDS, type BoxType, type Rarity } from "./config.js";

export function rollRarity(boxType: BoxType): Rarity {
  const box = BOX_TYPES[boxType];
  const roll = Math.random();
  let cumulative = 0;

  const order: Rarity[] = ["legendary", "epic", "rare", "uncommon", "common"];
  for (const rarity of order) {
    cumulative += box.rarities[rarity];
    if (roll <= cumulative) return rarity;
  }
  return "common";
}

export function rollHnpAmount(rarity: Rarity): number {
  const { min, max } = HNP_REWARDS[rarity];
  const amount = min + Math.random() * (max - min);
  return parseFloat(amount.toFixed(6));
}

export function formatHnp(amount: number | string): string {
  return parseFloat(String(amount)).toFixed(4);
}

export function calcTpPerMessage(): number {
  return 1;
}

export function getTodayString(): string {
  return new Date().toISOString().split("T")[0];
}

export function isEventActive(startDate: string | null): boolean {
  if (!startDate) return true;
  const start = new Date(startDate);
  const now = new Date();
  return now >= start;
}
