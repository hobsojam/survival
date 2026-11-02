# Hide Completed Build Actions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove completed one-time actions from Build while retaining a compact clearing progress summary.

**Architecture:** Add `shown` to one-action Build views and update existing visibility flags. Make the renderer hide completed rows and empty sections. Keep cleared-ground text separate from buttons.

**Tech Stack:** TypeScript, Vitest, Vite.

**Spec:** `docs/superpowers/specs/2026-11-02-hide-completed-build-design.md`

## Global Constraints

- Preserve crafting, clearing, discovery, and readiness rules.
- Keep contextual tool-use guidance available outside completed Build cards.
- Introduce no nested ternaries.

## Review Focus

- A completed one-time action disappears, and remains absent after a render or reload.
- Unfinished but blocked actions keep their existing discovery visibility.
- Empty Forest tools and Workshop sections disappear and reappear when an unfinished action becomes available.
- Cleared sides disappear as buttons while their progress remains readable.
- The Build tab's ready marker ignores hidden completed actions.

---

### Task 1: One-time action views

**Files:** `src/ui/panels.ts`, `tests/panels.test.ts`, `tests/fishing.test.ts`, `tests/workshop.test.ts`

- [x] Add failing visibility assertions for completed lookout, tools, companion crafts, and workshop upgrades.
- [x] Run focused tests and confirm the assertions fail.
- [x] Add and update `shown` flags while preserving existing view copy and blockers.
- [x] Run focused tests and confirm they pass.

### Task 2: Clearing progress and rendering

**Files:** `src/ui/panels.ts`, `src/ui/App.ts`, `tests/panels.test.ts`

- [x] Add failing assertions for completed-side visibility and compact cleared-ground progress.
- [x] Run focused tests and confirm failure.
- [x] Update clearing view and renderer; hide rows and empty sections, and add the progress text.
- [x] Run focused tests, full suite, lint, build, and diff check. Review and commit.
