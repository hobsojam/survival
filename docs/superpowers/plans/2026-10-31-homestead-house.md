# The House Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The survivor builds a house on the cleared north-far ground and moves in. The shelter becomes a woodshed, and a fireplace that feeds itself from the wood store takes over every job the campfire does now.

**Architecture:** A new module, `src/game/home.ts`, owns "living in the house":
- `livesInHouse` (true once the house is built)
- `isAtHome` (near the house, or near the fire before the house)
- `warmFuel` (whichever fire keeps the survivor warm)
- `woodStoreCapacity`
- the nightly fireplace draw

Every rule that today reads `isAtCamp` and `fireFuel` for warmth, sleep, rest, cooking, wolves, storms, the bird's alarm, the forecast and the journal reads these instead. That way a player who has no house sees no change at all. The house and woodshed are drawn in code like every other building.

**Tech Stack:** TypeScript, Phaser 3 (code-drawn sprites), Vite, Vitest (node), oxlint.

**Spec:** `docs/superpowers/specs/2026-10-31-homestead-buildings-design.md`, "Project 1: The house".

## Global Constraints

- Every task passes `npm test`, `npm run lint` and `npm run build` before committing.
- **Save version:** `SAVE_VERSION` goes from 20 to **21** in Task 1 and stays there. Old saves are rejected, and there are no migrations.
- **The house:**
  - `BUILDINGS.house = { name: 'House', description: 'A home with a fireplace of its own', symbol: '⌂', cost: { wood: 12, fiber: 6, stone: 8 }, prerequisite: 'shelterFinished', alsoRequires: 'bed', ground: 'north-far' }`
  - It takes **twice the standard build time** (`BALANCE.houseBuildSeconds = 24`) at the standard energy cost.
  - **Spot:** offset **(4.5, -6.5)** from the fire, which is (24.5, 8.5).
- **Moving in** happens the moment the house is built. "Lives in the house" means `state.structures.house === true`, with no separate flag. The build message is exactly: `"You carry your bed into the house. The fireplace inside will keep you warm now, and the campfire is yours to light whenever you like."`
- **The woodshed:**
  - Once the house stands, the shelter is drawn as a woodshed on the same spot.
  - The single wood store (`storedWood`) holds `woodpileCapacity` (12) if the woodpile is built, plus `BALANCE.woodshedCapacity` (**24**) if the house is built.
  - Store and Take work if either is built.
- **The fireplace:**
  - Its fuel is `fireplaceFuel` (seconds, starts at 0).
  - It burns **only at night**, at 1 per second, or `coldNightFireBurn` on a freezing night. Rain doesn't speed it up.
  - It never burns in daylight. Whatever fuel is left over is banked until the next night.
  - Whenever it's night and `fireplaceFuel` is 0, it takes **one log from `storedWood`** (never from the bag) and adds `BALANCE.fireplaceSecondsPerWood` (**200**, against the stone hearth's 150). It keeps doing this until the store runs out.
  - It burns wherever the survivor is.
- **Feeding the fireplace by hand** means storing wood in the wood store from the bag. There's no separate stoke action for it. *(The spec's "add wood by hand from the bag, as a fallback" is met this way.)*
- **Stargazing** already works anywhere in the clearing (`stargazeBlocker`) and doesn't change.
- **Home:**
  - With the house, `isAtHome` means `area === 'camp'` and within `BALANCE.homeRadius` (**2.5**) of the house spot.
  - Without the house, `isAtHome(state) === isAtCamp(state)`.
- **The campfire:**
  - It stays fully usable: Feed fire, the stone hearth bonus, light and sound.
  - A lit campfire still warms a survivor standing at camp.
  - Once the survivor lives in the house, nothing requires the campfire.
- **No house, no change:** with no house, every existing behaviour and test is unchanged.
- **Copy** is plain and warm, with no exclamation marks. **Art** is drawn in code in the existing palette.

## Review Focus

1. **A winter night with an empty wood store, living in the house.**
   - The fireplace goes out, and the wolf rules apply exactly as they do to a dead campfire today.
   - The status line says the fireplace is out.
   - Nothing crashes or goes negative.
   - Task 2 pins this.
2. **Sleeping in the house with the campfire unlit.**
   - Warmth holds through the night on the fireplace.
   - The wake message never says "The fire burned out in the night" because of the campfire.
   - It says so about the fireplace only if the fireplace really did go out.
   - Task 2 pins this.
3. **Away from home at night, for example in the quarry, with the house built.**
   - The fireplace still burns and draws logs.
   - The survivor gets no warmth from it.
   - Task 2 pins this.
4. **A save holding 13–36 stored wood.**
   - It loads with the house and woodpile built.
   - It's invalid without the house.
   - A nonzero `fireplaceFuel` without the house is invalid.
   - Task 1 pins this.
5. **A player with no house.**
   - Every existing test passes unchanged, apart from fixture version numbers.
   - The fire status line, sleep, rest and cooking messages are word-for-word what they are today.
   - Both tasks keep the existing suite green without editing existing assertions.

---

### Task 1: Build the house, and the shelter becomes a woodshed

**Files:**
- Create: `src/game/home.ts` and `tests/house.test.ts`
- Modify:
  - `src/game/state.ts` (BUILDINGS, BALANCE, GameState, createGame)
  - `src/game/rules.ts` (build time and message for the house; storeWood/takeWood blockers and capacity)
  - `src/game/save.ts`
  - `src/scene/visuals.ts` (CAMP_STRUCTURES; the shelter → woodshed texture)
  - `src/art/phase3Sprites.ts` (`houseSite`, `house`, `woodshed`)
  - `src/ui/panels.ts` and `src/ui/App.ts` (wood store line shows `Stored wood n/cap`)
  - `README.md`
  - existing tests that pin the structures list or `SAVE_VERSION`

**Interfaces:**
- Produces, in `src/game/home.ts`:
  ```ts
  export const HOUSE_SPOT: { x: number; y: number };          // { x: campX + 4.5, y: campY - 6.5 }
  export function livesInHouse(state: GameState): boolean;    // state.structures.house
  export function woodStoreCapacity(state: GameState): number; // (woodpile ? woodpileCapacity : 0) + (house ? woodshedCapacity : 0)
  ```
- Produces in state:
  - `GameState.fireplaceFuel: number`, with createGame setting it to 0.
  - `BALANCE` values: `houseBuildSeconds: 24`, `woodshedCapacity: 24`, `fireplaceSecondsPerWood: 200`, `homeRadius: 2.5`.
- Produces in visuals: `CAMP_STRUCTURES` gains `['house', 4.5, -6.5]`.
- Produces in art: `house` frames `dark` and `lit` (Task 2 picks between them), and `woodshed` frames `empty`, `some` and `full`, chosen with `stockFrame(storedWood)`.

- [ ] **Step 1: Write the failing tests in `tests/house.test.ts`.**
  - **Definition:** `BUILDINGS.house` is exactly the Global Constraints value.
  - **What's needed before you can build:**
    - The house refuses to build before `north-far` is cleared, using `groundBlocker`'s message for that step.
    - It refuses without `shelterFinished`, and without `bed`, through `buildStatus`/the build action's existing prerequisite messages.
  - **Building it:**
    - With everything in place, building spends 12 wood, 6 fiber and 8 stone, from the bag first and then the stores.
    - It advances time by `workSeconds(state, 24)`.
    - It returns the exact moving-in message.
  - **The spot**, at (24.5, 8.5), in the same shape as the fibre stack's tests in `tests/fibreStack.test.ts:63-82`:
    - It's inside `['north-near', 'north-far']` but not inside `['north-near']`.
    - It's at least 2 tiles from nodes placed for `['north-near', 'north-far']`, from wild trees, and from every other step's trees.
    - It's at least 1.6 tiles from paths (`segmentDistance`).
    - It's at least 2.5 tiles from the shelter (campX - 3, campY - 2) and from every other `CAMP_STRUCTURES` spot.
  - **The wood store:**
    - `woodStoreCapacity` is 0 with neither store built, 12 with the woodpile only, 24 with the house only, and 36 with both.
    - `storeWood` refuses with `'The wood store is full.'` at capacity.
    - With only the house built, Store and Take work.
    - With neither built, they refuse with `'Build a woodpile first.'`, unchanged.
  - **The woodshed sprite:**
    - With the house built, the shelter's texture is `woodshed:<stockFrame(storedWood)>`.
    - Without the house, it's the existing `shelter:...` texture.
    - Test this through whatever function `src/scene/visuals.ts` builds the camp visuals with.
  - **Save:**
    - Version 21 is accepted, and 20 is rejected.
    - `storedWood` of 36 with the woodpile and house built is valid.
    - 13 without the house is invalid.
    - `fireplaceFuel` must be a finite number of 0 or more, and it must be 0 unless the house is built.
    - `structures.house` without `north-far` cleared is invalid, which the generic ground loop already covers.
- [ ] **Step 2: Run `npx vitest run tests/house.test.ts`.** Expected: FAIL.
- [ ] **Step 3: Implement.**
  - Build the house through the existing build action. Only its build seconds (`houseBuildSeconds`) and its message differ.
  - Replace `BALANCE.woodpileCapacity` reads in the store blocker and save check with `woodStoreCapacity`.
  - Rename the full-store refusal to `'The wood store is full.'`, and update the woodpile test that pins the old text. That's the one allowed assertion edit.
  - Draw the art:
    - **`houseSite`:** stakes and string, like the other sites.
    - **`house`:** about 40×32, a small timber house with a stone chimney, a door, and one window that's dark or warmly lit.
    - **`woodshed`:** the finished shelter's frame with an open front showing stacked logs according to the stock level.
- [ ] **Step 4: Update the README.** Add the house to the build list. Explain that the shelter becomes a woodshed, and give the wood store's capacity.
- [ ] **Step 5: Run `npm test && npm run lint && npm run build`.** Expected: all pass.
- [ ] **Step 6: Commit.** Use the message "Build a house on the north ground; the shelter becomes a woodshed".

### Task 2: The fireplace takes over from the campfire

**Files:**
- Modify:
  - `src/game/home.ts`
  - `src/game/rules.ts` (`advanceTime`, `warmthChange`, `dawn`, `sleepBlocker`, `rest`, sleep message)
  - `src/game/cooking.ts` (`cookBlocker`, `dishBlocker`)
  - `src/game/wolves.ts`
  - `src/game/companion.ts` (`alarmAfter`, line ~158)
  - `src/game/forecast.ts`
  - `src/game/journalEntries.ts`
  - `src/scene/prompts.ts`
  - `src/scene/tapTarget.ts`
  - `src/scene/visuals.ts` (house window, chimney smoke)
  - `src/scene/lighting.ts` (house light at night)
  - `src/scene/sleepReplay.ts`
  - `src/ui/panels.ts` (fire status line)
  - `README.md`
- Create: `tests/fireplace.test.ts`

**Interfaces:**
- Consumes from Task 1: `HOUSE_SPOT`, `livesInHouse`, `woodStoreCapacity`, `GameState.fireplaceFuel`, the `BALANCE` values, and the `house` `dark`/`lit` frames.
- Produces, in `src/game/home.ts`:
  ```ts
  export function isAtHome(state: GameState): boolean;   // house: area camp && within homeRadius of HOUSE_SPOT; else isAtCamp(state)
  export function warmFuel(state: GameState): number;    // house: fireplaceFuel; else fireFuel
  /** One step of the fireplace inside advanceTime's loop: draw a log at night when empty, then burn. Mutates the working copy. */
  export function tendFireplace(next: GameState, step: number, coldNight: boolean): void;
  ```

- [ ] **Step 1: Write the failing tests in `tests/fireplace.test.ts`.** In every case "house" means a state with the house built, `north-far` cleared and the survivor at `HOUSE_SPOT`.
  - **Burning:**
    - In daylight, `advanceTime` leaves `fireplaceFuel` and `storedWood` untouched.
    - At nightfall with `storedWood` 5 and `fireplaceFuel` 0, the first night step takes 1 log and leaves `fireplaceFuel` at about 200 minus the step.
    - Over a whole ordinary night, logs are drawn one at a time, and none are taken from the bag.
    - With the store empty, `fireplaceFuel` reaches 0 and stays there.
    - On a freezing night it burns at `coldNightFireBurn`.
  - **Warmth:**
    - At home at night with `fireplaceFuel` > 0 and the campfire unlit, warmth rises as it does by a lit campfire today (`step / 2`).
    - In the quarry at night with the house built, the fireplace still burns, and warmth falls as it does outdoors today (Review Focus 3).
    - At camp by a lit campfire with the house built, warmth still rises.
  - **Sleep and rest:**
    - With the house built, `sleepBlocker` at camp but away from home returns `'Go home to sleep.'`.
    - At home it returns null without checking the shelter.
    - Rest away from home refuses with `'Go home to rest.'`.
    - Without the house, both messages are unchanged: `'Move closer to the fire to sleep.'` and `'Move closer to the fire to rest.'`.
  - **Waking (Review Focus 2):**
    - Sleeping at home with the campfire unlit and the store stocked returns `'You sleep until morning.'` with warmth held.
    - With the store empty, so the fireplace dies, it returns `'You sleep until morning. The fireplace went out in the night.'`.
  - **Cooking:**
    - With the house, `cookBlocker` and `dishBlocker` away from home return `'Go home to cook.'`.
    - At home with `fireplaceFuel` 0 they return `'The fireplace is out. Stock the wood store.'`.
    - At home with the fireplace burning they ignore `fireFuel`.
  - **Wolves (Review Focus 1):**
    - On a winter night with the house built, `fireplaceFuel` 0, the store empty and the campfire lit, `wolfVisit` takes a ration, because the fireplace is the fire that counts.
    - With the fireplace burning and the campfire out, no wolf comes.
  - **Storm:** the cold night counts as weathered (`hearthUnlocked` set at dawn) when the survivor is at home with the fireplace burning and warmth above 20.
  - **Fire status line** (`bagView(state).fire`):
    - House by day with 9 stored: `'The fireplace is banked · 9 logs in store'`.
    - House at night, burning, with 9 stored: `'The fireplace is burning · 9 logs in store'`.
    - With 2 or fewer stored and the fireplace burning: `'Wood is running low · 2 logs in store'`.
    - With `fireplaceFuel` 0 and 0 stored at night: `'The fireplace is out. Stock the wood store.'`.
    - Without the house it's unchanged.
  - **Journal:** add a `JournalId` `'fireside'` on the autumn page, with the line `'A night by the fireplace, the door shut against the wind.'`. It fires on an autumn sleep at home with `fireplaceFuel` > 0 at dawn. The existing `coldFront`, `winterFire` and `warmSleep` rules read `isAtHome` and `warmFuel` in place of `isAtCamp` and `fireFuel`.
- [ ] **Step 2: Run `npx vitest run tests/fireplace.test.ts`.** Expected: FAIL.
- [ ] **Step 3: Implement the rule changes.**
  - Call `tendFireplace` in `advanceTime`'s loop, next to the campfire burn. Do nothing when there's no house.
  - **`warmthChange`:**
    - `sheltered` becomes `isAtHome && (shelter || house)`.
    - `lit` becomes `(isAtHome && warmFuel > 0) || (isAtCamp && fireFuel > 0)`.
  - **`dawn`'s weathered test** uses `isAtHome`, `shelter || house`, and `warmFuel`.
  - **`wolvesClose`, `wolfVisit`, `alarmAfter` and the forecast's fuel** read `warmFuel`.
  - **The forecast's readiness** for a house counts `fireplaceFuel + storedWood × fireplaceSecondsPerWood`.
  - **`prompts.ts` and `tapTarget.ts`:** the sleep and rest prompts use `isAtHome`, and the campfire's Feed prompt stays on `isAtCamp`.
  - **`sleepReplay`** replays `fireplaceFuel` when there's a house.
- [ ] **Step 4: Implement the visuals.**
  - The house window is `house:lit` at night while `fireplaceFuel` > 0, and `house:dark` otherwise.
  - Chimney smoke rises while it's lit. Reuse the campfire's smoke visuals in `effectVisuals.ts`, offset to the chimney.
  - `lighting.ts` adds a small warm light at the house at night while it's lit.
- [ ] **Step 5: Update the README.** Explain that the house fireplace feeds itself from the wood store at night, that the campfire is optional, and that home is where you sleep, rest and cook. Add `house` and `fireplace` to the test list.
- [ ] **Step 6: Run `npm test && npm run lint && npm run build`.** Expected: all pass, with existing assertions unedited (Review Focus 5).
- [ ] **Step 7: Commit.** Use the message "Let the house fireplace keep the survivor warm in place of the campfire".
