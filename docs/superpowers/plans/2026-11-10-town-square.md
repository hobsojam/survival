# The Town, Slice 3: The Square — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the town its market square at the west end of the street: paving, a well and five stalls, built a piece at a time. Once the camp's jobs are all taken, newcomers keep the stalls and stock them each dawn from what the camp can spare. Four more plots around the square bring the hills to twelve houses.

**Architecture:** This builds on slices 1 and 2 (`docs/superpowers/plans/2026-11-08-town.md` and `2026-11-09-town-word-gets-around.md`).
- A new `square.ts` holds the square's state and rules.
- A new `squareSites.ts` holds where its pieces stand and how they are built, mirroring `townSites.ts` for houses.
- `jobs.ts` gains five stall jobs.
- The castle goods count the square's beams, fittings and hangings.
- A save upgrade adds the square and four house slots.
- Market day, the square opening and the glass lens are **not** in this slice.

**Tech Stack:** TypeScript, Phaser, Vite, Vitest and oxlint.

**Spec:** `docs/superpowers/specs/2026-11-08-town-design.md`. In particular, see "More houses than camp jobs", "The square takes shape alongside", "Any order, mostly" and "Market day and the finish" (which is for later).

## Decisions made with the user (2026-11-10)

- **Five stalls, one per good:** bread, honey, wool, apples and eggs.
- **Stallholders stock their stall.** Each dawn they move one of their good from the camp's stores to the stall, but only what is spare above a reserve the survivor keeps. Stall stock doesn't spoil and waits for market day.
- **Earlier:** a newcomer comes 5 days after a house is finished, and each plot opens 5 days after the house before it (#160).

## My calls (the spec leaves them to the builder)

- **Where the square sits.** At the west end of the street, centred on (8.5, 23) on the hills. The street of eight leads into it, and four new plots stand around it.
- **When it shows.** The square's ground is marked out once **two houses are finished**, so it grows alongside the houses and isn't saved for the end.
- **Order of building.** The paving comes first. Once the paving is down, the well and the five stalls can be built in any order.
- **What each piece costs.** All of it comes from goods the game already makes:

  | Piece | Cost |
  |---|---|
  | Paving | 40 stone in four quarters of 10 |
  | Well | 12 stone, then 1 iron fitting |
  | Each stall | 2 beams, then 1 wool hanging (its awning) |

- **When stall jobs open.** A stall's job is offered only once its stall stands **and** no camp job is open. That way the last newcomers are the stallholders, as the spec says.
- **Stocking.** One item a dawn, up to `STALL_STOCK = 12`.
  - The larder keeps `STALL_RESERVE = 2` of each food.
  - The wool basket keeps `WOOL_RESERVE = 3`, which is enough for a hanging.
  - Bread, honey, apples and eggs come from the larder, oldest first. Wool comes from the basket.
- **Houses.** The hills hold 12. The fifth stallholder waits for the new ground in the next slice, so the square can't open in this one, which is as intended.

## Global Constraints

- It's an `EASTER EGG:` feature. Every new file carries `EASTER EGG: the town, see src/game/town.ts`, and nothing goes in the README.
- Copy is plain and warm, not poetic, with no exclamation marks.
- No upkeep and no loss. Nothing built is ever lost. A stallholder never takes food below the reserve, and whatever won't fit stays where it is.
- It isn't a farming sim. There are no new foods, crops or gatherables.
- Everything is reachable by tap as well as by key.
- SonarCloud needs 80% coverage on new code. Keep logic out of `App.ts` and the scenes.
- This must be the only open PR changing `SAVE_VERSION`. It goes from 41 to 42.
- Verify with `npx tsc --noEmit`, `npm run lint`, `npx vitest run`, `npm run build`, and a browser check at 1280x800 and 390x844.

## Review Focus

1. **A larder at or below the reserve.** A stallholder takes nothing. The survivor's last two eggs are never sold off. *(Task 4 tests it.)*
2. **A version 41 save with all eight camp jobs taken.** It upgrades with four empty plots and an unbuilt square. No plot opens until a stall stands. *(Task 1 tests it.)*
3. **No wool for hangings.** A stall stops at its frame. The prompt says "Stall · weave a hanging at the loom", and the paving and well can still be built. *(Task 2 tests it.)*
4. **A stall built while a camp job is still open.** The visitor is offered only camp jobs, and no plot opens just for the stall. *(Task 4 tests it.)*
5. **Hangings after the castle.** Its hall has all its hangings, but the loom still makes hangings while the stalls need them, and stops when they don't. *(Task 2 tests it.)*

---

### Task 1: The square's state, four more plots, and the save

**Files:**
- Create: `src/game/square.ts`
- Modify: `src/game/town.ts`, `src/game/townSites.ts`, `src/game/state.ts` (the town carries the square), `src/game/saveUpgrades.ts`, `src/game/save.ts`
- Test: `tests/square.test.ts` (new), `tests/townHouse.test.ts`, `tests/save.test.ts`, `tests/saveUpgrades.test.ts`

**Interfaces:**
- Produces, in `square.ts`:
  - **Types and constants.**
    - `StallId = 'bread' | 'honey' | 'wool' | 'apples' | 'eggs'`, and `STALL_IDS` in that order.
    - `SquarePiece = 'paving' | 'well' | StallId`.
    - `SQUARE_NEEDS = { paving: 40, well: { stone: 12, fittings: 1 }, stall: { beams: 2, hangings: 1 } }`.
    - `PAVING_SECTION = 10`.
    - `STALL_STOCK = 12`, `STALL_RESERVE = 2`, `WOOL_RESERVE = 3`.
  - **State.**
    - `SquareState = { paving: number; well: { stone: number; fittings: number }; stalls: Record<StallId, { beams: number; hangings: number }>; stock: Record<StallId, number>; doneDays: Partial<Record<SquarePiece, number>> }`.
    - `emptySquare()`.
  - **Rules.**
    - `squareMarked(state): boolean` is true once at least 2 houses are finished.
    - `pieceDone(square, piece): boolean`.
    - `pieceOpen(state, piece): boolean` is true when the square is marked, the piece isn't done, and the piece is the paving or the paving is done.
- **Town state.** `TownState` gains `square: SquareState`, and `emptyTown()` includes `emptySquare()`.
- **Plots.** `HOUSE_COUNT = 12`. `HOUSE_PLOTS` gains four plots around the square, in this building order: `(15,25)`, `(3.5,21)`, `(3.5,26)`, `(13,28)`.
  - If a placement test shows one of these overlapping, move it by the smallest step that clears it, and ledger a ruling.
- **The upgrade.** `SAVE_VERSION = 42`. `SAVE_UPGRADES[41]` pads `town.houses` to 12 and adds `town.square = emptySquare()`. Its comment reads: "Version 42: the town's square and its four plots. A version 41 town has neither."
- **Validation.** `validTown` also checks:
  - every count is whole and no more than `SQUARE_NEEDS` (stock up to `STALL_STOCK`);
  - the well's fitting comes only after its 12 stone, and a stall's hanging only after its 2 beams;
  - there is no work on the square before 2 houses are finished;
  - there is no well or stall work before the paving is done;
  - `doneDays` has an entry exactly for the finished pieces, each a valid day;
  - stall stock is above 0 only for a stall whose job someone holds. *(Task 4 adds the jobs; until then stock must be 0.)*

- [ ] **Step 1: Write the failing tests.**
  - `square.test.ts`:
    - `emptySquare()` is all zeroes with empty `doneDays`;
    - `squareMarked` is false with 1 finished house and true with 2;
    - `pieceOpen` gives only `'paving'` until the paving is done, then `'well'` and every stall;
    - a done piece is not open.
  - `townHouse.test.ts`: `HOUSE_PLOTS` has 12 entries. The existing placement loops (`it.each` over all plots) now also cover the four new ones, and must also keep each house sprite clear of the square's footprint (x 5.5–11.5, y 20.5–25.5) and inside the 40x30 map.
  - `saveUpgrades.test.ts`: a version 41 save with eight finished, occupied houses and all eight camp jobs taken loads with 12 houses, an empty square, and `townSpots` giving no plot.
  - `save.test.ts`. Accepts:
    - a paved square with a stall frame;
    - a finished well.

    Rejects:
    - square work with only 1 house finished;
    - a stall beam before the paving is done;
    - a well fitting before 12 stone;
    - stock without a holder;
    - a finished piece with no `doneDays` entry;
    - 11 houses.

    Update the house fixtures (`street()` already pads to `HOUSE_COUNT`).
- [ ] **Step 2: Run** `npx vitest run tests/square.test.ts tests/townHouse.test.ts tests/save.test.ts tests/saveUpgrades.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the interfaces above.
- [ ] **Step 4: Run them.** Expected: PASS. Then run `npx vitest run`.
- [ ] **Step 5: Commit.** `git commit -m "Mark out the town square and four more plots, and save them"`

### Task 2: Building the square

**Files:**
- Create: `src/game/squareSites.ts`
- Modify: `src/game/rules.ts` (action and handler), `src/scene/prompts.ts`, `src/scene/tapTarget.ts`, `src/game/houseOpen.ts` (`townGoodNeed`), `src/game/castleSites.ts` (`goodRoom` for hangings)
- Test: `tests/squareSites.test.ts` (new), `tests/townHouse.test.ts` (goods)

**Interfaces:**
- Consumes: Task 1's `square.ts`. `spendCastleStone` and `castle.goods`, as houses use them.
- Produces, in `squareSites.ts`:
  - **Spots** (all on `'hills'`):
    - `SQUARE_CENTRE = { x: 8.5, y: 23 }`.
    - `PAVING_SPOTS`: the four quarter centres `(7,22)`, `(10,22)`, `(7,24.5)` and `(10,24.5)`, laid in that order, one per 10 stone.
    - `WELL_SPOT = SQUARE_CENTRE`.
    - `STALL_SPOTS: Record<StallId, {x, y}>`: bread `(6.5,21)`, honey `(10.5,21)`, apples `(6,25.5)`, wool `(8.5,25.5)`, eggs `(11,25.5)`.
  - `SquareSpot = { piece: SquarePiece; area: AreaId; x: number; y: number }`.
  - `squareSpots(state): SquareSpot[]` lists the open pieces. The paving's spot is the next quarter to lay.
  - `squareWorkBlocker(state, piece): string | null`. In order:
    1. not open: `'There is nothing to build here yet.'`;
    2. too far: `'Move closer to the square.'`;
    3. missing the thing it needs next: the house `SHORT` copy for stone, beams and fittings, and `'Weave a hanging at the loom.'` for a hanging;
    4. tired: `TOO_TIRED_MESSAGE`.
  - `squarePrompt(state, piece): string` gives either the work or what is missing:
    - work labels: `'Lay a paving stone (n/40)'`, `'Lay a well stone (n/12)'`, `'Fit the well's winch'`, `'Raise a stall beam (n/2)'`, `'Hang the stall's awning'`;
    - asks when something is missing: `'Square · bring stone up from the quarry'`, `'Well · make an iron fitting at the forge'`, `'Stall · make beams at the workshop'`, `'Stall · weave a hanging at the loom'`.
  - `doSquareWork(state, piece): GameState` lays one unit, paid like a house, with hangings from `castle.goods.hangings`. Finishing a piece sets `doneDays[piece] = state.day`.
  - `squareWorkLine(before, after, piece): string` gives:
    - `'You lay another paving stone.'`;
    - `'A quarter of the square is paved.'` at each 10;
    - `'The square is paved.'` at 40;
    - `'You lay another stone on the well.'`;
    - `'The well is finished. The bucket comes up full.'`;
    - `'You raise a beam for the stall.'`;
    - `` `The ${stall} stall is up, with its awning.` ``, where stall is the `StallId` word (`'bread'`, `'apple'` for apples, `'egg'` for eggs).
- **Action.** `{ type: 'squareWork'; piece: SquarePiece }`, handled like `townWork`: refuse with the blocker, otherwise advance work time and tire as `townWork` does.
- **Prompt and tap.** `squareChoice` sits in `hillsChoices` beside `townChoice`. The tap target kind is `{ kind: 'squareSite'; piece; x; y }`, mapping to `squareWork`.
- **Goods.**
  - `townGoodNeed(state, good)` takes `'beams' | 'fittings' | 'hangings'` and adds what the open square pieces still need. The paving needs none.
  - `goodRoom(state, 'hangings')` adds `townGoodNeed(state, 'hangings')`.

- [ ] **Step 1: Write the failing tests** in `squareSites.test.ts`. Use a `finishedCastleCamp()` fixture with two finished, occupied houses and the survivor at the spot.
  - The prompt, the E key and a tap all give the same `squareWork`.
  - Paving advances through the four quarters, with each quarter's line, and ends in `'The square is paved.'`.
  - Before the paving is done, the well and the stalls aren't in `squareSpots`. After it, all six are.
  - The well takes 12 stone, then a fitting.
  - A stall takes 2 beams, then a hanging. With no hangings, the prompt reads `'Stall · weave a hanging at the loom'` and the work is refused with `'Weave a hanging at the loom.'`.
  - The castle's cart stone is spent before the bag's.
  - With the hall's hangings all hung, `goodRoom(state, 'hangings')` is 0 until the paving is done. It is then 5, and it drops as awnings are hung.
  - With no square open, `townGoodNeed` is unchanged from slice 2.
  - Each `squareSpots` entry is clear of the house plots and `HILLS_PATHS` (more than 1.5 tiles), and inside the square's footprint.
- [ ] **Step 2: Run** `npx vitest run tests/squareSites.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npx vitest run tests/squareSites.test.ts tests/townHouse.test.ts tests/castle*.test.ts`. Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "Build the square a piece at a time: paving, the well and the stalls"`

### Task 3: Drawing the square

**Files:**
- Create: `src/art/squareSprites.ts`
- Modify: `src/art/sprites.ts` (registration, as `townSprites` is registered), `src/scene/visuals.ts` (`addSquare` beside `addTown`)
- Test: `tests/squareSprites.test.ts` (new)

**Interfaces:**
- Consumes: Task 1's state and Task 2's spots.
- Produces, as visual ids and textures:
  - **The marked ground.** Once `squareMarked`, `square-ground` is drawn at `SQUARE_CENTRE` as a ground decal (`GROUND_DECAL_DEPTH`): pegs and string, `squareGround:marked`.
  - **The paving.** `square-paving-<q>` uses `squarePaving:<stage>`, with stage `half` for 1–9 stones laid in that quarter and `done` for 10. It is a ground decal 48x40, anchored at its centre.
  - **The well.** `square-well` uses `townWell:<stage>`: `low` for 1–11 stone, `walls` for 12, and `done` with its winch. It is 24x28, anchored bottom-centre.
  - **The stalls.** `square-stall-<id>` uses `townStall:<stage>`:
    - `frame` for 1–2 beams;
    - `<id>` for done: an awning in the stall's own colour, with an empty counter;
    - `<id>-some` for stock 1–6 and `<id>-full` for 7 and up, with goods shown on the counter.

    Each stall is 24x26, anchored bottom-centre.
  - **Winter.** Every sprite has a snow variant with an `s` suffix, as houses do.

- [ ] **Step 1: Write the failing tests:**
  - each texture key used by `addSquare` exists in `squareSprites` with the sizes above;
  - `sceneVisuals` on the hills shows nothing of the square before it is marked, the marked ground after, a half quarter at 5 stones, and stall frames and awnings at their stages;
  - the five awnings differ in their legend colours;
  - no stall or well sprite overlaps another, or any house sprite at its plot;
  - nothing is drawn on other areas.
- [ ] **Step 2: Run** `npx vitest run tests/squareSprites.test.ts`. Expected: FAIL.
- [ ] **Step 3: Draw and add them.** Follow `townSprites.ts`'s legend-and-rows style and the season palette. The awnings are wheat for bread, amber for honey, cream for wool, red for apples, and pale blue for eggs.
- [ ] **Step 4: Run it.** Expected: PASS. Then run `npx vitest run tests/art*.test.ts tests/buildRendering.test.ts`.
- [ ] **Step 5: Commit.** `git commit -m "Draw the square: its marked ground, paving, well and stalls"`

### Task 4: Stallholders

**Files:**
- Modify: `src/game/town.ts` (`JobId`, `JOB_IDS`), `src/game/jobs.ts`, `src/game/food.ts` (export `takeFrom`), `src/game/save.ts` (stock needs a holder)
- Test: `tests/stalls.test.ts` (new), `tests/traveller.test.ts`

**Interfaces:**
- Consumes: Task 1's `STALL_*` constants. Task 2's `STALL_SPOTS`.
- Produces:
  - **Jobs.** `JobId` gains `'breadStall' | 'honeyStall' | 'woolStall' | 'appleStall' | 'eggStall'`, appended to `JOB_IDS` and `JOB_ORDER` after the camp jobs. `STALL_JOBS: Record<StallId, JobId>`.
  - **Each stall job:**
    - offer: `` `keep the ${word} stall` ``, with the word as in Task 2;
    - open: its stall is done, and no **camp** job is open;
    - spot: its `STALL_SPOTS` entry, one tile in front (`y + 1`);
    - dawn: if stock is below `STALL_STOCK`, it takes one item from the source when the source holds more than the reserve.
  - **Sources:**
    - bread from `larder` `'bread'`;
    - honey from `'honey'`;
    - apples from `'apple'`;
    - eggs from `'egg'`;
    - wool from `sheep.wool`.
  - **Food reserve.** The larder keeps `STALL_RESERVE` of each food; wool keeps `WOOL_RESERVE`.
  - **Taking food.** Use `takeFrom(store, item, 1)` (now exported from `food.ts`), oldest first.
  - **Order of dawn work.** `jobsDawn` runs the camp jobs before the stalls, so a worker's fresh eggs can reach the stall the same dawn.
  - **Plots.** `houseOpen` already asks `openJobs`, so a standing stall with all camp jobs taken opens the next plot. No change is needed. Test it.

- [ ] **Step 1: Write the failing tests** in `stalls.test.ts`, calling `jobsDawn` directly:
  - each stall takes one of its good above the reserve;
  - a larder with exactly 2 eggs gives nothing;
  - a full stall takes nothing;
  - wool keeps 3 in the basket;
  - with no holder, nothing moves;
  - `openJobs` doesn't list a built stall while `'beds'` is still open, and does once every open camp job is held;
  - with all 8 camp jobs held, 8 houses lived in and the bread stall built, plot 8 opens after `PLOT_DAYS`, and the next newcomer is offered only `'breadStall'`;
  - the offer reads `'keep the bread stall'`.

  In `traveller.test.ts`: a newcomer who takes the honey stall moves into the next empty house.

  In `save.test.ts`: stock is accepted for a held stall.
- [ ] **Step 2: Run** `npx vitest run tests/stalls.test.ts tests/traveller.test.ts tests/save.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** Keep the stall dawn one small function, with the source chosen by a `StallId` lookup.
- [ ] **Step 4: Run them, then `npx vitest run`.** Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "Stallholders keep the square's stalls and stock them from what the camp can spare"`

### Task 5: Scripted player, checks, browser and PR

**Files:**
- Modify: `tests/playthrough/player.ts`, `tests/playthrough/milestones.ts`, `tests/playthrough.test.ts`

- [ ] **Step 1: Add the milestones:**
  - `square-marked` ("Marked out the square");
  - `square-paved` ("Paved the square");
  - `square-well` ("Finished the well");
  - `square-stalls` ("Raised all five stalls").

  Make `square-stalls` the last of `ENDS_THE_GAME` and `MILESTONES_THAT_END`.
- [ ] **Step 2: Teach the player** to build `squareSpots` as it builds `townSpots`. It works on a square piece only when no house plot is open, so houses keep their pace. Hangings are paid for at the loom, as the hall's were.
- [ ] **Step 3: Assert the pace.** From the square being marked to all five stalls standing must take at most 120 days in every game. Report the actual spans in the PR.
- [ ] **Step 4: Run** `npx vitest run tests/playthrough.test.ts`. Expected: PASS, with the file under 45 seconds. If a game runs out of days, raise `MOST_DAYS` and say why in its comment.
- [ ] **Step 5: Run every check:** `npx tsc --noEmit`, `npm run lint`, `npx vitest run` and `npm run build`.
- [ ] **Step 6: Browser check** at 1280x800 and 390x844, from seeded saves:
  - the marked ground;
  - paving half done;
  - the well and stalls at each stage;
  - a stallholder at the bread stall with stock showing;
  - the visitor offered a stall job;
  - the four new plots.

  There should be no page errors.
- [ ] **Step 7: Commit, push and open the PR** against `main`.

---

## After this slice

Next is the new ground beyond the hills: something to build to reach it, then more plots, so the fifth stallholder gets a house. Then market day: the square opens when every house is full and every stall is kept, and the glass lens arrives.
