# Growing the Clearing Design

## Intent

Over the in-game years, the camp should grow quietly into the survivor's own homestead, and perhaps one day into something like a village or a castle. There are never other people. Today the clearing is a fixed circle 4 tiles across, and every structure has its own spot inside it. It's already full: the garden sits outside it.

This design makes the clearing extendable. The player chooses a side of the camp, chops the marked trees at its edge with the axe, then clears the ground. The clearing grows on that side, and fixed building spots appear on the new ground. It's the foundation for the next projects: the larder and woodpile (from the foraging design), the fibre stack, and then the homestead's house, workshop, well and vegetable beds.

This reverses the shelter-upgrades design's non-goal of no "second building plot, or expandable construction system". That was the user's decision, made deliberately.

## Goals

- The player chooses which side of the clearing to widen. Each side grows in two steps: a near step, then a far step.
- Each step costs only work and materials. There's no time limit and no limit on how many steps per season.
- Each side has its own building spots, so the order the player clears in decides what can be built next.
- The clearing's shape is stored as data (which steps are cleared), so later stages can keep growing it.
- Nights don't change: the fire's warmth reaches no further than it does today.

## Non-goals

- Making the map itself bigger. The homestead fits inside today's 40 × 30 camp map. A bigger map belongs with the village or castle stage.
- The homestead buildings themselves: the house, the workshop, the well and the vegetable beds. This design only sets aside their ground. Each one gets its own design.
- Animal pens, which wait until new areas with wild animals exist.
- Placing buildings freely. The user chose fixed spots.
- Save migrations. The user is the only player for now, so this batch can follow the current rule that old saves are rejected.

## Anti-goals

- **Pressure to expand.** Everything that works in today's camp keeps working for a player who never clears a side. The buildings that come with new ground (the stores, and later the homestead) are the reward for clearing, not something taken from the small camp.
- **Ground cleared halfway.** Only one side can have chopped marked trees without being cleared, so the camp never has several ragged edges.
- **A longer walk to get wood.** Fallen branches stay a short walk from the edge, wherever the edge is.
- **Bigger nights.** The fire's warmth doesn't grow with the clearing.

## The clearing today

- The fire is at tile (20, 15), and the clearing is a circle of radius 4 (`BALANCE.campRadius`).
- Four paths leave diagonally: towards (9, 9), (30, 9), (10, 21) and (30, 21). The west path leaves straight west once the shelter is built.
- Fixed structure spots are offsets from the fire. The shelter is at (−3, −2). `CAMP_STRUCTURES` in `src/scene/visuals.ts` has the crate (3, 1), drying rack (2, −2), windbreak (−2, 2), stone pile (0, −3), toolshed (4, 0) and garden (−6, 3), and the hearth is at (1, 2).
- The places along the paths are 11 to 14 tiles from the fire: the basket, the spring, the cairn and the lookout.

## Sides and steps

The four diagonal paths divide the land around the clearing into four sides: **north, east, south and west**. Each side has two steps.

| Step | How far the clearing reaches on that side (from the fire) |
|---|---|
| Today | 4 tiles |
| Near | about 6.5 tiles |
| Far | about 9 tiles east and west, about 8 north and south (the map is shorter top to bottom) |

The exact outline is up to the builder. It must stay clear of the places along the paths, the lookout and the map's edges. Where a cleared side meets an uncleared one, the edge should step back smoothly to the smaller size. Paths stay as they are and look shorter where they cross cleared ground.

### Clearing a step
1. **Choose a side.** In the Build tab, a "Clear the land" group lists each side's next step, its cost, and what it opens up (for example "North · near: room for the larder"). Choosing one marks that step's edge trees. Each gets a strip of pale fibre tied round it.
2. **Chop the marked trees** with the stone axe: X, or a tap, as with any tree. It uses the existing chop (10 seconds, 8 energy, 2 wood). A marked tree leaves a stump that never grows back.
3. **Clear the ground** once every marked tree is down: one build action (12 seconds, 6 energy, at camp) that pulls the stumps and levels the earth. The new ground joins the clearing, its building frames appear, and the rim stones move out to the new edge.

**Costs (starting values for balance):**

| Step | Marked trees | Clearing the ground |
|---|---:|---|
| Near | 4 | 4 wood, 2 fiber |
| Far | 6 | 6 wood, 3 fiber |

- A side's far step needs its near step first.
- Clearing needs the stone axe, which already needs the cold night and the toolshed.
- **Only one step is in progress at a time.** Before its first marked tree is chopped, the player can switch to another side freely. After that, they finish the step they started. (My call.)

## What happens to the ground

- **Fallen branches stay at the edge.** The branch piles that lie under the trees at the clearing's edge move out to the new edge when a side is cleared, so wood is always a short walk from the clearing on every side.
- **Berry bushes and fiber plants on cleared ground stay** as part of the homestead.
- **Regrowing trees on cleared ground stay too**, as shade trees you can still chop for wood (my call). Only the marked trees disappear for good. Today that means the broadleaves at (17, 9) and (20, 7) on the north side.
- Puddles, flowers and the ambient animals' spots that end up on cleared ground can stay or move; the builder decides, as long as nothing sits on a building spot.

## Building spots

Each spot belongs to one building. Buildings already in camp keep their spots. The garden's existing spot ends up inside the west near step.

| Side | Near step | Far step |
|---|---|---|
| North | **Larder** (close to the shelter) | **House** (future design) |
| East | **Woodpile**, **fibre stack** | **Workshop**, beside the toolshed (future design) |
| West | Around the existing garden: **vegetable beds** (future design) | **Well** (future design) |
| South | Open meadow for now | Open meadow for now |

- These are my calls, because the user's earlier guesses about which side gets what weren't decided. They follow the camp as it is: the shelter faces north, the toolshed is east, and the garden is west.
- A frame appears for a building only once that building is in the game. Until then its ground is just open, cleared land.
- **This project adds no buildings.** The larder and woodpile arrive in the next project (foraging, `2026-10-30-foraging-larder-design.md`, on its own branch), and the fibre stack in the one after (`2026-10-30-pack-fibre-stack-design.md`). When they're added, their frames appear on ground that's already cleared, including in saves that cleared it earlier. So in this project, clearing a step opens empty ground and nothing else.
- **The larder, woodpile and fibre stack therefore need a cleared near step** (my call). That puts them after the cold night and the axe. Before then, food keeps in the bag (3 days for fresh food) and wood stays in the bag, as it does now.
- The south side is left open on purpose, as room for things that aren't designed yet.

## Being "at camp"

Today one circle (`isAtCamp`, radius 4) decides everything. It splits into two:

| Where | What happens there |
|---|---|
| **Anywhere in the clearing** (its current shape) | building and clearing, the stores (stone pile, larder, woodpile, fibre stack), offerings, stargazing, planting and harvesting, and the build circle's checks |
| **Near the fire**: today's 4-tile circle, unchanged | the fire's warmth, the shelter's and windbreak's cold protection, feeding the fire and Burn, cooking and drying rations, resting (R), sleeping (Z), and cold-night survival |

- Sleeping stays where it effectively is today, because the shelter sits inside the fire circle. The house design can move sleeping to the house later.
- Out on the far edges of the homestead at night, you lose warmth the way you would just outside camp today, so it feels like the cold edge of a farmyard.
- Everything that uses `isAtCamp` today (rules, companion, soundscape, prompts, wolves, the forecast) is assigned to one of the two zones above. Where it isn't listed, the builder chooses the zone that keeps today's behaviour for a camp that hasn't grown.

## Look and feel

- The ground, rim stones and grass edge regenerate for the clearing's current shape, in the existing pixel style.
- Marked trees have a visible tie of pale fibre. Stumps on a step in progress stay until the ground is cleared.
- One plain message when a step is cleared. It names only buildings that are in the game and not yet built, for example "The north side is open now. There's room for a larder." Otherwise it just says "The north side is open now." The "Clear the land" labels follow the same rule. And one year-journal line the first time each side's near step is cleared ("Cleared the north side of camp. It felt like home getting bigger."). The builder decides whether each side gets its own line, within the journal's rules.
- The field journal's small map shows the clearing at its current size.

## Save

- New state: which steps are cleared, which step is in progress, and which of its marked trees are down.
- Branch positions and other node positions that move are worked out from the cleared steps, not saved separately (or saved, if that's simpler; it's the builder's choice).
- `SAVE_VERSION` goes up. Old saves are rejected, which is fine for now.

## Left to the builder

- The exact outline of each step, and which trees are marked
- The geometry and how it's represented in code, provided the clearing is described by its cleared steps and can grow further later
- Exact positions of the larder, woodpile and fibre-stack spots inside their steps
- Copy wording, in the tone of the existing messages
- Tests: choosing, switching and finishing a step; marked trees not regrowing; clearing costs and needing the axe; far steps needing near steps; branches moving out; the two zones (warmth unchanged on new ground); spots appearing; save shape; the journal line
- README updates: building, the camp circle, the controls table if a key is added, and the test list
