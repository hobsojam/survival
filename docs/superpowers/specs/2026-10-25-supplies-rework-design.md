# Supplies Rework Design

## Intent

The **Drop 1** buttons delete an item outright, which the word "drop" doesn't suggest. Picked berries lying on the ground would also make little sense. The fix is to remove dropping as a general action and give every supply a natural way out of the bag. Berries and rations get eaten. Wood and fiber go on the fire.

Stone is the special case. It should feel heavy and scarce. Rocks stop regrowing like berries, stone takes more room in the bag, and setting stone down leaves it on the ground where you stood. A stone pile built at camp gives stone a tidy home without being free storage.

This is the first of two projects. The second, designed separately later, adds an area that opens once the shelter is built. That area contains a quarry, which unlocks a pickaxe and then gives 1 stone a day. Nothing here depends on it.

## Goals

- No supply can be destroyed for nothing. Each supply's bag button is the action that suits it.
- Stone is heavy (2 bag spaces) and finite until the quarry exists (rocks give stone once).
- Stone set down in the field stays where it was dropped and can be picked up again.
- A wood-built stone pile at camp stores stone outside the bag, and builds can use it.
- The critical path stays intact: shelter, then surviving the cold night on day 3, then the hearth, axe, and lookout. All of it still fits the starting 8-space bag.

## Non-goals

- The second area, the quarry, and the pickaxe (the next project).
- New uses for stone beyond today's hearth, axe, and lookout.
- Migrating old saves. None exist that matter (decided). A save from an earlier version shows the existing "could not be loaded" message, and the player starts fresh.

## Anti-goals

- Turning stone into a chore of ferrying one at a time. That's why stone takes 2 spaces instead of being limited to one carried stone.
- Map clutter from many overlapping stone piles.
- The stone pile becoming a free second crate. It costs wood, holds only stone, and has a cap.
- Fiber you're saving for a build burning by accident.

## Rules

### Bag and buttons

The bag still holds 8 spaces at first and 16 with the crate. Every supply takes 1 space except **stone, which takes 2**. The bag's "Carried" count shows spaces used, so one stone and two wood reads 4/8. Gathering or picking up stone needs 2 free spaces.

Each supply's **Drop 1** button is replaced by the action below. It keeps its place and size, including in the phone Bag sheet.

| Supply | Button | Effect |
| --- | --- | --- |
| Wood | **Burn** | The same as Feed fire: at camp only, adds one log's worth of fire time (90 s, or 150 s with the hearth). |
| Berries | **Eat** | The same as Eat berries. |
| Fiber | **Burn** | At camp only, adds `fiberFireSeconds` = **30 s** of fire time, the same with or without the hearth (my call). |
| Stone | **Drop** | Leaves one stone on the ground at the survivor's position (see below). Works anywhere. |
| Rations | **Eat** | The same as Eat ration. |

The **Fire** / Feed fire action, the F key, and tapping the campfire still burn **wood only**. Fiber burns only through its own button. The cold-front forecast and its "logs needed" hint count wood only and ignore fiber (my call), because it's a minor top-up.

The full-bag message no longer mentions dropping. For example: "Your bag is full. Eat, burn, or set something down at camp to make room."

### Rocks

Each rock gives **1 stone, once**. After that it stays as pebbles permanently and never refills at dawn. Branches, berries, and fiber keep refilling at dawn as now. With 6 rocks and the cairn's 2, the game holds 8 stone in total. Today's uses need 6: the hearth 3, the axe 1, and the lookout 2.

### Stone on the ground

- **Drop** puts one stone at the survivor's position. If a loose-stone pile is within **1 tile**, the stone joins it. Otherwise it starts a new pile. A pile shows its count, for example a small stone sprite with ×3. Piles never fade or disappear on their own.
- **Picking up** takes one stone from a pile. Stand within reach (the usual 2-tile interaction radius) and press E, tap the pile, or use the prompt. It needs 2 free bag spaces. It takes **2 seconds and no energy** (my call), and a pile reaching zero disappears.
- Loose piles are interactive targets like nodes. E picks the nearest gatherable thing, which includes loose piles. Tap-to-walk walks to a pile and picks up one stone.
- Piles are saved.

### The stone pile structure

- A new entry under Little improvements: the **Stone pile**. It costs **3 wood**, with no stone and no prerequisite (it mustn't need stone to store stone). It's built like other structures, inside the camp circle, taking 12 s and 6 energy, and adds a visible structure at its own camp site.
- It holds up to **12 stone**, which doesn't count against the bag.
- While at camp, the player can **Store 1 stone** (bag to pile) and **Take 1 stone** (pile to bag, needs 2 free spaces). These buttons sit in the stone pile's sidebar entry, or a small panel beside it (the builder chooses the placement). They're instant.
- **Builds and crafts that need stone** (the hearth, the stone axe, and the lookout repair) count bag stone plus pile stone. They spend bag stone first, then the pile. The lookout counts the camp pile even though it's far from camp (decided). Their buttons, ready states, and cost hints treat combined stone as available.
- On phones, the pile's controls live in the Build sheet next to its build entry. The Bag sheet shows the pile's count beside the stone count when it exists (my call).

### Cost check with stone at 2 spaces

| Build | Cost | Spaces carried | Fits 8? |
| --- | --- | --- | --- |
| Shelter | 6 wood, 2 fiber | 8 | yes |
| Bed / crate / drying rack / windbreak / stone pile | wood (+1 fiber for the bed) | 3–5 | yes |
| Stone axe | 1 wood, 1 fiber, 1 stone | 4 | yes |
| Hearth | 2 wood, 3 stone | 8, or fewer using the pile | yes |
| Lookout | 4 wood, 2 fiber, 2 stone | 6 + 4, or 6 using the pile | yes, with the pile |

## Save

Bump `SAVE_VERSION` and persist:

- Loose stone piles: position and count.
- The stone pile structure.
- Its stored stone.
- Rocks staying empty.

Earlier versions are rejected (decided). The README rule about one open save-format PR at a time applies: rebase on `main` and take the next unused version before merging.

## Constraints

- Keep the rules pure in `src/game/` with Vitest coverage, following existing patterns (`applyAction`, `BALANCE`, `buildStatus`).
- Keep the phone layout and tap controls working. Bag buttons are at least 44 px tall on phones, and the new targets work with `pickTapTarget`.
- Pixel art follows `docs/superpowers/specs/2026-10-21-pixel-art-direction.md`: loose stones, the stone-pile structure, and its build-site frame.
- Text contrast meets WCAG AA (4.5:1), matching the recent contrast fix.
- `npm run lint`, `npm test -- --run`, and `npm run build` pass. Update the README's controls, bag, building, and saving sections.

## Verification

- **Unit tests:**
  - Stone takes 2 spaces in capacity checks, including gather, pickup, take, and the basket/cairn finds.
  - Fiber burns for 30 s at camp only. Wood keeps its log values. Fire/F/campfire taps never burn fiber.
  - Rocks don't refill at dawn, while other nodes still do.
  - Drop creates a pile or merges into one within 1 tile. Pickup removes a stone and the pile at zero.
  - Building, storing, taking, and the 12 cap for the stone pile.
  - Combined stone for the hearth, axe, and lookout, with bag stone spent first.
  - Old save versions are rejected, and the new version round-trips.
- **Browser check (desktop and a 390×844 phone):**
  - Drop a stone in the field, walk away, come back, and tap to pick it up.
  - Build the stone pile, store stone, and repair the lookout using pile stone.
  - Burn fiber at camp.
  - Confirm no Drop 1 buttons remain except stone's.

## Left to the builder

- Sprite designs, the pile count label, and the stone pile's camp site location. The loose-stone sprite must read clearly differently from the `pebbles0` frame that emptied rocks already use, so nobody tries to pick up stone from a spent rock (my call).
- The cairn's two-stone find now needs 4 free spaces. This follows from stone taking 2, and its message should say so.
- Fiber burned late on the cold night can keep the fire alive through dawn, which counts as weathering the front. That's accepted as a small, fair top-up (my call).
- Removing the now-dead save migrations for versions 1 to 9 is the builder's choice.
- Exact copy for the new messages and prompts.
- Where the Store and Take buttons sit on desktop.
