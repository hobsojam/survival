# Remaining Scene Complexity Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development or superpowers:executing-plans to implement each independent task.

**Goal:** Reduce SonarCloud cognitive complexity in `AmbientLife.update` (18) and `companionPose` (17) without changing behavior.

**Architecture:** Give the area-specific rendering and each companion's daytime pose a clear named unit. Preserve existing public interfaces and draw/update order.

**Tech Stack:** TypeScript, Vitest, Vite.

**Spec:** The two open `typescript:S3776` SonarCloud issues in `src/scene/ambientLife.ts:112` and `src/scene/companionPose.ts:71` on current `main`.

## Constraints

- Keep behavior and public interfaces unchanged.
- Do not introduce nested ternaries.
- Use existing focused tests before and after each change; add tests only for a meaningful gap.

## Tasks

### 1. Ambient life update

- [x] Run `tests/ambientLife.test.ts` as a baseline.
- [x] Extract a cohesive camp-only or area-specific update from `AmbientLife.update`.
- [x] Rerun the focused test and inspect the diff.

### 2. Companion pose

- [x] Run `tests/companionPose.test.ts` as a baseline.
- [x] Extract one or more named daytime pose decisions from `companionPose`.
- [x] Rerun the focused test and inspect the diff.

### 3. Integration

- [x] Run the full test suite, lint, build, and diff checks.
- [x] Review the combined changes.
- [x] Verify SonarCloud after opening the PR (PR #105: zero `typescript:S3776` issues).
