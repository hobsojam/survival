# Mature Tree Sprites Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make choppable camp trees visibly different from scenery trees.

**Architecture:** Add a mature frame to the existing broadleaf and pine sprite definitions. Render standing tree game objects with that frame while terrain scenery retains `still`; make the marked frame share the mature base with its fibre band.

**Tech Stack:** TypeScript, Vitest, Vite.

**Spec:** `docs/superpowers/specs/2026-10-31-mature-tree-sprites-design.md`

## Global Constraints

- Preserve tree positions, interactions, regrowth, sprite dimensions, anchors, and seasonal palette behavior.
- Keep stumps unchanged.
- Ensure both broadleaf and pine choppable trees have the new shape.

## Review Focus

- Both tree species use `mature` while standing, and stumps remain stumps until regrowth.
- Marked trees retain the fibre band on the mature trunk.
- The mature frame has a wider trunk and roots while the scenery `still` frame stays unchanged.
- All frames validate and use the existing seasonal color keys.

---

### Task 1: Mature tree art and rendering

**Files:**
- Modify: `src/art/terrain.ts`
- Modify: `src/scene/visuals.ts`
- Test: `tests/visuals.test.ts`

**Interfaces:**
- Consumes: `treeBroadleaf` and `treePine` sprite definitions; `sceneVisuals(state, timeMs)`.
- Produces: `mature` and `marked` frames on those sprite definitions.

- [x] Update standing-tree expectations to `mature` for broadleaf and pine, including regrowth.
- [x] Add a sprite assertion for wider mature trunks and visible roots, and a marked-frame band assertion.
- [x] Run `npx vitest run tests/visuals.test.ts` and confirm the new assertions fail for the missing frame.
- [x] Draw the mature trunk and roots in `src/art/terrain.ts`, preserving dimensions, anchor, and the `still` frame.
- [x] Select `mature` for standing state trees in `src/scene/visuals.ts`; leave stumps and marked selection unchanged.
- [x] Run the focused test, full test suite, lint, build, and diff check.
- [x] Review the final diff and commit.
