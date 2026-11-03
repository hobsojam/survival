# Storehouse and pine needles

## Intent
Give the existing larder a single meaningful capacity upgrade, and let players clear pine needles from the bag even when tea cannot be made. Finish the mine Build panel presentation.

## Design
- Storehouse is a fixed upgrade of the larder at its existing spot: 8 wood and 3 fiber, no stone, no upkeep. It adds 20 food spaces to the larder's 10. The existing larder rules for freshness and access remain.
- The Build tab offers Storehouse after Larder. The camp sprite shows a larger raised store at the same spot. Saved games gain an unbuilt Storehouse flag through one versioned migration.
- Pine needles can feed the fire at camp for a short burn and can be discarded one bunch at a time anywhere from the Bag. Discard is available even with a full bag. Tea remains available with a pot and a usable fire.
- The mine button uses the same styles as other tool rows; its panel disappears after construction.

## Verification
Test upgrade cost/capacity, save migration and bounds, sprite selection, pine needle fire and discard behavior, full-bag escape, mine visibility. Run full tests, lint, build, and review changed JavaScript and TypeScript for nested ternaries.
