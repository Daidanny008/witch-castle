import type { Content } from "../content";
import { STATE_VERSION, type GameState } from "./types";

export class SaveError extends Error {}

type Migration = (old: Record<string, unknown>, content: Content) => Record<string, unknown>;

/** migrations[n] upgrades a version-n state to version n+1. */
const migrations: Record<number, Migration> = {
  // v2: minions get names.
  1: (old, content) => {
    const minions = (old.minions ?? {}) as Record<string, Record<string, unknown>>;
    let i = 0;
    for (const m of Object.values(minions)) {
      if (typeof m.name !== "string") m.name = content.names[i++ % content.names.length]!;
    }
    return old;
  },
  // v3: stairs come in left- and right-facing versions; old stairs face right.
  2: (old) => {
    const rooms = (old.rooms ?? {}) as Record<string, Record<string, unknown>>;
    for (const r of Object.values(rooms)) if (r.type === "stairs") r.type = "stairs_right";
    return old;
  },
  // v4: minions have positions, toilet errands, sickness and physics; toilets count visits.
  3: (old, content) => {
    const rooms = (old.rooms ?? {}) as Record<string, Record<string, unknown>>;
    for (const r of Object.values(rooms)) {
      r.visits = Math.round(Number(r.usage ?? 0) / 10);
      delete r.usage;
      r.occupant = null;
    }
    const minions = (old.minions ?? {}) as Record<string, Record<string, unknown>>;
    let i = 0;
    for (const m of Object.values(minions)) {
      const home = rooms[String(m.roomId)];
      const width = content.rooms[String(home?.type)]?.width ?? 1;
      Object.assign(m, {
        floor: Number(home?.floor ?? 1),
        x: Number(home?.cell ?? 0) + width * (0.25 + 0.5 * ((i * 0.37) % 1)),
        climb: null,
        target: null,
        pace: "walk",
        pause: 0,
        depth: i % 3,
        atWork: false,
        bladder: (i * 0.29) % 0.8,
        bladderRate: 1,
        errand: null,
        sick: 0,
        sickReason: null,
        carried: false,
        fall: null,
      });
      i++;
    }
    old.rng = typeof old.rng === "number" ? old.rng : 20260926;
    return old;
  },
};

/** Upgrades a saved state of any known version to the current one. */
export function migrate(raw: unknown, content: Content): GameState {
  if (!raw || typeof raw !== "object") throw new SaveError("The save file is empty or damaged.");
  let s = raw as Record<string, unknown>;
  let v = typeof s.version === "number" ? s.version : NaN;
  if (!Number.isInteger(v) || v < 1) throw new SaveError("The save file has no valid version.");
  if (v > STATE_VERSION) throw new SaveError(`This save is from a newer version of the game (v${v}).`);
  while (v < STATE_VERSION) {
    const m = migrations[v];
    if (!m) throw new SaveError(`No upgrade path from save version ${v}.`);
    s = m(s, content);
    v++;
    s.version = v;
  }
  for (const key of ["rooms", "minions", "inventory", "tuning", "log"]) {
    if (!s[key] || typeof s[key] !== "object") throw new SaveError(`The save file is missing "${key}".`);
  }
  if (typeof s.rng !== "number") throw new SaveError("The save file is missing its random seed.");
  for (const m of Object.values(s.minions as Record<string, Record<string, unknown>>)) {
    for (const key of ["floor", "x", "bladder", "bladderRate", "sick", "depth"]) {
      if (typeof m[key] !== "number" || !Number.isFinite(m[key])) {
        throw new SaveError(`A minion in the save file has no valid "${key}".`);
      }
    }
  }
  for (const r of Object.values(s.rooms as Record<string, Record<string, unknown>>)) {
    if (typeof r.visits !== "number") throw new SaveError(`A room in the save file has no valid "visits".`);
  }
  return s as unknown as GameState;
}
