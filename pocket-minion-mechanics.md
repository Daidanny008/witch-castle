# Pocket Minions: Game Mechanics

*Pocket Minions* (often searched as "Pocket Minion") is a medieval tower-building and resource-management sim for iOS. SiuYiu Limited released it in July 2012, and it was later sold by SuperFine Games Ltd. It has since been removed from the App Store. This document collects what is known about how it plays, from critic reviews, the official site and store listing, an archived fan wiki (2013–2015), and the official screenshots.

Screenshots and art referenced below are in `images/` (gitignored). A visual version of this document is in `pocket-minions.html`. The marketing screenshots are full App Store resolution (`store-ipad-*.png` at 1536×2048, `store-iphone-*.png` at 640×1136). The in-game screenshots `shot-1…5.jpg` survive only at 256×384. `pg-*.jpg` are 450 px crops from Pocket Gamer. `video-*.png` are 676×720 frames (game area only) from the July 2012 gameplay video (https://www.youtube.com/watch?v=D7i2PM9aBhY). The video tops out at 720p, even when signed in.

Confidence tags used below:
- **[confirmed]**: stated by a review, the official copy, or the fan wiki
- **[screenshot]**: read directly off an official screenshot
- **[inferred]**: my reading of the evidence, not stated anywhere

---

## 1. Premise and structure

- A band of minions builds a castle in a valley and angers the fire-breathing dragons that live there. The player is **"the Almighty Finger"**, a god-like hand protecting them. [confirmed]
- The campaign has **10 levels**. Each level is one tower on a map of the valley, and the goal at the end is the **Legendary Treasure**. [confirmed] See `images/shot-6.jpg`.
- In each level you build a tower floor by floor until you meet its goals, such as reaching a height or building a quota of certain units. Then you start fresh at the next site. The first tower's plan calls for **10 floors** ("According to the plans, this tower should be 10 floors high"), and reviewers mention 15–25 floors later on. [confirmed, `images/video-quest-6th-floor.png`]
- A guide character (the scholar with glasses) gives **tutorial quests**. The video shows, in order: build a 4th floor → build a Logger's Lodge → recruit a Logger → tap minions to collect → build another furnace → build a 5th floor → build a Miner's Lodge → recruit a Miner → build a toilet → build a 6th floor → recruit a Blacksmith. Completed quests pay goods or gold, for example 20 food and 40 gold, 2 logs and 1 hammer, or 4 nails and 5 logs. [screenshot, video]
- **Gold carries over between towers. Items (goods) belong to the tower that made them.** [confirmed, player review]
- Each tower has a name, a progress bar and a numbered badge. Screenshots show the names "Dragon Tower" (badge 2), "Tower 3", "Babel", "Caleb" and "CS". The last two look like names players typed, so towers can probably be renamed. [screenshot, `images/shot-4.jpg`; the renaming is inferred]
- Early levels come with step-by-step quests. After you defeat your first dragon, the quests stop giving you instructions. [confirmed, player guide]
- Game Center tracks scores ("Who is the Mightiest Finger of all?"). [confirmed]

## 2. Core loop

```
build room → recruit minions into it → minions produce goods on a timer
     ↑                                              ↓
     └──── spend goods + gold on new rooms / upgrades ← tap icon to collect
```

- Building a room lets you recruit minions of its type. Recruiting costs gold and food. [confirmed]
- When a good is ready, its icon pops up over the minion and you **tap it to collect**. [confirmed]
- Simple goods pay for complex rooms, which produce the goods for even more complex rooms. [confirmed]
- You also **collect rent** from residents. [confirmed] In practice this is the gold that dwelling minions produce (see §4).

## 3. Rooms

### Build menu categories
The build menu has five tabs, each marked by an icon [screenshot, `images/wiki-build-menu-dwelling.png`]:

| Tab | Icon | Contents |
|---|---|---|
| **Dwelling** | gold coin | Rooms whose minions produce gold |
| **Crafting** | hammer | Rooms whose minions produce goods |
| **Service** | red sword/quill | Upkeep and defense staff: maids, guards, mages [inferred] |
| **Entertain** | theatre masks | Rooms that restore happiness, such as the Jester's club |
| **Tower** | green torch | Tower infrastructure: stairs, furnaces, toilets [inferred] |

### Room rules
- Each room has **3 levels** (shown as ◆◆◆ pips). Every level adds **2 minion slots**, so a room holds 2, 4 or 6 minions. [confirmed, wiki; screenshot]
- Rooms take up a set width on the floor: **1x1, 1x2 or 1x3** cells. [confirmed, wiki]
- Upgrading costs goods plus gold. The panel shows each requirement as have/need, with shortfalls **in red**, and the Upgrade button stays **wrapped in a padlocked chain** until every requirement is met. [screenshot, `images/shot-5.jpg`]
- Tapping a room opens a toolbar with its name and level (for example "Furnace L1") and three buttons: **demolish** (a red bulldozer icon), **inspect** (a magnifying glass, which opens the room panel) and **move** (four arrows). [video; the earlier reading of "furnish" was wrong]
- Placing or moving a room: drag it to an empty spot in the tower, then confirm with ✓ or cancel with ✗. [video, `images/video-placing-room.png`]
- Rooms have capacity limits. The game shows "Club is full!" when you try to put more minions in the Jester's club than it holds. [video]
- Each room panel has flavor text. For example, the Armory has a mood line ("Something REEKS in the Corner!") and a description ("A Dingy Old ARMORY filled with Cobwebs and limited supplies"). [screenshot]

### Build menu contents read from the 720p video [video]
Build costs are the numbers under the icons on each menu card. At 720p the small digits are legible but not certain, so treat them as approximate.

**Tower tab** (`images/video-build-menu-tower-tab-full.png`). The list continues below Infirmary, but the video never scrolls further.

| Room | Size | Cost | Card text |
|---|---|---|---|
| Stairs (Left) | 1x1 | 15 gold | "Narrow, uneven and medieval" |
| Furnace | 1x1 | 20 gold, 2 logs, 1 hammer | "You need 1 for every 3 floors" |
| Toilet | 1x1 | 20 gold, 2 panels, 2 nails | "You need 1 for every 8 minions" |
| **Infirmary** | 1x1 | 120 gold, 10 stone, 10 potions | "**Heals sick or injured minions**". Minions can get sick or hurt, which none of the reviews mention |

**Crafting tab** (`images/video-build-menu-crafting-tab.png`). Hunter's Lodge is probably above Workshop, off-screen.

| Room | Size | Cost | Card text |
|---|---|---|---|
| Workshop | 1x3 | 65 gold, 3 nails, 5 logs | "Where craftsman live and work" |
| Logger's Lodge | 1x3 | 65 gold, 3 nails, 5 stone | "Recruit Loggers to produce beam, log or panel" |
| Miner's Lodge | 1x3 | 75 gold, 4 nails, 2 logs | "Recruit Miners to produce glove, rope and stone" |
| Armory | 1x3 | 80 gold, 4 nails, 5 logs | "Forges fantastic dragon slaying weapons" |
| Magic Lab | 1x3 | about 160 gold, nails, 1 potion (partly cut off) | not visible |

**Inventory screen** (`images/video-inventory.png`): a 3-column grid of item slots, each with a count, for example meat 1, bread 30, fruit 4, and 0 for gem, nails, cog, glove and stone. It's probably behind the treasure-chest HUD button [inferred]. It also confirms that "glove" is a real item: a leather glove icon.

### Dwelling rooms (gold producers) [confirmed, wiki]

| Room | Size | Build cost | Resident | Recruit cost | Output | L2 upgrade | L3 upgrade |
|---|---|---|---|---|---|---|---|
| Shack | 1x1 | 25 gold | Serf | 2 food, 2 gold (video) | 5g | not recorded | not recorded |
| Inn | 1x2 | 45 gold, 1 nail, 2 logs | Peasant | 5 grain, 5 gold | 20g/min (the in-game text says 10g, which the wiki calls a typo) | 5 panels, 8 nails, 2 hammers, 70 gold | 10 panels, 16 nails, 10 hammers, 100 gold |
| Market | 1x2 | 100 gold, 5 grain, 20 logs | Merchant | 20 fruit, 15 gold | 100g per 10 min | 5 panels, 25 grain, 25 fruit, 250 gold | 25 rope, 100 grain, 100 fruit, 300 gold |
| Vassal Room | 1x2 | 200 gold, 5 panels, 10 fruit | Vassal | 20 fruit, 30 gold | 300g per hour | 20 panels, 20 fruit, 5 gems, 400 gold | 30 fruit, 10 gems, 10 beams, 700 gold |

Serf, peasant, merchant and vassal form a ladder of social ranks. Better dwellings earn more per minion. The trade-off is between collecting often (Inn, Market) and collecting rarely but in larger amounts (Vassal Room). [inferred]

### Crafting rooms (goods producers)
Each crafting minion produces one of three related goods. [confirmed, wiki "Resources" page]

| Room | Minion | Goods | Notes |
|---|---|---|---|
| Hunter's Lodge | Hunter | Meat, grain, fruit | 1x3 room. Build: 100 gold. Recruit: 50 gold. Output: 1 food every 30 s, type random. L2: 5 nails, 10 logs, 5 rope, 300 gold. L3: 20 rope, 20 fruit, 8 beams, 500 gold. Food is needed to recruit most minions. |
| Logger's Lodge | Logger | Beams, logs, panels | Wood is needed for basic infrastructure such as toilets. |
| Workshop | Craftsman | Nails, cogs, hammers | Cogs are the gear icons on upgrade bills. |
| Miner's Lodge | Miner | **Glove, rope, stone** | The in-game text reads "Recruit Miners to produce glove, rope and stone" (the wiki misspelled it "golve"). Recruit: 10 food + 20 gold, 59 s wait. [`images/video-miners-lodge-panel.png`] |
| **Armory** | **Blacksmith** | **Swords, shields, armor** | The Armory "Forges fantastic dragon slaying weapons", and a tutorial quest says to "recruit a Blacksmith from the armory, to make swords, shields and armor". Recruit: 10 food + 20 gold, 2m59s wait, in the video (the website screenshot shows 10 of one food + 30 meat). Sword, round shield and bucket-helmet harvest bubbles appear over minions (`pg-club-moods.jpg`). |
| **Magic Lab** | **Alchemist** | **Potions, wands, gems** | Gems are required for Vassal Room upgrades. The screenshots show a green-lit lab. |

### Service, entertainment and tower rooms
| Room | Minion | Job | Confidence |
|---|---|---|---|
| Maid's quarters | Maid | Relights furnaces and unclogs toilets, **only when ordered by hand** | confirmed |
| Barracks | Guard | Arrests thieves and fights dragons. Tapping a guard shows **"Catch Thief?" / "Fight Dragon?"** | confirmed + screenshot |
| Dungeon | none | Holds thieves the guards have arrested | confirmed |
| **Mage's quarters** | **Mage (wizard)** | **Removes ghosts.** Screenshots also show wizards firing pink magic at dragons from the roof | confirmed (player guide) + screenshot |
| Jester's club / jester show venue | Jester | **Drop an unhappy minion into it and they become happy right away** | confirmed |
| Furnace | none | Heat. Needed about every 3 floors | confirmed |
| Toilet | none | Sanitation. One per 8 minions, and it clogs over time | confirmed |
| Stairs | none | Link floors. 1 space, 15 gold, with left- and right-facing versions ("Narrow, uneven and medieval"). The guide advises stairs in every room so minions can always get home | confirmed + video |

## 4. Resources and currencies

| Resource | Source | Scope |
|---|---|---|
| Gold (crown-stamped coin) | Dwelling minions (rent), quest rewards | **Shared across all towers** |
| **Experience (green orb)** | Pops up over minions. Tap for "+1 EXP" | Likely fills the tower progress bar [inferred] |
| Food: meat, grain, fruit | Hunters | Per tower |
| Wood: beams, logs, panels | Loggers | Per tower |
| Hardware: nails, cogs, hammers | Craftsmen | Per tower |
| Mining: glove, rope, stone | Miners | Per tower |
| Arms: swords, shields, armor | Blacksmiths | Per tower |
| Magic: potions, wands, gems | Alchemists | Per tower |
| **Dragon crystals** | Earned slowly in play, or bought | Premium currency |

**Dragon crystals** skip waiting times and buy goods you're short of. They were sold in packs from "A Handful of Crystals" ($0.99) up to a "Crystal Treasure Chest" ($49.99). There was no confirmation prompt, so players often spent them by accident while tapping minions. [confirmed]

## 5. Minion needs and moods

- Each minion shows a **mood face** above its head. The screenshots show green, orange, blue, purple and red faces, with red meaning angry. [screenshot, `images/shot-3.jpg`] What each of the middle colors means isn't documented. [inferred]
- The needs are **heat** (furnaces), **sanitation** (toilets), **food**, and **access** (stairs). [confirmed]
- Minions complain in their own voice. A Blacksmith's line reads "I'm Fiken STARVIN over here!" [screenshot]
- **Unmet needs → lower output → rioting → some minions turn into thieves** who steal goods. [confirmed]
- Fixes:
  - Order a maid to fix the furnace or toilet.
  - Drop the minion into the Jester's club.
  - Build more of whatever is missing.
  - Send a guard to arrest the thief and lock them in the dungeon.

## 6. Threats

### Thieves
Thieves are angry minions who steal your goods. A guard catches them and takes them to the dungeon. [confirmed]

### Dragons
- Dragons arrive now and then and breathe fireballs at the tower. [confirmed]
- You **drag guards onto the rooftop**, where they shoot arrows. Wizards also fire magic. A wooden crane or catapult sits on the roof. [confirmed + screenshot, `images/shot-2.jpg`, `images/shot-10.jpg`]
- Up to three dragons can attack at once, in at least three colors: red with blue wings, dark purple, and green. [screenshot, `images/store-ipad-3-battle-dragons.png`]

### Ghosts
Minions killed in a dragon attack come back as **glowing cyan ghosts** that frighten the living. Mages from the Mage's quarters exorcise them. [confirmed, `images/shot-7.jpg`]

## 7. Direct manipulation (the Almighty Finger)

- A physics system lets you **pick up, drag, flick and toss** any minion. [confirmed, `images/shot-9.jpg`]
- Dragging is also how you **assign** minions: guards to the roof, unhappy minions to the Jester's club.
- Side effect: dragging to scroll the tower often grabs a minion by mistake and throws it, sometimes to its death or off the edge of the screen. [confirmed, TouchArcade]

## 8. HUD [screenshot]

- **Top left:** population count and a red dragon-alert button.
- **Top:** the tower name, progress bar and a green badge with the tower's number.
- **Top right (iPad):** gold total with a gold coin and a **+** button, and the dragon crystal count with a **teal crystal** icon and a **+** button to buy more. [screenshot, `images/wiki-hunters-lodge-panel.png`]
- **Right column:** settings gear, music, sound, camera (screenshot) and info buttons.
- **Bottom left (iPad):** a treasure-chest button, probably storage or the shop. [inferred]
- **Bottom right:** a blue crystal ball in gold claws, probably the build menu. [inferred]
- **Stone wall:** a numbered plaque on each floor.

## 9. Pacing and known exploits

- **Recruiting takes real time:** 59 s for a Miner and 2m59s for a Blacksmith, shown as a countdown in the room panel. [video]
- Harvest timers vary: food every 30 s, peasants each minute, merchants every 10 min, vassals every hour. A hunter's card in one screenshot shows a 3:00 countdown, which may be a recruit or level timer. [confirmed + screenshot]
- **Clock exploit:** setting the device clock forward completes all pending timers. [confirmed, player guide]
- **Deadlocks:** you can end up needing nails to build the room that makes nails. Crystals are the only way out. [confirmed, 148Apps]
- **Random hunter output:** because the food type is random, you may have to wait a long time for the one type a recruit needs. [confirmed, TouchArcade]

## 9b. Frame-by-frame pass of the gameplay video [video]

The whole 5 min 40 s video was sampled at 720p: one frame every 0.5 s, plus every 0.1 s wherever a menu, pop-up or control was on screen. That's 2,445 frames, 485 of them distinct after removing near-duplicates, and every distinct frame was read. The video covers only the first stretch of **Tower 1**: it goes from 3 floors to 8, and the tower stays at level 1.

### Tutorial quest chain (complete for the video)
The guide says each line below. Rewards are paid when the quest completes.

| # | Quest | Guide's text (abridged) | Reward |
|---|---|---|---|
| 1 | Build a 4th Floor | "Three floors is good, but four floors is even better" | not shown |
| 2 | Build a Logger Lodge | "…to help get a steady supply of building materials" | 20 bread, 40 gold |
| 3 | Recruit a Logger | "…to produce logs, panels and beams" | not shown |
| 4 | Build another Furnace | "Brrrr! The minions need another furnace for warmth. One furnace is needed for every three floors" | 4 meat, 4 fruit ("nice and toasty now") |
| 5 | Build a 5th Floor | "It seems we have run out of room again" | 4 nails, 2 logs ("Remember to build stairs so your minions can get to this floor") |
| 6 | Build a Miner Lodge | "We need stone for our building projects" | 20 bread |
| 7 | Recruit a Miner | "…to produce Stone, Gloves and Rope" | 2 nails, 2 panels |
| 8 | Build a Toilet | "The bushes outside are starting to smell again… 1 toilet for every 8 minions" | 8 bread, 8 fruit |
| 9 | Build a 6th Floor | "According to the plans, this tower should be 10 floors high" | 4 nails, 5 logs |
| 10 | Build an Armory | "…to make some weapons and armor" | 20 bread |
| 11 | Recruit a Blacksmith | "…to make swords, shields and armor" | the video ends here |

### Building floors
- Tap the construction crane on the roof to get a **"Build New Floor?"** pop-up with an Upgrade button.
- Each floor costs gold plus food, and the gold rises with height:

| Floor | Gold | Food |
|---|---|---|
| 4 | 110 | 4 meat, 4 fruit |
| 5 | 120 | 4 meat, 4 fruit |
| 6 | 150 | more food (hard to read) |

### Minion commands and status
- **Tapping a Maid** opens a command pop-up with two orders: **"Empty Toilet"** and **"Light Furnace"**.
- **Tapping a minion who hasn't arrived yet** (for example a Serf) shows an arrival countdown ("6s") with a **"Hurry 1"** button. Hurrying costs 1 dragon crystal.
- **Tapping other minions** shows a thought bubble with their complaint. A Peasant, for example, says **"Yucky toilets!"**.
- The minion list in a room panel shows each minion's current activity:
  - Hunter: "Out hunting"
  - Serf: "Having a good time!", "Hard at work" or "Idling"
  - Maid: "Idling"

### Status-bar messages
These appear along the bottom of the screen:
- "Minion can't get to the toilet": a floor has no stairs connecting it.
- "Jester Club is full!": the club has a capacity limit.
- "No more furnaces to light" / "No more toilets to unclog": shown when a Maid is ordered but there's no work to do.
- "Drag room to an empty spot in the tower": the placement hint.

### Experience and tower level
- The top bar shows the **tower name and an EXP bar**. The EXP count sits under the bar and rose from 47 to 104 over the video.
- A green badge on the right shows the **tower level** (still 1 when the video ends).
- EXP comes from:
  - tapping green orbs: "+1 EXP"
  - **recruiting a minion: "+5 EXP"**
  - collecting resources
- The population count is at top left and rose from 4 to 8.

### Recruit costs and first upgrade bills seen in the video
| Room | Recruit cost | Upgrade to L2 (gold + goods) |
|---|---|---|
| Hunter's Lodge | 10 gold | 210 gold + nails, logs (18), rope |
| Logger's Lodge | 10 food, 20 gold | 200 gold + goods |
| Miner's Lodge | 10 food, 20 gold (then 20 s wait) | 220 gold + stone, nails (10), rope |
| Armory | 10 food, 20 gold | 250 gold + panels, nails (10), stone |
| Shack | 2 food, 2 gold | 100 gold + bread (10), logs (10), rope |
| Maid Quarters | 25 gold | 230 gold + panels, nails (6), hammers (7) |

These costs differ from the fan wiki in places, for example Hunter recruit 10 gold here versus 50 in the wiki. Balance probably changed between versions.

### Crafting tab, complete
The tab lists six rooms:

| Room | Size | Cost |
|---|---|---|
| Workshop | 1x3 | 65 gold, 3 nails, 5 logs |
| Logger's Lodge | 1x3 | 65 gold, 3 nails, 5 stone |
| Miner's Lodge | 1x3 | 75 gold, 4 nails, 2 logs |
| Armory | 1x3 | 80 gold, 4 nails, 5 logs |
| **Magic Lab** | 1x3 | **150 gold, 5 nails, 1 potion**. "Where Alchemists make magical items out of thin air" |
| Hunter's Lodge | not shown | the list scrolls past it |

### What the video never shows
- The **Service** and **Entertain** tabs: the tab buttons appear, but they are never opened.
- The Dwelling tab, the Tower tab below the Infirmary, dragons, ghosts, thieves, guards, mages and jesters. The only exception is the Jester Club room, which is visible.

## 9c. Frame-by-frame pass of the 33-minute 1080p gameplay video [video-hd]

Source: "Pocket Minions – Universal – HD Gameplay Trailer" (https://www.youtube.com/watch?v=YPtWWI89amI), 33 min 30 s of 1080p gameplay on iPad. The whole video was sampled every 0.5 s, plus every 0.1 s around menus and screen changes. That's 14,184 frames, about 1,250 distinct screens, all read. Key frames are saved as `images/hd-*.png` at 732×1000 (game area only). The player's tower is named "Sanuku". The video runs from a new game to tower 1 at 9 floors with the first dragon killed, and the tower is still at level 1.

The official trailer (https://www.youtube.com/watch?v=9NlPObfePEA, 28 s, 360p) was also checked. It's a marketing montage with the captions "Build Your Tower", "Recruit Minions", "Collect Loot!", "Capture Thieves", "Battle Dragons" and "Unclog Toilets?", and ends with "Coming soon to the App Store / www.pocketminions.com". It shows nothing new.

### Opening story (in-game text, `images/hd-intro-story.png`)
You type a name for your tower first. Then an old minion tells a young one a story by the fire:
> Old Minion: "Come sit by the fire and I'll tell you a tale…"
> "Once upon a time… there was a beautiful valley, known as the **Valley of Death**…"
> Young Minion: "*Gulp*"
> "According to legend, the valley contained a **magnificent treasure castle**… and many had tried to reach it."
> "Did they reach the treasure, grandfather?" / "No boy, they didn't. For no one had ever returned from the Valley of Death."
> "What a scary place!"
> "One day a group of homeless minions were picking flowers and looking for mushrooms, when they accidentally wandered into the Valley of Death."
> "Once the Minions realized their awful mistake, they quickly built a castle to hide inside…"

### The complete build menu (all five tabs, read at 1080p)
Costs are gold plus goods, shown as icons, and some small digits are approximate.

**Dwelling** (`images/hd-build-dwelling-tab.png`)
| Room | Size | Card text | Cost |
|---|---|---|---|
| Shack | 1x1 | "A miserable dwelling for Serfs" | 25 gold |
| Inn | 1x2 | "Where peasants gather" | 45 gold, nails, logs |
| Market | 1x2 | "Recruit Merchants here" | 100 gold + goods |
| Vassal Room | 1x2 | "A splendid room for Vassals" | 200 gold + goods |

**Crafting**: Hunter's Lodge, Workshop, Logger's Lodge, Miner's Lodge, Armory and Magic Lab (all 1x3, see §9b).

**Service** (`images/hd-build-service-tab.png`). There are only three rooms:
| Room | Size | Card text | Cost |
|---|---|---|---|
| Maid Quarters | 1x2 | "Recruit Maids here to keep your tower in order" | 75 gold + goods |
| **Mage Quarters** | 1x2 | "**Mages are quite effective at dealing with dragons and ghosts**" | 100 gold, panel, gem |
| **Guard Barracks** | 1x2 | "**Guards will slay dragons and help you catch the occasional thief**" | 100 gold, stone, helmet |

**Entertain** (`images/hd-build-entertain-tab.png`). Four rooms:
| Room | Size | Card text | Cost |
|---|---|---|---|
| Jester Club | 1x1 | "Jester in da house, makin' yo minions laugh" | 100 gold, logs, hammers |
| **Chess Parlor** | 1x1 | "Entertainment for intellectuals" | 100 gold, panels, gems |
| **Pub** | 1x2 | "Where hard-working minions get their cheap beers" | 100 gold + goods |
| **Observatory** | 1x2 | "Star gazing can stimulate the mind" | 300 gold + goods |

**Tower** (`images/hd-build-tower-tab.png`). The full list:
| Room | Size | Card text | Cost |
|---|---|---|---|
| Stairs (Left) / Stairs (Right) | 1x1 | "Narrow, uneven and medieval" | 15 gold |
| Furnace | 1x1 | "You need 1 for every 3 floors" | 20 gold, logs, hammer |
| Toilet | 1x1 | "You need 1 for every 8 minions" | 20 gold, panels, nails |
| Infirmary | 1x1 | "Heals sick or injured minions" | 120 gold, stone, potions |
| **Dungeon** | 1x2 | "**Throw thieves here to be reformed back into productive minions**" | 150 gold, stone, logs |

**Complete room list for tower 1: 25 rooms.** 4 Dwelling, 6 Crafting, 3 Service, 4 Entertain, 6 Tower (counting both stairs), plus the Hunter's Lodge. Later towers might unlock more rooms, but no source shows any.

### Complete minion roster (seen in video)
| Minion | Room | Role |
|---|---|---|
| Serf, Peasant, Merchant, Vassal | Dwelling rooms | Produce gold |
| Hunter, Logger, Miner, Craftsman, Blacksmith, Alchemist | Crafting rooms | Produce goods |
| Maid | Maid Quarters | Ordered to "Empty Toilet" or "Light Furnace" |
| Guard | Guard Barracks | Ordered to "Catch Thief" or "Fight Dragon". Wears the bucket helmet, **so the "Knight" in the key art is the Guard** |
| Mage | Mage Quarters | Fights dragons and ghosts |
| Jester | Jester Club | Entertains |
| Thief | any angry minion | "One of your disgruntled minions has turned into a thief!" |
| Old Minion / Young Minion | intro story | Story characters |
| Guide (white-haired scholar with glasses) | quest pop-ups | Tutorial narrator |

### Quest chain, continued (after "Recruit a Blacksmith")
Build a 7th Floor → Build a Workshop ("…who can make stuff") → Recruit a Craftsman ("…producing Hammers, Nails and Cogs") → Build another Toilet ("Thanks to the new toilet, there's far fewer accidents on the stairs!") → Build the 8th Floor ("Just three more floors to go") → Build a Guard Barracks → **Recruit a Guard** ("Angry minions will occasionally turn into thieves, recruit a guard to catch them!") → **Build a Dungeon** ("No use catching thieves unless we have somewhere to put them") → Build the 9th floor ("Let's see what happens when we build up to 9 stories…") → "Did you hear that shriek? What on earth is happening?" → **Slay the Dragon** ("A dragon is attacking our tower! Send a guard to fight it off before its fiery breath turns your minions into roasted meat!") → "Congratulations! You've slayed your first dragon, now let's build more floors!"

The dungeon quest text also explains what the Dungeon does: "Putting thieves or angry minions into a dungeon will turn them back into productive minions. If that doesn't work, they'll make great Dragon bait."

Tip quests explain two more mechanics:
- **Crystals:** "Did you know that Dragon Crystals are the most magical substance in the realm? You can use them to move rooms, buy materials, or instantly complete production!"
- **Minion handling:** "Pick up and drop a Minion. Did you know you can pick up a minion and drop them anywhere you like?"

### Dragons
- Reaching 9 floors triggers the first dragon (a red and blue wyvern). While it's attacking, the sky darkens and building is blocked: "**Defeat the dragon to continue building your tower!**"
- It spits fireballs that explode on the roof.
- You fight it by tapping a guard and choosing "Fight Dragon". Guards go up to the roof and throw spears at it.
- If you order a fight with no dragon present: "No dragons to fight or can't get to it".

### Other systems seen
- **Quest log** (`images/hd-quest-log.png`), with three sections:
  - CURRENT QUESTS: for example "Learning to build a tower", reward 10 crystals + 100 gold.
  - TO COMPLETE LEVEL
  - COMPLETED QUESTS
  - Each quest shows progress such as "Build Stairs 0/1".
- **Level goal:** the tower's level objective is the quest "Learning to build a tower", which pays **10 dragon crystals + 100 gold**.
- **Pocket Minions Store** (`images/hd-crystal-store.png`): "A Handful of Crystals" 10 for $0.99, "A Pouch of Crystals" 50 + 4 bonus for $4.99, "A Sack of Crystals" 100 + 10 bonus for $9.99, with more packs further down the list.
- **Instant finish:** recruit and production timers can be skipped with "Finish instantly for 1 crystals?" (`images/hd-finish-instantly.png`).
- **Demolish:** "Are you sure you want to demolish this room? You will recoup 1/3 of the resources it cost to build it." (`images/hd-demolish-confirm.png`).
- **Inventory:** a scrollable grid of 3 columns, one slot per good: rope, panel, hammer, log, plank/beam, sword, shield, helmet, potion, meat, bread, wand, and more below (`images/hd-inventory.png`).
- **Room panels:** each shows 1 to 3 stars for the room's level. The Jester Club panel reads "Entertaining your minions" and has a recruit timer with a finish button.
- **More status messages:**
  - "Dungeon is full!"
  - "One of your disgruntled minions has turned into a thief!"
  - "Defeat the dragon to continue building your tower!"
  - "No dragons to fight or can't get to it"
- **Thought bubbles:** a Peasant says "Yucky toilets!" and wears a red angry face.
- **Map screen:** not shown in any video. The "Build Towers" screenshot (`images/store-ipad-5-build-towers.png`) is the only view of the tower map.

## 10. Answers to the open questions (second research pass)

| Question | Answer | Confidence |
|---|---|---|
| What does the **Blacksmith** produce? | **Swords, shields and armor**, working in the Armory | **confirmed by the game's own text** (tutorial quest in the video), plus the fan wiki and shield and helmet bubbles in a Pocket Gamer screenshot |
| What does the **Wizard** produce? | The in-game unit is the **Mage**, recruited from the **Mage's quarters**. It's a **service unit that removes ghosts** and fights dragons, not a producer. The magic goods (potions, wands, gems) come from the **Alchemist** in the **Magic Lab**. | confirmed (guide + wiki) for the roles; that the wizard sprite *is* the mage is inferred |
| What does the **Knight** produce? | **The Knight is the Guard.** The Guard Barracks sprite wears the same bucket helmet, and no separate knight room or unit exists in the complete build menu. Guards "slay dragons and help you catch the occasional thief", and produce nothing. | **confirmed** (1080p video, full build menu) |
| What are the **green orbs**? | **Experience points.** Tapping one in the gameplay video shows "+1 EXP" (`images/video-green-orb-exp.png`). They aren't goods, and they aren't dragon crystals (teal in the HUD). | **confirmed** (video frame) |

## Sources

- Fan wiki, archived Oct 2015: pocketminions.wikia.com. Pages used: Resources, Dwelling, Hunter's Lodge, Inn, Market, Vassal Room, Logger's Lodge, Crafting
- [WP Mobile Game Guides: Pocket Minions tips](https://www.writerparty.com/party/pocket-minions-for-ios-guide-tips-tricks-hints-cheats-and-strategies/)
- [TouchArcade review](https://toucharcade.com/2012/07/23/pocket-minions-review/) and [TouchArcade GDC 2012 preview](https://toucharcade.com/2012/03/13/gdc-2012-a-look-at-tiny-sheep-and-pocket-minions)
- [Pocket Gamer review](https://www.pocketgamer.com/pocket-minions/review/) and [Pocket Gamer launch news](https://www.pocketgamer.com/pocket-minions/keep-your-fingers-a-tapping-and-tower-building-in-ios-sim-pocket-minions/)
- [148Apps review](https://www.148apps.com/pocket-minions/pocket-minions-review/)
- [Gamezebo review](https://www.gamezebo.com/reviews/pocket-minions-review/)
- [Modojo review](https://modojo.com/article/5231/pocket_minions) (archived)
- [Official site mirror](https://d3vdrd4rkk0jpz.cloudfront.net/pocketminions/index.html), the source of the `images/shot-*.jpg` screenshots and the art
- App Store listing id490609532, archived Jan 2016
