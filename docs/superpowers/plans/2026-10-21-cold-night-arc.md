# Cold Night Arc Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a forecast three-day cold night with recoverable stakes and a permanent hearth reward.

**Architecture:** Keep event timing and consequences in the pure game rules. Add a small progress record to serializable state and migrate version 1 saves. The scene and UI read that state for weather art, forecast, and build controls.

**Tech Stack:** TypeScript, Phaser, Vite, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-21-cold-night-arc-design.md`

## Global Constraints

- Night begins at 160 seconds and dawn is 240 seconds.
- Storm fire consumption is 2 fuel seconds per game second.
- Success requires camp, shelter, burning fire, and warmth above 20 at dawn.
- Failure caps energy at 25, advances the new morning by 30 seconds, and retries three days later.
- Hearth costs 4 wood and grants 150 fuel seconds per wood, versus the base 90.
- Keep depleted movement and gathering recoverable; preserve valid version 1 saves.

## Review Focus

- Sleep crosses dawn in one action: the failure penalty must still apply after sleep restores energy.
- Large time advances cross multiple dawns: each storm resolves once and schedules the correct retry.
- Fire reaches zero exactly at dawn: it does not count as burning for success.
- A version 1 save on a late day: migration schedules a fair future storm without changing other progress.
- A locked hearth: it cannot be built early even with sufficient wood, and a failed action spends nothing.

---

### Task 1: Storm rules and hearth

**Files:** `src/game/state.ts`, `src/game/rules.ts`, `tests/rules.test.ts`

**Interfaces:** `GameState.progress: { nextStormDay: number | null; hearthUnlocked: boolean }`; `StructureId` gains `hearth`; `isColdNight(state: GameState): boolean` identifies the scheduled night.

- [ ] Add failing tests for storm start, fuel use, warmth, dawn success/failure, retry, sleep, and locked/unlocked hearth.
- [ ] Run `npm test -- --run tests/rules.test.ts` and confirm the new cases fail for missing behavior.
- [ ] Implement pure rules and state with the spec's values. Resolve storm at dawn and apply sleep recovery before the overnight advance.
- [ ] Run the rules test file and full suite; commit the working rules.

### Task 2: Save migration

**Files:** `src/game/save.ts`, `tests/save.test.ts`

**Interfaces:** Version 2 saves contain the new state; valid version 1 states migrate without modifying storage during load.

- [ ] Add failing round-trip, late-day migration, and malformed legacy save tests.
- [ ] Run the save test file and confirm the failures.
- [ ] Implement validation and migration, then run the full suite; commit.

### Task 3: Forecast and weather presentation

**Files:** `src/ui/App.ts`, `src/style.css`, `src/scene/GameScene.ts`, `src/scene/art.ts`, `README.md`

**Interfaces:** UI derives forecast and build status from `GameState`; the scene shows and announces storm transitions without changing the rules.

- [ ] Add forecast card, locked hearth card, storm scene effects, hearth drawing, and README guidance.
- [ ] Run tests and build; inspect desktop and narrow browser views plus sleep, outcome, and save continuation.
- [ ] Commit, push branch, and open a PR against updated `main` (link issue #6).
