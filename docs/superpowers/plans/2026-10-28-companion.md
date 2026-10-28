# Camp Companion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the player befriend one wild animal (a bird, the fox or a young wolf) by making small offerings. The friend stays for good, has its own ways, gives one gentle gift, and sheds fur or feathers for a pillow or a cloak.

**Architecture:** A pure module, `src/game/companion.ts`, holds the befriending, gift, shedding and alarm rules over a new `GameState.companion` object, saved as version 15. The fox's visit timing moves from `src/scene/ambient.ts` into `src/game/wildlife.ts`, so the rules can read it. The scene gets a pure `companionPose` helper and draws the friend in `AmbientLife`. `GameScene` and `App` get thin calls only.

**Tech Stack:** TypeScript, Phaser 4, Vite, Vitest (node), oxlint.

**Spec:** `docs/superpowers/specs/2026-10-28-companion-design.md`

## Global Constraints

- **One friend at most, kept for the whole game.** Once there is a friend, no befriending prompts appear. The other animals stay wild and visit as before.
- **Offerings**, one counted per day (per night for the wolf). Trust never fades, gaps are fine, all three counts grow side by side, and the first to reach its target wins:

  | | Bird | Fox | Wolf |
  |---|---|---|---|
  | **When** | Daytime, outside winter, at camp, within the interaction radius of a berry bush | At camp, while the fox is sitting at its seat (`foxAt(...)?.sitting`) on a day it visits | A winter night, at camp |
  | **Costs** | 1 berry | 1 berry | 1 trail ration |
  | **Target** | 5 | 4 | 3 |
  | **Prompt** | "Scatter a berry for the birds" | "Leave a berry for the fox" | "Leave a ration out for the wolves" |
  | **When it stays** | "A little bird has decided to stay." | "The fox curled up by the fire, and stayed." | "A young wolf stepped into the firelight, and lay down." |

- **Finds** (shedding, and the fox's berry) follow `findDue(day, lastDay, salt)`: true when `day − lastDay ≥ 3` and `hash(day + salt) < 0.5`. The hash comes from the day, like rain.
- **Gifts:**
  - **Wolf:** on a winter night when the fire goes out, the wolf chases the others off and nothing is taken. Message: "Your wolf saw the others off into the dark."
  - **Bird:** once per winter night, a sleep stops when the fire's fuel falls to 20 s (if it's above 0). Message: "Your bird woke you. The fire is nearly out." In spring the birdsong is louder at dawn.
  - **Fox:** on a find dawn, if the bag has room, +1 berry. Message: "The fox left a berry by your bedroll."
- **Shedding:**
  - On a find dawn, one piece lies by the fire. Fox and wolf leave fur; the bird leaves a feather.
  - Only one piece lies there at a time, and none is left while `keepsakes` is 6 or the item is made.
  - After the item is made, a find dawn shows a scenery piece only.
  - Keepsakes don't take bag space.
- **Items**, made once each at camp with the toolshed:
  - **Feather pillow:** 6 feathers, and needs the bed.
  - **Fur cloak:** 6 fur. Any warmth lost at night is multiplied by 0.75.
- **Save version 15.** Older saves are rejected.
- **README:** a short section that hints at the paths without spelling out the offerings.
- **Checks:** `npm run lint`, `npx tsc --noEmit -p .`, `npm test -- --run` and `npm run build` all pass. Check in the browser at 1280×800 and 390×844.

## Rulings made while planning

- **Pillow effect.** Sleeping in the bed already restores energy to 100, so "+10 from sleep" would do nothing. Instead, the pillow adds 10 to resting in the bed (`bedRestEnergyGain`), and raises the hungry-sleep cap (`hungrySleepCap`) by 10.
- **How offerings are made.** A new `befriend` action, bound to the O key. On desktop it also gets an "Offer" button among the survivor's quick actions; on the phone, an "Offer" dock button. Both show only when an offering is possible.
- **Picking up a keepsake.** It's picked up automatically when the survivor comes within 1.5 tiles of the fire: "You found a feather by the fire." (or "a tuft of fur"). This works the same with keys or touch and needs no new tap target. The spec said "E or a tap"; this is simpler and gentler.

## Review Focus

1. **Two offerings possible at once.** The fox sitting at dusk next to a bush in daylight is a bird and fox overlap. The fox wins, and only one trust count grows. Test in Task 1.
2. **Sleep with the bird's alarm.** The alarm stops the sleep at the 20 s mark once. Sleeping again that night reaches dawn. With the fire already out, there's no alarm. Test in Task 2.
3. **Fox berry with a full bag.** Nothing is added and the berry waits for the next find dawn. Shedding with a piece already lying adds no second piece. Test in Task 2.
4. **Wolf gift and wolf offering on the same night.** An offered ration stops that night's theft (`took: 'offered'`, no message), and a wolf friend gives `took: 'chased'`. Saves with either load. Test in Tasks 1 and 2.
5. **The quarry.** No offering prompts appear in the quarry, and the friend's pose there is "waiting at the fire". The cloak still applies at night in the quarry. Test in Tasks 2 and 3.

---

### Task 1: Befriending rules, save version 15, and the offer action

**Files:**
- Create:
  - `src/game/wildlife.ts`: `FOX`, `foxVisits`, `foxWindow` and `foxAt`, plus `RABBIT_HOMES` moved here from `state.ts` and a `dayHash(n)`.
  - `src/game/companion.ts` and `tests/companion.test.ts`.
- Modify:
  - `src/scene/ambient.ts`: re-export the moved items.
  - `src/game/state.ts`: add `companion`.
  - `src/game/wolves.ts`: add `WolfTake` values `'offered'` and `'chased'`. `wolfMessage` gives null for `'offered'`.
  - `src/game/save.ts`: version 15 and `validCompanion`.
  - `src/game/rules.ts`: the `befriend` action.
  - `src/scene/prompts.ts`: the O key and the prompt.
  - `src/ui/App.ts`: the quick-action and dock "Offer" buttons.
- Test: `tests/companion.test.ts`, `tests/save.test.ts`, `tests/prompts.test.ts`, `tests/wolves.test.ts`

**Interfaces:**
- Produces:
  - `type Friend = 'bird' | 'fox' | 'wolf'`.
  - `GameState.companion: { friend: Friend | null; since: number | null; trust: Record<Friend, number>; lastOffer: Record<Friend, number>; keepsakes: number; keepsakeLying: boolean; lastFind: number; lastGift: number; pillow: boolean; cloak: boolean; alarmDay: number }`. In `createGame()` it starts with `friend: null`, every count 0, both flags false and every day 0.
  - `TRUST_TARGET: Record<Friend, number> = { bird: 5, fox: 4, wolf: 3 }`.
  - `offerFor(state): Friend | null`, with priority fox, then wolf, then bird.
  - `offerBlocker(state): string | null`, null exactly when `offerFor` isn't null. Otherwise it gives the nearest reason, or "Nothing here wants an offering right now."
  - `OFFER_PROMPT: Record<Friend, string>`, holding the Global Constraints prompt copy.
  - `{ type: 'befriend' }` in `GameAction`. It spends the cost, takes 3 seconds (`'resting'`), adds 1 to trust, sets `lastOffer[friend] = day`, and on reaching the target sets `friend`, `since = day`, `lastFind = day` and `lastGift = day`.
    - The offering messages are "The birds peck at the berry. One lingers a moment longer.", "The fox takes the berry, and watches you a while." and "Something takes the ration from the edge of the firelight."
    - On reaching the target, the message is the "stays" line instead.
    - The wolf offering also sets `lastWolf = { day, took: 'offered' }`.
  - `findDue(day: number, lastDay: number, salt: number): boolean`.

- [ ] **Step 1: Write the failing tests** (`tests/companion.test.ts` unless named otherwise)
  - **`'offers a berry to the birds by a bush on a spring day'`:**
    - day 22 at a berry bush at camp at 60 s with 1 berry: `offerFor` is `'bird'`;
    - `applyAction(befriend)`: food is 0, `trust.bird` is 1, and the message is the bird offering line;
    - a second offering the same day: `offerFor` is null (and `offerBlocker` says why);
    - on day 12 (winter): `offerFor` is null.
  - **`'befriends the bird on the fifth day'`:** five offerings on days 22–26 give `friend: 'bird'` and `since: 26`, with the message "A little bird has decided to stay.". After that, `offerFor` is null in every situation.
  - **`'lets the fox take precedence when both could be offered'`:** a day the fox visits, with the fox sitting and the survivor at a bush: `offerFor` is `'fox'`, and the offering raises only `trust.fox`.
  - **`'leaves a ration for the wolves on any winter night, fire lit or not'`:**
    - day 12 at night with fuel 100 and 1 ration: `offerFor` is `'wolf'`;
    - after the offering: `lastWolf` is `{ day: 12, took: 'offered' }`;
    - a tick with the fire at 0 that night takes nothing;
    - `wolfMessage` gives null.
  - **`'never offers from the quarry or with nothing to give'`.**
  - **`'decides finds by the day, at most every third dawn'`:**
    - `findDue(5, 4, 0)` and `findDue(6, 4, 0)` are false;
    - over days 1–400 with `lastDay = day − 3`, the share of true values is between 0.4 and 0.6;
    - the same inputs always give the same answer.
  - **`save.test.ts`:**
    - a version 15 save with a companion round-trips;
    - version 14 is rejected;
    - these are rejected: `friend: 'cat'`, `keepsakes: 7`, a trust above its target with no friend, `pillow: true` with friend `'fox'`, and `cloak: true` with friend `'bird'`;
    - `lastWolf.took` of `'offered'` and `'chased'` both load.
  - **`prompts.test.ts`:** with an offering possible, the prompt contains "O  Leave a berry for the fox".

- [ ] **Step 2: Run them and watch them fail**
  Run: `npx vitest run tests/companion.test.ts tests/save.test.ts tests/prompts.test.ts`
  Expected: FAIL on the missing module, field and action.

- [ ] **Step 3: Implement**
  - Move the fox timing into `wildlife.ts`; `ambient.ts` imports and re-exports it, so the scene code doesn't change.
  - `companion.ts` holds the rules above. The `befriend` handler in `rules.ts` calls them.
  - Bump the save to version 15, add `validCompanion` to the checks, and update the version numbers in the existing save tests.
  - Add `['O', { type: 'befriend' }]` to `KEY_ACTIONS`. When `offerFor` isn't null, `promptFor` adds a segment `O  <prompt>` (on its own when nothing else is nearby).
  - **App:** add a `<button data-action="befriend" id="offer-button" hidden>Offer</button>` among the survivor's quick actions, and `id="dock-offer"` in the dock. Both are hidden whenever `offerBlocker(state)` isn't null, like `dock-cook`.

- [ ] **Step 4: Run them and watch them pass, then run everything**
  Run: `npx vitest run tests/companion.test.ts tests/save.test.ts tests/prompts.test.ts && npm test -- --run && npm run lint && npx tsc --noEmit -p .`
  Expected: all PASS.

- [ ] **Step 5: Commit** "Befriend a bird, the fox or a young wolf with small offerings"

### Task 2: Gifts, shedding, the pillow and the cloak

**Files:**
- Modify:
  - `src/game/companion.ts`
  - `src/game/rules.ts`: dawn, sleep, `warmthChange`, rest, the craft actions and pickup.
  - `src/game/wolves.ts`: `wolfVisit` with a wolf friend.
  - `src/game/news.ts`: add companion news.
  - `src/game/soundscape.ts`: dawn song.
  - `src/ui/panels.ts`: keepsake and craft views.
  - `src/ui/App.ts`
- Test: `tests/companion.test.ts`, `tests/rules.test.ts`, `tests/panels.test.ts`, `tests/soundscape.test.ts`

**Interfaces:**
- Consumes: Task 1's `companion`, `findDue` and `TRUST_TARGET`.
- Produces:
  - At dawn (`dawn()` in rules): if there's a friend, with salt 0 for shedding and salt 50 for the fox berry:
    - **Shedding:** when `findDue(day, lastFind, 0)`, no piece is lying, `keepsakes < 6` and the friend's item isn't made, set `keepsakeLying = true` and `lastFind = day`. When the item is made, `lastFind` still advances on find dawns, which drives the scenery piece.
    - **Fox berry:** when the friend is the fox, `findDue(day, lastGift, 50)` and there's a free bag space, food +1 and `lastGift = day`.
  - `keepsakeKind(friend): 'feather' | 'fur'`.
  - `sceneryKeepsake(state): boolean`, true when the item is made and `lastFind === state.day`.
  - **Pickup**, in `advanceTime`'s step or the `move` handler: when `keepsakeLying` is true and the player is within 1.5 tiles of `(campX, campY)` in the camp area, `keepsakes += 1` and `keepsakeLying = false`.
  - `companionNews(before, after): string | null`, added to `newsBetween`. It covers:
    - the fox berry: "The fox left a berry by your bedroll.";
    - a pickup: "You found a feather by the fire." or "You found a tuft of fur by the fire.";
    - the alarm (below);
    - the chased wolves: "Your wolf saw the others off into the dark.", through `wolfMessage` for `'chased'`.
  - **`wolfVisit`:** with friend `'wolf'`, sets `took: 'chased'` and nothing is removed.
  - **Sleep:** when the friend is the bird, it's a winter night, `alarmDay !== day`, and fuel is above 20, the sleep advances only `(fuel − 20) / coldNightFireBurn` seconds if that's shorter than the time until dawn. Then it sets `alarmDay = day` and gives the message "Your bird woke you. The fire is nearly out." With fuel at or below 20 (but above 0) when lying down, the sleep wakes after 0 seconds once, sets `alarmDay`, and gives the same message.
  - **Actions** `{ type: 'craftPillow' }` and `{ type: 'craftCloak' }`. Each needs to be at camp with the toolshed and 6 keepsakes of the right kind; the pillow also needs the bed. Each sets the flag and resets `keepsakes` to 0. Blockers: `pillowBlocker` and `cloakBlocker`.
  - **Effects:**
    - **Cloak:** a negative `warmthChange` at night is multiplied by 0.75.
    - **Pillow:** in the bed, resting gains `bedRestEnergyGain + 10`, and the hungry-sleep cap is +10.
  - `keepsakeView(state): { shown: boolean; text: string }`, for example "Feathers 3/6". It's hidden with no friend or once the item is made.
  - `pillowView(state)` and `cloakView(state)`, `ActionPanelView`s with `shown`, like `pickaxeView`.
  - **Soundscape:** at dawn in spring (`timeOfDay < 25`) with a bird friend, the bird volume is 0.8 instead of 0.48.

- [ ] **Step 1: Write the failing tests:**
  - **`'chases the wild wolves off when the fire goes out'`:** with a wolf friend on a winter night, ticking the fire to 0 leaves `trailFood` unchanged, `lastWolf.took` is `'chased'`, and the message is the chased line.
  - **`'wakes the sleeper once when the fire burns low on a winter night'`:**
    - a bird friend, day 12, at night, sheltered, fuel 60: the sleep ends that same day with fuel close to 20, and the alarm message shows;
    - sleeping again reaches day 13;
    - with fuel 0: no alarm.
  - **`'brings a berry on a find dawn, and waits when the bag is full'`:**
    - pick a day `d` where `findDue(d, d−3, 50)` is true, with a fox friend and `lastGift: d−3`: crossing dawn into `d` gives food +1 and the fox message;
    - the same with a full bag: food is unchanged and `lastGift` stays `d−3`.
  - **`'sheds one piece at a time, only while it is needed'`:**
    - a find dawn sets `keepsakeLying`;
    - a second find dawn with a piece still lying changes nothing;
    - with `keepsakes: 6`, nothing new lies;
    - with the cloak made, `keepsakeLying` stays false and `sceneryKeepsake` is true that day.
  - **`'picks a keepsake up by the fire'`:** walking within 1.5 tiles of the fire gives `keepsakes` +1, and the found line shows.
  - **`'makes a fur cloak and keeps warmer at night'`:**
    - a fox friend with 6 fur at camp with the toolshed: `craftCloak` sets `cloak` and resets `keepsakes` to 0;
    - a night outdoors loses 0.75 of the usual warmth, in camp and in the quarry.
  - **`'makes a feather pillow that rests deeper'`:**
    - it needs the bed;
    - resting in the bed gains 10 more than without the pillow;
    - a hungry sleep in the bed is capped at `hungrySleepCap + 10`.
  - **`panels.test.ts`:**
    - `keepsakeView` gives "Feathers 3/6" for a bird friend, and is hidden once the item is made;
    - `cloakView.shown` is false with no friend.
  - **`soundscape.test.ts`:** a bird friend at a spring dawn raises the birds layer to 0.8.

- [ ] **Step 2: Run them and watch them fail**
  Run: `npx vitest run tests/companion.test.ts tests/rules.test.ts tests/panels.test.ts tests/soundscape.test.ts`
  Expected: FAIL.

- [ ] **Step 3: Implement** the rules above.
  - **App:** the bag gets a Keepsakes line (`#keepsake-line`, hidden per `keepsakeView`). The Forest tools panel gets `pillow-row` and `cloak-row` (`data-action="craftPillow"` and `"craftCloak"`), shown per the views.

- [ ] **Step 4: Run them and watch them pass, then run everything**
  Run: `npx vitest run tests/companion.test.ts tests/rules.test.ts tests/panels.test.ts tests/soundscape.test.ts && npm test -- --run && npm run lint && npx tsc --noEmit -p .`
  Expected: all PASS.

- [ ] **Step 5: Commit** "Gifts from a friend, and fur and feathers for a cloak or a pillow"

### Task 3: The friend on screen, the fox's nibble, trust signs, the README and a browser check

**Files:**
- Create:
  - `src/scene/companionPose.ts` and `tests/companionPose.test.ts`.
  - A `wolf` sprite in `src/art/wildlifeSprites.ts`: frames `walk0`, `walk1`, `sit` and `lie`, in the existing wildlife style, about the size of the fox.
- Modify:
  - `src/scene/ambientLife.ts`: draw the friend, hide the wild fox when the fox is the friend, the trust signs, and the keepsake piece by the fire.
  - `src/game/wildlife.ts`: the fox pauses at a bush.
  - `src/game/journalEntries.ts`: the fox line.
  - `tests/wildlifeFrames.test.ts`, `tests/ambientLife.test.ts`
  - `README.md`

**Interfaces:**
- Consumes: Tasks 1–2's `companion`, `keepsakeKind` and `sceneryKeepsake`.
- Produces:
  - `companionPose(state, timeMs): { x: number; y: number; frame: string; facing: 1 | -1 } | null`. It's null with no friend.
    - **Away from camp** (the quarry area, or more than `campRadius + 4` tiles from the fire): the friend waits by the fire.
    - **Night:**
      - fox: `sit` by the fire at (campX − 1.2, campY + 0.6);
      - wolf: `lie` at (campX + 1.2, campY + 0.6);
      - bird: perched on the shelter, using the shelter's site position from `BUILDINGS` or the scene's structure spot.
    - **Day:**
      - fox: trots 1.5 tiles behind the player, along the player's facing, and sits when the player is still;
      - wolf: 0.8 tiles to the player's side;
      - bird: perches 1 tile above and ahead, and lands on the shoulder (the player position, a little up) once the player has been still for 3 s. The scene passes a still-time value.
  - `foxAt` gets a nibble pause: for the first 4 s after arriving at the seat it shows `sit` facing the nearest berry bush. The fox journal line becomes "A fox nosed around the berry bushes at dusk."
  - **Trust signs** (scene only):
    - **Fox:** its seat moves 0.3 tiles nearer the fire for each trust point.
    - **Wolf:** with trust above 0 on a winter night, one extra small pair of eyes shows at `WOLF_SPOTS[0]` even with the fire lit.
    - **Bird:** with trust above 0 on a day outside winter, one bird stays perched at its home after the others fly off.

- [ ] **Step 1: Write the failing tests:**
  - **`companionPose.test.ts`:**
    - null with no friend;
    - a fox friend at night gives `sit` near the fire;
    - a wolf friend by day stays within 1 tile of the player;
    - a bird friend still for 3 s sits within 0.5 tiles of the player;
    - a fox friend in the quarry area gives the waiting-at-fire spot.
  - **`wildlifeFrames.test.ts`:** the `wolf` sprite has frames `walk0`, `walk1`, `sit` and `lie`.
  - **`ambientLife.test.ts`:**
    - with a fox friend, the wild fox image never shows during its dusk window;
    - a `companion` image is visible at camp.
  - **`journalEntries.test.ts`:** the fox line now reads "A fox nosed around the berry bushes at dusk."

- [ ] **Step 2: Run them and watch them fail**
  Run: `npx vitest run tests/companionPose.test.ts tests/wildlifeFrames.test.ts tests/ambientLife.test.ts tests/journalEntries.test.ts`
  Expected: FAIL.

- [ ] **Step 3: Implement** the pose helper, the wolf sprite, the drawing in `AmbientLife`, the nibble, the trust signs and the scenery or lying keepsake sprite by the fire (a feather or a tuft; reuse a small existing sprite, or add a 4×3 one).

- [ ] **Step 4: README.** Add a "### A friend at camp" section after the year journal. Hint at the paths ("the birds, the fox and even the winter wolves can come to trust you, if you share what they like to eat"), and cover:
  - one friend at most;
  - each friend's gift, in a line each;
  - fur and feathers for one keepsake item;
  - the O key and the Offer button.

  Also add companions to the tests list.

- [ ] **Step 5: Verify**
  Run: `npm test -- --run && npm run lint && npx tsc --noEmit -p . && npm run build`
  Expected: all pass.

  Then check in the browser at 1280×800 and 390×844, using a version 15 save fixture:
  - the Offer button and prompt appear by a bush on a spring day;
  - a fox friend sits by the fire at night;
  - a wolf friend walks beside the survivor;
  - a bird friend perches;
  - a lying feather shows by the fire;
  - the Keepsakes line and the cloak row show.

- [ ] **Step 6: Commit** "Friends on screen, and the fox shows what it likes to eat"
