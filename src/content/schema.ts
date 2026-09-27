import { z } from "zod";

export const TierSchema = z.enum(["common", "uncommon", "rare"]);
export type Tier = z.infer<typeof TierSchema>;

export const CostSchema = z.object({
  gold: z.number().nonnegative().default(0),
  items: z.record(z.string(), z.number().int().positive()).default({}),
});
export type Cost = z.infer<typeof CostSchema>;

export const ItemSchema = z.object({
  name: z.string(),
  tag: z.string(),
  tier: TierSchema,
  family: z.string(),
});
export type ItemDef = z.infer<typeof ItemSchema>;

export const MinionSchema = z.object({
  name: z.string(),
  recruitCost: CostSchema,
  arrivalSeconds: z.number().positive(),
  /** Text colour for this profession's names in the tower. */
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});
export type MinionDef = z.infer<typeof MinionSchema>;

const GoldProductionSchema = z.object({
  kind: z.literal("gold"),
  goldPerMinute: z.number().positive(),
  storageMinutes: z.number().positive(),
});

const GoodsProductionSchema = z.object({
  kind: z.literal("goods"),
  tiers: z.tuple([z.string(), z.string(), z.string()]),
  storagePerMinion: z.number().int().positive(),
});

export const RoomSchema = z.object({
  name: z.string(),
  tab: z.enum(["dwelling", "crafting", "service", "entertain", "tower"]),
  width: z.number().int().min(1).max(3),
  flavor: z.string(),
  unlockFloor: z.number().int().nonnegative(),
  resident: z.string().optional(),
  production: z.discriminatedUnion("kind", [GoldProductionSchema, GoodsProductionSchema]).optional(),
  utility: z
    .object({ kind: z.enum(["furnace", "toilet", "stairs"]), facing: z.enum(["left", "right"]).optional() })
    .optional(),
  levels: z.array(z.object({ cost: CostSchema })).min(1).max(3),
});
export type RoomDef = z.infer<typeof RoomSchema>;

const BandSchema = z.object({ min: z.number(), face: z.string(), output: z.number().nonnegative() });

export const BalanceSchema = z.object({
  tickSeconds: z.number().positive(),
  timeScale: z.number().positive(),
  costScale: z.number().positive(),
  floorWidth: z.number().int().positive(),
  production: z.object({
    itemsPerMinutePerMinion: z.number().positive(),
    tierRatios: z.array(z.tuple([z.number(), z.number(), z.number()])).length(3),
    slotsPerLevel: z.number().int().positive(),
  }),
  itemValue: z.object({ common: z.number(), uncommon: z.number(), rare: z.number() }),
  floor: z.object({
    baseGold: z.number().positive(),
    growth: z.number().positive(),
    polyAfter: z.number().int().positive(),
    polyExponent: z.number().positive(),
    goods: z.array(z.object({ item: z.string(), valueShare: z.number().nonnegative() })),
  }),
  upkeep: z.object({
    foodPerMinionPerMinute: z.number().nonnegative(),
    /** Foods minions eat, in order of preference. */
    foodItems: z.array(z.string()).min(1),
    furnaceBurnMinutes: z.number().positive(),
    furnaceRelightCost: CostSchema,
    furnaceReach: z.number().int().nonnegative(),
    /** Guideline shown to the player; overcrowding shows up as toilet queues. */
    minionsPerToilet: z.number().positive(),
  }),
  movement: z.object({
    /** Floor spaces per game second. */
    walkSpeed: z.number().positive(),
    runSpeed: z.number().positive(),
    /** Game seconds per flight of stairs. */
    climbWalkSeconds: z.number().positive(),
    climbRunSeconds: z.number().positive(),
    /** Floor spaces of open ground to the right of the tower, outside the front door. */
    outsideWidth: z.number().positive(),
  }),
  toilet: z.object({
    intervalMinutes: z.number().positive(),
    /** Each minion's interval varies by up to this share, so they don't all go at once. */
    intervalJitter: z.number().min(0).max(0.9),
    useSeconds: z.number().positive(),
    /** Waiting in the queue longer than this makes a minion sick. */
    queueSickSeconds: z.number().positive(),
    visitsBeforeClog: z.number().int().positive(),
    /** Mood lost when no toilet can be reached at all. */
    accidentMoodPenalty: z.number().nonnegative(),
  }),
  sickness: z.object({
    sickMinutes: z.number().positive(),
    hurtMinutes: z.number().positive(),
  }),
  physics: z.object({
    metersPerFloor: z.number().positive(),
    /** m/s^2 */
    gravity: z.number().positive(),
    /** Landing speeds in m/s. */
    hurtImpactSpeed: z.number().positive(),
    lethalImpactSpeed: z.number().positive(),
    maxThrowFloorsPerSecond: z.number().positive(),
    /** Share of speed kept when bouncing off a wall or ceiling. */
    wallBounce: z.number().min(0).max(1),
  }),
  mood: z.object({
    targetByFailedNeeds: z.array(z.number()).min(1),
    changePerMinute: z.number().positive(),
    bands: z.array(BandSchema).min(1),
  }),
  exp: z.object({
    perCollect: z.number(),
    perRecruit: z.number(),
    perFloor: z.number(),
    perLevel: z.number().positive(),
  }),
  demolishRefund: z.number().min(0).max(1),
  cheats: z.object({ crystalFinishCost: z.number().int().nonnegative() }),
  start: z.object({
    gold: z.number().nonnegative(),
    items: z.record(z.string(), z.number().int().nonnegative()),
    floors: z.number().int().positive(),
    rooms: z.array(
      z.object({
        type: z.string(),
        floor: z.number().int().positive(),
        cell: z.number().int().nonnegative(),
        minions: z.number().int().nonnegative().optional(),
      }),
    ),
  }),
});
export type Balance = z.infer<typeof BalanceSchema>;

export const ContentSchema = z.object({
  names: z.array(z.string().min(1).max(8)).min(1),
  items: z.record(z.string(), ItemSchema),
  minions: z.record(z.string(), MinionSchema),
  rooms: z.record(z.string(), RoomSchema),
  balance: BalanceSchema,
});
export type Content = z.infer<typeof ContentSchema>;
