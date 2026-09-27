import { content, loadContent } from "../src/content";
import items from "../content/items.json";
import names from "../content/names.json";
import minions from "../content/minions.json";
import rooms from "../content/rooms.json";
import balance from "../content/balance.json";
import {
  advance,
  apply,
  costValue,
  floorCost,
  floorStatuses,
  migrate,
  newGame,
  STATE_VERSION,
  type Command,
  type GameState,
} from "../src/sim";

/** Content variant with a balance override, for tests that shouldn't be disturbed by other systems. */
function tweak(fn: (b: any) => void) {
  const raw = structuredClone({ names, items, minions, rooms, balance }) as any;
  fn(raw.balance);
  return loadContent(raw);
}
/** No toilet trips, so production tests measure production only. */
const noToilets = tweak((b) => (b.toilet.intervalMinutes = 1e9));

function must(state: GameState, cmd: Command, c = content): GameState {
  const r = apply(c, state, cmd);
  if (!r.ok) throw new Error(r.error);
  return r.state;
}

const roomOf = (s: GameState, type: string) => Object.values(s.rooms).find((r) => r.type === type)!;
const rich = (s: GameState) =>
  must(must(s, { type: "cheatAddGold", amount: 100000 }), {
    type: "cheatAddItems",
    items: { bread: 1000, meat: 100, fruit: 100, log: 1000, plank: 100, panel: 100 },
  });

describe("content", () => {
  it("loads and validates", () => {
    expect(Object.keys(content.rooms)).toContain("hunters_lodge");
  });

  it("rejects references to unknown items", () => {
    const bad = structuredClone({ names, items, minions, rooms, balance }) as any;
    bad.rooms.shack.levels[0].cost.items = { unobtainium: 1 };
    expect(() => loadContent(bad)).toThrow(/unknown item "unobtainium"/);
  });

  it("keeps rare goods at or under 10% of every cost (recipe rule 3)", () => {
    for (const [id, def] of Object.entries(content.rooms)) {
      def.levels.forEach((lvl, i) => {
        const total = costValue(content, lvl.cost);
        let rare = 0;
        for (const [item, n] of Object.entries(lvl.cost.items)) {
          if (content.items[item]?.tier === "rare") rare += content.balance.itemValue.rare * n;
        }
        expect(rare / total, `${id} L${i + 1}`).toBeLessThanOrEqual(0.1 + 1e-9);
      });
    }
  });

  it("uses no rare goods in any build (level 1) cost before floor 9 (recipe rule 3)", () => {
    for (const [id, def] of Object.entries(content.rooms)) {
      if (def.unlockFloor >= 9) continue;
      for (const item of Object.keys(def.levels[0]!.cost.items)) {
        expect(content.items[item]?.tier, `${id} build uses ${item}`).not.toBe("rare");
      }
    }
  });

  it("starting stock covers a furnace, a toilet and stairs (recipe rule 5)", () => {
    let s = newGame(content);
    s = must(s, { type: "buildRoom", roomType: "furnace", floor: 3, cell: 0 });
    s = must(s, { type: "buildRoom", roomType: "toilet", floor: 3, cell: 1 });
    s = must(s, { type: "buildRoom", roomType: "stairs_right", floor: 3, cell: 5 });
    expect(s.gold).toBeGreaterThanOrEqual(0);
  });
});

describe("floor costs", () => {
  it("follow the design curve", () => {
    expect(floorCost(content, 4).gold).toBe(116);
    expect(floorCost(content, 9).gold).toBe(266);
    expect(floorCost(content, 20).gold).toBe(1644);
    expect(floorCost(content, 30).gold).toBe(5547);
  });

  it("scale with costScale", () => {
    expect(floorCost(content, 4, 0.5).gold).toBe(58);
  });

  it("building a floor pays and adds it", () => {
    let s = rich(newGame(content));
    const gold = s.gold;
    s = must(s, { type: "buildFloor" });
    expect(s.floors).toBe(4);
    expect(s.gold).toBe(gold - 116);
  });

  it("refuses when the player can't afford it", () => {
    const s = newGame(content);
    const r = apply(content, { ...s, gold: 0 }, { type: "buildFloor" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/Not enough for floor 4/);
  });
});

describe("building rooms", () => {
  it("rejects overlapping rooms", () => {
    const s = rich(newGame(content));
    const r = apply(content, s, { type: "buildRoom", roomType: "loggers_lodge", floor: 1, cell: 0 });
    expect(r.ok).toBe(false);
  });

  it("rejects rooms that stick out of the floor", () => {
    const s = rich(newGame(content));
    const r = apply(content, s, { type: "buildRoom", roomType: "loggers_lodge", floor: 3, cell: 4 });
    expect(r.ok).toBe(false);
  });

  it("demolishing refunds a third of the cost", () => {
    let s = rich(newGame(content));
    s = must(s, { type: "buildRoom", roomType: "loggers_lodge", floor: 3, cell: 0 });
    const gold = s.gold;
    s = must(s, { type: "demolishRoom", roomId: roomOf(s, "loggers_lodge").id });
    expect(s.gold - gold).toBe(Math.floor(65 * content.balance.demolishRefund));
  });

  it("never mutates the input state", () => {
    const s = rich(newGame(content));
    const before = JSON.stringify(s);
    apply(content, s, { type: "buildFloor" });
    advance(content, s, 600);
    expect(JSON.stringify(s)).toBe(before);
  });
});

describe("production", () => {
  it("is deterministic and follows the 6:3:1 ratio at level 1", () => {
    let s = rich(newGame(noToilets));
    s = must(s, { type: "cheatSetMood", mood: 70 }); // band output 1.0
    const lodge = roomOf(s, "hunters_lodge");
    // Keep collecting so storage never fills.
    for (let i = 0; i < 20; i++) {
      s = advance(noToilets, s, 60);
      s = must(s, { type: "cheatSetMood", mood: 70 });
      const r = apply(content, s, { type: "collect", roomId: lodge.id });
      if (r.ok) s = r.state;
    }
    const got = (id: string) => (s.inventory[id] ?? 0) - (rich(newGame(content)).inventory[id] ?? 0);
    // 1 hunter x 2 items/min x 20 min = 40 items, split 24 / 12 / 4 (bread is also eaten).
    expect(got("meat")).toBe(12);
    expect(got("fruit")).toBe(4);
  });

  it("improves the rare share when the room is upgraded", () => {
    let s = rich(newGame(content));
    const lodge = roomOf(s, "hunters_lodge");
    s = must(s, { type: "upgradeRoom", roomId: lodge.id });
    s = must(s, { type: "cheatSetMood", mood: 90 }); // needs met, so mood stays at 90 (output 1.1)
    const fruitBefore = s.inventory.fruit ?? 0;
    s = advance(content, s, 60 * 5); // 1 hunter x 2/min x 1.1 x 5 min = 11 items; 20% rare = 2.2
    s = must(s, { type: "collect", roomId: lodge.id });
    expect((s.inventory.fruit ?? 0) - fruitBefore).toBe(2);
  });

  it("stops filling when storage is full", () => {
    let s = rich(newGame(content));
    s = advance(content, s, 60 * 60);
    const lodge = roomOf(s, "hunters_lodge");
    const stored = Object.values(lodge.stored).reduce((a, n) => a + n, 0);
    expect(stored).toBe(12);
  });

  it("new recruits arrive at the door, walk to their station, then start work", () => {
    let s = rich(newGame(noToilets));
    s = must(s, { type: "buildRoom", roomType: "loggers_lodge", floor: 3, cell: 0 }, noToilets);
    const lodge = roomOf(s, "loggers_lodge");
    s = must(s, { type: "recruit", roomId: lodge.id }, noToilets);
    const id = roomOf(s, "loggers_lodge").minionIds[0]!;
    s = advance(noToilets, s, 60); // arrival timer
    expect(s.minions[id]!.x).toBeGreaterThan(noToilets.balance.floorWidth); // outside the front door
    expect(s.minions[id]!.atWork).toBe(false);
    s = advance(noToilets, s, 60); // walking in and up two flights
    expect(s.minions[id]!.floor).toBe(3);
    expect(s.minions[id]!.atWork).toBe(true);
    s = advance(noToilets, s, 60);
    expect(Object.values(roomOf(s, "loggers_lodge").stored).reduce((a, n) => a + n, 0)).toBeGreaterThan(0);
  });
});

describe("upkeep and mood", () => {
  it("floors near a lit furnace are warm; others are cold", () => {
    let s = newGame(content); // furnace on floor 2 warms floors 1-3
    s = rich(s);
    s = must(s, { type: "buildFloor" });
    const st = floorStatuses(content, s);
    expect(st.map((f) => f.warm)).toEqual([true, true, true, false]);
  });

  it("the furnace goes out and can be relit with a log", () => {
    let s = rich(newGame(content));
    s = advance(content, s, content.balance.upkeep.furnaceBurnMinutes * 60 + 1);
    const f = roomOf(s, "furnace");
    expect(f.fuel).toBe(0);
    const logs = s.inventory.log!;
    s = must(s, { type: "relightFurnace", roomId: f.id });
    expect(roomOf(s, "furnace").fuel).toBeGreaterThan(0);
    expect(s.inventory.log).toBe(logs - 1);
  });

  it("toilets clog after a number of visits and can be unclogged", () => {
    const quick = tweak((b) => {
      b.toilet.intervalMinutes = 1;
      b.toilet.visitsBeforeClog = 3;
    });
    let s = rich(newGame(quick));
    s = advance(quick, s, 5 * 60);
    const t = roomOf(s, "toilet");
    expect(t.clogged).toBe(true);
    expect(t.visits).toBeGreaterThanOrEqual(3);
    s = must(s, { type: "unclogToilet", roomId: t.id }, quick);
    expect(roomOf(s, "toilet").clogged).toBe(false);
    expect(roomOf(s, "toilet").visits).toBe(0);
  });

  it("floors cut off from every toilet are flagged", () => {
    let s = rich(newGame(content));
    s = must(s, { type: "demolishRoom", roomId: Object.values(s.rooms).find((r) => r.type.startsWith("stairs") && r.floor === 1)!.id });
    const st = floorStatuses(content, s);
    expect(st[0]!.hasToilet).toBe(true); // toilet is on floor 1
    expect(st[1]!.toilets).toBe(0); // floor 2 is cut off
    expect(st[1]!.hasToilet).toBe(false);
  });

  it("mood falls when needs fail and recovers when they are met", () => {
    let s = rich(newGame(content));
    s = must(s, { type: "cheatSetMood", mood: 90 });
    s = { ...s, inventory: { ...s.inventory, bread: 0, meat: 0, fruit: 0 } };
    s = advance(content, s, 60 * 10);
    const hungry = Object.values(s.minions)[0]!;
    expect(hungry.needs.fed).toBe(false);
    expect(hungry.mood).toBeLessThan(90);
    s = must(s, { type: "cheatAddItems", items: { bread: 100 } });
    s = advance(content, s, 60 * 10);
    expect(Object.values(s.minions)[0]!.mood).toBeGreaterThan(hungry.mood);
  });
});

describe("famine", () => {
  it("a hunter can always be hired with gold alone, even with no food", () => {
    let s = newGame(content);
    s = { ...s, gold: 500, inventory: {} };
    s = must(s, { type: "buildRoom", roomType: "hunters_lodge", floor: 3, cell: 0 });
    s = must(s, { type: "recruit", roomId: Object.values(s.rooms).find((r) => r.type === "hunters_lodge" && r.floor === 3)!.id });
    expect(Object.values(s.minions).filter((m) => m.type === "hunter")).toHaveLength(2);
  });

  it("starving minions eat meat and fruit when the bread runs out", () => {
    let s = newGame(content);
    s = { ...s, inventory: { bread: 0, meat: 5, fruit: 5 } };
    s = advance(content, s, 60 * 10); // 2 minions x 0.2 food/min x 10 min = 4 food
    expect(s.inventory.meat).toBe(1);
    expect(s.inventory.fruit).toBe(5);
    expect(Object.values(s.minions).every((m) => m.needs.fed)).toBe(true);
  });

  it("content rule: no recruit cost needs what the recruit's own room makes", () => {
    const bad = structuredClone({ names, items, minions, rooms, balance }) as any;
    bad.minions.hunter.recruitCost = { gold: 20, items: { bread: 10 } };
    expect(() => loadContent(bad)).toThrow(/costs bread, which only it makes/);
  });
});

describe("cheats", () => {
  it("time skip runs the same simulation as normal play", () => {
    const s = rich(newGame(content));
    const skipped = must(s, { type: "cheatTimeSkip", minutes: 30 });
    const played = advance(content, s, 30 * 60);
    expect(skipped.inventory).toEqual(played.inventory);
    expect(skipped.time).toBe(played.time);
  });

  it("crystals can hurry an arrival and are never earned", () => {
    let s = rich(newGame(content));
    s = must(s, { type: "buildRoom", roomType: "loggers_lodge", floor: 3, cell: 0 });
    s = must(s, { type: "recruit", roomId: roomOf(s, "loggers_lodge").id });
    const id = roomOf(s, "loggers_lodge").minionIds[0]!;
    expect(apply(content, s, { type: "hurryArrival", minionId: id }).ok).toBe(false);
    s = must(s, { type: "cheatAddCrystals", amount: 3 });
    s = must(s, { type: "hurryArrival", minionId: id });
    expect(s.minions[id]!.arrivesIn).toBe(0);
    expect(s.crystals).toBe(2);
  });
});

describe("saves", () => {
  it("round-trips through JSON", () => {
    const s = advance(content, rich(newGame(content)), 300);
    const back = migrate(JSON.parse(JSON.stringify(s)), content);
    expect(back).toEqual(s);
  });

  it("rejects damaged or future saves", () => {
    expect(() => migrate(null, content)).toThrow();
    expect(() => migrate({ version: 999 }, content)).toThrow(/newer version/);
    expect(() => migrate({ version: 2 }, content)).toThrow(/missing/);
  });

  it("upgrades old stairs to right-facing stairs", () => {
    const s = JSON.parse(JSON.stringify(newGame(content)));
    s.version = 2;
    for (const r of Object.values(s.rooms) as any[]) if (r.type.startsWith("stairs")) r.type = "stairs";
    const back = migrate(s, content);
    const stairs = Object.values(back.rooms).filter((r) => r.type.startsWith("stairs"));
    expect(stairs.map((r) => r.type)).toEqual(["stairs_right", "stairs_right"]);
  });

  it("upgrades a version-1 save by naming its minions", () => {
    const s = JSON.parse(JSON.stringify(newGame(content)));
    s.version = 1;
    for (const m of Object.values(s.minions) as any[]) delete m.name;
    const back = migrate(s, content);
    expect(back.version).toBe(STATE_VERSION);
    for (const m of Object.values(back.minions)) expect(m.name).toMatch(/\w+/);
  });
});

describe("working and idle", () => {
  it("minions work until storage fills, then go idle until it is collected", async () => {
    const { isWorking } = await import("../src/sim");
    let s = advance(noToilets, rich(newGame(noToilets)), 1);
    const hunter = Object.values(s.minions).find((m) => m.type === "hunter")!;
    expect(isWorking(noToilets, s, hunter)).toBe(true);
    s = advance(noToilets, s, 60 * 60);
    expect(isWorking(noToilets, s, s.minions[hunter.id]!)).toBe(false);
    s = must(s, { type: "collect", roomId: hunter.roomId }, noToilets);
    s = advance(noToilets, s, 90); // it wandered off while idle; give it time to walk back
    expect(isWorking(noToilets, s, s.minions[hunter.id]!)).toBe(true);
  });
});

describe("save safety", () => {
  it("rejects a save that claims the current version but is missing minion fields", () => {
    const s = JSON.parse(JSON.stringify(newGame(content)));
    for (const m of Object.values(s.minions) as any[]) delete m.x;
    expect(() => migrate(s, content)).toThrow(/no valid "x"/);
  });

  it("upgrades a version-3 save: minions get positions, toilets count visits", () => {
    const s = JSON.parse(JSON.stringify(newGame(content)));
    s.version = 3;
    delete s.rng;
    for (const r of Object.values(s.rooms) as any[]) {
      r.usage = 50;
      delete r.visits;
      delete r.occupant;
    }
    for (const m of Object.values(s.minions) as any[]) {
      for (const k of ["floor", "x", "climb", "target", "pace", "pause", "depth", "atWork", "bladder", "bladderRate", "errand", "sick", "sickReason", "carried", "fall"]) delete m[k];
    }
    const back = migrate(s, content);
    expect(back.version).toBe(STATE_VERSION);
    const hunter = Object.values(back.minions).find((m) => m.type === "hunter")!;
    expect(hunter.floor).toBe(back.rooms[hunter.roomId]!.floor);
    expect(Object.values(back.rooms)[0]!.visits).toBe(5);
    expect(() => advance(content, back, 60)).not.toThrow();
  });
});
