# Bag and Storage Friction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show occupied bag spaces by category and let the player move food in bounded batches between bag and larder.

**Architecture:** Keep transfer rules in `src/game/rules.ts`, using the existing food stores and access checks. Extend pure panel views in `src/ui/panels.ts`; `App.ts` renders and dispatches the new controls. No saved state changes.

**Tech Stack:** TypeScript, Phaser UI shell, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-13-bag-storage-friction-design.md`

## Global Constraints

- Food remains a manual storage choice; materials keep settling automatically.
- Fresh food retains its picked day; store oldest first and take freshest first.
- Transfers stop at the larder or bag limit and never discard food.
- No save schema or capacity change.
- Review changed TypeScript for nested ternaries.

## Review Focus

- Almost full larder: bulk store moves only the remaining room.
- Almost full bag, including two-space stone or ore: bulk take moves only free food spaces.
- Mixed ages of fresh food: bulk transfers match repeated single-item actions.
- Away from the clearing or without a larder: every bulk control refuses without changing state.
- A disappearing row after its last item moves: UI hides it cleanly.

---

### Task 1: Bounded bulk transfer rules

**Files:** Modify `src/game/rules.ts`; test `tests/larder.test.ts`.

**Interfaces:** Add action variants `{ type: 'storeFoodAll'; item: FoodItem }` and `{ type: 'takeFoodAll'; item: FoodItem }`. Export `storeFoodAllCount(state: GameState, item: FoodItem): number` and `takeFoodAllCount(state: GameState, item: FoodItem): number` for panel views.

- [ ] **Step 1:** Write tests that bulk store moves only larder room, bulk take moves only free bag spaces, fresh food follows oldest/freshest ordering, kept food moves, and blockers preserve state.
- [ ] **Step 2:** Run `npx vitest run tests/larder.test.ts` and confirm the new tests fail because the bulk actions or count functions are missing.
- [ ] **Step 3:** Implement count functions and handlers using the existing blocker and `moveOne` rules, with one result message showing the moved count. Add both to the action handler map.
- [ ] **Step 4:** Run `npx vitest run tests/larder.test.ts` and confirm it passes.
- [ ] **Step 5:** Commit the rule and test changes.

### Task 2: Larder bulk controls

**Files:** Modify `src/ui/panels.ts`, `src/ui/App.ts`, `src/style.css`; test `tests/panels.test.ts`.

**Interfaces:** `larderView` exposes bulk counts, disabled states, and titles using Task 1's count functions. `larderMarkup` adds two buttons per row with the new action types.

- [ ] **Step 1:** Write panel tests for visible transfer counts, zero-count disabled state, and markup containing the new actions.
- [ ] **Step 2:** Run `npx vitest run tests/panels.test.ts` and confirm the new tests fail for missing bulk controls.
- [ ] **Step 3:** Extend the view, markup, `App` event dispatch and render, and responsive row CSS. Ensure rows disappear when both stores are empty.
- [ ] **Step 4:** Run `npx vitest run tests/panels.test.ts` and confirm it passes.
- [ ] **Step 5:** Commit the panel changes.

### Task 3: Bag space breakdown

**Files:** Modify `src/ui/panels.ts`, `src/ui/App.ts`, `src/style.css`; test `tests/panels.test.ts`.

**Interfaces:** Add `spaceBreakdown: string` to `BagView`. Render it beneath the existing carried count. Count each food, wood and fiber as one space, stone and ore as two; omit zero categories and show `Bag empty` at zero.

- [ ] **Step 1:** Write tests for an empty bag, a mixed full bag, and stone/ore weighting.
- [ ] **Step 2:** Run `npx vitest run tests/panels.test.ts` and confirm the new tests fail for the missing breakdown.
- [ ] **Step 3:** Implement the view value and responsive DOM line.
- [ ] **Step 4:** Run `npx vitest run tests/panels.test.ts` and confirm it passes.
- [ ] **Step 5:** Commit the panel changes.

### Task 4: Integration verification

**Files:** Update `README.md` for the new larder controls and bag display.

- [ ] **Step 1:** Update player instructions for bulk transfers and the space breakdown.
- [ ] **Step 2:** Run `npx tsc --noEmit`, `npm run lint`, `npx vitest run`, and `npm run build`; resolve any failures caused by this change.
- [ ] **Step 3:** Check the panel at desktop and phone sizes with a full bag and nearly full larder; record any manual check limitation.
- [ ] **Step 4:** Review the diff for nested ternaries, unintended save changes, and secret content in player-facing text.
- [ ] **Step 5:** Commit documentation or final fixes.
