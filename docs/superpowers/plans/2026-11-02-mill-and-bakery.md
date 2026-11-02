# Windmill and Bakery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a third, outer clearing step on the north and south sides. On it go a windmill, which grinds the whole granary into a flour bin in one job, and a bakery, which bakes one loaf each dawn onto a two-loaf shelf.

**Architecture:**
- **Game logic:** the new logic lives in a new `src/game/bakehouse.ts`, which holds the mill job, the dawn bake, shelf spoiling, taking a loaf and the morning line.
- **Clearing:** `clearing.ts` learns a third step depth, `outer`, through a `previousStep` helper. That lets the near → far rule generalise to near → far → outer.
- **Flour:** the mill's flour joins `availableFood` and `spendFood` as a third source of flour, after the bag and larder, while the survivor is in the clearing.
- **UI:** panels follow the granary panel pattern, with logic in `panels.ts` and only wiring in `App.ts`.

**Tech Stack:** TypeScript, Phaser, Vite, Vitest, oxlint.

**Spec:** `docs/superpowers/specs/2026-11-02-mill-and-bakery-design.md`

## Global Constraints

- **Harvest size.** The granary still holds one harvest of 16 grain. No change to `granaryCapacity`, `grainPerStrip` or `grainPerFlour` (2).
- **Mill flour bin.** `BALANCE.millFlourCapacity = 8`.
- **Bakery shelf.** `BALANCE.bakeryShelfCapacity = 2`. While the shelf is full, the oven waits and uses no flour.
- **Shelf loaves go soft** by `BALANCE.larderFreshDays` (5), counted from the bake day. A loaf taken into the bag keeps its bake day.
- **Mill job.** One heavy job, the same as the field: `BALANCE.fieldWorkSeconds` (12) and `BALANCE.fieldWorkEnergy` (8).
- **Costs:**
  - outer ground: `{ wood: 8, fiber: 4, stone: 2 }`
  - windmill: `{ wood: 12, fiber: 4, stone: 10 }`, prerequisite `granary`, ground `south-outer`
  - bakery: `{ wood: 10, fiber: 2, stone: 10 }`, prerequisite `windmill`, ground `north-outer`
- **Reach.** The outer steps reach 12 (north) and 11.5 (south). Only `north-outer` and `south-outer` exist; east and west get no outer step. The map stays 40 × 30.
- **Where jobs happen.** Panel jobs work anywhere in the clearing (`isInClearing`), and refusals say "Return to camp to …".
- **Fire bakes.** A loaf baked at the fire takes flour from the bag first, then the larder, then the mill.
- **The morning loaf** bakes at dawn wherever the survivor is.
- **Copy:**
  - morning line: "Fresh bread from the oven this morning."
  - journal line: "Woke to warm bread from my own oven."
- **No NPCs.** Nothing implies anyone but the survivor bakes.
- **Coverage.** SonarCloud needs 80% coverage on new code. App.ts is untested, so the logic goes in tested modules.
- **The frozen v23 fixture** is never edited. Every save-upgrade step is idempotent, because tests store current-shape saves under version 23.

## Review Focus

1. **A nearly full flour bin, or an odd grain.** Milling grinds only what fits in the bin. Grain that doesn't fit, and any odd grain, stays in the granary. The message gives the flour actually made.
2. **The oven waiting and starting again.** With the shelf full, or the bin empty, a dawn bakes nothing, uses no flour and leaves `lastBaked` alone. The morning line appears on the first bake and on a bake after a dawn that didn't bake, never two dawns running.
3. **Loaves going soft on the shelf.**
   - A shelf loaf is thrown out five dawns after baking, and counts in `lastSpoiled.bread` and the morning line.
   - A loaf taken into the bag keeps its bake day, so a four-day-old shelf loaf is thrown out at the next dawn, under the bag's rule.
4. **An old save loading.**
   - A version 26 camp loads with no outer ground, `millFlour: 0` and `bakery: { shelf: [], lastBaked: null }`.
   - A save claiming a windmill without `south-outer` cleared, or mill flour without a windmill, is rejected.
5. **Baking at the fire with only mill flour and a full bag.** The loaf is refused with "Make room in your bag for the loaf." Mill flour frees no bag space. With flour in the bag as well, the bag's flour is used first and the bake goes ahead.

---

### Task 1: Outer ground

**Files:**
- Modify: `src/game/clearing.ts` (`StepId`, `STEP_IDS`, `CLEARING_STEPS`, `markBlocker`, `clearGroundBlocker`, ground spend)
- Modify: `src/game/rules.ts:155-161` (`groundBlocker` wording) and the `clearGround` handler (stone spend)
- Modify: `src/game/save.ts:176-188` (`validClearing` previous-step rule)
- Modify: `src/ui/panels.ts:604-620` (`clearingSideView` label)
- Test: `tests/clearing.test.ts`

**Interfaces:**
- Produces:
  - `type StepId = \`${Side}-${'near' | 'far'}\` | 'north-outer' | 'south-outer'`
  - `STEP_IDS` with `'north-outer'` after `'north-far'` and `'south-outer'` after `'south-far'`
  - `previousStep(step: StepId): StepId | null`
  - `stepDepth(step: StepId): 'near' | 'far' | 'outer'`
  - `CLEARING_STEPS['north-outer'].room = ['bakery']`, `CLEARING_STEPS['south-outer'].room = ['windmill']`. These room names are valid before Task 2, because `roomLine` filters by `Object.hasOwn(BUILDINGS, id)`.

- [ ] **Step 1: Write the failing tests** in `tests/clearing.test.ts`

```ts
describe('the outer ground', () => {
  it('opens a third step on the north and south sides only', () => {
    expect(STEP_IDS).toEqual(['north-near', 'north-far', 'north-outer', 'east-near', 'east-far', 'south-near', 'south-far', 'south-outer', 'west-near', 'west-far']);
    expect(previousStep('north-outer')).toBe('north-far');
    expect(previousStep('south-far')).toBe('south-near');
    expect(previousStep('east-near')).toBeNull();
    expect(stepDepth('south-outer')).toBe('outer');
    expect(CLEARING_STEPS['north-outer']).toMatchObject({ side: 'north', reach: 12, cost: { wood: 8, fiber: 4, stone: 2 }, room: ['bakery'] });
    expect(CLEARING_STEPS['south-outer']).toMatchObject({ side: 'south', reach: 11.5, cost: { wood: 8, fiber: 4, stone: 2 }, room: ['windmill'] });
  });

  it('needs the far ground on that side first', () => {
    const state = axeCamp({ cleared: ['north-near'] }); // helper: axe crafted, survivor at the fire
    expect(markBlocker(state, 'north-outer')).toBe('Clear the far ground on that side first.');
    expect(markBlocker(axeCamp({ cleared: ['north-near', 'north-far'] }), 'north-outer')).toBeNull();
  });

  it('asks for stone as well as wood and fiber, and spends it', () => {
    // north-outer marked, every tree felled, the bag holding 8 wood and 4 fiber but no stone
    expect(clearGroundBlocker(readyToClear({ stone: 0 }))).toBe('Need 8 wood, 4 fiber and 2 stone to clear this.');
    const after = applyAction(readyToClear({ stone: 2 }), { type: 'clearGround' }).state;
    expect(after.clearing.cleared).toContain('north-outer');
    expect(after.inventory.stone).toBe(0);
  });

  it('plants its trees inside the map, beyond the far ground, and clear of every node and building spot', () => {
    for (const id of ['north-outer', 'south-outer'] as const) {
      const step = CLEARING_STEPS[id];
      expect(step.trees.length).toBeGreaterThanOrEqual(6);
      for (const tree of step.trees) {
        expect(tree.x).toBeGreaterThan(0); expect(tree.x).toBeLessThan(BALANCE.mapWidth);
        expect(tree.y).toBeGreaterThan(0); expect(tree.y).toBeLessThan(BALANCE.mapHeight);
        expect(sideAt(tree.x, tree.y)).toBe(step.side);
      }
    }
    // Reuse the existing clearance checks for the near and far trees (nodes, paths, camp structures, the wild grain at (25, 23)).
  });

  it('names the outer ground on the side buttons', () => {
    expect(clearingView(axeCamp({ cleared: ['north-near', 'north-far'] })).sides[0].label).toBe('North · outer');
  });
});
```

Keep the existing clearance tests for near and far trees, and extend them to cover the outer trees.

- [ ] **Step 2: Run them**

Run: `npx vitest run tests/clearing.test.ts`
Expected: FAIL. `previousStep` is not exported, and `STEP_IDS` has 8 entries.

- [ ] **Step 3: Implement**
  - **Steps and helpers.** In `clearing.ts`:
    - Add the two steps and their tree lists: 6–8 trees each, with mixed broadleaf and pine as in the existing steps. Place them between the far reach and the outer reach on their side, clear of the field (−3…0.5, 7), the wild grain (25, 23) and the house.
    - Add `previousStep` and `stepDepth`.
    - `sideReach` returns the deepest cleared step's reach: outer, then far, then near.
  - **The near-first rule.** `markBlocker`'s rule becomes "`previousStep(step)` must be cleared". The messages are 'Clear the near ground on that side first.' for a far step and 'Clear the far ground on that side first.' for an outer step.
  - **Stone.**
    - `clearGroundBlocker` names stone only when the cost has some. Without stone: `Need ${wood} wood and ${fiber} fiber to clear this.`; with stone: `Need ${wood} wood, ${fiber} fiber and ${stone} stone to clear this.`
    - The `clearGround` handler spends stone through `availableStone` and its spend helper, in the same way the hearth does.
  - **Wording elsewhere.** Replace every `endsWith('-far')` in `rules.ts`, `save.ts` and `panels.ts` with `stepDepth` or `previousStep`:
    - `groundBlocker`: `Clear the ${side} side's ${stepDepth(step)} ground first.`
    - the side button label: `North · outer`
    - `validClearing`: a cleared step needs its `previousStep` cleared too
  - **Build list.** The "No structures left to build." check already iterates `STEP_IDS`, so it picks up the new steps.

- [ ] **Step 4: Run the whole suite.** `src/art/terrain.ts` derives `MAX_REACH` from the steps, and `scene/map.ts` places standing trees from `STEP_IDS`. Both pick up the outer steps.

Run: `npx vitest run && npm run lint`
Expected: PASS. Existing tests that count steps or sides may need the new numbers. Record each such change in the ledger.

- [ ] **Step 5: Commit** with the message "Outer ground on the north and south sides"

---

### Task 2: Buildings, state and save

**Files:**
- Modify: `src/game/state.ts` (`BUILDINGS`, `GameState`, `BALANCE`, `createGame`)
- Modify: `src/game/saveUpgrades.ts` (version 27, step 26)
- Modify: `src/game/save.ts` (`validBakehouse`, plus the version note)
- Test: `tests/saveUpgrades.test.ts`, `tests/state.test.ts`, `tests/bakehouse.test.ts` (new)

**Interfaces:**
- Produces:
  - `BUILDINGS.windmill = { name: 'Windmill', description: 'Grind a whole granary of grain in one go', symbol: '✣', cost: { wood: 12, fiber: 4, stone: 10 }, prerequisite: 'granary', ground: 'south-outer' }`
  - `BUILDINGS.bakery = { name: 'Bakery', description: 'Bake a fresh loaf every morning', symbol: '⌂', cost: { wood: 10, fiber: 2, stone: 10 }, prerequisite: 'windmill', ground: 'north-outer' }`
  - `GameState.millFlour: number`
  - `GameState.bakery: { shelf: number[]; lastBaked: number | null }`, where the shelf holds loaf bake days
  - `BALANCE.millFlourCapacity = 8`, `BALANCE.bakeryShelfCapacity = 2`
  - `SAVE_VERSION = 27`

- [ ] **Step 1: Write the failing tests**, including `groundBlocker(state, 'windmill')` → "Clear the south side's outer ground first."

```ts
// tests/saveUpgrades.test.ts
it('brings a version 26 camp up to date with an empty mill and bakery', () => {
  const v26 = /* current state minus windmill, bakery, millFlour, bakery */;
  const up = upgradeSave(26, v26);
  expect(up.ok && up.state).toMatchObject({ structures: { windmill: false, bakery: false }, millFlour: 0, bakery: { shelf: [], lastBaked: null } });
  expect(upgradeSave(26, (up as { state: unknown }).state)).toEqual(up); // idempotent
});

// tests/bakehouse.test.ts
describe('saving the windmill and bakery', () => {
  it('rejects mill flour without a windmill, beyond the bin, or a windmill on uncleared ground', () => {
    // valid: windmill built on cleared south-outer with 8 flour
    // invalid: millFlour 1 with no windmill; millFlour 9; windmill true without 'south-outer' in cleared
  });
  it('rejects a shelf without a bakery, more than two loaves, a loaf baked after today, or lastBaked after today', () => {});
});
```

Write out the elided bodies using the save helpers that `tests/field.test.ts` already uses for `validField`.

- [ ] **Step 2: Run them.** Expected: FAIL, because the version is 26 and the fields are missing.

- [ ] **Step 3: Implement.**
  - Add the buildings, fields and balance values, and set them up in `createGame`.
  - Add `SAVE_UPGRADES[26]`, which adds only what is missing.
  - Add `validBakehouse`:
    - `millFlour` is an integer from 0 to 8, and above 0 only with `structures.windmill`.
    - `bakery.shelf` holds integers ≤ `day`, at most 2 of them, and is non-empty only with `structures.bakery`.
    - `lastBaked` is null or an integer ≤ `day`, and non-null only with the bakery.
  - Check that the existing validation of a building's ground and prerequisite covers both new buildings. Add a test if it doesn't.
  - TypeScript records keyed by `StructureId` will need the new keys, for example `CAMP_STRUCTURES` lookups or icons. Fill them with their final values, and record each one in the ledger.

- [ ] **Step 4: Run** `npx vitest run && npm run lint`. Expected: PASS.

- [ ] **Step 5: Commit** with the message "Windmill and bakery buildings, state and save"

---

### Task 3: The windmill grinds, and fire bakes reach its flour

**Files:**
- Create: `src/game/bakehouse.ts`
- Modify: `src/game/food.ts` (mill flour in `availableFood` and `spendFood`)
- Modify: `src/game/rules.ts` (`millGrain` action and handler)
- Test: `tests/bakehouse.test.ts`

**Interfaces:**
- Consumes: Task 2's state and buildings.
- Produces:
  - `millGrainBlocker(state: GameState): string | null`
  - `milledFlour(state: GameState): number`: the flour a mill job would make now, which is `min(floor(grain / 2), millFlourCapacity − millFlour)`
  - `GameAction` member `{ type: 'millGrain' }`
  - `reachableMillFlour(state: GameState): number` in `food.ts`: `state.millFlour` when the windmill is built and `isInClearing`, else 0

- [ ] **Step 1: Write the failing tests**

```ts
describe('milling at the windmill', () => {
  it('refuses until it can grind', () => {
    expect(millGrainBlocker(noWindmill)).toBe('Build the windmill first.');
    expect(millGrainBlocker(away)).toBe('Return to camp to mill the grain.');
    expect(millGrainBlocker(withGrain(1))).toBe('There isn\'t enough grain in the granary to mill.');
    expect(millGrainBlocker(binFull)).toBe('The mill\'s flour bin is full.');
    expect(millGrainBlocker(exhausted)).toBe(TOO_TIRED_MESSAGE);
  });

  it('grinds the whole granary in one heavy job, leaving an odd grain', () => {
    const { state: after, message } = applyAction(withGrain(15), { type: 'millGrain' });
    expect(after.field.grain).toBe(1);
    expect(after.millFlour).toBe(7);
    expect(message).toBe('The sails turn, and the millstones grind 7 flour.');
    expect(after.player.energy).toBe(before.player.energy - BALANCE.fieldWorkEnergy);
  });

  it('grinds only what fits in a nearly full bin, and the rest stays as grain', () => {
    const after = applyAction(withGrain(16, { millFlour: 7 }), { type: 'millGrain' });
    expect(after.state).toMatchObject({ millFlour: 8, field: { grain: 14 } });
    expect(after.message).toBe('The sails turn, and the millstones grind 1 flour. The bin is full.');
  });

  it('lets a fire bake use the mill\'s flour, after the bag and the larder', () => {
    // evening at the fire, windmill with 3 flour, bag 1 flour: baking spends the bag's flour, mill stays 3
    // bag empty: baking takes from the mill, mill 2
    // away from camp: availableFood(state, 'flour') counts only the bag
  });

  it('refuses a loaf from mill flour alone when the bag is full', () => {
    expect(dishBlocker(fullBagMillFlourOnly, 'loaf')).toBe('Make room in your bag for the loaf.');
  });
});
```

- [ ] **Step 2: Run them.** Expected: FAIL, because `bakehouse.ts` doesn't exist yet.

- [ ] **Step 3: Implement.**
  - **Blocker.** `millGrainBlocker` checks, in this order: windmill built, in the clearing, grain ≥ 2, bin not full, not exhausted.
  - **Handler.**
    1. Advance time by `workSeconds(state, BALANCE.fieldWorkSeconds)`.
    2. Tire by `fieldWorkEnergy`.
    3. Move `milledFlour × 2` grain into the bin.
    4. The message is `The sails turn, and the millstones grind ${n} flour.`, plus ` The bin is full.` when the bin reached capacity and grain is left.
  - **Food.** In `food.ts`:
    - `availableFood(state, 'flour')` adds `reachableMillFlour`.
    - `spendFood(state, 'flour', n)` spends what the bag and larder hold through the existing path, then takes the rest from `millFlour`.
    - Other foods are unchanged.
  - **Fire bakes.** The loaf's existing bag-room check in `dishBlocker` already runs on the paid state, so mill flour frees no space.

- [ ] **Step 4: Run** `npx vitest run && npm run lint`. Expected: PASS.

- [ ] **Step 5: Commit** with the message "The windmill grinds the granary; fire bakes reach its flour"

---

### Task 4: The bakery's morning loaf

**Files:**
- Modify: `src/game/bakehouse.ts` (`bakeryDawn`, `takeLoafBlocker`, `bakeryNews`)
- Modify: `src/game/rules.ts` (`dawn` calls it, `takeLoaf` action)
- Modify: `src/game/news.ts` (adds `bakeryNews`)
- Test: `tests/bakehouse.test.ts`

**Interfaces:**
- Produces:
  - `bakeryDawn(next: GameState): { lost: number }`: mutates `next` in the same style as `companionDawn`. It throws out soft shelf loaves, then bakes, and returns the loaves thrown out.
  - `takeLoafBlocker(state: GameState): string | null`
  - `GameAction` member `{ type: 'takeLoaf' }`
  - `bakeryNews(before: GameState, after: GameState): string | null`

- [ ] **Step 1: Write the failing tests**

```ts
describe('the morning loaf', () => {
  it('bakes one loaf at dawn from the mill\'s flour, wherever the survivor is', () => {
    const after = rest(acrossDawn(bakeryCamp({ millFlour: 3, away: true }))); // dawn into day 23
    expect(after.millFlour).toBe(2);
    expect(after.bakery).toEqual({ shelf: [23], lastBaked: 23 });
  });

  it('waits while the shelf is full or the bin is empty, using nothing', () => {
    expect(acrossDawn(bakeryCamp({ millFlour: 3, shelf: [21, 22] }))).toMatchObject({ millFlour: 3, bakery: { shelf: [21, 22], lastBaked: 22 } });
    expect(acrossDawn(bakeryCamp({ millFlour: 0 })).bakery.shelf).toEqual([]);
  });

  it('throws out a shelf loaf five dawns after baking, then bakes into the space', () => {
    const after = acrossDawn(bakeryCamp({ millFlour: 1, shelf: [18, 21], day: 22 })); // dawn into 23: 23 − 18 = 5
    expect(after.bakery.shelf).toEqual([21, 23]);
    expect(after.lastSpoiled).toMatchObject({ day: 23, bread: 1 });
  });

  it('says so on the first bake and after a pause, never two mornings running', () => {
    expect(bakeryNews(...dawnPair({ lastBaked: null, bakes: true }))).toBe('Fresh bread from the oven this morning.');
    expect(bakeryNews(...dawnPair({ lastBaked: 22, bakes: true, into: 23 }))).toBeNull();
    expect(bakeryNews(...dawnPair({ lastBaked: 20, bakes: true, into: 23 }))).toBe('Fresh bread from the oven this morning.');
    expect(bakeryNews(...dawnPair({ lastBaked: 20, bakes: false, into: 23 }))).toBeNull();
  });
});

describe('taking a loaf', () => {
  it('moves the oldest shelf loaf into the bag, keeping its bake day', () => {
    const { state: after, message } = applyAction(bakeryCamp({ shelf: [20, 22] }), { type: 'takeLoaf' });
    expect(after.bakery.shelf).toEqual([22]);
    expect(after.inventory.food.bread).toEqual([20]);
    expect(message).toBe('You take a loaf from the bakery shelf.');
  });

  it('refuses with no bakery, away from camp, an empty shelf, or a full bag', () => {
    // 'Build the bakery first.' / 'Return to camp to take a loaf.' / 'There\'s no loaf on the shelf yet.' / 'Make room in your bag for the loaf.'
  });

  it('lets a four-day-old loaf taken into the bag go soft at the next dawn, by the bag\'s rule', () => {
    // shelf [19], day 22 → take → dawn into 23: bag rule (3) throws it out
  });
});
```

- [ ] **Step 2: Run them.** Expected: FAIL.

- [ ] **Step 3: Implement.**
  - **Dawn order.** In `dawn` (`rules.ts:273`), after the bag and larder spoil, call `bakeryDawn(next)` and add its `lost` to `lost.bread` before `lastSpoiled` is set.
  - **Shelf spoiling.** Reuse `spoil` by wrapping the shelf: `spoil({ ...emptyFood(), bread: shelf }, next.day, BALANCE.larderFreshDays)`.
  - **Baking.** It happens only with the bakery built, `millFlour ≥ 1` and the shelf below capacity. It pushes `next.day` and sets `lastBaked = next.day`.
  - **Morning line.** `bakeryNews` returns the line when `after.bakery.lastBaked === after.day`, `after.day > before.day`, and `before.bakery.lastBaked !== before.day`. Add it to `newsBetween`, after `fieldNews`.
  - **Taking a loaf.** `takeLoaf` takes no time, like moving food to the larder. It takes the oldest loaf.

- [ ] **Step 4: Run** `npx vitest run && npm run lint`. Expected: PASS.

- [ ] **Step 5: Commit** with the message "The bakery bakes a loaf each morning"

---

### Task 5: Panels, forecast and App

**Files:**
- Modify: `src/ui/panels.ts` (`windmillPanelView`, `bakeryPanelView`, `foodLaidByDays`)
- Modify: `src/ui/App.ts` (two Camp-tab panels, plus clicks for `millGrain` and `takeLoaf`)
- Test: `tests/panels.test.ts`, `tests/bread.test.ts`

**Interfaces:**
- Produces:
  - `windmillPanelView(state): { shown: boolean; stored: string; mill: { disabled: boolean; hint: string } }`
  - `bakeryPanelView(state): { shown: boolean; shelf: string; note: string; take: { disabled: boolean; hint: string } }`

- [ ] **Step 1: Write the failing tests**

```ts
it('shows the mill\'s flour and why milling waits', () => {
  expect(windmillPanelView(withWindmill({ millFlour: 3, grain: 6 }))).toEqual({ shown: true, stored: '3 of 8 flour', mill: { disabled: false, hint: '' } });
  expect(windmillPanelView(withWindmill({ grain: 1 })).mill).toEqual({ disabled: true, hint: 'There isn\'t enough grain in the granary to mill.' });
  expect(windmillPanelView(fieldCamp()).shown).toBe(false);
});

it('shows the loaves on the shelf, one going soft, and the take button', () => {
  expect(bakeryPanelView(withBakery({ shelf: [22], day: 22 }))).toEqual({ shown: true, shelf: '1 of 2 loaves on the shelf', note: '', take: { disabled: false, hint: '' } });
  expect(bakeryPanelView(withBakery({ shelf: [18], day: 22 })).note).toBe('(1 going soft)');
  expect(bakeryPanelView(withBakery({ shelf: [] })).take).toEqual({ disabled: true, hint: 'There\'s no loaf on the shelf yet.' });
});

it('counts the mill\'s flour and the shelf\'s loaves as food laid by', () => {
  expect(foodLaidByDays(withBakery({ millFlour: 4, shelf: [22, 22] }))).toBe(10); // (4 + 2) × 50 / 30
});
```

"Going soft" uses the existing rule: a loaf whose next dawn throws it out. Reuse the helper that produces the bag's `(1 going soft)` note.

- [ ] **Step 2: Run them.** Expected: FAIL.

- [ ] **Step 3: Implement the views.** Then wire them in `App.ts`, after the granary panel:
  - `<section class="panel windmill-panel" data-tab="camp" hidden>` with eyebrow "THE SOUTH GROUND", heading "Windmill" and a `Mill the grain` button (`data-action="millGrain"`).
  - `<section class="panel bakery-panel" data-tab="camp" hidden>` with eyebrow "THE NORTH GROUND", heading "Bakery" and a `Take a loaf` button (`data-action="takeLoaf"`).
  - Render both in the same place as `granaryPanelView`.

- [ ] **Step 4: Run** `npx vitest run && npm run lint && npm run build`. Expected: PASS.

- [ ] **Step 5: Commit** with the message "Windmill and bakery panels"

---

### Task 6: Journal and README

**Files:**
- Modify: `src/game/journalEntries.ts` (`ovenBread` on the spring page)
- Modify: `src/art/journalIcons.ts` (a unique icon)
- Modify: `src/ui/yearJournal.ts` (hide `ovenBread` until the bakery stands)
- Modify: `README.md` (a section after "Grain field and granary", plus the intro list)
- Test: `tests/bakehouse.test.ts`, `tests/yearJournal.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
it('writes down the first spring morning the oven bakes', () => {
  // dawn into day 22 (spring) with a bakery that bakes → journal has 'ovenBread', message 'Written in your journal: Woke to warm bread from my own oven.'
  expect(journalSeason('ovenBread')).toBe('spring');
});
it('leaves the oven line off the spring page until the bakery stands', () => {
  // blanks with bakery − blanks without, on a spring page, is 1
});
```

- [ ] **Step 2: Run them.** Expected: FAIL.

- [ ] **Step 3: Implement.**
  - **Rule.** `ovenBread: m => onAfter(m, dawn(m) && m.after.bakery.lastBaked === m.after.day)`
  - **Page gating.** In `yearJournal.ts`, generalise `FIELD_ENTRIES` into a map from entry to the structure it waits on: `fireside → house`; `grainIn`, `autumnGrain`, `summerBread`, `winterBread → field`; `ovenBread → bakery`.
  - **README.** Describe:
    - the outer ground: north and south, after the far ground, 8 wood, 4 fiber and 2 stone
    - the windmill: one job grinds the granary into a bin of up to 8 flour, which fire baking uses after the bag and larder
    - the bakery: a loaf each morning onto a two-loaf shelf that waits when full, and shelf loaves going soft after five dawns
    - Don't mention the journal line.

- [ ] **Step 4: Run** `npx vitest run && npm run lint`. Expected: PASS.

- [ ] **Step 5: Commit** with the message "Oven journal line and README"

---

### Task 7: Art and the camp scene

**Files:**
- Modify: `src/art/phase3Sprites.ts` (`windmillSite`, `windmill`, `bakerySite`, `bakery`)
- Modify: `src/scene/visuals.ts` (`CAMP_STRUCTURES`, `builtTexture`)
- Test: `tests/art.test.ts`, `tests/clearing.test.ts`

**Interfaces:**
- Produces:
  - `windmill` has four sail frames, `turn0`–`turn3`, about 32 × 48. It is timber and stone with four lattice sails.
  - `bakery` has the frames `cold` and `baking` (chimney smoke), about 32 × 32. It is stone, with a chimney and a bread shelf by the door.
  - Each building gets a site sprite, in the same pattern as `granarySite`.

- [ ] **Step 1: Write the failing tests**

```ts
it('places the windmill and bakery on their outer ground, clear of every tree', () => {
  // CAMP_STRUCTURES has ['windmill', -5, 9.5] and ['bakery', 3, -10.5] (adjust after the browser check, keep the test's rules):
  // each spot's side is its ground's side, its distance from the fire is beyond the far reach and within the outer reach,
  // and no tree (standing or step) lies within the existing TREE_CLEARANCE.
});
it('turns the sails slowly and smokes the chimney on a baking morning', () => {
  // builtTexture(state, 'windmill', 0) === 'windmill:turn0'; at 700 ms → 'windmill:turn1' (one frame each 700 ms)
  // bakery: 'bakery:baking' while lastBaked === day and it is before noon (timeOfDay < daySeconds / 2), else 'bakery:cold'
});
```

Every frame must also pass the art tests (palette, size, frames).

- [ ] **Step 2: Run them.** Expected: FAIL.

- [ ] **Step 3: Implement** the sprites and the scene entries. `builtTexture` gains a `timeMs` parameter from its caller, which already has it.

- [ ] **Step 4: Browser check.**
  - Start the dev server with `npx vite --port 5199 --strictPort` and load a camp with both buildings, using a script in the scratchpad.
  - Check at 1280 × 800 that both stand clear of trees and the field, the sails turn, and there are no console errors.
  - Adjust the spots if they need it, and update the test.

- [ ] **Step 5: Run** `npx vitest run && npm run lint && npm run build`. Expected: PASS.

- [ ] **Step 6: Commit** with the message "Draw the windmill and bakery"
