# Building Wait Cues Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep wall and hall progress visible when the next building material is missing, including wool needed for a hall hanging.

**Architecture:** Extend the shortage prompt contract in `src/game/castleSites.ts` to accept the full game state as a third argument, while retaining the castle state and need arguments used by existing site rules. Wall and hall rules then format their own count-based shortage cues; `castlePrompt` remains the single selector between ready and shortage text.

**Tech Stack:** TypeScript, Vitest, Vite/Phaser browser UI.

**Spec:** `docs/superpowers/specs/2026-11-14-building-wait-cues-design.md`

## Global Constraints

- No saved-data, cost, timing, wool-growth, or season changes.
- No permanent progress panel and no intentional-secret reveal before the construction site appears.
- Keep ready action prompts and refusal messages as they are.
- Avoid nested ternaries in changed TypeScript.

## Review Focus

- A partly built wall with no stone shows its own side and count; adding stone returns the ready action prompt.
- Each hall shortage shows the current stage count, including zero and partly built stages.
- The hanging shortage uses current basket wool and updates after wool or hanging counts change.
- A stored hanging returns the ready action prompt even if wool is low.
- Unrevealed and finished sites do not gain a new construction prompt; the longest cue fits a phone viewport.

---

### Task 1: Wall and hall shortage cues

**Files:**
- Modify: `src/game/castleSites.ts`
- Modify: `tests/castle.test.ts`

**Interfaces:**
- Consumes: `castlePrompt(state: GameState, spot: SiteSpot): string`, `SiteRule.ask`, `GOODS.hangings.wool`, `NEEDS.wallSide`, and hall stage targets.
- Produces: Counted wall and hall shortage prompts; no new public interface.

- [ ] **Step 1: Write failing tests** in `tests/castle.test.ts` for the five Review Focus cases that can be checked with game state. Assert the specific player-visible cue and verify that ready prompts and blocker messages remain distinct.
- [ ] **Step 2: Verify red** with `npx vitest run tests/castle.test.ts`; the shortage prompt assertions fail on the old generic text.
- [ ] **Step 3: Implement the minimal cues** in `src/game/castleSites.ts`. Add a required `state: GameState` third parameter to `SiteRule.ask` and its call in `castlePrompt`; existing rules can ignore it. Format wall progress in `wallRule.ask`; format hall progress and live wool in `hallRule.ask`.
- [ ] **Step 4: Verify green** with `npx vitest run tests/castle.test.ts`, `npx vitest run --testTimeout 15000`, `npm run lint`, and `npm run build`.
- [ ] **Step 5: Check the longest cue** at 1280px desktop and 390px phone widths in a local browser, recording overflow observations.
- [ ] **Step 6: Commit** `src/game/castleSites.ts` and `tests/castle.test.ts` with `git commit -m "feat: show progress in building wait prompts"`.
