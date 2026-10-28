# Seasonal Garden Design

## Intent

Give the survivor a calm, long-term camp project that makes the seasons matter between storms. A small garden grows perennial berry bushes through the year and gives the player a reason to come back to camp each autumn.

## Approaches

1. **Add herbs as a new supply.** This could create more cooking choices, but it adds inventory, balance, and UI work unrelated to the first garden loop.
2. **Use existing berries as planting starts.** This reuses the food resource and current seasonal calendar. This is the chosen approach.
3. **Use one large shared harvest.** This is simpler but makes the garden less tangible and less useful as a visible camp upgrade. Use three small plots instead.

## Scope

- Add one optional `Garden` camp structure, costing 4 wood and 2 fiber, through the existing build action.
- The garden has three plots. Planting an empty plot consumes one berry from the player's inventory. Planting is only available in spring, at camp, after the garden is built.
- A planted bush appears as a spring seedling, grows through summer, and becomes harvestable at the first autumn dawn.
- Harvesting a ready plot yields 2 berries. Each plot yields once per autumn. A ready harvest remains available until picked, including through winter; neglect never kills a plant or discards a ready harvest.
- A harvested bush is dormant in winter and begins growing again in spring. It is perennial and needs no new berry after its first planting.
- Planting and harvesting reuse the standard gather time and energy costs. No new resource, meter, or crafting station is added.
- Show plot status and planting/harvest controls in a Garden panel on the Camp tab. Add a visible three-plot garden in camp art, with distinct empty, sprout, growing, fruiting, and dormant plant sprites.
- Add the garden structure flag and plot state to saves. Increment schema version 16 to 17. Older test saves can be discarded rather than migrated.

## Save shape and rules

Each of the three saved plots records `plantedYear`, `harvestedYear`, and `harvestReady`. An unplanted plot cannot be ready or have a harvest year. Planting sets `plantedYear` to the current year. At autumn dawn, each planted plot becomes harvest-ready unless it has already been harvested that year. Harvesting records the current year and clears readiness. Readiness persists across season changes and saves until harvest.

## Non-goals

- Herbs, recipes, new inventory items, irrigation, watering, plant death, crop disease, plot expansion, and animal damage.
- Changing wild berry regrowth, summer berry yield, or the existing survival and cold-front rules.
- New areas, a second garden structure, or a gardening skill tree.

## Balance calls

The four wood and two fiber build cost, three-plot capacity, one-berry planting cost, two-berry harvest, and one-harvest-per-autumn rule are starting values. The design keeps harvest small beside wild summer berries and stores an unpicked harvest instead of making seasonal timing punitive.
