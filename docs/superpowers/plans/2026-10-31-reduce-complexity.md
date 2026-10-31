# Reduce Complexity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task by task.

**Goal:** Remove two circular imports and lower the complexity of dense save and UI functions without changing behavior.

**Architecture:** Put clearing location logic with clearing geometry, wood accounting and food store initialization in small modules. Keep existing camp and food exports as re-exports. Extract named predicates and presentation helpers from the dense functions.

**Tech Stack:** TypeScript, Vitest, oxlint, Vite.

**Spec:** `docs/superpowers/specs/2026-10-31-reduce-complexity-design.md`

## Global Constraints

- Preserve save version 19, game behavior, and UI text.
- Add no dependencies.
- Do not introduce nested ternaries.

## Review Focus

- An unbuilt larder remains unreachable outside and inside camp.
- Stored wood remains usable for clearing costs.
- Every existing invalid save remains invalid.
- Every build status keeps its current label and description.
- No import cycles remain among camp, clearing, food, and wood.

---

### Task 1: Untangle camp dependencies

**Files:** `src/game/camp.ts`, `src/game/clearing.ts`, `src/game/food.ts`, `src/game/foodStore.ts`, `src/game/state.ts`, `src/game/wood.ts`

- [ ] Move `isInClearing(state)` to `clearing.ts`; re-export it from `camp.ts`.
- [ ] Move `availableWood(state)` and `spendWood(state, amount)` to `wood.ts`; re-export them from `camp.ts`.
- [ ] Import location directly from `clearing.ts` in `food.ts`, and wood directly in `clearing.ts`.
- [ ] Move the `FoodStore` shape and `emptyFood()` to `foodStore.ts`, so state initialization does not import the food behavior module.
- [ ] Run the existing location, clearing, wood, and food tests and check imports for cycles.

### Task 2: Name save invariants

**Files:** `src/game/save.ts`

- [ ] Extract checks for structure prerequisites, progress flags, companion fields, and friend-specific keepsake rules.
- [ ] Keep validation ordering and accepted/rejected shapes unchanged.
- [ ] Run `tests/save.test.ts` and the full test suite.

### Task 3: Simplify build button presentation

**Files:** `src/ui/panels.ts`

- [ ] Extract helpers for price, prerequisite description, and blocked description.
- [ ] Preserve every field for each build status.
- [ ] Run `tests/panels.test.ts`, lint, build, and the full test suite.

### Task 4: Review and PR

- [ ] Check the diff for behavior changes and nested ternaries.
- [ ] Verify dependency cycles and branch counts.
- [ ] Commit, push, and open a PR against `main`.
