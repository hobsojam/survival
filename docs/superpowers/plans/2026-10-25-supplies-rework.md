# Supplies Rework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Drop 1 buttons with an action that suits each supply. Make stone heavy and finite. Let dropped stone stay on the ground. Add a wood-built stone pile at camp that builds can draw from.

**Architecture:**
- The rule changes stay pure, in `src/game/rules.ts` and `src/game/state.ts`.
- Stone weight goes through one helper, `spaceFor`. `carriedCount` becomes a count of bag spaces.
- Builds and crafts that need stone use `availableStone` and `spendStone`, which count bag stone first and then the camp pile.
- Loose stone piles are a new `state.stonePiles` array. They join tap targets, E, and scene visuals.
- `save.ts` collapses to a single version (11) and rejects everything older.

**Tech Stack:** TypeScript, Phaser 4, Vite, Vitest, oxlint.

**Spec:** `docs/superpowers/specs/2026-10-25-supplies-rework-design.md`

## Global Constraints

- Stone takes **2** bag spaces; everything else takes 1. The bag holds 8 spaces, or 16 with the crate.
- Fiber burns for **30 s** (`BALANCE.fiberFireSeconds`), at camp only, with or without the hearth. The Fire action, F, and campfire taps burn wood only. The forecast counts wood only.
- Rocks (`kind: 'stone'` nodes) never refill. Other nodes refill at dawn, as now.
- Loose piles merge within **1 tile** (`BALANCE.pileMergeRadius`). Picking up takes **2 s** (`BALANCE.pickUpSeconds`), uses no energy, and needs 2 free spaces. Piles never fade.
- The stone pile structure costs **3 wood**, has no prerequisite, and is built like other structures (12 s, 6 energy). It holds **12** (`BALANCE.stonePileCapacity`). Store and Take are instant and work at camp only.
- The hearth, axe, and lookout spend bag stone first, then the pile. The lookout counts the pile from anywhere.
- `SAVE_VERSION` becomes 11. Any other version loads as `invalid`, using the existing message.
- Full-bag copy: `Your bag is full. Eat, burn, or set something down at camp to make room.`
- Phone bag buttons are at least 44 px tall. Text contrast is at least 4.5:1. Pixel art follows `docs/superpowers/specs/2026-10-21-pixel-art-direction.md`.
- `npm run lint`, `npm test -- --run`, and `npm run build` pass.

## Review Focus

- **Full bag with stone:** with 7/8 spaces used, gathering a rock, picking up a pile, taking from the pile, or the cairn find is refused with a clear message, and nothing is lost. Tests are in Tasks 1–3.
- **Spending stone across bag and pile:** a hearth paid with 1 bag stone plus 2 pile stones leaves 0 in the bag and the right count in the pile. Test in Task 3.
- **Dropping near a pile on a later day:** a stone dropped 0.8 tiles from an existing pile joins it and doesn't create a second pile. Test in Task 2.
- **E near both a pile and a node:** E picks the nearer one, and the prompt names it. Test in Task 5 (`closestGatherable`).
- **No stray Drop buttons:** after the UI change, the bag shows exactly one Drop button (stone's). It's checked in Task 6's browser run.

---

### Task 1: Stone weight, fiber fuel, rocks that don't regrow

**Files:**
- Modify: `src/game/state.ts` (`BALANCE`), `src/game/rules.ts`
- Test: `tests/rules.test.ts`

**Interfaces:**
- Produces:
  - In `BALANCE`: `stoneSpaces: 2` and `fiberFireSeconds: 30`.
  - `spaceFor(resource: keyof GameState['inventory']): number`, which returns 2 for stone and 1 otherwise.
  - `carriedCount(state): number`, which now counts spaces.
  - `bagCapacity(state): number`.
  - `freeSpaces(state): number`.
  - A new `GameAction` member, `{ type: 'burnFiber' }`. Remove `{ type: 'drop' ... }`.
  - The `FULL_BAG_MESSAGE` constant (the exact copy above), exported from `rules.ts`.

- [ ] **Step 1: Write the failing tests** in `tests/rules.test.ts`, in a new `describe('heavy stone and fiber fuel')`:
  - `counts stone as two spaces`: set the inventory to `{ wood: 2, food: 0, fiber: 0, stone: 1, trailFood: 0 }`. Expect `carriedCount(state)` to be 4 and `freeSpaces(state)` to be 4.
  - `refuses a rock when only one space is free`: fill the bag to 7 spaces, stand at `stone-0`, and run `gather`. Expect the state to be unchanged and the message to equal `FULL_BAG_MESSAGE`. Then with 6 spaces used, the stone count goes up by 1.
  - `needs four free spaces for the cairn's two stones`: with 5 spaces used at the cairn, expect `visitSite` to leave the state unchanged. With 4 used, expect stone +2.
  - `burns fiber for thirty seconds at camp only`: at camp with fiber 1, run `burnFiber`. Expect `fireFuel` to go up by 30 and fiber to be 0. Repeat with `structures.hearth = true` and expect +30 again. Away from camp, expect the state to be unchanged. With fiber 0, expect it unchanged too.
  - `never burns fiber when stoking the fire`: with wood 0 and fiber 2, run `stokeFire`. Expect the state to be unchanged and fiber to stay 2.
  - `does not refill rocks at dawn`: gather `stone-0` and `branch-0`, then advance past dawn. Expect `stone-0.amount` to be 0 and `branch-0.amount` to be 1.
  - Delete the two old tests that use `{ type: 'drop' }`. They're `rules.test.ts:33` and the stone-drop loop near line 88. Keep their discovery assertions where they still apply.
- [ ] **Step 2: Run** `npx vitest --run tests/rules.test.ts`. Expected: FAIL, because `freeSpaces`, `FULL_BAG_MESSAGE`, and `burnFiber` don't exist.
- [ ] **Step 3: Implement.**
  - Add the helpers.
  - Replace each inline `structures.crate ? crateCapacity : baseCapacity` and each `carriedCount(state) >= capacity` check with `freeSpaces(state) < spaceFor(resource)` (or `< 2 * spaceFor(resource)` for site finds). This covers gather, chop, visitSite, and prepareTrailFood.
  - Skip `kind === 'stone'` in the dawn refill at `rules.ts:140`.
  - Remove the `drop` branch.
  - Add `burnFiber`, which mirrors `stokeFire`'s camp check, with the messages `Return to the marked camp area to tend the fire.` and `You have no fiber to burn.`
- [ ] **Step 4: Run** `npx vitest --run --dir tests`. Expected: PASS, except tests elsewhere that still use `drop` or the old capacity. Fix those test inputs (not the rules) so they match the spec, and note each one in the commit message.
- [ ] **Step 5: Commit**: `git commit -am "Make stone heavy, let fiber burn, and stop rocks regrowing"`

### Task 2: Loose stone on the ground

**Files:**
- Modify: `src/game/state.ts`, `src/game/rules.ts`
- Test: `tests/rules.test.ts`

**Interfaces:**
- Consumes: `freeSpaces` and `spaceFor` from Task 1.
- Produces:
  - `interface StonePile { id: string; x: number; y: number; count: number }`.
  - `GameState.stonePiles: StonePile[]`, which `createGame()` sets to `[]`.
  - In `BALANCE`: `pileMergeRadius: 1` and `pickUpSeconds: 2`.
  - New `GameAction` members: `{ type: 'dropStone' }` and `{ type: 'pickUpStone'; pileId: string }`.
  - A new pile's id is `pile-${day}-${Math.round(x * 10)}-${Math.round(y * 10)}`. That's unique because no new pile can start within 1 tile of another.

- [ ] **Step 1: Write the failing tests** in a new `describe('loose stone')`:
  - `drops one stone where the survivor stands`: stone 2, player at (5, 5). After `dropStone`, the inventory stone is 1, and `stonePiles` equals `[{ id: expect.any(String), x: 5, y: 5, count: 1 }]`. With stone 0, the state is unchanged.
  - `adds to a pile within one tile instead of starting another`: drop at (5, 5), move to (5.8, 5), and drop again. Expect one pile with count 2, still at (5, 5). Then move to (6.5, 5) and drop. Expect two piles.
  - `picks up one stone from a nearby pile with two free spaces`: a pile of count 2 is 1.5 tiles away. After `pickUpStone`, the pile count is 1, the inventory stone is +1, the time of day is +2, and energy is unchanged. With 7 spaces used, the state is unchanged and the message is `FULL_BAG_MESSAGE`. With the pile 3 tiles away, the state is unchanged.
  - `removes a pile when its last stone is picked up`: a count-1 pile leaves `stonePiles` empty.
- [ ] **Step 2: Run** `npx vitest --run tests/rules.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement both actions.** Pickup uses `near()` (the interaction radius) and `advanceTime(..., BALANCE.pickUpSeconds, 'resting')`, so it costs no energy. The messages are `Set down one stone.` and `Picked up a stone.`
- [ ] **Step 4: Run** `npx vitest --run --dir tests`. Expected: PASS.
- [ ] **Step 5: Commit**: `git commit -am "Leave dropped stone on the ground"`

### Task 3: The stone pile at camp

**Files:**
- Modify: `src/game/state.ts` (`BUILDINGS`, `GameState`, `createGame`), `src/game/rules.ts`
- Test: `tests/rules.test.ts`, `tests/hud.test.ts`

**Interfaces:**
- Consumes: Task 1's helpers.
- Produces:
  - `BUILDINGS.stonePile = { name: 'Stone pile', description: 'Keep up to 12 stone at camp', symbol: '◆', cost: { wood: 3, fiber: 0 }, prerequisite: null }`.
  - `GameState.storedStone: number`, which `createGame()` sets to 0.
  - In `BALANCE`: `stonePileCapacity: 12`.
  - `availableStone(state): number`, which is bag stone plus `storedStone`.
  - `spendStone(state, amount): GameState`, which takes bag stone first, then the pile.
  - New `GameAction` members: `{ type: 'storeStone' }` and `{ type: 'takeStone' }`.

- [ ] **Step 1: Write the failing tests:**
  - `builds the stone pile from three wood`: at camp with wood 3, `buildStatus(state, 'stonePile')` is `'ready'`. After `build`, `structures.stonePile` is true and wood is 0.
  - `stores and takes stone at camp up to twelve`:
    - Before the pile is built, `storeStone` leaves the state unchanged.
    - Once it's built, at camp with stone 1, `storeStone` makes it stone 0 and `storedStone` 1.
    - With `storedStone` 12, `storeStone` leaves the state unchanged.
    - `takeStone` with 7 spaces used leaves the state unchanged.
    - `takeStone` with free space moves one stone back.
    - Away from camp, both leave the state unchanged.
  - `pays for the hearth from the bag first, then the pile`: hearth unlocked, wood 2, stone 1, `storedStone` 2, `structures.stonePile` true. `buildStatus(state, 'hearth')` is `'ready'`. After `build`, the inventory stone is 0 and `storedStone` is 0.
  - `crafts the axe with stone from the pile`: stone 0 and `storedStone` 1 succeeds.
  - `repairs the lookout with pile stone from far away`: at the lookout with wood 4, fiber 2, stone 0, and `storedStone` 3, `lookoutRepairBlocker` is null. After the repair, `storedStone` is 1.
  - Update the `hud.test.ts` fixtures that build `structures` objects so they include `stonePile: false`.
- [ ] **Step 2: Run** `npx vitest --run tests/rules.test.ts tests/hud.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - Replace every `state.inventory.stone >= / < cost` check in `buildStatus`, `build`, `craftAxe`, and `lookoutRepairBlocker` with `availableStone`.
  - Replace every `stone: state.inventory.stone - n` deduction with `spendStone`.
  - The messages are `Stored a stone.`, `Took a stone from the pile.`, `The stone pile is full.`, `Build a stone pile first.`, and `The stone pile is empty.`
- [ ] **Step 4: Run** `npx vitest --run --dir tests`. Expected: PASS.
- [ ] **Step 5: Commit**: `git commit -am "Add a stone pile at camp that builds can draw from"`

### Task 4: Save version 11

**Files:**
- Modify: `src/game/save.ts`
- Test: `tests/save.test.ts`, `tests/savePlay.test.ts`

**Interfaces:**
- Consumes: the new `GameState` fields from Tasks 2 and 3.
- Produces: `loadGame` and `saveGame` keep their signatures. `SAVE_VERSION = 11`.

- [ ] **Step 1: Write the failing tests.** Replace the migration tests in `tests/save.test.ts` with these:
  - `round-trips piles, the stone pile and stored stone`: a state with `stonePiles: [{ id: 'pile-1-50-50', x: 5, y: 5, count: 3 }]`, `structures.stonePile` true, and `storedStone` 4 loads back `toEqual` the saved state.
  - `rejects every earlier version`: for each version from 1 to 10, `{ version: v, state: createGame() }` loads as `kind: 'invalid'`.
  - `rejects bags over capacity counting stone as two`: stone 5 with no crate is invalid.
  - `rejects bad piles and stored stone`: each of these is invalid: a pile count of 0, a pile off the map, `storedStone` 13, `storedStone` 1 with the pile structure not built, and a fractional count.
  - Keep the existing tests for corrupt JSON, the storage error, and invalid meters, updated so their fixtures use `createGame()`.
  - In `tests/savePlay.test.ts`, keep the play-then-reload flows and drop any version-migration cases.
- [ ] **Step 2: Run** `npx vitest --run tests/save.test.ts tests/savePlay.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - Collapse `validCore`, `validProgress`, `validStateV4`–`V9`, the `migrateV*` functions, the `with*` helpers, and `LEGACY_BRANCH_POSITIONS` into one `validState(value): value is GameState`.
  - It checks today's shape, including spaces of at most `bagCapacity`, plus the pile and stored-stone rules from the tests above.
  - `loadGame` accepts only `version === SAVE_VERSION`. Any other version returns `{ kind: 'invalid', reason: 'This save uses an unsupported version.' }`.
- [ ] **Step 4: Run** `npx vitest --run --dir tests`. Expected: PASS.
- [ ] **Step 5: Commit**: `git commit -am "Save version 11 with stone piles; drop old migrations"`

### Task 5: Loose piles and the stone pile in the scene

**Files:**
- Modify:
  - `src/art/phase3Sprites.ts`, which gets new sprites `looseStones` (frames `one`, `two`, `many`) and `stonePile` (`built`), plus `stonePileSite` (`still`).
  - `src/scene/visuals.ts`
  - `src/scene/tapTarget.ts`
  - `src/scene/GameScene.ts`
- Test: `tests/tapTarget.test.ts`, `tests/visuals.test.ts`, `tests/art.test.ts` (if it lists sprites)

**Interfaces:**
- Consumes: `StonePile` and `pickUpStone` from Task 2.
- Produces:
  - A new `TapTarget` member `{ kind: 'pile'; id: string; x: number; y: number }`. `targetAction` maps it to `{ type: 'pickUpStone', pileId }`.
  - `closestGatherable(state): { kind: 'node'; node: ResourceNode } | { kind: 'pile'; pile: StonePile } | undefined`, exported from `tapTarget.ts`. It returns the nearer gatherable node or pile within the interaction radius.

- [ ] **Step 1: Write the failing tests:**
  - `tapTarget.test.ts`:
    - `picks a loose pile within one tile`. With a pile at (5, 5) and a tap at (5.6, 5), the target matches `{ kind: 'pile', id }`.
    - `maps a pile to pickUpStone`.
    - `closestGatherable prefers the nearer of a pile and a node`.
  - `visuals.test.ts`: `draws loose piles by count`. Piles of count 1, 2, and 5 give the textures `looseStones:one`, `looseStones:two`, and `looseStones:many`. `draws the stone pile site, then the built pile`.
- [ ] **Step 2: Run** `npx vitest --run tests/tapTarget.test.ts tests/visuals.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement the sprites, visuals, and tap targets.**
  - The 16×16 `looseStones` art must read clearly differently from the `pebbles0` decal: larger, separate stones with highlights.
  - Put the stone pile and its site on a free camp tile. Check it in `/sprites.html` and the camp screenshot.
  - In `GameScene`:
    - E uses `closestGatherable`.
    - `getPrompt` shows `E  Pick up stone (×N)` beside a pile.
    - A small pixel-font count label, using `palette.paper` on a `palette.ink` backing, sits over piles of count 2 or more. It's destroyed when the pile is.
- [ ] **Step 4: Run** `npx vitest --run --dir tests`. Expected: PASS.
- [ ] **Step 5: Commit**: `git commit -am "Show loose stone and the camp stone pile"`

### Task 6: Bag buttons, stone pile controls, README

**Files:**
- Modify: `src/ui/App.ts`, `src/style.css`, `README.md`

**Interfaces:**
- Consumes: `burnFiber`, `dropStone`, `storeStone`, `takeStone`, `availableStone`, `carriedCount`, and `bagCapacity`.

- [ ] **Step 1: Bag buttons.**
  - Replace each `data-drop` button with a `[data-action]` button labeled as follows:

    | Supply | Label | Action |
    | --- | --- | --- |
    | Wood | Burn | `stokeFire` |
    | Food | Eat | `eat` |
    | Fiber | Burn | `burnFiber` |
    | Stone | Drop | `dropStone` |
    | Rations | Eat | `eatTrailFood` |

  - Give them the aria-labels `Burn one wood`, `Eat one berry`, `Burn one fiber`, `Drop one stone`, and `Eat one trail ration`.
  - Rename the CSS class `drop-item` to `supply-action`, keeping its styles. Each button is disabled when its count is 0.
  - Remove the `.supplies` drop listener. The existing `[data-action]` binding covers these buttons.
- [ ] **Step 2: Stone pile controls.**
  - Inside the build panel, add `<div id="stone-pile-controls" hidden>`. It shows `Stored stone N/12` and two buttons, `data-action="storeStone"` (Store 1) and `data-action="takeStone"` (Take 1), and appears once the pile is built.
  - In the bag's stone cell, add `<small id="stone-stored">`. It reads `+N at camp` when the pile is built and is empty otherwise.
  - Change the axe ready check (`App.ts:351`) to use `availableStone`.
- [ ] **Step 3: Verify.** Run `npm run lint && npm test -- --run && npm run build`; all must pass. Then do a scripted Playwright run at 390×844 with touch, and at 1000×640:
  - The bag shows exactly one Drop button.
  - Burn fiber at camp, and the fire time goes up by 30.
  - Drop a stone in the field, walk away, tap the pile, and it's picked back up.
  - Build the stone pile, Store 2, then repair the lookout with stone 0 in the bag.
  - Rock taps after gathering show pebbles, and nothing is picked up.
  - The page doesn't scroll on the phone.
- [ ] **Step 4: README.**
  - In the controls table, replace the "Drop 1 buttons" row with "Bag buttons: eat, burn, or drop stone".
  - Update the bag paragraph: stone takes 2 spaces, fiber burns, and rocks give stone once.
  - Add the stone pile to the building costs.
  - Saving: only version-11 saves load, and older ones start fresh.
- [ ] **Step 5: Commit**: `git commit -am "Bag actions for every supply and stone pile controls"`
