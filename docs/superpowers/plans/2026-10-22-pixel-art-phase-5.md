# Pixel Art Phase 5 Plan

Goal: replace temporary wildlife art with the approved bird, fox, and firefly frames; add palette-indexed gather, fire, cooking, and cold-front effects without changing game state or saves.

1. Define and validate the 8×8 bird, 24×16 fox, 3×3 firefly, and small effect sprites in the existing palette texture pipeline. Test frame counts, sizes, and colors.
2. Keep wildlife movement and visits in `ambient.ts`/`ambientLife.ts`; select new animation frames for peck, hop, fly, trot, run, sit, and glow. Test pure frame selection.
3. Add an effects renderer that reads scene state and action triggers: gather pop, smoke, sparks, cook steam, wind streaks, and sleet. Implement optional stargaze shooting star and failed-night frost if they fit without gameplay changes. Keep positions and timing whole-pixel and bounded.
4. Capture the required review scenes and contact sheet, inspect at native scale, run tests/build, review the diff, then push one Part 5 PR.

Constraints: preserve game balance, save format, map coordinates, and existing lighting. No newly introduced nested ternaries.
