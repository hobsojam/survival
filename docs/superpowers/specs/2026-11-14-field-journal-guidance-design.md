# Field journal guidance after the early milestones

## Intent

The field journal's “what next” line should remain useful after the first paths are explored. In a playthrough to the keep, it currently says the player has followed every path for many days while the hills, forge, and keep are still ahead. Give a gentle next lead without telling the player about a place before the game has revealed a way toward it.

## Scope and constraints

- Keep the existing early shelter, cold night, toolshed, lookout, and path hints, including the workshop reminder when its ground is ready.
- Extend the single `nextHint` line in `src/ui/journal.ts`; no new panel or quest checklist.
- Use saved discovery and construction state, so loading a game shows the right hint immediately.
- Never name an undiscovered area or intentional secret. Do not claim that all paths or all work are finished.
- Keep copy invitational rather than an instruction for every material or action.

## Approaches

1. **Milestone sequence on the main route (chosen).** Once the existing path hints are satisfied, point to the quarry's onward route, then ore, a workshop and forge, and finally the keep. It gives a reliable lead and uses progress already saved by the game. It stays deliberately quiet about optional projects.
2. **Choose among all available projects.** Include camp buildings and companions as possible next hints. This could better reflect individual play styles, but it would need a priority system and could make the journal feel like a task list.
3. **Replace only the closing line.** A more open ending would remove the false completion claim, but the hint would stop helping again after the player found the hills.

## Proposed hint behavior

The existing early sequence stays in place. After the three small sites and both camp exits have been explored, the journal checks these later milestones in order:

| State | Next lead |
| --- | --- |
| Hills not visited | Look for the path beyond the old quarry. |
| Hills visited, ore not found | Explore the hills for ore. |
| Ore found, workshop not built | Make room on the east ground for a workshop; if that ground is already clear, build it. |
| Workshop built, forge not added | Add a forge to work the ore. |
| Forge added, keep unfinished | Return to the hills and work on the keep. The keep's own nearby prompts explain stone and door requirements. |
| Keep finished | A quiet, open-ended line about the finished keep and the camp, without claiming all places are found. |

If a player reaches milestones out of order, the hint uses the first unfinished prerequisite on this route. The established workshop hint retains priority once its ground is cleared. The journal continues to hide names for unknown regions in its location list.

## Verification

- Unit tests cover each new hint transition, early hints, out-of-order progress, and no early mention of the hills or keep.
- Run the full test suite, lint, build, and PR coverage gate.
- Review the new player-facing text for accidental secret reveals.
