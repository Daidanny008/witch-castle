import type { Content } from "../content";
import { rand } from "./rng";
import { STATE_VERSION, type GameState, type Minion, type Room } from "./types";

export function makeRoom(content: Content, id: string, type: string, floor: number, cell: number): Room {
  const isFurnace = content.rooms[type]?.utility?.kind === "furnace";
  return {
    id,
    type,
    level: 1,
    floor,
    cell,
    minionIds: [],
    counters: [0, 0, 0],
    stored: {},
    storedGold: 0,
    fuel: isFurnace ? content.balance.upkeep.furnaceBurnMinutes : 0,
    visits: 0,
    clogged: false,
    occupant: null,
  };
}

/** Creates a minion that will appear outside the front door once `arrivesIn` seconds pass. Mutates `state` (ids, rng). */
export function createMinion(content: Content, state: GameState, type: string, roomId: string, arrivesIn: number): Minion {
  const id = newId(state, "m");
  const jitter = content.balance.toilet.intervalJitter;
  return {
    id,
    type,
    name: pickName(content, state),
    roomId,
    mood: 70,
    arrivesIn,
    needs: { warm: true, fed: true },
    floor: 1,
    x: content.balance.floorWidth + content.balance.movement.outsideWidth - 0.3,
    climb: null,
    target: null,
    pace: "walk",
    pause: 0,
    depth: Math.floor(rand(state) * 3),
    atWork: false,
    bladder: rand(state) * 0.8, // start at different points so trips are spread out
    bladderRate: 1 + (rand(state) * 2 - 1) * jitter,
    errand: null,
    sick: 0,
    sickReason: null,
    carried: false,
    fall: null,
  };
}

/** Picks a name, preferring ones no living minion has. Deterministic: depends only on the state. */
export function pickName(content: Content, state: GameState): string {
  const names = content.names;
  const used = new Set(Object.values(state.minions).map((m) => m.name));
  const start = (state.nextId * 7919) % names.length;
  for (let i = 0; i < names.length; i++) {
    const n = names[(start + i) % names.length]!;
    if (!used.has(n)) return n;
  }
  return `${names[start]!} ${Math.floor(used.size / names.length) + 1}`;
}

export function newId(state: GameState, prefix: string): string {
  return `${prefix}${state.nextId++}`;
}

export function newGame(content: Content, towerName = "Witch Castle"): GameState {
  const b = content.balance;
  const state: GameState = {
    version: STATE_VERSION,
    time: 0,
    nextId: 1,
    towerName,
    floors: b.start.floors,
    rooms: {},
    minions: {},
    gold: b.start.gold,
    crystals: 0,
    inventory: { ...b.start.items },
    exp: 0,
    hunger: 0,
    rng: 20260926,
    tuning: { timeScale: b.timeScale, costScale: b.costScale },
    log: [],
  };
  for (const s of b.start.rooms) {
    const room = makeRoom(content, newId(state, "r"), s.type, s.floor, s.cell);
    state.rooms[room.id] = room;
    const resident = content.rooms[s.type]?.resident;
    for (let i = 0; resident && i < (s.minions ?? 0); i++) {
      const m = createMinion(content, state, resident, room.id, 0);
      // Starting residents are already home: on their room's floor, inside the room.
      m.floor = room.floor;
      m.x = room.cell + (content.rooms[s.type]!.width * (i + 0.5)) / Math.max(1, s.minions ?? 1);
      state.minions[m.id] = m;
      room.minionIds.push(m.id);
    }
  }
  state.log.push({ id: 0, time: 0, text: `Welcome to ${towerName}. Keep your minions warm and fed, with toilets they can reach.` });
  return state;
}

const LOG_LIMIT = 60;

/** Adds a status message, skipping repeats of the same text within 30 game seconds. Mutates. */
export function addLog(state: GameState, text: string): void {
  for (let i = state.log.length - 1; i >= 0; i--) {
    const e = state.log[i]!;
    if (state.time - e.time >= 30) break;
    if (e.text === text) return;
  }
  const last = state.log[state.log.length - 1];
  state.log.push({ id: (last?.id ?? 0) + 1, time: state.time, text });
  if (state.log.length > LOG_LIMIT) state.log.splice(0, state.log.length - LOG_LIMIT);
}
