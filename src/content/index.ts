import items from "../../content/items.json";
import names from "../../content/names.json";
import minions from "../../content/minions.json";
import rooms from "../../content/rooms.json";
import balance from "../../content/balance.json";
import { ContentSchema, type Content } from "./schema";

export * from "./schema";

/** Parses raw content and checks cross-file references. Throws with every problem listed. */
export function loadContent(raw: unknown): Content {
  const content = ContentSchema.parse(raw);
  const problems: string[] = [];
  const itemIds = new Set(Object.keys(content.items));
  const checkItems = (where: string, ids: Iterable<string>) => {
    for (const id of ids) if (!itemIds.has(id)) problems.push(`${where}: unknown item "${id}"`);
  };

  for (const [id, m] of Object.entries(content.minions)) {
    checkItems(`minion ${id} recruit cost`, Object.keys(m.recruitCost.items));
  }
  for (const [id, r] of Object.entries(content.rooms)) {
    if (r.resident && !content.minions[r.resident]) problems.push(`room ${id}: unknown resident "${r.resident}"`);
    if (r.production && !r.resident) problems.push(`room ${id}: produces but has no resident`);
    if (r.production?.kind === "goods") checkItems(`room ${id} production`, r.production.tiers);
    r.levels.forEach((l, i) => checkItems(`room ${id} level ${i + 1}`, Object.keys(l.cost.items)));
    if (r.width > content.balance.floorWidth) problems.push(`room ${id}: wider than a floor`);
  }
  const b = content.balance;
  checkItems("balance floor goods", b.floor.goods.map((g) => g.item));
  checkItems("balance start items", Object.keys(b.start.items));
  checkItems("balance furnace relight", Object.keys(b.upkeep.furnaceRelightCost.items));
  checkItems("balance food items", b.upkeep.foodItems);
  // Recipe rule 7: nobody's recruit cost may need what their own room makes (the "bread to hire a hunter" deadlock).
  for (const [id, r] of Object.entries(content.rooms)) {
    if (r.production?.kind !== "goods" || !r.resident) continue;
    const cost = content.minions[r.resident]?.recruitCost.items ?? {};
    for (const item of r.production.tiers) {
      if (cost[item]) problems.push(`room ${id}: recruiting its ${r.resident} costs ${item}, which only it makes`);
    }
  }
  for (const s of b.start.rooms) if (!content.rooms[s.type]) problems.push(`start room: unknown type "${s.type}"`);

  if (problems.length) throw new Error(`Invalid content:\n- ${problems.join("\n- ")}`);
  return content;
}

export const content: Content = loadContent({ names, items, minions, rooms, balance });
