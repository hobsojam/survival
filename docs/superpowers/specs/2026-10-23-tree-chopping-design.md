# Tree Chopping Design

After weathering a cold front, the player may craft a stone axe at camp for 1 wood, 1 fiber, and 1 stone. Six existing mature trees become renewable chop targets; the remaining forest stays scenery. A nearby chop target can be cut with X. Chopping costs 8 energy and 10 seconds and yields 2 wood, requiring two free bag slots. A chopped tree becomes a stump and regrows at the start of the third following day. Fallen branches keep replenishing each dawn.

The tool card communicates its unlock, cost, and craft action. Nearby prompts identify valid trees and the X key. Chopped trees stay stumps across reloads. Save version 8 adds the axe and fixed tree-node state, migrating all older saves. Tests cover costs, capacity, repeat chopping, regrowth, migration, and dynamic tree art.
