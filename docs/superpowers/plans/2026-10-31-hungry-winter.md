# A Hungry Winter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:**
- Starving makes the survivor sick, and an untended sickness ends the run.
- Ice fishing at the frozen Quiet spring is a rescue that always works.
- The game warns that winter is coming.
- The survivor visibly shows cold, hunger, tiredness and sickness.
- Death ends with a gentle card and a journal download.

**Architecture:**
- **Sickness (`src/game/sickness.ts`):** pure rules on a new `GameState.sickness` record. They're fed by `advanceTime` (counting starvation and draining the survivor), by the cook, rest and sleep handlers (marking warm food and warm rest), and by `dawn` (judging the day).
- **Death:** sets `GameState.ending`. After that, every action is refused and time stops.
- **Fishing (`src/game/fishing.ts`):** a `fish` action whose chance roll comes in on the action, so the rules stay pure and tests pick the outcome.
- **UI:** the warning, the visuals and the ending are view functions plus small tested DOM helpers, with one-line calls in `App.ts`.

**Tech Stack:** TypeScript, Phaser 3 (sprites drawn in code), Vite, Vitest (node), oxlint.

**Spec:** `docs/superpowers/specs/2026-10-31-hungry-winter-design.md`

**Commits:** the user asked to approve each commit. Stop at every commit step and ask.

## Global Constraints

- **Getting sick:** the survivor falls sick once hunger has sat at **zero for 240 game seconds** in a row. Any hunger above zero resets the count.
- **While sick:** energy and warmth drain on top of hunger's existing effects. Eating doesn't cure it.
- **Judging the day:** at each dawn, if the survivor was already sick when the day just ended began, that day is judged:
  - **Cared-for:** the survivor had a warm meal **and** a warm rest that day.
  - Otherwise it's **uncared-for**.
  - **2 cared-for days**, in any order, make the survivor well.
  - **3 uncared-for days** end the run at that dawn.
  - The two counts are kept separately, and whichever total is reached first decides.
- **A warm meal:** any dish served by cooking except roasted hazelnuts, which are packed for later, not eaten. That includes pine needle tea and cooked fish. Raw food never counts.
- **A warm rest:** a rest or a sleep taken while the fire is burning. In the house, that's at home with the fireplace's `fuelLeft > 0`. Otherwise it's at camp (`isAtCamp`) with `fireFuel > 0`.
- **The rescue is never refused for weakness.** Being hungry, starving, sick or exhausted must never stop any of these:
  - walking, gathering wood or fiber
  - making the fishing line, fishing
  - feeding the fire, cooking, eating
  - resting, sleeping

  Weakness may only lengthen the time an action takes.
- **Fishing:**
  - **When and where:** in winter only, at the Quiet spring (`SITES.spring`), with a fishing line.
  - **The line:** 1 wood and 1 fiber, made in the clearing. No toolshed needed.
  - **Odds:** about one go in three misses, never more than two in a row. The third try always catches.
- **Fish:** a new **kept** food (see Task 2's ruling).
  - **Raw:** 10 hunger.
  - **Cooked at the fire:** 45 hunger. It's the dish `fish`, not pot-only, and follows the existing cooking rules: after nightfall, at a lit fire.
- **The winter warning:**
  - **The day pill** shows `Winter in 3 days`, then `Winter in 2 days`, then `Winter in 1 day`, with a snowflake, during autumn's last three days.
  - **The forecast card** shows the winter card. The cold-night card still shows when a cold night is due.
  - **A food line on both:** while it's late autumn, both cards carry `Food laid by: enough for N of 10 days`. N counts kept food in the bag and the larder, at 30 hunger a day.
- **The ending:**
  - **The card:** `Your survivor's story ended on the 6th day of winter, in their first year.`, then a summary line.
  - **Two buttons:** **Download your journal** (plain text) and **Begin again**.
  - **The save is removed**, and an ended state is never saved.
- **Copy:** plain and warm, with no exclamation marks, and never "Game over".
- **Saves:** `SAVE_VERSION` goes from 23 to 24, with one upgrade step `23`. Tasks 1 and 2 both add to that same step, since the branch hasn't shipped.
  - `tests/fixtures/save-v23.json` must keep loading.
  - An upgraded camp has no sickness, no line and no fish.
- **Coverage:** the SonarCloud gate needs 80% coverage on new code. Keep DOM work out of `src/ui/App.ts`, in tested helpers that take a `find` function (see `src/ui/showPanels.ts`).
- **Checks:** every task passes `npm test`, `npm run lint` and `npm run build` before committing.

## Review Focus

1. **The whole rescue from rock bottom:** winter, no food, sick, energy 0, warmth low. Make the line, walk to the spring, fish (miss, miss, catch), walk home, cook after nightfall, eat, then rest or sleep by the lit fire. The survivor gets well after two such days. Task 2 pins this as one end-to-end test.
2. **Doing nothing kills.** A starving survivor left alone in winter, with no actions and only time passing, reaches `ending` within 5 days, and no earlier than 3 days. Task 1 pins this.
3. **Dying in the night.** A `sleep` that crosses the fatal dawn ends the run. Every later action is refused with `Your story has ended.`, and `advanceTime` returns the same state. Task 1 pins this.
4. **Near misses that must not count as care:**
   - eating raw food
   - roasting hazelnuts for later
   - resting with the fire out
   - the part of the day when sickness began

   Task 1 pins the first three. Task 2 pins cooked fish counting.
5. **An ended camp must not come back.** Saving an ended state removes the save. Loading after that finds no save, so the start screen offers a fresh camp. Task 1 pins this.

---

### Task 1: Sickness and the end of the run

**Files:**
- Create: `src/game/sickness.ts`, `tests/sickness.test.ts`
- Modify:
  - `src/game/state.ts`: add the `GameState` fields, their defaults in `createGame`, and the `BALANCE` values
  - `src/game/rules.ts`:
    - `advanceTime`: call `sicknessTick` each step
    - `dawn`: call `judgeSickDay`
    - `applyAction`: refuse every action once `ending` is set
    - `rest` and `sleep` handlers: `markWarmRest`
  - `src/game/cooking.ts`: `serveDish` marks the warm meal through `markWarmMeal`
  - `src/game/needs.ts`: a `sick` alert with its message
  - `src/game/save.ts`: validation for the new fields; `saveGame` removes the save for an ended state
  - `src/game/saveUpgrades.ts`: `SAVE_VERSION = 24`, step `23`
  - `tests/saveUpgrades.test.ts`, `tests/saveFixture.test.ts`: these need no changes beyond what the version bump requires

**Interfaces:**
- Produces:
  - `GameState.sickness: { starvedSeconds: number; sick: boolean; sickFromDay: number | null; cared: number; uncared: number; ateWarm: boolean; restedWarm: boolean }`
  - `GameState.ending: { day: number } | null`
  - In `sickness.ts`:
    - `export function sicknessTick(next: GameState, step: number): void` (mutates the working copy, like the rest of `advanceTime`)
    - `export function judgeSickDay(next: GameState, endedDay: number): void`
    - `export function markWarmMeal(state: GameState): GameState`
    - `export function markWarmRest(state: GameState): GameState`, which marks only when `isWarmRestHere(state)`
    - `export function isWarmRestHere(state: GameState): boolean`
    - `export const isSick = (state: GameState): boolean`
  - `export const ENDED_MESSAGE = 'Your story has ended.'`
  - In `BALANCE`:
    - `starvedSecondsToSicken: 240`
    - `sickEnergyDrainPerSecond: 0.1`
    - `sickWarmthDrainPerSecond: 0.05`
    - `sickDaysToRecover: 2`
    - `sickDaysToDie: 3`

- [ ] **Step 1: Write the failing tests in `tests/sickness.test.ts`**
  - **Falling sick:**
    - a survivor at hunger 0 for 239 game seconds is not sick
    - at 240 seconds they are, with `sickFromDay` set to that day
    - hunger rising above 0 at 200 seconds resets `starvedSeconds` to 0
  - **The message:** the need alert reads `"You've gone too long without food, and you're falling ill."`
  - **Draining:** over 10 seconds a sick survivor loses `10 * sickEnergyDrainPerSecond` more energy, and `10 * sickWarmthDrainPerSecond` more warmth, than a well one in the same spot.
  - **Eating doesn't cure:** eating a berry while sick raises hunger, and `sick` stays true.
  - **Judging at dawn:**
    - A day with `ateWarm` and `restedWarm` counts `cared`; a day missing either counts `uncared`. Both flags reset at dawn.
    - Two cared-for days make the survivor well, with `sickness` back to its default.
    - Three uncared-for days set `ending: { day }` to the day that ended.
    - With `cared: 1, uncared: 2`, one cared-for day makes the survivor well, and one more uncared-for day ends the run.
  - **The first day doesn't count:** the dawn after the day sickness began judges nothing, and both counts stay 0.
  - **Warm food:**
    - serving `berries` or `pineTea` sets `ateWarm`
    - roasting hazelnuts doesn't
    - eating raw (`eat`) doesn't (Review Focus 4)
  - **Warm rest:**
    - resting at camp with `fireFuel > 0` sets `restedWarm`
    - resting at camp with the fire out doesn't
    - in the house, resting at home with the fireplace burning does
  - **Review Focus 2:** a starving survivor in winter, with no food, at camp, left to `advanceTime` alone. Their `ending` is null after 3 game days and set within 5.
  - **Review Focus 3:**
    - a `sleep` from nightfall that crosses the fatal dawn sets `ending`
    - every action afterwards returns `{ state: same object, message: 'Your story has ended.' }`
    - `advanceTime(ended, 100)` returns the same object
  - **Saves:**
    - a v23 save upgrades with the default `sickness` and `ending: null`
    - a sickness with negative counts is rejected as invalid
    - Review Focus 5: `saveGame` of a state with `ending` set removes `SAVE_KEY`, returns `{ ok: true }`, and a later `loadGame` gives `{ kind: 'empty' }`

- [ ] **Step 2: Run `npx vitest run tests/sickness.test.ts`.** Expected: it fails because the module is missing.

- [ ] **Step 3: Implement it.**
  - `sicknessTick` runs after hunger is updated in each step: it counts starvation, sickens, and applies the drains.
  - `judgeSickDay(next, next.day)` runs at the top of `dawn`, before `next.day += 1`.
  - Once `ending` is set, `advanceTime` stops stepping, and `applyAction` refuses before dispatch.

- [ ] **Step 4: Run `npm test && npm run lint && npm run build`.** Expected: all pass, including the fixture tests.

- [ ] **Step 5: Ask the user, then commit:** `Let starving make the survivor sick, and an untended sickness end the run`

### Task 2: Ice fishing at the Quiet spring

**Ruling to state in the commit message and the ledger:** fish is a **kept** food (counted like hazelnuts), not fresh. Fresh food needs pick-day arrays, spoil reports and a `lastSpoiled` shape change. A fish from a frozen spring keeping through the cold is also believable. The spec marked "fish goes soft" as Claude's call, so this changes Claude's call, not the user's.

**Files:**
- Create: `src/game/fishing.ts`, `tests/fishing.test.ts`
- Modify:
  - `src/game/foodStore.ts`: `fish: number`
  - `src/game/food.ts`:
    - add `fish` to `KeptFood` and `FOOD_ITEMS`
    - `EAT_EFFECTS.fish`: `fishHunger`, with the message `'Ate the raw fish. It barely helps.'`
    - `quickEatItem` never picks fish
  - `src/game/cooking.ts`:
    - the dish `fish`: `{ name: 'a fish', ingredients: { fish: 1 }, potOnly: false }`, first in `DISH_ORDER`
    - its blocker checks nightfall, the fire and the fish, never the pot or a berry
    - served, it gives `cookedFishHunger` hunger and `cookWarmthGain` warmth, with the message `'You cook the fish over the fire. A warm, filling meal.'`
    - add fish to `FOOD_WORDS` as `['fish', 'fish']`
  - `src/game/state.ts`:
    - `progress.fishingLine: boolean`
    - `GameState.fishingMisses: number`
    - in `BALANCE`: `fishHunger: 10`, `cookedFishHunger: 45`, `fishingSeconds: 45`, `fishingWeakFactor: 1.5`, `fishingMissChance: 1 / 3`, `fishingMaxMisses: 2`
  - `src/game/rules.ts`: the `makeFishingLine` and `fish` actions
  - `src/game/sitePrompt.ts`: at the spring in winter, the prompt is `E Fish through the ice` with the line, or `Make a fishing line to fish here` without it
  - `src/scene/GameScene.ts`: at the spring, E or a tap sends `springAction(state, Math.random())`
  - `src/ui/panels.ts`:
    - add `fish` to `BAG_FOODS`: `{ item: 'fish', label: 'Fish', eat: 'Eat a raw fish' }`
    - add `fish: 'Fish'` to `LARDER_LABELS`
    - a `fishingLineView(state): ActionPanelView`, in the same shape as the woven pack's
  - `src/ui/App.ts`: the fishing line row in the Forest tools panel, through `renderActionPanel`
  - `src/game/save.ts`, `src/game/saveUpgrades.ts`: the same step `23` also adds `fishingLine: false`, `fishingMisses: 0`, and `fish: 0` in both the bag's and the larder's food stores

**Interfaces:**
- Consumes: `markWarmMeal`, `isSick` (Task 1)
- Produces:
  - `GameAction` gains `{ type: 'makeFishingLine' }` and `{ type: 'fish'; roll: number }`. The roll is in [0, 1); anything else is refused as `'That action is not available yet.'`.
  - In `fishing.ts`:
    - `export function fishingLineBlocker(state: GameState): string | null`
    - `export function fishingBlocker(state: GameState): string | null`
    - `export function fishingSecondsFor(state: GameState): number`
    - `export function springAction(state: GameState, roll: number): GameAction`, which gives `fish` in winter with a line, otherwise `visitSite`

- [ ] **Step 1: Write the failing tests in `tests/fishing.test.ts`**
  - **The line:**
    - It's made in the clearing for 1 wood and 1 fiber, with the message `'You twist fiber into a line and tie it to a stick.'`
    - Refusals, in order:
      - `'You already have a fishing line.'`
      - `'Return to camp to make the fishing line.'`
      - `'Need 1 wood and 1 fiber for a fishing line.'`
    - It's still made at energy 0 while sick.
  - **Fishing refusals, in order:**
    - `'There is nothing like that here.'` (in the quarry)
    - `'Walk to the quiet spring to fish.'`
    - `'The spring only freezes in winter.'`
    - `'Make a fishing line first.'`
    - `'Make room in your bag for a fish.'`
  - **Never refused for weakness:** fishing works at energy 0, hunger 0, while sick.
  - **The catch:**
    - with roll 0.5 and no misses, it catches: the bag gains one fish, `fishingMisses` is 0, and the message is `'You break the ice and wait. A fish takes the line.'`
    - roll 0.1 misses: `fishingMisses` is 1, and the message is `'You wait by the hole in the ice, but nothing bites.'`
    - after two misses, roll 0 still catches
  - **Time:** a go takes `fishingSeconds`, or `fishingSeconds * fishingWeakFactor` when tired, hungry or sick.
  - **Eating fish:**
    - raw, it gives 10 hunger, and `quickEatItem` never picks it
    - cooking after nightfall with only a fish gives +45 hunger and sets `ateWarm` (Review Focus 4)
  - **`springAction`:** gives `fish` with the roll in winter with a line, and `visitSite` otherwise.
  - **Saves:**
    - `fishingMisses` survives `saveGame` then `loadGame`
    - a v23 save upgrades with no line and no fish
  - **Review Focus 1:** one test, starting in winter from a camp with no food: sick, energy 0, warmth 15, wood and fiber in the bag. In order, all through `applyAction`:
    1. make the line
    2. walk to the spring with `move` steps
    3. fish with rolls 0, 0, 0: miss, miss, catch
    4. walk back
    5. wait to nightfall with `rest`, feeding the fire
    6. cook the fish
    7. sleep in the shelter with the fire lit

    Repeat for a second day, with a fish caught the same way. The survivor is well after the second dawn, and `ending` stays null.
  - **The panel:** `fishingLineView` shows ready with materials in the clearing, then `Made` afterwards.

- [ ] **Step 2: Run `npx vitest run tests/fishing.test.ts`.** Expected: it fails because the module is missing.

- [ ] **Step 3: Implement it.**
  - **Scene art:** a small line held over the hole while fishing, reusing the `gather` pose timing if no new frames are drawn.
  - **Fish art:** a fish icon in the bag cell, in the style of the other forage cells.

- [ ] **Step 4: Run `npm test && npm run lint && npm run build`.** Expected: all pass.

- [ ] **Step 5: Ask the user, then commit:** `Fish through the ice at the quiet spring in winter`

### Task 3: The winter warning

**Files:**
- Modify:
  - `src/ui/calendarView.ts`: `DayPillView.winterIn: string`; `renderDayPill` writes it into a new `#day-winter` span and hides the span when the text is empty
  - `src/ui/App.ts`: add the `#day-winter` span to the pill's markup
  - `src/ui/panels.ts`:
    - `ForecastView.food: string`
    - `lateAutumnForecast` becomes the winter card
    - the cold-night card carries `food` in late autumn
    - `export function foodLaidByDays(state: GameState): number`
  - `src/ui/App.ts`: a `#forecast-food` line in the forecast card, set from `view.food` and hidden when empty
  - `src/style.css`: style `.day-winter` and `#forecast-food` like the existing `.day-cold` and forecast check lines
- Test: `tests/calendarView.test.ts`, `tests/panels.test.ts`

**Interfaces:**
- Consumes: `fish` as a kept food (Task 2)

- [ ] **Step 1: Write the failing tests**
  - **`dayPillView(...).winterIn`:**
    - `'Winter in 3 days'` on autumn's 8th day
    - `'Winter in 2 days'` on the 9th
    - `'Winter in 1 day'` on the 10th
    - `''` on autumn's 7th day and in winter
  - **`renderDayPill`** with a fake root shows the span with the text, and hides it when the text is empty.
  - **`foodLaidByDays`:**
    - hunger value of every kept item in the bag and the larder, divided by 30, rounded down, capped at 10
    - fish counts at `cookedFishHunger`
    - pine needles count 0
    - fresh food counts 0
    - examples: 2 trail rations and 1 hazelnut give 3; 20 rations give 10
  - **The winter card** in late autumn with no cold night due:
    - title `'Winter is coming'`
    - copy `'The bushes stay bare all winter. Lay by food that keeps: dry rations and gather hazelnuts. The quiet spring freezes in winter, and a fishing line could see you through.'`
    - `food` reads `'○ Food laid by: enough for 3 of 10 days'`, or `'✓ Food laid by: enough for 10 of 10 days'`
  - **With a cold night due in late autumn:** the cold-night card shows with `food` set. Outside late autumn, `food` is `''`.

- [ ] **Step 2: Run the two test files.** Expected: the new tests fail.

- [ ] **Step 3: Implement it.**

- [ ] **Step 4: Run `npm test && npm run lint && npm run build`.** Expected: all pass.

- [ ] **Step 5: Ask the user, then commit:** `Warn that winter is coming, on the day pill and the forecast card`

### Task 4: Showing how the survivor feels

**Files:**
- Modify:
  - `src/scene/survivorVisual.ts`:
    - `SurvivorVisualState.sick: boolean`
    - `SurvivorVisual` gains `effect: SurvivorEffect | null` and `puff: 'breath' | 'cough' | null`
  - `src/art/survivor.ts`: new `sick0` and `sick1` frames (a pale face, a hand at the mouth), plus their pack twins
  - `src/scene/GameScene.ts`: pass `sick`; apply `effect` to the sprite each frame; emit small puffs
- Test: `tests/survivorVisual.test.ts` (existing)

**Interfaces:**
- Consumes: `isSick` (Task 1)
- Produces:
  - `export type SurvivorEffect = 'shiver' | 'sway' | 'hunch' | 'droop'`
  - `export function needLook(state: SurvivorVisualState): { effect: SurvivorEffect | null; puff: 'breath' | 'cough' | null; idle: 'sick' | 'shiver' | 'tired' | 'hungry' | null }`

- [ ] **Step 1: Write the failing tests**
  - **`needLook`, which leads with the most serious state (sick, then cold, then tired, then hungry):**
    - sick and cold: `{ effect: 'sway', puff: 'cough', idle: 'sick' }`
    - cold only: `{ effect: 'shiver', puff: 'breath', idle: 'shiver' }`
    - tired only: `{ effect: 'droop', puff: null, idle: 'tired' }`
    - hungry only: `{ effect: 'hunch', puff: null, idle: 'hungry' }`
    - well: all null
  - **`selectSurvivorVisual`:**
    - while moving, it keeps the walking texture and carries the leading `effect` and `puff`. Today it carries none, which is the regression this pins.
    - while idle and sick, the texture is `survivor:sick0` or `survivor:sick1`
    - with the pack, it's `survivor:sick0Pack`
  - **The art:** every texture name `selectSurvivorVisual` can return exists in the survivor sheet. If a test already checks this, extend it to `sick`.

- [ ] **Step 2: Run `npx vitest run tests/survivorVisual.test.ts`.** Expected: the new tests fail.

- [ ] **Step 3: Implement it.** The scene applies each effect to the sprite (exact values are the builder's choice, from the spec):
  - **shiver:** ±1 px horizontal jitter at about 12 Hz
  - **sway:** ±0.06 rad rotation over 1.6 s
  - **hunch:** +1 px lower, with a slower walk bob
  - **droop:** the head dips every 2 s
  - **puffs:** every 1.5 s, a small fading white (breath) or grey-cream (cough) circle near the head

- [ ] **Step 4: Run `npm test && npm run lint && npm run build`.** Expected: all pass.

- [ ] **Step 5: Ask the user, then commit:** `Show cold, hunger, tiredness and sickness on the survivor, even while walking`

### Task 5: The ending

**Files:**
- Create:
  - `src/ui/ending.ts`: `endingView`, `endingMarkup`, `showEnding`
  - `src/ui/download.ts`: `downloadText`
  - `tests/ending.test.ts`
- Modify:
  - `src/ui/yearJournal.ts`: `export function journalText(state: GameState): string`
  - `src/ui/App.ts`:
    - when `state.ending` is set: show the card, stop saving, wire the two buttons
    - **Begin again** reuses the existing new-game flow
  - `src/scene/GameScene.ts`: on `ending`, show the survivor lying down (a new `survivor:lying` frame in `src/art/survivor.ts`) and fade the camera over about 2.5 s
  - `src/style.css`: the card reuses the `.lookout-ending` and `.start-card` styles
  - `README.md`: document sickness, fishing, the winter warning and the ending

**Interfaces:**
- Consumes: `GameState.ending` (Task 1)
- Produces:
  - `export function endingView(state: GameState): { title: string; summary: string }`
  - `export function downloadText(doc: { createLink(href: string, name: string): { click(): void }; urlFor(text: string): string; release(url: string): void }, name: string, text: string): void`
  - App passes a thin adapter over `Blob`, `URL.createObjectURL` and an `<a download>`

- [ ] **Step 1: Write the failing tests in `tests/ending.test.ts`**
  - **`endingView`:**
    - for `ending.day` the 46th day, the title is `"Your survivor's story ended on the 6th day of winter, in their first year."`
    - year two gives `in their second year`
    - day 21 gives `the 1st day of spring`
    - the summary reads `46 days lived · 12 buildings raised · a friend in the fox`, built from the actual counts, and leaves out the friend when there's none
  - **The ordinals:** use 1st, 2nd, 3rd, 4th up to 10th; years first, second, third, fourth, fifth, then `year 6`.
  - **`endingMarkup`:** contains `id="download-journal"`, `id="begin-again"` and `role="dialog"`, and no "Game over".
  - **`showEnding`** with a fake `find` fills the title and summary and unhides the card.
  - **`journalText`:** one heading per page written so far, such as `Autumn, year one`, then a line per entry such as `Day 2 · The first leaves came down over camp.` Written pages only; blank pages are skipped.
  - **`downloadText`:** with a fake doc, it makes one link named `hearthwild-journal.txt` from the text's URL, clicks it, and releases the URL.

- [ ] **Step 2: Run `npx vitest run tests/ending.test.ts`.** Expected: it fails because the module is missing.

- [ ] **Step 3: Implement it.**

- [ ] **Step 4: Run `npm test && npm run lint && npm run build`.** Expected: all pass.

- [ ] **Step 5: Browser check** at 1280×800 and at a 390×844 phone size, using crafted saves in a scratchpad script. Check, with no console errors:
  - the day pill and the winter card in late autumn
  - fishing at the frozen spring: miss, then catch
  - cooking a fish
  - the sick sway and the cold shiver, both while walking
  - the ending card after letting a sick survivor sleep through the fatal dawn
  - the journal download
  - after Begin again, a reload shows no old camp

- [ ] **Step 6: Ask the user, then commit:** `End the run gently when sickness wins, with the journal to keep`
