# Seasons PR 2: Winter — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Winter (days 11–20, 51–60, …) plays differently from autumn:
- **Bitter nights:** every night is a bitter night.
- **Food and rest:** the berry bushes are bare, and the quiet spring is frozen.
- **Wildlife:** the birds leave, and wolves gather when the camp fire burns low, taking a ration when it goes out.

**Architecture:**
- **Bitter nights:** the existing cold-front check `isColdNight` keeps its meaning: the forecast front, with its messages, penalty and hearth unlock. A new check, `isFreezingNight`, is true on the front's night *or* on any winter night. The physics and the bitter-night looks read the new check.
- **Wolves:** they live in a new pure module, `src/game/wolves.ts`. A visit is recorded in a new saved field, `lastWolf`, which moves the save to version 13. The visit message, the tracks and the eyes are all derived from that field and the clock.
- **Snowy paths:** a new `path` palette ramp that winter recolours. This uses the palette-swap approach from PR 1.

**Tech Stack:** TypeScript, Phaser 4, Vite, Vitest (node environment, no DOM), oxlint `--deny-warnings`.

**Spec:** `docs/superpowers/specs/2026-10-26-seasons-design.md`, build step 2 ("Winter"). PR 1 (calendar, looks, day length) is merged as #73.

## Global Constraints

- **When winter is:** winter is `season(day) === 'winter'`, from `src/game/calendar.ts`. Add `export const isWinter = (day: number): boolean => season(day) === 'winter';` there and use it everywhere.
- **Freezing nights** use the existing cold-front numbers unchanged:
  - Fire burn ×`BALANCE.coldNightFireBurn` (2).
  - Warmth loss of `coldNightShelteredWarmthLossPerSecond` (0.75/s) at camp in the shelter.
  - Warmth loss of `coldNightOutdoorWarmthLossPerSecond` (1.25/s) elsewhere.
  - A lit fire at camp still warms (+0.5/s).
  - **No failure penalty:** the wake-tired, lose-the-morning penalty and the hearth unlock stay tied to the forecast cold front (`nextStormDay`) only.
- **Exact copy:**
  - Gathering a bush in winter: "The bushes are bare until spring."
  - The quiet spring in winter: "The spring is frozen over."
  - Wolf took a ration: "A wolf slipped into the dark camp and took a ration."
  - Wolf took a berry: "A wolf slipped into the dark camp and took a berry."
  - Wolf found nothing: "A wolf circled the dark camp but found nothing to take."
  - Winter forecast copy: "Winter nights are bitter. Keep the fire alive until dawn, or the wolves will come close."
- **Wolves:**
  - **When they come:** eyes and howls show on winter nights while `fireFuel < 20`.
  - **Theft:** the first moment of a winter night that `fireFuel <= 0`, a wolf takes one trail ration, otherwise one berry, otherwise nothing. This happens at most once per night (per `day`), wherever the survivor is.
  - **Tracks:** they show from the visit until the next nightfall.
- **Save:** `SAVE_VERSION` becomes **13**. Saves from version 12 and earlier are rejected. Follow the README rule: only one open PR may change the save format.
- **Accessibility and art:**
  - Text meets WCAG AA (4.5:1).
  - Pixel art follows `docs/superpowers/specs/2026-10-21-pixel-art-direction.md`.
  - Ambient life never changes or saves state. Wolves change state only through `advanceTime`.
- **Checks:**
  - `npm run lint`, `npm test -- --run` and `npm run build` all pass.
  - SonarCloud needs 80% coverage of new code, so keep `GameScene.ts` and `App.ts` changes to one-line calls into tested helpers.

## Review Focus

1. **Fire dies during sleep in winter.** The wolf takes a ration overnight, and the survivor learns of it on waking, after the sleep message. Task 3 test `tells of the wolf after sleeping`.
2. **A cold-front retry that falls in winter.** Only the front's night carries the failure penalty, and an ordinary winter night never does. Task 1 test `gives winter nights no penalty, but keeps the front's`.
3. **One wolf per night, even across many small time steps and a save and reload.** Task 3 tests `visits once per night` and `round-trips the last wolf visit`.
4. **Tracks across dawn and across a season change.** Tracks show the morning after, are gone at the next nightfall, and a wolf on day 20 still leaves tracks on spring's first morning. Task 3 test `shows tracks until the next nightfall`.
5. **The second year:** day 51 is winter again, with bare bushes and freezing nights. Task 1 test `treats the second year's winter as winter`.

---

### Task 1: Freezing nights and the winter forecast

**Files:**
- Modify: `src/game/calendar.ts`: add `isWinter`.
- Modify: `src/game/rules.ts`: add `isFreezingNight`, and make `advanceTime` and `warmthChange` use it.
- Modify: `src/game/forecast.ts`: `stormReadiness` reads `isFreezingNight`.
- Modify: `src/ui/panels.ts`: winter forecast view.
- Modify: `src/scene/lighting.ts`, `src/scene/visuals.ts` (`fireMode`) and `src/scene/effectVisuals.ts`: bitter-night tint, windy fire and weather on every freezing night.
- Test: `tests/calendar.test.ts`, `tests/rules.test.ts`, `tests/forecast.test.ts`, `tests/panels.test.ts`, `tests/lighting.test.ts`, `tests/visuals.test.ts`, `tests/effectVisuals.test.ts`.

**Interfaces:**
- Produces:
  - `isWinter(day: number): boolean` in `src/game/calendar.ts`.
  - `isFreezingNight(state: GameState): boolean` in `src/game/rules.ts`, which is `isColdNight(state) || (isWinter(state.day) && state.timeOfDay >= nightStart(state.day))`.
- `isColdNight` is unchanged. `GameScene.weatherMessage` and `showMorningFrost` keep using it, so the front's arrival and ending messages never fire on ordinary winter nights.

- [ ] **Step 1: Write the failing tests**

`tests/calendar.test.ts`:
```ts
it('treats the second year\'s winter as winter', () => {
  expect([10, 11, 20, 21, 51].map(isWinter)).toEqual([false, true, true, false, true]);
});
```

`tests/rules.test.ts` (in a new `describe('winter nights')`). `winterNight` here means a fresh game on day 12 with `hearthUnlocked: true`, `nextStormDay: null`, and `timeOfDay = nightStart(12) + 1`:
```ts
it('makes every winter night freezing, and autumn nights not', () => {
  expect(isFreezingNight(winterNight)).toBe(true);
  expect(isFreezingNight({ ...winterNight, timeOfDay: nightStart(12) - 1 })).toBe(false);
  expect(isFreezingNight({ ...winterNight, day: 8, timeOfDay: nightStart(8) + 1 })).toBe(false);
});
it('burns the fire twice as fast and chills the survivor away from it', () => {
  const atFire = advanceTime({ ...winterNight, fireFuel: 50 }, 10);
  expect(atFire.fireFuel).toBeCloseTo(30);
  const away = advanceTime({ ...winterNight, player: { ...winterNight.player, x: 5, y: 25, warmth: 80 } }, 10);
  expect(away.player.warmth).toBeCloseTo(80 - 12.5);
});
it('gives winter nights no penalty, but keeps the front\'s', () => {
  const dawn = advanceTime({ ...winterNight, timeOfDay: 239, player: { ...winterNight.player, energy: 90 } }, 2);
  expect(dawn).toMatchObject({ day: 13, progress: { nextStormDay: null } });
  expect(dawn.timeOfDay).toBeCloseTo(1);
  expect(dawn.player.energy).toBeGreaterThan(BALANCE.coldNightFailureEnergy);
  const front = { ...winterNight, timeOfDay: 239, progress: { ...winterNight.progress, hearthUnlocked: false, nextStormDay: 12 } };
  const failed = advanceTime(front, 2);
  expect(failed.progress.nextStormDay).toBe(12 + BALANCE.coldNightRetryDays);
  expect(failed.player.energy).toBeLessThanOrEqual(BALANCE.coldNightFailureEnergy);
});
```

`tests/panels.test.ts`:
```ts
it('warns of winter nights once the front is weathered', () => {
  const winter = game({ progress: afterColdNight }, { day: 12 });
  // nightStart(12) is 136, so the night needs (240 - 136) × 2 = 208 s of fire.
  expect(forecastView(winter)).toEqual({ active: false, weathered: false, title: 'Winter nights',
    copy: 'Winter nights are bitter. Keep the fire alive until dawn, or the wolves will come close.',
    shelter: '○ Shelter needed', fire: '○ Fire: 0 / 208s for the night · 3 more logs' });
  expect(forecastView({ ...winter, timeOfDay: nightStart(12) + 1 })).toMatchObject({ active: true, title: 'A bitter night' });
});
it('keeps the cold front card while a front is still pending in winter', () => {
  const pending = game({}, { day: 12 });
  pending.progress.nextStormDay = 12;
  expect(forecastView(pending).title).toBe('Cold front · day 12 night');
});
```

`tests/lighting.test.ts`: on a winter night `lightingTint` uses `palette.storm` with alpha `darkness × 0.64`. On an autumn non-front night it uses `palette.night`.

`tests/visuals.test.ts`: the fire frame is `windy` on a winter night with fuel ≥ 30, and `burning` on an autumn night.

`tests/effectVisuals.test.ts`: weather visuals (ids starting `weather:`, or whatever ids `weatherVisuals` uses) appear on a winter night and are absent on an autumn night.

- [ ] **Step 2: Run them and watch them fail**

Run: `npm test -- --run tests/calendar.test.ts tests/rules.test.ts tests/panels.test.ts tests/lighting.test.ts tests/visuals.test.ts tests/effectVisuals.test.ts`
Expected: FAIL. `isWinter` and `isFreezingNight` are not exported, and the winter forecast copy differs.

- [ ] **Step 3: Implement**

- **`advanceTime`:** use `isFreezingNight(next)` where it now uses `isColdNight(next)` for the burn rate and for `warmthChange`'s `coldNight` argument. `dawn` keeps reading `nextStormDay`.
- **`stormReadiness`:** `storm = isFreezingNight(state)`. Name the night it plans for `const night = state.progress.nextStormDay ?? state.day`, and use it in all three places that compare or read the storm day: the fuel left at nightfall, `needed`, and `forecastFireCheck`'s "at nightfall" hint. A fire lit on a winter afternoon then counts toward tonight. Add a panels test: day 12, weathered, `timeOfDay: 100` and `fireFuel: 100` give `○ Fire: 64 / 208s for the night · add carried wood at nightfall` when carrying 2 wood. That works out as 100 − (136 − 100) = 64 s left, with reach 64 + 180 > 208.
- **`forecastView`:** the order is:
  - front pending (`!hearthUnlocked`): today's front view, unchanged;
  - otherwise in winter: `{ active: isFreezingNight, weathered: false, title: active ? 'A bitter night' : 'Winter nights', copy, shelter: '✓ Shelter ready' | '○ Shelter needed', fire: forecastFireCheck(state) }`;
  - otherwise: today's weathered view.

  Ruling for the executor's ledger: the spec says "in winter it says …". A pending front still wins, because it carries the penalty and the hearth unlock.
- **`lightingTint`, `fireMode` and `effectVisuals`:** use `isFreezingNight` in place of `isColdNight`.
- **The survivor's breath (optional in the spec):** dropped. Record it as a ruling.

- [ ] **Step 4: Run the whole suite**

Run: `npm test -- --run`
Expected: PASS. Fix any older test that assumed autumn-only nights by moving it to an autumn day, never by weakening the new rule.

- [ ] **Step 5: Commit**

```bash
git add src tests
git commit -m "Make every winter night a freezing night"
```

---

### Task 2: Bare bushes and the frozen spring

**Files:**
- Modify: `src/game/rules.ts` (`gather`, `restAtSpring`), `src/scene/tapTarget.ts` (lines 64 and 91 filters), `src/scene/visuals.ts` (`nodeFrame`, `site-spring`).
- Modify: `src/art/phase3Sprites.ts`: add a `frozen` frame to `spring`.
- Test: `tests/rules.test.ts`, `tests/tapTarget.test.ts`, `tests/visuals.test.ts`, `tests/phase5Art.test.ts` (or whichever art test lists sprite frames).

**Interfaces:**
- Consumes: `isWinter(day)` from Task 1.

- [ ] **Step 1: Write the failing tests**

```ts
// rules.test.ts, with `winterDay` a fresh game on day 12 standing at a berry node, and at the spring
it('leaves the bushes bare all winter', () => {
  const result = applyAction(winterDay, { type: 'gather', nodeId: 'berry-0' });
  expect(result.message).toBe('The bushes are bare until spring.');
  expect(result.state).toBe(winterDay);
});
it('freezes the quiet spring, but still marks it found', () => {
  const result = applyAction(atSpringInWinter, { type: 'visitSite', siteId: 'spring' });
  expect(result.message).toBe('The spring is frozen over.');
  expect(result.state.player.energy).toBe(atSpringInWinter.player.energy);
  expect(result.state.timeOfDay).toBe(atSpringInWinter.timeOfDay);
  expect(result.state.progress.discoveries.spring).toBe(true);
});
// tapTarget.test.ts
it('skips bare bushes in winter', () => { /* a survivor next to berry-0 on day 12 finds the nearest non-berry node or nothing, and on day 2 finds berry-0 */ });
// visuals.test.ts
it('shows bare bushes and an iced spring in winter', () => {
  /* day 12: every berryBush texture ends ':picked' and site-spring is 'spring:frozen'; day 2: 'berryBush:ready' and 'spring:still' */
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npm test -- --run tests/rules.test.ts tests/tapTarget.test.ts tests/visuals.test.ts`
Expected: FAIL. The berries are still gathered, the spring still rests, and the `spring:frozen` texture is missing.

- [ ] **Step 3: Implement**

- **`gather`:** refuse berry nodes in winter, after the reach check.
- **`restAtSpring`:** in winter, return the state with only `discoveries.spring` set, and the frozen message. No time passes.
- **`closestGatherable` and the tap-target node list:** filter out berry nodes when `isWinter(state.day)`.
- **`nodeFrame`:** a berry bush in winter shows `picked` (a rustle never starts, because gathering is refused).
- **Bush regrowth:** leave it alone. Bushes regrow out of sight and are full on spring's first day.
- **`spring:frozen` (24×16, `siteLegend`):** the same outline as `still`, with the water (`u`) painted `frost` and two or three short `paper` streaks for ice.

- [ ] **Step 4: Run the whole suite**

Run: `npm test -- --run`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src tests
git commit -m "Leave the bushes bare and freeze the spring in winter"
```

---

### Task 3: Wolves take from a dark camp (save version 13)

**Files:**
- Create: `src/game/wolves.ts`.
- Modify: `src/game/state.ts` (`GameState.lastWolf`, `createGame`), `src/game/rules.ts` (`advanceTime` calls `wolfVisit`), `src/game/save.ts` (version 13, `validWolf`), `src/scene/GameScene.ts` (one `wolfMessage` argument in each `say` call).
- Test: `tests/wolves.test.ts` (new), `tests/save.test.ts`, `tests/savePlay.test.ts` if it pins the version.

**Interfaces:**
- Produces:
  - `type WolfTake = 'ration' | 'berry' | 'nothing'`.
  - `GameState.lastWolf: { day: number; took: WolfTake } | null` (`null` in `createGame`).
  - `WOLF_LOW_FUEL = 20`.
  - `wolvesClose(state: GameState): boolean`, which is `isWinter(day) && timeOfDay >= nightStart(day) && fireFuel < WOLF_LOW_FUEL`.
  - `wolfVisit(next: GameState): void`, which mutates `advanceTime`'s working copy, like `dawn`. It replaces `next.inventory` with a new object, because `advanceTime` does not copy the inventory.
  - `wolfMessage(before: GameState, after: GameState): string | null`.
  - `wolfTracksShown(state: GameState): boolean`.
- Ruling for the executor's ledger: the spec saves only "the day of the last wolf visit". The plan also saves what was taken, because the message can't be worked out afterwards. For example, a ration dried and then stolen within one action leaves the ration count unchanged. This is the same principle as the spec's: only save what can't be derived.

- [ ] **Step 1: Write the failing tests** (`tests/wolves.test.ts`)

`dark` here means day 12, `hearthUnlocked`, `nextStormDay: null`, `timeOfDay = nightStart(12) + 5`, `fireFuel: 0`, and the shelter built.

```ts
it('takes a ration first, then a berry, then nothing', () => {
  expect(advanceTime({ ...dark, inventory: { ...dark.inventory, trailFood: 2, food: 1 } }, 1))
    .toMatchObject({ inventory: { trailFood: 1, food: 1 }, lastWolf: { day: 12, took: 'ration' } });
  expect(advanceTime({ ...dark, inventory: { ...dark.inventory, food: 1 } }, 1))
    .toMatchObject({ inventory: { food: 0 }, lastWolf: { day: 12, took: 'berry' } });
  expect(advanceTime(dark, 1).lastWolf).toEqual({ day: 12, took: 'nothing' });
});
it('visits once per night', () => {
  let state = { ...dark, inventory: { ...dark.inventory, trailFood: 3 } };
  for (let i = 0; i < 20; i++) state = advanceTime(state, 0.5);
  expect(state.inventory.trailFood).toBe(2);
});
it('comes when the fire goes out, not before, and only in winter', () => {
  expect(advanceTime({ ...dark, fireFuel: 10 }, 3).lastWolf).toBeNull();   // 4 s of fuel left
  expect(advanceTime({ ...dark, fireFuel: 10 }, 6).lastWolf?.day).toBe(12);
  expect(advanceTime({ ...dark, day: 8, timeOfDay: nightStart(8) + 5 }, 1).lastWolf).toBeNull();
  expect(advanceTime({ ...dark, timeOfDay: nightStart(12) - 5 }, 4).lastWolf).toBeNull();
});
it('comes again on a later night', () => {
  const visited = { ...dark, lastWolf: { day: 11, took: 'nothing' as const } };
  expect(advanceTime(visited, 1).lastWolf?.day).toBe(12);
});
it('gathers close while the fire is low on a winter night', () => {
  expect(wolvesClose({ ...dark, fireFuel: 19 })).toBe(true);
  expect(wolvesClose({ ...dark, fireFuel: 20 })).toBe(false);
  expect(wolvesClose({ ...dark, timeOfDay: 10 })).toBe(false);
  expect(wolvesClose({ ...dark, day: 8, timeOfDay: nightStart(8) + 5 })).toBe(false);
});
it('says what the wolf took, once', () => {
  const after = advanceTime({ ...dark, inventory: { ...dark.inventory, trailFood: 1 } }, 1);
  expect(wolfMessage(dark, after)).toBe('A wolf slipped into the dark camp and took a ration.');
  expect(wolfMessage(after, advanceTime(after, 1))).toBeNull();
  expect(wolfMessage(dark, advanceTime({ ...dark, inventory: { ...dark.inventory, food: 1 } }, 1))).toBe('A wolf slipped into the dark camp and took a berry.');
  expect(wolfMessage(dark, advanceTime(dark, 1))).toBe('A wolf circled the dark camp but found nothing to take.');
});
it('tells of the wolf after sleeping', () => {
  const evening = { ...dark, fireFuel: 30, inventory: { ...dark.inventory, trailFood: 1 } };
  const slept = applyAction(evening, { type: 'sleep' }).state;
  expect(slept.inventory.trailFood).toBe(0);
  expect(wolfMessage(evening, slept)).toBe('A wolf slipped into the dark camp and took a ration.');
});
it('shows tracks until the next nightfall', () => {
  const visit = { day: 20, took: 'nothing' as const };
  expect(wolfTracksShown({ ...dark, day: 20, timeOfDay: 230, lastWolf: visit })).toBe(true);
  expect(wolfTracksShown({ ...dark, day: 21, timeOfDay: 10, lastWolf: visit })).toBe(true);
  expect(wolfTracksShown({ ...dark, day: 21, timeOfDay: nightStart(21), lastWolf: visit })).toBe(false);
  expect(wolfTracksShown({ ...dark, day: 22, timeOfDay: 10, lastWolf: visit })).toBe(false);
  expect(wolfTracksShown({ ...dark, lastWolf: null })).toBe(false);
});
```

`tests/save.test.ts`:
- **Version:** saves now write version 13. The "rejects every earlier version" loop runs `1..12`. Fixtures that write `{ version: 12 }` move to 13.
- `it('round-trips the last wolf visit')`: a save with `lastWolf: { day: 12, took: 'berry' }` on day 13 loads equal.
- `it('rejects a wolf visit from the future or of an unknown kind')`: `lastWolf.day` greater than `day`, `took: 'fish'`, `day: 1.5` and `lastWolf: 'yes'` are each `invalid`.

- [ ] **Step 2: Run them and watch them fail**

Run: `npm test -- --run tests/wolves.test.ts tests/save.test.ts`
Expected: FAIL. `src/game/wolves.ts` doesn't exist, and the save version is 12.

- [ ] **Step 3: Implement**

- **`advanceTime`:** in its loop, after `next.timeOfDay += step` and before the dawn check, call `wolfVisit(next)`. It does nothing unless `isWinter(next.day) && next.timeOfDay >= nightStart(next.day) && next.fireFuel <= 0 && next.lastWolf?.day !== next.day`.
- **`save.ts`:**
  - `SAVE_VERSION = 13`.
  - Add `validWolf` to `validState`'s checks: `lastWolf === null`, or an object with whole `day`, `1 <= day <= state day`, and `took` one of the three kinds.
  - Update the `validState` doc comment to version 13.
- **`GameScene`:**
  - **`perform`:** `this.say(message, wolfMessage(before, this.state), seasonMessage(...), this.needsAlert())`.
  - **`reportWeather`:** the same `wolfMessage(before, after)` argument after the weather message.

- [ ] **Step 4: Run the whole suite**

Run: `npm test -- --run`
Expected: PASS. Tests that build a `GameState` by hand need `lastWolf: null`. Prefer spreading `createGame()`.

- [ ] **Step 5: Commit**

```bash
git add src tests
git commit -m "Wolves take a ration from a dark winter camp (save version 13)"
```

---

### Task 4: Winter wildlife, sound and snowy paths

**Files:**
- Modify: `src/scene/ambient.ts`:
  - `eyesAt` takes an optional `spots` parameter (default `EYE_SPOTS`).
  - Add `WOLF_SPOTS` and `wolfCount(day)`.
- Modify: `src/scene/ambientLife.ts`:
  - Wolf eyes at camp.
  - No birds in winter.
- Modify: `src/game/soundscape.ts`:
  - A sixth layer, `wolves`, with a howl.
  - No birdsong in winter.
- Modify: `src/art/wildlifeSprites.ts`: a `wolfTracks` sprite.
- Modify: `src/scene/visuals.ts`: the tracks decal.
- Modify: `src/art/palette.ts`:
  - Add `path0`–`path4`, equal to `earth0`–`earth4`.
  - Add a `pathLegend` in `src/art/terrain.ts`, used only by `pathSpriteFor`.
- Modify: `src/art/seasonPalette.ts`: a winter `path` ramp.
- Modify: `README.md`.
- Test: `tests/ambient.test.ts`, `tests/ambientLife.test.ts`, `tests/soundscape.test.ts`, `tests/visuals.test.ts`, `tests/seasonPalette.test.ts`, `tests/wildlifeFrames.test.ts` (or the art test that checks every sprite).

**Interfaces:**
- Consumes: `wolvesClose`, `wolfTracksShown` and `WOLF_LOW_FUEL` (Task 3), and `isWinter` (Task 1).
- Produces:
  - `WOLF_SPOTS: Point[] = [{ x: 13.5, y: 12.5 }, { x: 26.5, y: 18.5 }, { x: 17.5, y: 21.5 }]` (each about 7 tiles from the fire, and clear of the trees).
  - `wolfCount(day: number): number`, which is `1 + Math.floor(hash(day + 17) * 3)`, from 1 to 3.
  - `wolfWatch(fireFuel: number): number`, which is `clamp((WOLF_LOW_FUEL - fireFuel) / 10, 0, 1)`. It is how strongly the wolves press in.

- [ ] **Step 1: Write the failing tests**

- **`ambient.test.ts`:**
  - `wolfCount` stays within 1–3 across days 1–200, and takes every value from 1 to 3.
  - `eyesAt(0, t, 1, player, WOLF_SPOTS)` returns a point near `WOLF_SPOTS[0]` in its visible window, and null when the survivor stands at the spot.
  - `wolfWatch`: 25 → 0, 20 → 0, 15 → 0.5, 0 → 1.
- **`ambientLife.test.ts`** (with its existing fake scene):
  - On a winter night at camp with the fire out, `wolfCount(day)` wolf-eye images are visible at some time `t`, and none on an autumn night.
  - On a winter day, no bird image is visible. On an autumn day, some are.
  - After the fire is fed, the wolf eyes' alpha falls over about a second rather than at once: the eased presence moves at most `seconds` per update.
- **`soundscape.test.ts`:**
  - A sixth gain layer (`wolves: () => layer(5)`) is above 0 for a winter night with the fire out at camp. It is 0 with the fire at 30, in the quarry, and on an autumn night.
  - `birds()` is 0 on a winter day.
  - Keep the existing layer order. The wolves layer is created last.
- **`visuals.test.ts`:** a `wolfTracks:still` visual at the fire at ground-decal depth while `wolfTracksShown`, and none otherwise.
- **`seasonPalette.test.ts`:** winter `path0`–`path4` differ from `earth0`–`earth4`. The other seasons keep the path keys equal to earth. Winter `earth2` is unchanged, so the camp circle stays a darker trodden patch.

- [ ] **Step 2: Run them and watch them fail**

Run: `npm test -- --run tests/ambient.test.ts tests/ambientLife.test.ts tests/soundscape.test.ts tests/visuals.test.ts tests/seasonPalette.test.ts`
Expected: FAIL on the missing exports, layer, sprite and palette keys.

- [ ] **Step 3: Implement**

- **Wolf eyes:**
  - `AmbientLife` keeps three extra `eyes` images at `LIGHT_DEPTH`, plus a `wolfPresence` number eased toward `area === 'camp' && wolvesClose(state) ? wolfWatch(state.fireFuel) : 0` by at most `seconds` per update.
  - Image `i < wolfCount(day)` shows `eyesAt(i, timeMs, dark, player, WOLF_SPOTS)` with its alpha multiplied by `wolfPresence`.
- **Birds:** in winter, birds are hidden and skip their update. Fox, leaves and fireflies are unchanged.
- **Soundscape:**
  - **Wolves layer:** `wolves` is created after `quarry`. `syncAmbience` sets it to `0.5` when `area !== 'quarry' && wolvesClose(state)`, else `0`.
  - **Howls:** a `scheduleHowl` timer, 12–24 s apart, plays `playHowl` into that layer. The howl is a sine or triangle note rising from about 330 Hz to 520 Hz over 0.6 s, holding, then falling to 300 Hz by 2.2 s through a lowpass. Clear its timer in `resetAfterAudioFailure` alongside the others.
  - **Birds:** `birdVolume` is 0 in winter, and `scheduleBirds` skips winter.
- **`wolfTracks` sprite:**
  - 40×24, anchored at its centre bottom.
  - Eight to ten 2×2 paw prints in a loose ring around where the fire pit sits, legend `{ k: 'stone1', l: 'stone2' }`.
  - `visuals.ts` adds it at the fire's tile with `GROUND_DECAL_DEPTH` when `wolfTracksShown(state)` and `area === 'camp'`.
- **Paths:**
  - `pathLegend = { ...groundLegend, e: 'path0', f: 'path1', g: 'path2', h: 'path3', i: 'path4' }`.
  - Winter override: `ramp('path', '#6a7480 #8a96a2 #aab6c0 #c4ced6 #dce4ea')`, trodden snow a shade darker than the snowy grass.
  - Extend the `ramp` helper's prefix type to include `'path'`.
- **README:**
  - Extend "The seasons" with winter's rules: freezing nights and about three logs, bare bushes, the frozen spring, no birds, and wolves (eyes, howl, theft, tracks).
  - Change "version 12" to "version 13" in the save paragraph, and add that the last wolf visit is saved.
  - Add wolves and winter to the test list.

- [ ] **Step 4: Run every check**

Run: `npm run lint && npm test -- --run && npm run build`
Expected: all pass.

- [ ] **Step 5: Look at it in the browser**

Use the Playwright script from PR 1 (`seasons.cjs`, the `weathered` save moved to version 13 with `lastWolf: null`). Take screenshots at 1280×800 and 390×844:
- a winter day at camp (snowy paths, a darker camp circle, bare bushes, the iced spring, no birds);
- a winter night with the fire out (wolf eyes, bitter tint);
- the next morning (tracks around the pit).

Check that the eyes and tracks read clearly on snow and that no text falls below AA.

- [ ] **Step 6: Commit**

```bash
git add src tests README.md
git commit -m "Wolf eyes, howls and tracks, no winter birds, and snowy paths"
```
