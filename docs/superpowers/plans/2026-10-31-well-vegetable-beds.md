# The Well and Vegetable Beds Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three vegetable beds on the west near ground and a well on the west far ground. Crops grow over a few watered days and dry out over days without water. One bucket from the well waters every bed, and the harvest feeds a new vegetable stew.

**Architecture:** A new module, `src/game/beds.ts`, owns the beds: crop names, sow and harvest, the daily growth and drying update called from `dawn`, and the watering check. Each bed has one fixed crop: bed 0 is potatoes, bed 1 beans, bed 2 carrots. Every harvest yields one kept food item, `vegetables`, so the bag and larder gain a single item rather than three. The well is an ordinary building, and `drawWater` is one action. The stew takes its water from the well being built, so there's no water item.

**Tech Stack:** TypeScript, Phaser 3 (code-drawn sprites), Vite, Vitest (node), oxlint.

**Spec:** `docs/superpowers/specs/2026-10-31-homestead-buildings-design.md`, "Project 2: The well and the vegetable beds".

## Global Constraints

- Every task passes `npm test`, `npm run lint` and `npm run build` before committing.
- **Save version:** `SAVE_VERSION` goes from 21 to **22** in Task 1 and stays there. There are no migrations.
- **The beds:**
  - `BUILDINGS.vegetableBeds = { name: 'Vegetable beds', description: 'Three raised beds for potatoes, beans and carrots', symbol: '▦', cost: { wood: 6, fiber: 2 }, prerequisite: null, ground: 'west-near' }`
  - **Spot:** offset **(-4.5, 0)**, which is (15.5, 15).
  - Three beds, with crops fixed by index: `BED_CROPS = ['potatoes', 'beans', 'carrots'] as const`.
- **The well:**
  - `BUILDINGS.well = { name: 'Well', description: 'Draw water for the beds and the pot', symbol: '◉', cost: { wood: 2, fiber: 0, stone: 6 }, prerequisite: 'vegetableBeds', ground: 'west-far' }`
  - **Spot:** offset **(-7, -1.5)**, which is (13, 13.5).
- **Seeds:** an empty bed can always be sown, at no cost. The seed is the bed's own, kept through every harvest and every withering.
- **Growing:**
  - `BALANCE.cropGrowDays = 3`. A crop is ripe once it has grown on 3 days.
  - `BALANCE.cropYield = 2`. A harvest gives 2 `vegetables` and empties the bed.
  - Sowing works in spring, summer and autumn.
- **Watering:**
  - A bed's day counts as watered if the player drew water that day, or if it rained that day (`rainWindow(day) !== null`).
  - At each dawn, each sown bed that isn't ripe is updated from the day just ended:
    - if that day was watered: `dryDays = 0`, and the bed grows 1 day
    - if not: `dryDays += 1`; the bed still grows if `dryDays <= 2`, stops growing at 3, and at **4** withers (the bed empties; the seed is kept)
- **Ripe crops** never dry out or wither while waiting to be harvested.
- **Winter:** the dawn update is skipped when the day just ended was in winter. Growing beds pause, keeping their growth and dryness, and carry on in spring.
- **Vegetables** are kept food. They don't spoil, take 1 bag space each, and can be stored in the larder. Eaten raw they give `BALANCE.vegetableHunger = 20` hunger, with the message `'Ate some raw vegetables.'`.
- **Vegetable stew:**
  - It's a pot dish: `stew: { name: 'vegetable stew', ingredients: { vegetables: 2 }, potOnly: true }`.
  - It also needs the well built. Otherwise it's refused with `'Build the well to cook stew.'`.
  - It gives `BALANCE.stewHungerGain = 55` hunger and `BALANCE.stewWarmthGain = 15` warmth.
  - Its message is `'You simmer a vegetable stew. It fills you up and warms you through.'`.
- **Copy** is plain and warm, with no exclamation marks. **Art** is drawn in code in the existing palette, and anything that must read against the camp's bare earth is edged in dark wood.

## Review Focus

1. **A ripe crop left for days**, including over winter. It stays ripe, never dries out or withers, and harvests normally. Task 1 pins this.
2. **A bed growing when winter starts.** Neither growth nor dryness changes through winter. In spring it carries on from the same numbers. Task 1 pins this.
3. **Harvesting with too little room in the bag.** The harvest is refused with `'Make room for 2 vegetables before harvesting.'` and the bag never overfills. Task 1 pins this.
4. **Sleeping through several days at once.** If several dawns pass in one `advanceTime`, each dawn is applied in turn: a bed left dry from day 1 withers at the fourth dawn, not before. A rain day in between resets its dryness. Task 1 pins this.
5. **Drawing water twice in a day, or on a day it has already rained.** It's refused and nothing changes. Task 2 pins this.

---

### Task 1: The vegetable beds

**Files:**
- Create: `src/game/beds.ts` and `tests/beds.test.ts`
- Modify:
  - `src/game/state.ts` (BUILDINGS, BALANCE, `GameState.beds`, createGame)
  - `src/game/food.ts` and `src/game/foodStore.ts` (the `vegetables` kept food and its eat effect)
  - `src/game/rules.ts` (`sowBed`/`harvestBed` actions; call the beds' dawn update from `dawn`)
  - `src/game/save.ts`
  - `src/scene/visuals.ts` (CAMP_STRUCTURES; three bed visuals)
  - `src/art/phase3Sprites.ts` (`vegetableBedsSite`, `vegBed`)
  - `src/ui/panels.ts` and `src/ui/App.ts` (a beds panel in the Camp tab beside the berry garden; a vegetables cell in the bag)
  - `README.md`
  - existing tests that pin the food item list, the structures list or `SAVE_VERSION`

**Interfaces:**
- Produces, in `src/game/beds.ts`:
  ```ts
  export const BED_CROPS: readonly ['potatoes', 'beans', 'carrots'];
  export type Crop = (typeof BED_CROPS)[number];
  export interface Bed { sown: boolean; grown: number; dryDays: number; wateredDay: number | null }
  export type BedStage = 'empty' | 'sprout' | 'growing' | 'ripe';
  export type BedSoil = 'fresh' | 'dry' | 'wilted' | 'frost';
  export function bedStage(bed: Bed): BedStage;            // empty; sprout grown 0; growing 1..cropGrowDays-1; ripe >= cropGrowDays
  export function bedSoil(state: GameState, bed: Bed): BedSoil; // frost in winter when sown; dry at dryDays 2; wilted at 3; else fresh
  export function wateredOn(state: GameState, bed: Bed, day: number): boolean; // bed.wateredDay === day || rainWindow(day) !== null
  export function bedsDawn(next: GameState, endedDay: number): void; // mutates next.beds per the Global Constraints
  export function sowBedBlocker(state: GameState, index: number): string | null;
  export function harvestBedBlocker(state: GameState, index: number): string | null;
  export function witheredMessage(before: GameState, after: GameState): string | null;
  ```
- Produces in state: `GameState.beds: Bed[]` (createGame: 3 × `{ sown: false, grown: 0, dryDays: 0, wateredDay: null }`), and the BALANCE values `cropGrowDays: 3`, `cropYield: 2` and `vegetableHunger: 20`.
- Produces in rules: GameAction `{ type: 'sowBed'; index: number }` and `{ type: 'harvestBed'; index: number }`.
- Produces: the `vegetables` FoodItem, a KeptFood.

- [ ] **Step 1: Write the failing tests in `tests/beds.test.ts`.**
  - **Building:**
    - `BUILDINGS.vegetableBeds` is exactly the Global Constraints value.
    - It refuses before `west-near` is cleared, and builds for 6 wood and 2 fiber after.
  - **The spot** at (15.5, 15), in the shape of `tests/house.test.ts`'s spot tests:
    - It's inside `['west-near']` and outside the starting ring.
    - The footprint corners (cx ± 1.25, cy - 0.9) and (cx ± 1.25, cy + 0.2) are inside `['west-near']` with 0.3 tiles to spare.
    - It's at least 1.5 tiles from nodes placed for `['west-near']`, wild trees and other steps' trees.
    - It's at least 1.35 tiles from paths, and at least 2 from the shelter and every other `CAMP_STRUCTURES` spot.
  - **Sowing:**
    - The blockers, in order:
      - `'That bed is unavailable.'` for a bad index
      - `'Build the vegetable beds first.'`
      - `'Return to camp to tend the beds.'` outside the clearing
      - `'The beds rest in winter. Sow again in spring.'`
      - `'That bed is already growing.'`
      - `TOO_TIRED_MESSAGE`
    - Sowing bed 2 gives `{ sown: true, grown: 0, dryDays: 0, wateredDay: null }` and the message `'Sowed the carrots.'`, and spends the garden's plant time and energy.
  - **Growing:**
    - Across one dawn after a day watered by `wateredDay`, `grown` rises by 1 and `dryDays` resets to 0.
    - Across one dawn after a rain day with no watering, the same happens.
    - Unwatered dawns give `dryDays` 1, 2, 3 and 4, with `grown` rising on the first two, not on the third, and the bed empty after the fourth.
    - `witheredMessage` across that fourth dawn is `'The carrots withered in the dry. You saved the seed.'`.
  - **Review Focus 1:** a ripe bed left unwatered for 6 dawns, and then through a whole winter, is still ripe with `dryDays` 0.
  - **Review Focus 2:** a bed with `grown` 1 and `dryDays` 2 on the last autumn day keeps exactly those numbers through every winter dawn. It then carries on at the first spring dawn.
  - **Review Focus 4:** one `advanceTime` spanning 4 dry days from sowing withers the bed at the fourth dawn and not earlier. With a rain day as the second day, the bed doesn't wither.
  - **Harvesting:**
    - `'That bed is not ready yet.'` before it's ripe.
    - Review Focus 3: a bag with fewer than 2 free spaces is refused with `'Make room for 2 vegetables before harvesting.'` and the state is unchanged.
    - A ripe harvest adds 2 `vegetables` to the bag, empties the bed, and says `'Harvested the potatoes.'` for bed 0.
  - **Eating:** `vegetables` can be eaten from the bag or the larder for 20 hunger, with the message `'Ate some raw vegetables.'`.
  - **Display:**
    - `bedStage` and `bedSoil` give the documented values.
    - With the beds built, the scene places three `vegBed` visuals, each with a texture named for its crop, stage and soil (for example `vegBed:carrots-growing-dry`).
  - **Save:**
    - Version 22 is accepted, and 21 is rejected.
    - `beds` must be an array of exactly 3 well-formed beds.
    - `grown` must be between 0 and `cropGrowDays`, `dryDays` between 0 and 3, and `wateredDay` null or a day no later than the current day.
    - A sown bed without `structures.vegetableBeds` is invalid.
- [ ] **Step 2: Run `npx vitest run tests/beds.test.ts`.** Expected: FAIL.
- [ ] **Step 3: Implement the state, the rules and the save checks.**
  - `bedsDawn` runs in `dawn` (rules.ts) for the day that is ending, before `next.day` is incremented, or with the ended day passed in.
  - The withered message comes through the same route as the other dawn messages: find where `wolfMessage` and the spoil message are shown, and add `witheredMessage` beside them.
- [ ] **Step 4: Draw the art and build the UI.**
  - **`vegBed` sprite:** a small raised bed, about 14×12, edged in dark wood. Draw a frame for every crop × stage × soil combination:
    - empty: bare soil
    - sprout: two pale green dots
    - growing and ripe: potato leaves, bean poles with pods, or feathery carrot tops
    - soil: dark when fresh, pale and cracked when dry, with drooping leaves when wilted, and white-flecked when frost
  - **Placing the beds:** draw the three beds at x offsets -0.9, 0 and +0.9 tiles from the spot, with `vegetableBedsSite` before they're built.
  - **Beds panel:** in the Camp tab, under the berry garden, a "Vegetable beds" panel lists each bed. Each line reads, for example, `Carrots · Growing · Dry, water soon`. Each bed has a Sow or Harvest button.
    - Status words: `Empty, ready to sow`, `Sprouting`, `Growing`, `Ready to harvest`.
    - Soil words: `Dry, water soon`, `Wilting, water today`, `Resting under the frost`.
  - **Bag:** add a vegetables cell with an Eat button.
- [ ] **Step 5: Update the README.** Cover the beds, the crops, watering by rain, drying and withering, and the seed being kept. Add `beds` to the test list.
- [ ] **Step 6: Run `npm test && npm run lint && npm run build`.** Expected: all pass.
- [ ] **Step 7: Commit.** Use the message "Grow potatoes, beans and carrots in raised beds on the west ground".

### Task 2: The well and the vegetable stew

**Files:**
- Create: `tests/well.test.ts`
- Modify:
  - `src/game/state.ts` (`BUILDINGS.well`, BALANCE stew values)
  - `src/game/beds.ts` (`drawWaterBlocker`)
  - `src/game/rules.ts` (`drawWater` action)
  - `src/game/cooking.ts` (the `stew` dish)
  - `src/game/save.ts` (only if the well needs a check beyond the generic ground and prerequisite ones)
  - `src/scene/visuals.ts` (CAMP_STRUCTURES)
  - `src/art/phase3Sprites.ts` (`wellSite`, `well`)
  - `src/ui/panels.ts` and `src/ui/App.ts` (Draw water in the beds panel; a stew dish button)
  - `README.md`

**Interfaces:**
- Consumes from Task 1: `Bed`, `wateredOn`, `GameState.beds`, the `vegetables` FoodItem, and the beds panel.
- Produces:
  ```ts
  export function drawWaterBlocker(state: GameState): string | null; // in beds.ts
  // GameAction: { type: 'drawWater' }
  // DishId gains 'stew'; DISH_ORDER appends it
  ```
  Also BALANCE `stewHungerGain: 55` and `stewWarmthGain: 15`.

- [ ] **Step 1: Write the failing tests in `tests/well.test.ts`.**
  - **Building:**
    - `BUILDINGS.well` is exactly the Global Constraints value.
    - It refuses without `west-far` cleared, and without the beds.
    - It builds for 2 wood and 6 stone.
  - **The spot** at (13, 13.5), with the same checks as the beds:
    - it's inside `['west-near', 'west-far']` but not `['west-near']`
    - the footprint corners (cx ± 0.6, cy - 1.3) and (cx ± 0.6, cy + 0.2) have 0.3 tiles to spare
    - it keeps the same clearances, including at least 2 from the beds' spot
  - **Drawing water:**
    - The blockers, in order:
      - `'Build the well first.'`
      - `'Return to camp to draw water.'`
      - `'The beds are resting for winter.'`
      - `'Nothing in the beds needs water.'`, when no sown bed is unripe
      - `'The beds are already watered today.'`, when every unripe sown bed has `wateredDay === day`
      - `'The rain has watered the beds today.'`, when it's a rain day and the rain has started (`timeOfDay >= rainWindow(day).start`)
      - `TOO_TIRED_MESSAGE`
    - Success sets `wateredDay = day` on every sown, unripe bed and says `'You draw a bucket and water the beds.'`. It spends the gather time and energy.
    - Review Focus 5: a second draw the same day is refused with the state unchanged.
    - A watered bed then grows at the next dawn.
  - **Stew:**
    - Without the well, `dishBlocker(state, 'stew')` is `'Build the well to cook stew.'`.
    - With the well, the pot and 2 vegetables, at home or camp at night by a lit fire, cooking stew spends 2 vegetables. It adds 55 hunger and 15 warmth, both capped at 100, with the exact message.
    - Missing vegetables gives the standard `You need 2 vegetables for vegetable stew.`.
    - The dish button appears with the other pot dishes.
- [ ] **Step 2: Run `npx vitest run tests/well.test.ts`.** Expected: FAIL.
- [ ] **Step 3: Implement.**
  - **`well` sprite:** about 20×24. A round stone well with a small wooden roof, a crank and a bucket, edged in dark wood. Add a `wellSite`.
  - **Draw water button:** in the beds panel, showing the blocker as a hint when it's refused.
  - **Stew button:** with the other pot dishes, following `nightDishMarkup`.
- [ ] **Step 4: Update the README.** Cover the well, drawing water, and the stew in the dish list.
- [ ] **Step 5: Run `npm test && npm run lint && npm run build`.** Expected: all pass.
- [ ] **Step 6: Commit.** Use the message "Draw water at a well for the beds and a vegetable stew".
