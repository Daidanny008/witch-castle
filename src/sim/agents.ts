/**
 * Where minions are and what they're doing, simulated in the engine so it can affect the game:
 * a crafter only produces while standing at its station, toilet trips take real time, and
 * thrown minions can get hurt or die. The renderer just draws these positions.
 */
import type { Content } from "../content";
import { floorComponents, isStairs, isWarm, stairEnds } from "./derive";
import { rand } from "./rng";
import { addLog } from "./state";
import type { GameState, Minion, Room } from "./types";

/** How close counts as "arrived" at a spot, in floor spaces. */
const EPS = 0.02;
/** Physics sub-step, in seconds. */
const FALL_STEP = 0.02;
/** Spacing between minions waiting in a toilet queue, in floor spaces. */
const QUEUE_GAP = 0.22;

interface Stair {
  floor: number; // leads up to floor + 1
  bottomX: number;
  topX: number;
}

interface World {
  width: number;
  floors: number;
  outsideRight: number; // furthest x of the ground outside
  stairs: Stair[];
  /**
   * Component per floor; floor 1 also covers the ground outside. Index floors + 1 is the roof,
   * reachable only by stairs built on the top floor.
   */
  comp: number[];
  /** warm[f] for floors 1..floors + 1 (the roof). */
  warm: boolean[];
}

function world(content: Content, s: GameState): World {
  const stairs: Stair[] = Object.values(s.rooms)
    .filter((r) => isStairs(content, r))
    .map((r) => ({ floor: r.floor, ...stairEnds(content, r) }));
  const comp = floorComponents(content, s);
  comp[s.floors + 1] = stairs.some((st) => st.floor === s.floors) ? comp[s.floors]! : -1;
  const warm: boolean[] = [false];
  for (let f = 1; f <= s.floors + 1; f++) warm.push(isWarm(content, s, f));
  return {
    warm,
    width: content.balance.floorWidth,
    floors: s.floors,
    outsideRight: content.balance.floorWidth + content.balance.movement.outsideWidth,
    stairs,
    comp,
  };
}

/** True when the minion is standing on (or climbing onto) the roof. */
export function onRoof(s: GameState, m: Minion): boolean {
  return m.floor > s.floors;
}

/** Where new arrivals appear: the far end of the ground outside the front door. */
export function arrivalSpot(content: Content): { floor: number; x: number } {
  return { floor: 1, x: content.balance.floorWidth + content.balance.movement.outsideWidth - 0.3 };
}

/** Where a crafter stands to work: spread evenly across its room. Null for rooms without workbenches. */
export function stationSpot(content: Content, s: GameState, m: Minion): { floor: number; x: number } | null {
  const room = s.rooms[m.roomId];
  const def = room && content.rooms[room.type];
  if (!room || def?.production?.kind !== "goods") return null;
  const i = Math.max(0, room.minionIds.indexOf(m.id));
  const n = Math.max(1, room.minionIds.length);
  return { floor: room.floor, x: room.cell + ((i + 0.5) / n) * def.width };
}

function roomProducing(content: Content, s: GameState, room: Room): boolean {
  const def = content.rooms[room.type];
  const prod = def?.production;
  if (!prod) return false;
  const workers = room.minionIds.filter((id) => (s.minions[id]?.arrivesIn ?? 1) <= 0).length;
  const cap = prod.kind === "gold" ? prod.goldPerMinute * prod.storageMinutes * workers : prod.storagePerMinion * workers;
  const held = prod.kind === "gold" ? room.storedGold : Object.values(room.stored).reduce((a, n) => a + n, 0);
  return held < cap - 1e-9;
}

/** Updates every arrived minion by dt game seconds. Mutates. */
export function updateMinions(content: Content, s: GameState, dt: number): void {
  const w = world(content, s);
  for (const m of Object.values(s.minions)) {
    if (m.arrivesIn > 0 || m.carried) {
      m.atWork = false;
      continue;
    }
    if (m.fall) {
      fall(content, s, m, dt, w);
      continue;
    }
    if (m.sick > 0) {
      m.sick = Math.max(0, m.sick - dt);
      if (m.sick === 0) {
        addLog(s, `${m.name} feels better.`);
        m.sickReason = null;
      }
    }
    toiletNeeds(content, s, m, dt, w);
    decideTarget(content, s, m, w);
    move(content, s, m, dt, w);
    const station = stationSpot(content, s, m);
    m.atWork =
      !m.errand &&
      m.sick === 0 &&
      station !== null &&
      !m.climb &&
      m.floor === station.floor &&
      Math.abs(m.x - station.x) <= EPS &&
      roomProducing(content, s, s.rooms[m.roomId]!);
  }
}

// ---------------------------------------------------------------------------------------------
// Toilet trips

function toiletNeeds(content: Content, s: GameState, m: Minion, dt: number, w: World): void {
  const t = content.balance.toilet;
  if (!m.errand) {
    m.bladder += dt / (t.intervalMinutes * 60 * m.bladderRate);
    if (m.bladder >= 1) startToiletTrip(content, s, m, w);
    return;
  }
  const e = m.errand;
  const toilet = s.rooms[e.toiletId];
  if (!toilet) {
    m.errand = null; // demolished: pick another next tick
    return;
  }
  if (e.stage === "queue") {
    const first = queueOf(s, toilet.id)[0];
    if (!toilet.clogged && toilet.occupant === null && first === m.id) {
      toilet.occupant = m.id;
      e.stage = "use";
      e.left = t.useSeconds;
      m.x = toilet.cell + 0.5;
      return;
    }
    e.waited += dt;
    if (e.waited >= t.queueSickSeconds) {
      m.errand = null;
      m.bladder = 0;
      m.pace = "walk";
      makeSick(content, s, m, "sick");
      addLog(s, `${m.name} waited too long for the toilet on floor ${toilet.floor} and got sick.`);
    }
    return;
  }
  if (e.stage === "use") {
    e.left -= dt;
    if (e.left <= 0) {
      toilet.occupant = null;
      toilet.visits += 1;
      if (toilet.visits >= t.visitsBeforeClog && !toilet.clogged) {
        toilet.clogged = true;
        addLog(s, `The toilet on floor ${toilet.floor} is clogged.`);
      }
      m.errand = null;
      m.bladder = 0;
      m.pace = "walk";
      m.target = null;
    }
  }
}

function startToiletTrip(content: Content, s: GameState, m: Minion, w: World): void {
  const here = w.comp[m.floor];
  const toilets = Object.values(s.rooms).filter((r) => r.type === "toilet" && w.comp[r.floor] === here);
  if (toilets.length === 0) {
    m.bladder = 0;
    m.mood = Math.max(0, m.mood - content.balance.toilet.accidentMoodPenalty);
    addLog(s, `${m.name} couldn't reach a toilet and had an accident.`);
    return;
  }
  // Prefer working toilets; if every one is clogged, wait at the nearest and hope someone fixes it.
  const working = toilets.filter((r) => !r.clogged);
  const pool = working.length ? working : toilets;
  const cost = (r: Room) => Math.abs(r.floor - m.floor) * 4 + Math.abs(r.cell + 0.5 - m.x);
  const toilet = pool.reduce((a, b) => (cost(b) < cost(a) ? b : a));
  m.errand = { kind: "toilet", toiletId: toilet.id, stage: "go", queuedAt: 0, waited: 0, left: 0 };
  m.pace = "run";
  m.target = null;
}

function queueOf(s: GameState, toiletId: string): string[] {
  return Object.values(s.minions)
    .filter((q) => q.errand?.toiletId === toiletId && q.errand.stage === "queue")
    .sort((a, b) => a.errand!.queuedAt - b.errand!.queuedAt || a.id.localeCompare(b.id))
    .map((q) => q.id);
}

// ---------------------------------------------------------------------------------------------
// Choosing where to go

function decideTarget(content: Content, s: GameState, m: Minion, w: World): void {
  const e = m.errand;
  if (e) {
    const toilet = s.rooms[e.toiletId]!;
    if (e.stage === "go") m.target = { floor: toilet.floor, x: toilet.cell + 0.5 };
    if (e.stage === "queue") {
      const i = queueOf(s, toilet.id).indexOf(m.id);
      m.target = { floor: toilet.floor, x: Math.max(0.1, toilet.cell + 0.5 - QUEUE_GAP * (i + 1)) };
    }
    if (e.stage === "use") m.target = null;
    return;
  }
  if (m.sick > 0) {
    // Sick and hurt minions rest where they are.
    m.target = null;
    m.pace = "walk";
    return;
  }
  const station = stationSpot(content, s, m);
  const room = s.rooms[m.roomId];
  if (station && room && roomProducing(content, s, room) && w.comp[station.floor] === w.comp[m.floor]) {
    m.target = station;
    m.pace = "walk";
    return;
  }
  // Idle: if we were heading to the station, forget it and wander instead.
  if (station && m.target && m.target.floor === station.floor && Math.abs(m.target.x - station.x) < EPS) m.target = null;

  // Idle on a cold floor: run for the nearest warm floor we can reach.
  if (!w.warm[m.floor]) {
    if (m.target && w.warm[m.target.floor] && m.pace === "run") return; // already on the way
    const refuge = nearestWarmFloor(m, w);
    if (refuge !== null) {
      m.target = { floor: refuge, x: 0.3 + rand(s) * (w.width - 0.6) };
      m.pace = "run";
      m.pause = 0;
      return;
    }
  }
  if (!m.target && m.pause <= 0) {
    m.target = wanderTarget(s, m, w);
    m.pace = "walk";
  }
}

/** The closest reachable indoor floor with a lit furnace in reach, or null if none. */
function nearestWarmFloor(m: Minion, w: World): number | null {
  let best: number | null = null;
  for (let f = 1; f <= w.floors; f++) {
    if (!w.warm[f] || w.comp[f] !== w.comp[m.floor]) continue;
    if (best === null || Math.abs(f - m.floor) < Math.abs(best - m.floor)) best = f;
  }
  return best;
}

function wanderTarget(s: GameState, m: Minion, w: World) {
  // Wanderers stay indoors (never the roof), and on warm floors whenever any can be reached.
  let reachable: number[] = [];
  for (let f = 1; f <= w.floors; f++) if (w.comp[f] === w.comp[m.floor]) reachable.push(f);
  const warmOnes = reachable.filter((f) => w.warm[f]);
  if (warmOnes.length) reachable = warmOnes;
  const x = 0.3 + rand(s) * (w.width - 0.6);
  if (m.floor > w.floors) {
    // On the roof: head back inside if there's a way down, otherwise potter about up here.
    return reachable.length ? { floor: w.floors, x } : { floor: m.floor, x };
  }
  const stay = reachable.includes(m.floor) && (rand(s) < 0.6 || reachable.length <= 1);
  const floor = stay || reachable.length === 0 ? m.floor : reachable[Math.floor(rand(s) * reachable.length)]!;
  return { floor, x };
}

// ---------------------------------------------------------------------------------------------
// Walking and climbing

function move(content: Content, s: GameState, m: Minion, dt: number, w: World): void {
  const mv = content.balance.movement;
  if (m.climb) {
    m.climb.t += dt / (m.pace === "run" ? mv.climbRunSeconds : mv.climbWalkSeconds);
    if (m.climb.t >= 1) {
      m.floor = m.climb.to;
      m.x = m.climb.x1;
      m.climb = null;
    }
    return;
  }
  if (!m.target) {
    if (m.pause > 0) m.pause -= dt;
    return;
  }
  const target = m.target;
  if (w.comp[target.floor] !== w.comp[m.floor]) {
    m.target = null; // unreachable
    m.pause = 1;
    return;
  }
  const speed = m.pace === "run" ? mv.runSpeed : mv.walkSpeed;
  if (target.floor === m.floor) {
    if (walkToward(m, target.x, speed * dt)) arrive(s, m);
    return;
  }
  // Only the ground floor has a door; from outside, go in first.
  const up = target.floor > m.floor;
  const flight = up ? m.floor : m.floor - 1;
  const options = w.stairs.filter((st) => st.floor === flight);
  if (options.length === 0) {
    m.target = null;
    m.pause = 1;
    return;
  }
  const entry = (st: Stair) => (up ? st.bottomX : st.topX);
  const st = options.reduce((a, b) => (Math.abs(entry(b) - m.x) < Math.abs(entry(a) - m.x) ? b : a));
  if (walkToward(m, entry(st), speed * dt)) {
    m.climb = up
      ? { from: m.floor, to: m.floor + 1, x0: st.bottomX, x1: st.topX, t: 0 }
      : { from: m.floor, to: m.floor - 1, x0: st.topX, x1: st.bottomX, t: 0 };
  }
}

/** Moves toward x by at most `step`; snaps and returns true once there. */
function walkToward(m: Minion, x: number, step: number): boolean {
  const d = x - m.x;
  if (Math.abs(d) > EPS) m.x += Math.sign(d) * Math.min(Math.abs(d), step);
  if (Math.abs(x - m.x) > EPS) return false;
  m.x = x;
  return true;
}

function arrive(s: GameState, m: Minion): void {
  const e = m.errand;
  if (e?.stage === "go") {
    e.stage = "queue";
    e.queuedAt = s.time;
    e.waited = 0;
    return;
  }
  if (e) return; // queue: keep the spot
  // Reached a wander spot, a warm refuge, or the station (whose next target is the same spot): rest a while.
  m.target = null;
  m.pace = "walk";
  m.pause = 1 + rand(s) * 4;
}

// ---------------------------------------------------------------------------------------------
// Physics

function fall(content: Content, s: GameState, m: Minion, dt: number, w: World): void {
  const p = content.balance.physics;
  const g = p.gravity / p.metersPerFloor; // floors per second squared
  const f = m.fall!;
  let left = dt;
  while (left > 1e-9 && m.fall) {
    const h = Math.min(FALL_STEP, left);
    left -= h;
    const inside = m.x <= w.width;
    // Surface below: floorboards inside, the roof above the top floor, the ground outside.
    const level = inside ? Math.min(w.floors, Math.floor(f.y + 1e-9)) : 0;
    const aboveRoof = level >= w.floors;
    f.vy -= g * h;
    f.y += f.vy * h;
    m.x += f.vx * h;

    if (inside) {
      // Ceiling: the floorboards of the storey above. Over the roof there is only sky.
      const ceiling = level + 1 - 0.05;
      if (!aboveRoof && f.y > ceiling) {
        f.y = ceiling;
        f.vy = -Math.abs(f.vy) * p.wallBounce;
      }
      // Left wall; on the roof, the parapet.
      if (m.x < 0.05) {
        m.x = 0.05;
        f.vx = Math.abs(f.vx) * p.wallBounce;
      }
      // The right wall has a door on the ground floor; the roof's right edge is an open drop.
      if (m.x > w.width - 0.05 && !aboveRoof && !(level === 0 && f.y < 0.8)) {
        m.x = w.width - 0.05;
        f.vx = -Math.abs(f.vx) * p.wallBounce;
      }
    } else {
      // Outside, the tower's wall blocks between the door and the roof line.
      if (m.x < w.width + 0.05 && f.y >= 0.8 && f.y < w.floors) {
        m.x = w.width + 0.05;
        f.vx = Math.abs(f.vx) * p.wallBounce;
      }
      if (m.x > w.outsideRight) {
        m.x = w.outsideRight;
        f.vx = -Math.abs(f.vx) * p.wallBounce;
      }
    }

    if (f.y <= level) land(content, s, m, level, -f.vy * p.metersPerFloor);
  }
}

function land(content: Content, s: GameState, m: Minion, level: number, impact: number): void {
  const p = content.balance.physics;
  m.fall = null;
  m.floor = level + 1;
  m.target = null;
  m.pause = 1;
  m.pace = "walk";
  if (impact >= p.lethalImpactSpeed) {
    addLog(s, `${m.name} fell to their fate.`);
    removeMinion(s, m.id);
    return;
  }
  if (impact >= p.hurtImpactSpeed) {
    makeSick(content, s, m, "hurt");
    addLog(s, `${m.name} landed hard and got hurt.`);
  }
}

export function makeSick(content: Content, s: GameState, m: Minion, reason: "sick" | "hurt"): void {
  const mins = reason === "hurt" ? content.balance.sickness.hurtMinutes : content.balance.sickness.sickMinutes;
  m.sick = Math.max(m.sick, mins * 60);
  m.sickReason = reason;
}

/** Removes a minion from the tower entirely (death). Mutates. */
export function removeMinion(s: GameState, id: string): void {
  const m = s.minions[id];
  if (!m) return;
  const room = s.rooms[m.roomId];
  if (room) room.minionIds = room.minionIds.filter((x) => x !== id);
  for (const r of Object.values(s.rooms)) if (r.occupant === id) r.occupant = null;
  delete s.minions[id];
}

/** Lets go of a carried minion. Mutates. */
export function throwMinion(content: Content, s: GameState, m: Minion, x: number, y: number, vx: number, vy: number): void {
  const w = world(content, s);
  const max = content.balance.physics.maxThrowFloorsPerSecond;
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  m.carried = false;
  m.x = clamp(x, 0.05, w.outsideRight);
  m.fall = {
    y: clamp(y, 0, s.floors + 1.5), // up to a storey and a half above the roof
    vx: clamp(vx, -max * 1.5, max * 1.5),
    vy: clamp(vy, -max, max),
  };
  // Released inside a wall: nudge into the nearest open side.
  if (m.x > w.width - 0.05 && m.x < w.width + 0.05) m.x = m.fall.y < 0.8 ? m.x : w.width - 0.05;
}
