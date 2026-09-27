import { content, loadContent } from "../src/content";
import items from "../content/items.json";
import names from "../content/names.json";
import minions from "../content/minions.json";
import rooms from "../content/rooms.json";
import balance from "../content/balance.json";
import { advance, apply, newGame, placement, stepInPlace, type Command, type GameState, type Minion } from "../src/sim";

function tweak(fn: (b: any) => void) {
  const raw = structuredClone({ names, items, minions, rooms, balance }) as any;
  fn(raw.balance);
  return loadContent(raw);
}
const noToilets = tweak((b) => (b.toilet.intervalMinutes = 1e9));
const W = content.balance.floorWidth;

function must(s: GameState, cmd: Command, c = content): GameState {
  const r = apply(c, s, cmd);
  if (!r.ok) throw new Error(r.error);
  return r.state;
}
const byType = (s: GameState, type: string) => Object.values(s.minions).find((m) => m.type === type)!;
const roomOf = (s: GameState, type: string) => Object.values(s.rooms).find((r) => r.type === type)!;
const edit = (s: GameState, id: string, patch: Partial<Minion>): GameState => {
  const next = structuredClone(s);
  Object.assign(next.minions[id]!, patch);
  return next;
};

describe("working at a station", () => {
  it("crafters start at their station and work there", () => {
    const s = advance(noToilets, newGame(noToilets), 1);
    const hunter = byType(s, "hunter");
    const lodge = roomOf(s, "hunters_lodge");
    expect(hunter.floor).toBe(lodge.floor);
    expect(hunter.atWork).toBe(true);
  });

  it("a crafter away from its room pauses its share of production", () => {
    let s = advance(noToilets, newGame(noToilets), 1);
    const hunter = byType(s, "hunter");
    s = must(s, { type: "pickUp", minionId: hunter.id }, noToilets);
    const before = structuredClone(roomOf(s, "hunters_lodge").counters);
    s = advance(noToilets, s, 120);
    expect(roomOf(s, "hunters_lodge").counters).toEqual(before);
    expect(s.minions[hunter.id]!.atWork).toBe(false);
  });

  it("dropped back inside, it walks to its station and resumes", () => {
    let s = advance(noToilets, newGame(noToilets), 1);
    const hunter = byType(s, "hunter");
    s = must(s, { type: "pickUp", minionId: hunter.id }, noToilets);
    s = must(s, { type: "drop", minionId: hunter.id, x: 4.5, y: 1.2, vx: 0, vy: 0 }, noToilets); // floor 2, other end
    s = advance(noToilets, s, 30);
    expect(s.minions[hunter.id]!.atWork).toBe(true);
  });
});

describe("walking", () => {
  it("walks at a peaceful pace", () => {
    let s = advance(noToilets, newGame(noToilets), 1);
    const serf = byType(s, "serf");
    s = edit(s, serf.id, { target: { floor: 1, x: 3 }, x: 0.5, pause: 0 });
    s = advance(noToilets, s, 4);
    expect(s.minions[serf.id]!.x).toBeCloseTo(0.5 + 4 * content.balance.movement.walkSpeed, 1);
  });

  it("changes floors only by climbing stairs, along the flight's diagonal", () => {
    let s = advance(noToilets, newGame(noToilets), 60 * 60); // storage fills, so everyone roams
    let climbs = 0;
    const lastFloor = new Map<string, number>();
    for (let t = 0; t < 900; t++) {
      stepInPlace(noToilets, s, 1);
      for (const m of Object.values(s.minions)) {
        const p = placement(m);
        if (p.climbing && p.y > 0 && p.y < 1) {
          climbs++;
          // F1's right-facing stairs are in space 6 (cell 5): x = 5.1 at the bottom, 5.9 at the top.
          expect(p.x).toBeCloseTo(5.1 + 0.8 * p.y, 5);
        }
        const prev = lastFloor.get(m.id);
        if (prev !== undefined && !m.climb && Math.abs(prev - m.floor) > 1) throw new Error("teleported");
        lastFloor.set(m.id, m.floor);
      }
    }
    expect(climbs).toBeGreaterThan(5);
  });
});

describe("toilet trips", () => {
  it("a minion that needs to go runs to the toilet, uses it for 20 s, then walks on", () => {
    let s = advance(content, newGame(content), 1);
    const serf = byType(s, "serf");
    s = edit(s, serf.id, { bladder: 0.9999 });
    s = advance(content, s, 1);
    expect(s.minions[serf.id]!.errand?.stage).toBe("go");
    expect(s.minions[serf.id]!.pace).toBe("run");
    const t0 = roomOf(s, "toilet").visits;
    let usedFor = 0;
    for (let i = 0; i < 240 && s.minions[serf.id]!.errand; i++) {
      s = advance(content, s, 0.25);
      if (s.minions[serf.id]!.errand?.stage === "use") usedFor += 0.25;
    }
    expect(usedFor).toBeCloseTo(content.balance.toilet.useSeconds, 0);
    expect(roomOf(s, "toilet").visits).toBe(t0 + 1);
    expect(s.minions[serf.id]!.bladder).toBeLessThan(0.1);
    expect(s.minions[serf.id]!.pace).toBe("walk");
  });

  it("queueing too long makes a minion sick", () => {
    let s = advance(content, newGame(content), 1);
    const toilet = roomOf(s, "toilet");
    s = structuredClone(s);
    s.rooms[toilet.id]!.clogged = true; // nobody can use it, so everyone waits
    const serf = byType(s, "serf");
    s = edit(s, serf.id, { bladder: 0.9999 });
    s = advance(content, s, 90);
    const m = s.minions[serf.id]!;
    expect(m.sick).toBeGreaterThan(0);
    expect(m.sickReason).toBe("sick");
    expect(m.errand).toBeNull();
    expect(s.log.some((e) => e.text.includes("waited too long"))).toBe(true);
  });

  it("sick minions don't work and recover on their own", () => {
    let s = advance(noToilets, newGame(noToilets), 1);
    const hunter = byType(s, "hunter");
    s = edit(s, hunter.id, { sick: 5 * 60, sickReason: "sick" });
    s = advance(noToilets, s, 2);
    expect(s.minions[hunter.id]!.atWork).toBe(false);
    s = advance(noToilets, s, 5 * 60 + 60);
    expect(s.minions[hunter.id]!.sick).toBe(0);
    expect(s.minions[hunter.id]!.atWork).toBe(true);
  });

  it("with no toilet in reach, a minion has an accident and loses mood", () => {
    let s = advance(content, newGame(content), 1);
    s = must(s, { type: "demolishRoom", roomId: roomOf(s, "toilet").id });
    const serf = byType(s, "serf");
    s = edit(s, serf.id, { bladder: 0.9999, mood: 80 });
    s = advance(content, s, 0.5);
    expect(s.minions[serf.id]!.mood).toBeLessThanOrEqual(80 - content.balance.toilet.accidentMoodPenalty + 1);
    expect(s.minions[serf.id]!.errand).toBeNull();
  });
});

describe("throwing and falling", () => {
  const drop = (s: GameState, id: string, x: number, y: number, vx = 0, vy = 0) =>
    must(must(s, { type: "pickUp", minionId: id }), { type: "drop", minionId: id, x, y, vx, vy });

  it("a gentle drop inside lands on the floorboards below, unhurt", () => {
    let s = advance(noToilets, newGame(noToilets), 1);
    const serf = byType(s, "serf");
    s = drop(s, serf.id, 2.5, 2.9); // near the ceiling of floor 3
    s = advance(noToilets, s, 3);
    const m = s.minions[serf.id]!;
    expect(m.fall).toBeNull();
    expect(m.floor).toBe(3);
    expect(m.sick).toBe(0);
  });

  it("walls and ceilings keep a thrown minion inside its storey", () => {
    let s = advance(noToilets, newGame(noToilets), 1);
    const serf = byType(s, "serf");
    s = drop(s, serf.id, 3, 1.5, 40, 6); // hurled at the right wall and upward, on floor 2
    for (let i = 0; i < 40; i++) {
      s = advance(noToilets, s, 0.1);
      const m = s.minions[serf.id]!;
      if (m.fall) {
        expect(m.x).toBeLessThanOrEqual(W);
        expect(m.fall.y).toBeLessThan(2);
      }
    }
    expect(s.minions[serf.id]!.floor).toBe(2);
  });

  it("a fall of about one storey outside hurts", () => {
    let s = advance(noToilets, newGame(noToilets), 1);
    const serf = byType(s, "serf");
    s = drop(s, serf.id, W + 1, 1.5);
    s = advance(noToilets, s, 3);
    const m = s.minions[serf.id]!;
    expect(m.sick).toBeGreaterThan(0);
    expect(m.sickReason).toBe("hurt");
    expect(m.floor).toBe(1);
  });

  it("a fall from the third floor outside is fatal", () => {
    let s = advance(noToilets, newGame(noToilets), 1);
    const serf = byType(s, "serf");
    s = drop(s, serf.id, W + 1, 2.9);
    s = advance(noToilets, s, 3);
    expect(s.minions[serf.id]).toBeUndefined();
    expect(Object.values(s.rooms).every((r) => !r.minionIds.includes(serf.id))).toBe(true);
    expect(s.log.some((e) => e.text.includes("fell to their fate"))).toBe(true);
  });

  it("thrown out through the ground-floor door, it walks back in", () => {
    let s = advance(noToilets, newGame(noToilets), 1);
    const serf = byType(s, "serf");
    s = drop(s, serf.id, 5, 0.3, 4, 0);
    s = advance(noToilets, s, 2);
    expect(s.minions[serf.id]!.x).toBeGreaterThan(W);
    s = advance(noToilets, s, 30);
    expect(s.minions[serf.id]!.x).toBeLessThan(W);
  });

  it("is deterministic", () => {
    const run = () => {
      let s = advance(content, newGame(content), 1);
      const serf = byType(s, "serf");
      s = drop(s, serf.id, 2, 1.5, 3, 2);
      return advance(content, s, 600);
    };
    expect(JSON.stringify(run())).toBe(JSON.stringify(run()));
  });
});

describe("the roof", () => {
  const drop = (s: GameState, id: string, x: number, y: number, vx = 0, vy = 0, c = noToilets) =>
    must(must(s, { type: "pickUp", minionId: id }, c), { type: "drop", minionId: id, x, y, vx, vy }, c);

  it("a minion dropped above the roof lands and stands on it", () => {
    let s = advance(noToilets, newGame(noToilets), 1);
    const serf = byType(s, "serf");
    s = drop(s, serf.id, 2.5, s.floors + 0.4);
    s = advance(noToilets, s, 2);
    const m = s.minions[serf.id]!;
    expect(m.fall).toBeNull();
    expect(m.floor).toBe(s.floors + 1);
    expect(placement(m).y).toBe(s.floors);
    expect(m.sick).toBe(0);
  });

  it("without stairs on the top floor, a minion on the roof stays up there", () => {
    let s = advance(noToilets, newGame(noToilets), 1); // start layout has no top-floor stairs
    const serf = byType(s, "serf");
    s = drop(s, serf.id, 2.5, s.floors + 0.2);
    s = advance(noToilets, s, 120);
    expect(s.minions[serf.id]!.floor).toBe(s.floors + 1);
  });

  it("stairs on the top floor lead to the roof, and idle minions come back down", () => {
    let s = advance(noToilets, newGame(noToilets), 1);
    s = must(s, { type: "cheatAddGold", amount: 100 }, noToilets);
    s = must(s, { type: "buildRoom", roomType: "stairs_right", floor: s.floors, cell: 5 }, noToilets);
    const serf = byType(s, "serf");
    s = drop(s, serf.id, 2.5, s.floors + 0.2);
    let wentDown = false;
    for (let i = 0; i < 180 && !wentDown; i++) {
      s = advance(noToilets, s, 1);
      wentDown = s.minions[serf.id]!.floor <= s.floors && !s.minions[serf.id]!.climb;
    }
    expect(wentDown).toBe(true);
  });

  it("the roof is a floor: a furnace on the top floor warms it, otherwise it's cold", () => {
    let s = advance(noToilets, newGame(noToilets), 1); // start furnace is on floor 2, two below the roof
    const serf = byType(s, "serf");
    s = drop(s, serf.id, 2.5, s.floors + 0.2);
    s = advance(noToilets, s, 3);
    expect(s.minions[serf.id]!.needs.warm).toBe(false);
    s = must(s, { type: "buildRoom", roomType: "furnace", floor: s.floors, cell: 3 }, noToilets);
    s = advance(noToilets, s, 1);
    expect(s.minions[serf.id]!.needs.warm).toBe(true);
  });

  it("the left edge has a parapet; thrown off the right edge, a minion falls to its fate", () => {
    let s = advance(noToilets, newGame(noToilets), 1);
    const serf = byType(s, "serf");
    // Thrown left along the roof: bounces off the parapet and stays up.
    s = drop(s, serf.id, 1, s.floors + 0.3, -6, 0);
    s = advance(noToilets, s, 3);
    expect(s.minions[serf.id]!.floor).toBe(s.floors + 1);
    // Thrown right: over the edge, three storeys down to the ground.
    s = drop(s, serf.id, 5, s.floors + 0.3, 6, 0);
    s = advance(noToilets, s, 4);
    expect(s.minions[serf.id]).toBeUndefined();
  });

  it("wanderers never choose the roof as a destination", () => {
    let s = advance(noToilets, newGame(noToilets), 1);
    s = must(s, { type: "cheatAddGold", amount: 100 }, noToilets);
    s = must(s, { type: "buildRoom", roomType: "stairs_right", floor: s.floors, cell: 5 }, noToilets);
    s = advance(noToilets, s, 60 * 60); // storage fills; everyone roams for an hour
    for (let i = 0; i < 600; i++) {
      stepInPlace(noToilets, s, 1);
      for (const m of Object.values(s.minions)) expect(m.target?.floor ?? 0).toBeLessThanOrEqual(s.floors);
    }
  });
});

describe("fleeing the cold", () => {
  /** Start game plus a 4th floor (cold: the furnace on floor 2 only reaches floors 1-3) joined by stairs. */
  function withColdFloor() {
    let s = advance(noToilets, newGame(noToilets), 1);
    s = must(s, { type: "cheatAddGold", amount: 1000 }, noToilets);
    s = must(s, { type: "cheatAddItems", items: { log: 50, bread: 50 } }, noToilets);
    s = must(s, { type: "buildFloor" }, noToilets);
    s = must(s, { type: "buildRoom", roomType: "stairs_right", floor: 3, cell: 5 }, noToilets);
    return s;
  }

  it("an idle minion on a cold floor runs to the nearest warm floor", () => {
    let s = withColdFloor();
    const serf = byType(s, "serf");
    s = must(must(s, { type: "pickUp", minionId: serf.id }, noToilets), { type: "drop", minionId: serf.id, x: 2, y: 3.1, vx: 0, vy: 0 }, noToilets);
    s = advance(noToilets, s, 2);
    expect(s.minions[serf.id]!.floor).toBe(4);
    expect(s.minions[serf.id]!.pace).toBe("run");
    expect(s.minions[serf.id]!.target?.floor).toBe(3);
    s = advance(noToilets, s, 30);
    expect(s.minions[serf.id]!.floor).toBe(3);
    expect(s.minions[serf.id]!.pace).toBe("walk");
  });

  it("wanderers don't choose cold floors when a warm one is reachable", () => {
    let s = withColdFloor();
    s = advance(noToilets, s, 10 * 60); // storage fills, so everyone roams (the furnace still has fuel)
    for (let i = 0; i < 900; i++) {
      stepInPlace(noToilets, s, 1);
      for (const m of Object.values(s.minions)) if (m.target && m.pace === "walk") expect(m.target.floor).toBeLessThanOrEqual(3);
    }
  });

  it("with no warm floor in reach, it just wanders", () => {
    let s = advance(noToilets, newGame(noToilets), 1);
    s = structuredClone(s);
    for (const r of Object.values(s.rooms)) if (r.type === "furnace") r.fuel = 0; // the only furnace goes out
    const serf = byType(s, "serf");
    s = edit(s, serf.id, { pause: 0, target: null });
    s = advance(noToilets, s, 5);
    expect(s.minions[serf.id]!.pace).toBe("walk");
  });
});
