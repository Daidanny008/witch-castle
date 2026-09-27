import type { Content } from "../content";
import type { GameState, Minion, Room } from "./types";

/** Which room occupies each cell: grid[floor][cell] (floor is 1-based, index 0 unused). */
export function occupancy(content: Content, state: GameState): (string | null)[][] {
  const width = content.balance.floorWidth;
  const grid: (string | null)[][] = [];
  for (let f = 0; f <= state.floors; f++) grid.push(new Array<string | null>(width).fill(null));
  for (const room of Object.values(state.rooms)) {
    const w = content.rooms[room.type]?.width ?? 1;
    const row = grid[room.floor];
    if (!row) continue;
    for (let c = room.cell; c < room.cell + w && c < width; c++) row[c] = room.id;
  }
  return grid;
}

export function fits(content: Content, state: GameState, roomType: string, floor: number, cell: number, ignoreRoomId?: string): boolean {
  const def = content.rooms[roomType];
  if (!def) return false;
  if (floor < 1 || floor > state.floors || cell < 0 || cell + def.width > content.balance.floorWidth) return false;
  const row = occupancy(content, state)[floor];
  if (!row) return false;
  for (let c = cell; c < cell + def.width; c++) {
    const occ = row[c];
    if (occ !== null && occ !== ignoreRoomId) return false;
  }
  return true;
}

export function isStairs(content: Content, room: Room): boolean {
  return content.rooms[room.type]?.utility?.kind === "stairs";
}

/**
 * Where a staircase meets each floor, in floor spaces. A right-facing flight starts at the
 * bottom-left of its space and arrives at the top-right on the floor above; left-facing is mirrored.
 */
export function stairEnds(content: Content, room: Room): { bottomX: number; topX: number } {
  const right = content.rooms[room.type]?.utility?.facing !== "left";
  const lo = room.cell + 0.1;
  const hi = room.cell + 0.9;
  return right ? { bottomX: lo, topX: hi } : { bottomX: hi, topX: lo };
}

/**
 * Floors joined by stairs. Stairs on floor f connect f to f+1.
 * Returns component index per floor (1-based; index 0 unused).
 */
export function floorComponents(content: Content, state: GameState): number[] {
  const hasStairs = new Set<number>();
  for (const r of Object.values(state.rooms)) if (isStairs(content, r)) hasStairs.add(r.floor);
  const comp = [0];
  let id = 0;
  for (let f = 1; f <= state.floors; f++) {
    if (f > 1 && !hasStairs.has(f - 1)) id++;
    comp.push(id);
  }
  return comp;
}

export function isArrived(m: Minion): boolean {
  return m.arrivesIn <= 0;
}

/** The floor a minion is on right now (the ground outside counts as floor 1). */
export function minionFloor(state: GameState, m: Minion): number {
  return Math.max(1, Math.min(state.floors, m.floor));
}

export function isLitFurnace(r: Room): boolean {
  return r.type === "furnace" && r.fuel > 0;
}

export function isWorkingToilet(r: Room): boolean {
  return r.type === "toilet" && !r.clogged;
}

/**
 * Whether a floor is warm: a lit furnace within reach. The roof counts as floor `floors + 1`,
 * so a furnace on the top floor warms it like any floor above.
 */
export function isWarm(content: Content, state: GameState, floor: number): boolean {
  const reach = content.balance.upkeep.furnaceReach;
  return Object.values(state.rooms).some((r) => isLitFurnace(r) && Math.abs(r.floor - floor) <= reach);
}

export interface FloorStatus {
  floor: number;
  component: number;
  warm: boolean;
  /** Working toilets reachable from this floor. */
  toilets: number;
  /** Arrived minions sharing those toilets. */
  users: number;
  /** A working toilet can be reached from this floor (shown as a hint; not a need). */
  hasToilet: boolean;
  connectedToGround: boolean;
}

export function floorStatuses(content: Content, state: GameState): FloorStatus[] {
  const up = content.balance.upkeep;
  const comp = floorComponents(content, state);
  const toiletsBy = new Map<number, number>();
  const usersBy = new Map<number, number>();
  const litFloors: number[] = [];
  for (const r of Object.values(state.rooms)) {
    if (isWorkingToilet(r)) toiletsBy.set(comp[r.floor]!, (toiletsBy.get(comp[r.floor]!) ?? 0) + 1);
    if (isLitFurnace(r)) litFloors.push(r.floor);
  }
  for (const m of Object.values(state.minions)) {
    if (!isArrived(m)) continue;
    const c = comp[minionFloor(state, m)]!;
    usersBy.set(c, (usersBy.get(c) ?? 0) + 1);
  }
  const out: FloorStatus[] = [];
  for (let f = 1; f <= state.floors; f++) {
    const c = comp[f]!;
    const toilets = toiletsBy.get(c) ?? 0;
    const users = usersBy.get(c) ?? 0;
    out.push({
      floor: f,
      component: c,
      warm: litFloors.some((lf) => Math.abs(lf - f) <= up.furnaceReach),
      toilets,
      users,
      hasToilet: toilets > 0,
      connectedToGround: c === comp[1],
    });
  }
  return out;
}

export function moodBand(content: Content, mood: number) {
  const bands = content.balance.mood.bands;
  return bands.find((b) => mood >= b.min) ?? bands[bands.length - 1]!;
}

export function arrivedResidents(state: GameState, room: Room): Minion[] {
  const out: Minion[] = [];
  for (const id of room.minionIds) {
    const m = state.minions[id];
    if (m && isArrived(m)) out.push(m);
  }
  return out;
}

/** How much a producing room can hold before its workers stop: goods count, or gold. */
export function storageCap(content: Content, room: Room, workers: number): number {
  const prod = content.rooms[room.type]?.production;
  if (!prod) return 0;
  return prod.kind === "gold" ? prod.goldPerMinute * prod.storageMinutes * workers : prod.storagePerMinion * workers;
}

export function storageFull(content: Content, state: GameState, room: Room): boolean {
  const prod = content.rooms[room.type]?.production;
  const workers = arrivedResidents(state, room).length;
  if (!prod || workers === 0) return false;
  const held = prod.kind === "gold" ? room.storedGold : Object.values(room.stored).reduce((a, n) => a + n, 0);
  return held >= storageCap(content, room, workers) - 1e-9;
}

/** A crafter is working only while standing at its station in a room that is producing. */
export function isWorking(_content: Content, _state: GameState, m: Minion): boolean {
  return m.atWork;
}

/** What a minion is doing, in a few words for the player. */
export function activityText(m: Minion): string {
  if (m.arrivesIn > 0) return "on the way";
  if (m.carried) return "being carried";
  if (m.fall) return "falling!";
  if (m.errand?.stage === "go") return "rushing to the toilet";
  if (m.errand?.stage === "queue") return `queueing for the toilet (${Math.floor(m.errand.waited)}s)`;
  if (m.errand?.stage === "use") return "in the toilet";
  if (m.sick > 0) return m.sickReason === "hurt" ? "hurt, resting" : "sick, resting";
  if (m.atWork) return "working";
  if (m.climb) return "on the stairs";
  return "idle";
}

/** Where to draw a minion. y is height in floors above the ground (standing on floor f is y = f - 1). */
export interface Placement {
  id: string;
  x: number;
  y: number;
  depth: number;
  walking: boolean;
  running: boolean;
  climbing: boolean;
  falling: boolean;
  carried: boolean;
  inToilet: boolean; // using a toilet (still drawn, standing in it)
}

export function placement(m: Minion): Placement {
  const climbing = m.climb !== null;
  const y = m.fall ? m.fall.y : m.climb ? m.climb.from - 1 + (m.climb.to - m.climb.from) * m.climb.t : m.floor - 1;
  const x = m.climb ? m.climb.x0 + (m.climb.x1 - m.climb.x0) * m.climb.t : m.x;
  const moving = climbing || (m.target !== null && Math.abs(m.target.x - m.x) > 0.02) || (m.target?.floor ?? m.floor) !== m.floor;
  return {
    id: m.id,
    x,
    y,
    depth: m.depth,
    walking: moving && m.pace === "walk",
    running: moving && m.pace === "run",
    climbing,
    falling: m.fall !== null,
    carried: m.carried,
    inToilet: m.errand?.stage === "use",
  };
}

export function population(state: GameState): { arrived: number; total: number } {
  const all = Object.values(state.minions);
  return { arrived: all.filter(isArrived).length, total: all.length };
}
