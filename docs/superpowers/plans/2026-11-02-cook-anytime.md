# Cook Anytime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permit every dish whenever the required fire is available, including daytime.

**Architecture:** Remove the time checks from cooking blockers. Update the combined cooking and stargazing panel and in-scene prompts so the new daytime action is visible. Preserve the independent night restriction on stargazing.

**Tech Stack:** TypeScript, Vitest, Vite.

**Spec:** `docs/superpowers/specs/2026-11-02-cook-anytime-design.md`

## Global Constraints

- Keep existing fire, location, ingredient, pot, dish order, effect, and fireplace banking rules.
- Keep stargazing after dark.
- Introduce no nested ternaries.

## Review Focus

- Daytime berry and pot dishes work at camp with a fire.
- Daytime fish works without a pot.
- The daytime house prompt exposes cooking when home fuel is available.
- A missing fire still blocks cooking, including at home.
- The day panel copy distinguishes cooking from stargazing.

---

### Task 1: Game rules

**Files:** `src/game/cooking.ts`, `tests/cooking.test.ts`, `tests/fishing.test.ts`, `tests/hud.test.ts`

- [x] Write daytime cooking tests for berries, fish, and pot dishes; retain tests for fire, place, pot, and ingredients.
- [x] Run focused tests and confirm they fail on the nightfall restriction.
- [x] Remove cooking nightfall checks and run focused tests again.

### Task 2: Discoverability and guide

**Files:** `src/scene/prompts.ts`, `src/ui/panels.ts`, `src/ui/App.ts`, `README.md`, `tests/prompts.test.ts`, `tests/panels.test.ts`

- [x] Write tests for daytime camp and house prompts and the panel hint.
- [x] Run focused tests and confirm they fail on old wording.
- [x] Update prompts, panel heading and hint, pot copy, and guide.
- [x] Run focused tests, full suite, lint, build, and diff check; review and commit.
