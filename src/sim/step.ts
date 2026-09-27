import type { Content } from "../content";
import { updateMinions } from "./agents";
import { arrivedResidents, floorStatuses, isArrived, isWarm, minionFloor, moodBand, storageCap } from "./derive";
import { addLog } from "./state";
import type { GameState } from "./types";

/**
 * Runs the game forward by `seconds` of game time in fixed ticks.
 * Mutates `state`. Callers that need immutability should clone first (see `advance`).
 */
export function stepInPlace(content: Content, state: GameState, seconds: number): void {
  const dt = content.balance.tickSeconds;
  let remaining = seconds;
  while (remaining > 1e-9) {
    const h = Math.min(dt, remaining);
    tick(content, state, h);
    remaining -= h;
  }
}

export function advance(content: Content, state: GameState, seconds: number): GameState {
  const next = structuredClone(state);
  stepInPlace(content, next, seconds);
  return next;
}

function tick(content: Content, s: GameState, dt: number): void {
  const b = content.balance;
  const minutes = dt / 60;
  s.time += dt;

  // 1. Arrivals: new recruits appear outside the front door and walk in.
  for (const m of Object.values(s.minions)) {
    if (m.arrivesIn > 0) {
      m.arrivesIn = Math.max(0, m.arrivesIn - dt);
      if (m.arrivesIn === 0) addLog(s, `${m.name} the ${content.minions[m.type]?.name ?? m.type} has arrived at the door.`);
    }
  }

  // 2. Furnaces burn fuel
  for (const r of Object.values(s.rooms)) {
    if (r.type !== "furnace" || r.fuel <= 0) continue;
    r.fuel = Math.max(0, r.fuel - minutes);
    if (r.fuel === 0) addLog(s, `The furnace on floor ${r.floor} went out.`);
  }

  // 4. Food: every arrived minion eats; bread first, then any other food in stock.
  const arrived = Object.values(s.minions).filter(isArrived);
  s.hunger += arrived.length * b.upkeep.foodPerMinionPerMinute * minutes;
  for (const food of b.upkeep.foodItems) {
    const owed = Math.floor(s.hunger);
    if (owed <= 0) break;
    const have = s.inventory[food] ?? 0;
    const eaten = Math.min(have, owed);
    s.inventory[food] = have - eaten;
    s.hunger -= eaten;
  }
  // Unpaid hunger is capped so a shortage doesn't build an endless debt.
  s.hunger = Math.min(s.hunger, Math.max(2, arrived.length * 0.5));
  const fed = s.hunger < 1;
  if (!fed) addLog(s, "Your minions are starving. Collect food from the Hunter's Lodge, or recruit a Hunter.");

  // 5. Needs and mood
  const roofWarm = isWarm(content, s, s.floors + 1);
  const statuses = floorStatuses(content, s);
  const targets = b.mood.targetByFailedNeeds;
  const step = b.mood.changePerMinute * minutes;
  let reportedToilet = false;
  for (const m of arrived) {
    const st = statuses[minionFloor(s, m) - 1];
    // The roof is a floor like any other: warm if a furnace is within reach.
    // Toilets affect minions through trips instead (queues, sickness, accidents), not as a need here.
    const roof = m.floor > s.floors;
    m.needs = { warm: roof ? roofWarm : (st?.warm ?? false), fed };
    if (st && st.toilets === 0 && !reportedToilet) {
      addLog(s, `Minions on floor ${st.floor} can't get to a toilet.`);
      reportedToilet = true;
    }
    const failed = Number(!m.needs.warm) + Number(!m.needs.fed) + Number(m.sick > 0);
    const target = targets[Math.min(failed, targets.length - 1)]!;
    m.mood = m.mood < target ? Math.min(target, m.mood + step) : Math.max(target, m.mood - step);
  }

  // 6. Minions move, run errands, fall (see agents.ts)
  updateMinions(content, s, dt);

  // 7. Production. Crafters only count while standing at their station; residents of dwellings pay rent anyway.
  const perMinute = b.production.itemsPerMinutePerMinion;
  for (const r of Object.values(s.rooms)) {
    const prod = content.rooms[r.type]?.production;
    if (!prod) continue;
    const residents = arrivedResidents(s, r);
    if (residents.length === 0) continue;
    const workers = prod.kind === "goods" ? residents.filter((m) => m.atWork) : residents.filter((m) => m.sick === 0);
    const output = workers.reduce((sum, m) => sum + moodBand(content, m.mood).output, 0);

    if (prod.kind === "gold") {
      const cap = storageCap(content, r, residents.length);
      r.storedGold = Math.min(cap, r.storedGold + prod.goldPerMinute * output * minutes);
      continue;
    }

    const ratio = b.production.tierRatios[r.level - 1] ?? b.production.tierRatios[0]!;
    const total = ratio[0] + ratio[1] + ratio[2];
    const cap = storageCap(content, r, residents.length);
    let stored = Object.values(r.stored).reduce((a, n) => a + n, 0);
    for (let i = 0; i < 3; i++) {
      r.counters[i] = r.counters[i]! + perMinute * output * (ratio[i]! / total) * minutes;
      while (r.counters[i]! >= 1) {
        if (stored >= cap) {
          r.counters[i] = 1; // storage full: hold progress until collected
          break;
        }
        const item = prod.tiers[i]!;
        r.stored[item] = (r.stored[item] ?? 0) + 1;
        r.counters[i] = r.counters[i]! - 1;
        stored++;
      }
    }
  }
}
