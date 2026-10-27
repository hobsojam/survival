# Seasons: Summer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make summer (days 31–40, and again every year) the season of plenty: nights are warm, the midday heat makes you hungry a little faster, berry bushes give two berries, and evenings glow gold.

**Architecture:** Season comes from `day` (`calendar.ts`), so nothing new is saved. The rules live in `src/game/rules.ts` (`advanceTime`, `warmthChange` and `gather`). A heat message joins `newsBetween` in `src/game/news.ts`. The golden evening is a lighting-tint change in `src/scene/lighting.ts`. `GameScene` needs no change, because it already shows every line from `newsBetween`.

**Tech Stack:** TypeScript, Phaser 4, Vite, Vitest (node), oxlint.

**Spec:** `docs/superpowers/specs/2026-10-26-seasons-design.md` (section "Summer", and build step 4)

## Global Constraints

- **Summer:** days 31–40 of each 40-day year, from `season(day) === 'summer'`.
- **Warm nights:** "at night, warmth doesn't fall anywhere. There's no warmth loss outdoors, and the fire is optional. A fire still cooks."
- **Heat:** "in the middle of the day (`timeOfDay` 60–130), hunger falls 1.25× faster."
- **Plenty:** "berry bushes give 2 berries when gathered."
- **Look:** "lush deep greens, a golden evening tint, and fireflies at night." Fireflies are already summer-only (#73). The base palette is already the summer look (`seasonPalette.ts`: "Summer is the painted look").
- **Gentle:** a cosy camp builder. Nothing new may punish the player.
- **No save change:** the save stays at version 13.
- **Checks:** `npm run lint` (oxlint `--deny-warnings`), `npx tsc --noEmit -p .`, `npm test -- --run` and `npm run build` all pass.
- **README:** add a "### Summer" section after Spring, and drop the sentence "Summer will bring its own changes in a later update."

## Review Focus

1. **A pending autumn cold front on a summer night.** The forecast front keeps its cold-front rules, because the player was warned and it unlocks the hearth. Warm nights cover every other summer night. Test: day 33 with `nextStormDay: 33` at night still loses warmth outdoors.
2. **A nearly full bag in summer.** One free space gives one berry, not a refusal and not an overfull bag. Test: a bag with 1 free space gathers 1 berry.
3. **Heat window edges.** At `timeOfDay` 59 and 130 hunger falls at the normal rate; from 60 until just before 130 it falls 1.25× as fast. The heat applies to the part of each one-second step inside the window. Test: a step from 55 to 65 loses `5/8 + 5·1.25/8`.
4. **Sleep through a summer night.** It ends with warmth no lower than when you lay down. Test: sleep from night on day 34 without a fire.
5. **The summer-to-autumn edge.** On day 41 nights chill again and bushes give one berry. Test: the same checks on day 41.

---

### Task 1: Summer rules (warm nights, midday heat, double berries)

**Files:**
- Modify: `src/game/calendar.ts` (add `isSummer`)
- Modify: `src/game/state.ts` (`BALANCE` values)
- Modify: `src/game/rules.ts` (`advanceTime`, `warmthChange`, `gather`)
- Modify: `src/game/news.ts` (heat message)
- Test: `tests/calendar.test.ts`, `tests/rules.test.ts`, `tests/news.test.ts`

**Interfaces:**
- Produces:
  - `isSummer(day: number): boolean` in `calendar.ts`, in the style of `isSpring`.
  - In `BALANCE`: `summerHeatStart: 60`, `summerHeatEnd: 130`, `summerHeatHunger: 1.25`, `summerBerries: 2`.
  - `heatMessage(before: GameState, after: GameState): string | null` in `rules.ts`, exported. It returns `'The midday sun is hot. You will get hungry a little faster.'` when, on a summer day, `before.timeOfDay < 60 <= after.timeOfDay` and the day is the same. Otherwise it returns null.
  - `newsBetween` puts `heatMessage` after `rainMessage`.

- [ ] **Step 1: Write the failing tests**
  - `calendar.test.ts`: `isSummer` is true on 31, 40 and 71, and false on 30 and 41.
  - `rules.test.ts`, new `describe('summer')`:
    - `'keeps warmth steady on a summer night away from the fire'`: day 34 at `nightStart(34)+10`, the player away from camp at warmth 60. After `advanceTime(state, 20)` warmth is 60.
    - `'still warms you by a lit fire on a summer night'`: at camp, fuel 50, warmth 60. After 10 s warmth is 65.
    - `'keeps the forecast cold front cold, even in summer'`: day 33 with `nextStormDay: 33`, at night, outdoors at warmth 60. After 10 s warmth is below 60.
    - `'chills nights again once autumn returns'`: day 41 at night, outdoors, warmth 60. After 10 s warmth is 55.
    - `'sleeps through a summer night without getting colder'`: day 34 at night, in the shelter, no fire, warmth 50. After `sleep` the next morning's warmth is ≥ 50.
    - `'makes you hungry faster in the midday heat'`, with hunger 100 and the player resting, and other drains as usual:
      - day 34, 55 → 65: lost `5/8 + 5*1.25/8`;
      - day 34, 130 → 140: lost `10/8`;
      - day 24, 70 → 80: lost `10/8`.
    - `'picks two berries from a summer bush'`: day 34 next to a berry node with amount 1. Food rises by 2, the node amount is 0, and the message is `'Picked two handfuls of berries.'`.
    - `'picks one berry when the bag has a single space'`: a bag with 1 free space gives food +1, and the message is `'Picked berries.'`.
    - `'picks one berry in autumn'`: day 41 gives food +1.
  - `news.test.ts`: the heat message shows when crossing 60 on day 34, not on day 24, and not when crossing 61 → 70.

- [ ] **Step 2: Run them and watch them fail**
  Run: `npx vitest run tests/calendar.test.ts tests/rules.test.ts tests/news.test.ts`
  Expected: FAIL. `isSummer` and `heatMessage` are undefined, and the warmth, hunger and berry numbers don't match yet.

- [ ] **Step 3: Implement**
  - **Hunger:** in `advanceTime`, the hunger lost in a step is `step/8`, times `summerHeatHunger` for the seconds of the step inside `[summerHeatStart, summerHeatEnd)` on a summer day. Split the step by its overlap with the window.
  - **Warmth:** in `warmthChange`, for a night that is not `coldNight` on a summer day, return `max(change, 0)`, so a lit fire at camp still adds `step/2`.
  - **Berries:** in `gather`, berry nodes give `min(summerBerries, freeSpaces)` food in summer (1 otherwise) and take one from the node. The message for two is `'Picked two handfuls of berries.'`.

- [ ] **Step 4: Run them and watch them pass, then run the full suite**
  Run: `npx vitest run tests/calendar.test.ts tests/rules.test.ts tests/news.test.ts && npm test -- --run && npm run lint && npx tsc --noEmit -p .`
  Expected: all PASS.

- [ ] **Step 5: Commit** "Warm summer nights, midday heat and heavy berry bushes"

### Task 2: Golden summer evenings, and the README

**Files:**
- Modify: `src/art/palette.ts` (add `golden: '#f6c75a'`)
- Modify: `src/scene/lighting.ts`
- Modify: `README.md`
- Test: `tests/lighting.test.ts`

**Interfaces:**
- Consumes: `isSummer(day)` from Task 1.
- Produces: in summer, `lightingTint` returns `palette.golden` during dusk. The dusk window is 45 s instead of 30, and alpha ramps to 0.16 at `nightStart`. The other seasons keep today's dusk (30 s, `palette.dusk`, up to 0.12). Rain still wins over dusk, as today.

- [ ] **Step 1: Write the failing test** in `tests/lighting.test.ts`, `describe('summer evenings')`:
  - day 34 at `nightStart(34) - 40`: color `golden`, alpha > 0;
  - at `nightStart(34) - 1`: alpha close to `0.16·44/45`;
  - day 24 at `nightStart(24) - 40`: alpha 0;
  - day 24 at `nightStart(24) - 1`: color `dusk`.

- [ ] **Step 2: Run it and watch it fail**
  Run: `npx vitest run tests/lighting.test.ts`
  Expected: FAIL on the summer colour and alpha.

- [ ] **Step 3: Implement** the season-dependent dusk in `lightingTint` and the palette entry.

- [ ] **Step 4: README.** Replace "Summer will bring its own changes in a later update." with nothing. Add "### Summer" after Spring, covering:
  - warm nights everywhere (a fire is optional but still cooks, and the forecast cold front, if still pending, stays cold);
  - the midday heat (from about a quarter into the day until a little past half) and its message;
  - two berries per gather (one if the bag has only one space);
  - golden evenings, fireflies, birds and the fox.

  Add summer to the README's list of what the tests cover, if it has one.

- [ ] **Step 5: Verify**
  Run: `npm test -- --run && npm run lint && npx tsc --noEmit -p . && npm run build`
  Expected: all pass. Then check the browser on day 34 at dusk at 1280×800 and 390×844: the tint looks gold, not orange-brown.

- [ ] **Step 6: Commit** "Golden summer evenings, and summer in the README"
