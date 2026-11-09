# The Town's Fourth Slice: The Meadow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** New ground for the town. You build a stone bridge over a stream at the foot of the hills, and it leads to a fifth area, the meadow. There the old traders' road waits to be cleared and marked with a milestone, and three more houses go up for the last newcomers.

**Architecture:**
- **The bridge** is built from the hills like the square: a `bridgeWork` action, with its own site rules in `src/game/bridgeSites.ts`.
- **The meadow** is a new `AreaId`. It's reached by a new south-edge crossing in `src/game/areas.ts`, and has its own terrain in `src/scene/map.ts`.
- **The road and milestone** are a `roadWork` action in `src/game/meadow.ts`.
- **Three plots and two jobs.** The meadow adds three plots (`HOUSE_COUNT` 12 → 15) and two jobs, carter and joiner, so every house can be filled.
- **Saves** go to version 43.

**Tech Stack:** TypeScript, Phaser, Vite, Vitest, oxlint.

**Spec:** `docs/superpowers/specs/2026-11-08-town-design.md` (sections "Where it stands", "Building it", "Jobs"), plus the "After this slice" note of `docs/superpowers/plans/2026-11-10-town-square.md`.

**User decisions (2026-11-09):**
- The new ground is a meadow across a stream off the hills' south edge. You reach it by building a stone bridge in stages: piers, arch and parapet.
- The old traders' road runs through the meadow, overgrown. The survivor clears it and sets a milestone. It's where market-day traders will arrive in the next slice.

**Planner's calls (the user can veto these at review):**
- **The meadow is sized to the jobs.** A house opens only while a job is free (`houseOpen`), so every plot needs a job, or "every house full" (the finish) could never happen.
- **Three plots.** The meadow has three plots: one for the fifth stallholder, and one each for two new jobs that take over building chores the survivor does now.
  - **Carter:** stone into the castle cart each dawn.
  - **Joiner:** beams made from the wood store each dawn.
- **Totals:** 15 houses and 15 jobs (8 camp, 5 stalls, carter, joiner).
- **The bridge opens early.** It opens once the **eighth** house is finished. It's built while the last hills houses go up, so the meadow is ready when the hills run out of plots.

## Global Constraints

- **EASTER EGG.** Every new file and test starts with a `// EASTER EGG: the town, see src/game/town.ts.` line. Nothing goes in the README or any player-facing help.
- **Copy** is plain and warm, not poetic, with no exclamation marks.
- **No new dependencies and no image files.** Sprites are drawn in code with `define(w, h, painters, anchor, legend)` from `src/art/sheepSprites.ts`, one character per pixel, and registered in `src/art/sprites.ts`.
- **Not a farming sim.** No crops or gatherable foods. Clearing the road gives nothing to eat.
- **Nothing is lost, and nothing needs upkeep.** Anything built stays built. Workers never fail.
- **Everything works by tap as well as by key, and while the survivor is weak.** Follow `prompts.ts` (`useKeyAction`/`promptFor`) and `tapTarget.ts` (`pickTapTarget`/`targetAction`).
- **Logic lives in tested helpers.** SonarCloud gates PRs at 80% on new code, and `App.ts` and the scene classes are untested.
- **Saves:** `SAVE_VERSION` 42 → 43, with an upgrade step. Validation rejects impossible states.
- **Checks:** `npx tsc --noEmit`, `npm run lint`, `npx vitest run`, `npm run build`. Also run the playthrough on **Node 24 and Node 26**: CI's `lts/*` is 26, and the scripted games differ between the two.
- **Run on Node 26 locally:**
  ```
  LD_LIBRARY_PATH=<scratch>/libatomic/x/usr/lib/x86_64-linux-gnu npx -y -p node@26 -- node node_modules/vitest/vitest.mjs run …
  ```
  `libatomic` comes from `apt-get download libatomic1` and `dpkg -x`.

## Review Focus

1. **A save made in the meadow.** It loads in the meadow, and the survivor can walk back over the bridge. *(Task 3 tests it.)*
2. **Night in the meadow.** Sleep says where to go, as it does on the hills ("Go to the keep door to sleep."), and nothing breaks if dusk falls there. *(Task 3 tests it.)*
3. **The pony and the cart.** The pony doesn't follow over the bridge, and the cart never leaves the quarry and the hills. The meadow's milestone takes stone carried in the bag. *(Tasks 3 and 4 test it.)*
4. **A worker who lives in the meadow** walks home over the bridge at dusk. They are never drawn on the hills while at home in the meadow, and never the other way round. *(Task 5 tests it.)*
5. **The joiner and the wood store.** The joiner never takes the wood store below `JOINER_WOOD_RESERVE`, so the survivor's fire can't be starved. *(Task 5 tests it.)*

---

### Task 1: The bridge, the road and three more plots in the save

**Files:**
- Create: `src/game/bridge.ts`, `src/game/meadow.ts`
- Modify:
  - `src/game/state.ts` (`AreaId` gains `'meadow'`);
  - `src/game/town.ts` (`TownState` gains `bridge` and `road`; `HOUSE_COUNT` 15);
  - `src/game/townSites.ts` (three meadow plots);
  - `src/game/saveUpgrades.ts` (`SAVE_VERSION` 43, upgrade from 42);
  - `src/game/save.ts` (area and town validation).
- Test: `tests/bridge.test.ts` (new); update `tests/town.test.ts`, `tests/townHouse.test.ts`, `tests/save.test.ts`, `tests/saveUpgrades.test.ts`.

**Interfaces:**
- **Produces, in `bridge.ts`:**
  - `BridgeStage = 'piers' | 'arch' | 'parapet'` and `BRIDGE_STAGES` in that order.
  - Needs, each taken in the order listed:
    ```
    BRIDGE_NEEDS = {
      piers:   { stone: 24 },
      arch:    { beams: 4, stone: 16 },
      parapet: { stone: 10, fittings: 2 }
    }
    ```
  - `BridgeState { stone: number; beams: number; fittings: number; doneDays: Partial<Record<BridgeStage, number>> }`. Counts are totals across all stages.
  - `emptyBridge()`.
  - `BRIDGE_HOUSES = 8`.
  - `bridgeStage(bridge): BridgeStage | null`: the stage being built, or null when it's done.
  - `bridgeDone(bridge): boolean`.
  - `bridgeOpen(state): boolean`: at least 8 houses have a `doneDay`, and the bridge isn't done.
- **Produces, in `meadow.ts`:**
  - `ROAD_SECTIONS = 6`, `ROAD_WORK = 4` (pieces of work per section), `MILESTONE_STONE = 6`.
  - `RoadState { cleared: number; work: number; milestone: number; doneDays: { road?: number; milestone?: number } }`. Here `cleared` counts sections, `work` is progress on the next section, and `milestone` is stone set.
  - `emptyRoad()`, `roadDone(road)`, `milestoneDone(road)`.
- **Town:**
  - `TownState.bridge: BridgeState` and `TownState.road: RoadState`.
  - `HOUSE_COUNT = 15`.
  - `HOUSE_PLOTS` gains `{ area: 'meadow', x: 20, y: 7 }`, `{ area: 'meadow', x: 28, y: 7 }` and `{ area: 'meadow', x: 20, y: 12 }`, as plots 12–14.
- **`AreaId`** gains `'meadow'`.
- **`GameState.progress.meadowFound: boolean`**, false in `createGame()`. The upgrade from 42 sets it false. It's valid only with the bridge done. Task 3 sets it.

- [ ] **Step 1: Write the failing tests.** In `bridge.test.ts`:
  - `emptyBridge()` has nothing laid. `bridgeStage` steps piers → arch → parapet → null as the counts reach 24 stone, then 4 beams and 40 stone, then 50 stone and 2 fittings.
  - `bridgeOpen` is false with 7 houses finished, true with 8, and false once the bridge is done.
  - The road: `emptyRoad()`, `roadDone` at 6 sections, and `milestoneDone` at 6 stone.

  In `town.test.ts`: `emptyTown()` has 15 houses, `bridge: emptyBridge()` and `road: emptyRoad()`.

  In `saveUpgrades.test.ts`: a version 42 save upgrades with 15 houses (the 12 kept, 3 empty), an empty bridge and an empty road.

  In `save.test.ts`:
  - **Accepts:**
    - the area `'meadow'` with the bridge done;
    - the bridge's piers laid with 8 houses finished;
    - a road section cleared with the bridge done;
    - a meadow house finished with the bridge done and plots 0–11 finished.
  - **Rejects**, each named:
    - `'meadow'` before the bridge is done;
    - bridge work with 7 houses finished;
    - arch beams before 24 stone;
    - parapet fittings before 40 stone;
    - road work before the bridge is done;
    - milestone stone before the road is cleared;
    - `work` at `ROAD_WORK` or more;
    - a meadow house worked before the bridge is done;
    - `meadowFound` true before the bridge is done;
    - `doneDays` missing for a finished stage, or present for an unfinished one.
- [ ] **Step 2: Run** `npx vitest run tests/bridge.test.ts tests/town.test.ts tests/save.test.ts tests/saveUpgrades.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - Wherever `save.ts` accepts an area (the survivor's area and dropped piles), it now accepts `'meadow'`.
  - Add `validBridge(bridge, houses, day)` and `validRoad(road, bridge, day)` beside `validSquare`, in its style.
  - A house on a meadow plot may hold work only once the bridge is done.
  - The upgrade comment reads: "Version 43: the bridge to the meadow, its road and three more plots. A version 42 town has none of them."
- [ ] **Step 4: Run** the same tests, then `npx vitest run`. Expected: PASS.
- [ ] **Step 5: Commit:** "Save the bridge, the meadow road and three more plots".

### Task 2: Building the bridge from the hills

**Files:**
- Create: `src/game/bridgeSites.ts`
- Modify:
  - `src/game/rules.ts` (`{ type: 'bridgeWork' }` and its handler, after `squareWork`);
  - `src/scene/prompts.ts` (a `bridgeChoice` in the hills choices; `bridgeWork: 'gather'`, dust effect);
  - `src/scene/tapTarget.ts` (kind `bridgeSite`);
  - `src/game/houseOpen.ts` (`townGoodNeed` adds the bridge's beams and fittings while it's open);
  - `src/ui/panels.ts` (`TOWN_GOOD_COPY` beams: "Four at a time, cut and dressed for the town's houses, stalls and bridge.").
- Test: `tests/bridgeSites.test.ts` (new); update `tests/squareSites.test.ts` for the goods copy.

**Interfaces:**
- **Consumes:** Task 1's `bridge.ts`.
- **Produces, in `bridgeSites.ts`:**
  - `BRIDGE_SITE = { x: 25, y: 28.6 }`: on the hills, in the gap between plots `[23,25]` and `[27,25]`, over the stream on row 29.
  - `bridgeSpot(state): { area: 'hills'; x: number; y: number } | null`.
  - `bridgeWorkBlocker(state): string | null`.
  - `bridgePrompt(state): string`.
  - `doBridgeWork(state): GameState`. Stone comes from the cart, then the bag, as `spendCastleStone` does.
  - `bridgeWorkLine(after: BridgeState): string`.
- **Copy:**
  - Prompts:
    - "Lay a pier stone (n/24)";
    - "Set an arch beam (n/4)";
    - "Lay an arch stone (n/16)";
    - "Lay a parapet stone (n/10)";
    - "Fit an iron cramp (n/2)".
  - Asking for what's missing (`squareSites`' `ASK` style):
    - "Bridge · bring stone up from the quarry";
    - "Bridge · make beams at the workshop";
    - "Bridge · make an iron fitting at the forge".
  - Lines:
    - each piece: "You lay another stone on the bridge.";
    - piers done: "The piers stand in the stream.";
    - arch done: "The arch is closed. It holds.";
    - parapet done: "The bridge is finished. The far bank is open."
  - Blockers:
    - "There is nothing to build here yet.";
    - "Move closer to the bridge.";
    - the short asks as in `squareSites`' `SHORT`;
    - `TOO_TIRED_MESSAGE`.

- [ ] **Step 1: Write the failing tests** in `bridgeSites.test.ts`, with fixtures built from `finishedCastleCamp()` and `street(...)`:
  - With 8 houses finished, the prompt, the E key and a tap all give `{ type: 'bridgeWork' }`. With 7 there's no spot.
  - Each stage's prompt and line as worded above. `doneDays` gets the day each stage finishes.
  - It asks for what's missing, takes the cart's stone before the bag's, and refuses from too far away.
  - `goodRoom(state, 'beams')` rises by 4 while the arch's beams are unset, and `'fittings'` by 2 for the parapet.
  - The bridge site stays clear of every house plot and the square (distance > 1.5), and it stands on row 29's stream (`Math.floor(BRIDGE_SITE.y + 0.5) === 29`).
- [ ] **Step 2: Run** `npx vitest run tests/bridgeSites.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement**, mirroring `squareSites.ts` piece for piece.
- [ ] **Step 4: Run** it, then `npx vitest run`. Expected: PASS.
- [ ] **Step 5: Commit:** "Build the bridge from the hills: its piers, its arch and its parapet".

### Task 3: Over the bridge to the meadow

**Files:**
- Modify:
  - `src/game/areas.ts` (south crossing);
  - `src/game/rules.ts` (walking and the move-area action cross it; first arrival);
  - `src/game/meadow.ts` (`MEADOW_FOUND_MESSAGE`; Task 1 added `progress.meadowFound`);
  - `src/scene/map.ts` (terrain key `'meadow'`, `buildMeadowMap`, and the stream on the hills' row 29);
  - `src/scene/mapGeometry.ts` (`MEADOW_PATHS`, and a hills path from the street to the bridge);
  - `src/game/rules.ts` sleep refusal;
  - `src/game/townsfolk.ts` (`EXITS` for the meadow).
  - Also every `Record<AreaId, …>` that `tsc` reports, given the meadow's values: lighting, soundscape, wildlife and ambient life.
- Test: `tests/meadowCrossing.test.ts` (new).

**Interfaces:**
- **Consumes:** Task 1's `bridgeDone`, Task 2's `BRIDGE_SITE`.
- **Produces:**
  - `MEADOW_ENTRY = { x: 25, y: 0.5 }` (in the meadow).
  - `HILLS_BRIDGE_EXIT = { x: 25, y: 29 }` (on the hills).
  - `crossing(state, rawX, rawY)`:
    - from the hills with the bridge done, `rawY > 29` and `|rawX - 25| <= 1` lands in the meadow at `(rawX, 0.5)`;
    - from the meadow, `rawY < 0` within the same span lands on the hills at `(rawX, 28.5)`;
    - the meadow has no other exits.
  - `MEADOW_FOUND_MESSAGE = 'Over the bridge, the meadow runs down to an old road, half lost in the grass.'`
  - Sleeping in the meadow is refused with "Cross back to the hills to sleep."
  - `MEADOW_PATHS`:
    - the lane `[25, 0, 25, 18]` from the bridge down to the road;
    - the road `[0, 18, 39, 18]`, drawn only where cleared (Task 4 adds the overgrown look).
  - The hills path `[25, 23.5, 25, 29]` from the street to the bridge.

- [ ] **Step 1: Write the failing tests** in `meadowCrossing.test.ts`:
  - **No crossing yet.** With the bridge unfinished, walking south off the hills' edge at x=25 goes nowhere.
  - **Crossing both ways.** With it finished:
    - the survivor lands in the meadow at `(25, 0.5)`, and `progress.meadowFound` becomes true with `MEADOW_FOUND_MESSAGE` once;
    - walking north from the meadow lands at `(25, 28.5)` on the hills;
    - walking south at x=30 goes nowhere.
  - **The pony stays on the hills.** `ponyWith(state)` is false in the meadow.
  - **A save in the meadow round-trips** through `saveGame`/`loadGame`.
  - **Sleep in the meadow** is refused with "Cross back to the hills to sleep."
  - **Terrain.**
    - `buildMap(nodes, 'meadow', season)` has no decoration within 1.2 tiles of the lane.
    - The hills' row 29 is stream tiles. The bridge's span at x=24–26 is left for the bridge sprite.
- [ ] **Step 2: Run** `npx vitest run tests/meadowCrossing.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - **Meadow ground:** soft grass with scattered wildflowers and a few young trees near the edges, changing with the season like `hillPlant`. Nothing in the meadow is gatherable.
  - **Stream tiles** are new ground sprites in the hills' style. Register them in `sprites.ts`.
- [ ] **Step 4: Run** it, then `npx vitest run`. Expected: PASS.
- [ ] **Step 5: Commit:** "Cross the bridge to the meadow".

### Task 4: The traders' road and its milestone

**Files:**
- Modify:
  - `src/game/meadow.ts` (sites and work);
  - `src/game/rules.ts` (`{ type: 'roadWork' }`);
  - `src/scene/prompts.ts`, `src/scene/tapTarget.ts`.
- Test: `tests/meadowRoad.test.ts` (new).

**Interfaces:**
- **Consumes:** Task 1's `RoadState`, Task 3's meadow.
- **Produces, in `meadow.ts`:**
  - `ROAD_SPOTS`: the middle of each of 6 sections along y=18, `x = 3.5 + i * 6.5`. They're cleared west to east, from the lane's meeting point outwards, in the order `[3, 4, 2, 5, 1, 0]`.
  - `MILESTONE_SITE = { x: 37, y: 16.5 }`.
  - `roadSpot(state)`, `roadWorkBlocker(state)`, `roadPrompt(state)`, `doRoadWork(state)`, `roadWorkLine(after)`.
- **Work:**
  - **Clearing** a section takes 4 pieces of work. Each costs `tire(state, BALANCE.digEnergyCost * 0.5)` and `workSeconds(...)`, as `townWork` does. It needs no tool and gives nothing.
  - **The milestone** takes 6 stone from the bag. It opens once all 6 sections are cleared.
- **Copy:**
  - Prompts: "Clear the old road (n/4)" and "Set a milestone stone (n/6)".
  - Lines:
    - "You pull back the bracken and find the old stones underneath.";
    - "Another stretch of the old road is open.";
    - "The old road runs clear from one side of the meadow to the other.";
    - milestone done: "The milestone stands by the road. Someone coming this way would see it."
  - Blockers: "Move closer to the road." and "Bring stone from the quarry in your bag." The cart can't cross the bridge.

- [ ] **Step 1: Write the failing tests:**
  - The order of the sections, the work count per section, and `doneDays.road` set on the last.
  - The milestone only after the road, taking stone from the bag and not the cart.
  - Prompt, E key and tap agree.
  - Too tired is refused.
  - The milestone site stays clear of the meadow plots and the lane.
- [ ] **Step 2: Run** `npx vitest run tests/meadowRoad.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** it, then `npx vitest run`. Expected: PASS.
- [ ] **Step 5: Commit:** "Clear the traders' road through the meadow and set its milestone".

### Task 5: Three meadow houses, the carter and the joiner

**Files:**
- Modify:
  - `src/game/town.ts` (`JobId` gains `'carter' | 'joiner'`, appended after the stalls);
  - `src/game/jobs.ts`;
  - `src/game/houseOpen.ts` (plots 12–14 need `bridgeDone`);
  - `src/game/townsfolk.ts` (home in either area);
  - `src/game/save.ts` (holding these jobs needs the bridge done).
- Test: `tests/meadowJobs.test.ts` (new); update `tests/jobs.test.ts` (`JOB_ORDER` pinned) and `tests/townsfolk.test.ts`.

**Interfaces:**
- **Consumes:** Task 1's plots and `bridgeDone`, Task 3's `EXITS`.
- **Produces, in `jobs.ts`:**
  - **`carter`.**
    - Offer: "drive the stone cart".
    - Open: `bridgeDone`, `progress.workshop.stoneCart`, and no camp job open.
    - Spot: `CART_SPOTS.quarry` with y+1.
    - Dawn: put `CARTER_STONE = 4` stone into the cart, wherever it stands, up to `NEEDS.cartStone`.
  - **`joiner`.**
    - Offer: "make beams at the workshop".
    - Open: `bridgeDone`, `structures.workshop`, `hasWoodStore`, and no camp job open.
    - Spot: beside the workshop, by `CAMP_STRUCTURES`.
    - Dawn: make one batch (`GOODS.beams.batch`) from the wood store, only if `goodRoom(state, 'beams') > 0` and the store holds at least `GOODS.beams.cost.wood + JOINER_WOOD_RESERVE`, with `JOINER_WOOD_RESERVE = 10`.
  - **Order:** `JOB_ORDER` is the camp jobs, then the stalls, then `carter` and `joiner`. Stall and meadow jobs keep the "works" rule from slice 3: once held, they work whatever opens later.
  - **`personSpot`.** A worker whose home is in the meadow walks out of the work area, then from the hills' exit to `HILLS_BRIDGE_EXIT`, then across to their plot in the meadow. Each stretch is a share of the dusk, and each `PersonSpot` says its area.

- [ ] **Step 1: Write the failing tests:**
  - **Plots and offers.**
    - Plot 12 doesn't open before the bridge is done, even with all 12 hills houses lived in and a stall job free. It opens `PLOT_DAYS` after house 11 once the bridge is done.
    - With every camp job and stall held and the bridge done, the next newcomer is offered `['carter', 'joiner']`.
  - **Carter:** 4 stone into the cart, never past 40.
  - **Joiner:** one batch with 18 or more wood in the store, nothing with 17, and nothing when `goodRoom` is 0. Review Focus 5.
  - **Walking home:** a meadow-housed worker at dusk is on the hills partway through, then in the meadow at their plot, and is never on the wrong area at the end. Review Focus 4.
  - **Saves:** a save with `carter` held before the bridge is done is rejected.
- [ ] **Step 2: Run** `npx vitest run tests/meadowJobs.test.ts tests/jobs.test.ts tests/townsfolk.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** them, then `npx vitest run`. Expected: PASS.
- [ ] **Step 5: Commit:** "The meadow's three houses, and a carter and a joiner to fill them".

### Task 6: Drawing the bridge, the meadow and the road

**Files:**
- Create: `src/art/meadowSprites.ts`
- Modify:
  - `src/art/sprites.ts` (register);
  - `src/scene/visuals.ts` (`addBridge` on the hills; `addMeadow` in the meadow; meadow houses through the existing house drawing, filtered by plot area).
- Test: `tests/meadowSprites.test.ts` (new).

**Interfaces:**
- **Consumes:** Tasks 1–5.
- **Produces:**

  | Sprite | Size | Anchor | Frames |
  |---|---|---|---|
  | `townBridge` | 56x40 | [28, 30] | `piers`, `arch`, `done` (+`s` in winter) |
  | `roadBrush` (an overgrown section) | 104x24 | [52, 12] | `wild`, `half` (+`s`) |
  | `milestone` | 12x20 | [6, 19] | `low`, `done` (+`s`) |

  - **Visual ids:**
    - `bridge` → `townBridge:<stage>` (nothing until the first stone);
    - `road-<i>` → `roadBrush:wild` while a section is untouched, `half` while partly cleared, and nothing once cleared, when the road path shows;
    - `milestone` → `milestone:low` before 6 stone and `done` at 6.
  - **Meadow houses** use `townHouse` exactly as the hills houses do.

- [ ] **Step 1: Write the failing tests:**
  - Each visual id and texture as above, with a winter day giving `s`.
  - Sizes and frames registered.
  - Nothing of the meadow is drawn on the hills, and the bridge appears in no other area.
  - No overlap between the meadow houses, the milestone and the lane, by sprite boxes as in `squareSprites.test.ts`.
- [ ] **Step 2: Run** `npx vitest run tests/meadowSprites.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** it, then `npx vitest run tests/art*.test.ts tests/meadowSprites.test.ts`. Expected: PASS.
- [ ] **Step 5: Commit:** "Draw the bridge, the meadow and its old road".

### Task 7: Morning notes and the year journal

**Files:**
- Modify: `src/game/traveller.ts` (`townNews`), `src/game/journalEntries.ts`, and its `JOURNAL_PAGES` lines.
- Test: update `tests/traveller.test.ts` and the journal tests.

**Interfaces:**
- **Morning notes**, on the dawn after the day each happened:
  - "The bridge over the stream is finished.";
  - "The old road through the meadow is clear.";
  - "The milestone stands by the meadow road."
- **Journal lines:**
  - "Built a bridge over the stream, and found the meadow beyond.";
  - "Cleared the old road and set a milestone by it."
  - Each is written once, and stays off the page until it happens.

- [ ] **Step 1: Write the failing tests:** each note once, on the right morning; each journal line once, and blank until written.
- [ ] **Step 2: Run** them. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** them, then `npx vitest run`. Expected: PASS.
- [ ] **Step 5: Commit:** "Note the bridge and the meadow road, mornings and in the year journal".

### Task 8: Scripted player, pace, checks, browser and PR

**Files:**
- Modify: `tests/playthrough/player.ts`, `tests/playthrough/milestones.ts`, `tests/playthrough.test.ts`.

- [ ] **Step 1: Add the milestones:**
  - `bridge-piers` ("Raised the bridge's piers");
  - `bridge` ("Finished the bridge");
  - `meadow` ("Crossed to the meadow");
  - `meadow-road` ("Cleared the old road");
  - `milestone` ("Set the milestone");
  - `meadow-house` ("Built the first house in the meadow").

  Append them to `ENDS_THE_GAME` and `MILESTONES_THAT_END`, after the square's.
- [ ] **Step 2: Teach the player.**
  - **Routing.** `goTo` learns `'meadow'`, via the hills and the bridge.
  - **The bridge** is worked like the square, only while no house plot is open.
  - **The road** is cleared whenever nothing else is open.
  - **The milestone's stone** is carried in the bag.
  - **Meadow houses** are built like the hills houses.
- [ ] **Step 3: Assert the pace:**
  - From `bridge-piers` to `meadow-house` takes at most 120 days in every game.
  - No wait between this slice's finishes is longer than 45 days.
  - Raise `MOST_DAYS` if games run out, and say why in its comment.
  - Report the spans in the PR.
- [ ] **Step 4: Run** `npx vitest run tests/playthrough.test.ts` on Node 24 **and** Node 26. Expected: PASS on both, with the file under 60 seconds.
- [ ] **Step 5: Run every check:** `npx tsc --noEmit`, `npm run lint`, `npx vitest run` and `npm run build`.
- [ ] **Step 6: Browser check** at 1280x800 and 390x844, from seeded saves written to `.superpowers/seeds/` (they also load through "Load a save…" once PR #162 is merged):
  - the bridge at each stage;
  - the stream;
  - crossing both ways;
  - the meadow in summer and winter;
  - the road wild, half and clear;
  - the milestone;
  - a meadow house;
  - a meadow worker walking home at dusk.

  There should be no page errors.
- [ ] **Step 7: Commit, push and open the PR** against `main`.

---

## After this slice

Market day comes next. The square opens when every house is full and every stall is kept. Traders come in along the cleared road past the milestone, and the first cart brings the glass lens.
