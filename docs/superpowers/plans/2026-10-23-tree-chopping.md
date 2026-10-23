# Tree Chopping Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Add a stone axe and six renewable chop targets.

**Architecture:** Fixed tree nodes live in game state, with ready day determining standing versus stump state. Pure actions craft the axe and chop a tree. Scene visuals draw dynamic trees; terrain skips their static counterparts. Save version 8 migrates prior saves.

**Tech Stack:** TypeScript, Phaser, Vitest, Vite.

**Spec:** `docs/superpowers/specs/2026-10-23-tree-chopping-design.md`

## Global Constraints

- Craft cost: 1 wood, 1 fiber, 1 stone; only at camp after the cold front.
- Chop reward: 2 wood; cost: 8 energy, 10 seconds; regrowth after 3 dawns.
- Only six marked mature trees can be chopped; fallen branches remain renewable.
- Preserve older saves and avoid nested ternary expressions.

## Review Focus

- Full bag cannot lose wood or set a tree to stump.
- A stump cannot yield wood twice before regrowth.
- Time crossing a dawn while chopping does not yield a tree ready immediately.
- Reload keeps crafted axe and stump timing.
- Dynamic trees render once, not over their static counterparts.

---

### Task 1: Game state and rules

**Files:** `src/game/state.ts`, `src/game/rules.ts`, `tests/state.test.ts`, `tests/rules.test.ts`

- [x] Write failing craft, chop, capacity, and regrowth tests; run them.
- [x] Implement fixed tree nodes, axe flag, and two actions; rerun focused tests.

### Task 2: Saves

**Files:** `src/game/save.ts`, `tests/save.test.ts`

- [x] Write failing version 7 migration and version 8 round-trip tests; run them.
- [x] Add version 8 validation and migration; rerun save tests.

### Task 3: Art and controls

**Files:** `src/scene/art.ts`, `src/scene/visuals.ts`, `src/scene/GameScene.ts`, `src/ui/App.ts`, `src/style.css`, `tests/visuals.test.ts`

- [x] Write failing standing/stump visual test; run it.
- [x] Render only dynamic chop targets, add craft card and X-key prompt.
- [x] Run full tests and build, review changed TypeScript for nested ternaries, commit, and open a stacked PR for issue #45.
