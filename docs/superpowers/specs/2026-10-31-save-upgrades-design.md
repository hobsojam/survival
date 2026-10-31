# Save Upgrades Design

This design was agreed with the user in chat on 2026-10-31. It's the step after the homestead batch, in the order agreed there: save migrations, then new areas, then decorating.

## Intent

The user's worry is playing for a long time and then finding the save no longer works. Until now, every change to the save format has bumped `SAVE_VERSION`, and older saves have been rejected. Today, the only way past a rejected save is **Start a new game**, which overwrites it. From version 23 on, no update to the game should make a save unusable.

## Goals

- **An upgrade step for every format change.** A save keeps its version number. When the format changes, the version goes up by one, and the change comes with an upgrade step that turns a save from the previous version into the new one.
- **Every step runs on load.** Loading runs each step needed, in order (23→24→25…). It then checks the result with the same strict validation as now and plays on. The next autosave writes the save in the current format.
- **Plain, safe steps.** Each step is a small, plain function. It gives new things their starting values: a new building unbuilt, a new store empty, a new upgrade not made. A step must never take away anything the player had.
- **No change for the player.** An upgraded save just loads as **Continue your camp**, with no message.
- **A frozen version 23 save.** A real version 23 save from a well-developed camp is kept in the tests as a file. A test loads it and checks the camp came through intact, and every future version must keep passing it.
- **No forgotten steps.** A test fails if the version goes up without a matching upgrade step.
- **Documentation.** The README's save rules and the homestead design's line "each project bumps the version and old saves are rejected" are replaced by "each format change adds an upgrade step".

## Non-goals

- **Saves older than version 23.** None exist (the user confirmed), and they're still rejected as now.
- **Keeping a broken save aside.** The user said the upgrade steps are enough, because they don't expect many saves.
- **Export, several save slots, or cloud saves.**
- **A real upgrade step now.** Nothing changes the format in this project. A made-up step in the tests proves the chain works.

## Anti-goals

- An upgrade that silently drops something the player had.
- A save from a newer game version being "upgraded" or overwritten. It's rejected with its own plain reason. *(My call. This happens if someone opens an older build of the game.)*

## Left to the builder

- The module layout and names.
- How the frozen save is produced, as long as it's a real `saveGame` output from a rich camp.
