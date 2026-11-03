# Timber-supported Mine Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan. Read the [design](../specs/2026-11-03-timber-mine-design.md) first.

## Goal

Build a visible timber-supported mine at the quarry for 16 wood and 4 fiber, allowing two independent digs per day.

## Files and interfaces

- `src/game/state.ts`, `rules.ts`: `progress.mineBuilt`, `mineReadyDay`, `mineBlocker()`, `buildMine`, and second `digQuarry` charge.
- `src/game/save.ts`, `saveUpgrades.ts`: version 31 migration and validation.
- `src/art/phase3Sprites.ts`, `scene/visuals.ts`: timber sprite with full, one, and spent frames.
- `src/scene/prompts.ts`, `tapTarget.ts`, `ui/panels.ts`, `ui/App.ts`: interaction and clear status.
- Tests in `rules`, `prompts`, `save`, `saveUpgrades`, and `visuals`.

## Steps

1. Write failing rules tests for location, materials, and two digs with normal time, energy, and bag limits. Add state fields and actions; rerun focused tests.
2. Write failing save tests for round trip, migration, and invalid timers/dependencies. Add version 31 upgrade and validation; rerun focused tests.
3. Write failing prompt and visual tests for construction, remaining digs, and art. Add Build tab control and quarry visuals; rerun focused tests.
4. Run the full test suite, lint, and build. Review changed TypeScript for nested ternaries, then commit.

## Review focus

- Building from camp or away from the face is refused.
- Stored wood and fiber pay the exact cost without spending stone.
- A full bag blocks each dig without consuming its daily charge.
- Old saves retain their first-dig readiness.
- Built mine visuals show both, one, and no remaining digs.
