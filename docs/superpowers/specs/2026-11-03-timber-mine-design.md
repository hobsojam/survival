# Timber-supported mine

## Intent

Let a player who has made a pickaxe invest renewable timber in the old quarry for one extra stone each day. The change should be visible at the quarry and usable without leaving it.

## Behavior

- At the quarry face, after crafting a pickaxe, the Build tab offers timber supports for 16 wood and 4 fiber. Stored supplies count; no stone is spent. The button explains location, tool, energy, and material blockers.
- The built mine replaces the quarry work spot with a braced timber sprite. Each day the face has two independent digs, each yielding one stone with the existing 10 second, 8 energy, and bag space rules. Both restore at dawn. Rubble keeps its own three-day cycle.
- Quarry prompts and the Build tab show remaining digs. The upgrade and second dig persist in saves; version 30 saves gain an unbuilt mine and a ready second-dig timer.

## Approaches

Two timer fields keep the original quarry dig behavior intact and add a second daily charge. A single daily counter would require resetting at dawn and migrating the existing ready-day state, so this design uses separate timers. The mine is drawn over the existing work spot to preserve quarry layout and tap targeting.

## Boundaries

The mine does not add a new area or change rubble. It is an upgrade to the worked face and uses existing building time and energy costs.
