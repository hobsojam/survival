# Seasons PR 1: Calendar, Looks and Day Length — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The year turns through four 10-day seasons that show in the day pill, the journal and the colours of the world. Night begins earlier in winter and later in summer. Fireflies come out only in summer, and leaves fall in autumn.

**Architecture:**
- A new pure module, `src/game/calendar.ts`, derives the season, night start and afternoon start from `day` alone, so nothing is saved.
- `BALANCE.nightStart` and `BALANCE.afternoonStart` are removed, so the compiler finds every reader. Each reader calls `nightStart(day)` instead.
- Seasonal colour is a palette swap. Every sprite texture is repainted in place with the season's palette when the season changes, and the terrain is redrawn.

**Tech Stack:** TypeScript, Phaser 4, Vite, Vitest, oxlint.

**Spec:** `docs/superpowers/specs/2026-10-26-seasons-design.md`. This plan covers the spec's build step 1 only. Winter, spring and summer rules get their own plans after this PR lands.

## Global Constraints

- **Season length:** 10 days, so the year is 40 days.
  - `season(day)` = `['autumn', 'winter', 'spring', 'summer'][Math.floor((day - 1) / 10) % 4]`.
  - Day 1 is autumn. Day 41 is autumn again, and the day number keeps counting up.
- **The day stays 240 s.**
  - `nightStart(day) = Math.round(160 + 30 * Math.cos(2 * Math.PI * (day - 36) / 40))`.
  - Pinned values: day 1 → 181, day 6 → 160, day 11 → 139, day 16 → 130, day 36 → 190.
- **Afternoon** starts at `Math.round(nightStart(day) * 0.6875)` (110 when night starts at 160). This is a planner's ruling: it keeps the afternoon in proportion to the daylight.
- **Dusk** is the 30 s before `nightStart(day)`. Dawn is unchanged (the first 25 s of days after day 1).
- **No save change:** `SAVE_VERSION` stays **12**.
- **The only rule change is the length of the night.** Cold-front, fire-burn and warmth numbers are unchanged.
- **Fireflies:** summer nights only.
- **Falling leaves:** autumn daytime only, at camp only.
- **Season-change messages** (exact copy, shown on the first morning of a season):
  - Autumn: "The leaves are turning gold. Autumn has come."
  - Winter: "Snow fell in the night. Winter has come."
  - Spring: "The snow is melting. Spring has come."
  - Summer: "The days are long and warm. Summer has come."
- **Accessibility:** phone buttons are at least 44 px tall, text meets WCAG AA (4.5:1), and pixel art follows `docs/superpowers/specs/2026-10-21-pixel-art-direction.md`.
- **Checks:** `npm run lint`, `npm test -- --run` and `npm run build` all pass. SonarCloud needs 80% coverage of new code, so keep DOM wiring in small, tested pure helpers, with one-line calls from `App.ts` and `GameScene.ts`.

## Review Focus

- **The year wraps:** day 40 → 41 is summer → autumn, shows the autumn message, and the wheel's hand returns to the start. Tests in Tasks 1 and 3.
- **A save loaded mid-evening:** a day-16 save at `timeOfDay` 135 is already night everywhere: phase, lighting, sound, prompts and sleep. Test in Task 2.
- **Cold front on a shifted night:** on day 3, night starts at 174. `isColdNight` is false at 170 and true at 175, and the fire needed for the forecast is `(240 - 174) * 2 = 132`. Test in Task 2.
- **Season changes while in the quarry:** the shown-terrain key includes the season, so returning to camp after a season change redraws it. Test in Task 4.
- **Sleeping across a season boundary:** sleeping on day 10 wakes on day 11 to the winter message, with the night start for day 11. Test in Task 2.

---

### Task 1: The calendar module

**Files:**
- Create: `src/game/calendar.ts`, `tests/calendar.test.ts`

**Interfaces:**
- Produces:
  - `type Season = 'autumn' | 'winter' | 'spring' | 'summer'`
  - `SEASON_LENGTH = 10`, `YEAR_LENGTH = 40`
  - `season(day: number): Season`
  - `seasonName(s: Season): string`, which gives "Autumn" and so on
  - `daysLeftInSeason(day: number): number`, which gives 10 on day 1 and 1 on day 10
  - `nightStart(day: number): number`
  - `afternoonStart(day: number): number`
  - `seasonMessage(beforeDay: number, afterDay: number): string | null`
  - `firefliesOut(day: number): boolean`, true in summer only
  - `leavesFalling(day: number): boolean`, true in autumn only

- [ ] **Step 1: Write the failing tests** in `tests/calendar.test.ts`:
  - `season`: `[1, 10, 11, 20, 21, 30, 31, 40, 41, 81]` → `autumn, autumn, winter, winter, spring, spring, summer, summer, autumn, autumn`.
  - `daysLeftInSeason`: `1 → 10`, `10 → 1`, `11 → 10`, `45 → 6`.
  - `nightStart`: `1 → 181`, `6 → 160`, `11 → 139`, `16 → 130`, `26 → 160`, `36 → 190`, `76 → 190`.
  - Every day 1–40 is between 130 and 190, and neighbouring days differ by at most 5.
  - `afternoonStart(6) === 110`. For every day, `afternoonStart(day) < nightStart(day)`.
  - `seasonMessage`:
    - `(10, 11)` → the winter copy, and `(40, 41)` → the autumn copy.
    - `(4, 5)` → `null`, and `(11, 11)` → `null`.
    - `(9, 11)` → the winter copy, for a jump across the boundary.
  - `firefliesOut`: `31` and `40` → true; `1`, `11` and `21` → false.
  - `leavesFalling`: `1` → true; `11` and `31` → false.
- [ ] **Step 2: Run** `npx vitest --run tests/calendar.test.ts`. Expected: FAIL, because the module isn't found.
- [ ] **Step 3: Implement** `src/game/calendar.ts` with the interfaces above and the Global Constraints formulas. It must not import from `rules.ts`.
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** with the message `Add the seasonal calendar: seasons, day length and season messages`.

### Task 2: Night starts by the calendar

**Files:**
- Modify:
  - `src/game/state.ts`: remove `nightStart` and `afternoonStart` from `BALANCE`.
  - `src/game/clock.ts`
  - `src/game/rules.ts`, `src/game/forecast.ts`, `src/game/soundscape.ts`
  - `src/scene/ambient.ts`, `src/scene/lighting.ts`, `src/scene/visuals.ts`, `src/scene/prompts.ts`
  - `src/ui/panels.ts`, `src/ui/App.ts`
- Test:
  - `tests/clock.test.ts`, `tests/ambient.test.ts`, `tests/lighting.test.ts`, `tests/rules.test.ts`, `tests/forecast.test.ts`
  - Plus every other test file that used `BALANCE.nightStart`: panels, hud, prompts, needs and soundscape.

**Interfaces:**
- Consumes: `nightStart`, `afternoonStart` and `seasonMessage` from Task 1.
- Produces:
  - `dayPhase(timeOfDay: number, day: number): DayPhase`
  - `nextChange(timeOfDay: number, day: number)`
  - `foxWindow(day: number): { arrive: number; leave: number }` in `ambient.ts`. `FOX` loses `arrive` and `leave`, and `foxWindow` returns `nightStart(day) - 20` and `nightStart(day) + 50`.
  - `darkness(day, timeOfDay)` keeps its signature but uses `nightStart(day)`.

- [ ] **Step 1: Write the failing tests:**
  - **clock:**
    - `dayPhase(135, 16)` → `'Night'`.
    - `dayPhase(135, 36)` → `'Afternoon'`.
    - `dayPhase(100, 36)` → `'Morning'`, because the afternoon starts at 131.
    - `nextChange(0, 36)` → `{ event: 'Night', seconds: 190 }`.
    - `nextChange(130, 16)` → `{ event: 'Dawn', seconds: 110 }`.
  - **ambient:**
    - `darkness(16, 145)` → `0.5`.
    - `darkness(36, 145)` → `0`.
    - `foxWindow(16)` → `{ arrive: 110, leave: 180 }`.
    - `foxAt` for a visiting day 16 at 115 is not null, and at 190 it is null.
  - **lighting:**
    - Day 16 at 135: the tint is the night colour.
    - Day 36 at 165: alpha is `0.12 * (165 - 160) / 30`, which is dusk. Night starts at 190, so dusk starts at 160.
  - **rules:**
    - On day 16 at 131, sleeping isn't blocked by `'You can sleep once night falls…'`; on day 36 at 160 it is.
    - On day 3 with the cold front due, `isColdNight` is false at 170 and true at 175.
    - Sleeping from day 10 at 150 (night, since `nightStart(10)` is 142) wakes on day 11 at `timeOfDay` 0, and `seasonMessage(10, 11)` is the winter copy.
    - A day-16 state at 135 from `loadGame` reads as night through `dayPhase`.
  - **forecast:** a fresh game on day 3 before nightfall needs `132` seconds of fire for the night.
- [ ] **Step 2: Run** `npx vitest --run tests/clock.test.ts tests/ambient.test.ts tests/lighting.test.ts tests/rules.test.ts tests/forecast.test.ts`. Expected: FAIL. The first failure is on the new `dayPhase` arity or `foxWindow`.
- [ ] **Step 3: Implement.**
  - Delete the two `BALANCE` fields, then run `npx tsc --noEmit` and replace each reported use with `nightStart(state.day)`. Use `afternoonStart(day)` in the clock.
  - In existing tests, replace `BALANCE.nightStart` with `nightStart(<that test's day>)`. Most tests are on day 1, which is now 181, not 160. Keep each test's intent, so "a little after nightfall" becomes `nightStart(day) + 10`.
  - **App:** `renderClock` passes `this.state.day` to `dayPhase` and `nextChange`. It also sets `.day-dial-night`'s `style.left` to `nightStart(day) / BALANCE.daySeconds * 100` percent on every render; remove the inline style from the markup.
  - **GameScene:** in `reportWeather`, the message becomes the weather message and `seasonMessage(before.day, after.day)` joined with a space, leaving out any that are null.
- [ ] **Step 4: Run** `npm test -- --run && npx tsc --noEmit && npm run lint`. Expected: all pass, with no reference to `BALANCE.nightStart` left (`grep -rn "BALANCE.nightStart\|afternoonStart:" src tests` prints nothing).
- [ ] **Step 5: Commit** with the message `Let night fall earlier in winter and later in summer`.

### Task 3: The season in the day pill and the journal

**Files:**
- Create: `src/ui/calendarView.ts`, `tests/calendarView.test.ts`
- Modify: `src/ui/App.ts` (markup, `renderClock`, `renderJournal`), `src/style.css`

**Interfaces:**
- Consumes: `season`, `seasonName`, `daysLeftInSeason`, `nightStart` and `YEAR_LENGTH`, plus `dayPhase` and `nextChange` from Task 2.
- Produces:
  - `dayPillView(state: GameState): { season: string; day: string; phase: DayPhase; countdown: string; night: boolean; handPercent: number; nightPercent: number }`. Example: `{ season: 'Winter', day: 'Day 14', phase: 'Morning', countdown: 'Night in 2:11', night: false, … }`.
  - `yearWheelView(day: number, timeOfDay: number): { label: string; angle: number; seasons: { name: string; current: boolean }[] }`.
    - The label reads `'Winter · 7 days left'`, or `'Winter · last day'` when one day is left.
    - `angle` is `((day - 1) % 40 + timeOfDay / 240) / 40 * 360`.

- [ ] **Step 1: Write the failing tests:**
  - **`dayPillView`:**
    - Day 14 at 0 → season `'Winter'`, day `'Day 14'`, phase `'Morning'`.
    - `nightPercent` is `nightStart(14) / 240 * 100`.
    - Day 16 at 135 → `night` is true and the countdown starts with `'Dawn in'`.
  - **`yearWheelView`:**
    - Day 1 at 0 → angle `0`, and the label is `'Autumn · 10 days left'`.
    - Day 20 → `'Winter · last day'`.
    - Day 41 at 0 → angle `0`, so the wheel wraps.
    - Day 31 → `seasons` lists Autumn, Winter, Spring and Summer in that order, with only Summer current.
- [ ] **Step 2: Run** `npx vitest --run tests/calendarView.test.ts`. Expected: FAIL, because the module isn't found.
- [ ] **Step 3: Implement.**
  - **`calendarView.ts`:** the two functions above.
  - **Day pill markup:** `#day-label` holds `<span id="day-season"></span> · <span id="day-number"></span><span class="day-phase-part"> · <span id="day-phase"></span></span>`. `renderClock` fills those spans from `dayPillView` and sets the hand and night marker from its percents.
  - **Journal:** add a `.year-wheel` block before the map `<details>`. It's a 44 px circle with a four-quarter `conic-gradient`, starting at the top and running clockwise: autumn `#d98a3e`, winter `#c9d6e0`, spring `#8cc06a`, summer `#e6c25a`. A hand is rotated by `angle`, `#year-label` shows the label, and a visually hidden list names the seasons, with the current one marked `aria-current="true"`.
  - **CSS:** in the existing `@media (max-width: 439px) and (orientation: portrait)` block, add `.day-phase-part { display: none; }`. Text colours must meet 4.5:1 on the pill and the journal backgrounds.
- [ ] **Step 4: Run** `npm test -- --run && npm run lint`. Expected: PASS.
- [ ] **Step 5: Check in the browser:**
  - Inject a day-14 save and screenshot at 1280×800 and 390×844 with Playwright. Use the swiftshader flags and device scale 2.
  - Expected: "Winter · Day 14 · Morning" on desktop, "Winter · Day 14" on the phone, and the wheel hand in the winter quarter.
- [ ] **Step 6: Commit** with the message `Show the season in the day pill and a year wheel in the journal`.

### Task 4: Seasonal colours

**Files:**
- Create: `src/art/seasonPalette.ts`, `tests/seasonPalette.test.ts`
- Modify:
  - `src/art/palette.ts`: add `crown0`–`crown4`, equal to `leaf0`–`leaf4`.
  - `src/art/terrain.ts`: broadleaf and young trees use the `crown*` keys; pine keeps `leaf*`.
  - `src/art/textures.ts`, `src/scene/map.ts`, `src/scene/GameScene.ts`
- Test: `tests/art.test.ts`, `tests/map.test.ts`

**Interfaces:**
- Consumes: `season` and `Season` from Task 1.
- Produces:
  - `seasonPalette(s: Season): Record<PaletteKey, string>`: the full palette with that season's overrides.
  - `rasterizeFrame(def, frame, colors = palette)`.
  - `registerSpriteTextures(scene, colors = palette)`: creates any missing textures, and repaints existing canvas textures in place with `colors`.
  - `shownTerrainKey(state: GameState): string`, in `map.ts`, which gives `` `${terrainKey(state)}-${season(state.day)}` ``.

Season overrides (summer is the base palette, unchanged):

| Season | `grass0`–`grass4` | `crown0`–`crown4` | `leaf0`–`leaf4` |
|---|---|---|---|
| Autumn | `#3f4a2c #5a6b35 #7d8a40 #a3a24c #c9b862` | `#4a1e14 #8a3418 #c25a24 #e88a3e #f2c25a` | base |
| Winter | `#8a98a8 #b4c2cc #d4e0e6 #e6eef0 #f6fafa` | `#2e2420 #4a3a32 #6b5a4c #8a7a6a #b0a494` | `#142826 #1c3a32 #2a5040 #3e6a50 #c8dce0` |
| Spring | `#33603a #457a42 #64a04a #86bc52 #b4d866` | `#1f4a3a #2f6b44 #5a9a4c #86c05a #b8e07a` | base |

- [ ] **Step 1: Write the failing tests:**
  - **Palette:**
    - `seasonPalette('summer')` equals `palette`.
    - `seasonPalette('autumn').crown2 === '#c25a24'`, and `.leaf2` is the base value.
    - `seasonPalette('winter').grass2 === '#d4e0e6'`.
    - Every season returns every `PaletteKey`.
  - **Rasterizing:** `rasterizeFrame(sprites.treeBroadleaf, 'still', seasonPalette('autumn'))` contains the RGB of `#c25a24`. `treePine` under autumn contains no `crown` colours.
  - **Map:** `shownTerrainKey` for a day-1 camp state is `'camp-autumn'`. For a day-11 quarry state it's `'quarry-winter'`.
- [ ] **Step 2: Run** `npx vitest --run tests/seasonPalette.test.ts tests/art.test.ts tests/map.test.ts`. Expected: FAIL, because `seasonPalette` isn't found.
- [ ] **Step 3: Implement.**
  - **`registerSpriteTextures`:** for an existing key, get the texture as a `Phaser.Textures.CanvasTexture`, `putImageData` the new pixels and call `refresh()`.
  - **GameScene:**
    - Track `seasonShown`. When `season(state.day)` changes, call `registerSpriteTextures(this, seasonPalette(next))` before redrawing the terrain. In `create`, register with the current season's palette.
    - Compare `shownTerrainKey(state)` against the shown key to decide on a redraw. The terrain texture is named `` `terrain-${shownTerrainKey(state)}` ``, and the old one is removed as now.
- [ ] **Step 4: Run** `npm test -- --run && npm run build`. Expected: PASS.
- [ ] **Step 5: Check in the browser:**
  - Screenshot camp saves on days 1, 11, 21 and 31.
  - Expected: golden grass and orange broadleaf crowns; snow-pale ground with green-black pines; fresh greens; today's look.
  - Check that the berry bushes, survivor and buildings still read clearly on winter ground. If one doesn't, record the problem as a ruling and adjust only that override's lightest shades.
- [ ] **Step 6: Commit** with the message `Recolour the world for each season`.

### Task 5: Summer fireflies, autumn leaves and the README

**Files:**
- Modify:
  - `src/art/wildlifeSprites.ts`: add `leaf`, a 3×3 sprite with frames `fall0` and `fall1` using `crown2`, `crown3` and `crown4`.
  - `src/scene/ambient.ts`, `src/scene/ambientLife.ts`, `src/scene/SceneLighting.ts`
  - `README.md`
- Test: `tests/ambient.test.ts`, `tests/ambientLife.test.ts`, `tests/wildlifeFrames.test.ts`

**Interfaces:**
- Consumes: `firefliesOut` and `leavesFalling` from Task 1, and `darkness`.
- Produces:
  - `LEAF_HOMES: Point[]`: 6 points, each within 2 tiles of a broadleaf tree in the camp map.
  - `leafAt(index: number, timeMs: number): { x: number; y: number; alpha: number; frame: 'leaf:fall0' | 'leaf:fall1' } | null`.
    - Each leaf falls for 4 s out of every 9 s (index offset `index * 1.5`).
    - It drops 2 tiles and drifts ±0.6 tiles side to side.
    - It fades in and out over 0.5 s at each end, and returns null outside its 4 s.

- [ ] **Step 1: Write the failing tests:**
  - **`leafAt`:** `leafAt(0, 1000)` isn't null and has `alpha` > 0. `leafAt(0, 6000)` is null. Over one 9 s cycle, the y position only increases.
  - **ambientLife**, using the existing fake scene and `of(kind)` helpers:
    - Day 31 at night: fireflies are visible. Day 1 at night: none are.
    - Day 1 at noon at camp: some `leaf` sprites are visible. Day 11 at noon: none are.
    - In the quarry: no leaves.
  - **wildlifeFrames:** `leaf` validates.
- [ ] **Step 2: Run** `npx vitest --run tests/ambient.test.ts tests/ambientLife.test.ts tests/wildlifeFrames.test.ts`. Expected: FAIL, because `leafAt` and the `leaf` sprite aren't found.
- [ ] **Step 3: Implement.**
  - **ambientLife:**
    - `AmbientLife` creates one `leaf` image per `LEAF_HOMES` entry.
    - Fireflies get `firefliesOut(state.day) ? dark : 0` in place of `dark`.
    - Leaves show only when `leavesFalling(state.day)`, at camp, with `dark < 0.3`. They're hidden everywhere else.
  - **SceneLighting:** the firefly light uses the same `firefliesOut` gate.
  - **README:** describe the 40-day year starting in autumn, the changing day length (night from about 2:10 in midwinter to 3:10 in midsummer), the season label and the wheel. Say that winter, spring and summer rules arrive in later updates.
- [ ] **Step 4: Run** `npm test -- --run && npm run lint && npm run build`. Expected: all pass.
- [ ] **Step 5: Check in the browser:**
  - A day-1 noon screenshot shows a few falling leaves near the broadleaf trees.
  - A day-31 night screenshot shows fireflies.
  - A day-1 night screenshot shows none.
- [ ] **Step 6: Commit** with the message `Fireflies in summer, falling leaves in autumn, and the README`.

### Finish

- [ ] **Open the PR.**
  - Push the branch `agent/seasons-calendar` and open a PR against `main`.
  - The body explains that this is step 1 of the seasons spec, and lists the rulings: the afternoon proportion, and any palette adjustments.
- [ ] **Check SonarCloud.** Once its analysis is done, query it. If new-code coverage is under 80%, move logic out of `App.ts` and `GameScene.ts` into tested helpers.
