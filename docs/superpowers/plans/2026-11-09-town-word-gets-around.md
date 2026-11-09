# The Town, Slice 2: Word Gets Around — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Grow the town from one house and one neighbour to a street of eight houses on the hills. A newcomer comes about five days after each house is finished, and the player picks which open camp job to hand them.

**Architecture:** This builds on slice 1 (`docs/superpowers/plans/2026-11-08-town.md`, merged in #155 and #157).
- `townSites.ts` gains seven more plots, opened one at a time.
- `jobs.ts` gains six camp jobs, each a pure dawn step that reuses the camp's own state helpers.
- `traveller.ts` generalises the arrival rule and takes the chosen job from the answer.
- The Visitor panel shows one button per open job.
- A save upgrade adds the new house slots.

**Tech Stack:** TypeScript, Phaser, Vite, Vitest and oxlint.

**Spec:** `docs/superpowers/specs/2026-11-08-town-design.md`. Slice 1's plan holds the interfaces this one extends.

## Decisions made with the user (2026-11-09)

- **Word's pace.** A newcomer comes at the first nightfall at least **5 days** after a house is finished and while it stands empty.
- **Job choice.** The **player picks** from the open jobs. The Visitor panel shows a button for each.

## Global Constraints

- It's an `EASTER EGG:` feature. Every new file carries the `EASTER EGG: the town, see src/game/town.ts` comment, and nothing goes in the README.
- Copy is plain and warm, not poetic, with no exclamation marks.
- No upkeep and no loss. Workers never fail, and whatever won't fit is left where it was, with nothing destroyed and no warning.
- It isn't a farming sim. There are no new crops or gatherable foods. Workers only do the camp's existing jobs.
- Everything is reachable by tap as well as by key. The panel buttons are the tap path.
- SonarCloud needs 80% coverage on new code. `App.ts` and the scenes are untested, so DOM logic goes in `src/ui/townPanel.ts` with a stand-in root.
- This must be the only open PR changing `SAVE_VERSION`. It goes from 40 to 41.
- Verify with `npx tsc --noEmit`, `npm run lint`, `npx vitest run`, `npm run build`, and a browser check at 1280x800 and 390x844.

## Review Focus

1. **A house finished with no job open.** For example, the player never built the bakery. No newcomer comes and the house waits empty. Once a job opens, the next newcomer comes. *(Task 3 tests it.)*
2. **A later newcomer refused three times.** They go on their way. Someone new comes no sooner than 10 days later, as long as the house is still empty. *(Task 3 tests it.)*
3. **A slice 1 save.** A version 40 save with Ada in house 0 upgrades with seven empty house slots, and plot 1 opens to build. *(Task 1 tests it.)*
4. **A full larder or full stores.** The new food jobs leave their goods where they are. Loaves stay on the shelf, vegetables stay in the ripe bed and apples stay on the tree. *(Task 2 tests it.)*
5. **A stale button.** A job is answered that is no longer open, or no one is asking. The answer is refused with an empty message and nothing changes. *(Task 3 tests it.)*

---

### Task 1: Eight plots, one opened at a time, and the save

**Files:**
- Modify: `src/game/townSites.ts`, `src/game/town.ts`, `src/game/saveUpgrades.ts`, `src/game/save.ts`
- Test: `tests/townHouse.test.ts`, `tests/save.test.ts`, `tests/saveUpgrades.test.ts`

**Interfaces:**
- Produces:
  - **The plots.** `HOUSE_PLOTS` has 8 entries, in building order and all on `'hills'`:
    `(31,23), (26,21), (22,21), (27,25), (18,21), (23,25), (14,21), (19,25)`.
    They form two rows south of the castle with a lane at y≈23 between them.
  - **House slots.** `HOUSE_COUNT = 8`.
  - **Names.** `TOWN_NAMES` grows to 24. Keep the first twelve in order and add `'Cuthbert', 'Edith', 'Godric', 'Joan', 'Lettice', 'Martin', 'Nell', 'Roger', 'Sybil', 'Walter', 'Alys', 'Ralf'`.
  - **When a plot opens.** `houseOpen(state, plot)` (in `town.ts`) is true when all three hold:
    - the house isn't finished;
    - every lower plot is finished;
    - either someone is waiting for a house (a person with `house: null`), or at least one person has stayed, every finished house has someone in it, and `openJobs(state).length > 0`.

    Until Task 2 lands, use `openJob(state) !== null` for that last condition, then switch to `openJobs` in Task 2.
  - **The upgrade.** `SAVE_VERSION = 41`. `SAVE_UPGRADES[40]` pads `town.houses` with `emptyHouse()` up to `HOUSE_COUNT`. Its comment reads: "Version 41: the town's street of eight plots. A version 40 town has one."
  - **Validation.** `validTown` also rejects a finished house above an unfinished one, so houses finish in plot order.

- [ ] **Step 1: Write the failing tests**
  - `townHouse.test.ts`. Generalise the plot-placement tests to loop over every plot:
    - each plot is 2.5 tiles or more from every hill tree;
    - each is more than 2 tiles from `HILLS_PATHS`;
    - each is more than 3 tiles from every moat tile, the cart, the gate and the outcrop;
    - no two plots' house sprites overlap each other or any castle sprite.

    Add:
    - `townSpots` lists only plot 0 while Ada waits;
    - once Ada is housed, plot 1 is the only one listed;
    - with house 1 finished and empty, no plot is listed;
    - with no job open, no plot is listed.
  - `saveUpgrades.test.ts`: a version 40 save with `houses: [{30,4,1,doneDay:30}]` and Ada in house 0 loads with 8 houses and `townSpots` giving plot 1.
  - `save.test.ts`. Rejects:
    - house 2 finished while house 1 isn't;
    - 7 houses.

    Accepts:
    - 8 houses with the first two finished and both occupied.

    Update the slice 1 fixtures to 8 houses.
- [ ] **Step 2: Run** `npx vitest run tests/townHouse.test.ts tests/save.test.ts tests/saveUpgrades.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the interfaces above.
- [ ] **Step 4: Run them.** Expected: PASS. Then run `npx vitest run`, since other town fixtures may need 8 houses.
- [ ] **Step 5: Commit.** `git commit -m "Lay out a street of eight house plots below the castle"`

### Task 2: The rest of the camp's jobs

**Files:**
- Modify: `src/game/jobs.ts`, `src/game/town.ts` (`JobId`, `JOB_IDS`)
- Test: `tests/jobs.test.ts`

**Interfaces:**
- Consumes: `JOBS`, `JOB_ORDER` and `openJob` from slice 1.
- Produces:
  - `JobId` becomes `'hens' | 'honey' | 'loaves' | 'wood' | 'beds' | 'field' | 'sheep' | 'orchard'`. `JOB_IDS` and `JOB_ORDER` list them in that order.
  - `openJobs(state): JobId[]` gives the open jobs nobody holds, in `JOB_ORDER`. `openJob(state)` becomes `openJobs(state)[0] ?? null`.
  - Each new `JOBS` entry is below as `offer`, `open`, `spot` and `dawn`. Every spot is in `'camp'`, given as an offset from `(BALANCE.campX, campY)`. Each dawn runs from `jobsDawn` after `beehiveDawn`, ignores where the survivor is and how tired they are, and reuses the camp's own helpers:
    - **`loaves`.**
      - Offer: `'see to the bread'`.
      - Open when the bakery and larder are built.
      - Spot: `(-0.5, -9)`.
      - Dawn: moves shelf loaves, oldest first, into the larder up to its room. Each keeps its bake day, as `takenLoaf` does.
    - **`wood`.**
      - Offer: `'keep the wood store stocked'`.
      - Open when `hasWoodStore`.
      - Spot: `(6.5, -0.5)`.
      - Dawn: adds `WORKER_WOOD = 2` to `storedWood`, up to `woodStoreCapacity`.
    - **`beds`.**
      - Offer: `'tend the vegetable beds'`.
      - Open when the beds and larder are built.
      - Spot: `(-4.5, 1.5)`.
      - Dawn, outside winter:
        - harvests each ripe bed into the larder if `BALANCE.cropYield` fits, emptying the bed as `harvestBed` does;
        - sows each empty bed;
        - with a well, waters every bed that `needsWater` (`wateredDay: day`).
    - **`field`.**
      - Offer: `'work the field and the mill'`.
      - Open when the field and granary are built and the workshop has `harvestTools`.
      - Spot: `(0.5, 7.5)`.
      - Dawn:
        - threshes each cut strip with `threshedField`;
        - cuts each `'gold'` strip with `cutField`;
        - in spring, sows each bare strip while seed lasts, with `sownField`;
        - if the windmill stands and `milledFlour(state) > 0`, mills with `milledState`.
    - **`sheep`.**
      - Offer: `'look after the sheep'`.
      - Open when the flock has arrived and the workshop has shears.
      - Spot: `(12.5, -9.5)`.
      - Dawn:
        - feeds with `fedSheep` once `fedUntil` has passed and there's straw;
        - in spring, shears with `shornSheep` when the flock hasn't been shorn this year and `fluff >= BALANCE.fluffOnArrival`.
    - **`orchard`.**
      - Offer: `'pick the orchard'`.
      - Open when the orchard and larder are built.
      - Spot: absolute `(6, 11.5)`.
      - Dawn: for each tree that is `treeRipe`, moves one apple into the larder if it fits and sets `ripeDay = day + BALANCE.orchardRipenDays`, as `pickOrchardApple` does.

- [ ] **Step 1: Write the failing tests** in `tests/jobs.test.ts`. For each new job:
  - with a worker, its dawn does the work above;
  - with no worker, nothing moves;
  - with the larder full, or the wood store, granary or wool basket at capacity, nothing is lost and the goods stay where they were.

  Also:
  - `openJobs` lists jobs in order and skips held jobs and jobs missing their buildings;
  - every job's spot is within 3 tiles of its building's spot in `CAMP_STRUCTURES` (for the orchard, within 3 tiles of an `ORCHARD_SPOTS` entry);
  - no two job spots are within 1 tile of each other.
- [ ] **Step 2: Run** `npx vitest run tests/jobs.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** Keep each dawn a small named function beside its `JOBS` entry. Then switch Task 1's `houseOpen` to `openJobs`.
- [ ] **Step 4: Run** `npx vitest run tests/jobs.test.ts tests/townHouse.test.ts tests/bakehouse*.test.ts tests/beds*.test.ts tests/field*.test.ts tests/sheep*.test.ts tests/orchard*.test.ts`. Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "Workers take on the bread, the wood, the beds, the field, the sheep and the orchard"`

### Task 3: Word gets around, and the player picks the job

**Files:**
- Modify: `src/game/traveller.ts`, `src/game/rules.ts` (the action type), `src/ui/panels.ts`, `src/ui/townPanel.ts`, `src/ui/App.ts`, `src/style.css`
- Test: `tests/traveller.test.ts`

**Interfaces:**
- Consumes: `openJobs` (Task 2), and `houseOpen`/`HOUSE_COUNT` (Task 1).
- Produces:
  - **Pace.** `WORD_DAYS = 5`.
  - **The arrival rule.** `travellerArrives(next)` keeps slice 1's rule while nobody has stayed (`people.length === 0`). Once someone has stayed, it sends the next name when all of these hold:
    - there's no traveller;
    - the castle is finished;
    - names are left;
    - `openJobs` isn't empty;
    - the `goneDay` rule allows it;
    - some finished house has no one in it and `doneDay + WORD_DAYS <= day`.
  - **The action.** `{ type: 'answerTraveller'; yes: boolean; job?: JobId }`.
    - On a yes with a `job`, that job must be in `openJobs`. Otherwise the answer is refused with `''`.
    - On a yes without one, the first open job is taken, which the scripted player relies on.
    - The newcomer moves into the lowest-numbered finished house with no one in it, or `house: null` if there's none (the slice 1 case).
    - The message stays `` `${name} will stay.` ``.
  - **Morning news.** `townNews` gives the first traveller's slice 1 line while `people.length === 0`. After that it gives `` `${name} heard there was work here, and came to the hall door at nightfall.` ``
  - **The Visitor panel's view.**
    `visitorView(state): { shown: boolean; copy: string; jobs: { job: JobId; label: string; shown: boolean }[]; no: string }`
    - `jobs` has one entry per `JOB_ORDER` job, with `shown` set for the open ones.
    - Each `label` is the offer with a capital letter, such as `'Keep the bees'`.
    - The copy is `` `${name} asks if there is any work. ${name} could ${offer}.` `` when one job is open, and `` `${name} asks if there is any work. Which job will you give ${name}?` `` when more are.
    - `no` stays `'Not today'`.
  - **Rendering.** `renderVisitorPanel(root, view)` sets the copy and `#visitor-no`. For each job it sets `#visitor-job-${job}`: hidden unless shown, with its label as text and `dataset.job` holding the job.
  - **Reading a button.** `visitorAction(dataset)` reads `{ type: 'answerTraveller', yes: true, job }` when `dataset.job` is a `JobId`, and a no otherwise.
  - **Markup.** In `App.ts`, `#visitor-yes` is replaced by 8 buttons, `id="visitor-job-<job>" data-job="<job>" class="ready" hidden`, in `JOB_ORDER`, each wired to `visitorAction`.

- [ ] **Step 1: Write the failing tests** in `tests/traveller.test.ts`. Update the slice 1 tests to the new view shape. Add:
  - With Ada housed and house 1 finished on day D:
    - no one comes at nightfall on D+4;
    - Tomas comes at nightfall on D+5, with the "heard there was work" morning note.
  - Answering yes with `job: 'beds'` makes Tomas a `beds` worker in house 1.
  - Answering with a job that isn't open, or with no one asking, is refused with `''`, and the state stays the same.
  - With house 1 finished and every remaining job lacking its building, no one comes. Once the bakery is built, someone comes at the next nightfall.
  - Tomas refused three times leaves. Someone comes again no sooner than `goneDay + 10`.
  - `visitorView` with two open jobs gives the "Which job" copy and two shown buttons with their labels.
  - `renderVisitorPanel` and `visitorAction` work against a stand-in page with 8 job buttons.
- [ ] **Step 2: Run** `npx vitest run tests/traveller.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** Add the panel's buttons to the `.visitor-panel` tool-row styles, stacked one per row.
- [ ] **Step 4: Run** `npx vitest run tests/traveller.test.ts tests/townHouse.test.ts tests/jobs.test.ts`. Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "Word gets around: a newcomer comes to each new house, and you choose their job"`

### Task 4: More greetings

**Files:**
- Modify: `src/game/townsfolk.ts`
- Test: `tests/townsfolk.test.ts`

**Interfaces:**
- Produces: `greeting(state, name)` checks in this order:
  1. **Dusk.** `'Good evening.'`
  2. **Raining** (`isRaining(state)`). `'Wet one today.'`
  3. **Winter.** `'Cold one today.'`
  4. **Otherwise.** On a day where `(TOWN_NAMES.indexOf(name) + day)` is odd, the season's line:
     - spring: `'The grass is coming on.'`
     - summer: `'Warm one today.'`
     - autumn: `'The leaves are turning.'`

     On an even day, the time line: `'Good morning.'` / `'Good afternoon.'`

  Each line is formatted `` `${name} · ${line}` ``. Saying something different on different days is the "more greetings". There are still no conversations.

- [ ] **Step 1: Write the failing tests** for each line by its condition, including that two people on one day can say different things. Update the slice 1 greeting tests to pick days that give the time line.
- [ ] **Step 2: Run** `npx vitest run tests/townsfolk.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run it.** Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "The town's people say a little more as you pass"`

### Task 5: Scripted player, checks, browser and PR

**Files:**
- Modify: `tests/playthrough/player.ts`, `tests/playthrough/milestones.ts`, `tests/playthrough.test.ts`

- [ ] **Step 1: Add the milestones** `town-house-2` ("Built the second house") and `town-house-3` ("Three houses, three neighbours"). The second is reached when house 1 is finished. The third is reached when house 2 is finished and has someone in it. Make `town-house-3` the last of `ENDS_THE_GAME` and `MILESTONES_THAT_END`.
- [ ] **Step 2: Assert the pace.** In `playthrough.test.ts`, in every game, the days between finishing house 0, house 1 and house 2 are each at most 30. The spec asks for a finish every 10 to 20 days, and 30 leaves room for winter. If a game exceeds it, report the gaps rather than loosening the bound silently.
- [ ] **Step 3: Teach the player.** It already answers yes, which takes the first open job, and builds through `townSpots`. Check that it goes on to the next plot.
- [ ] **Step 4: Run** `npx vitest run tests/playthrough.test.ts`. Expected: PASS, with the file under 30 seconds. If a game runs out of days, raise `DAYS_AFTER_THE_END` and say why in its comment.
- [ ] **Step 5: Run every check:** `npx tsc --noEmit`, `npm run lint`, `npx vitest run` and `npm run build`.
- [ ] **Step 6: Browser check** at 1280x800 and 390x844, from seeded saves:
  - a newcomer arriving 5 days after a house is finished, and the morning note;
  - the Visitor panel with several job buttons, picking one;
  - the new worker at their job by day;
  - the street with several houses at different stages;
  - a new greeting.

  There should be no page errors.
- [ ] **Step 7: Commit, push and open the PR** against `main`.

---

## After this slice

As in slice 1's plan: the square (paving, a well, then the stalls, kept by newcomers once the camp jobs run out), then the new ground beyond the hills, then market day and the glass lens.
