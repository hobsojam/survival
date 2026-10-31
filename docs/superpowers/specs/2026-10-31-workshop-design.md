# Workshop Design: Saw, Handcart, Bed Tools

This is Project 3 of the homestead batch. It settles the choices that `2026-10-31-homestead-buildings-design.md` (Project 3) left to the builder. That design still holds wherever this one is silent.

## Intent

The user's complaint is having to do the same farming every day. Most of that farming is the wood round. Wood does two jobs: it fuels the fire, and it pays for nearly every meaningful build. So the round never ends. The workshop's purpose is to make **one good day of chopping cover several days**, so the player can skip a day or spend wood on building instead of just keeping up.

This follows the batch's rule that a building must never magically remove a need. Trees still have to be felled and stumps still take days to regrow. The workshop only makes each felling and each trip count for more.

## Goals

- Wood is eased first and most. The saw and the handcart are both about wood.
- Each upgrade is made once at the workshop and is felt straight away.
- The bed tools add a smaller comfort for the vegetable beds from Project 2.

## Non-goals

- Metalworking, ore and a forge. These are deferred to the new-areas project.
- Easing stone or food beyond what the bed tools do. *(My call. The user said wood is the main issue. The base design said the handcart could carry stone too, and that's dropped here to keep the handcart to one simple idea.)*
- A draft animal pulling the cart. That's later.
- Save migrations. Bump `SAVE_VERSION` and reject older saves, as now.

## Anti-goals

- A new chore. Nothing here needs tending, and nothing can be lost.
- Wood from nowhere. Every log still comes from a felled tree.
- Clutter. The workshop goes on its reserved ground, and the cart parks beside it.

## The workshop

- A `BUILDINGS` entry `workshop` on `ground: 'east-far'` (already reserved in `CLEARING_STEPS['east-far'].room`), with `prerequisite: 'toolshed'`.
- Cost: **10 wood, 4 fiber, 6 stone**. *(My call. It's a big build, but below the house's 12/6/8.)*
- It's drawn as an open-fronted timber workshop with a workbench, larger than the toolshed, in the existing pixel style.
- Its panel lists the three upgrades. Each shows its cost and a blocker line, following the toolshed's craft pattern (`packBlocker`/`craftPack`). The player must be in the clearing and not exhausted. Costs are paid from the bag first, then the stores, through `payAndBuild`.

## The saw (agreed with the user: double the wood)

- Cost: **3 wood, 3 stone**. *(My call.)*
- With the saw, felling any tree gives **4 wood instead of 2**, including trees marked for clearing. Regrow times are unchanged.
- The felled wood needs room for all of it, in the bag and the cart together. If there isn't room, felling is refused with a plain message, and nothing is lost.
- Copy when made: something like *"You made a saw. A felled tree gives twice the wood now."*

## The handcart (agreed with the user, in outline)

What the user agreed: felled wood goes straight into a cart parked at camp, and one action empties the cart into the wood stores, so the player can fell several trees in a row without walking back each time.

The details are my calls:

- Cost: **8 wood, 2 fiber, 1 stone**.
- The cart holds **12 wood** (`BALANCE.handcartCapacity`). It parks beside the workshop. Its load is shown in art in empty, part-full and full stages, like the other camp stores (`StockLevel`).
- **Felling fills the cart first**, then the bag. Gathering branches and other wood pickups go to the bag as now.
- **Wood in the cart counts as stored wood.** `availableWood` and `spendWood` include it, so builds, the campfire and the self-feeding fireplace can all use it. The order is bag, then cart, then woodpile and woodshed. Unloading matters only to free the cart for more felling. The fireplace currently draws only from `storedWood` (`src/game/home.ts`), so its draw and its fuel estimate need to include the cart.
- **Unload the cart** is one action at the cart. It moves as much as fits into the woodpile, then the woodshed. Anything that doesn't fit stays in the cart, with a message saying the stores are full.
- The fire status line's wood count includes the cart.
- Copy when made: something like *"You built a handcart. Felled wood goes into the cart now."*

## The bed tools

- A hoe and a watering can, made as one upgrade. Cost: **3 wood, 1 stone, 1 fiber**. It requires the vegetable beds. *(My call.)*
- Each threshold in the beds' drying table moves one day later. Dry soil shows from day 3, wilting from day 4 and withering from day 5. A visit every three days is then enough. *(This is the base design's own example.)*
- Rain and drawing water work as now.
- The beds' panel hint mentions the tools once they're made.

## Order in the panel

The saw, then the handcart, then the bed tools. Any upgrade can be made in any order once the workshop stands.

## How the player learns this

- Once the east far ground is cleared, `roomLine` already names the workshop.
- The journal's next-step hint can point to the workshop once the toolshed exists and the east far ground is cleared. *(The builder's call on wording.)*
- Each upgrade's message, plus the panel copy.

## Constraints

As in the base design: TypeScript, Phaser 3, Vite, Vitest and oxlint. Art is drawn in code from the palette. Copy is plain, warm and short, with no exclamation marks. `npm test && npm run lint && npm run build` must pass. The plan includes a browser check of the workshop, the cart's three stages and the panel at desktop size.

## Left to the builder

- Sprite design for the workshop and the cart.
- All copy wording.
- The save fields for the upgrades, for example `progress.sawMade`, `progress.handcartMade`, `progress.bedToolsMade` and `cartWood`.
- Whether the cart's art follows the survivor. The default is that it stays parked.
