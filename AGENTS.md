# Project review guidance

When reviewing changes to code covered by mutation testing or its tests, check the latest available weekly mutation report (`mutation-report` artifact in the **Mutation testing** GitHub Actions workflow). Focus on surviving mutants in the changed behavior. Distinguish meaningful gaps from equivalent or low-value mutants, and recommend focused assertions only for meaningful gaps. Treat the mutation score as informational. Do not run the full mutation suite for every review; run it when investigating a relevant survivor or when explicitly requested. If no recent report is available, continue the review without one.

# Easter eggs

Some features are secrets on purpose: they're left out of the README and stay hidden on screen until the player finds them. Each one is marked in the code with an `EASTER EGG:` comment (`grep -rn "EASTER EGG" src`). Don't add these to the README or any other player-facing text, and don't flag their absence from the README as a documentation gap. The tests still cover them like any other feature.

Current easter eggs: a wolf friend brings a rabbit home on some winter dawns (`src/game/companion.ts`).
