import type { Balance, Content, Cost } from "../content";
import type { GameState, Room } from "./types";

/** Gold-equivalent value of one item, from its tier. */
export function itemValue(content: Content, itemId: string): number {
  const item = content.items[itemId];
  return item ? content.balance.itemValue[item.tier] : 0;
}

export function costValue(content: Content, cost: Cost): number {
  let v = cost.gold;
  for (const [id, n] of Object.entries(cost.items)) v += itemValue(content, id) * n;
  return v;
}

export function scaleCost(cost: Cost, scale: number): Cost {
  if (scale === 1) return cost;
  const items: Record<string, number> = {};
  for (const [id, n] of Object.entries(cost.items)) items[id] = Math.max(1, Math.round(n * scale));
  return { gold: Math.round(cost.gold * scale), items };
}

/** Gold part of the cost of floor number `n` (1-based), before cost scaling. */
export function floorGold(b: Balance, n: number): number {
  const f = b.floor;
  if (n <= f.polyAfter) return f.baseGold * Math.pow(f.growth, n);
  return f.baseGold * Math.pow(f.growth, f.polyAfter) * Math.pow(n / f.polyAfter, f.polyExponent);
}

/** Full cost of building floor number `n`. */
export function floorCost(content: Content, n: number, costScale = 1): Cost {
  const gold = floorGold(content.balance, n);
  const items: Record<string, number> = {};
  for (const g of content.balance.floor.goods) {
    const value = itemValue(content, g.item);
    if (value > 0) items[g.item] = Math.ceil((gold * g.valueShare) / value);
  }
  return scaleCost({ gold: Math.round(gold), items }, costScale);
}

export function roomLevelCost(content: Content, roomType: string, level: number, costScale = 1): Cost | undefined {
  const def = content.rooms[roomType];
  const lvl = def?.levels[level - 1];
  return lvl ? scaleCost(lvl.cost, costScale) : undefined;
}

export function recruitCost(content: Content, minionType: string, costScale = 1): Cost | undefined {
  const def = content.minions[minionType];
  return def ? scaleCost(def.recruitCost, costScale) : undefined;
}

export function missing(state: GameState, cost: Cost): string[] {
  const out: string[] = [];
  if (state.gold < cost.gold) out.push(`${Math.ceil(cost.gold - state.gold)} gold`);
  for (const [id, n] of Object.entries(cost.items)) {
    const have = state.inventory[id] ?? 0;
    if (have < n) out.push(`${n - have} ${id}`);
  }
  return out;
}

export function canAfford(state: GameState, cost: Cost): boolean {
  return missing(state, cost).length === 0;
}

/** Deducts a cost. Caller must check affordability first. Mutates. */
export function pay(state: GameState, cost: Cost): void {
  state.gold -= cost.gold;
  for (const [id, n] of Object.entries(cost.items)) state.inventory[id] = (state.inventory[id] ?? 0) - n;
}

/** Adds a fraction of a cost back. Mutates. */
export function refund(state: GameState, cost: Cost, share: number): void {
  state.gold += Math.floor(cost.gold * share);
  for (const [id, n] of Object.entries(cost.items)) {
    const back = Math.floor(n * share);
    if (back > 0) state.inventory[id] = (state.inventory[id] ?? 0) + back;
  }
}

export function slots(content: Content, room: Room): number {
  const def = content.rooms[room.type];
  return def?.resident ? room.level * content.balance.production.slotsPerLevel : 0;
}

export function towerLevel(content: Content, exp: number): number {
  return 1 + Math.floor(Math.sqrt(exp / content.balance.exp.perLevel));
}

export function formatCost(content: Content, cost: Cost): string {
  const parts: string[] = [];
  if (cost.gold) parts.push(`${cost.gold}g`);
  for (const [id, n] of Object.entries(cost.items)) parts.push(`${n} ${content.items[id]?.tag ?? id}`);
  return parts.join(" ") || "free";
}
