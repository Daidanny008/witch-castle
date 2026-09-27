export const STATE_VERSION = 4;

export type RoomId = string;
export type MinionId = string;

export interface Room {
  id: RoomId;
  type: string;
  level: number; // 1..3
  floor: number; // 1-based
  cell: number; // 0-based, leftmost cell the room occupies
  minionIds: MinionId[];
  /** Goods rooms: fractional progress toward the next common/uncommon/rare item. */
  counters: [number, number, number];
  /** Goods waiting to be collected. */
  stored: Record<string, number>;
  /** Gold waiting to be collected (fractional). */
  storedGold: number;
  /** Furnace: minutes of burn left. 0 means the furnace is out. */
  fuel: number;
  /** Toilet: visits since it was last unclogged. */
  visits: number;
  clogged: boolean;
  /** Toilet: who is inside right now. */
  occupant: MinionId | null;
}

export interface Needs {
  warm: boolean;
  fed: boolean;
}

export type Pace = "walk" | "run";

/** A climb follows the flight's diagonal: floor and x change together. */
export interface Climb {
  from: number;
  to: number;
  x0: number;
  x1: number;
  t: number; // 0..1
}

export interface ToiletErrand {
  kind: "toilet";
  toiletId: RoomId;
  stage: "go" | "queue" | "use";
  /** Game time the minion joined the queue (orders the queue). */
  queuedAt: number;
  /** Seconds waited in the queue so far. */
  waited: number;
  /** Seconds left inside the toilet. */
  left: number;
}

/** A thrown or dropped minion in flight. y is height in floors above the ground (standing on floor f is y = f - 1). */
export interface Fall {
  y: number;
  vx: number; // floor spaces per second
  vy: number; // floors per second, up is positive
}

export interface Minion {
  id: MinionId;
  type: string;
  /** Display name, shown walking around the tower. */
  name: string;
  roomId: RoomId;
  /** 0..100. Moves toward a target set by how many needs are met. */
  mood: number;
  /** Seconds until the minion arrives at the front door. 0 = arrived. */
  arrivesIn: number;
  needs: Needs;

  // ----- Where it is and what it's doing -----
  /** Floor it is standing on. The ground outside the front door counts as floor 1. */
  floor: number;
  /** Position along the floor in spaces: 0 is the left wall, floorWidth the right wall, beyond that is outside. */
  x: number;
  climb: Climb | null;
  target: { floor: number; x: number } | null;
  pace: Pace;
  /** Seconds to stand still before wandering again. */
  pause: number;
  /** Drawing order when minions pass each other (they never block). */
  depth: number;
  /** True while standing at its workstation and producing. */
  atWork: boolean;
  /** 0..1; at 1 the minion needs the toilet. */
  bladder: number;
  /** Personal multiplier on the toilet interval (jitter). */
  bladderRate: number;
  errand: ToiletErrand | null;
  /** Seconds of sickness or injury left. 0 = healthy. */
  sick: number;
  sickReason: "sick" | "hurt" | null;
  /** Held by the player's finger. */
  carried: boolean;
  fall: Fall | null;
}

export interface LogEntry {
  id: number;
  time: number;
  text: string;
}

export interface Tuning {
  /** Game seconds per real second. Above 1 makes every timer faster. */
  timeScale: number;
  /** Multiplies every cost. */
  costScale: number;
}

export interface GameState {
  version: number;
  /** Game seconds simulated so far. Only advances while the game is open. */
  time: number;
  nextId: number;
  towerName: string;
  floors: number;
  rooms: Record<RoomId, Room>;
  minions: Record<MinionId, Minion>;
  gold: number;
  /** Developer-cheat currency. Never earned in normal play. */
  crystals: number;
  inventory: Record<string, number>;
  exp: number;
  /** Food owed by the tower that couldn't be paid yet. */
  hunger: number;
  /** Seeded random state, so a replay always gives the same result. */
  rng: number;
  tuning: Tuning;
  log: LogEntry[];
}

export type Command =
  | { type: "buildFloor" }
  | { type: "buildRoom"; roomType: string; floor: number; cell: number }
  | { type: "upgradeRoom"; roomId: RoomId }
  | { type: "demolishRoom"; roomId: RoomId }
  | { type: "recruit"; roomId: RoomId }
  | { type: "collect"; roomId: RoomId }
  | { type: "collectAll" }
  | { type: "relightFurnace"; roomId: RoomId }
  | { type: "unclogToilet"; roomId: RoomId }
  | { type: "hurryArrival"; minionId: MinionId }
  | { type: "setTowerName"; name: string }
  | { type: "pickUp"; minionId: MinionId }
  /** Let go of a carried minion at (x, y) with a throw velocity. y is floors above the ground. */
  | { type: "drop"; minionId: MinionId; x: number; y: number; vx: number; vy: number }
  // Developer cheats
  | { type: "cheatAddGold"; amount: number }
  | { type: "cheatAddItems"; items: Record<string, number> }
  | { type: "cheatAddCrystals"; amount: number }
  | { type: "cheatTimeSkip"; minutes: number }
  | { type: "cheatFinishTimers" }
  | { type: "cheatSetFloors"; floors: number }
  | { type: "cheatSetMood"; mood: number }
  | { type: "cheatSetTuning"; tuning: Partial<Tuning> };

export type ApplyResult = { ok: true; state: GameState } | { ok: false; state: GameState; error: string };
