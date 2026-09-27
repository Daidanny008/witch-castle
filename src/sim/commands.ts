import type { Content, Cost } from "../content";
import { fits } from "./derive";
import {
  floorCost,
  missing,
  pay,
  recruitCost,
  refund,
  roomLevelCost,
  slots,
} from "./economy";
import { throwMinion } from "./agents";
import { addLog, createMinion, makeRoom, newId } from "./state";
import { stepInPlace } from "./step";
import type { ApplyResult, Command, GameState } from "./types";

class CommandError extends Error {}
const fail = (msg: string): never => {
  throw new CommandError(msg);
};

function payOrFail(s: GameState, cost: Cost, what: string): void {
  const short = missing(s, cost);
  if (short.length) fail(`Not enough for ${what}: need ${short.join(", ")} more.`);
  pay(s, cost);
}

/** Applies one player or cheat command. Never mutates the input state. */
export function apply(content: Content, state: GameState, cmd: Command): ApplyResult {
  const s = structuredClone(state);
  try {
    run(content, s, cmd);
    return { ok: true, state: s };
  } catch (e) {
    if (e instanceof CommandError) return { ok: false, state, error: e.message };
    throw e;
  }
}

function room(s: GameState, id: string) {
  return s.rooms[id] ?? fail("That room no longer exists.");
}

function run(content: Content, s: GameState, cmd: Command): void {
  const b = content.balance;
  const scale = s.tuning.costScale;

  switch (cmd.type) {
    case "buildFloor": {
      const n = s.floors + 1;
      payOrFail(s, floorCost(content, n, scale), `floor ${n}`);
      s.floors = n;
      s.exp += b.exp.perFloor;
      addLog(s, `Floor ${n} built.`);
      for (const def of Object.values(content.rooms)) {
        if (def.unlockFloor === n) addLog(s, `New room unlocked: ${def.name}.`);
      }
      return;
    }

    case "buildRoom": {
      const def = content.rooms[cmd.roomType] ?? fail(`Unknown room "${cmd.roomType}".`);
      if (def.unlockFloor > s.floors) fail(`${def.name} unlocks at floor ${def.unlockFloor}.`);
      if (!fits(content, s, cmd.roomType, cmd.floor, cmd.cell)) fail(`${def.name} doesn't fit there.`);
      payOrFail(s, roomLevelCost(content, cmd.roomType, 1, scale)!, def.name);
      const r = makeRoom(content, newId(s, "r"), cmd.roomType, cmd.floor, cmd.cell);
      s.rooms[r.id] = r;
      addLog(s, `${def.name} built on floor ${cmd.floor}.`);
      return;
    }

    case "upgradeRoom": {
      const r = room(s, cmd.roomId);
      const def = content.rooms[r.type]!;
      if (r.level >= def.levels.length) fail(`${def.name} is already at its highest level.`);
      payOrFail(s, roomLevelCost(content, r.type, r.level + 1, scale)!, `${def.name} level ${r.level + 1}`);
      r.level++;
      addLog(s, `${def.name} upgraded to level ${r.level}.`);
      return;
    }

    case "demolishRoom": {
      const r = room(s, cmd.roomId);
      const def = content.rooms[r.type]!;
      for (let lvl = 1; lvl <= r.level; lvl++) refund(s, roomLevelCost(content, r.type, lvl, scale)!, b.demolishRefund);
      for (const [id, n] of Object.entries(r.stored)) s.inventory[id] = (s.inventory[id] ?? 0) + n;
      s.gold += Math.floor(r.storedGold);
      for (const id of r.minionIds) delete s.minions[id];
      delete s.rooms[r.id];
      addLog(s, `${def.name} demolished. Refunded about ${Math.round(b.demolishRefund * 100)}% of its cost.`);
      return;
    }

    case "recruit": {
      const r = room(s, cmd.roomId);
      const def = content.rooms[r.type]!;
      const type = def.resident ?? fail(`${def.name} has no residents.`);
      if (r.minionIds.length >= slots(content, r)) fail(`${def.name} is full. Upgrade it for more room.`);
      payOrFail(s, recruitCost(content, type, scale)!, `a ${content.minions[type]!.name}`);
      const m = createMinion(content, s, type, r.id, content.minions[type]!.arrivalSeconds);
      s.minions[m.id] = m;
      r.minionIds.push(m.id);
      s.exp += b.exp.perRecruit;
      return;
    }

    case "collect":
      if (!collect(s, room(s, cmd.roomId).id)) fail("Nothing to collect yet.");
      s.exp += b.exp.perCollect;
      return;

    case "collectAll": {
      let any = false;
      for (const id of Object.keys(s.rooms)) any = collect(s, id) || any;
      if (!any) fail("Nothing to collect yet.");
      s.exp += b.exp.perCollect;
      return;
    }

    case "relightFurnace": {
      const r = room(s, cmd.roomId);
      if (r.type !== "furnace") fail("That isn't a furnace.");
      if (r.fuel > 0) fail("That furnace is still burning.");
      payOrFail(s, b.upkeep.furnaceRelightCost, "relighting the furnace");
      r.fuel = b.upkeep.furnaceBurnMinutes;
      addLog(s, `Furnace on floor ${r.floor} relit.`);
      return;
    }

    case "unclogToilet": {
      const r = room(s, cmd.roomId);
      if (r.type !== "toilet") fail("That isn't a toilet.");
      if (!r.clogged) fail("That toilet isn't clogged.");
      r.clogged = false;
      r.visits = 0;
      addLog(s, `Toilet on floor ${r.floor} unclogged.`);
      return;
    }

    case "hurryArrival": {
      const m = s.minions[cmd.minionId] ?? fail("That minion no longer exists.");
      if (m.arrivesIn <= 0) fail("That minion has already arrived.");
      const cost = b.cheats.crystalFinishCost;
      if (s.crystals < cost) fail(`Need ${cost} crystal${cost === 1 ? "" : "s"}.`);
      s.crystals -= cost;
      m.arrivesIn = 0;
      addLog(s, `${m.name} the ${content.minions[m.type]?.name ?? m.type} has arrived.`);
      return;
    }

    case "pickUp": {
      const m = s.minions[cmd.minionId] ?? fail("That minion is gone.");
      if (m.arrivesIn > 0) fail(`${m.name} hasn't arrived yet.`);
      m.carried = true;
      m.fall = null;
      m.climb = null;
      m.target = null;
      m.atWork = false;
      // Pulled out of a toilet queue (or the toilet itself): they'll need to go again.
      if (m.errand) {
        const t = s.rooms[m.errand.toiletId];
        if (t && t.occupant === m.id) t.occupant = null;
        m.errand = null;
      }
      return;
    }

    case "drop": {
      const m = s.minions[cmd.minionId] ?? fail("That minion is gone.");
      if (!m.carried) fail(`${m.name} isn't being carried.`);
      throwMinion(content, s, m, cmd.x, cmd.y, cmd.vx, cmd.vy);
      return;
    }

    case "setTowerName": {
      const name = cmd.name.trim().slice(0, 30);
      if (!name) fail("The tower needs a name.");
      s.towerName = name;
      return;
    }

    // ----- Developer cheats -----
    case "cheatAddGold":
      s.gold = Math.max(0, s.gold + cmd.amount);
      return;
    case "cheatAddItems":
      for (const [id, n] of Object.entries(cmd.items)) {
        if (!content.items[id]) fail(`Unknown item "${id}".`);
        s.inventory[id] = Math.max(0, (s.inventory[id] ?? 0) + n);
      }
      return;
    case "cheatAddCrystals":
      s.crystals = Math.max(0, s.crystals + cmd.amount);
      return;
    case "cheatTimeSkip":
      if (!(cmd.minutes > 0)) fail("Skip a positive number of minutes.");
      stepInPlace(content, s, cmd.minutes * 60);
      addLog(s, `Skipped ${cmd.minutes} minutes.`);
      return;
    case "cheatFinishTimers":
      for (const m of Object.values(s.minions)) m.arrivesIn = 0;
      return;
    case "cheatSetFloors":
      if (!Number.isInteger(cmd.floors) || cmd.floors < 1) fail("Floors must be a whole number of at least 1.");
      for (const r of Object.values(s.rooms)) if (r.floor > cmd.floors) fail("Demolish rooms above that floor first.");
      s.floors = cmd.floors;
      for (const m of Object.values(s.minions)) {
        if (m.floor > cmd.floors || (m.climb && m.climb.to > cmd.floors)) {
          m.floor = cmd.floors;
          m.climb = null;
          m.target = null;
          m.fall = null;
        }
      }
      return;
    case "cheatSetMood":
      for (const m of Object.values(s.minions)) m.mood = Math.max(0, Math.min(100, cmd.mood));
      return;
    case "cheatSetTuning": {
      const t = { ...s.tuning, ...cmd.tuning };
      if (!(t.timeScale > 0) || !(t.costScale > 0)) fail("Tuning values must be above 0.");
      s.tuning = t;
      return;
    }
  }
}

/** Moves a room's stored goods and gold into the tower's stock. Returns whether anything moved. */
function collect(s: GameState, roomId: string): boolean {
  const r = s.rooms[roomId];
  if (!r) return false;
  let any = false;
  for (const [id, n] of Object.entries(r.stored)) {
    if (n <= 0) continue;
    s.inventory[id] = (s.inventory[id] ?? 0) + n;
    any = true;
  }
  r.stored = {};
  const gold = Math.floor(r.storedGold);
  if (gold > 0) {
    s.gold += gold;
    r.storedGold -= gold;
    any = true;
  }
  return any;
}
