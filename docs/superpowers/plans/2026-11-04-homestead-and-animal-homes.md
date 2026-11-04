# Homestead and Animal Homes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a playable homestead and chicken rescue, renewable apples and eggs, and multiple animal friendships with three cosmetic homes.

**Architecture:** Extend the existing game state and save migration first. Put chicken rules in a focused game module and integrate them through rules/actions. Extend area crossing, terrain, visuals, tap targets, journal, panels, and cooking using existing patterns.

**Tech Stack:** TypeScript, Phaser, Vitest, Vite.

**Spec:** `docs/superpowers/specs/2026-11-04-homestead-and-animal-homes-design.md`

## Global Constraints

- Preserve version 23+ saves with a new upgrade step.
- Keep the rescue playable and fail-safe; chickens never die or leave.
- No happiness, carrying, combat, cutscene, or new dependency.
- Keep Easter eggs out of player-facing copy.

## Review Focus

- A save made while escorting chickens reloads with the flock still following.
- Crossing back and forth during escort never duplicates or loses the flock.
- A full bag leaves apples and eggs uncollected.
- Winter with no grain leaves chickens alive and does not produce eggs.
- Old saves with one friend retain that friend and can befriend the others.

---

### Task 1: State and saved progress

**Files:** `src/game/state.ts`, `src/game/save.ts`, `src/game/saveUpgrades.ts`, `tests/saveUpgrades.test.ts`, `tests/save.test.ts`

- [ ] Add tests for old-save migration, new-save validation, and invalid chicken/friend states; run them and confirm failure.
- [ ] Add the state shape, new structures and food items, version bump, and migration; make focused tests pass.
- [ ] Run the full suite and build; commit.

### Task 2: Multiple friendships and animal homes

**Files:** `src/game/companion.ts`, `src/game/wolves.ts`, `src/scene/companionPose.ts`, `src/scene/ambientLife.ts`, `src/scene/visuals.ts`, `src/ui/panels.ts`, `src/ui/ending.ts`, `src/game/soundscape.ts`, `tests/companion.test.ts`, `tests/companionPose.test.ts`

- [ ] Add tests showing another animal can be befriended after the first, all benefits work, and each home needs its animal and the house; confirm red.
- [ ] Update companion rules, cosmetic build definitions and visuals; make focused tests pass.
- [ ] Run the full suite and build; commit.

### Task 3: Homestead and playable rescue

**Files:** `src/game/areas.ts`, `src/game/chickens.ts`, `src/game/rules.ts`, `src/scene/map.ts`, `src/scene/mapGeometry.ts`, `src/scene/tapTarget.ts`, `src/scene/visuals.ts`, `src/scene/ambientLife.ts`, `src/ui/journal.ts`, `tests/areas.test.ts`, `tests/chickens.test.ts`, `tests/map.test.ts`

- [ ] Add tests for the east crossing, coop unlock, escort, crossing and reload continuity, shed, and seasonal apples; confirm red.
- [ ] Implement area rules, chicken state transitions, deterministic flock visuals, terrain, journal and tap interactions; make focused tests pass.
- [ ] Run the full suite and build; commit.

### Task 4: Eggs, apples and player-facing integration

**Files:** `src/game/food.ts`, `src/game/foodStore.ts`, `src/game/cooking.ts`, `src/game/rules.ts`, `src/ui/panels.ts`, `src/ui/App.ts`, `src/art/foodIcons.ts`, `README.md`, `tests/food.test.ts`, `tests/cooking.test.ts`, `tests/chickens.test.ts`

- [ ] Add tests for automatic grain use, egg rates, egg collection with bag limits, omelette cooking, apple eating and spoilage; confirm red.
- [ ] Implement food, cooking, UI and documentation; make focused tests pass.
- [ ] Run `npm test -- --run`, `npm run build`, and `npm run lint`; review changed JavaScript/TypeScript for nested ternaries; commit.
