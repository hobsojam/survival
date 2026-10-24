# Touch Controls Design

## Intent

Hearthwild is live on GitHub Pages, but a phone can't play it. Movement is keyboard-only, and on narrow screens the sidebar sits below the game, so every action means scrolling. This work makes the game playable as a **casual, one-thumb, portrait phone game**. A player taps where they want to go and what they want to use. The everyday buttons stay under the thumb, and nothing needs careful aim or a held press.

Success means someone opening the link on a phone can play a full day: gather, feed the fire, build, eat, and sleep, without a keyboard and without scrolling the page.

## Goals

- Tap or click in the game to walk there.
- Tap an interactive thing to walk to it and act on it once on arrival.
- A phone-portrait layout where the game fills the screen and the everyday actions sit in a fixed bottom row.
- Desktop play is unchanged: keyboard controls, the sidebar layout, and all existing buttons still work.

## Non-goals

- An on-screen joystick or held-press movement.
- Sound (issue #53), new goals (issue #54), README catch-up (issue #55).
- New game rules, balance changes, or a save format change. `SAVE_VERSION` must not change.
- Pathfinding. The map has no obstacles; `move` only clamps to map bounds, so straight-line walking is enough.

## Anti-goals

These would make the work a failure even if it technically works:

- The tap is ignored. Every tap must give visible feedback: the survivor walks, or a message appears.
- Taps that act at a distance. The survivor always walks into range first, so the game reads the same as keyboard play.
- A desktop regression. Mouse clicks may walk on desktop too, but no desktop layout or keyboard behavior changes.
- Page scrolling or browser zoom while playing on a phone (double-tap zoom, pull-to-refresh, rubber-band scrolling on the game).

## Tap behavior

A tap (or a mouse click) on the game canvas picks a **target**:

| Tapped | Walk until | Then perform |
| --- | --- | --- |
| Branch pile, berry bush, fiber plant, or rock with something left | within `BALANCE.interactionRadius` of it | `gather` on that node |
| Mature tree | within interaction radius | `chopTree` on that tree |
| Basket, spring, or cairn (`SITES`) | within interaction radius | `visitSite` on that site (the spring's rest is how it already works) |
| Lookout (`LOOKOUT`) | within interaction radius | `repairLookout` |
| Campfire | `isAtCamp` is true | `stokeFire` |
| Anything else (open ground, depleted node, structures) | reaching the tapped point (or the map edge, if clamped) | nothing |

Rules:

- **Walking** uses the same `move` action and speed as the keyboard (3.5 tiles/s scaled by `movementFactor`), so low stats still slow you down. The survivor faces and animates the way it does under keyboard walking.
- **The action fires once, on arrival**, through the normal `perform()` path. Gather time, energy cost, bag limits, and blockers are unchanged.
- **If the action can't happen** (no axe, full bag, lookout still locked, missing materials, no wood), the survivor still arrives, and the existing rule message shows. That's how the tap gives its feedback.
- **If the survivor is already in range**, the action fires immediately, without walking.
- **Cancelling:** a new tap replaces the current target. Any movement key press cancels it. Starting another action (button or key) also cancels it, my call, so a walk never fires an action the player has moved on from.
- **Hit testing is forgiving** (my call): an interactive thing counts as tapped if the tap lands on its sprite or within about one tile of its position. When several qualify, the closest to the tap wins. Interactive things beat open ground.
- A small, short-lived marker on the target (a ring or a dot) confirms the tap. Its style is the builder's choice, within the pixel-art direction in `2026-10-21-pixel-art-direction.md`.
- Desktop gets the same behavior on mouse click, since it falls out of the same pointer handling.

## Phone layout

Applies to **narrow portrait screens**. The breakpoint is the builder's choice; the existing 600px breakpoint is the natural starting point. Wider screens keep today's layout exactly.

**Landscape phones and tablets are out of scope** (decided). They keep today's layout, with tap-to-walk and tap-to-act working, and the page may scroll there. "Without scrolling" in the success criterion and anti-goals means portrait phones only.

From top to bottom:

1. **Slim top bar:** brand mark, day dial and label, save status. New game moves into the Camp tab.
2. **The game fills the remaining height.** The page never scrolls. Today the viewport is capped at the 480×300 logical size, which leaves a tall portrait frame letterboxed. On phones, the visible world must grow to fill the frame (a taller viewport in logical pixels, whole-number pixel scaling kept). How is the builder's choice.
3. **Overlaid on the game:**
   - Compact energy, hunger, and warmth meters in the top-left corner.
   - The message line, shown as a short-lived toast.
   - The keyboard prompt and shortcuts strip are hidden on phones.
4. **Bottom panel, always visible:**
   - **Action row:** Eat, Rest, Fire, Sleep, as big thumb-sized buttons with the same enabled and disabled rules as today. At night, when Cook or Stargaze is ready, that button shows in the row (it's the builder's choice whether it replaces a slot or adds one), so the After dark panel isn't needed for those moments.
   - **Tabs:** 🎒 Bag, 🔨 Build, 🌙 Camp. Tapping one slides its panel up over the lower part of the game. Tapping the same tab or the game closes it. Only one panel is open at a time. A tap on the game that closes a panel does **not** also walk (my call).
     - **Bag:** supply counts, carried/capacity, fire status, Drop 1 buttons, Eat ration, Prepare trail ration.
     - **Build:** Little improvements, Craft stone axe, Repair lookout.
     - **Camp:** forecast, lookout story and objective, places found, After dark copy, New game.
   - A tab shows a small dot when something inside is newly possible, such as an affordable build at camp or a craftable axe. The exact triggers are the builder's choice, but they must not dot constantly.

The panels reuse the existing sidebar sections and their update code; they're moved and restyled, not rewritten. Their content and wording stay the same.

## Constraints

- TypeScript, Phaser, and Vite, as the project already uses. No new runtime dependencies.
- Keep game rules pure in `src/game/`. Tap-target selection and arrival checks should be plain functions that can be tested without Phaser, in the style of `survivorVisual.ts` and `pixelScale.ts`.
- `touch-action: none` (or equivalent) on the game, and no double-tap zoom on the controls.
- Buttons are at least 44×44 CSS px on phones.
- `npm run lint`, `npm test -- --run`, and `npm run build` pass.

## Verification

- Unit tests: picking a target from a tap point (each kind, the forgiving radius, closest wins, depleted nodes ignored), arrival detection per kind, and cancellation by a new tap or a key press.
- Browser check at a phone portrait size (for example 390×844) with touch emulation: walk, gather, chop with an axe, feed the fire, visit the spring, build from the Build tab, eat, and sleep, with no page scroll.
- Browser check at desktop size: the layout is unchanged and keyboard play works as before.

## Left to the builder

The marker style, the exact breakpoint, how the portrait viewport is sized (including the scale and how to handle a frame taller than the map), the badge triggers, panel animation, and the placement of Cook and Stargaze in the action row.

Also settled as the builder's calls:

- Cook and Stargaze count as "ready" when `cookBlocker` and `stargazeBlocker` return null, the same rule that sets today's `ready` class.
- Action-row buttons keep today's behavior: they're never disabled, and they fall through to the rule message.
- Stumps and already-searched sites can be treated as targets or as ground, as long as the tap still gives feedback.
- The lookout section may be split between the Camp tab (the story) and the Build tab (the repair button). The "Explore nearby place" button goes wherever fits best on phones; tapping a site already covers it.
