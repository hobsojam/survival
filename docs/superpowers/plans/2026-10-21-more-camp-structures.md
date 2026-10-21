# More Camp Structures Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two optional camp structures that change the scene and gently improve cooking and warmth.

**Architecture:** Structure metadata stays in one table in the game state module. Pure rules apply the effects; the UI and scene read state and metadata. Save version 3 migrates valid older saves.

**Tech Stack:** TypeScript, Phaser, Vite, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-21-more-camp-structures-design.md`

## Global Constraints

- Drying rack costs 4 wood; windbreak costs 5. Building costs 12 seconds and 6 energy.
- Rack raises cooked-berry hunger recovery from 35 to 50. Windbreak halves unlit night warmth loss at camp.
- Preserve valid version 1 and 2 saves, all existing node and camp coordinates, and the gentle survival rules.

## Review Focus

- A rack built just before dawn must not affect a meal cooked before it exists.
- The windbreak must not weaken fire warmth or apply outside camp.
- Older saves must gain false flags without changing supplies or cold-night progress.
- New structure costs and availability must match between the rules and the build panel.
- A save with missing or non-boolean new flags must be rejected as version 3.

---

### Task 1: Structure data and rules

**Files:** `src/game/state.ts`, `src/game/rules.ts`, `tests/rules.test.ts`, `tests/state.test.ts`

- [ ] Add failing tests for build costs, cooked-berry benefit, windbreak conditions, and initial flags.
- [ ] Run the focused tests and confirm expected failures.
- [ ] Add the definition table, structure flags, and pure rule changes.
- [ ] Run focused and full tests; commit.

### Task 2: Save version 3

**Files:** `src/game/save.ts`, `tests/save.test.ts`

- [ ] Add failing tests for v3 round trip and v1/v2 migrations, including malformed v3.
- [ ] Run focused tests and confirm expected failures.
- [ ] Implement validation and migration; run full tests and build; commit.

### Task 3: Camp presentation and documentation

**Files:** `src/ui/App.ts`, `src/scene/art.ts`, `src/style.css`, `README.md`, `docs/superpowers/specs/2026-10-21-pixel-art-direction.md`

- [ ] Render both build options and distinct site/built art; update the README and pixel-art sprite list.
- [ ] Run tests and build; inspect desktop and narrow browser views, plus a saved upgrade continuation.
- [ ] Commit, push, and open a PR for issue #4 against updated main.
