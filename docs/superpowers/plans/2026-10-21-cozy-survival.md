# Cozy Survival Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a playable, gentle, single-survivor browser game in which gathering and camp building create a cozy refuge over several day/night cycles.

**Architecture:** Phaser renders a fixed top-down map and handles input. Pure TypeScript game rules own state transitions; the scene sends actions to those rules and redraws their results. Browser storage persists a versioned state with an explicit continue flow.

**Tech Stack:** TypeScript, Phaser, Vite, Vitest, browser localStorage.

**Spec:** `docs/superpowers/specs/2026-10-21-cozy-survival-design.md`

## Global Constraints

- One directly controlled survivor on one fixed 2D map; keyboard movement, nearby interaction, pointer-operated build menu.
- Gentle survival: hunger and cold hinder progress without death, permanent loss, or a soft lock.
- Renewable branches and berries; a wood-fueled fire; shelter, bed, and storage crate.
- Save locally; pause simulation while the tab is inactive; show save/load errors clearly.
- Personal, single-player game with no server, accounts, ads, monetization, combat, or friends in this build.
- Include a README with setup, controls, gameplay, save behavior, and verification commands.

## File map

- `package.json`, `tsconfig.json`, `index.html`, `vite.config.ts`: build, test, and browser entry.
- `src/game/state.ts`: serializable types, map definition, initial state, and balance values.
- `src/game/rules.ts`: gathering, camp actions, time, survival, and build transitions.
- `src/game/save.ts`: save schema validation and browser storage adapter.
- `src/scene/GameScene.ts`: world drawing, movement, interaction targets, feedback, and scene updates.
- `src/ui/App.ts`: title, HUD, build menu, save errors, and new/continue flow.
- `src/main.ts`, `src/style.css`: app startup and presentation.
- `tests/state.test.ts`, `tests/rules.test.ts`, `tests/save.test.ts`: deterministic rules and persistence checks.
- `README.md`: how to run, play, and verify the game.

## Review Focus

- Full inventory: gathering must leave the node intact and show useful feedback (Task 2).
- Empty energy or warmth away from camp: movement and gathering must remain possible (Task 3).
- Crossing multiple dawns in one time step: renewable nodes and day count must advance correctly (Task 3).
- Invalid or old save data: continue must explain the problem without replacing that save (Task 6).
- New game with an existing save: require a deliberate replacement choice (Task 6).

---

### Task 1: Running project and initial state

**Files:** Create `package.json`, `tsconfig.json`, `index.html`, `vite.config.ts`, `src/main.ts`, `src/style.css`, `src/game/state.ts`, `tests/state.test.ts`.

**Interfaces:** Produce `GameState`, `ResourceNode`, `StructureId`, `BALANCE`, and `createGame(): GameState` in `state.ts` for later tasks. `GameState` has `day`, `timeOfDay`, `player` (`x`, `y`, `energy`, `hunger`, `warmth`), `inventory` (`wood`, `food`), `fireFuel`, `structures` (`shelter`, `bed`, `crate`), and `nodes`. `ResourceNode` has a stable `id`, kind, position, and amount.

- [ ] Write `tests/state.test.ts`: `createGame()` has one survivor, a camp, at least 12 branch nodes and 8 berry nodes, empty inventory, unbuilt shelter/bed/crate, and a valid player spawn.
- [ ] Run `npm test -- --run tests/state.test.ts`; confirm it fails because the project/state does not exist.
- [ ] Add the Vite/Phaser/Vitest project files and implement `createGame()` with a fixed 40×30 tile map. Put `DAY_SECONDS = 240`, `NIGHT_START = 160`, initial carrying capacity 8, and all costs/rates in `BALANCE`.
- [ ] Run `npm install`, `npm test -- --run tests/state.test.ts`, and `npm run build`; confirm pass and a valid build.
- [ ] Commit: `feat: scaffold cozy survival state`.

### Task 2: Gathering and inventory

**Files:** Create `src/game/rules.ts`, `tests/rules.test.ts`; modify `src/game/state.ts`.

**Interfaces:** Produce `applyAction(state: GameState, action: GameAction): ActionResult`. `GameAction` is a discriminated union with `type: "gather"` and `nodeId`, `type: "build"` and `structureId`, `type: "move"` and `dx`/`dy`, or `type: "eat" | "stokeFire" | "rest"`. `ActionResult` contains `state` and `message`. Actions return a new state and never mutate their input.

- [ ] Write failing rules tests: a nearby branch yields one wood and costs 4 energy, a berry yields one food, distant or depleted nodes yield nothing, eating consumes one food and restores 25 hunger, and a full inventory leaves the node untouched with feedback.
- [ ] Run `npm test -- --run tests/rules.test.ts`; confirm the new cases fail.
- [ ] Implement gather/eat in `applyAction()`, using a two-tile interaction radius and capacity 8 until a crate is built. Gathering stays possible at zero energy; keep all amounts within their declared bounds.
- [ ] Run `npm test -- --run tests/rules.test.ts`; confirm pass.
- [ ] Commit: `feat: add gathering and inventory rules`.

### Task 3: Day, night, and gentle survival

**Files:** Modify `src/game/rules.ts`, `src/game/state.ts`, `tests/rules.test.ts`.

**Interfaces:** Produce `advanceTime(state: GameState, seconds: number): GameState` and `movementFactor(state: GameState): number`. The scene calls `advanceTime` only while active.

- [ ] Write failing tests for day rollover at 240 seconds; night starting at 160; node replenishment at dawn, including a step that crosses two dawns; hunger and warmth clamping to 0–100; movement slowed but still possible when energy, hunger, or warmth reach zero; and movement stopped at map boundaries.
- [ ] Run `npm test -- --run tests/rules.test.ts`; confirm those cases fail.
- [ ] Implement time progression, `move`, and survival. Hunger falls 1 per 8 seconds; outdoor night warmth falls 1 per 2 seconds. A lit fire within two tiles warms the survivor and consumes fuel; a built shelter slows cold loss at camp. Low meters reduce `movementFactor` to 0.65, never zero. A rest action advances 20 seconds and restores energy.
- [ ] Run `npm test -- --run tests/rules.test.ts`; confirm pass.
- [ ] Commit: `feat: add day night and gentle survival`.

### Task 4: Fire and camp building

**Files:** Modify `src/game/rules.ts`, `src/game/state.ts`, `tests/rules.test.ts`.

**Interfaces:** `applyAction()` implements `stokeFire`, `rest`, and `build`. Build definitions reside in `BALANCE`; scene/UI read those definitions for labels and costs.

- [ ] Write failing tests: one wood adds 90 seconds of fire fuel; fire fuel reaches zero without going negative; shelter costs 6 wood, bed 4, crate 4; crate raises capacity from 8 to 16; a bed improves rest from 25 to 50 energy; building costs 6 energy; actions require proximity to camp and cannot double-build or overspend.
- [ ] Run `npm test -- --run tests/rules.test.ts`; confirm those cases fail.
- [ ] Implement the tested transitions and structure effects. Keep resource replenishment sufficient for recovery after any depleted state.
- [ ] Run `npm test -- --run tests/rules.test.ts`; confirm pass.
- [ ] Commit: `feat: add fire and camp upgrades`.

### Task 5: Playable browser scene and interface

**Files:** Create `src/scene/GameScene.ts`, `src/ui/App.ts`; modify `src/main.ts`, `src/style.css`, `index.html`.

**Interfaces:** `GameScene` accepts a `GameState`, `onStateChange(state)`, and `onFeedback(message)`; `App` owns the current state, title/HUD/build menu, and scene lifecycle. The scene sends rules actions; UI displays their results.

- [ ] Add a manual smoke checklist to the task notes: move with WASD/arrows, gather using E near a node, eat, refuel, build shelter/bed/crate from a pointer menu, see counters and physical camp changes, and play through night without losing control.
- [ ] Run `npm run dev`; confirm the checklist cannot yet be completed.
- [ ] Implement the fixed map with original shape-based art, camera follow, visible resource nodes, camp structures, fire glow, contextual prompts, feedback, and day/night tint. Draw the HUD and build costs; pause game ticks on page hide or inactive tab.
- [ ] Run `npm run build` and complete the smoke checklist in a browser; correct interaction, visibility, and pacing defects found.
- [ ] Commit: `feat: make survival loop playable in browser`.

### Task 6: Save flow, README, and final verification

**Files:** Create `src/game/save.ts`, `tests/save.test.ts`, `README.md`; modify `src/ui/App.ts`, `src/main.ts`.

**Interfaces:** `saveGame(storage: Storage, state: GameState): SaveResult`; `loadGame(storage: Storage): LoadResult`, where load returns `empty`, `loaded(state)`, or `invalid(reason)` and never overwrites invalid input.

- [ ] Write failing tests for round-trip preservation of day, position, inventory, nodes, fire, and structures; missing saves; malformed JSON; unsupported schema versions; and storage write failure. Add a UI smoke check that new game asks before replacing an existing save.
- [ ] Run `npm test -- --run tests/save.test.ts`; confirm the new cases fail.
- [ ] Implement versioned local save, continue/new game menu, explicit replacement choice, save after successful actions and periodically, and visible load/save errors. Do not overwrite unreadable data automatically.
- [ ] Write `README.md` with prerequisites, install/run/build/test commands, controls, survival/building rules, save location/limitations, and what is in the first playable.
- [ ] Run `npm test -- --run`, `npm run build`, and a browser playthrough across three day/night cycles including close/reopen/continue; confirm all first-playable criteria in the spec.
- [ ] Commit: `feat: add save flow and document gameplay`.
