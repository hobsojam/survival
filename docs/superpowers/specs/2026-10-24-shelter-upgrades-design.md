# Shelter Upgrades Design

## Intent

Let a built shelter grow into a snug woodland cabin through a few visible, optional improvements. The progression gives wood, fiber, and especially stone a continuing use after the first shelter. It stays small in scale and ends at a practical cabin.

## Goals

- Show the shelter changing in clear stages, with a thatched roof, stone details, a small attached extension, and a finished door and shutters.
- Make upgrades feel like lasting camp progress and preserve them across reloads.
- Give the first roof upgrade a modest comfort benefit without changing the cold-front challenge.
- Reuse the existing camp build action, materials, shelter, hearth, save, and pixel-art systems.

## Non-goals

- A large stone house, castle, second building plot, or expandable construction system.
- New resources, meters, crafting stations, or storage behavior.
- Changing the first shelter's cost, bed behavior, stone hearth fuel rate, or cold-front success conditions.
- A new combat, weather, or exploration system.

## Approaches

1. **Replace the shelter with a larger building at each level.** This makes the stages easy to understand but can make the camp's main shelter grow out of scale with the clearing.
2. **Add a short chain of upgrades to the existing shelter.** Each stage changes its exterior while keeping one shelter footprint and reusing the existing build flow. This is the recommended approach and matches the cozy, small-scale camp.
3. **Build separate cabins and utility buildings.** This creates more structures but does not make the shelter itself feel like home.

Use approach 2. Keep the stages sequential and optional. The existing freestanding stone hearth remains a separate camp structure; completing it unlocks the shelter's stonework stage.

## Progression

All upgrades are built at camp through the existing build panel. Each uses the standard 12-second build action and 6 energy cost. Proposed costs are balance starting points; keep each stage's required items within the base eight-slot bag capacity.

| Stage | Proposed cost | Unlock | Visible change | Gameplay effect |
|---|---:|---|---|---|
| Thatched roof | 4 fiber | Shelter built | Straw thatch replaces the plain roof | On ordinary unlit nights at camp, reduce sheltered warmth loss from 0.25 to 0.2 per second. The effect does not apply during a cold front. |
| Stone footing and chimney | 5 stone | Thatched roof and stone hearth built | Add a low stone foundation and a chimney to the shelter | Visual only. The separate hearth continues to provide its existing fuel benefit. |
| Small porch | 3 wood, 3 stone | Stonework complete | Add a shallow attached porch with a simple support post | Visual only; it does not add storage or another rest bonus. |
| Door and shutters | 2 wood, 2 fiber | Porch complete | Finish the cabin entrance and window shutters | Visual completion only. |

The game should describe the next available stage and its cost. A player who has built the shelter but none of these improvements still has a fully usable shelter, including its current sleep behavior.

The thatched roof's warmth improvement applies only when the player is at camp, the fire is out, the shelter is built, and the night is not a cold front. Lit-fire warmth, outdoor warmth, and the cold-front calculation keep their current behavior. The shelter chain does not change the existing requirement to keep the fire burning through dawn.

## State, rules, and saves

- Represent the stages as booleans on the existing structure state, with names that express each completed upgrade. The state must reject impossible combinations where a later stage is built without its prerequisite or without the shelter.
- Each upgrade action checks camp proximity, prerequisite, and materials before spending supplies or time. A blocked action changes nothing.
- Upgrade costs use existing inventory items and must be counted against the current bag capacity. No new inventory field is needed.
- Increment the save schema from version 15 to 16. No legacy migration is needed for these disposable test saves; older versions are rejected and can be replaced by starting a new game.
- Round trips preserve every upgrade. Invalid upgrade flags and impossible stage combinations are rejected without overwriting the save.

## Presentation and art

- Group upgrade options under the shelter in the build panel and show their prerequisites, costs, and built state consistently with other camp improvements.
- Keep one shelter footprint and its current position. Update its scene visual from the upgrade flags; do not add collision or change the camp map coordinates.
- Add pixel sprites for each distinct stage, following the existing 16-pixel grid, palette, outline, lighting, and contact-sheet rules. The porch should read as a small attached feature, not a second room or large house.
- Preserve current structure silhouettes and controls for saves that have not purchased an upgrade.

## Verification criteria

- A new shelter remains usable before and after every upgrade.
- The stages appear in order, cannot be skipped, and spend only their listed materials when built at camp.
- A blocked attempt leaves inventory, time, and energy unchanged.
- The thatched roof changes ordinary sheltered warmth loss only under the stated conditions; a lit fire, an unlit cold-front night, and being outside retain their existing warmth behavior.
- Each upgrade has a distinct scene appearance, persists after reload, and the unupgraded shelter keeps its existing appearance.
- Version 15 and older saves are rejected cleanly so a new test save can be started.
- No upgrade lets the player bypass the cold-front shelter and fire requirements.
- A browser review checks the empty shelter, each intermediate stage, completed cabin, and narrow-screen build panel.

## Builder calls

- Use `structures.hearth` as the prerequisite for the stonework stage; do not build a second functional hearth or change the existing hearth's fuel rate.
- Keep the porch and final door/shutters visual only. The bed, crate, windbreak, and hearth already cover the camp's comfort and utility effects.
- Treat the listed costs and the roof's 0.2 warmth-loss rate as initial balance values to verify during implementation, without changing the progression scope.
