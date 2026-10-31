# Mature Tree Sprites

## Intent

Players should recognize trees that can be chopped before walking close enough to see the prompt. Keep the existing broadleaf and pine identities and seasonal crown colors.

## Approach

Use the existing tree sprites with an extra `mature` frame. Give that frame a visibly thicker trunk and spreading roots. Ordinary terrain trees retain the current `still` frame. Trees marked for clearing use the same mature trunk and roots, with their existing pale fibre band on top. A different crown size or an overlay icon would also separate the targets, but the trunk and roots fit the current pixel art and remain visible across seasons.

## Constraints

- Preserve tree positions, interactions, regrowth, sprite dimensions, anchors, and seasonal palette behavior.
- Keep stumps unchanged.
- Ensure both broadleaf and pine choppable trees have the new shape.
