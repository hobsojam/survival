# Shelter Upgrades Implementation Plan

## Goal

Implement the approved shelter progression: thatch, stonework, porch, then door and shutters, with matching art and the thatch warmth benefit.

## Architecture

Reuse `BUILDINGS`, `GameState.structures`, the build action, save validation, and the existing shelter sprite. Four ordered structure flags drive unlocks, save validation, gameplay, UI, and stage art.

## Tasks

- [x] Add four building definitions and structure flags; generalize prerequisite checking and reject impossible stage combinations.
- [x] Apply the thatch warmth rate only on ordinary unlit nights at camp; preserve cold-front and lit-fire behavior.
- [x] Add sprite variants for all shelter stages, retain bed visibility, and select the appropriate variant in the camp scene.
- [x] Group shelter upgrades in the build panel and show prerequisite state and costs.
- [x] Increment save version to 16, with no migration for disposable test saves.
- [x] Run tests, lint, and build; inspect the final diff for readability and unintended changes.
