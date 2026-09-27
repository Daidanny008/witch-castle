/**
 * Quick balance model (DESIGN.md §4.4 step 2). Pure arithmetic from content/, no simulation.
 * Prints item values, per-minion income, recruit payback, room cost rules and the floor pacing curve.
 * Run: npm run balance
 */
import { content } from "../src/content";
import { costValue, floorCost, itemValue } from "../src/sim/economy";

const b = content.balance;
const out = (s = "") => console.log(s);
const pad = (v: string | number, n: number) => String(v).padStart(n);
let problems = 0;
const warn = (msg: string) => {
  problems++;
  console.log(`  !! ${msg}`);
};

out("== Item values (gold-equivalent) ==");
for (const [id, item] of Object.entries(content.items)) out(`  ${item.tag.padEnd(9)} ${item.tier.padEnd(9)} ${pad(itemValue(content, id), 3)} g`);

out("\n== Crafting minion income by room level ==");
b.production.tierRatios.forEach((r, i) => {
  const total = r[0] + r[1] + r[2];
  const perItem = (r[0] * b.itemValue.common + r[1] * b.itemValue.uncommon + r[2] * b.itemValue.rare) / total;
  const perMin = perItem * b.production.itemsPerMinutePerMinion;
  const rarePerHour = (b.production.itemsPerMinutePerMinion * 60 * r[2]) / total;
  out(`  L${i + 1}  ratio ${r.join(":").padEnd(6)} ${pad(perMin.toFixed(1), 5)} g/min   ${pad(rarePerHour.toFixed(0), 3)} rares/hour`);
});

out("\n== Recruit payback (at content mood, output 1.0) ==");
const l1 = b.production.tierRatios[0]!;
const l1Value =
  ((l1[0] * b.itemValue.common + l1[1] * b.itemValue.uncommon + l1[2] * b.itemValue.rare) / (l1[0] + l1[1] + l1[2])) *
  b.production.itemsPerMinutePerMinion;
for (const [roomId, room] of Object.entries(content.rooms)) {
  if (!room.resident || !room.production) continue;
  const minion = content.minions[room.resident]!;
  const cost = costValue(content, minion.recruitCost);
  const income = room.production.kind === "gold" ? room.production.goldPerMinute : l1Value;
  const eats = b.upkeep.foodPerMinionPerMinute * itemValue(content, b.upkeep.foodItems[0]!);
  const net = income - eats;
  out(`  ${minion.name.padEnd(8)} costs ${pad(cost, 4)} g, earns ${pad(income.toFixed(1), 5)} g/min, eats ${eats.toFixed(1)} -> pays back in ${(cost / net).toFixed(1)} min`);
  if (net <= 0) warn(`${minion.name} (${roomId}) never pays back`);
}

out("\n== Room costs (value V, rule: L2 about 3V, L3 about 8V, rares at most 10%) ==");
for (const [id, room] of Object.entries(content.rooms)) {
  const values = room.levels.map((l) => costValue(content, l.cost));
  const v = values[0]!;
  const line = values.map((x, i) => `L${i + 1} ${pad(x, 4)}${i ? ` (${(x / v).toFixed(1)}V)` : ""}`).join("  ");
  out(`  ${room.name.padEnd(15)} ${line}`);
  room.levels.forEach((l, i) => {
    const rare = Object.entries(l.cost.items).reduce(
      (a, [item, n]) => a + (content.items[item]?.tier === "rare" ? b.itemValue.rare * n : 0),
      0,
    );
    if (rare / values[i]! > 0.1 + 1e-9) warn(`${room.name} L${i + 1}: rares are ${Math.round((rare / values[i]!) * 100)}% of the cost`);
  });
}

out("\n== Floor pacing (model: ~2 minions/floor, 12 g/min each, 35% of income on floors) ==");
out("  floor   gold   goods                  this floor   total");
let total = 0;
for (let n = 4; n <= 60; n++) {
  const cost = floorCost(content, n);
  const value = costValue(content, cost);
  const boost = 1 + Math.min(0.55, Math.max(0, (n - 10) * 0.03)); // room upgrades raise income later on
  const minutes = value / (0.35 * 12 * boost * Math.max(3, 2 * n));
  total += minutes;
  if ([4, 5, 6, 9, 12, 15, 20, 25, 30, 40, 50, 60].includes(n)) {
    const goods = Object.entries(cost.items).map(([id, k]) => `${k} ${id}`).join(", ");
    const t = total >= 60 ? `${(total / 60).toFixed(1)} h` : `${total.toFixed(0)} min`;
    out(`  ${pad(n, 5)} ${pad(cost.gold, 6)}   ${goods.padEnd(22)} ${pad(minutes.toFixed(0), 5)} min   ${pad(t, 7)}`);
  }
}

out(problems ? `\n${problems} problem(s) found.` : "\nNo problems found.");
process.exitCode = problems ? 1 : 0;
