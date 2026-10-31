# Save Upgrades Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Saves from version 23 on keep loading after the save format changes. Each later version adds one upgrade step, and loading runs every step needed before the usual strict validation.

**Architecture:**
- A new module, `src/game/saveUpgrades.ts`, holds:
  - the oldest version that can be upgraded
  - a table of upgrade steps, keyed by the version each one upgrades *from*
  - `upgradeSave`, a pure function that runs the chain
- `loadGame` in `src/game/save.ts` calls `upgradeSave` between parsing and validation.
- A frozen version 23 save sits in `tests/fixtures/`. It and a check on the table guard every future version bump.

**Tech Stack:** TypeScript, Vitest (node), oxlint.

**Spec:** `docs/superpowers/specs/2026-10-31-save-upgrades-design.md`

**Commits:** the user asked to approve every commit. Before each commit step, stop, show the diff summary, and wait for a yes.

## Global Constraints

- `SAVE_VERSION` stays **23**. This project doesn't change the save format.
- `OLDEST_UPGRADABLE_VERSION = 23`.
- An upgrade step is keyed by the version it upgrades **from**: `SAVE_UPGRADES[23]` turns a version 23 save into version 24.
- A step receives the parsed save state (`unknown`, already JSON-parsed) and returns the next version's state. It must not remove anything the player had.
- The player sees nothing when a save is upgraded.
- Rejection reasons, shown on the start screen after "Your existing save could not be loaded:":
  - older than version 23: `'This save is from an older version of the game.'`
  - newer than `SAVE_VERSION`: `'This save is from a newer version of the game.'`
  - a missing step: `'This save could not be brought up to date.'`
  - a step that throws: `'This save could not be brought up to date.'`
  - a version that isn't a whole number: `'This save uses an unsupported version.'` (as now)
- Every task passes `npm test`, `npm run lint` and `npm run build` before committing.

## Review Focus

1. **A save from a newer build**, for example after the player opens an older deploy. It's rejected with the "newer version" reason. It's never upgraded, and nothing writes over it before the player chooses **Start a new game**. Task 1 pins the rejection, and the existing confirm-before-replace flow covers the rest.
2. **A version that isn't a whole number** (`"23"`, `23.5`, `null`). It's rejected as unsupported and never treated as a number to upgrade from. Task 1 pins this.
3. **An upgrade step that throws** on odd data. Loading returns invalid with the "brought up to date" reason and never crashes the start screen. Task 1 pins this.
4. **Upgrading leaves its input alone.** Each step works on a copy, so a step that fails halfway can't half-change a save that's then rejected. Task 1 pins this.
5. **The frozen save drifting.** If someone regenerates or edits `tests/fixtures/save-v23.json`, it stops being a real old save. A test checks that its `version` is exactly 23, and a comment at the top of its test file says never to edit it. Task 2 pins this.

---

### Task 1: The upgrade chain

**Files:**
- Create: `src/game/saveUpgrades.ts`, `tests/saveUpgrades.test.ts`
- Modify: `src/game/save.ts`
  - import `SAVE_VERSION` from `saveUpgrades.ts` and re-export it
  - in `loadGame`, replace the `parsed.version !== SAVE_VERSION` check with the upgrade
  - `movedBranches` and `validState` run on the upgraded state

**Interfaces:**
- Produces:
  - `export const OLDEST_UPGRADABLE_VERSION = 23`
  - `export type SaveUpgrade = (state: unknown) => unknown`
  - `export const SAVE_UPGRADES: Readonly<Record<number, SaveUpgrade>> = {}`, empty for now
  - `export type UpgradeResult = { ok: true; state: unknown } | { ok: false; reason: string }`
  - `export function upgradeSave(version: unknown, state: unknown, current: number = SAVE_VERSION, upgrades: Readonly<Record<number, SaveUpgrade>> = SAVE_UPGRADES): UpgradeResult`
  - `export const SAVE_VERSION = 23`, moved here from `save.ts`. `save.ts` imports and re-exports it, so the imports only run one way: `save.ts` → `saveUpgrades.ts`.

- [ ] **Step 1: Write the failing tests in `tests/saveUpgrades.test.ts`**
  - `upgradeSave(23, state, 23, {})` returns `{ ok: true, state }`, the same state.
  - With made-up steps `{ 23: s => ({ ...s, a: 1 }), 24: s => ({ ...s, b: (s as any).a + 1 }) }`, `upgradeSave(23, {}, 25, steps)` gives `{ ok: true, state: { a: 1, b: 2 } }`, applied in order. `upgradeSave(24, {}, 25, steps)` runs only the second step.
  - These are rejected:
    - version 22: `'This save is from an older version of the game.'`
    - version 26 with current 25: `'This save is from a newer version of the game.'`
    - `'23'`, `23.5` or `null`: `'This save uses an unsupported version.'`
    - a gap in the steps, `{ 23: … }` with current 25: `'This save could not be brought up to date.'`
    - a step that throws: the same reason
  - Review Focus 4: a step that mutates its argument (`s => { (s as any).x = 1; throw new Error() }`) leaves the original object unchanged. `upgradeSave` hands each step a `structuredClone` of the state.
  - `SAVE_UPGRADES` has exactly one step for each version from `OLDEST_UPGRADABLE_VERSION` up to `SAVE_VERSION - 1`, and no others. Today that means none. This is the test that fails when someone bumps `SAVE_VERSION` without adding a step.
  - Through `loadGame`, with a memory storage (copy the `MemoryStorage` helper from `tests/workshop.test.ts`):
    - a stored `{ version: 22, state: createGame() }` is invalid with the older-version reason
    - `{ version: 24, … }` is invalid with the newer-version reason
    - a valid version 23 save still loads

- [ ] **Step 2: Run `npx vitest run tests/saveUpgrades.test.ts`.** Expected: it fails because the module is missing.

- [ ] **Step 3: Implement `upgradeSave`, and call it from `loadGame`.** Version checks come first, then the loop from `version` up to `current`. Each step gets a fresh `structuredClone`, wrapped in try/catch. Existing tests that expect `'This save uses an unsupported version.'` for an old save now see the older-version reason. Update them to the new reason. Don't weaken them.

- [ ] **Step 4: Run `npm test && npm run lint && npm run build`.** Expected: all pass.

- [ ] **Step 5: Ask the user, then commit:** `Run save upgrade steps on load, from version 23 on`

### Task 2: The frozen version 23 save, and the docs

**Files:**
- Create:
  - `tests/fixtures/save-v23.json`: one real `saveGame` output, `{ "version": 23, "state": … }`, pretty-printed
  - `tests/saveFixture.test.ts`
- Modify:
  - `README.md`: the player-facing save paragraph (currently "Only saves in the current format (version 23) load."), and the developer section **Changing the save format**
  - `docs/superpowers/specs/2026-10-31-homestead-buildings-design.md`: the non-goal "Save migrations. Each project bumps `SAVE_VERSION`, and old saves are rejected, as now."

**Interfaces:**
- Consumes: `loadGame`, `saveGame`, `SAVE_VERSION`, `OLDEST_UPGRADABLE_VERSION` (Task 1)

- [ ] **Step 1: Produce the fixture.** Write a throwaway script in the session scratchpad, not the repo, and run it with `npx vite-node`. It builds a well-developed camp and saves it with `saveGame`. It must return `ok: true`. Prefer reaching the state through `applyAction` and `advanceTime`. Set fields directly only where playing there would be impractical, and validation will catch any inconsistency. The camp includes:
  - day 45 or later, so it's in its second year
  - every side's near and far ground cleared except the south
  - the finished shelter, now a woodshed, and the house
  - the hearth, woodpile, fibre stack, larder with some food, stone pile, toolshed, vegetable beds (one ripe, one growing and dry, one empty), well and workshop
  - all three workshop upgrades, and `cartWood` 7
  - the axe, pickaxe, pot and pack
  - a befriended fox, with a pillow
  - several journal entries across seasons
  - `fireplaceFuel` above 0
  - stored wood, stone and fiber above 0, and mixed food in the bag

  Write the save to `tests/fixtures/save-v23.json` with two-space indentation.

- [ ] **Step 2: Write the tests in `tests/saveFixture.test.ts`.** At the top of the file, put the comment: "save-v23.json is a frozen save from version 23. Never edit or regenerate it: it proves old camps keep loading." Then:
  - the fixture's `version` is `OLDEST_UPGRADABLE_VERSION` (23)
  - stored in a memory storage, `loadGame` gives `kind: 'loaded'`
  - the loaded state keeps these values exactly as in the fixture:
    - `day`, `player`, `inventory`
    - every structure that's `true`
    - `progress.workshop`, `cartWood`, `storedWood`, `storedStone`, `storedFiber`, `larder` and `beds`
    - `companion.friend`, `companion.pillow`
    - `journal.length` and each entry's id
  - These are compared field by field, not with one deep-equal, so future steps can add new fields without breaking the test.
  - `saveGame` of the loaded state succeeds, and writes `version: SAVE_VERSION`.

  The tests pass straight away, because the format hasn't changed yet. Their job is to guard future versions. To prove they can fail, temporarily set the fixture's `cartWood` to 13 in memory before loading, and watch the load test fail, then remove that.

- [ ] **Step 3: Update the docs.**
  - **README, player-facing:** "Saves from version 23 on keep loading: when the game's save format changes, an older save is brought up to date as it loads. Saves from before version 23 can't be loaded."
  - **README, developer section:** add that a format change bumps `SAVE_VERSION` by one, adds the step `SAVE_UPGRADES[old version]` in `src/game/saveUpgrades.ts` (giving new things their starting values and removing nothing), and must leave `tests/fixtures/save-v23.json` loading. Keep the existing one-open-PR rule.
  - **Homestead design non-goal:** change it to "Save migrations are their own project (`2026-10-31-save-upgrades-design.md`). From version 23 on, each format change adds an upgrade step."

- [ ] **Step 4: Run `npm test && npm run lint && npm run build`.** Expected: all pass.

- [ ] **Step 5: Ask the user, then commit:** `Freeze a version 23 save in the tests, and describe save upgrades`
