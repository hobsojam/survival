# Homestead decoration

## Scope
Add small fixed decorations after the house is built: berry red or leaf green wall paint, flower boxes on the house facade, and three fence sections around the north yard. Keep the natural wall color as the starting appearance. Each choice consumes materials; paint can be changed by paying for a new color. Flower boxes and fence sections are one-time builds. No stone, upkeep, placement tool, collision, or new resource type.

## Costs and interaction
Paint costs 2 berries or 2 greens plus 2 fiber. Flower boxes cost 3 wood and 2 fiber. Each of the three fence sections costs 6 wood and 1 fiber. Actions require the player to be in the clearing, have the house, sufficient energy and materials, then spend standard build time and energy. Show them in the Build tab only once the house exists.

## Persistence and rendering
Store `paint`, `flowerBoxes`, and `fence` in game state. Upgrade existing saves to undecorated defaults and reject malformed decoration data. House sprite frames combine wall color, flower boxes and fireplace light. Fence sections render at fixed spots and leave open access to the house.

## Verification
Test payment, blockers, repeat prevention, paint switching, scene frames, save migration, and invalid saves. Run focused tests, full tests, lint, build. Review for nested ternaries. Rebase on current main, then push and open a PR.
