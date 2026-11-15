# Rest Until Dusk Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace repeated daytime Rest presses with one home action that reaches nightfall or stops for an urgent event, while showing its likely survival cost beforehand.

**Architecture:** Extract the existing Rest recovery into a duration-aware helper in `rules.ts`. A focused `restUntilDusk.ts` module runs short portions of that same recovery, collects notices, and exposes a pure forecast from a copied state. The scene owns the action entry point; the Camp Moments panel owns the preview and button.

**Tech Stack:** TypeScript, Phaser, Vite, Vitest, existing CSS.

**Spec:** `docs/superpowers/specs/2026-11-15-rest-until-dusk-design.md`

## Global Constraints

- End at `nightStart(day)`, where Sleep becomes available; never cross dawn.
- Match ordinary Rest recovery, hunger, warmth, fire, weather, sickness, and time costs. Full 20-second portions get full recovery; a shorter final portion gets proportional recovery. Consume a honey-cake bonus once.
- Require a shelter and the same home position as Rest; leave ordinary Rest and Sleep untouched for players.
- Preview costs from a copy of state, with no save schema or dependency change. No keyboard shortcut, clock speed, or season change.
- Show both the action and its preview in Camp Moments on desktop and phone. No nested ternaries in changed TypeScript.
- Keep secret features out of player-facing documentation.

## Review Focus

1. A start less than one Rest duration before nightfall must stop exactly at nightfall and grant only proportional recovery — Task 1 test.
2. A cold or hungry survivor must see an interruption before silent collapse, with state and message preserved — Task 1 test.
3. A short visit that begins during a rest (fox or market trader) must not vanish in one click — Task 1 test.
4. Forecasting must not mutate the live state, even when fire, sickness, or visitor state changes — Task 2 test.
5. The preview and action must fit a 390-pixel phone Camp sheet without horizontal overflow — Task 3 browser check.

---

### Task 1: Game action and interruption rules

**Files:**
- Modify: `src/game/rules.ts` (existing Rest handler and an exported duration-aware helper)
- Create: `src/game/restUntilDusk.ts` (blocker, action loop, interruption predicate)
- Create: `tests/restUntilDusk.test.ts`
- Modify: `tests/rules.test.ts` (existing Rest behavior after helper extraction)

**Interfaces:**
- Produces: `restFor(state: GameState, seconds: number): ActionResult` in `rules.ts`, with the current 20-second Rest handler delegating to it.
- Produces: `restUntilDuskBlocker(state: GameState): string | null` and `restUntilDusk(state: GameState): LongRestResult` in `restUntilDusk.ts`, where `LongRestResult` has `state`, `message`, ordered `notices`, and `stop: 'blocked' | 'nightfall' | 'event' | 'need' | 'ending'`.
- Consumes: `advanceTime`, `recovery`, `markWarmRest`, `newsBetween`, `nightStart`, `isAtHome`, and existing visitor/weather helpers. The module must not import the scene or UI.

- [ ] **Step 1: Write failing tests.** Assert a sheltered home at `nightStart(12) - 5` ends at nightfall with `5/20` of normal Rest recovery; an ordinary winter day matches repeated Rest for hunger, warmth, fuel, and full-portion energy; night/away/no shelter are blocked without mutation; low hunger or extinguishing fire stops early; rain onset, fox arrival, and a trader arrival stop while the visit remains possible; sickness rest care and ordered messages survive an interruption. Keep test states independently constructed so shared nested objects cannot leak between tests.
- [ ] **Step 2: Run red tests.** `npx vitest run tests/restUntilDusk.test.ts tests/rules.test.ts --testTimeout 15000` must fail for the missing feature, not an unrelated setup error.
- [ ] **Step 3: Implement the minimal rule layer.** Preserve the old Rest outcome for exactly 20 seconds. Advance long rest in portions no longer than 20 game seconds, checking transitions at a finer boundary where a short visitor can appear. Stop at the first event/need/nightfall; use `BALANCE.lowNeed` (20) for hunger and warmth, and zero for home fire fuel; aggregate routine notices. Keep `newsBetween` and journal effects for each elapsed portion, rather than treating the entire interval as one action. A currently present visitor is a preview warning, not an automatic blocker.
- [ ] **Step 4: Run green tests.** Run the same focused command and inspect every failure; then `git diff --check`.
- [ ] **Step 5: Commit.** `git add src/game/rules.ts src/game/restUntilDusk.ts tests/restUntilDusk.test.ts tests/rules.test.ts && git commit -m 'feat: add rest until dusk game rules'`.

### Task 2: Cost preview

**Files:**
- Modify: `src/game/restUntilDusk.ts` (pure forecast from a cloned state)
- Modify: `tests/restUntilDusk.test.ts`
- Modify: `src/ui/panels.ts` (format the player-facing preview)
- Modify: `tests/panels.test.ts`

**Interfaces:**
- Produces: `restUntilDuskPreview(state: GameState): LongRestPreview` as `{ seconds: number; hunger: number; warmth: number; fuel: number; warning: string | null; visitorWarning: boolean }`. It simulates to nightfall without event interruption on a separate copy; actual action may stop earlier.
- Produces: `restUntilDuskView(state: GameState): { disabled: boolean; title: string; preview: string }` in `panels.ts` for the Camp Moments card.

- [ ] **Step 1: Write failing tests.** Assert the preview endpoint matches the action on an uneventful day; the original state is deeply unchanged; warning text names projected low hunger/fire or active visitor; the view says the result is conditional and explains night/away/no-shelter blockers.
- [ ] **Step 2: Run red tests.** `npx vitest run tests/restUntilDusk.test.ts tests/panels.test.ts --testTimeout 15000` fails for the missing preview/view.
- [ ] **Step 3: Implement preview and view.** Reuse Task 1 progression on `structuredClone(state)` with interruption checks disabled. Do not perform an unbounded full-day simulation every HUD frame: memoize or throttle the preview when only fractional clock time changes. Keep copy concise for a narrow phone view.
- [ ] **Step 4: Run green tests and check diff.** Run the focused command and `git diff --check`.
- [ ] **Step 5: Commit.** `git add src/game/restUntilDusk.ts src/ui/panels.ts tests/restUntilDusk.test.ts tests/panels.test.ts && git commit -m 'feat: preview rest until dusk costs'`.

### Task 3: Player controls and presentation

**Files:**
- Modify: `src/scene/GameScene.ts` (public `performRestUntilDusk(): void`, using the same pause/replay/fade guard as `perform`)
- Modify: `src/ui/App.ts` (Camp Moments button, dynamic preview and disabled reason, click wiring)
- Modify: `src/style.css` (compact card and phone layout)
- Test: `tests/panels.test.ts` and browser interaction at desktop and 390-pixel phone widths

**Interfaces:**
- Consumes: `restUntilDusk()` and `restUntilDuskView()` from Tasks 1–2.
- Produces: an always-visible Camp Moments preview next to one **Rest until dusk** button when the Camp tab is open. `GameScene.performRestUntilDusk()` updates state once, announces the ordered notices, then refreshes the HUD.

- [ ] **Step 1: Record a red browser interaction check** on the current UI: the Camp Moments control is absent, while ordinary Rest and Sleep are present. Keep the browser recipe for the green check.
- [ ] **Step 2: Confirm the red check** fails only because the new control is absent, not because the local game cannot run.
- [ ] **Step 3: Wire the control and style it.** Render a disabled reason when blocked, keep the forecast visible before the click, and preserve phone sheet behavior. Do not add a second confirmation click.
- [ ] **Step 4: Verify.** Run focused tests, `npx vitest run --testTimeout 15000`, `npx vitest run --coverage --coverage.reporter=json-summary --testTimeout 15000`, `npm run lint`, `npm run build`, and `git diff --check`. Check actual use in desktop and 390-pixel phone browser views, including no horizontal overflow and a cold/low-food warning. Review changed TypeScript for nested ternaries. The mutation report is unnecessary unless `src/game/food.ts` changes, since current Stryker targets that file only.
- [ ] **Step 5: Commit.** `git add src/scene/GameScene.ts src/ui/App.ts src/style.css tests/restUntilDusk.test.ts && git commit -m 'feat: offer rest until dusk at camp'`.

## Completion

Request whole-branch code review, resolve findings, rerun relevant verification, and open a PR referencing #171. Keep #171 open until human playtesting confirms the broader pacing benefit.
