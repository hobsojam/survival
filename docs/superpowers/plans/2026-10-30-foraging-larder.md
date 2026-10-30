# Seasonal Foraging, Spoilage, and Camp Stores Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add one forageable food per season, a cooking pot with four dishes, gentle spoilage for fresh food, a larder for food and a woodpile for wood.

**Architecture:** Food moves out of the flat inventory counts into a `FoodStore` (fresh items as lists of picked days, kept items as counts), owned by a new `src/game/food.ts`. That module also owns oldest-first spending, spoilage and what the larder reach means. Seasonal forage spots are ordinary `ResourceNode`s with new kinds, gated by `src/game/forage.ts`. Dishes live in `src/game/cooking.ts`, and the two stores are ordinary `BUILDINGS` entries that need their clearing step's ground. Every task keeps the save validator in step with the state shape. The version goes to 19 once, in Task 1.

**Tech Stack:** TypeScript, Phaser 3 (sprites drawn in code), Vite, Vitest (node, no DOM), oxlint.

**Spec:** `docs/superpowers/specs/2026-10-30-foraging-larder-design.md`

## Global Constraints

- Verify every task with `npm test`, `npm run lint` and `npm run build`. All three must pass before each commit.
- `SAVE_VERSION` becomes **19** in Task 1 and stays 19. Older saves are rejected; there are no migrations.
- Every new item takes one bag space. Stone stays at two. Bag capacity is unchanged (8, or 16 with the crate).
- Fresh foods: berry and greens. Kept foods: hazelnut, honey, pine needles, roasted hazelnuts, trail rations.
- Fresh food is gone at a dawn when it's at least **3 days old in the bag** or at least **5 days old in the larder**, where age is the new day minus the picked day.
- Spoiled food never becomes an item, a pile or an offering. It never touches companion trust, and its message is one plain line.
- Gathering uses the existing gather action (E or a tap, `BALANCE.gatherSeconds`, `BALANCE.gatherEnergyCost`).
- Building uses the existing flow: anywhere in the clearing, `BALANCE.buildSeconds`, `BALANCE.buildEnergyCost`.
- Larder: 5 wood, 2 fiber and 2 stone. It holds 10 food items and needs the `north-near` step cleared.
- Woodpile: 3 wood and 1 fiber. It holds 12 wood and needs the `east-near` step cleared.
- Cooking pot: 2 stone and 1 wood. It's made in the Forest tools panel and needs the toolshed.
- Pot dishes follow the berry rule: after dark, at camp (`isAtCamp`), with a lit fire, taking `BALANCE.cookSeconds`.
- Copy matches the tone of the existing messages: plain, warm, no exclamation marks, no red text or alarm sounds for spoilage.
- Art is drawn in code in the existing palette, through `define(...)` in `src/art/phase3Sprites.ts` (or a sibling file merged into `sprites`). No image files.
- Never add NPCs or trading.

## Review Focus

1. **A full bag at a berry source that adds several items.** That's a summer double pick, the basket's 2, the garden's 2 or the fox's gift. Each picked day must be recorded for exactly the berries that fit, and the bag must never pass capacity. Task 1 pins this.
2. **Spoilage with the survivor away from camp, or asleep through dawn.** The same rule applies in the bag wherever they are, and the larder spoils whether or not anyone is there. The single message still arrives with the morning news after sleep. Tasks 2 and 5 pin this.
3. **Larder food used from outside the clearing.** Eating, cooking, drying, planting and offerings out in the forest or the quarry must never touch the larder. Task 5 pins this.
4. **The winter wolf with an empty bag and a full larder.** It takes nothing, the message says it found nothing, and the larder is untouched. Task 5 pins this.
5. **Forage spots outside their season.** They aren't drawn, can't be tapped, aren't offered by E, and the gather action refuses them, including the shower greens on a dry day. Task 3 pins this.

---

### Task 1: Food stores in the bag (no behaviour change)

Berries and rations move into a `FoodStore`, so that later tasks can add items, ages and a larder. Every existing rule keeps working as before.

**Files:**
- Create: `src/game/food.ts`, `tests/food.test.ts`
- Modify: `src/game/state.ts` (inventory shape, `createGame`), `src/game/camp.ts` (`carriedCount`, `spaceFor`), `src/game/rules.ts`, `src/game/wolves.ts`, `src/game/companion.ts`, `src/game/journalEntries.ts`, `src/game/save.ts`, `src/ui/App.ts`, `src/ui/panels.ts`
- Modify tests that read `inventory.food` or `inventory.trailFood`: `tests/rules.test.ts`, `hud`, `save`, `companion`, `journalEntries`, `garden`, `needs`, and any others `grep -rn "inventory\.\(food\|trailFood\)" tests` finds

**Interfaces:**
- Produces (`src/game/food.ts`):
  ```ts
  export type FreshFood = 'berry' | 'greens';
  export type KeptFood = 'hazelnut' | 'honey' | 'pineNeedles' | 'roastedHazelnuts' | 'trailFood';
  export type FoodItem = FreshFood | KeptFood;
  export const FOOD_ITEMS: readonly FoodItem[]; // in that order: berry, greens, hazelnut, honey, pineNeedles, roastedHazelnuts, trailFood
  export interface FoodStore { berry: number[]; greens: number[]; hazelnut: number; honey: number; pineNeedles: number; roastedHazelnuts: number; trailFood: number }
  export function emptyFood(): FoodStore;
  export function isFresh(item: FoodItem): item is FreshFood;
  export function foodCount(store: FoodStore, item: FoodItem): number;
  export function storeTotal(store: FoodStore): number;
  /** Adds n of an item; fresh items are recorded as picked on `day`. */
  export function addFood(store: FoodStore, item: FoodItem, n: number, day: number): FoodStore;
  /** The food the survivor can reach: the bag only, until Task 5 adds the larder. */
  export function availableFood(state: GameState, item: FoodItem): number;
  /** Spends n of an item from reachable food: fresh oldest-first, kept bag-first. Null if there isn't enough. */
  export function spendFood(state: GameState, item: FoodItem, n: number): GameState | null;
  /** Takes from the bag alone, oldest-first: for the wolf. */
  export function takeFromBag(state: GameState, item: FoodItem, n: number): GameState | null;
  ```
- `GameState.inventory` becomes `{ wood: number; fiber: number; stone: number; food: FoodStore }`. The `food: number` and `trailFood: number` fields go.
- `carriedCount` = wood + fiber + stone × `BALANCE.stoneSpaces` + `storeTotal(food)`. `spaceFor` now takes `'wood' | 'fiber' | 'stone' | 'food'`.

- [ ] **Step 1: Write the failing tests in `tests/food.test.ts`.**
  - `addFood(emptyFood(), 'berry', 2, 5).berry` equals `[5, 5]`. `addFood(emptyFood(), 'hazelnut', 2, 5).hazelnut` equals `2`.
  - `storeTotal` counts every item: 2 berries, 1 greens and 3 rations give 6.
  - `spendFood` on a bag holding berries picked on `[4, 2, 3]`, spending 2, leaves `[4]`, so the two oldest went first. Spending more than is held returns `null`.
  - Review Focus 1: with 7 of 8 spaces used in summer, gathering a berry bush adds one berry, `[day]`, and leaves `carriedCount` at 8. The basket needs 2 free spaces (unchanged rule); with exactly 2 it adds `[day, day]`.
  - The fox's dawn gift and the garden harvest record that dawn's day and the harvest day.
  - The wolf still takes a ration first, then the oldest berry.
- [ ] **Step 2: Run `npx vitest run tests/food.test.ts`.** Expected: FAIL, because `src/game/food.ts` doesn't exist.
- [ ] **Step 3: Implement `src/game/food.ts` and switch every caller.**
  - Change `createGame` to `inventory: { wood: 0, fiber: 0, stone: 0, food: emptyFood() }`.
  - In `rules.ts`, map `NODE_RESOURCE` berry to the food store. Gather, the basket (`visitSite`), `eat`, `eatTrailFood`, `prepareTrailFood`, `cook`, `plantGarden` and `harvestGarden` all go through `addFood` and `spendFood`. Blockers read `availableFood`.
  - `wolfVisit` uses `takeFromBag`. `companion.ts` (WILLING, `makeOffering`, the fox gift) uses `availableFood`, `spendFood` and `addFood`.
  - In the `journalEntries.ts` rules, `bushesFull` and `twoHandfuls` compare berry counts.
  - In `App.ts`, `food-count` and `ration-count` read `foodCount`. Each `[data-supply]` button's disabled check reads a count through a small lookup, with food supplies going through `foodCount`.
- [ ] **Step 4: Update `src/game/save.ts`.**
  - Set `SAVE_VERSION = 19`.
  - `validSurvivor` checks wood, fiber and stone as counts, and `food` with a new `validFood(store, day)`. Every key must be present; fresh lists hold whole days from 1 to today; kept items are counts.
  - Update the doc comment on `validState` to "version 19".
- [ ] **Step 5: Fix the other tests' fixtures** to build food with `addFood`, or set `inventory.food`. Don't change any expected numbers.
- [ ] **Step 6: Run `npm test && npm run lint && npm run build`.** Expected: all pass.
- [ ] **Step 7: Commit.** "Keep berries and rations in a food store that remembers when each berry was picked"

### Task 2: Spoilage at dawn

**Files:**
- Modify: `src/game/food.ts`, `src/game/state.ts` (`lastSpoiled`, BALANCE), `src/game/rules.ts` (`dawn`), `src/game/news.ts`, `src/game/save.ts`, `src/ui/panels.ts` (`bagView`), `src/ui/App.ts`
- Test: `tests/food.test.ts`, `tests/news.test.ts`, `tests/save.test.ts`, `tests/panels.test.ts`

**Interfaces:**
- Consumes: Task 1's `FoodStore`, `FreshFood`.
- Produces:
  ```ts
  // state.ts BALANCE
  bagFreshDays: 3, larderFreshDays: 5,
  // GameState
  lastSpoiled: { day: number; berry: number; greens: number } | null;   // createGame: null
  // food.ts
  export function spoil(store: FoodStore, day: number, keepDays: number): { store: FoodStore; lost: Record<FreshFood, number> };
  export function goingSoft(store: FoodStore, item: FreshFood, day: number, keepDays: number): number; // gone at the next dawn
  export function spoilMessage(before: GameState, after: GameState): string | null;
  ```

- [ ] **Step 1: Write the failing tests.**
  - `spoil(store with berry [1, 2, 3], 4, 3)` loses one berry, leaving `[2, 3]`.
  - `goingSoft(store with berry [1, 2, 3], 'berry', 3, 3)` is `1`.
  - Message copy:
    - 1 berry gives `'A berry had gone soft, so you threw it out.'`
    - 2 berries give `'Two berries had gone soft, so you threw them out.'`
    - 2 berries and 1 greens give `'Two berries and a handful of greens had gone soft, so you threw them out.'`
    - 3 greens give `'Three handfuls of greens had gone soft, so you threw them out.'`
  - `advanceTime` across a dawn with berries picked 3 days earlier removes them and sets `lastSpoiled` to `{ day: <new day>, berry: n, greens: 0 }`. `newsBetween` returns the message once.
  - In winter the same berries still spoil.
  - Review Focus 2: in the quarry at dawn, bag berries still spoil. Sleeping through the dawn (the `sleep` action) yields the spoil line among the morning messages.
  - Anti-goal: after spoilage, `companion.trust` and `lastOffer` are unchanged.
  - `bagView` berry line: `'Berries 3 (1 going soft)'` when one goes at the next dawn, and `'Berries 3'` otherwise.
  - Save: `lastSpoiled` must be null or a lived day with counts summing to at least 1. Anything else is invalid.
- [ ] **Step 2: Run the new tests.** Expected: FAIL.
- [ ] **Step 3: Implement.**
  - `dawn()` spoils `inventory.food` with `BALANCE.bagFreshDays` after the day increments, and sets `lastSpoiled` only when something was lost.
  - `spoilMessage` reports when `after.lastSpoiled?.day` differs from before. Add it to `newsBetween`.
  - Use number words up to ten, then digits.
  - Show the berry line in the Bag panel with `bagView` (a new `berries` field), rendered beside `food-count`.
- [ ] **Step 4: Run `npm test && npm run lint && npm run build`.** Expected: all pass.
- [ ] **Step 5: Commit.** "Let fresh berries go soft after three dawns in the bag"

### Task 3: Seasonal forage spots, raw eating, and the Q order

**Files:**
- Create: `src/game/forage.ts`, `src/art/foodIcons.ts`, `tests/forage.test.ts`, `tests/placement.ts` (holds `PATH_DESTINATIONS` and `segmentDistance`, moved out of `tests/clearing.test.ts`, which then imports them)
- Modify: `src/game/state.ts` (`ResourceKind`, positions, BALANCE), `src/game/rules.ts` (gather, eat, dawn regrowth), `src/game/food.ts`, `src/game/save.ts` (node readyDay ranges), `src/scene/visuals.ts` (hide out-of-season nodes, export `CAMP_STRUCTURES`, node sprites), `src/scene/tapTarget.ts`, `src/scene/prompts.ts`, `src/art/phase3Sprites.ts`, `src/ui/App.ts`, `src/ui/panels.ts`, `src/style.css`
- Test: `tests/forage.test.ts`, `tests/rules.test.ts`, `tests/visuals.test.ts`, `tests/tapTarget.test.ts`, `tests/prompts.test.ts`, `tests/art.test.ts`, `tests/save.test.ts`, `tests/panels.test.ts`

**Interfaces:**
- Consumes: `addFood`, `spendFood`, `availableFood`, `FoodItem`.
- Produces:
  ```ts
  // state.ts
  export type ResourceKind = 'branch' | 'berry' | 'fiber' | 'stone' | 'hazel' | 'pine' | 'greens' | 'honey';
  // node ids: hazel-0..2, pine-0..2, greens-0..4 (greens-3 and greens-4 are the shower patches), honey-0
  // BALANCE: greensHunger 15, hazelnutHunger 15, honeyHunger 20, honeyEnergy 5, roastedHazelnutHunger 50, honeyRegrowDays 3
  // forage.ts
  export const FORAGE: Record<'hazel' | 'pine' | 'greens' | 'honey', { season: Season; item: FoodItem; regrowDays: number }>;
  export const SHOWER_GREENS: readonly string[]; // ['greens-3', 'greens-4']
  /** Whether a node is there to see and gather now: forage kinds only in their season; shower greens only from the start of that day's shower. */
  export function nodeShown(state: GameState, node: ResourceNode): boolean;
  // food.ts
  /** What Q eats: the fresh item nearest to going soft (berry wins a tie), then hazelnut, honey, roasted hazelnuts. Never pine needles or rations. */
  export function quickEatItem(state: GameState): FoodItem | null;
  // rules.ts
  // GameAction 'eat' becomes { type: 'eat'; item?: FoodItem }; without an item it eats quickEatItem.
  // src/art/foodIcons.ts
  export const FOOD_ICONS: Record<'greens' | 'hazelnut' | 'honey' | 'pineNeedles' | 'roastedHazelnuts' | 'pineTea' | 'salad' | 'honeyCake', JournalIcon>;
  export function foodIconUrl(id: keyof typeof FOOD_ICONS): string;
  ```
- Seasons:
  - Hazel: autumn, hazelnut, regrows each dawn.
  - Pine: winter, pine needles, each dawn.
  - Greens: spring, greens, each dawn.
  - Honey: summer, honey, regrows after 3 days (`readyDay = day + 3`).
- Spot placement is up to the implementer, held by the tests in Step 1:
  - 3 hazel spots, each within 1.6 tiles of a wild `treeBroadleaf`
  - 3 pines
  - 2 greens patches within 3 tiles of `SITES.spring`
  - 1 greens patch in the meadow
  - 2 shower greens
  - 1 hollow tree

- [ ] **Step 1: Write the failing tests.**
  - **Placement** (in `tests/forage.test.ts`), for every forage node:
    - at least 1.5 tiles from every other node, every wild tree (hazel at least 0.75 from its host), every clearing step tree and every `CAMP_STRUCTURES` spot
    - at least 1.35 from every path in `PATH_DESTINATIONS` (tile-centred, as in the clearing test), and from the west path line y = 15 for x < 16
    - outside `inClearing(x, y, STEP_IDS)`, and within 11 tiles of the fire
  - **Seasons:**
    - `nodeShown` is true only in the node's season.
    - Shower greens show only on a rain day once `timeOfDay >= rainWindow(day).start`, until that day ends.
    - Gathering a node that isn't shown refuses with `'Move closer to gather.'` (Review Focus 5).
  - **Gathering:**
    - A hazel spot in autumn adds 1 hazelnut and says `'Gathered a hazelnut.'`
    - A pine says `'Gathered a bunch of pine needles.'`
    - Greens say `'Picked wild greens.'` and are recorded with the day.
    - Honey says `'Took a little honey from the hollow tree.'` and isn't back until 3 dawns later.
  - **Eating:**
    - `{ type: 'eat', item: 'greens' }` gives +15 hunger. A hazelnut gives +15. Honey gives +20 hunger and +5 energy.
    - `item: 'pineNeedles'` refuses with `'Pine needles are for tea.'`
    - With an empty bag, refuse with `'No food in your bag.'`
  - **Q order:** with greens picked day 2, a berry picked day 3 and a hazelnut, `quickEatItem` is `'greens'`. With only a hazelnut and honey it's `'hazelnut'`. With only pine needles and a ration it's `null`.
  - **Scene:**
    - Out-of-season nodes are missing from `sceneVisuals`, `pickTapTarget` and `closestGatherable`.
    - Prompts read `'E  Gather hazelnuts'`, `'E  Gather pine needles'`, `'E  Pick wild greens'` and `'E  Take wild honey'`.
    - Every node texture `sceneVisuals` can emit exists in `sprites` (extend the existing art test).
  - **Save:** honey `readyDay` up to today + 3 is valid, and today + 4 is invalid. Other kinds keep today + 1.
- [ ] **Step 2: Run the new tests.** Expected: FAIL.
- [ ] **Step 3: Implement the rules.**
  - Dawn regrowth stays generic: amount 1 when `readyDay <= day`, for every kind except stone.
  - `gather` refuses unshown nodes first, then sets `readyDay` to `day + FORAGE[kind].regrowDays` for forage kinds.
  - `eat` reads per-item effects from one table in `food.ts`:
    - berry: `eatHungerGain`
    - greens: 15
    - hazelnut: 15
    - honey: 20 and 5 energy
    - roasted hazelnuts: 50
  - Messages:
    - `'Ate some berries.'` (unchanged)
    - `'Ate a handful of greens.'`
    - `'Ate a hazelnut.'`
    - `'Ate some honey.'`
    - `'Ate the roasted hazelnuts.'`
  - The Q key and the dock and quick-action Eat buttons send `{ type: 'eat' }`. Rename the Q shortcut label to `Eat`.
- [ ] **Step 4: Draw the node sprites.**
  - `hazelSpot`, `pineForage`, `greensPatch` and `hollowTree`, each with `ready` and `gathered` frames.
  - `hollowTree` also has `bees0` and `bees1` ready frames, animated slowly like the reeds' sway.
  - Map them in `NODE_SPRITES` and `EMPTY_FRAMES`.
- [ ] **Step 5: Add the food icons and the Bag panel cells.**
  - Draw the eight `FOOD_ICONS` (10×10, the `JournalIcon` format), with `foodIconUrl` building a data URL the way `journalIconUrl` does.
  - In the Bag panel, add cells for greens, hazelnuts, honey and pine needles (and roasted hazelnuts, used from Task 4), each with its icon as an `<img>`.
  - Each of those cells shows only while its count is above zero (my call, to keep the bag small). Berries and rations always show.
  - Each edible cell has an Eat button sending `{ type: 'eat', item }`. Pine needles get no button.
- [ ] **Step 6: Update the README.** Cover the new finds in "The seasons", and Q as "Eat" in the controls.
- [ ] **Step 7: Run `npm test && npm run lint && npm run build`.** Expected: all pass.
- [ ] **Step 8: Commit.** "Forage hazelnuts, pine needles, wild greens and honey in their seasons"

### Task 4: The cooking pot and its dishes

**Files:**
- Create: `src/game/cooking.ts`, `tests/cooking.test.ts`
- Modify: `src/game/state.ts` (`progress.potCrafted`, `cakeBonus`, BALANCE), `src/game/rules.ts` (`craftPot`, `cook`, `rest`, `sleep`), `src/game/save.ts`, `src/ui/panels.ts`, `src/ui/App.ts`, `src/scene/visuals.ts`, `src/scene/prompts.ts`, `src/art/phase3Sprites.ts`, `src/style.css`
- Test: `tests/cooking.test.ts`, `tests/panels.test.ts`, `tests/visuals.test.ts`, `tests/save.test.ts`, `tests/prompts.test.ts`

**Interfaces:**
- Consumes: `spendFood`, `availableFood`, `addFood`, `FOOD_ICONS`.
- Produces:
  ```ts
  // cooking.ts
  export type DishId = 'berries' | 'pineTea' | 'salad' | 'roastedHazelnuts' | 'honeyCake';
  export const DISHES: Record<DishId, { name: string; ingredients: Partial<Record<FoodItem, number>>; potOnly: boolean }>;
  export const DISH_ORDER: readonly DishId[]; // berries, pineTea, salad, roastedHazelnuts, honeyCake
  export const POT_COST: { wood: 1; fiber: 0; stone: 2 };
  export function potBlocker(state: GameState): string | null;
  /** Why this dish can't be cooked now, or null. Includes cookBlocker's time/place/fire checks. */
  export function dishBlocker(state: GameState, dish: DishId): string | null;
  /** The dish C cooks: the first in DISH_ORDER with no blocker, or null. */
  export function defaultDish(state: GameState): DishId | null;
  // state.ts
  // progress.potCrafted: boolean (createGame false); GameState.cakeBonus: boolean (createGame false)
  // BALANCE: teaWarmthGain 20, teaEnergyGain 5, saladHungerGain 40, saladEnergyGain 10, honeyCakeHungerGain 60, honeyCakeRestBonus 10
  // rules.ts GameAction: 'cook' becomes { type: 'cook'; dish?: DishId }; new action type 'craftPot'
  ```
- Dishes:

  | Dish | Ingredients | Effect |
  |---|---|---|
  | berries | 1 berry | unchanged |
  | pineTea | 1 pine needles | +20 warmth, +5 energy |
  | salad | 1 greens, 1 berry | +40 hunger, +10 energy |
  | roastedHazelnuts | 2 hazelnuts | +1 roasted hazelnuts in the bag |
  | honeyCake | 1 honey, 1 hazelnut, 1 berry | +60 hunger, and sets `cakeBonus` |

- `cakeBonus` adds 10 energy to the next `rest` or `sleep` (not the spring), then clears.
- Every pot dish except berries needs the pot.

- [ ] **Step 1: Write the failing tests.**
  - **The pot:**
    - `potBlocker` reads `'Build a toolshed first.'` without the toolshed, then `'Return to camp to make the pot.'` outside the clearing.
    - Without 1 wood and 2 stone (stone from the pile counts) it reads `'Need 1 wood and 2 stone for the pot.'`, and once made, `'You already have a cooking pot.'`
    - `craftPot` spends build time and energy and says `'Made a cooking pot. It hangs over the fire on a little tripod.'`
  - **Cooking:**
    - Each dish's effect, exactly as in the table above.
    - Cooking without the pot behaves exactly as before.
    - A pot dish without the pot refuses with `'Make a cooking pot first.'`
    - A dish missing an ingredient refuses with `'You need <list> for <dish name>.'`, for example `'You need 1 greens and 1 berry for greens and berry salad.'`
    - Cooking in daylight refuses with `'Cook after nightfall.'`
  - **Roasting:** roasted hazelnuts with a full bag after paying refuse with `'Make room in your bag for the roasted hazelnuts.'`
  - **The cake bonus:** honey cake, then `rest` at camp, gives the rest's gain + 10 and clears `cakeBonus`. A spring rest leaves it set.
  - **The C key:** with a berry and pine needles, `defaultDish` is `'berries'`. With only pine needles it's `'pineTea'`.
  - **The night panel:** the After dark panel view lists one entry per dish that's possible with the pot, each with `disabled` and `title` from `dishBlocker`.
  - **The pot sprite:** `sceneVisuals` shows a `potTripod` visual over the fire once `potCrafted`.
  - **Save:** `potCrafted` without a toolshed is invalid. `cakeBonus` must be a boolean.
- [ ] **Step 2: Run the new tests.** Expected: FAIL.
- [ ] **Step 3: Implement.**
  - `cookBlocker` stays for the no-pot path. `cook` uses `dish ?? defaultDish(state) ?? 'berries'`, so the old refusal copy still shows when nothing can be cooked.
  - Add the pot row to the Forest tools panel: title "Cooking pot", cost `'1 wood · 2 stone'`, button `data-action="craftPot"`.
  - In the After dark panel, add one button per pot dish (with its food icon) after the pot is made, sending `{ type: 'cook', dish }`.
  - Draw `potTripod` with `still` and `steaming0`/`steaming1` frames (steam only while the fire is lit), above the fire's depth.
  - The prompt at night says `C  Cook <dish name>` for `defaultDish`.
- [ ] **Step 4: Update the README.** Cover the pot and dishes, in a "Cooking" subsection after "Trail rations".
- [ ] **Step 5: Run `npm test && npm run lint && npm run build`.** Expected: all pass.
- [ ] **Step 6: Commit.** "Make a cooking pot for tea, salad, roasted nuts and honey cake"

### Task 5: The larder

**Files:**
- Create: `tests/larder.test.ts`
- Modify: `src/game/state.ts` (`BUILDINGS.larder`, `GameState.larder`), `src/game/food.ts` (reach, spoilage), `src/game/rules.ts` (`buildStatus` / `buildBlocker` ground check, `storeFood` / `takeFood`), `src/game/companion.ts` (wolf offering from the larder), `src/game/save.ts`, `src/scene/visuals.ts`, `src/art/phase3Sprites.ts`, `src/ui/App.ts`, `src/ui/panels.ts`, `src/style.css`
- Test: `tests/larder.test.ts`, `tests/panels.test.ts`, `tests/visuals.test.ts`, `tests/save.test.ts`, `tests/wolves.test.ts`

**Interfaces:**
- Consumes: Tasks 1 and 2 (`FoodStore`, `spoil`, `spendFood`), `CLEARING_STEPS`, `inClearing`, `isInClearing`.
- Produces:
  ```ts
  // state.ts
  larder: { name: 'Larder', description: 'Keep up to 10 food raised off the ground', symbol: '▥', cost: { wood: 5, fiber: 2, stone: 2 }, prerequisite: null, ground: 'north-near' }
  // GameState.larder: FoodStore (createGame emptyFood()); BALANCE.larderCapacity: 10
  // rules.ts
  export type BuildStatus = ... | 'needsGround';
  export function groundBlocker(state: GameState, id: StructureId): string | null; // "Clear the north side's near ground first."
  // GameAction: { type: 'storeFood'; item: FoodItem } | { type: 'takeFood'; item: FoodItem }
  // food.ts
  /** The larder when it is built and the survivor stands in the clearing, else null. */
  export function reachableLarder(state: GameState): FoodStore | null;
  // visuals.ts CAMP_STRUCTURES gains ['larder', 2.5, -4.5], drawn (site or built) only once north-near is cleared
  ```
- Rules:
  - Store moves the bag's **oldest** fresh item (it gets the larder's longer life). Take moves the larder's **freshest** (my calls).
  - Kept items move one at a time.
  - Store refuses with `'The larder is full.'` at 10, and Take with `FULL_BAG_MESSAGE`.
  - Both refuse with `'Return to camp to use the larder.'` outside the clearing, and `'Build a larder first.'` before it's built.

- [ ] **Step 1: Write the failing tests.**
  - **Ground:**
    - Before `north-near` is cleared: `buildStatus` is `'needsGround'`, the build refuses with `"Clear the north side's near ground first."`, and `buildButtonView` reads `verb 'Blocked'` with description `"Clear the north side's near ground first"`.
    - After clearing it builds for 5 wood, 2 fiber and 2 stone.
  - **The spot:**
    - `(campX + 2.5, campY - 4.5)` is inside `inClearing(…, ['north-near'])` but outside the starting ring.
    - It's at least 1.5 from every node (as placed by `placeBranches(createGame().nodes, ['north-near'])`), forage spot and wild tree, and at least 1.35 from every path.
    - It's at least 2 from the other `CAMP_STRUCTURES` spots and the shelter.
  - **Store and Take:** limits and messages as listed. Storing a berry picked day 3 from a bag of `[3, 5]` moves the 3.
  - **Oldest first across both:** a bag with berry `[6]` and a larder with berry `[4]`, eating in the clearing, takes the larder's 4. Kept items come from the bag first.
  - **Review Focus 3:** outside the clearing (say at (5, 5) or in the quarry), `availableFood` ignores the larder. Eating with an empty bag refuses even though the larder is full. Drying, planting, cooking and offerings likewise.
  - **Spoilage:**
    - A berry 4 days old in the larder survives a dawn, and at 5 days it's gone.
    - The larder spoils even when the survivor is in the quarry.
    - The one message covers bag and larder losses together.
  - **Review Focus 4:** a winter night with the fire out, an empty bag and a larder holding a ration and berries: the wolf takes `'nothing'`, and the larder is unchanged.
  - **Wolf offering:** with only a larder ration, standing in the clearing on a winter night, `offerFor` is `'wolf'`. The offering spends the larder ration and counts as the night's visit.
  - **Save:**
    - `larder` holds a valid `FoodStore` with a total of at most 10, and is empty unless `structures.larder`.
    - `structures.larder` is invalid without `north-near` in `clearing.cleared`.
    - `carriedCount` ignores the larder.
- [ ] **Step 2: Run the new tests.** Expected: FAIL.
- [ ] **Step 3: Implement.**
  - Add the `ground` field to `BUILDINGS.larder`.
  - `buildStatus` returns `'needsGround'` after the prerequisite checks. `buildBlocker` checks the ground right after "Already built." `groundBlocker` names the side and step from `CLEARING_STEPS`.
  - `availableFood` and `spendFood` include `reachableLarder`. Fresh items go oldest-first across both, with ties going to the bag. Kept items go bag-first.
  - `dawn()` spoils `state.larder` with `larderFreshDays` and adds its losses to `lastSpoiled`.
  - `WILLING.wolf` and `makeOffering` use `availableFood` and `spendFood` for the ration. `wolfVisit` stays bag-only.
  - `roomLine` already names the larder once it's a known building, so no change is needed there.
- [ ] **Step 4: Draw the larder.**
  - `larderSite` (a flat site) and `larder` with `empty`, `some` and `full` frames: a raised cache on four legs with a little ladder.
  - `some` covers 1 to 6 items, and `full` 7 to 10.
- [ ] **Step 5: Add the UI.**
  - Under the Larder build button, add a `#larder-controls` block, hidden until built. It shows `Stored food n/10`, then one row per food item with `Store 1` and `Take 1` buttons (`data-action="storeFood|takeFood" data-item=…`).
  - A row shows only while that item is in the bag or the larder (my call).
  - The App's click wiring sends `{ type, item }`.
- [ ] **Step 6: Update the README.** Explain the larder in a new "Camp stores" subsection.
- [ ] **Step 7: Run `npm test && npm run lint && npm run build`.** Expected: all pass.
- [ ] **Step 8: Commit.** "Build a larder on the north ground to keep food off the floor"

### Task 6: The woodpile

**Files:**
- Create: `tests/woodpile.test.ts`
- Modify: `src/game/state.ts` (`BUILDINGS.woodpile`, `storedWood`, BALANCE), `src/game/rules.ts`, `src/game/clearing.ts` (`clearGroundBlocker`, `clearGround` payment), `src/game/forecast.ts`, `src/game/save.ts`, `src/scene/visuals.ts`, `src/art/phase3Sprites.ts`, `src/ui/App.ts`, `src/ui/panels.ts`
- Test: `tests/woodpile.test.ts`, `tests/forecast.test.ts`, `tests/save.test.ts`, `tests/panels.test.ts`, `tests/clearing.test.ts`

**Interfaces:**
- Consumes: Task 5's `ground` field and `groundBlocker`.
- Produces:
  ```ts
  woodpile: { name: 'Woodpile', description: 'Keep up to 12 wood split and dry', symbol: '▤', cost: { wood: 3, fiber: 1 }, prerequisite: null, ground: 'east-near' }
  // GameState.storedWood: number (createGame 0); BALANCE.woodpileCapacity: 12
  // rules.ts
  export function availableWood(state: GameState): number;          // bag + woodpile, from anywhere
  export function spendWood(state: GameState, amount: number): GameState; // bag first
  // GameAction types: 'storeWood' | 'takeWood'
  // visuals.ts CAMP_STRUCTURES gains ['woodpile', 5.5, -1.5], drawn only once east-near is cleared
  ```

- [ ] **Step 1: Write the failing tests.**
  - **Ground and building:** the woodpile needs `east-near`, with the same copy pattern as the larder. It builds for 3 wood and 1 fiber.
  - **The spot:** `(campX + 5.5, campY - 1.5)` passes the same checks as the larder's spot, inside `east-near`.
  - **Store and Take:**
    - Store refuses with `'The woodpile is full.'` at 12, and Take with `FULL_BAG_MESSAGE`.
    - Both refuse with `'Return to camp to use the woodpile.'` and `'Build a woodpile first.'`
    - Messages are `'Stacked a log on the woodpile.'` and `'Took a log from the woodpile.'`
  - **Using stored wood:** with 0 wood in the bag and 3 on the woodpile:
    - `stokeFire` at camp works and takes from the woodpile.
    - A build costing 3 wood works.
    - `lookoutRepairBlocker` at the lookout counts the woodpile.
    - `clearGround` counts it.
    - Bag wood is spent first.
  - **Forecast:** `stormReadiness(...).logsShort` counts woodpile wood like carried wood.
  - **Save:** `storedWood` is a count of at most 12, and 0 unless `structures.woodpile`. `structures.woodpile` is invalid without `east-near` cleared.
- [ ] **Step 2: Run the new tests.** Expected: FAIL.
- [ ] **Step 3: Implement.** Replace every wood-sufficiency check that reads `state.inventory.wood` with `availableWood`, and every wood payment with `spendWood`. This covers:
  - `buildStatus`, `missingCost`, `payAndBuild`
  - `axeBlocker`, `pickaxeBlocker`, `potBlocker`, `lookoutRepairBlocker`
  - `clearGroundBlocker`, `stokeFire`, and the forecast's `carried`

  Mirror `stonePileBlocker`, `storeStone` and `takeStone`.
- [ ] **Step 4: Draw the woodpile.**
  - `woodpileSite` and `woodpile`, with `empty`, `some` (1–6) and `full` (7–12) frames: split logs under a little roof.
  - Add `#woodpile-controls` like the stone pile's, reading `Stored wood n/12`. The Bag panel's wood cell shows `+n at camp`, like stone.
- [ ] **Step 5: Update the README.** Add the woodpile to "Camp stores".
- [ ] **Step 6: Run `npm test && npm run lint && npm run build`.** Expected: all pass.
- [ ] **Step 7: Commit.** "Stack wood on a woodpile by the east ground"

### Task 7: The fox's winter hazelnut and the late-autumn warning

**Files:**
- Modify: `src/game/companion.ts`, `src/scene/prompts.ts`, `src/game/news.ts`, `src/game/food.ts` (`keptFoodTotal`), `src/ui/panels.ts` (`forecastView`), `README.md`
- Test: `tests/companion.test.ts`, `tests/prompts.test.ts`, `tests/news.test.ts`, `tests/forecast.test.ts` or `tests/panels.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // companion.ts — OFFER_PROMPT becomes a function
  export function offerPrompt(state: GameState, animal: Friend): string;
  // food.ts
  /** Kept food held, bag and larder together, wherever the survivor is: hazelnuts, honey, pine needles, roasted hazelnuts, rations. */
  export function keptFoodTotal(state: GameState): number;
  // news.ts addition
  export function lateAutumnMessage(before: GameState, after: GameState): string | null;
  ```

- [ ] **Step 1: Write the failing tests.**
  - **The fox:**
    - In winter with a hazelnut (bag, or larder while in the clearing), the fox offering spends a hazelnut, not a berry. `offerPrompt` reads `'Leave a hazelnut for the fox'`, and the message is `'The fox takes the hazelnut, and watches you a while.'`
    - With no hazelnut in winter, it falls back to a berry.
    - Outside winter it always takes a berry, even with hazelnuts.
    - The bird and wolf prompts are unchanged.
  - **The message:** the dawn into autumn day 8 (`daysLeftInSeason === 3`) yields exactly once `"The bushes are thinning. Berries won't keep through the winter; dry some, and gather nuts."`, including after sleep. It doesn't appear on days 9 or 10.
  - **The card on autumn days 8–10** (with no cold night pending):
    - shows, with title `'The bushes will soon be bare'`
    - copy `'Berries go soft in a few days, and the bushes stay bare all winter. Dry rations and gather hazelnuts before the snow comes.'`
    - shelter line becomes `'Food that keeps: <n>'`, from `keptFoodTotal`
    - fire line is empty
  - **Priority:** if a cold night is pending, the cold-night card wins (my call). The winter card is unchanged.
- [ ] **Step 2: Run the new tests.** Expected: FAIL.
- [ ] **Step 3: Implement.** Add `lateAutumnMessage` to `newsBetween`. In `README.md`, change the winter advice to "dry rations and gather nuts before the snow comes", and add the fox's winter hazelnut to "A friend at camp".
- [ ] **Step 4: Run `npm test && npm run lint && npm run build`.** Expected: all pass.
- [ ] **Step 5: Commit.** "Warn of the bare bushes late in autumn, and let the fox take a winter hazelnut"

### Task 8: Year journal entries

**Files:**
- Modify: `src/game/journalEntries.ts`, `src/art/journalIcons.ts`, `src/game/save.ts` (only if a test shows the journal check needs it), `README.md`
- Test: `tests/journalEntries.test.ts`, `tests/journalIcons.test.ts`, `tests/yearJournal.test.ts` (row count 5 → 6)

**Interfaces:**
- Produces: `JournalId` gains `'hazelnuts'` (autumn), `'pineTea'` (winter), `'salad'` (spring) and `'wildHoney'` (summer), each appended last on its season's page.

- [ ] **Step 1: Write the failing tests.**
  - `hazelnuts` is written on the first successful gather of a hazel spot in autumn.
  - `pineTea` on cooking pine tea in winter.
  - `salad` on cooking salad in spring.
  - `wildHoney` on the first honey gathered in summer.
  - Each happens once a year, on its own season's page, and the cooked ones are recorded on `before.day`.
  - Every `JournalId` has a 10×10 icon whose rows use only legend keys (the existing icon test, extended).
  - Each page has 6 rows.
- [ ] **Step 2: Run the new tests.** Expected: FAIL.
- [ ] **Step 3: Implement.**
  - Add the rules.
  - Lines, in the journal's voice:
    - `'Found hazelnuts in the leaf litter.'`
    - `'Pine needle tea, hot in the snow.'`
    - `'Greens and berries, the first salad of spring.'`
    - `'Wild honey from the hollow tree.'`
  - Draw the four icons.
  - Update the README's journal section and its test list (new test files: `food`, `forage`, `cooking`, `larder`, `woodpile`).
- [ ] **Step 4: Run `npm test && npm run lint && npm run build`.** Expected: all pass.
- [ ] **Step 5: Commit.** "Write the year's first hazelnuts, pine tea, salad and honey in the journal"
