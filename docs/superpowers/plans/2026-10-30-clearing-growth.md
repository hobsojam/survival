# Growing the Clearing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the player widen the camp clearing side by side: choose a side, chop its marked trees with the axe, then clear the ground. The fire's warmth stays where it is today.

**Architecture:**
- A new pure module, `src/game/clearing.ts`, owns the step data, the clearing's shape and the branch placement.
- `GameState.clearing` saves which steps are cleared, which step is marked, and which of its trees have been felled.
- "At camp" splits in two:
  - `isAtCamp` keeps meaning "near the fire" (today's radius-4 circle).
  - A new `isInClearing` covers the whole grown clearing.
- Marked trees aren't saved in `state.trees`, which save validation requires to match `createGame()`. They're worked out from `state.clearing` by `markedTrees(state)`.
- The scene's terrain key includes the clearing's shape, so the scene redraws its ground whenever the clearing grows.

**Tech Stack:** TypeScript, Phaser canvas textures, Vitest, oxlint.

**Spec:** `docs/superpowers/specs/2026-10-30-clearing-growth-design.md`

## Global Constraints

- Fire at (20, 15). The near-fire circle stays radius 4 (`BALANCE.campRadius`). Nothing that uses it today may change for a camp that hasn't grown.
- Reach on each side: today 4, near 6.5, far 9 east and west, far 8 north and south.
- Step costs: near is 4 marked trees + 4 wood + 2 fiber. Far is 6 marked trees + 6 wood + 3 fiber. Clearing the ground is a standard build (`payAndBuild`: `BALANCE.buildSeconds`, `BALANCE.buildEnergyCost`).
- Chopping a marked tree uses the existing chop: axe needed, 10 s, 8 energy, 2 wood, two free spaces.
- Only one step is marked at a time. You can switch freely until its first tree is felled. A far step needs that side's near step.
- This project adds no buildings. Messages and labels name a building only if it exists in `BUILDINGS` and isn't built yet.
- `SAVE_VERSION` goes from 17 to 18, and old saves are rejected.
- The year journal gets **no** clearing entry. The journal's rule is that every entry can be reached every year, and there are only eight clearing steps in total. This is the builder's call that the spec allows. The step message is enough.
- The field journal's map doesn't draw the clearing (`src/ui/journal.ts`), so it needs no change.
- No nested ternary expressions. Art stays aligned to whole art pixels. Copy is plain and in the tone of the existing messages.

## Review Focus

1. **Standing on new ground at night:** warmth drops as it does outside camp today, and the fire, shelter and windbreak don't help (Task 2).
2. **Reloading with a step marked and some trees felled:** the same trees are still marked, and the stumps are still stumps (Task 4, save round trip).
3. **Choosing another side after felling a tree:** refused, and the felled stump stays. Before any felling, switching removes the old marks (Task 3).
4. **A branch pile whose spot is now cleared:** it lands just outside the new edge, on the map, and can still be gathered (Task 4).
5. **Every step cleared:** none of the four places along the paths and not the lookout falls inside the clearing, and the clearing stays inside the map with a 2-tile border (Task 1).

---

### Task 1: Step data and the clearing's shape

**Files:**
- Create: `src/game/clearing.ts`
- Modify: `src/game/state.ts` (add `clearing` to `GameState` and `createGame`)
- Test: `tests/clearing.test.ts`

**Interfaces:**
- Produces:
  - `type Side = 'north' | 'east' | 'south' | 'west'`
  - `type StepId = \`${Side}-${'near' | 'far'}\``
  - `STEP_IDS: readonly StepId[]`
  - `interface ClearingStep { side: Side; reach: number; cost: { wood: number; fiber: number; stone: number }; trees: readonly { x: number; y: number; sprite: 'treeBroadleaf' | 'treePine' }[]; room: readonly string[] }`
  - `CLEARING_STEPS: Record<StepId, ClearingStep>`
  - `interface ClearingState { cleared: StepId[]; marked: StepId | null; felled: number[] }`. `felled` holds indexes into the marked step's `trees`.
  - `sideAt(x: number, y: number): Side`
  - `clearingReach(x: number, y: number, cleared: readonly StepId[]): number`, the clearing's radius in the direction of (x, y) from the fire
  - `inClearing(x: number, y: number, cleared: readonly StepId[]): boolean`
  - `clearingKey(cleared: readonly StepId[]): string`. It returns `'none'` when empty, and otherwise the steps in `STEP_IDS` order joined with `+`.

- [ ] **Step 1: Write the failing tests** in `tests/clearing.test.ts`:
  - `sideAt`: (20, 10) → north, (26, 15) → east, (20, 20) → south, (14, 15) → west.
  - With nothing cleared, `clearingReach` is 4 everywhere, and `inClearing` matches `Math.hypot(dx, dy) <= 4` for every tile.
  - With `['north-near']`: reach due north is 6.5, and due east, south and west it's still 4.
  - With all eight steps: reach due east and west is 9, due north and south is 8.
  - At a side boundary (angles ±30° and ±150° from the fire, with y pointing down), reach is the mean of the two sides' reaches.
  - 20° or more from a boundary, reach equals that side's reach.
  - For every step, each marked tree is on the step's side, at a distance greater than the previous reach and at most the step's own reach + 0.5. No two marked trees across all steps are closer than 1.2. Each tree is at least 1.5 from every `createGame()` node that isn't a branch.
  - Near steps have 4 trees and cost `{ wood: 4, fiber: 2, stone: 0 }`. Far steps have 6 trees and cost `{ wood: 6, fiber: 3, stone: 0 }`.
  - `room`: north-near `['larder']`, north-far `['house']`, east-near `['woodpile', 'fibreStack']`, east-far `['workshop']`, west-near `['vegetableBeds']`, west-far `['well']`, and both south steps `[]`.
  - Review Focus 5: with all eight cleared, `inClearing` is false for `SITES.basket`, `SITES.spring`, `SITES.cairn` and `LOOKOUT`, and false for every tile within 2 of the map edge.
  - `createGame().clearing` is `{ cleared: [], marked: null, felled: [] }`.
  - `clearingKey([])` is `'none'`, and `clearingKey(['west-near', 'north-near'])` is `'north-near+west-near'`.

- [ ] **Step 2: Run** `npm test -- --run tests/clearing.test.ts`. Expected: FAIL, because the module isn't found.

- [ ] **Step 3: Implement `src/game/clearing.ts` and the state field.** Work out reach per side as follows: 4 if neither of the side's steps is cleared, 6.5 if its near step is, and its far reach if its far step is. Within 20° of a boundary, blend linearly between the two sides' reaches, reaching the mean at the boundary. Choose the marked trees' positions yourself so that the tests pass and the trees stay off the diagonal paths: at least 1.35 tiles from each fire-to-`PATH_DESTINATIONS` line, as `clearForTree` checks today. Copy the four destinations into `clearing.ts` rather than importing from `src/scene`.

- [ ] **Step 4: Run** `npm test -- --run tests/clearing.test.ts`. Expected: PASS.

- [ ] **Step 5: Commit:** `git commit -m "Describe the clearing's sides, steps and shape"`

---

### Task 2: Split "at camp" into near the fire and in the clearing

**Files:**
- Modify: `src/game/camp.ts`, `src/game/rules.ts`, `src/game/companion.ts`, `src/game/journalEntries.ts`, `src/scene/prompts.ts`, `src/ui/App.ts`
- Test: `tests/rules.test.ts`, `tests/companion.test.ts`

**Interfaces:**
- Consumes: `inClearing` (Task 1)
- Produces: `isInClearing(state: GameState): boolean` in `src/game/camp.ts`, re-exported from `rules.ts` like `isAtCamp`. `isAtCamp` doesn't change.

Change these callers to `isInClearing`:
- `buildStatus` and `buildBlocker` (rules.ts:136, 636)
- the stone pile (435)
- stargazing (106)
- the garden (578, 589)
- the axe (323), the pickaxe (115), and the companion's item-making (companion.ts:164)
- offerings (companion.ts:48, 54)
- the journal moments `leaves`, `fox`, `fireflies` and `goldEvening`
- the hint in `prompts.ts:119`
- the build hint in `App.ts:461`

Everything else keeps `isAtCamp`: warmth in `advanceTime`, the drying rack, sleeping, cooking, the fire, rest, the default E-to-rest, the fire tap target, the `coldFront` and `winterFire` journal moments, and `nightHint`. The soundscape and the companion's pose don't change.

- [ ] **Step 1: Write the failing tests** in `tests/rules.test.ts`, under `describe('the grown clearing')`:
  - With `clearing.cleared = ['north-near']` and the player at (20, 9.5) (distance 5.5, on new ground):
    - `isInClearing` is true and `isAtCamp` is false.
    - `buildStatus(state, 'windbreak')` is `'ready'` when the player has 5 wood.
    - `applyAction(state, { type: 'rest' })` returns the same state.
    - `sleepBlocker` returns `'Return to the marked camp area to sleep.'`
  - Review Focus 1: at night with the fire lit, the shelter and the windbreak built, `advanceTime(state, 10).player.warmth` at (20, 9.5) with `north-near` cleared equals the result at (20, 9.5) with nothing cleared.
  - With nothing cleared, `isInClearing` equals `isAtCamp` at 50 random positions on the camp map.
  - In `tests/companion.test.ts`: an offering is available on the new ground at (20, 9.5) with `north-near` cleared, under conditions where it's available at camp today.

- [ ] **Step 2: Run** `npm test -- --run tests/rules.test.ts tests/companion.test.ts`. Expected: the new tests FAIL.

- [ ] **Step 3: Implement** `isInClearing` as `state.area === 'camp' && inClearing(state.player.x, state.player.y, state.clearing.cleared)`, then switch the callers listed above.

- [ ] **Step 4: Run** `npm test -- --run`. Expected: everything passes, including all the existing tests unchanged.

- [ ] **Step 5: Commit:** `git commit -m "Tell the clearing apart from the warmth around the fire"`

---

### Task 3: Marking a side and felling its trees

**Files:**
- Modify: `src/game/clearing.ts`, `src/game/rules.ts` (the `GameAction` union, the action table, `chopTree`)
- Test: `tests/clearing.test.ts`

**Interfaces:**
- Consumes: `CLEARING_STEPS`, `ClearingState` (Task 1), `isInClearing` (Task 2)
- Produces:
  - `GameAction` gets `{ type: 'markClearing'; step: StepId }`.
  - `markedTrees(state: GameState): TreeNode[]`. Ids are `mark-${step}-${index}`. `readyDay` is `Number.MAX_SAFE_INTEGER` for felled trees and `1` otherwise. The sprite comes from the step data. It returns `[]` when nothing is marked.
  - `choppableTrees(state: GameState): TreeNode[]` returns `[...state.trees, ...markedTrees(state)]`.
  - `markBlocker(state: GameState, step: StepId): string | null`
  - `nextStep(state: GameState, side: Side): StepId | null` returns the side's next uncleared step, or null if the side is fully cleared.

- [ ] **Step 1: Write the failing tests**:
  - `markBlocker` returns, in this order of checks:
    - `'Craft a stone axe to clear land.'` without the axe
    - `'Return to camp to clear land.'` outside the clearing
    - `'Clear the near ground on that side first.'` for a far step whose near step isn't cleared
    - `'That ground is already clear.'` for a cleared step
    - `'Finish clearing the north side first.'` when `north-near` is marked with `felled: [0]` and another step is asked for
    - otherwise null
  - Marking `east-near` with the axe, in the clearing, does the following:
    - sets `clearing.marked = 'east-near'` and `felled = []`
    - takes no time and costs nothing
    - gives the message `'Tied pale fibre round 4 trees on the east side.'`
  - Review Focus 3: with `north-near` marked and `felled: []`, marking `east-near` replaces it, and `markedTrees` then contains only `mark-east-near-*` ids. With `felled: [0]`, it's refused and the state is unchanged.
  - `chopTree` with a `mark-…` id:
    - succeeds near the tree: +2 wood, 8 energy, the existing chop time
    - adds the index to `felled`
    - leaves `state.trees` unchanged
    - is refused with `'Move closer to a mature tree.'` when far away, and with `'Your bag needs two free spaces for wood.'` when the bag has one space free
  - A felled marked tree reports `readyDay > state.day` 1000 days later, so it never regrows. Chopping it again is refused with the existing stump message.

- [ ] **Step 2: Run** `npm test -- --run tests/clearing.test.ts`. Expected: the new tests FAIL.

- [ ] **Step 3: Implement** the `markClearing` handler and `markBlocker`. Then make `chopTree` look its tree up in `choppableTrees(state)`. For a marked id it updates `clearing.felled` rather than `trees`, and keeps every other check exactly as it is.

- [ ] **Step 4: Run** `npm test -- --run`. Expected: PASS.

- [ ] **Step 5: Commit:** `git commit -m "Mark a side's edge trees and fell them with the axe"`

---

### Task 4: Clearing the ground, moving branches, and the save

**Files:**
- Modify: `src/game/clearing.ts`, `src/game/rules.ts`, `src/game/state.ts` (createGame uses the placement helper), `src/game/save.ts`
- Test: `tests/clearing.test.ts`, `tests/save.test.ts`

**Interfaces:**
- Consumes: Tasks 1 to 3
- Produces:
  - `GameAction` gets `{ type: 'clearGround' }`.
  - `clearGroundBlocker(state: GameState): string | null`
  - `placeBranches(nodes: readonly ResourceNode[], cleared: readonly StepId[]): ResourceNode[]`. It takes `createGame()`'s base nodes and returns them with every branch whose base spot is inside the clearing moved to just outside it.
  - `roomLine(step: StepId, structures: Partial<Record<string, boolean>>, known: (id: string) => boolean): string`
  - `SAVE_VERSION = 18`

- [ ] **Step 1: Write the failing tests**:
  - `clearGroundBlocker` returns, in order:
    - `'Choose a side to clear first.'` when nothing is marked
    - `'Fell the 3 marked trees left first.'` with 1 of 4 felled
    - `'Return to camp to clear land.'` outside the clearing
    - the existing tired message when exhausted
    - `'Need 4 wood and 2 fiber to clear this.'` when short of materials
    - otherwise null
  - Clearing `north-near` with all 4 felled and 4 wood and 2 fiber:
    - `cleared` gains `'north-near'`, `marked` becomes null and `felled` becomes `[]`
    - wood −4 and fiber −2, with build time and energy
    - the message is `'The north side is open now.'`
  - `roomLine('north-near', {}, id => id === 'larder')` returns `" There's room for a larder now."`. `roomLine('east-near', {}, () => true)` names both ("a woodpile and a fibre stack"). `roomLine('north-near', { larder: true }, () => true)` and `roomLine('south-near', {}, () => true)` return `''`. Name buildings by their id with spaces before capital letters and in lower case (`fibreStack` → "fibre stack"), or by `BUILDINGS[id].name` once one exists.
  - Review Focus 4: for every subset of steps that `validClearing` allows, every branch from `placeBranches` is on the map, is not `inClearing`, and is within 2.5 tiles of the clearing's edge in its own direction. Branches whose base spot was outside the clearing don't move.
  - After `clearGround`, `state.nodes` equals `placeBranches(createGame().nodes, cleared)` for x and y, and keeps each node's amount and readyDay.
  - In `tests/save.test.ts`: the fixture versions move to 18. Review Focus 2: a save with `cleared: ['north-near']`, `marked: 'east-near'` and `felled: [1, 3]`, with the branches moved, survives a round trip. It's rejected when:
    - `felled` contains 9
    - `felled` is non-empty while `marked` is null
    - `cleared` contains `'west-far'` without `'west-near'`
    - `marked` is already in `cleared`
    - a moved branch's x doesn't match `placeBranches`
    - the save is version 17

- [ ] **Step 2: Run** `npm test -- --run tests/clearing.test.ts tests/save.test.ts`. Expected: the new tests FAIL.

- [ ] **Step 3: Implement.**
  - `placeBranches`: move each affected branch along its direction from the fire to `clearingReach + 1.5`, round to whole tiles, and nudge it one tile further out if it lands on another node.
  - `clearGround`: pay the cost with `payAndBuild(state, CLEARING_STEPS[step].cost, …)`, then run `placeBranches` over the current nodes' base positions.
  - The message is `\`The ${side} side is open now.\`` followed by `roomLine(step, state.structures, id => Object.hasOwn(BUILDINGS, id))`.
  - `save.ts`: add `validClearing` to `validState`'s checks. Make `validWorld` compare node positions against `placeBranches(createGame().nodes, save.clearing.cleared)`, and bump `SAVE_VERSION`.

- [ ] **Step 4: Run** `npm test -- --run`. Expected: PASS.

- [ ] **Step 5: Commit:** `git commit -m "Clear the ground, move the edge branches out, and save the clearing"`

---

### Task 5: Draw the grown clearing and the marked trees

**Files:**
- Modify:
  - `src/art/terrain.ts`: edge tiles for any shape, made on demand
  - `src/scene/map.ts`: `earthAt`, `clearForTree`, `campRimStones`, `layCampTile` and `terrainKey`/`shownTerrainKey` read the shape
  - `src/scene/art.ts`
  - `src/scene/visuals.ts`: marked trees with a tie, and stumps
  - `src/scene/tapTarget.ts` and `src/scene/prompts.ts`: use `choppableTrees`
  - `src/art/sprites.ts`: a `marked` frame for `treeBroadleaf` and `treePine`
- Test: `tests/map.test.ts`, `tests/visuals.test.ts`, `tests/tapTarget.test.ts`, `tests/prompts.test.ts`, `tests/art.test.ts`

**Interfaces:**
- Consumes: `clearingReach`, `inClearing`, `clearingKey`, `CLEARING_STEPS`, `markedTrees`, `choppableTrees`
- Produces:
  - `buildMap(nodes, key, time, clearing: ClearingState = { cleared: [], marked: null, felled: [] })`
  - `shownTerrainKey(state)` returns `\`${terrainKey(state)}-${clearingKey(state.clearing.cleared)}-${state.clearing.marked ?? 'unmarked'}-${season(state.day)}\``
  - `clearingTile(dx: number, dy: number, cleared: readonly StepId[]): string | undefined`, the replacement for `campCircleTile`. It returns `'full'` or an edge sprite name, and identical tiles share one sprite.

- [ ] **Step 1: Write the failing tests**:
  - `tests/map.test.ts`:
    - With nothing cleared, `buildMap`'s `ground`, `campEdges` and `rimStones` match today's output exactly. Snapshot them before the change, or compare against a recorded copy.
    - With `['north-near']`, ground at (20, 9) is earth and every rim stone is within 0.6 of `clearingReach` from the fire.
    - No grove tree is inside the clearing, and no grove tree is within 1.2 of any uncleared step's marked tree.
    - The trees of every uncleared step that isn't marked appear in `map.trees` with their plain sprites. The marked step's trees don't.
  - `tests/visuals.test.ts`: with `north-near` marked and `felled: [0]`, there's a visual `mark-north-near-0` with texture `stump:still`, and `mark-north-near-1` with `treeBroadleaf:marked` or `treePine:marked`.
  - `tests/tapTarget.test.ts` and `tests/prompts.test.ts`: tapping, or standing beside, an unfelled marked tree with the axe gives `{ type: 'chopTree', treeId: 'mark-north-near-1' }`.
  - `tests/art.test.ts`: the new `marked` frames pass the existing sprite validation and appear on the contact sheet.

- [ ] **Step 2: Run** `npm test -- --run tests/map.test.ts tests/visuals.test.ts tests/tapTarget.test.ts tests/prompts.test.ts tests/art.test.ts`. Expected: the new tests FAIL.

- [ ] **Step 3: Implement.**
  - Edge tiles test each pixel's distance from the fire against `clearingReach` at that pixel, using the same 2-pixel earth rim as today's circle. Memoise by `clearingKey` and offset, like `pathTileSets`.
  - The marked frame is the existing tree with a 2-pixel pale fibre band round the trunk, in palette colours.
  - Pass `state.clearing` through `art.ts` into `buildMap`.

- [ ] **Step 4: Run** `npm test -- --run`, then `npm run lint`. Expected: PASS, with no lint errors.

- [ ] **Step 5: Commit:** `git commit -m "Draw the clearing at its grown size, with marked trees and their stumps"`

---

### Task 6: The "Clear the land" panel and the README

**Files:**
- Modify: `src/ui/panels.ts`, `src/ui/App.ts`, `src/style.css` (reuse the build-item styles), `README.md`
- Test: `tests/panels.test.ts`

**Interfaces:**
- Consumes: `nextStep`, `markBlocker`, `clearGroundBlocker`, `roomLine`, `CLEARING_STEPS`
- Produces: `clearingView(state: GameState): { shown: boolean; sides: { side: Side; label: string; detail: string; disabled: boolean; done: boolean }[]; clear: ActionPanelView }`

- [ ] **Step 1: Write the failing tests** in `tests/panels.test.ts`:
  - `clearingView(createGame()).shown` is false, and true once `progress.axeCrafted` is set.
  - Each side's label is `\`${Side} · ${'near' | 'far'}\``, with the side name capitalised, as in "North · near". Its detail is `'4 trees, then 4 wood and 2 fiber'` for a near step, followed by `roomLine` text when there is any. `done` is true and the label reads `'North · cleared'` once both of that side's steps are cleared.
  - `clear.title` is `'Clear the ground'`. `clear.copy` reads `'Fell the 3 marked trees left on the north side.'` while trees remain, and `'Ready to clear the north side.'` when none are left. `disabled` follows `clearGroundBlocker`.
  - The marked side's entry is shown as chosen. The other entries are disabled once a tree on the marked side has been felled.

- [ ] **Step 2: Run** `npm test -- --run tests/panels.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement** the view. In `App.ts`, add a "Clear the land" group to the Build tab after the build list. Use `data-clear-side` buttons that dispatch `markClearing`, and a clear button that dispatches `clearGround`. Change the build hint to `'Stand anywhere in the clearing to build.'`.

- [ ] **Step 4: Update `README.md`.**
  - Explain choosing a side, marked trees, clearing the ground and the costs.
  - Explain that building works anywhere in the clearing while the fire's warmth, resting and sleeping stay within the old circle around the fire.
  - Note that branch piles move out to the new edge.
  - Update the save version to 18 and its list of saved things.
  - Add the clearing to the test list.

- [ ] **Step 5: Verify the whole branch:** `npm run lint && npm test -- --run && npm run build`. Expected: all three succeed.

- [ ] **Step 6: Browser check** with the `run` skill, at desktop size and on a phone held upright:
  - Craft the axe, mark the north side, fell the four trees, clear the ground, and see the new earth, rim stones and moved branches.
  - Reload partway through and confirm the marks and stumps are still there.
  - Stand on the new ground at night and see warmth fall.

- [ ] **Step 7: Commit:** `git commit -m "Choose and clear land from the Build tab, and document the growing clearing"`
