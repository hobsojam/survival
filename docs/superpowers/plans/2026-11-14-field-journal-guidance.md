# Field Journal Guidance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the field journal's next hint useful through the hills, forge, and keep without revealing unknown places or secrets.

**Architecture:** Extend the existing `journalView(state).nextHint` calculation in `src/ui/journal.ts`. Use saved progress and structure fields; retain the early hint sequence and the existing workshop reminder. The UI continues to render one hint string.

**Tech Stack:** TypeScript, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-14-field-journal-guidance-design.md`

## Global Constraints

- No new panel or quest checklist.
- Do not name an undiscovered area or intentional secret.
- Do not claim all paths or work are finished.
- Keep copy invitational.

## Review Focus

- Hills reached before homestead: east path remains a useful unfinished early lead.
- Ore found before later early milestones: hint does not reveal the keep early.
- Workshop built before ore found: hint still points to ore.
- Forge already built when the hint reaches late stages: hint points to the keep.
- Loaded game with finished keep: hint stops urging construction and makes no completion claim about every place.

---

### Task 1: Extend the journal's next hint

**Files:**
- Modify: `tests/journal.test.ts`
- Modify: `src/ui/journal.ts`

**Interfaces:**
- Consumes: `journalView(state: GameState).nextHint: string`, existing `GameState` progress, structure, and keep fields.
- Produces: Updated `nextHint` values; no new public interface.

- [ ] **Step 1: Write failing tests** for the six states in the spec's hint table. Add cases for each Review Focus condition, and replace the old “every path” expectation. Check only player-visible text and progression order.
- [ ] **Step 2: Verify red** with `npx vitest run tests/journal.test.ts`. New late-stage cases fail on the old closing line.
- [ ] **Step 3: Implement the minimal hint sequence** in `journalView` using the first unfinished route milestone after existing path discovery. Preserve the existing workshop reminder when east far ground is clear. The finished keep line must be open-ended.
- [ ] **Step 4: Verify green** with `npx vitest run tests/journal.test.ts`, then `npx vitest run`, `npm run lint`, and `npm run build`.
- [ ] **Step 5: Commit** `src/ui/journal.ts` and `tests/journal.test.ts` with `git commit -m "feat: extend field journal guidance"`.
