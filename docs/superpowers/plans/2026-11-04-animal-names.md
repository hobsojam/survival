# Animal Names Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the player name the bird, fox, wolf, sheep and chickens, and have notes, journal lines and panels use those names, without changing how the game plays.

**Architecture:** A new `src/game/names.ts` holds the saved names, the rules for a name and the wording helpers. A new `nameAnimal` action sets a name. `src/scene/animalTap.ts` finds the unnamed animal under a tap, and `src/ui/nameDialog.ts` holds the tested parts of the dialog that `App.ts` wires up.

**Tech Stack:** TypeScript, Phaser 3, Vite, Vitest, oxlint.

**Spec:** `docs/superpowers/specs/2026-11-04-animal-names-design.md`

## Global Constraints

- No new dependencies and no image files.
- `SAVE_VERSION` 35 with an upgrade step, and the only open PR changing the save format. Never edit `tests/fixtures/save-v23.json`.
- A name is trimmed, 1 to 12 characters, and not blank. Two animals may share a name. No renaming.
- Names change nothing about how the game plays. Naming takes no time and no energy.
- Lines about wild animals keep their wording.
- Copy is plain, warm and short, with no exclamation marks, and avoids pronouns for animals where it can.
- The rabbit note uses the wolf's name but stays out of the README (`AGENTS.md`).
- New code needs 80% coverage, and `App.ts` is untested, so its logic goes in tested helpers.

## Review Focus

1. Typing a name containing W, A, S, D, E, P or a space: every letter reaches the box, the survivor doesn't move, and no key command fires. Phaser's `addKeys` captures these keys by default, so they may never reach the input. *(Browser check, Task 5.)*
2. A name such as `<b>x</b>` shows as those literal characters everywhere: notes, journal, panels, ending. *(Tests in Tasks 3 and 4; browser check in Task 5.)*
3. A player who never names the hens taps the coop for eggs: no dialog, ever. *(Test in Task 5.)*
4. A journal line stays as written: naming an animal afterwards doesn't change old lines, and a named line survives reload. *(Tests in Task 3.)*
5. A version 34 save with friends already made: it loads with no prompt, and the friend can still be named by tapping. *(Tests in Tasks 1 and 5.)*

---

### Task 1: Saved names and the naming action

**Files:**
- Create: `src/game/names.ts`, `tests/names.test.ts`
- Modify: `src/game/state.ts`, `src/game/rules.ts`, `src/game/save.ts`, `src/game/saveUpgrades.ts`, plus expected values in `tests/saveFixture.test.ts` and similar

**Interfaces:**
- Produces:
  - `GameState.names: { bird: string | null; fox: string | null; wolf: string | null; sheep: (string | null)[]; chickens: (string | null)[] }`, with both arrays of length 3.
  - `type NameTarget = { kind: 'friend'; animal: Friend } | { kind: 'sheep'; index: number } | { kind: 'chicken'; index: number }`
  - `cleanName(raw: string): string | null`
  - `nameOf(state: GameState, target: NameTarget): string | null`
  - `nameBlocker(state: GameState, target: NameTarget, raw: string): string | null`
  - `named(state: GameState, target: NameTarget, name: string): GameState`
  - `friendCalled(state: GameState, animal: Friend, fallback: string): string`, which returns the name, or the fallback when there is none.
  - `anyNamed(state: GameState): boolean`
  - `GameAction` gains `{ type: 'nameAnimal'; target: NameTarget; name: string }`.

- [ ] **Step 1: Write the failing tests** in `tests/names.test.ts`:
  - `cleanName`: `'  Maud '` gives `'Maud'`; `''` and `'   '` give null; 12 characters pass; 13 give null.
  - A new game has every name null.
  - `nameAnimal` sets just that animal's name, with no change to `timeOfDay`, `player` or anything else.
  - Refused, with the state unchanged: a blank name; an animal already named ("Maud already has a name." with the name filled in); a friend not yet made; a sheep before they arrive; a chicken before `chickens.rescued`.
  - Two animals may share a name.
  - Saves: a named friend, sheep and chicken save and load. These are rejected: a 13-character name, a non-string name, an array of the wrong length, a name on an absent animal.
  - A version 34 save upgrades to version 35 with all names null, keeping its friends.

- [ ] **Step 2: Run** `npx vitest run tests/names.test.ts`. Expected: FAIL, as `names.ts` doesn't exist.

- [ ] **Step 3: Implement.** The handler uses `refuse` and returns `{ state: named(...), message: '' }`. Add `validNames` to the checks list in `save.ts`. Bump `SAVE_VERSION` to 35 with step 34.

- [ ] **Step 4: Run all tests.** `npm test -- --run`. Expected: PASS after updating expected-value tests.

- [ ] **Step 5: Commit** `Save a name for each animal`.

### Task 2: Names in the lines that mean a friend, and new morning notes

**Files:**
- Modify: `src/game/names.ts`, `src/game/companion.ts`, `src/game/wolves.ts`, `src/game/rules.ts`, `src/game/news.ts`, `src/ui/panels.ts`, `src/ui/ending.ts`
- Test: `tests/names.test.ts`

**Interfaces:**
- Consumes: `friendCalled`, `anyNamed`.
- Produces: `namedNote(state: GameState, day: number): string | null`.

- [ ] **Step 1: Write the failing tests:**
  - With names, these lines use them; without, they read exactly as today:
    - `companionNews` for the fox's berry and the wolf's rabbit.
    - The wolf's `chased` line in `wolves.ts`.
    - `alarmMessage` ("Your bird woke you.").
    - `pillowView`'s "Your bird's feathers".
    - The ending: one friend gives "a friend in Rusty"; several give "3 animal friends: Rusty, wolf, bird", using the name where there is one.
  - A wild wolf's line stays "A wolf slipped into the dark camp and took a ration." even with a named friendly wolf.
  - `namedNote`: null for all of 400 days with nothing named. With one name, between 20 and 60 notes over 400 days, each containing that name. The same day always gives the same note. It never names an unnamed animal.
  - `newsBetween` adds the note once across a dawn, and not on a step within a day.

- [ ] **Step 2: Run the tests.** Expected: FAIL.

- [ ] **Step 3: Implement.** `namedNote` is worked out from the day alone, so it adds nothing to the save: a small hash of the day chooses about one day in ten, the animal among those named, and a line from that kind's pool. Pools hold at least 3 lines each for sheep, chickens, and each friend, using `{name}`. Include "{name} was in the feed again." and "{name} has stopped pretending not to know you." for sheep. Call it from `newsBetween` when `after.day > before.day`.

- [ ] **Step 4: Run all tests.** Expected: PASS.

- [ ] **Step 5: Commit** `Use the names in notes and panels`.

### Task 3: The journal remembers names

**Files:**
- Modify: `src/game/journalEntries.ts`, `src/art/journalIcons.ts`, `src/ui/yearJournal.ts`, `src/game/save.ts`
- Test: `tests/names.test.ts`

**Interfaces:**
- Produces: `JournalEntry` gains `name?: string`; `Noticed` gains `name?: string`. New ids `namedAutumn`, `namedWinter`, `namedSpring`, `namedSummer`. Lines may contain `{name}`, filled from the entry when shown. `journalText` and the "Written in your journal" message use the same filling.

- [ ] **Step 1: Write the failing tests:**
  - Shearing with a named sheep, with `name` set to the first named one: "Sheared Maud and the others. They looked smaller and rather cross." For a cloud: "Sheared the cloud. There was a Maud in there after all." With no names, today's lines.
  - Each season's named line is written at the first dawn in that season with something named, and stores the name. It leaves no blank until something is named (`blanks` differs by 1, as `tests/keepsakeMoments.test.ts:89-93` does).
  - **A line stays as written:** a line written before naming shows no name afterwards, and one written with a name keeps it. A named line survives a save and load.
  - **Markup stays text:** `renderJournalPage` with the name `<b>x</b>` shows those literal characters and creates no `b` element.
  - Saves are rejected when a `{name}` line has no `name`, or when `name` isn't a valid name.

- [ ] **Step 2: Run the tests.** Expected: FAIL.

- [ ] **Step 3: Implement.** Shearing's named variants are lines 2 and 3 of its entry, so existing variant numbers still mean what they did. Give each new id its own icon, as `JOURNAL_ICONS` requires. Follow `KEEPSAKE_MOMENTS` for the "no blank until" rule, keyed on `anyNamed`.

- [ ] **Step 4: Run all tests.** Expected: PASS.

- [ ] **Step 5: Commit** `Write the names in the journal`.

### Task 4: The quiet list

**Files:**
- Modify: `src/game/names.ts`, `src/ui/panels.ts`, `src/ui/App.ts`
- Test: `tests/panels.test.ts`

**Interfaces:**
- Produces: `rosterLine(names: readonly (string | null)[]): string`. `sheepPanelView` and `chickenCoopPanelView` gain `names: string`. New `friendRosterView(state): { shown: boolean; text: string }`.

- [ ] **Step 1: Write the failing tests:**
  - `rosterLine`: `[null, null, null]` gives `''`; one name gives "Maud lives here."; two give "Maud and Bess live here."; three give "Maud, Bess and Dot live here."
  - It never mentions how many are left.
  - The sheep and coop views carry the line.
  - `friendRosterView` is hidden with no named friends, and lists only named ones otherwise.

- [ ] **Step 2: Run the tests.** Expected: FAIL.

- [ ] **Step 3: Implement.** The spec's "friends' panel" doesn't exist as such, so put the friends' line in the field journal panel in the Camp tab, as `<p id="friends-named">`. Use `setText` for all three lines, never markup. Hide each element when its text is empty.

- [ ] **Step 4: Run all tests.** Expected: PASS.

- [ ] **Step 5: Commit** `List the names in the panels`.

### Task 5: Asking for a name

**Files:**
- Create: `src/scene/animalTap.ts`, `src/ui/nameDialog.ts`, `tests/animalTap.test.ts`, `tests/nameDialog.test.ts`
- Modify: `src/scene/GameScene.ts`, `src/scene/visuals.ts`, `src/ui/App.ts`, `src/style.css`, `README.md`

**Interfaces:**
- Consumes: `NameTarget`, `nameOf`, `nameBlocker`.
- Produces:
  - `unnamedAnimalAt(state: GameState, timeMs: number, x: number, y: number): NameTarget | null`, with x and y in tiles.
  - `newlyStayed(before: GameState, after: GameState): Friend | null`
  - `namePromptCopy(target: NameTarget): { title: string; placeholder: string }`
  - `GameScene` gains a constructor callback `onAskName: (target: NameTarget) => void`, and `setTyping(typing: boolean): void`.

- [ ] **Step 1: Write the failing tests:**
  - `unnamedAnimalAt` returns a sheep when the tap lands on its painted pixels, and null for: a tap beside it inside its frame, a named sheep, a sheep with no pen arrival, another area, and any tap where `pickTapTarget` finds something other than ground.
  - Chickens count only once rescued, and only at camp.
  - **A coop tap is never a naming:** tapping the coop's art gives null for all three unnamed hens at many `timeMs`, and each hen has some painted pixel where it returns that hen.
  - A friend from a version 34 save returns its target when tapped.
  - `newlyStayed` gives the animal on the action that makes it stay, and null otherwise, including on loading.
  - `namePromptCopy` for the fox: "The fox has stayed. What will you call it?"; a sheep: "What will you call this sheep?"; a chicken: "What will you call this hen?"

- [ ] **Step 2: Run the tests.** Expected: FAIL.

- [ ] **Step 3: Implement the helpers.** Build positions from `sceneVisuals` ids `sheep-N` and `chicken-N` and the friend's pose in `companionPose.ts`. Hit-test against each frame's painted rows, ignoring the shadow. Rescued hens' offsets at the coop move out to about `[-1.6, 1.2], [0, 1.5], [1.6, 1.2]`, so they stand clear of the coop's 1-tile tap radius. Keep the current offsets while they follow or wait at the homestead.

- [ ] **Step 4: Wire it up.**
  - In `handleTap`, check `unnamedAnimalAt` first. If it gives a target, call `onAskName` and don't walk or show a marker.
  - In `perform`, call `onAskName` when `newlyStayed` gives an animal.
  - On pointer move, set the canvas cursor to `pointer` over an unnamed animal.
  - The dialog in `App.ts` copies the markup style of the pause dialog (`role="dialog"`), with a text box limited to 12 characters, a **Name** button and a **Not now** button. It pauses `GameScene` directly, not through the pause overlay, and resumes on close. Enter confirms and Escape dismisses. Errors from `nameBlocker` show in the dialog.
  - `setTyping(true)` disables the scene's keyboard input and its key capture (`input.keyboard.enabled = false` and `disableGlobalCapture()`). `setTyping(false)` restores both. `wirePause`'s document listener must ignore keys while the dialog is open.

- [ ] **Step 5: Add to the README** a short "Names" part under "Friends at camp": a friend asks for a name when it stays, sheep and hens can be tapped for one, and names can't be changed. Don't mention the rabbit.

- [ ] **Step 6: Run everything.** `npm run lint && npx tsc --noEmit && npm test -- --run --coverage && npm run build`. Expected: all pass, with new code at 80% or more.

- [ ] **Step 7: Check it in a browser** at desktop and phone size, from crafted saves:
  - Make a friend through the real offering and name it, typing a name containing W, A, S, D, E, P and a space. Every letter appears, and the survivor stays still.
  - Dismiss a prompt, then tap the friend to name it.
  - Name a sheep and a hen by tapping. Tap the coop with hens unnamed and get no dialog.
  - Name something `<b>x</b>` and see it literally in the note, journal, panels and ending.
  - On a phone viewport, the text box stays visible.
  - Reload, and the names and lines are still there.

- [ ] **Step 8: Commit** `Ask for a name when a friend stays or a sheep is tapped`.

- [ ] **Step 9: Finish:** rebase on `main`, take the next unused save version, then run the final review and open a PR.
