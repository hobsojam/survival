# More Camp Structures Design

## Outcome

Give the player two more visible goals after the first shelter and crate: a drying rack and a windbreak. Both use renewable wood and offer modest comfort. Neither is required for the cold-night challenge or basic survival.

## Rules and data

- One build-definition table supplies each structure's display name, description, symbol, wood cost, and prerequisite. Existing costs remain shelter 6, bed 4, crate 4, hearth 4. The drying rack costs 4 wood and the windbreak costs 5. Both use the existing 12-second build action and 6-energy cost.
- The drying rack makes a berry cooked at camp after dark restore 50 hunger instead of 35. Cooking still needs one berry and a lit fire, takes 8 seconds, and restores 10 warmth. The rack never consumes extra supplies.
- The windbreak halves warmth loss at camp at night while the fire is out, including during a cold front. It does not affect warmth gain from a lit fire or exposure away from camp.
- Existing building prerequisites remain: bed needs shelter, hearth needs the first cold night weathered. The new structures need no prerequisite beyond their wood cost and presence at camp.

## Presentation

- Both appear in the build panel with costs and readiness, using the common definition table. Each has a distinct empty build site and built silhouette in the current procedural scene. The drying rack stands northeast of the fire; the windbreak stands southwest. Existing node and camp coordinates remain unchanged.
- Add both to the future pixel-art sprite list so the art transition includes them.

## Saves

Save version 3 records the two structure flags. Valid version 1 and 2 saves migrate with the new structures unbuilt. Migration preserves inventory, progress, nodes, meters, and time, and does not rewrite local storage until a normal save. Invalid saves remain unreadable without being overwritten.

## Verification

Rules tests cover construction, costs, cooking benefit, windbreak exposure, and unchanged behavior away from camp or near a lit fire. Save tests cover version 3 round trips and version 1/2 migration. Browser checks cover build controls, visible structures, narrow layout, and continued play.
