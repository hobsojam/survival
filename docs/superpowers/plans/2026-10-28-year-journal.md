# Year Journal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a year journal: a keepsake in which the survivor writes small seasonal moments as they happen, with fresh pages each year. Also tidy the Camp tab so nothing overlaps.

**Architecture:** A pure module, `src/game/journalEntries.ts`, holds the 20 entries and their detection rules. `recordJournal(before, after, action?)` compares two states, plus the action that caused the change, and returns the state with any new entries and the messages to show. `GameScene` calls it after each frame tick and each action. Entries live in `GameState.journal`, which bumps the save to version 14. A pure view, `src/ui/yearJournal.ts`, turns the state plus a page index into a page, and `App` renders it in a new Camp-tab panel.

**Tech Stack:** TypeScript, Phaser 4, Vite, Vitest (node, no DOM), oxlint.

**Spec:** `docs/superpowers/specs/2026-10-28-year-journal-design.md`

## Global Constraints

- **A record, not a checklist:** no percentages, progress bars, counters, ticks or completion sounds. The only hint that more exists is one blank line with a "?" for each entry not yet found that season.
- **No game effect:** the journal never changes meters, inventory, structures or progress.
- **Year:** `floor((day − 1) / 40) + 1`. Day 41 starts year two. Page title: `"<Season>, year <words>"`, for example "Autumn, year one". The days line reads `"Days <first>–<last>"`, using that year's real day numbers (year two autumn is "Days 41–50").
- **Five entries per season.** Each entry is written at most once per season page. Its recorded day is the first day it happened that year. An entry is written only in its own season.
- **Message:** `"Written in your journal: <line>"`. The first-snow and first-rain entries never add this line, because the season and rain messages already announce them.
- **Save version 14:** older saves are rejected. The journal stays small: at most 20 entries a year, stored as `{ year, id, day, variant }`.
- **Shared definitions:**
  - "At camp" means `isAtCamp`.
  - "Night" means `timeOfDay ≥ nightStart(day)`.
  - "Dusk" is the `duskLength(day)` seconds before `nightStart` (30, or 45 in summer, matching the lighting).
  - "Awake" means the action is not `sleep`.
- **Code layout:** logic lives in pure, tested modules. `GameScene` and `App` get thin calls only.
- **Tidying the Camp tab:**
  - Remove the "Places found" line from Beyond camp.
  - Show the forecast card only while a forecast cold front is pending or under way, or in winter.
  - Move the year wheel into the year journal panel.
  - Hide the milestones once the lookout is restored.
- **README:** a short section describing the journal, without listing its entries.
- **Checks:** `npm run lint`, `npx tsc --noEmit -p .`, `npm test -- --run` and `npm run build` all pass. Check in the browser at 1280×800 and 390×844.

## Review Focus

1. **Sleeping through moments.** "Awake" entries are not written during a sleep. Dawn entries (cold front, first snow, wolf tracks, the winter fire and the regrowing stump) are, because the spec says the cold front is written "including when the player sleeps through it". Test: sleeping across the end of a cold front writes `coldFront`; sleeping through a summer night writes `warmSleep` but not `fireflies`.
2. **A timed action that crosses a moment.** A gather that crosses nightfall at camp on a summer day writes `goldEvening`. Test it in Task 1.
3. **The year boundary.** Sleeping on the night of day 40 writes `warmSleep` to year 1's summer page (day 40). Then year 2 starts with an empty autumn page. Test it in Task 1.
4. **Corrupt or very long saves.** A duplicate `{year, id}`, an unknown id, a day in the wrong season or year, or a day after today is rejected. A day-400 save with ten years of entries loads. Test these in Task 1's save tests.
5. **Leafing at the edges.** "Previous" is disabled on autumn of year one. "Next" is disabled on the current season. A past page with no entries shows five blanks. Test these in Task 2.

---

### Task 1: Journal entries, detection and save

**Files:**
- Create: `src/game/journalEntries.ts`, `tests/journalEntries.test.ts`
- Modify:
  - `src/game/calendar.ts` (add `yearOf` and `duskLength`)
  - `src/scene/lighting.ts` (use `duskLength`)
  - `src/game/state.ts` (add `journal` and `RABBIT_HOMES`)
  - `src/scene/ambient.ts` (re-export `RABBIT_HOMES` from state)
  - `src/game/save.ts` (version 14 and `validJournal`)
- Test: `tests/calendar.test.ts`, `tests/save.test.ts`

**Interfaces:**
- Produces:
  - `yearOf(day: number): number` and `duskLength(day: number): number` (45 in summer, otherwise 30) in `calendar.ts`.
  - `RABBIT_HOMES: { x: number; y: number }[]` moves into `state.ts` with the same three points. `ambient.ts` re-exports it, so the scene code doesn't change.
  - `GameState.journal: JournalEntry[]`, empty in `createGame()`.
  - In `journalEntries.ts`:
    - `type JournalId = 'leaves' | 'fox' | 'coldFront' | 'driedBerries' | 'stars' | 'firstSnow' | 'wolfTracks' | 'frozenSpring' | 'winterFire' | 'winterCooking' | 'firstRain' | 'rabbits' | 'bushesFull' | 'stumpGrowing' | 'springRest' | 'fireflies' | 'twoHandfuls' | 'goldEvening' | 'warmSleep' | 'lookoutEvening'`
    - `interface JournalEntry { year: number; id: JournalId; day: number; variant: number }`
    - `JOURNAL_PAGES: Record<Season, readonly { id: JournalId; icon: string; lines: readonly string[] }[]>`, with five entries per season in the order of the spec's table. `lines[variant]` is the line shown. Only `coldFront` has two lines: `["The cold front came. I kept the fire through it.", "The cold front came, and the fire didn't last."]`.
    - `recordJournal(before: GameState, after: GameState, action?: GameAction): { state: GameState; messages: string[] }`. It returns `after` itself, not a copy, when nothing new is written.
- Detection, worked out from `before`, `after` and `action`. "Done" means `after !== before` (a refused action returns the same object). "Dawn" means `after.day > before.day`. Each rule names the day the entry belongs to.

  | id | Belongs to | Condition |
  |---|---|---|
  | leaves | after.day | awake, at camp in `after`, daylight |
  | fox | after.day | awake, at camp, `after.timeOfDay` in dusk |
  | coldFront | before.day | `isColdNight(before) && !isColdNight(after)`. The variant is 0 if `after.progress.hearthUnlocked`, else 1 |
  | driedBerries | before.day | `prepareTrailFood` done |
  | stars | before.day | `stargaze` done |
  | firstSnow | after.day | `seasonMessage(before.day, after.day)` is not null and `after.day` is winter. Silent |
  | wolfTracks | `after.lastWolf.day` | `wolfMessage(before, after)` is not null |
  | frozenSpring | before.day | `visitSite` on the spring, done |
  | winterFire | before.day | dawn, `isAtCamp(before)`, and `before.lastWolf?.day !== before.day`. A wolf comes the moment a winter night's fire goes out, so no wolf means the fire lasted |
  | winterCooking | before.day | `cook` done |
  | firstRain | after.day | `rainMessage(before, after)` is not null. Silent |
  | rabbits | after.day | awake, `after.area === 'camp'`, daylight, within 4 tiles of a `RABBIT_HOMES` point |
  | bushesFull | before.day | `gather` on a berry node, done |
  | stumpGrowing | after.day | dawn, and some tree has `readyDay === after.day` and `readyDay > 1` |
  | springRest | before.day | `visitSite` on the spring, done |
  | fireflies | after.day | awake, at camp, night |
  | twoHandfuls | before.day | `after.inventory.food − before.inventory.food === 2` |
  | goldEvening | after.day | awake, at camp, and `before.timeOfDay < nightStart ≤ after.timeOfDay` on the same day |
  | warmSleep | before.day | `sleep` done, and `after.fireFuel === 0` |
  | lookoutEvening | after.day | awake, `after.progress.lookoutRepaired`, within 2 tiles of `LOOKOUT`, and `after.timeOfDay` in dusk |

  Each rule is checked only when `season(belongs-to day)` matches the entry's season, and only if `{yearOf(day), id}` isn't already in the journal.

- [ ] **Step 1: Write the failing tests** (`tests/journalEntries.test.ts`, plus additions to the calendar and save tests). Use `createGame()` states, as in `tests/rules.test.ts`.
  - **`calendar.test.ts`:**
    - `yearOf` gives 1, 1, 2, 3 for days 1, 40, 41, 81;
    - `duskLength` is 45 on day 34 and 30 on day 4.
  - **`'writes the first leaves of autumn once, with the day'`:**
    - day 1, ticked 1 s at camp: the journal is `[{ year: 1, id: 'leaves', day: 1, variant: 0 }]`;
    - the messages are `['Written in your journal: The first leaves came down over camp.']`;
    - ticking again writes nothing and returns the same state object.
  - **`'keeps each season to its own page'`:** a successful `stargaze` on day 12 (winter) writes nothing.
  - **`'records how the cold front went, even asleep'`:**
    - sleeping in the shelter with the fire lit across day 3's front writes `coldFront` with variant 0 on day 3;
    - with the fire out, variant 1.
  - **`'stays silent for moments already announced'`:**
    - waking on day 11 writes `firstSnow` with no journal message;
    - a tick across day 22's shower start writes `firstRain` with no message.
  - **`'notices a whole winter night by the fire'`:** dawn of day 12 at camp with no wolf that night writes `winterFire`; with `lastWolf: { day: 12, took: 'nothing' }` it doesn't.
  - **`'writes summer evenings during a timed action'`:** a gather at camp that crosses `nightStart(34)` writes `goldEvening`.
  - **`'writes a warm summer sleep on the last night of the year'`:**
    - sleeping on day 40 with no fire writes `{ year: 1, id: 'warmSleep', day: 40 }`;
    - it does not write `fireflies`;
    - a tick on day 41 then writes year-2 `leaves`.
  - **`'finds the rabbits near their homes in spring daylight'`:** standing at `RABBIT_HOMES[0]` on day 21 at 60 s writes `rabbits`; 10 tiles away it doesn't.
  - **`'never changes the game'`:** after `recordJournal`, every field except `journal` equals `after`.
  - **`save.test.ts`:**
    - a v14 save round-trips with journal entries;
    - a v13 save is rejected;
    - each of these is rejected: a duplicate `{year, id}`, an unknown id, `coldFront` on day 15 (wrong season), `{ year: 2, day: 5 }` (wrong year), an entry day after `state.day`, and a `variant` other than 0 on a non-`coldFront` entry;
    - a day-400 save with 200 valid entries loads.

- [ ] **Step 2: Run them and watch them fail**
  Run: `npx vitest run tests/journalEntries.test.ts tests/calendar.test.ts tests/save.test.ts`
  Expected: FAIL on the missing module, functions and `journal` field.

- [ ] **Step 3: Implement**
  - Add `yearOf` and `duskLength` to `calendar.ts`, and use `duskLength` in `lightingTint`.
  - Move `RABBIT_HOMES` into `state.ts`.
  - Add `journal: []` to `createGame()`.
  - Write the `journalEntries.ts` rules from the table.
  - In `save.ts`, bump to version 14 and add `validJournal` to `validState`'s checks. Update its doc comment, and update any tests that build version 13 saves.
  - Entry lines and icons, one emoji each, in table order:
    - **Autumn:** 🍂 "The first leaves came down over camp." · 🦊 "A fox came by the bushes at dusk." · ❄️ coldFront (two lines above) · 🫐 "Dried berries for the winter." · ✨ "Lay back and counted stars."
    - **Winter:** 🌨️ "Snow fell in the night." · 🐾 "Paw prints round the fire this morning." · 🧊 "The quiet spring had frozen over." · 🔥 "Kept the fire alive through a whole winter night." · 🍲 "Cooked berries by the fire, with the snow coming down."
    - **Spring:** 🌧️ "The first rain of spring." · 🐇 "Rabbits in the meadow." · 🌿 "The bushes are full again." · 🌱 "A stump I cut is growing back already." · 💧 "Sat a while at the spring, now that it's thawed."
    - **Summer:** 🌟 "Fireflies over camp." · 🍓 "Two handfuls from one bush." · 🌇 "The evening went gold." · 🌙 "Slept out without a fire, and it was warm." · 🔭 "Watched the land from the lookout on a long evening."

- [ ] **Step 4: Run them and watch them pass, then run everything**
  Run: `npx vitest run tests/journalEntries.test.ts tests/calendar.test.ts tests/save.test.ts && npm test -- --run && npm run lint && npx tsc --noEmit -p .`
  Expected: all PASS.

- [ ] **Step 5: Commit** "Year journal entries, written as the seasons happen, in save version 14"

### Task 2: The journal panel, its pages and the scene hook

**Files:**
- Create: `src/ui/yearJournal.ts`, `tests/yearJournal.test.ts`
- Modify:
  - `src/scene/GameScene.ts` (call `recordJournal` after the tick and after `perform`)
  - `src/ui/App.ts` (new panel, page navigation, year wheel moved)
  - `src/style.css` or the project's stylesheet (page styling)

**Interfaces:**
- Consumes: `recordJournal`, `JOURNAL_PAGES`, `JournalEntry`, `yearOf`.
- Produces in `yearJournal.ts`:
  - `currentPage(day: number): number`, equal to `(yearOf(day) − 1) * 4 + seasonIndex(day)`.
  - `yearWords(year: number): string`, giving "one" to "twenty" and then the numeral.
  - `journalPageView(state: GameState, page: number): { title: string; days: string; entries: { icon: string; day: string; line: string }[]; blanks: number; hasPrevious: boolean; hasNext: boolean }`. Entries are in day order (ties in `JOURNAL_PAGES` order). `blanks` is 5 minus the entries. The page is clamped to `[0, currentPage(state.day)]`.
- **GameScene:**
  - In `update`, after `advanceTime`, `const written = recordJournal(beforeTick, this.state); this.state = written.state;`.
  - `reportWeather` gets `written.messages` appended after `newsBetween`.
  - In `perform`, do the same with `recordJournal(before, result.state, action)`.
- **App:** a `journalPage: number | null` field, where null means the current page. Previous and next buttons step it, and going past the current page returns to null.

- [ ] **Step 1: Write the failing tests** in `tests/yearJournal.test.ts`:
  - **`'titles pages by season and year'`:**
    - `journalPageView(state on day 45, currentPage(45))` has title "Autumn, year two" and days "Days 41–50";
    - `yearWords(21)` is "21".
  - **`'lists what was written, then a blank for each moment still to come'`:** two autumn entries (days 4 and 2) give entries in day order, day labels "Day 2" and "Day 4", and `blanks` 3.
  - **`'leafs back no further than the first page and no further forward than today'`:**
    - page 0 has `hasPrevious` false;
    - the current page has `hasNext` false;
    - page 99 on day 45 clamps to the current page.
  - **`'shows a quiet past season honestly'`:** year one's winter page viewed on day 45 has 0 entries and 5 blanks.
  - **`'shows the cold front line that matched the night'`:** a `coldFront` entry with variant 1 gives "The cold front came, and the fire didn't last."

- [ ] **Step 2: Run them and watch them fail**
  Run: `npx vitest run tests/yearJournal.test.ts`
  Expected: FAIL on the missing module.

- [ ] **Step 3: Implement**
  - Write `yearJournal.ts`, then the GameScene hook.
  - **App panel:** a new `<section class="panel year-journal-panel" data-tab="camp">`, placed right after the field journal. It has:
    - the eyebrow "THE YEAR SO FAR", with `<h2 id="year-journal-title">` and `<p id="year-journal-days">`;
    - the `year-wheel` markup, moved here from the field journal with the same ids, so `renderYearWheel` is unchanged;
    - `<ul id="year-journal-entries">`, with blank `<li class="blank">` rows showing "?" and a ruled line;
    - `‹` and `›` buttons with ids `year-journal-previous` and `year-journal-next`, and aria-labels "Earlier page" and "Later page".
  - The page renders in the same refresh as the field journal.
  - Styling follows the mockup: cream paper, a serif line, a small grey day label, and dashed rules between rows. It must work at 390 px wide.

- [ ] **Step 4: Run them and watch them pass, then run everything**
  Run: `npx vitest run tests/yearJournal.test.ts && npm test -- --run && npm run lint && npx tsc --noEmit -p .`
  Expected: all PASS.

- [ ] **Step 5: Commit** "The year journal panel, page by page"

### Task 3: Tidy the Camp tab, update the README and check in the browser

**Files:**
- Modify:
  - `src/ui/panels.ts` (add `forecastView(...).shown`, remove `sitesFound`)
  - `src/ui/journal.ts` (milestones empty after the lookout)
  - `src/ui/App.ts`
  - `README.md`
- Test: `tests/panels.test.ts`, `tests/journal.test.ts` (the existing field-journal tests)

**Interfaces:**
- Produces:
  - `ForecastView.shown: boolean`, true when `!state.progress.hearthUnlocked`, or `isColdNight(state)`, or `isWinter(state.day)`. `App` hides `#forecast-panel` when it's false (check that the `hidden` attribute wins over the panel's CSS `display`, and add `[hidden]{display:none}` if it doesn't).
  - `journalView(state).milestones` is `[]` once `lookoutRepaired` is true. `App` hides the "Camp milestones" subhead when the list is empty.
  - The Beyond camp panel loses the `#sites-seen` line, and `sitesFound` is deleted along with its test.

- [ ] **Step 1: Write the failing tests**
  - **`panels.test.ts`:** `forecastView` gives `shown` true on day 1 (front pending) and on day 14 after the front is weathered, and false on day 24 after it's weathered.
  - **`tests/journal.test.ts`:** milestones have length 4 before the lookout is repaired, and 0 after.

- [ ] **Step 2: Run them and watch them fail**
  Run: `npx vitest run tests/panels.test.ts tests/journal.test.ts`
  Expected: FAIL.

- [ ] **Step 3: Implement** the view changes, the App wiring and the markup removal.

- [ ] **Step 4: README.** Add a "### The year journal" section after the seasons sections. It should cover:
  - the Camp tab panel, with one page per season and fresh pages each year;
  - the survivor writing small moments as they happen, with blank lines for what's still to find;
  - "Written in your journal" messages;
  - leafing back through old pages;
  - no effect on the game.

  Don't list the entries. Also:
  - update the field journal paragraph: the year wheel now lives on the journal page, and the milestones hide once the lookout is restored;
  - add the year journal to the tests list;
  - update any text about the "Places found" line or the forecast card that no longer holds.

- [ ] **Step 5: Verify**
  Run: `npm test -- --run && npm run lint && npx tsc --noEmit -p . && npm run build`
  Expected: all pass.

  Then check in the browser at 1280×800 and 390×844 (the save fixture must use version 14 and `journal`):
  - the Camp tab on day 2 with a written entry shows the page with blanks;
  - leafing back works;
  - the forecast is hidden on a weathered spring day;
  - no "Places found" line;
  - the milestones are hidden after the lookout.

- [ ] **Step 6: Commit** "Tidy the Camp tab around the year journal"
