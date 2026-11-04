# Sheep and Wool Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a sheep pen, stray sheep you feed and can shear once a year, flocks that grow into giant clouds, and a loom that turns wool into three things.

**Architecture:** Game rules live in a new `src/game/sheep.ts`, with state on `GameState.sheep` and straw on `field.straw`. All saved-shape changes land together in Task 1 as one save version. Rules, panels and art follow as separate tasks, each building on the last.

**Tech Stack:** TypeScript, Phaser 3, Vite, Vitest, oxlint. Art is drawn in code.

**Spec:** `docs/superpowers/specs/2026-11-04-sheep-and-wool-design.md`

## Global Constraints

- No new dependencies and no image files.
- Copy is plain, warm and short, with no exclamation marks.
- Sheep never get ill, leave or die, and nothing punishes missed feeds.
- A shearing always gives 4 wool, whatever the fluff.
- SonarCloud needs 80% on new code and `App.ts` is untested, so DOM decisions go in tested helpers in `src/ui/panels.ts`.
- Only one open PR may change the save format. Before merging, rebase on `main` and take the next unused version number.
- Never edit `tests/fixtures/save-v23.json`.
- After every task: `npm run lint`, `npx tsc --noEmit` and `npm test -- --run` all pass.

## Review Focus

1. The sheep arrive while the survivor sleeps through the dawn: the morning note still shows. *(Test in Task 2.)*
2. Threshing with a full granary, or at the straw cap: straw still comes, up to 12, and threshing isn't refused. *(Task 2.)*
3. A weak survivor: feeding works while exhausted, like gathering by hand, but shearing has to wait. *(Tasks 2 and 3.)*
4. Shearing with a nearly full basket, and shearing a cloud: the shearing happens, the basket stops at 8, the extra is mentioned, and the yield never exceeds 4. *(Task 3.)*
5. Trees and the meadow: no decorative tree stands on the cleared meadow, and it doesn't widen the clearing or the fire's ring. *(Task 1.)*

---

### Task 1: Save shape, the east outer ground and the pen

**Files:**
- Modify: `src/game/state.ts`, `src/game/clearing.ts`, `src/game/save.ts`, `src/game/saveUpgrades.ts`, `src/game/field.ts`, `src/game/workshop.ts`, `src/game/rules.ts`, `src/scene/visuals.ts`
- Test: `tests/sheepState.test.ts`, and update `tests/clearing.test.ts`, `tests/saveFixture.test.ts`, `tests/saveUpgrades.test.ts`, plus any test listing `STEP_IDS`, `CAMP_STRUCTURES` or workshop ids

**Interfaces:**
- Produces:
  - `GameState.sheep: { arrived: boolean; fluff: number; fedUntil: number | null; lastShornYear: number | null; wool: number; woven: { blanket: boolean; jumper: boolean; rug: boolean } }`
  - `FieldState.straw: number`
  - `StructureId` gains `sheepPen` and `loom`; `UpgradeId` gains `shears`; `StepId` gains `east-outer`
  - `BALANCE` gains `strawPerStrip: 2`, `strawCapacity: 12`, `feedDays: 3`, `fluffFed: 2`, `fluffUnfed: 1`, `fluffCap: 200`, `fluffOnArrival: 40`, `fluffRound: 120`, `woolPerShearing: 4`, `woolCapacity: 8`, `blanketEnergyGain: 10`, `jumperWarmthLoss: 0.9`

- [ ] **Step 1: Write the failing tests**

  In `tests/sheepState.test.ts`:
  - `createGame()` has an unbuilt pen and loom, `sheep` of `{ arrived: false, fluff: 0, fedUntil: null, lastShornYear: null, wool: 0, woven: all false }`, and `field.straw` of 0.
  - `STEP_IDS` has `east-outer` straight after `east-far`, `previousStep('east-outer')` is `east-far`, and it costs the outer price and marks 3 trees.
  - With `east-outer` cleared, `inClearing` is true at the meadow's corners (31,2), (37,2), (31,7), (37,7), and `clearingReach` everywhere matches the same clearing without `east-outer`. Without it, those corners are false. `buildMap` puts no tree on the cleared meadow.
  - With `east-far` cleared but not `east-outer`, the pen and its site aren't drawn (`groundBlocker`).
  - Upgrading a version 33 save: starting values are all as above, and `workshop.shears` is false.
  - Validation rejects: sheep arrived without a pen; fluff on unarrived sheep; fluff over 200; wool over 8; straw over 12; a loom with `lastShornYear` null; `lastShornYear` set without sheep and shears; a woven item without a loom; a blanket without a bed; a rug without a house.

- [ ] **Step 2: Run the tests**

  Run: `npx vitest run tests/sheepState.test.ts`. Expected: FAIL, as `sheep` and `east-outer` don't exist.

- [ ] **Step 3: Implement**
  - `CLEARING_STEPS['east-outer']`: `side: 'east'`, `reach` equal to `east-far`'s, `cost: OUTER_COST`, `room: ['sheepPen']`, `patch: { x: 31, y: 2, width: 6, height: 5 }`, and marked trees at (32.5, 3.5), (35, 5.5) and (36, 3). `stepReach` treats a patch step as the step before it; `inClearing` also returns true inside a cleared patch. `clearForTree` in `map.ts` refuses a cleared patch.
  - Extend the `StepId` type's outer steps with `east-outer`, and insert it after `east-far` in `STEP_IDS`.
  - `BUILDINGS.sheepPen`: 8 wood, 4 fiber, `prerequisite: 'field'`, `ground: 'east-outer'`. `BUILDINGS.loom`: 8 wood, 2 fiber, 2 stone, `prerequisite: 'sheepPen'`, `ground: 'east-far'`.
  - `CAMP_STRUCTURES` gains `['sheepPen', 14, -10.5]` and `['loom', 7.5, 2.5]`. The pen's sprite anchor must put its body on x 31–37, y 2–7.
  - In `rules.ts`, `buildStatus` returns `'locked'` for the loom while `sheep.lastShornYear === null`, and the build refusal says "Shear the flock first."
  - Bump `SAVE_VERSION`. The upgrade step adds the starting values.
  - Add a `validSheep` check in `save.ts` for the rules in Step 1. `WORKSHOP_UPGRADES.shears`: 1 wood, 2 stone, message "You made a pair of shears. The flock can be sheared in spring.", blocker "Build the sheep pen first."

- [ ] **Step 4: Run all tests**

  Run: `npm test -- --run`. Expected: PASS, after updating the listed tests with the new step, room, building and upgrade.

- [ ] **Step 5: Commit**

  Commit the spec and this plan with the task: `Add the east outer ground and the sheep pen`.

### Task 2: Straw, feeding, arrival and fluff

**Files:**
- Create: `src/game/sheep.ts`
- Modify: `src/game/field.ts` (`threshedField`), `src/game/rules.ts`, `src/game/news.ts`
- Test: `tests/sheep.test.ts`

**Interfaces:**
- Produces, from `sheep.ts`:
  - `type SheepStage = 'shorn' | 'woolly' | 'round' | 'cloud'`
  - `sheepStage(fluff: number): SheepStage`
  - `feedBlocker(state: GameState): string | null`
  - `fedSheep(state: GameState): GameState`
  - `sheepDawn(next: GameState): void`, which mutates advanceTime's working copy like `chickensDawn`
  - `sheepNews(before: GameState, after: GameState): string[]`
- `GameAction` gains `{ type: 'feedSheep' }`.

- [ ] **Step 1: Write the failing tests**
  - Threshing adds 2 straw, including with a full granary, and stops at 12 with threshing still succeeding.
  - `sheepStage`: 0 and 39 are `shorn`, 40 and 119 `woolly`, 120 and 199 `round`, 200 `cloud`.
  - `feedBlocker`: "Build the sheep pen first." without a pen; "Return to camp to feed the sheep." outside the clearing; "There is no straw. Thresh a strip of the field." at 0 straw; "The sheep still have plenty." while `state.day < fedUntil`; null otherwise, **including while exhausted**.
  - `feedSheep` spends 1 straw, sets `fedUntil` to `day + 3`, and takes `gatherSeconds` and `gatherEnergyCost`.
  - At the first dawn after feeding, `arrived` is true and fluff is 40, and the news is exactly "Three sheep were in the pen this morning. They seem to have decided something." No sheep arrive without a feed.
  - **Sleeping across that dawn** still gives the note.
  - Later dawns add 2 fluff while `day <= fedUntil`, or 1 otherwise, stopping at 200. A flock with no feed for 100 days has gained 100 and is otherwise unchanged.

- [ ] **Step 2: Run the tests**

  Run: `npx vitest run tests/sheep.test.ts`. Expected: FAIL, as `sheep.ts` doesn't exist.

- [ ] **Step 3: Implement** the interfaces above. Call `sheepDawn(next)` after `chickensDawn(next)`, and add `sheepNews` to `newsBetween`. No fluff is added on the arrival dawn.

- [ ] **Step 4: Run the tests**

  Run: `npm test -- --run`. Expected: PASS.

- [ ] **Step 5: Commit** `Feed the pen and let the strays come`.

### Task 3: Shears and shearing

**Files:**
- Modify: `src/game/sheep.ts`, `src/game/rules.ts`
- Test: `tests/sheep.test.ts`

**Interfaces:**
- Consumes: `sheepStage`.
- Produces: `shearBlocker(state: GameState): string | null`; `shornSheep(state: GameState): { state: GameState; message: string }`. `GameAction` gains `{ type: 'shearFlock' }`.

- [ ] **Step 1: Write the failing tests**
  - `shearBlocker`, in order: no sheep, "The pen is empty."; no shears, "Make shears at the workshop first."; not spring, "Shearing waits for spring."; already shorn this year, "The flock has been sheared this year."; fluff under 40, "There isn't enough wool to shear yet."; outside the clearing, "Return to camp to shear the flock."; exhausted, `TOO_TIRED_MESSAGE`.
  - Shearing takes `fieldWorkSeconds` and the same energy as a field job, sets fluff to 0, sets `lastShornYear`, and adds 4 wool.
  - **A cloud (200 fluff) gives exactly 4 wool**, the same as 40 fluff.
  - **With 6 wool**, it ends at 8, and the message says "The basket is full, so the rest of the wool was lost."
  - **With 8 wool**, the shearing still happens.
  - After the first shearing, `buildStatus(state, 'loom')` is no longer `'locked'`.

- [ ] **Step 2: Run the tests.** Expected: FAIL, as `shearBlocker` doesn't exist.

- [ ] **Step 3: Implement.** The normal message is "You sheared the flock. Four wool went into the basket."

- [ ] **Step 4: Run all tests.** Expected: PASS.

- [ ] **Step 5: Commit** `Shear the flock once a year`.

### Task 4: Weaving and what it does

**Files:**
- Modify: `src/game/sheep.ts`, `src/game/rules.ts`
- Test: `tests/sheep.test.ts`

**Interfaces:**
- Produces: `type WovenId = 'blanket' | 'jumper' | 'rug'`; `WOVEN: Record<WovenId, { name: string; wool: number }>` with blanket 3, jumper 4, rug 3; `weaveBlocker(state: GameState, item: WovenId): string | null`; `wovenState(state: GameState, item: WovenId): { state: GameState; message: string }`. `GameAction` gains `{ type: 'weave'; item: WovenId }`.

- [ ] **Step 1: Write the failing tests**
  - `weaveBlocker`: already made; "Build the loom first."; blanket needs a bed and rug needs a house; outside the clearing; exhausted; short of wool, "You need 3 wool for the rug."
  - Weaving spends the wool and takes `buildSeconds` and `buildEnergyCost`.
  - With the blanket, resting in the bed gives 10 more energy, on top of the pillow.
  - With the jumper, warmth lost at night is multiplied by 0.9, on top of the cloak. Daytime is unchanged.
  - The rug changes nothing but `woven.rug`.

- [ ] **Step 2: Run the tests.** Expected: FAIL, as `weaveBlocker` doesn't exist.

- [ ] **Step 3: Implement.** Add the blanket beside the pillow at `bedGain` in `rules.ts`, and the jumper beside the cloak where night warmth loss is scaled.

- [ ] **Step 4: Run all tests.** Expected: PASS.

- [ ] **Step 5: Commit** `Weave a blanket, a jumper and a rug`.

### Task 5: Panels

**Files:**
- Modify: `src/ui/panels.ts`, `src/ui/App.ts`
- Test: `tests/panels.test.ts`

**Interfaces:**
- Produces:
  - `sheepPanelView(state): { shown: boolean; status: string; straw: string; wool: string; feed: { disabled: boolean; hint: string }; shear: { shown: boolean; disabled: boolean; hint: string } }`
  - `loomPanelView(state): { shown: boolean; note: string; items: { id: WovenId; name: string; cost: string; disabled: boolean; hint: string }[] }`

- [ ] **Step 1: Write the failing tests**
  - The Sheep panel shows once the pen stands. `straw` reads "5 of 12 straw" and `wool` reads "4 of 8 wool".
  - `status` per stage: "The pen is empty. Put out some feed." / "Skinny, and rather cross about it." / "Three woolly sheep." / "Three very round sheep." / "You can hardly see the sheep for the wool."
  - `shear.shown` is false until the shears are made.
  - The Loom panel shows once the loom stands, lists the items not yet made with their blockers, and `note` reads "You've made everything the loom can make." when none are left.

- [ ] **Step 2: Run the tests.** Expected: FAIL, as the views don't exist.

- [ ] **Step 3: Implement the views, and wire them into `App.ts`** the way the windmill and workshop panels are wired: the Sheep panel in the Camp tab and the Loom panel in the Build tab, with `feedSheep`, `shearFlock` and `weave` going through `scene.perform`. Keep `App.ts` to markup and wiring.

- [ ] **Step 4: Run all tests.** Expected: PASS.

- [ ] **Step 5: Commit** `Add the sheep and loom panels`.

### Task 6: The sheep and the art

**Files:**
- Create: `src/art/sheepSprites.ts`
- Modify: `src/art/sprites.ts`, `src/scene/visuals.ts`
- Test: `tests/sheepArt.test.ts`

**Interfaces:**
- Consumes: `sheepStage`, `isWinter`.
- Produces sprites: `sheepPen` with frame `built` (96 × 80, with a gate and a feed rack) and `sheepPenSite`; `sheep` with `shornIdle`, `shornWalk`, `woollyIdle`, `woollyWalk`, `roundIdle`, `roundWalk`, `cloudIdle`, `cloudWalk`; `sheepSnow`; `loom` and `loomSite`; `rug`.

- [ ] **Step 1: Write the failing tests**
  - Every frame above passes `validateSprite`.
  - The cloud is at least twice the width of the shorn sheep, and its frames differ from the round ones.
  - `sceneVisuals`: no sheep before arrival, then three inside the pen's bounds at any `timeMs`.
  - The texture follows the stage. Winter adds one snow visual per sheep, and other seasons none.
  - While `state.day < fedUntil`, the sheep stand nearer the rack than they do unfed.
  - The rug is drawn only with `woven.rug` and the house.

- [ ] **Step 2: Run the tests.** Expected: FAIL, as the sprites don't exist.

- [ ] **Step 3: Implement.** Draw the sprites in the style of `src/art/homesteadSprites.ts`. Sheep wander on a slow function of `timeMs`, like `addChickens`. The cloud should be unmistakably funny: tiny legs and a small face peeking out.

- [ ] **Step 4: Run all tests.** Expected: PASS.

- [ ] **Step 5: Check it in a browser** at desktop and phone size, using saves at each stage: the pen and loom don't overlap the workshop, the east path or any tree, and the cloud reads clearly. Adjust positions if not, keeping the pen inside the cleared ground.

- [ ] **Step 6: Commit** `Draw the flock, from skinny to cloud`.

### Task 7: Journal, README and final checks

**Files:**
- Modify: `src/game/journalEntries.ts`, `src/art/journalIcons.ts`, `src/ui/yearJournal.ts`, `README.md`
- Test: `tests/sheep.test.ts`

- [ ] **Step 1: Write the failing tests**
  - A shearing in spring writes `shearing` on spring's page: variant 0 "Sheared the flock. They looked smaller and rather cross." or, if `sheepStage(before.sheep.fluff) === 'cloud'`, variant 1 "Sheared the cloud. There was a sheep in there after all."
  - The line leaves no blank until the pen stands (`WAITS_ON`).

- [ ] **Step 2: Run the tests.** Expected: FAIL, as the `shearing` entry doesn't exist.

- [ ] **Step 3: Implement** the entry with its own icon, and add the player-facing sections to the README: the pen, feeding, the clouds, shearing and the loom, plus the save-field list and the clearing section's room list.

- [ ] **Step 4: Run everything**

  Run: `npm run lint && npx tsc --noEmit && npm test -- --run --coverage && npm run build`. Expected: all pass, with new code at 80% or more.

- [ ] **Step 5: Play it through in a browser:** clear the ground, build the pen, thresh, feed, wake to the sheep, make shears, shear, see the loom appear, weave, then reload and continue.

- [ ] **Step 6: Commit, push and open a PR** after rebasing on `main` and taking the next unused save version.
