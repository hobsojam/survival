# Cook Whenever Fire Is Available

## Intent

Cooking is useful survival work, not an activity reserved for evening. The player can cook every dish during the day or night when its existing fire, location, ingredient, and equipment requirements are met. Stargazing remains an evening activity.

## Approach

Remove the time check from both berry and other-dish cooking blockers. Keep the existing home fireplace fuel rule, which regards banked fuel or wood in store as usable for cooking. Update the camp panel, its hint, daytime prompts, and the player guide so cooking is discoverable by day. Keep stargazing's night restriction and the existing dish order, recipes, and effects.

## Considered

- Restrict only fish to daytime: leaves the same arbitrary wait on other useful meals.
- Add a separate daytime cooking action: duplicates existing controls and recipes.

## Constraints

- No change to fire burn, fireplace banking, dish cost, pot requirements, or food effects.
- Continue to require a usable campfire or home fireplace and the right location.
