import { content, type Cost } from "../content";
import { formatCost, moodBand, type GameState, type Minion } from "../sim";

/** ASCII progress bar such as [####----]. */
export function bar(frac: number, width = 8): string {
  const n = Math.max(0, Math.min(width, Math.round(frac * width)));
  return `[${"#".repeat(n)}${"-".repeat(width - n)}]`;
}

export function face(m: Minion): string {
  if (m.arrivesIn > 0) return "...";
  return moodBand(content, m.mood).face;
}

export function tag(itemId: string): string {
  return content.items[itemId]?.tag ?? `[${itemId}]`;
}

export function costText(cost: Cost | undefined): string {
  return cost ? formatCost(content, cost) : "";
}

export function clock(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}m ${String(s % 60).padStart(2, "0")}s` : `${s}s`;
}

export function playTime(state: GameState): string {
  const h = Math.floor(state.time / 3600);
  const m = Math.floor((state.time % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export const NEED_LABEL = { warm: "warm", fed: "fed" } as const;
