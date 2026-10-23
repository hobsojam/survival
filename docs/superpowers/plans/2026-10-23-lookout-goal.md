# Lookout Goal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Add a post-storm lookout repair objective and completion moment.

**Architecture:** The pure rules own the repair action and cost; progress stores one completion flag. Scene visuals select damaged or restored art. The UI shows objective status and a one-time overlay on the successful action transition. Save version 7 migrates prior versions.

**Tech Stack:** TypeScript, Phaser, Vitest, Vite.

**Spec:** `docs/superpowers/specs/2026-10-23-lookout-goal-design.md`

## Global Constraints

- Repair requires a weathered cold front, distance at most 2 tiles from (30, 8), 4 wood, 2 fiber, and 2 stone.
- Repair consumes 12 seconds and 6 energy. Existing saves remain loadable.
- No nested ternary expressions in changed TypeScript.

## Review Focus

- Full bag: the eight-item cost remains carryable.
- Failed storm: repair remains locked without consuming items.
- Away from lookout: repair never occurs from camp.
- Reload: completed state persists without replaying the overlay.
- Nearby stone node: the dedicated repair control remains usable.

---

### Task 1: Rules and state

**Files:** `src/game/state.ts`, `src/game/rules.ts`, `tests/rules.test.ts`, `tests/state.test.ts`

- [x] Write failing tests for unlock, range, cost, and success.
- [x] Run focused tests to observe failure.
- [x] Add `repairLookout` action and `progress.lookoutRepaired` state; implement validation and mutation.
- [x] Run focused tests and commit the working rule.

### Task 2: Save migration

**Files:** `src/game/save.ts`, `tests/save.test.ts`

- [x] Write failing version 6 migration and version 7 round-trip tests.
- [x] Run tests to observe failure.
- [x] Add version 7 validation and migration, preserving prior versions.
- [x] Run save tests and commit.

### Task 3: Art and interface

**Files:** `src/art/phase3Sprites.ts`, `src/scene/visuals.ts`, `src/scene/GameScene.ts`, `src/ui/App.ts`, `src/style.css`, `tests/visuals.test.ts`

- [x] Write a failing visual-state test.
- [x] Add damaged/restored art, near-site prompt and L key, objective panel, repair button, and one-time completion overlay.
- [x] Run full tests and build; inspect changed lines for nested ternaries.
- [x] Commit, push, and open a PR linked to issue #44.
