# Pacing check on current main

Issue: #169. Baseline: main at `81e3947` (after the bag storage and field journal changes).

## Current scripted baseline

I reran `VITE_PLAYTHROUGH_REPORT=1 npx vitest run tests/playthrough.test.ts --disable-console-intercept --silent=false --testTimeout 30000` on this revision. The test passed. The median castle milestones are essentially unchanged from the 2026-11-08 report: the orderly game finishes the keep on day 78, frames on day 101, the curtain wall on day 137, the hall on day 190, and the castle on day 205. The wandering median reaches those on days 78, 103, 148, 222, and 244. This confirms the long building stretches still exist in the rules; the simulator does not say how they feel to play.

The report's “nothing offered” totals now include play far beyond the castle, so they are not directly comparable with the earlier castle-only report. They should not be used to justify a balance change here.

## Hands-on UI samples

I loaded generated current-game saves in the browser at two long stretches, then inspected and used the nearby controls.

- **First wall side, day 106:** the north wall was at 8/30 stone. The wall was visibly rising, and the nearby prompt told the player to bring stone. The existing visual progress is useful, but most stones produce the same “another stone” message between the first, halfway, and last milestones.
- **Great hall, day 251:** the prompt showed roof beams at 2/12. Pressing Use set one beam, showed a short action message, and advanced the prompt to 3/12.
- **Great hall, day 255:** stone, beams, and fittings were complete, but neither hanging was made. The nearby prompt said to weave a hanging at the loom. Pressing Use did nothing further; this prompt did not show the wool required, current wool, or when shearing would be available again.

These are hands-on samples from generated saves, not a full human playthrough. A player save or a longer unscripted play session would be stronger evidence before changing the balance or adding a broad new activity system.

## Design direction to decide

1. Add progress and waiting cues at the existing wall and hall stages. This can improve feedback without changing the game's pace.
2. Add small optional activities during waits. This could add more to do, but needs a separate design to avoid chores or rewards that distort the seasonal rhythm.

The first is the smaller, more evidence-backed change. The second may suit a player who wants more interaction, so it needs player preference and a fuller playthrough before implementation.
