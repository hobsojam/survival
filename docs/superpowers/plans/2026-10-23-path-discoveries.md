# Path Discoveries Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Make three path destinations discoverable and useful.

**Architecture:** Static site definitions and persisted visit flags live in game state. A pure visit action handles reward and rest rules. Scene visuals select discovered frames; the scene picks the nearest site for V. Save version 9 migrates earlier versions.

**Tech Stack:** TypeScript, Phaser, Vitest, Vite.

**Spec:** `docs/superpowers/specs/2026-10-23-path-discoveries-design.md`

## Global Constraints

- Two-tile interaction radius, two-item rewards, and twenty-second spring rest restoring 20 energy.
- One-time rewards must not be lost with a full bag.
- Preserve versions 1–8 saves; avoid nested ternary expressions.

## Review Focus

- Nearby resource nodes do not block V interaction.
- Full bag leaves basket and cairn unclaimed.
- Repeat spring visits work after reload.
- Site art does not overlap a tree trunk.
- Existing saves preserve all earlier progression.

---

### Task 1: State and rules

**Files:** `src/game/state.ts`, `src/game/rules.ts`, `tests/state.test.ts`, `tests/rules.test.ts`

- [x] Write failing proximity, reward, capacity, and repeat-rest tests; run them.
- [x] Implement definitions, visit flags, and visit action; rerun tests.

### Task 2: Save migration

**Files:** `src/game/save.ts`, `tests/save.test.ts`

- [x] Write failing version 8 migration and version 9 round-trip tests; run them.
- [x] Add validation and migration; rerun save tests.

### Task 3: Art and UI

**Files:** `src/art/phase3Sprites.ts`, `src/scene/visuals.ts`, `src/scene/GameScene.ts`, `src/ui/App.ts`, `src/style.css`, `tests/visuals.test.ts`

- [x] Write failing site-state visual test; run it.
- [x] Add site art, V interaction, and discovery panel.
- [x] Run full tests and build, inspect changed TypeScript for nested ternaries, commit, and open a stacked PR for issue #46.
