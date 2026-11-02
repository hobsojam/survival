# Grain Field and Granary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a four-strip grain field on the south far ground and a granary on the south near ground. With harvest tools and a quern from the workshop, a spring sowing becomes a winter's bread.

**Architecture:**
- A new `src/game/field.ts` owns:
  - the field's saved state: strips, seed and the granary's grain;
  - its stage logic;
  - every field and granary blocker;
  - the field's morning news.
- `rules.ts` gains the action handlers. They follow the beds' pattern: a blocker, then `advanceTime` with `workSeconds`.
- Bread joins the existing food system: flour is kept food and a loaf is fresh food. Spoilage, Q-eating and the food-laid-by line all count it.
- Panels stay in tested view functions in `src/ui/panels.ts`. `App.ts` only adds markup and click wiring.

**Tech Stack:** TypeScript, Phaser 3, Vite, Vitest (node environment), oxlint.

**Spec:** `docs/superpowers/specs/2026-11-02-grain-field-design.md`

## Global Constraints

- Copy is plain, warm and short, with no exclamation marks.
- Art is drawn in code in `src/art/` from the existing palette, with no image files.
- Buildings are `BUILDINGS` entries with `ground`, `prerequisite` and `cost`, sited through `CLEARING_STEPS[step].room` and `CAMP_STRUCTURES`.
- Saves: bump `SAVE_VERSION` from 25 to 26 and add `SAVE_UPGRADES[25]`, which gives every new thing its starting value and removes nothing.
- SonarCloud needs 80% coverage on new code, and `App.ts` is untested. Keep the logic in `src/game/` and `src/ui/panels.ts`.
- Every task ends green on `npm test && npm run lint && npm run build`.
- Balance values (all in `BALANCE`):

| Key | Value | What it is |
|---|---|---|
| `grainPerStrip` | 4 | Grain one threshed strip gives |
| `granaryCapacity` | 16 | One full harvest (4 strips × 4) |
| `grainPerFlour` | 2 | Grain one grind turns into 1 flour |
| `breadHunger` | 50 | Hunger one loaf fills |
| `grainRipeDayOfYear` | 35 | Summer's fifth day (the year runs autumn 1–10, winter 11–20, spring 21–30, summer 31–40) |
| `fieldWorkSeconds` | 12 | Time for one cut or thresh |
| `fieldWorkEnergy` | 8 | Energy for one cut or thresh |

  A full harvest is therefore 16 grain, 8 flour and 8 loaves: 400 hunger against winter's roughly 300.
- `FIELD_STRIPS = 4`. Seed never goes above `FIELD_STRIPS`.

## Review Focus

1. **A full granary at threshing.** The strip still resets and its seed is still kept. Only the grain that doesn't fit is dropped, and the message says the granary is full. *(Task 2 test.)*
2. **Ripe grain left standing into winter and the next spring.** It stays gold and can still be cut. Sowing that strip is refused until it has been cut and threshed. *(Task 2 test.)*
3. **An old save loading.** A version 25 camp loads with no field or granary, an empty field state, a wild grain node, no flour or bread, and `lastSpoiled.bread` set to 0 when `lastSpoiled` exists. *(Task 1 test.)*
4. **A loaf going soft.** It spoils like a berry at `bagFreshDays` in the bag and `larderFreshDays` in the larder, and the morning line names it ("a loaf" / "two loaves"). *(Task 4 test.)*
5. **Baking with a full bag.** The loaf is refused with a room message unless the flour came out of the bag. That follows the same rule as roasted hazelnuts. *(Task 4 test.)*

---

### Task 1: Field state, buildings and save

**Files:**
- Create: `src/game/field.ts`
- Modify:
  - `src/game/state.ts`: `BUILDINGS`, `BALANCE`, `GameState`, `createGame`, `ResourceKind`
  - `src/game/clearing.ts`: the south steps' `room`
  - `src/game/workshop.ts`: `UpgradeId`, `WORKSHOP_UPGRADES`, `UPGRADE_MESSAGES`
  - `src/game/foodStore.ts`, `src/game/food.ts`: types and `FOOD_ITEMS` only
  - `src/game/saveUpgrades.ts`
  - `src/game/save.ts`
- Test: `tests/field.test.ts` (new), `tests/saveUpgrades.test.ts`, `tests/saveFixture.test.ts`

**Interfaces:**
- Produces, in `field.ts`:
  ```ts
  export const FIELD_STRIPS = 4;
  export interface FieldStrip { sownDay: number | null; cut: boolean }
  export interface FieldState { strips: FieldStrip[]; seed: number; grain: number }
  export const emptyField = (): FieldState => ({ strips: Array.from({ length: FIELD_STRIPS }, () => ({ sownDay: null, cut: false })), seed: 0, grain: 0 });
  /** The first day a strip sown on `sownDay` is ripe: summer's fifth day of the same year. */
  export function ripeDay(sownDay: number): number; // (yearOf(sownDay) - 1) * YEAR_LENGTH + BALANCE.grainRipeDayOfYear
  ```
- `GameState.field: FieldState`.
- `BUILDINGS.field`:
  ```ts
  { name: 'Field', description: 'Four strips of grain on the south ground', symbol: '≡', cost: { wood: 4, fiber: 2 }, prerequisite: null, ground: 'south-far' }
  ```
- `BUILDINGS.granary`:
  ```ts
  { name: 'Granary', description: 'Keep a harvest of grain dry on stone legs', symbol: '⌂', cost: { wood: 8, fiber: 2, stone: 4 }, prerequisite: 'field', ground: 'south-near' }
  ```
- `CLEARING_STEPS['south-near'].room = ['granary']` and `CLEARING_STEPS['south-far'].room = ['field']`.
- `UpgradeId` adds `'harvestTools' | 'quern'`:
  - `harvestTools`: `{ name: 'sickle and flail', cost: { wood: 3, fiber: 1, stone: 2 } }`
  - `quern`: `{ name: 'hand quern', cost: { wood: 1, fiber: 0, stone: 4 } }`
  - Messages: `'You made a sickle and a flail. The grain can come in now.'` and `'You made a hand quern. Grain can be ground into flour at the granary.'`
- `upgradeBlocker` adds `'Build the field first.'` (harvestTools) and `'Build the granary first.'` (quern).
- `ResourceKind` adds `'wildGrain'`. `createGame` appends one node, `{ id: 'wildGrain-0', kind: 'wildGrain', x: 26, y: 24, amount: 1, readyDay: 1 }`, as the **last** node, so older saves can append the same one.
- Food types: `FreshFood` adds `'bread'` and `KeptFood` adds `'flour'`. `FoodStore` gains `bread: number[]` and `flour: number`, `emptyFood` sets them, and `FOOD_ITEMS` lists them.
- `GameState.lastSpoiled` becomes `{ day: number; berry: number; greens: number; bread: number } | null`. Until Task 4, the dawn writes `bread: 0`.

Steps:

- [ ] **Step 1: Write failing tests in `tests/field.test.ts`**
  - `createGame().field` equals `emptyField()`, and `structures.field`/`structures.granary` are false.
  - `ripeDay(21) === 35`, `ripeDay(30) === 35` and `ripeDay(61) === 75`.
  - `CLEARING_STEPS['south-far'].room` contains `'field'`, and `'south-near'` contains `'granary'`.
  - `upgradeBlocker` with the workshop built and no field gives `'Build the field first.'` for `harvestTools`. With no granary it gives `'Build the granary first.'` for `quern`.
  - The wild grain node lies outside the clearing with every step cleared: `!inClearing(26, 24, STEP_IDS)`. It is also at least 1.5 tiles from every other node.
- [ ] **Step 2: Write failing save tests**
  - **In `tests/saveUpgrades.test.ts`**, `SAVE_UPGRADES[25]` turns a version 25 state into one with:
    - `structures.field === false` and `structures.granary === false`;
    - `progress.workshop.harvestTools === false` and `progress.workshop.quern === false`;
    - `field` deep-equal to `emptyField()`;
    - the wild grain node appended;
    - `flour: 0` and `bread: []` in both the bag and the larder;
    - `lastSpoiled.bread === 0` when `lastSpoiled` was set, and `null` kept as `null`.
  - **Round trip:** a version 25 save produced by `createGame` and stripped of the new fields loads, via `loadGame`, to a valid state.
  - **Rejected saves:** `loadGame` refuses each of these:
    - a strip with `cut: true` and `sownDay: null`;
    - a strip with `sownDay` later than today;
    - a sown strip without `structures.field`;
    - `seed` of 5;
    - `grain` above `granaryCapacity`;
    - `grain > 0` without the granary;
    - a cut strip whose `ripeDay(sownDay)` is after today;
    - `harvestTools` without the field;
    - `quern` without the granary.
- [ ] **Step 3: Run `npx vitest run tests/field.test.ts tests/saveUpgrades.test.ts`.** Expected: FAIL (missing module or exports).
- [ ] **Step 4: Implement the interfaces above.**
  - **In `save.ts`:**
    - Add `validField(shape)`, checking the cases in Step 2, and add it to `checks`.
    - Extend `validWorkshop` with the two prerequisite rules.
    - Extend `validSpoiled` to need `count(lastSpoiled.bread)` and to count bread in the "at least 1" sum.
    - `validWorld` already compares against `createGame()`, so the new node needs nothing more.
  - **Update the save fixture** in `tests/saveFixture.test.ts` the way the rabbit change did (commit `702467c`).
- [ ] **Step 5: Run `npm test && npm run lint && npm run build`.** Expected: PASS.
- [ ] **Step 6: Commit:** `git commit -m "Add field and granary state, buildings and save version 26"`

---

### Task 2: Sowing, cutting and threshing

**Files:**
- Modify: `src/game/field.ts`, `src/game/rules.ts` (`GameAction`, handlers, `HANDLERS`)
- Test: `tests/field.test.ts`

**Interfaces:**
- Consumes everything from Task 1.
- Produces, in `field.ts`:
  ```ts
  export type StripStage = 'bare' | 'shoots' | 'green' | 'gold' | 'stooks';
  export function stripStage(strip: FieldStrip, day: number): StripStage;
  export function sowStripBlocker(state: GameState, index: number): string | null;
  export function cutStripBlocker(state: GameState, index: number): string | null;
  export function threshStripBlocker(state: GameState, index: number): string | null;
  /** Grain a thresh would add to the granary now: grainPerStrip, or less once the granary nears full. */
  export function threshGrain(state: GameState): number;
  ```
- `stripStage` rules:
  - not sown → `bare`;
  - `cut` → `stooks`;
  - `day >= ripeDay(sownDay)` → `gold`;
  - in summer → `green`;
  - otherwise → `shoots`.
- New `GameAction` members: `{ type: 'sowStrip' | 'cutStrip' | 'threshStrip'; index: number }`.

**Blocker messages, checked in this order:**

Every blocker first checks these three:
1. index invalid → `'That strip is unavailable.'`
2. field not built → `'Build the field first.'`
3. not `isInClearing` → `'Return to camp to work the field.'`

| Check | Sow | Cut | Thresh |
|---|---|---|---|
| Season | not spring → `'Sow the field in spring.'` | — | — |
| Strip state | stooks → `'Thresh that strip before sowing it again.'`; sown → `'That strip is already sown.'` | not gold → `'That strip isn't ripe yet.'` | not stooks → `'Cut that strip before threshing it.'` |
| Seed / tools | seed 0 → `'You have no seed. Gather wild grain at the edge of the clearing.'` | no harvestTools → `'Make a sickle and flail at the workshop first.'` | no harvestTools → same message |
| Granary | — | — | not built → `'Build the granary first.'` |
| Energy | exhausted → `TOO_TIRED_MESSAGE` | same | same |

**Effects:**

| Action | Changes | Time and energy | Message |
|---|---|---|---|
| Sow | `sownDay = state.day`, `seed - 1` | `gatherSeconds` / `gatherEnergyCost` | `'Sowed a strip of grain.'` |
| Cut | `cut = true` | `fieldWorkSeconds` / `fieldWorkEnergy` | `'Cut the strip and stood the sheaves in stooks.'` |
| Thresh | strip reset to `{ sownDay: null, cut: false }`; `grain += threshGrain(state)`; `seed = Math.min(FIELD_STRIPS, seed + 1)` | `fieldWorkSeconds` / `fieldWorkEnergy` | see below |

Thresh messages:
- Full amount stored: `'Threshed the strip. 4 grain went into the granary.'` (use the real number).
- Partly stored: `'Threshed the strip. The granary is full now, and the rest stays as straw.'`
- Nothing stored: `'The granary is already full. You kept the seed, and the rest stays as straw.'`

Steps:

- [ ] **Step 1: Write failing tests** for `stripStage` across a whole year, using a strip sown on day 22:
  - shoots on day 25;
  - green on day 31;
  - gold on days 35 and 45 (winter of the next year still gold);
  - stooks once cut.
- [ ] **Step 2: Write failing blocker tests**, one per row of the table above, each with the exact message.
- [ ] **Step 3: Write failing action tests** through `applyAction`:
  - Sowing spends seed and sets `sownDay`.
  - Cutting a gold strip makes stooks.
  - Threshing with `grain: 14` stores 2, resets the strip, adds seed and gives the "full now" message.
  - Threshing with `grain: 16` stores 0, still resets the strip, keeps the seed and gives the "already full" message. *(Review Focus 1.)*
  - Seed stays at 4 when threshing with seed 4.
  - A strip sown on day 22 and never cut is still gold on day 61 (next spring). `sowStripBlocker` on day 61 refuses with `'That strip is already sown.'`. After cutting and threshing, sowing works. *(Review Focus 2.)*
  - Cut and thresh each take `workSeconds(state, 12)` and 8 energy.
- [ ] **Step 4: Run `npx vitest run tests/field.test.ts`.** Expected: FAIL.
- [ ] **Step 5: Implement** the functions and handlers in `field.ts` and `rules.ts`, then register them in `HANDLERS`.
- [ ] **Step 6: Run `npm test && npm run lint`.** Expected: PASS.
- [ ] **Step 7: Commit:** `git commit -m "Sow, cut and thresh the grain field"`

---

### Task 3: Wild grain seed

**Files:**
- Modify:
  - `src/game/rules.ts`: `gather`, `NODE_RESOURCE`, `GATHER_MESSAGE`
  - `src/game/forage.ts`: `nodeShown`
  - `src/game/field.ts`
- Test: `tests/field.test.ts`

**Interfaces:**
- Produces `export function wildGrainBlocker(state: GameState): string | null` in `field.ts`. It returns `'You have seed enough for the whole field.'` when `seed >= FIELD_STRIPS`, and `null` otherwise.

Steps:

- [ ] **Step 1: Write failing tests:**
  - Gathering `wildGrain-0` in autumn adds 1 to `field.seed`, adds nothing to the bag, spends `gatherSeconds`/`gatherEnergyCost`, sets `readyDay` to tomorrow, and says `'Gathered wild grain: seed for one strip of a field on the south ground.'`.
  - It works with a full bag.
  - It is refused at seed 4 with the blocker message.
  - `nodeShown` is false for the wild grain node in winter, and true in autumn, spring and summer.
  - The node comes back at dawn like other nodes.
- [ ] **Step 2: Run `npx vitest run tests/field.test.ts`.** Expected: FAIL.
- [ ] **Step 3: Implement.**
  - In `gather`, handle `node.kind === 'wildGrain'` before the bag-space check: check `wildGrainBlocker`, then add the seed.
  - `NODE_RESOURCE.wildGrain` and `GATHER_MESSAGE.wildGrain` must exist for the type records. The resource value is unused.
  - In `nodeShown`, hide `wildGrain` in winter.
- [ ] **Step 4: Run `npm test && npm run lint`.** Expected: PASS.
- [ ] **Step 5: Commit:** `git commit -m "Gather wild grain for seed"`

---

### Task 4: Flour, bread and the granary quern

**Files:**
- Modify:
  - `src/game/food.ts`: `isFresh`, `spoil`, `spoilMessage`, `quickEatItem`, `EdibleFood`, `EAT_EFFECTS`, `KEPT_FOODS`
  - `src/game/rules.ts`: the `dawn` spoil totals and the `grindGrain` action
  - `src/game/cooking.ts`: `DishId`, `DISHES`, `DISH_ORDER`, `FOOD_WORDS`, `dishBlocker`, `packDish`, `serveDish`
  - `src/game/field.ts`
  - `src/ui/panels.ts`: `LAID_BY_HUNGER`, `foodLaidByDays`, `BAG_FOODS`, food labels
- Test: `tests/bread.test.ts` (new), `tests/food.test.ts`, `tests/cooking.test.ts`, `tests/panels.test.ts`

**Interfaces:**
- Produces:
  - `export function grindGrainBlocker(state: GameState): string | null` in `field.ts`.
  - The `GameAction` member `{ type: 'grindGrain' }`.
  - `DishId` adds `'loaf'`: `{ name: 'a loaf of bread', ingredients: { flour: 1 }, potOnly: false }`, placed **last** in `DISH_ORDER`.
- `FOOD_WORDS`: `bread: ['loaf', 'loaves']` and `flour: ['flour', 'flour']`.
- `EAT_EFFECTS.bread`: `{ hunger: 'breadHunger', message: 'Ate a loaf of bread.' }`. Flour is not edible.
- `grindGrainBlocker` checks, in this order:

| Condition | Message |
|---|---|
| no granary | `'Build the granary first.'` |
| no quern | `'Make a hand quern at the workshop first.'` |
| not in clearing | `'Return to camp to grind grain.'` |
| `grain < grainPerFlour` | `'There isn't enough grain in the granary to grind.'` |
| no free bag space | `'Make room in your bag for the flour.'` |
| exhausted | `TOO_TIRED_MESSAGE` |

- **`grindGrain`:** `grain -= 2` and 1 flour into the bag, taking `gatherSeconds`/`gatherEnergyCost`. Message: `'You grind a little grain into flour.'`
- **`loaf`:** `packDish` puts 1 bread, picked today, into the bag. `dishBlocker` refuses with `'Make room in your bag for the loaf.'` when the paid state has no free space. `serveDish` leaves the player as they are, with the message `'You bake a loaf on the hot stones by the fire and keep it for later.'`
- **Q-eating:** `quickEatItem` picks the oldest fresh item across berry, greens and bread, with ties going in that order.
- **Food laid by:** `foodLaidByDays` counts flour at `breadHunger` each, plus `Math.floor(field.grain / grainPerFlour) * breadHunger`. Bread is fresh, so it isn't counted.

Steps:

- [ ] **Step 1: Write failing tests in `tests/bread.test.ts`:**
  - **Grind blockers:** one test per row of the table above.
  - **Grind effect:** grain falls by 2 and flour rises by 1.
  - **Baking:** the loaf turns flour into a bread item dated today; it bakes at the campfire without the pot; and it is refused with a full bag of non-flour items. *(Review Focus 5.)*
  - **Eating:** a loaf fills 50 hunger.
  - **Spoilage** *(Review Focus 4)*:
    - A loaf picked on day 1 is gone at the day-4 dawn in the bag, but kept in the larder until the day-6 dawn.
    - `spoilMessage` reads `'A loaf had gone soft, so you threw it out.'` for one and `'Two loaves had gone soft, so you threw them out.'` for two.
    - It joins berries with "and".
  - **Q-eating:** with a bread from day 2 and a berry from day 3, `quickEatItem` returns `'bread'`.
  - **Food laid by:** with 16 grain in the granary, `foodLaidByDays` is 10, the cap. With 4 grain it is 3, since 2 loaves × 50 = 100 and 100 / 30 rounds down to 3.
- [ ] **Step 2: Run `npx vitest run tests/bread.test.ts`.** Expected: FAIL.
- [ ] **Step 3: Implement.**
  - Generalise `spoil` and `spoilMessage` over a `FRESH_FOODS` list.
  - Update the existing food, cooking and panels tests whose exact lists change, the way commit `702467c` did for the rabbit.
- [ ] **Step 4: Run `npm test && npm run lint`.** Expected: PASS.
- [ ] **Step 5: Commit:** `git commit -m "Grind grain into flour and bake bread at the fire"`

---

### Task 5: Morning news and the year journal

**Files:**
- Modify: `src/game/field.ts`, `src/game/news.ts`, `src/game/journalEntries.ts`, `src/art/journalIcons.ts`
- Test: `tests/field.test.ts`, `tests/journalEntries.test.ts`, `tests/journalIcons.test.ts`

**Interfaces:**
- Produces `export function fieldNews(before: GameState, after: GameState): string | null` in `field.ts`, added to `newsBetween`. It gives at most one line per dawn:
  - **First dawn of spring**, when the field is built, `seed > 0` and some strip is bare: `'The ground is soft. Time to sow the field.'`
  - **The dawn into a day that equals `ripeDay` of any uncut sown strip:** `'The grain has turned gold.'`, followed by `' Make a sickle and flail at the workshop to bring it in.'` without harvest tools, or `' It's ready to cut.'` with them.
- New `JournalId`s:
  - `'grainIn'` on the **summer** page: `['Brought the grain in. The granary smells of summer.']`. Noticed on a successful `threshStrip`.
  - `'winterBread'` on the **winter** page: `['Bread from my own field, warm by the fire.']`. Noticed on a successful `cook` of `'loaf'`.
  - `winterCooking` must no longer fire for `'loaf'`.
- Each new id gets a `JOURNAL_ICONS` entry: a sheaf for `grainIn` and a loaf for `winterBread`, in the existing 8-row style.

Steps:

- [ ] **Step 1: Write failing tests:**
  - **Spring line:** shown at the day 20→21 dawn with the field built and seed 2. Not shown with seed 0, and not shown with no field.
  - **Gold line:** shown at the day 34→35 dawn, in both wordings.
  - **No repeats:** neither line appears on any other dawn.
  - **Journal:** `recordJournal` writes `grainIn` on a summer thresh and `winterBread` on a winter loaf. A winter loaf doesn't also write `winterCooking`.
  - **Icons:** the journal icon test passes for the new ids.
- [ ] **Step 2: Run the three test files.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run `npm test && npm run lint`.** Expected: PASS.
- [ ] **Step 5: Commit:** `git commit -m "Field news and journal entries for the harvest and first bread"`

---

### Task 6: Field, granary and workshop panels

**Files:**
- Modify: `src/ui/panels.ts`, `src/ui/App.ts`, `README.md`
- Test: `tests/panels.test.ts`

**Interfaces:**
- Produces, in `panels.ts`:
  ```ts
  export interface StripPanelView { label: string; action: 'sowStrip' | 'cutStrip' | 'threshStrip' | null; verb: string; disabled: boolean; title: string }
  export function fieldPanelView(state: GameState): { shown: boolean; hint: string; strips: StripPanelView[] };
  export function stripMarkup(strip: StripPanelView, index: number): string;
  export function granaryPanelView(state: GameState): { shown: boolean; stored: string; seed: string; grind: { shown: boolean; disabled: boolean; hint: string } };
  ```
- **Strip labels and buttons:**

| Stage | Label | Button |
|---|---|---|
| bare | `Strip N · Bare, ready to sow` (in winter: `Strip N · Bare, resting for winter`) | Sow |
| shoots | `Strip N · Green shoots` | none |
| green | `Strip N · Growing tall` | none |
| gold | `Strip N · Gold, ready to cut` | Cut |
| stooks | `Strip N · Sheaves in stooks` | Thresh |

  A disabled button's `title` is the blocker message.
- **Field hint:** `'Sow in spring, and the grain grows by itself through summer. Once it turns gold, cut it and thresh it. Ripe grain waits for you.'`
  - Without harvest tools, add `' The workshop can make a sickle and flail.'`
  - With seed 0, add `' Wild grain grows at the edge of the clearing.'`
- **Granary text:**
  - `stored`: `'12 of 16 grain'`
  - `seed`: `'Seed for 3 strips'` (`'Seed for 1 strip'`, `'No seed yet'`)
  - The grind row shows once the quern is made, with the blocker message as its hint.
- **`workshopView`:** adds rows for `harvestTools` (shown once the field is built) and `quern` (shown once the granary is built). Copy: `'Cut and thresh the grain field.'` / `'Grind the granary's grain into flour.'`
- **`App.ts`:**
  - On the Camp tab, a field panel (eyebrow `THE SOUTH GROUND`, heading `Grain field`) and a granary panel (heading `Granary`), after the beds panel.
  - Click wiring for `data-action` `sowStrip`, `cutStrip`, `threshStrip` and `grindGrain`, plus two workshop rows. Copy the beds and bed-tools markup and wiring exactly.

Steps:

- [ ] **Step 1: Write failing tests in `tests/panels.test.ts`:**
  - `fieldPanelView` is hidden before the field is built.
  - Each stage gives its label and verb.
  - A gold strip without tools is disabled with the tools message as its title.
  - Both hint additions appear when they apply.
  - `granaryPanelView` gives the stored/seed wording, including singular and none.
  - The grind row is hidden without a quern.
  - `workshopView` shows `harvestTools` only once the field is built, and `quern` only once the granary is built.
  - `stripMarkup` gives a `data-action` and a `data-strip-index` button, and none when the action is null.
- [ ] **Step 2: Run `npx vitest run tests/panels.test.ts`.** Expected: FAIL.
- [ ] **Step 3: Implement the view functions, then the `App.ts` markup and wiring.**
- [ ] **Step 4: Add a `### Grain field and granary` section to `README.md`** after `### The well`, in its style, with the real costs and numbers from this plan. Add "a grain field and granary" to the opening paragraph's list.
- [ ] **Step 5: Run `npm test && npm run lint && npm run build`.** Expected: PASS.
- [ ] **Step 6: Commit:** `git commit -m "Field, granary and harvest tool panels"`

---

### Task 7: Field, granary and wild grain art

**Files:**
- Modify:
  - `src/art/phase3Sprites.ts`: `fieldSite`, `fieldStrip`, `granarySite`, `granary`
  - `src/art/wildlifeSprites.ts` or the file that defines `greensPatch`: `wildGrain`
  - `src/art/foodIcons.ts`: `flour`, `bread`
  - `src/scene/visuals.ts`: `CAMP_STRUCTURES`, `NODE_SPRITES`, `EMPTY_FRAMES`, `builtTexture`, a new `addFieldStrips`
  - `src/scene/prompts.ts`: `wildGrain: 'Gather wild grain'`
  - `src/scene/map.ts`: `TREE_CLEARANCE.wildGrain = 2.5`
  - `src/scene/effectVisuals.ts`: add `'wildGrain'` to `POP_RESOURCES`
- Test: `tests/art.test.ts`, `tests/visuals.test.ts`, `tests/clearing.test.ts` (placement)

**Interfaces:**
- Texture keys:
  - `fieldStrip:{bare|shoots|green|gold|stooks}`, one strip-wide sprite per stage;
  - `fieldSite:still` and `granarySite:still`;
  - `granary:{empty|some|full}`, using `stockFrame(field.grain)`;
  - `wildGrain:{ready|gathered}`.
- `CAMP_STRUCTURES` adds `['granary', 3.5, 4.5]` and `['field', 0, 7.5]`. Once built, the field is drawn as 4 strips side by side, the way `addVegetableBeds` draws the beds. Spacing is the builder's call. Both positions must pass the existing placement and path tests. If they don't, move them inside the cleared south ground and keep the field furthest out.
- **Sprite style:**
  - **Strips:** furrowed earth, rows of shoots, tall green stalks, gold heads, and a row of little stooks.
  - **Granary:** a raised timber store on stone legs with a thatched roof, with sacks showing at the door as it fills.
  - **Wild grain:** a tuft of pale seed heads.
  - Everything is edged in dark wood, like the well, so it reads against bare earth.

Steps:

- [ ] **Step 1: Write failing tests:**
  - `sceneVisuals` draws `fieldSite:still` on cleared south far ground with no field.
  - It draws four `fieldStrip:` visuals whose stages follow `stripStage` once built.
  - It draws `granary:some` with 5 grain.
  - It draws `wildGrain:ready` in autumn and nothing in winter.
  - Every new texture key resolves in the sprite registry (the existing art test pattern).
  - The new food icons exist.
- [ ] **Step 2: Run `npx vitest run tests/visuals.test.ts tests/art.test.ts`.** Expected: FAIL.
- [ ] **Step 3: Implement the sprites and visuals.**
- [ ] **Step 4: Run `npm test && npm run lint && npm run build`.** Expected: PASS.
- [ ] **Step 5: Browser check at desktop size** (about 1280×800), using a save edited to each state.
  - Check the field site, then the strips at each stage and the stooks.
  - Check the granary when empty and when full, the wild grain tuft, both panels, the workshop rows, and baking and eating a loaf.
  - Screenshot each, and fix anything unreadable against the ground or the season palettes.
- [ ] **Step 6: Commit:** `git commit -m "Draw the grain field, granary and wild grain"`

---

## Final check

- [ ] `npm test && npm run lint && npm run build` is green.
- [ ] Push `agent/grain-field` and open a PR to `main`, with the spec and plan linked in the description.
