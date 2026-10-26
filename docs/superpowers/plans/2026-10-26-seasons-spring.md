# Seasons PR 3: Spring — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Spring (days 21–30, 61–70, …) brings rain showers that chill the unsheltered and hurry the fire, puddles and flowers, rabbits in the meadow, and trees that regrow in two days.

**Architecture:**
- **Rain:** it lives in a new pure module, `src/game/rain.ts`. Whether a day rains, and when, is derived from `day` with a fixed hash. Nothing is saved, so there's no save change. `advanceTime` reads `isRaining` for warmth and fire burn.
- **Looks and sound:** rain streaks, puddles and a grey tint come from small pure helpers in the existing scene modules. Rabbits follow the birds' pattern: pure timing helpers in `ambient.ts` and a little state in `AmbientLife`.

**Tech Stack:** TypeScript, Phaser 4, Vite, Vitest (node environment, no DOM), oxlint `--deny-warnings`.

**Spec:** `docs/superpowers/specs/2026-10-26-seasons-design.md`, build step 3 ("Spring"). Winter (#74) is merged.

## Global Constraints

- **When spring is:** spring is `season(day) === 'spring'`. Add `export const isSpring = (day: number): boolean => season(day) === 'spring';` to `src/game/calendar.ts`.
- **Rain schedule** (planner's call; the spec says "roughly 1 day in 3, for part of the day"):
  - `hash(n) = frac(sin(n × 78.233) × 43758.5453)`.
  - A spring day rains when `hash(day) < 1/3`.
  - Rain starts at `20 + floor(hash(day + 101) × 60)` s and lasts `40 + floor(hash(day + 211) × 20)` s. It always ends by 138 s, before the earliest spring nightfall (139 s on day 21).
  - Pinned values: in the first spring, day 22 rains 30–76 s, day 25 rains 63–119 s, and day 30 rains 27–68 s. No other day of 21–30 rains.
- **While it rains:**
  - **Warmth:** away from camp, or at camp without the shelter, warmth changes as on an ordinary (not freezing) night: −0.5/s, or +0.5/s at camp beside a lit fire, and halved by the windbreak at an unlit camp. In the shelter at camp, warmth recovers as on any day.
  - **Fire:** it burns at `BALANCE.rainFireBurn` = 1.5× wherever the survivor is.
- **Copy:** the rain-start message is exactly "Rain is coming in."
- **Trees:** they regrow in `BALANCE.springTreeRegrowDays` = 2 days when chopped in spring, and 3 otherwise. The axe panel copy follows: "Stumps regrow after two dawns." in spring.
- **Rabbits:** two or three, near the meadow and bushes, by day in spring at camp. They hop and nibble, and flee from the survivor like birds.
- **Save:** no change. `SAVE_VERSION` stays 13.
- **Checks:**
  - `npm run lint`, `npm test -- --run` and `npm run build` all pass.
  - SonarCloud needs 80% coverage of new code, so keep `GameScene.ts` and `App.ts` changes to one-line calls.

## Review Focus

1. **Rain and sleep:** rain never falls at night, so sleep can't skip it, and a rain window can't straddle nightfall in any spring of the first three years. Task 1 test `ends every shower before nightfall`.
2. **Rain while in the quarry:** it chills and the camp fire burns faster, wherever the survivor is. Task 1 test `chills the survivor away from camp and hurries the fire`.
3. **Stumps chopped on day 30:** they regrow on day 32 (in summer). The rate depends on the season when the tree was chopped, and a save stays valid. Task 3 test `regrows trees in two days when chopped in spring`.
4. **The rain message fires once per shower,** not every frame. Task 1 test `announces the rain once`.
5. **Rabbits flee and come back,** and never show in other seasons or at night. Task 4 tests.

---

### Task 1: Rain rules

**Files:**
- Create: `src/game/rain.ts`.
- Modify: `src/game/calendar.ts` (`isSpring`), `src/game/state.ts` (`BALANCE.rainFireBurn: 1.5`), `src/game/rules.ts` (`advanceTime`, `warmthChange`), `src/scene/GameScene.ts` (one `rainMessage` argument in `reportWeather`'s `say`).
- Test: `tests/rain.test.ts` (new), `tests/calendar.test.ts`.

**Interfaces:**
- Produces:
  - `rainWindow(day: number): { start: number; end: number } | null`.
  - `isRaining(state: Pick<GameState, 'day' | 'timeOfDay'>): boolean`, which is true when `start <= timeOfDay < end`.
  - `rainMessage(before: GameState, after: GameState): string | null`.

- [ ] **Step 1: Write the failing tests** (`tests/rain.test.ts`)
  - `rainWindow`: the pinned first-spring windows exactly. Null for every other day of 21–30, for days 1–20 and 31–40, and for days 2, 12 and 35. Across days 21–30 of years 1–50, between 25% and 45% of days rain.
  - `ends every shower before nightfall`: for every spring day in years 1–3, `end <= nightStart(day)`.
  - `isRaining`: day 22 is false at 29.9 s, true at 30 s and 75.9 s, and false at 76 s.
  - `chills the survivor away from camp and hurries the fire`: day 22 at 40 s.
    - Survivor at (5, 25) with warmth 80 and fireFuel 30. After `advanceTime(…, 10)`, warmth ≈ 75 and fuel ≈ 15.
    - At camp in the shelter (`structures.shelter`), warmth stays 80 + 1 (day rate, capped at 100).
    - At camp unsheltered beside a lit fire, warmth rises by 5.
    - The same survivor on day 21 (dry) gains warmth.
  - `announces the rain once`: `rainMessage` gives 'Rain is coming in.' between day 22 at 29.5 s and 30.5 s. It gives null between 30.5 s and 31.5 s, and null between dry moments.
  - `calendar.test.ts`: `isSpring` maps 20, 21, 30, 31, 61 to false, true, true, false, true.

- [ ] **Step 2: Run them and watch them fail**

Run: `npm test -- --run tests/rain.test.ts tests/calendar.test.ts`
Expected: FAIL, because `src/game/rain.ts` doesn't exist.

- [ ] **Step 3: Implement**
  - **`advanceTime`:** fire burn ×`coldNightFireBurn` on a freezing night, else ×`rainFireBurn` while raining, else ×1.
  - **`warmthChange`:** the day branch (`timeOfDay < nightStart`) returns `step / 10` unless it is raining and the survivor isn't at camp in the shelter. In that case it falls through to the existing night formula (not freezing).
  - **`GameScene.reportWeather`:** add `rainMessage(before, after)` to `say`.

- [ ] **Step 4: Run the whole suite.** Run: `npm test -- --run`. Expected: PASS.

- [ ] **Step 5: Commit** "Rain showers on spring days".

---

### Task 2: Rain looks and sound

**Files:**
- Modify: `src/art/wildlifeSprites.ts` (`rainStreak` 3×6 in `frost`/`flower4`, and `puddle` 16×6 in `flower4` with an `earth1` rim and a `frost` glint).
- Modify: `src/scene/effectVisuals.ts`: rain streaks while raining.
- Modify: `src/scene/visuals.ts`: puddles at `PUDDLE_SPOTS` on a rainy day from the rain's start until the end of that day, at `GROUND_DECAL_DEPTH`, at camp only.
- Modify: `src/scene/lighting.ts`: while raining by day, `{ color: palette.storm, alpha: 0.18 }`.
- Modify: `src/game/soundscape.ts`: a seventh layer, `rain`, which is looping filtered noise.
- Test: `tests/effectVisuals.test.ts`, `tests/visuals.test.ts`, `tests/lighting.test.ts`, `tests/soundscape.test.ts`, `tests/wildlifeFrames.test.ts`.

**Interfaces:**
- Consumes: `isRaining` and `rainWindow` from Task 1.
- Produces:
  - `PUDDLE_SPOTS = [{ x: 15, y: 12 }, { x: 25, y: 19 }, { x: 11, y: 18 }, { x: 29, y: 9 }]` in `visuals.ts`.
  - `rainVisuals(timeMs)` in `effectVisuals.ts`, with 40 streaks of ids `weather:rain:i` and alpha 0.5, falling steeply with a slight lean.

- [ ] **Step 1: Write the failing tests**
  - **Streaks:** they appear on day 22 at 40 s and not at 80 s. No `weather:sleet` shows in rain.
  - **Puddles:** `puddle:still` decals show at camp on day 22 at 40 s and at 200 s, but not at 20 s, not on day 21, and not in the quarry.
  - **Tint:** `lightingTint` on day 22 at 40 s is the storm colour at 0.18.
  - **Rain layer:** the soundscape's `rain: () => layer(6)` is above 0 on day 22 at 40 s (also in the quarry) and 0 at 80 s.
  - **Sprites:** both new sprites pass `validateSprite`.

- [ ] **Step 2: Run them and watch them fail.**

- [ ] **Step 3: Implement**
  - **Rain sound:** the rain layer is a `BufferSource` playing `this.noise` with `loop = true` through a bandpass (about 1200 Hz, Q 0.7), started once in `createAudioGraph`, into a gain set to 0.35 while raining.
  - **Order:** create the rain layer after `wolves`, so earlier layer indexes stay put.

- [ ] **Step 4: Run every check.** Run: `npm run lint && npm test -- --run`. Expected: PASS.

- [ ] **Step 5: Commit** "Rain falls, puddles gather, and the camp hears it".

---

### Task 3: Spring growth and flowers

**Files:**
- Modify: `src/game/rules.ts` (`chopTree`), `src/game/state.ts` (`BALANCE.springTreeRegrowDays: 2`), `src/ui/panels.ts` (axe copy).
- Modify: `src/scene/map.ts`: `buildMap(nodes, key, season?)` adds spring flowers and drops flowers in winter.
- Modify: `src/scene/art.ts`: pass `season(state.day)`.
- Test: `tests/rules.test.ts`, `tests/panels.test.ts`, `tests/map.test.ts`.

- [ ] **Step 1: Write the failing tests**
  - **`regrows trees in two days when chopped in spring`:** a survivor with an axe beside `tree-0` chops it on day 30, leaving `readyDay` 32. On day 8 it would be 11.
  - **Axe panel:** the crafted copy reads "…Stumps regrow after two dawns." on day 22, and "three dawns" on day 8.
  - **Map flowers:**
    - `buildMap(nodes, 'camp', 'spring')` has at least 1.5× as many `flower*` decorations as `'summer'`, and every summer flower is also present in spring.
    - `'winter'` has none.
    - Leaving the season out gives the same result as `'summer'`.
    - No spring flower sits on a path tile, the camp circle or within 1 tile of a node.

- [ ] **Step 2: Run them and watch them fail.**

- [ ] **Step 3: Implement**
  - **Spring flowers:** in `layCampTile`'s decoration branch, when `campDecoration` returns null in spring and `hash(x, y, 6) % 5 === 0` and no node is within 1 tile, add `flower${hash(x, y, 5) % 3}`.
  - **Winter:** filter out `flower*` decorations.

- [ ] **Step 4: Run every check.** Expected: PASS.

- [ ] **Step 5: Commit** "Faster spring regrowth, and flowers that come and go with the seasons".

---

### Task 4: Rabbits, and the README

**Files:**
- Modify: `src/art/wildlifeSprites.ts`:
  - `rabbit` sprite, 10×8, legend `bird0`–`bird4` plus `paper` for the tail, anchor `[5, 7]`.
  - Frames: `sit`, `nibble0`, `nibble1`, `hop0` (crouch) and `hop1` (stretched, a pixel higher).
- Modify: `src/scene/ambient.ts`: add `RABBIT_HOMES`, `rabbitCount(day)`, `rabbitAt(index, timeMs)`, `RABBIT_FLEE_RADIUS = 2.5`.
- Modify: `src/scene/ambientLife.ts`: the rabbit images and their flee and return logic.
- Modify: `README.md`.
- Test: `tests/ambient.test.ts`, `tests/ambientLife.test.ts`, `tests/wildlifeFrames.test.ts`.

**Interfaces:**
- Produces:
  - `RABBIT_HOMES: Point[] = [{ x: 14.5, y: 17.5 }, { x: 26.5, y: 13.5 }, { x: 22.5, y: 20.5 }]`, in the meadow beside the bushes at (16, 18), (25, 11) and (23, 17).
  - `rabbitCount(day) = 2 + Math.floor(hash(day + 31) * 2)` (2 or 3).
  - `rabbitAt(index, timeMs): { x: number; y: number; frame: string }`. On a 6 s cycle per rabbit (offset `index × 1.9 s`), it sits for 0–2 s, nibbles for 2–4 s (frames alternating each 0.2 s), then hops to one of four spots within 0.8 tiles of home over 4–6 s (`hop0`/`hop1` alternating each 0.15 s). The spot is chosen by `floor(cycle number) % 4`.
- `AmbientLife`:
  - Rabbits show only when `isSpring(day)`, the area is camp, and `dark < 0.3`.
  - A rabbit within `RABBIT_FLEE_RADIUS` of the survivor runs 5 tiles straight away from them over 0.8 s with `hop` frames, then hides for 8 s.
  - It comes back to its home once the survivor is more than 4.5 tiles from home.

- [ ] **Step 1: Write the failing tests**
  - `rabbitCount` takes only 2 and 3 across days 1–200, and both appear.
  - `rabbitAt` stays within 0.8 tiles of home and gives only the five frames.
  - In `AmbientLife` (fake scene):
    - On a spring day, exactly `rabbitCount(day)` rabbit images are visible.
    - None show on a summer day or a spring night.
    - A rabbit at whose home the survivor stands is hidden after 1 s.
    - It shows again after the survivor walks away and 9 s pass.
  - The `rabbit` sprite is valid with the five frames.

- [ ] **Step 2: Run them and watch them fail.**

- [ ] **Step 3: Implement as above.** README:
  - Add a "Spring" section after "Winter": rain (about one spring day in three; chills you away from shelter and hurries the fire; "Rain is coming in."), puddles and flowers, rabbits, birds back, and trees regrowing in two days.
  - Update the sentence "Spring and summer will bring their own challenges in later updates." to mention summer only.
  - Add spring to the test list.

- [ ] **Step 4: Run every check, then look in the browser.**
  - Run: `npm run lint && npm test -- --run && npm run build`. Expected: all pass.
  - Screenshots at 1280×800 and 390×844:
    - day 22 at 40 s (rain, puddles, tint, flowers, rabbits);
    - day 22 at 100 s (puddles, no rain);
    - day 25 when the rain starts (the message).

- [ ] **Step 5: Commit** "Rabbits in the spring meadow, and the README".
