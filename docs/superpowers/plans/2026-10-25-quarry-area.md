# Quarry Area Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After the shelter is built, a west path leads off the camp map into a rocky second area. There you find a quarry, which has hand-gathered rubble and can be dug for stone with a pickaxe made at a new toolshed. At night, harmless glowing eyes watch from the dark.

**Architecture:** `GameState` gains an `area` (`'camp' | 'quarry'`), and every rule and every target is scoped to the area the survivor is in. Area constants and crossing logic live in a new pure module, `src/game/areas.ts`. The scene redraws its terrain whenever a terrain key, made from the area and whether the path is open, changes. The eyes are pure timing functions in `src/scene/ambient.ts`, driven by `AmbientLife`.

**Tech Stack:** TypeScript, Phaser 4, Vite, Vitest, oxlint.

**Spec:** `docs/superpowers/specs/2026-10-25-quarry-area-design.md`

## Global Constraints

- Rules stay pure in `src/game/`, with Vitest coverage, following `applyAction`, `BALANCE`, `buildStatus` and the `readyDay` patterns.
- Toolshed: **5 wood, 2 fiber**, prerequisite `shelter`. Stone axe: unchanged cost, and now needs the **toolshed and a weathered cold night**. Pickaxe: **2 wood, 1 fiber, 2 stone**; needs the **toolshed and the quarry found**, but not the axe. Stone is paid through `spendStone`.
- Rubble: **1 stone**, needs **2 free spaces**, and refills **3 dawns** later. It's ready on the first visit.
- Dig: **10 s, 8 energy, 1 stone**, needs 2 free spaces and the pickaxe. The quarry is then spent until the next dawn.
- Camp rocks drop from 6 to **3**.
- "At camp" means `area === 'camp'` **and** within `campRadius`. Sites, the lookout, sleep, build, craft, fire, the stone pile, and weathering the cold front all need the camp area.
- Glowing eyes are purely visual. They show only at night and only in the quarry area, and a pair fades out within **4 tiles** of the survivor. No more than **3 pairs** are visible at once.
- `SAVE_VERSION` is **12**. Every earlier version is rejected.
- Phone buttons are at least 44 px tall. Text meets WCAG AA (4.5:1). Pixel art follows `docs/superpowers/specs/2026-10-21-pixel-art-direction.md`.
- `npm run lint`, `npm test -- --run` and `npm run build` all pass.

## Review Focus

- **Edge outside the crossing:** walking into the west edge at y=10 stays blocked, while y=15±1 crosses. Test in Task 1.
- **Cold night spent at the quarry:** standing at the quarry area's (20,15) during the cold front doesn't count as at camp. Test in Task 1.
- **Taps and E in the wrong area:** in the quarry area, camp nodes, trees, sites, the lookout and the fire are never targets, and quarry piles are never targets at camp. Tests in Tasks 2 and 5.
- **Soft lock:** with 0 stone anywhere, the shelter and toolshed built, and the quarry found, dawns plus rubble alone eventually afford the pickaxe. Test in Task 2.
- **Reload in the quarry area:** a saved quarry-area state round-trips, and the scene's terrain key reads `quarry`. Tests in Tasks 3 and 4.

---

### Task 1: Areas, the west crossing, and camp scoping

**Files:**
- Create: `src/game/areas.ts`
- Modify: `src/game/state.ts`, `src/game/rules.ts`
- Test: `tests/areas.test.ts`, `tests/rules.test.ts`, `tests/state.test.ts`

**Interfaces:**
- Produces:
  - In `state.ts`: `type AreaId = 'camp' | 'quarry'`; `GameState.area: AreaId` (with `createGame` setting it to `'camp'`); and `stonePositions` cut to `[[31, 10], [11, 22], [29, 21]]`, so the ids are `stone-0` to `stone-2`.
  - In `areas.ts`:
    - `CROSSING = { y: 15, halfWidth: 1 }`
    - `CAMP_EXIT = { x: 0, y: 15 }` and `QUARRY_EXIT = { x: BALANCE.mapWidth - 1, y: 15 }`
    - `QUARRY_SITE = { x: 12, y: 12 }` and `RUBBLE_SITE = { x: 16, y: 16 }`
    - `pathOpen(state): boolean`, true when `structures.shelter` is built
    - `crossing(state, rawX, rawY): { area: AreaId; x: number; y: number } | null`
  - In `rules.ts`: a new action `{ type: 'cross' }`, plus `isAtCamp`, which now also requires `area === 'camp'`.

- [ ] **Step 1: Write the failing tests**
  - `areas.test.ts`:
    - `the west path is closed until the shelter is built`: `pathOpen(createGame())` is false, and true once the shelter is set.
    - `crossing leaves camp only at the path end`: with the shelter built and the player at (0.1, 15), `crossing(state, -0.2, 15)` equals `{ area: 'quarry', x: BALANCE.mapWidth - 1.5, y: 15 }`; `crossing(state, -0.2, 10)` is null; and without the shelter, `crossing(state, -0.2, 15)` is null.
    - `crossing returns from the quarry at its east edge`: in area `'quarry'`, `crossing(state, BALANCE.mapWidth - 0.8, 15.6)` equals `{ area: 'camp', x: 0.5, y: 15.6 }`.
  - `rules.test.ts`, in a new describe `'the second area'`:
    - `walking off the west edge at the path crosses into the quarry`: a `move` with dx −1 from (0.05, 15) results in `area` `'quarry'`.
    - `the west edge still blocks away from the path`: the same move at y=10 stays in camp with x 0.
    - `cross needs to stand at the path end`: `cross` at (5, 15) is refused with "Walk to the end of the west path to cross."; at (0.4, 15) it crosses.
    - `camp actions need the camp area`: in area `'quarry'` with the player at (20, 15), `isAtCamp` is false, and `stokeFire`, `sleep` and `build` are refused with their existing "Return to camp" style messages.
    - `sites and the lookout only answer in the camp area`: in area `'quarry'` at `SITES.spring`, `visitSite` is refused with "There is nothing like that here."
    - `the cold front counts the quarry as away from camp`: on a cold night in area `'quarry'` at (20, 15), the state is treated as away from camp. Assert the outcome by comparing against the same setup in camp, using the existing cold-night test helpers.
  - `state.test.ts`: `createGame()` has 3 stone nodes, and `area` is `'camp'`.
- [ ] **Step 2: Run** `npx vitest --run tests/areas.test.ts tests/rules.test.ts tests/state.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - `move`: compute the raw unclamped x and y. If `crossing(...)` returns a value, apply it (area, x, y). Otherwise clamp as today.
  - `cross`: valid only within 0.5 tile of the current area's exit, and only while `pathOpen`.
  - Gate `visitSite` and `repairLookout` on `area === 'camp'`. They return "There is nothing like that here." when in the quarry area.
  - Update `state.test.ts` and any other fixtures that count six rocks.
- [ ] **Step 4: Run** `npx vitest --run --dir tests`. Expected: PASS.
- [ ] **Step 5: Commit**: `git commit -am "Add the quarry area and the west crossing"`

### Task 2: Quarry, rubble, toolshed, and tools

**Files:**
- Modify: `src/game/state.ts`, `src/game/rules.ts`, `src/game/areas.ts`
- Test: `tests/rules.test.ts`, `tests/hud.test.ts`

**Interfaces:**
- Consumes: `AreaId`, `QUARRY_SITE`, `RUBBLE_SITE` and `isAtCamp` from Task 1.
- Produces:
  - `BUILDINGS.toolshed = { name: 'Toolshed', description: 'Make tools here', symbol: '⚒', cost: { wood: 5, fiber: 2 }, prerequisite: 'shelter' }`, placed after `crate`.
  - New `BALANCE` entries: `rubbleRegrowDays: 3`, `digSeconds: 10`, `digEnergyCost: 8`.
  - `PICKAXE = { cost: { wood: 2, fiber: 1, stone: 2 } }`, in `state.ts`.
  - New `GameState` fields:
    - `progress.quarryFound: boolean` and `progress.pickaxeCrafted: boolean`
    - `quarryReadyDay: number` and `rubbleReadyDay: number`, both starting at 1
  - `StonePile` gains `area: AreaId`.
  - Actions: `'craftPickaxe' | 'gatherRubble' | 'digQuarry'`.
  - `pickaxeBlocker(state): string | null`, exported for the UI.

- [ ] **Step 1: Write the failing tests**, in a describe `'quarry and tools'`:
  - `reaching the quarry finds it`: moving to within 2 tiles of `QUARRY_SITE` in the quarry area sets `quarryFound` with the message "You found an old quarry. A pickaxe could work this stone."
  - `rubble gives one stone and refills three dawns later`: `gatherRubble` beside `RUBBLE_SITE` adds stone +1 and sets `rubbleReadyDay = day + 3`. A second try is refused with "The rubble is picked over. More will loosen in a few days." On `day + 3`, it works again.
  - `rubble needs room for heavy stone`: with 7/8 spaces used, it returns `FULL_BAG_MESSAGE` and the same state object.
  - `the toolshed needs the shelter and costs 5 wood and 2 fiber`, using `buildStatus` and `build`.
  - `the axe needs the toolshed`: the cold front is weathered and the materials are present, but there's no toolshed, so it's refused with "Build a toolshed first."
  - `the pickaxe needs the toolshed and the quarry, not the axe`:
    - With no quarry found: "Find the quarry first."
    - With no toolshed: "Build a toolshed first."
    - With both: it crafts, and `axeCrafted` stays false.
    - Paying with 1 bag stone plus 1 stored stone leaves 0 and 0.
  - `digging needs the pickaxe and works once a day`:
    - With no pickaxe: "You need a pickaxe to work the quarry."
    - With one: stone +1, energy −8, 10 s pass, and `quarryReadyDay = day + 1`.
    - A second try that day: "The quarry face is worked out until morning."
  - `dropped stone stays in its area`: `dropStone` in the quarry area makes a pile with `area: 'quarry'`. In camp, it never merges into that pile, and `pickUpStone` of that pile is refused with "There is no stone pile within reach."
  - `rubble and dawns alone always lead to a pickaxe` (soft-lock check):
    - Start: 0 bag stone, 0 stored, every rock spent, the cairn found, the shelter and toolshed built, the quarry found, 2 wood and 1 fiber.
    - Loop up to 20 days: walk to the rubble, gather if it's ready, return to camp, and advance to the next dawn.
    - Assert that `craftPickaxe` succeeds before the loop ends.
  - `hud.test.ts`: `pickaxeBlocker` returns null when crafting is possible, and otherwise returns the matching message above.
- [ ] **Step 2: Run** `npx vitest --run tests/rules.test.ts tests/hud.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - Quarry discovery is part of `move` in the quarry area.
  - `gatherRubble` and `digQuarry` reuse `near()`, `freeSpaces` and `advanceTime`, with `gatherSeconds`/`gatherEnergyCost` for rubble and `digSeconds`/`digEnergyCost` for digging, both as 'working'.
  - `craftPickaxe` mirrors `craftAxe`, including `spendStone`.
  - `craftAxe` checks for the toolshed after the cold-front check.
  - `dropStone` and `pickUpStone` only see piles where `pile.area === state.area`. New pile ids include the area: `pile-${area}-${day}-…`.
- [ ] **Step 4: Run** `npx vitest --run --dir tests`. Expected: PASS.
- [ ] **Step 5: Commit**: `git commit -am "Quarry rubble and digging, the toolshed, and the pickaxe"`

### Task 3: Save version 12

**Files:**
- Modify: `src/game/save.ts`
- Test: `tests/save.test.ts`, `tests/savePlay.test.ts`

**Interfaces:**
- Consumes: every field added in Tasks 1 and 2.

- [ ] **Step 1: Write the failing tests:**
  - `round-trips a camp left in the quarry area`: area `'quarry'`, a quarry pile, the toolshed, `quarryFound`, `pickaxeCrafted`, and both ready days.
  - `rejects every earlier version`: versions 1 to 11.
  - `rejects impossible quarry progress`, with one case each:
    - `area: 'mine'`
    - area `'quarry'` without the shelter
    - `quarryFound` without the shelter
    - `pickaxeCrafted` without `quarryFound`
    - `pickaxeCrafted` without the toolshed
    - `axeCrafted` without the toolshed
    - `quarryReadyDay` greater than `day + 1`
    - `rubbleReadyDay` greater than `day + 3`
    - a pile with no `area`
  - `savePlay.test.ts`: add `'cross'`, `'gatherRubble'`, `'digQuarry'` and `'craftPickaxe'` to the random actions, plus a branch that walks to `QUARRY_SITE` in the quarry area. Every state reached must still save and load.
- [ ] **Step 2: Run** `npx vitest --run tests/save.test.ts tests/savePlay.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** Set `SAVE_VERSION = 12`, and extend `validState` with the rules above.
- [ ] **Step 4: Run** `npx vitest --run --dir tests`. Expected: PASS.
- [ ] **Step 5: Commit**: `git commit -am "Save version 12 with the quarry area"`

### Task 4: Terrain for the open path and the quarry area

**Files:**
- Modify: `src/scene/mapGeometry.ts`, `src/art/terrain.ts`, `src/scene/map.ts`, `src/scene/art.ts`, `src/scene/GameScene.ts`
- Test: `tests/map.test.ts`

**Interfaces:**
- Consumes: `AreaId`, `pathOpen`, `CAMP_EXIT`, `QUARRY_EXIT` and `QUARRY_SITE`.
- Produces:
  - `terrainKey(state): string`, in `map.ts`. It returns `'camp'`, `'camp-open'` or `'quarry'`.
  - `buildMap(nodes, key)`
  - `drawTerrain(scene, state): Phaser.GameObjects.GameObject[]`, which returns every object it adds and uses the texture key `terrain-${key}`.
  - `pathDistance(x, y, destinations)` and `pathTile(x, y, destinations)`, both taking an explicit list of destinations.

- [ ] **Step 1: Write the failing tests:**
  - `terrainKey follows the area and the shelter`: `createGame()` gives `'camp'`, the shelter gives `'camp-open'`, and area `'quarry'` gives `'quarry'`.
  - `the west path is drawn only once open`: `buildMap(nodes, 'camp')` has no path tile at x ≤ 2 on y=15, while `'camp-open'` does. No border tree sits within 1.35 tiles of that path.
  - `the quarry map is rocky and open`:
    - `buildMap([], 'quarry')` has no camp circle edges.
    - It has a path tile at (38, 15) and one within 2 tiles of `QUARRY_SITE`.
    - It has fewer than half the trees of the camp map, and at least twice its stone decals.
- [ ] **Step 2: Run** `npx vitest --run tests/map.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - The quarry ground uses `earth` and `grass` tiles mixed by hash, with `pebbles` decals, and trees only on part of the border.
  - In `GameScene`, `create` draws `terrainKey(state)`. In `update`, when the key changes, destroy the old objects, remove the old texture, redraw, and call `setBounds` again.
  - Existing map tests keep passing with the four original destinations.
- [ ] **Step 4: Run** `npx vitest --run --dir tests`. Expected: PASS.
- [ ] **Step 5: Commit**: `git commit -am "Draw the west path and the quarry area"`

### Task 5: Scene objects, taps and prompts in each area

**Files:**
- Modify: `src/art/phase3Sprites.ts`, `src/scene/visuals.ts`, `src/scene/tapTarget.ts`, `src/scene/GameScene.ts`, `src/scene/SceneLighting.ts`, `src/scene/ambientLife.ts`
- Test: `tests/visuals.test.ts`, `tests/tapTarget.test.ts`, `tests/lighting.test.ts`

**Interfaces:**
- Consumes: `QUARRY_SITE`, `RUBBLE_SITE`, `CAMP_EXIT`, `QUARRY_EXIT`, and the Task 2 actions.
- Produces:
  - New sprites: `quarry` (`ready`, `spent`), `rubble` (`ready`, `gathered`), `toolshedSite` (`still`) and `toolshed` (`built`).
  - `TapTarget` gains `{ kind: 'crossing'; x; y }`, `{ kind: 'quarry'; x; y }` and `{ kind: 'rubble'; x; y }`. Their actions are `cross`, `digQuarry` and `gatherRubble`.
  - `closestGatherable` adds `{ kind: 'rubble' }` (when ready) and `{ kind: 'quarry' }` (when ready, with or without the pickaxe), in the quarry area only.

- [ ] **Step 1: Write the failing tests:**
  - `visuals.test.ts`:
    - `the quarry area shows only its own things`: in area `'quarry'`, the visuals contain `quarry:ready`, `rubble:ready`, and any quarry-area piles, and no node, tree, site, camp structure, fire or lookout ids.
    - `spent quarry and gathered rubble`: with `quarryReadyDay = day + 1`, it shows `quarry:spent`, and with `rubbleReadyDay` in the future, `rubble:gathered`.
    - `the toolshed site, then the toolshed`: the site is a ground decal (`GROUND_DECAL_DEPTH`), and the built toolshed is depth-sorted.
    - The camp view never shows quarry-area piles.
  - `tapTarget.test.ts`:
    - `taps in the quarry area never pick camp things`: tapping at a camp node's position in area `'quarry'` gives ground.
    - `tapping the path end picks the crossing once open`: in camp, a tap at (0.3, 15) gives `crossing` only when the shelter is built.
    - `closestGatherable finds rubble and the quarry`.
    - `maps the new targets to actions`.
  - `lighting.test.ts`: there's no fire glow in the quarry area (test the pure helper `SceneLighting` uses, whether that's `fireRadii` or the function that decides to draw).
- [ ] **Step 2: Run** `npx vitest --run tests/visuals.test.ts tests/tapTarget.test.ts tests/lighting.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - `sceneVisuals` branches on `state.area`.
  - The toolshed goes on a free camp spot, checked in a zoomed camp screenshot.
  - `GameScene` prompts:
    - `E  Gather rubble`
    - `E  Dig the quarry`
    - `Quarry · craft a pickaxe at the toolshed`
    - `Quarry · worked out until morning`
    - `Walk west to leave camp`, shown at the exit once open
    - `Walk east to return to camp`
  - `AmbientLife` hides the birds, fox and fireflies in the quarry area.
- [ ] **Step 4: Run** `npx vitest --run --dir tests`. Expected: PASS.
- [ ] **Step 5: Commit**: `git commit -am "Quarry, rubble and toolshed in the scene"`

### Task 6: Glowing eyes at night

**Files:**
- Modify: `src/scene/ambient.ts`, `src/scene/ambientLife.ts`, `src/art/` (in whichever file holds the `firefly` sprite)
- Test: `tests/ambient.test.ts`, `tests/ambientLife.test.ts`

**Interfaces:**
- Produces:
  - `EYE_SPOTS: Point[]`: 6 spots spread across the quarry area, each at least 5 tiles from `QUARRY_SITE`.
  - `eyesAt(index: number, timeMs: number, dark: number, player: Point): { x: number; y: number; alpha: number; frame: 'open' | 'blink' } | null`
  - An `eyes` sprite: 7×3 pixels, with frames `open` and `blink`.

- [ ] **Step 1: Write the failing tests:**
  - `eyes only show in the dark`: with `dark` under 0.5, every index returns null.
  - `no more than three pairs at once`: sampled across 60 s with the player far away, at most 3 indices are non-null at any one time, and every index is non-null at least once.
  - `eyes back off and fade near the survivor`: with the player at 6 tiles, the pair is visible. At 4.5 tiles it's farther from the player than its spot, with alpha below 1. At under 4 tiles it returns null.
  - `eyes blink`: within a visible window, the frame is sometimes `blink`.
  - `ambientLife.test.ts`: no eye images are visible in camp or by day.
- [ ] **Step 2: Run** `npx vitest --run tests/ambient.test.ts tests/ambientLife.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - Each pair has a visible window of about 6 s in a 12 s cycle, offset by index.
  - The back-off moves the pair up to 1 tile directly away from the player.
  - The images sit at `LIGHT_DEPTH`, like fireflies.
- [ ] **Step 4: Run** `npx vitest --run --dir tests`. Expected: PASS.
- [ ] **Step 5: Commit**: `git commit -am "Glowing eyes watch the quarry at night"`

### Task 7: Tools panel, journal, README, and the browser check

**Files:**
- Modify: `src/ui/App.ts`, `src/ui/journal.ts`, `src/style.css`, `README.md`
- Test: `tests/journal.test.ts`

**Interfaces:**
- Consumes: `pickaxeBlocker`, `PICKAXE`, `quarryFound` and `toolshed`.

- [ ] **Step 1: Write the failing tests**, in `journal.test.ts`:
  - `the journal lists the quarry once the path opens`: before the shelter there's no quarry entry. After it, the entry is "Unexplored west path", and once found it becomes "Old quarry".
  - `the hint suggests the toolshed after the cold front`: with no toolshed, the hint is "Build a toolshed at camp to make tools."
  - `five paths in the closing line`: once everything is found, the lookout repaired and the quarry found, the hint is "You have followed all five paths. Your camp is home, and the woods are yours to wander."
- [ ] **Step 2: Run** `npx vitest --run tests/journal.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - Turn the axe panel into a **Tools** panel (eyebrow `FOREST TOOLS`). It holds the stone axe row as today, plus a pickaxe row that is hidden until `quarryFound`. The pickaxe row has a `data-action="craftPickaxe"` button, a cost of `2 wood · 1 fiber · 2 stone`, and blocker text from `pickaxeBlocker`. The axe copy says "Build a toolshed first." when the toolshed is missing.
  - The journal's quarry entry sits on the camp map at the west path's end, (1, 15).
  - Check the forecast and the early hints (`src/game/forecast.ts`, `journal.ts`): nothing before the cold night may ask for stone. Add a test if any copy changes.
  - README: cover the west path and the second area, the quarry, rubble, the toolshed, the pickaxe, three rocks, the eyes, and save version 12.
- [ ] **Step 4: Verify.**
  - Run `npm run lint && npm test -- --run && npm run build`.
  - Then run a Playwright script at 390×844 with touch, and at 1000×640. It seeds day 3 after the cold front, with the shelter built and materials in the bag, then checks that:
    - the path appears
    - walking off the west edge enters the quarry area
    - the quarry is found
    - the rubble is gathered
    - you can walk back and build the toolshed
    - the pickaxe can be crafted
    - you can dig, and the quarry then shows `spent`
    - after a reload in the quarry area, you continue there
    - at night, eyes appear and vanish when approached
    - there are no page errors
    - the phone page doesn't scroll
- [ ] **Step 5: Commit**: `git commit -am "Tools panel, journal and README for the quarry"`
