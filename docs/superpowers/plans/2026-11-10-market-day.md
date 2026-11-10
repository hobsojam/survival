# The Town's Last Slice: Market Day Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the town. Once it's as full as it can get and the meadow's old road is cleared and marked, the square opens. A sign by the well advertises each market the day before. Every fifth day is market day: the stalls sell down, townsfolk mill about the square, and traders' carts come in along the old road and over the bridge. On the first market day, a trader hands the survivor a glass lens.

**Architecture:**
- **One new rules file:** `src/game/market.ts`. It holds the saved `MarketState` (`openDay`, `lensDay`), the schedule (worked out from `openDay` and the day, so nothing else is saved), `marketDawn`, the traders' positions and the lens handover.
- **Drawing:** the scene reads those helpers through `src/scene/visuals.ts`. The sign, the traders and their carts are drawn in code in a new `src/art/marketSprites.ts`.
- **Townsfolk on market day:** `src/game/townsfolk.ts` sends non-stall people to the square, and changes what everyone says on the eve and the day.
- **Saves** go to version 44.

**Tech Stack:** TypeScript, Phaser, Vite, Vitest, oxlint.

**Spec:** `docs/superpowers/specs/2026-11-10-market-day-design.md`, on top of `docs/superpowers/specs/2026-11-08-town-design.md`.

## Global Constraints

- **EASTER EGG.** Every new file and test starts with a `// EASTER EGG: the town, see src/game/town.ts.` line. Nothing goes in the README or any player-facing help. `AGENTS.md` already lists the town.
- **Copy** is plain and warm, not poetic, with no exclamation marks.
- **No new dependencies and no image files.** Sprites are drawn with `define(w, h, painters, anchor, legend)` from `src/art/sheepSprites.ts` and registered in `src/art/sprites.ts`.
- **No money, prices, trading screen, tasks or timers.** Market day is never needed for anything already in the game. The traders' goods are only for show.
- **Not a farming sim.** No crops or gatherable foods.
- **Nothing is lost, and workers never fail.** Market day changes where people stand, not what their jobs produce.
- **Everything works by tap as well as by key, and while the survivor is weak.**
- **Logic lives in tested helpers.** SonarCloud gates PRs at 80% on new code, and `App.ts` and the scene classes are untested.
- **Saves:** `SAVE_VERSION` 43 → 44, with an upgrade step. This must be the only open PR doing so. Validation rejects impossible states.
- **Checks:** `npx tsc --noEmit`, `npm run lint`, `npx vitest run`, `npm run build`. Also run the playthrough on **Node 24 and Node 26**, as in the meadow plan.

## Decisions (from the spec, and the calls this plan makes)

- **When the square opens** (`townFull` and `roadReady`, checked each dawn):
  - The castle is finished and someone has stayed.
  - No traveller is at the door, and no one sleeps in the hall.
  - Every finished house is lived in, `openJobs(state)` is empty, and no plot is `houseOpen`.
  - All five stall jobs are held.
  - Both `roadDone(road)` and `milestoneDone(road)` are true.

  On the first dawn all of that holds, `market.openDay = state.day`. Once open, the square stays open.
- **The schedule** is `MARKET_EVERY = 5`. The first market is `openDay + 2`, and later ones fall every 5 days after that. The eve is the day before a market, which makes the eve of the first market `openDay + 1`.
- **Stock.** At the dawn after a market day, every stall's stock goes to 0 *before* `jobsDawn`, so keepers start again that same dawn.
  - On market day, the stock *shown* falls from what's held at dawn to 0 by the start of dusk (`marketSold`). The saved stock doesn't change until the next dawn.
- **The "full" picture** drops from `stock > 6` to `stock >= STALL_FULL` with `STALL_FULL = 4`. "Some" is 1–3.
- **Traders.** Two traders, each with a cart: `TRADERS = ['glass', 'spice']`.
  - Over the first `TRADER_ARRIVE = 30` game seconds of a market day, they walk in from the meadow's east edge along the road (y = 18), past the milestone, to `MEADOW_ENTRY`. They then cross from `HILLS_BRIDGE_EXIT` to their cart spots by the square.
  - Over the dusk (the same window as `walkHome`), they walk the same way back.
  - At night they aren't there.
- **The lens** is handed over in one of two ways:
  - By the `glass` trader, when the survivor is within 1.5 tiles of them on the first market day, before night.
  - After that day, by any stallholder standing at their stall, whenever the survivor is within 1.5 tiles.

  Either way, `market.lensDay = state.day`, and the move's message is said aloud. The lens shows in the journal; there's no inventory item.
- **Copy:**
  - Sign label: `Market sign · market tomorrow` / `Market sign · market today`.
  - Greetings: `Market tomorrow.` on the eve, and `Busy one today.` on market day. While `townFull` holds but `roadReady` doesn't, stallholders say `The traders won't come till the old road's clear and marked.`
  - Lens, from the trader: `A trader from beyond the hills hands you a glass lens. No one here could have made it.`
  - Lens, from a stallholder: `{name} hands you a glass lens a trader left for you.`
  - Journal: `squareOpen`: `Every house is full. The square is ready for market day.`, `firstMarket`: `The first market day. Traders came over the bridge.`, `lens`: `Kept a glass lens a trader gave me.`

## Review Focus

- **A town that can't fill all 15 plots.** If there's no orchard, there's one fewer camp job. The square must still open once nothing more can come. (Task 1 test: no orchard, 14 people.)
- **A job freed after opening.** If the player builds an orchard after the square opens, a newcomer comes and a house opens, but the market carries on and `openDay` doesn't change. (Task 1 test.)
- **Days skipped by sleeping or loading.** Stock must clear after *every* market, including when the survivor sleeps through it. It must never clear on a day that isn't the day after a market. (Task 1 test across 11 dawns.)
- **The survivor never visits the first market.** The lens must still reach them later, from a stallholder, and never twice. (Task 5 test.)
- **An older save already meeting the conditions.** It loads with `openDay: null` and opens at its next dawn. (Task 1 upgrade test.)

---

### Task 1: The market's state, schedule and dawn, saved

**Files:**
- Create: `src/game/market.ts`
- Modify: `src/game/town.ts` (add `market: MarketState` to `TownState` and `emptyTown`)
- Modify: `src/game/rules.ts` (call `marketDawn(next)` in `dawn`, just before `jobsDawn(next)`)
- Modify: `src/game/save.ts` (`validMarket`, called from `validTown`), `src/game/saveUpgrades.ts` (step 43 → 44)
- Test: `tests/market.test.ts`, `tests/save.test.ts`, `tests/saveUpgrades.test.ts`

**Interfaces:**
- Produces:
  - `interface MarketState { openDay: number | null; lensDay: number | null }`, `emptyMarket(): MarketState`
  - `MARKET_EVERY = 5`
  - `townFull(state: GameState): boolean`, `roadReady(state: GameState): boolean`
  - `firstMarketDay(state: GameState): number | null`, `isMarketDay(state: GameState, day = state.day): boolean`, `isMarketEve(state: GameState): boolean`
  - `marketDawn(next: GameState): void`

- [ ] **Step 1: Write the failing tests** in `tests/market.test.ts`. Use the fixtures the meadow tests use (`finishedCastleCamp()`, `street(...)`, see `tests/meadowJobs.test.ts`) to build a full town of 15 houses with every job held, the road cleared and the milestone set:
  - `townFull` is true for that town. It's false with a traveller at the door, with one person in the hall, with a finished empty house, and with a stall job not held.
  - With no orchard, 14 people, 14 finished and lived-in houses, and `openJobs` empty, `townFull` is true.
  - `roadReady` is false with the road cleared but no milestone.
  - `marketDawn` sets `openDay` to the new day on the first dawn that `townFull && roadReady` holds. It leaves `openDay` alone when the town is full but the road isn't ready.
  - Once open, freeing a job (adding an orchard) and running `marketDawn` leaves `openDay` unchanged.
  - With `openDay = 100`:
    - `firstMarketDay` is 102.
    - `isMarketDay` is true on 102, 107 and 112, and false on 100, 101, 103 and 106.
    - `isMarketEve` is true on 101 and 106.
  - Stock of 5 on every stall clears to 0 at the dawn into day 103 (`marketDawn` runs before keepers stock). It stays at 5 at dawns into 102, 104 and 105. Run 11 straight dawns through `applyAction` sleeps, and check that stock clears after both markets.
- [ ] **Step 2:** Run `npx vitest run tests/market.test.ts`. Expect FAIL: the module is missing.
- [ ] **Step 3: Implement `market.ts`** with the signatures above. Add `market: emptyMarket()` to `emptyTown`, and call `marketDawn` in `dawn`.
- [ ] **Step 4: Saves.**
  - `SAVE_VERSION` 44. Upgrade step `43: old => ({ ...old, town: { ...old.town, market: emptyMarket() } })`, guarded like step 42.
  - `validMarket(market, shape)` rejects:
    - a non-object, or non-null values that aren't whole days between 1 and `day`;
    - an `openDay` without a finished castle, all five stall jobs held, and the road's `doneDays.milestone` at or before `openDay`;
    - a `lensDay` without an `openDay`, or below `openDay + 2`.

  Tests:
  - `save.test.ts`: each of those rejections, and a valid opened market with a lens.
  - `saveUpgrades.test.ts`: a version 43 save loads with `market: { openDay: null, lensDay: null }`. A version 43 save that meets every condition opens after one sleep.
- [ ] **Step 5:** Run `npx vitest run tests/market.test.ts tests/save.test.ts tests/saveUpgrades.test.ts tests/saveFixture.test.ts`. Expect PASS. Then run `npx tsc --noEmit`.
- [ ] **Step 6: Commit.** Message: `Open the square once the town is full and the road is marked, and keep market day every fifth day`.

### Task 2: Stalls that sell down, and fuller-looking stalls

**Files:**
- Modify: `src/game/market.ts`, `src/game/square.ts` (`STALL_FULL = 4`), `src/scene/visuals.ts:155-160`
- Test: `tests/market.test.ts`, `tests/squareVisuals` (wherever `addSquare` frames are tested today; find them with `grep -rn "townStall:" tests`)

**Interfaces:**
- Consumes: `isMarketDay` (Task 1).
- Produces:
  - `marketSold(state: GameState): number`. It's 0 off market days. On market day it rises linearly from 0 at dawn to 1 at `nightStart(day) - duskLength(day)`.
  - `stallFrame(state: GameState, id: StallId): string`. It returns the frame name `addSquare` uses: `'frame'`, `id`, `` `${id}-some` `` or `` `${id}-full` ``, from `Math.round(stock * (1 - marketSold(state)))`.

- [ ] **Step 1: Write the failing tests:**
  - `marketSold` is 0 the day before a market and 0 at dawn on one. It's 0.5 halfway to dusk, and 1 from dusk on.
  - `stallFrame` gives `bread-full` with stock 4 off market days, `bread-some` with 3, and `bread` with 0.
  - On a market day at `marketSold` 0.5, stock 8 shows `bread-full` and stock 4 shows `bread-some`. From dusk on, it's `bread`.
- [ ] **Step 2:** Run the tests. Expect FAIL.
- [ ] **Step 3:** Implement both functions. Make `addSquare` use `stallFrame`.
- [ ] **Step 4:** Run the tests and `npx tsc --noEmit`. Expect PASS.
- [ ] **Step 5: Commit.** Message: `Sell the stalls down over market day, and show a week's stock as full`.

### Task 3: The sign by the well

**Files:**
- Create: `src/art/marketSprites.ts` (register in `src/art/sprites.ts`)
- Modify: `src/game/market.ts`, `src/scene/visuals.ts` (`addSquare`), `src/scene/prompts.ts` (`hillsChoices`)
- Test: `tests/marketSprites.test.ts`, `tests/market.test.ts`, `tests/prompts.test.ts`

**Interfaces:**
- Consumes: `isMarketDay` and `isMarketEve` (Task 1).
- Produces:
  - `SIGN_SPOT: { x: number; y: number }`: by the well, one tile from `WELL_SPOT` and clear of the stalls and paving spots.
  - `signFace(state: GameState): 'eve' | 'day' | null`.
  - Sprites `marketSign:eve`, `marketSign:day` and their snow variants `marketSign:eves`, `marketSign:days`. They're a small painted board on two legs, with a different painted face each.

- [ ] **Step 1: Write the failing tests:**
  - `signFace` is `'eve'` on `openDay + 1` and `'day'` on `openDay + 2`. It's null on `openDay` and `openDay + 3`, and null before the square opens.
  - The prompt within reach of `SIGN_SPOT` says `Market sign · market tomorrow` / `Market sign · market today`. It offers no action, and E and a tap do nothing new there.
  - The sprites are registered. They're at most 16×20, and the two faces differ.
  - `SIGN_SPOT` is at least 1 tile from the well and every stall spot.
- [ ] **Step 2:** Run the tests. Expect FAIL.
- [ ] **Step 3:** Implement `signFace` and the choice in `hillsChoices`, labelled only, like the lookout's `The lookout stands again`. Draw the sprites and add the sign in `addSquare` when `signFace` isn't null.
- [ ] **Step 4:** Run the tests, tsc and lint. Expect PASS.
- [ ] **Step 5: Commit.** Message: `Put up a market sign by the well the day before, and turn it on the day`.

### Task 4: Townsfolk on market day

**Files:**
- Modify: `src/game/townsfolk.ts`
- Test: `tests/townsfolk.test.ts` (or the file where `personSpot` and `greeting` are tested now: `grep -rln "greetingHere\|personSpot" tests`)

**Interfaces:**
- Consumes: `isMarketDay`, `isMarketEve`, `townFull` and `roadReady` (Task 1), and `STALL_JOBS`.
- Produces: `MARKET_CROWD_SPOTS: readonly { x: number; y: number }[]`. That's 10 spots on the hills around the square, each at least 1 tile from the well, the stalls and `SIGN_SPOT`. Task 5 places the carts clear of these.

- [ ] **Step 1: Write the failing tests:**
  - On a market day before dusk, someone whose job isn't a stall stands at `MARKET_CROWD_SPOTS[index % length]` on the hills. A stallholder stands at their usual stall spot.
  - At dusk, they walk home from the crowd spot (the first leg starts there).
  - Their job's dawn work still happens on market day. Compare the wood store after a market-day dawn with a wood worker against an ordinary day.
  - Greeting on the eve is `{name} · Market tomorrow.`, and on the day it's `{name} · Busy one today.`. At dusk, both still say `Good evening.`.
  - With `townFull` but no milestone, a stallholder says `The traders won't come till the old road's clear and marked.`, and a wood worker says their usual line.
- [ ] **Step 2:** Run the tests. Expect FAIL.
- [ ] **Step 3:** In `personSpot`, use the crowd spot as `work` on market days for non-stall jobs. In `greetingLine`, add the three lines after the dusk check and before the rain check.
- [ ] **Step 4:** Run the tests. Expect PASS.
- [ ] **Step 5: Commit.** Message: `Bring the town to the square on market day, and talk of it the day before`.

### Task 5: The traders and the lens

**Files:**
- Modify: `src/game/market.ts`, `src/art/marketSprites.ts`, `src/scene/visuals.ts`, `src/game/rules.ts` (`move`), `src/scene/prompts.ts` (`lineToSay`)
- Test: `tests/market.test.ts`, `tests/marketSprites.test.ts`, `tests/prompts.test.ts`

**Interfaces:**
- Consumes: Task 1's schedule, `personSpot` (Task 4), and `MEADOW_ENTRY`, `HILLS_BRIDGE_EXIT` and `MILESTONE_SITE`.
- Produces:
  - `TRADERS: readonly ['glass', 'spice']` and `TRADER_CART_SPOTS: Record<'glass' | 'spice', { x: number; y: number }>`. These are on the hills east of the square, clear of houses, stalls, the well, the sign and the crowd spots.
  - `traderSpot(state: GameState, trader: 'glass' | 'spice'): { area: AreaId; x: number; y: number; walking: boolean } | null`.
  - `lensHandover(state: GameState): { state: GameState; message: string }`.
  - Sprites `trader:{glass|spice}:{stand|walk0|walk1}` and `traderCart:{glass|spice}`. The glass cart shows panes and a brass pot; the spice cart shows sacks and jars.

- [ ] **Step 1: Write the failing tests:**
  - `traderSpot` is null off market days, at night, and before the square opens.
  - At dawn on a market day, it's in the meadow at the east edge on y = 18. Partway through `TRADER_ARRIVE`, it's in the meadow on the road or at `MEADOW_ENTRY`, then on the hills between `HILLS_BRIDGE_EXIT` and the cart spot.
  - From `TRADER_ARRIVE` until dusk, it's at the cart spot with `walking: false`. Over the dusk it reverses.
  - Cart spots are at least 1.5 tiles from every house plot on the hills, the stalls, the well, `SIGN_SPOT` and `MARKET_CROWD_SPOTS`.
  - `lensHandover`:
    - On the first market day, within 1.5 tiles of the glass trader at their cart, it sets `lensDay` and gives the trader line. On a later market day, or once `lensDay` is set, it does nothing.
    - On a day after the first market with no lens yet, within 1.5 tiles of a stallholder at work, it gives `{name} hands you a glass lens a trader left for you.` Away from them, or at night, nothing happens.
  - A `move` that hands over the lens returns its message, and `lineToSay` says it even though the area didn't change.
  - The sprites are registered, and each cart differs from the other.
- [ ] **Step 2:** Run the tests. Expect FAIL.
- [ ] **Step 3: Implement.**
  - In `market.ts`, add `traderSpot` (legs like `walkLegs`/`onTheWay` in `townsfolk.ts`; reuse `between`) and `lensHandover`.
  - Call `lensHandover` at the end of `move` and join its message after the crossing's.
  - Make `lineToSay` also announce when `after.town.market.lensDay !== before.town.market.lensDay`.
  - Draw the traders and carts in a new `addTraders` in `visuals.ts`. Carts are drawn only while the trader is at their spot. Walking traders pull their cart, drawn just behind them.
- [ ] **Step 4:** Run the tests, tsc and lint. Expect PASS.
- [ ] **Step 5: Commit.** Message: `Bring traders over the bridge on market day, and the first of them a glass lens`.

### Task 6: Journal lines, and the scripted game to the lens

**Files:**
- Modify: `src/game/journalEntries.ts` (`TownMoment` gains `squareOpen`, `firstMarket` and `lens`)
- Modify: `tests/playthrough/milestones.ts`, `tests/playthrough/player.ts`, `tests/playthrough.test.ts`
- Test: `tests/journalEntries.test.ts`

**Interfaces:**
- Consumes: `market.openDay`, `firstMarketDay` and `market.lensDay`.

- [ ] **Step 1: Write the failing journal tests.** Each line appears on the season page of the day it happened (`openDay`, `firstMarketDay` and `lensDay`), with the copy given under Decisions. None shows before it happens. A later market adds nothing.
- [ ] **Step 2:** Run the tests. Expect FAIL. Implement the rules in `TOWN_RULES`. Run the tests again. Expect PASS.
- [ ] **Step 3: The scripted game.**
  - Add the milestones `square-open` (`openDay !== null`), `market-day` (the day reaches `firstMarketDay`) and `lens` (`lensDay !== null`).
  - The player keeps building houses until none is open. On a market day, it walks to the glass trader's cart spot.
  - Replace `meadow-house` at the end of `MILESTONES_THAT_END` with `square-open`, `market-day` and `lens`. Update `townDone` to match.
  - Add a test that `lens` comes no more than `2` days after `square-open`, and no later than `LONGEST_MEADOW_WAIT` after the last house finished.
  - Note the playthrough's wall time before and after. If it more than doubles, stop the scripted town at `square-open` instead, and say so in the PR.
- [ ] **Step 4:** Run `npx vitest run tests/playthrough.test.ts` on Node 24 and Node 26 (see the meadow plan for the Node 26 command). Expect PASS.
- [ ] **Step 5: Commit.** Message: `Note the square opening, the first market day and the lens, and play the town through to them`.

### Task 7: Check it in the browser and open the PR

- [ ] **Step 1:** Run the full checks: `npx tsc --noEmit && npm run lint && npx vitest run && npm run build`. Expect all clean.
- [ ] **Step 2: Browser check.** Use seed saves at desktop and phone sizes, and compare at a zoomed crop, as in the meadow slice. Check:
  - the sign's two faces;
  - a market day in autumn (apples full) and in winter (snow, few eggs);
  - the stalls part-sold at midday and empty at dusk;
  - traders on the meadow road, on the bridge and at their carts;
  - the crowd in the square;
  - the lens being handed over.

  Fix anything that reads wrongly, and re-check it.
- [ ] **Step 3:** Push `agent/market-day` and open a PR to `main`. It notes that it builds on #164, and that it's the only PR bumping `SAVE_VERSION`. Wait for CI.
