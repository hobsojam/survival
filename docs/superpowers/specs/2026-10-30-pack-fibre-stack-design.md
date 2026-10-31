# Woven Pack and Fibre Stack Design

## Intent

The storage crate is odd. It's a box you build at camp, yet once it's built your bag holds 16 instead of 8 wherever you go, even in the quarry. A bigger bag should be something the survivor makes and carries. Meanwhile, with the stone pile, the larder and the woodpile, every supply will have a store at camp except fiber.

This design removes the crate, adds a **woven pack** you make at the toolshed, and adds a **fibre stack** where fiber is kept at camp. In real camps, plant fibre was kept dry: bundles were hung under cover, or stacked in a rick with a thatched cap that sheds rain. The user chose the thatched stack.

## Order and dependencies

This is the third project in the batch, after **growing the clearing** (`2026-10-30-clearing-growth-design.md`) and **seasonal foraging, the larder and the woodpile** (`2026-10-30-foraging-larder-design.md`).
- The fibre stack's spot is on the **east near step** of the clearing.
- It follows the same store pattern as the stone pile, the larder and the woodpile. If the foraging project has already made that pattern shared, reuse it.
- **Plan and build this only after the clearing and foraging projects are merged**, so the plan can name the real cleared-step state, zones and store code. That's the agreed order, not a choice.

## Goals

- Carrying capacity comes from something the survivor carries, which they visibly wear.
- Fiber has a store at camp, so gathering it ahead doesn't fill the bag.
- The crate disappears completely: its building, its spot, its sprite and its save field.

## Non-goals

- More than one size of pack, or any other carrying upgrade. *(A later homestead design may add one, such as a pack frame from the workshop.)*
- Fiber spoiling or getting wet, or rain affecting the stack.
- Changing how much space each supply takes (stone stays at 2).
- Save migrations. Old saves are rejected for now (the user is the only player).

## Anti-goals

- **A harder start.** The pack arrives later than the crate did (the crate had no requirement, while the toolshed needs the shelter). That's accepted, but nothing else about the first days may get harder to make up for it.
- **Fiber management becoming a chore.** At camp, builds and crafting just use fiber from the stack, without the player moving it into the bag first.

## The woven pack

- **Made in the Forest tools panel** at camp, once the toolshed is built, for **2 wood and 4 fiber** (a starting value). It takes the standard crafting time and energy for tools. Wood can come from the woodpile and fiber from the stack, bag first, the same as other tools.
- It doesn't need the axe or the cold night. It's made once and kept forever.
- **The bag holds 16 spaces with the pack, 8 without** (`BALANCE.crateCapacity` becomes the pack's capacity).
- The survivor **wears it**: a small woven pack on their back in every pose and direction, drawn in the existing pixel-art style.
- The Bag panel's capacity line reads, for example, "Carried 6 / 16 · woven pack". Without the pack it says the pack can be made at the toolshed.
- One message when it's made, for example "You wove a pack. There's room for twice as much now."

## The fibre stack

- **Built on its spot on the east near step**, once that ground is cleared. It costs **2 wood and 3 fiber** (a starting value), with the standard 12-second build and 6 energy.
- It looks like a small rick of pale bundles under a thatched cap, and gets visibly fuller as it fills (empty, part full, full).
- It holds **12 fiber**, with **Store 1** and **Take 1** beside it in the build list, the same pattern as the stone pile.
- **Anything that spends fiber as a material can use fiber from the stack, from anywhere**: building, clearing the ground, crafting tools and the lookout repair. Bag fiber is used first. This is exactly how stone from the stone pile works today (`availableStone` and `spendStone` in `src/game/rules.ts`), so add an `availableFiber` and `spendFiber` pair shaped the same way. (My call: building materials count from their store wherever you are, as stone already does. Food in the larder is different; see the foraging design.)
- Burn (fiber as kindling) is at the fire anyway, so it can use the stack too, bag first.
- Fiber in the stack doesn't spoil and isn't affected by rain or wolves.
- The year journal and the companion are unaffected.

## Removing the crate

- Remove the crate from `BUILDINGS`, from `CAMP_STRUCTURES` (its spot at (3, 1) is left as open ground), from its art (sprite and site frame), from the build panel's dot logic, and from the README.
- `bagCapacity` reads the pack, not the crate.
- Any copy, hint or tutorial step that mentions the crate points to the pack.

## Save

- Remove `structures.crate`. Add a flag for the pack having been made (alongside the other tool flags), plus `structures.fibreStack` and the amount of fiber stored.
- `SAVE_VERSION` goes up. Old saves are rejected.

## Left to the builder

- Where the pack line sits in the Forest tools panel, and the exact copy
- How the pack is drawn on the survivor, within the palette, and its contact-sheet entries
- The exact fibre-stack spot inside the east near step
- Tests: making the pack (requirements and costs, including from the stores), capacity with and without it, the stack's capacity and Store/Take, every fiber spender using bag fiber first and then the stack, Burn from the stack, the crate's absence, and the save shape
- README: the build list and costs, the bag section, the Forest tools section, and the test list
