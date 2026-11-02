# Hide Completed Build Actions

## Intent

The Build tab should focus on actions the player can still complete. Built structures already disappear; apply that behavior to every other one-time Build action. Keep useful status and instructions in the scene, Bag, Camp, or journal where they belong.

## Scope

- Hide the repaired lookout card.
- Hide crafted axe, pickaxe, cooking pot, woven pack, fishing line, feather pillow, and fur cloak rows. Hide Forest tools when no rows remain.
- Hide completed workshop upgrade rows and the workshop panel when no rows remain.
- Hide completed clearing-side buttons and the Clear the ground action when all sides are complete. Keep a short text summary of cleared ground, including when all ground is cleared.
- Keep locked, blocked, and affordable actions visible according to existing discovery rules. Do not change crafting or clearing behavior.

## Approach

Expose visibility in the existing Build view models and have rendering honor it. Use the existing `shown` pattern where present; add optional `shown` to one-action views. The completed state remains in game state and is not deleted.

## Alternatives

- Leave completed cards disabled: occupies space and obscures the next actions.
- Move every completed card to a separate owned-items panel: adds a second inventory to maintain when scene prompts and current panels already explain tool use.
