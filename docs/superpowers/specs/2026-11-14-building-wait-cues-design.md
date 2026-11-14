# Building wait cues

## Intent

Give players a useful sense of progress during the long wall and hall stretches without speeding up construction or adding chores. The [current pacing check](../../playthrough/2026-11-14-pacing-recon.md) found that the wall visibly rises, but its prompt loses the stone count whenever the bag and cart are empty. At the hall's final stage, the prompt says to weave a hanging but shows neither the hall's progress nor how close the wool basket is to one hanging.

## Goals and constraints

- Keep the existing one-line, nearby action prompt. Do not add a permanent progress panel.
- When stone or a crafted good is missing, show the current count and target for the wall side or hall stage, alongside the next material or place to visit.
- For hall hangings, show the wool already in the basket against the three wool needed to weave one. The sheep panel remains the source of detailed shearing blockers, including the spring rule.
- Keep the current prompts for work that can be done immediately, and preserve existing refusal messages. A shortage cue must not imply that Use will work.
- Show these cues only after the relevant construction site is revealed by normal gameplay. Do not expose intentional secrets or add them to player-facing documentation.
- No changes to saved data, costs, construction time, wool production, or seasons.

## Approaches

1. **Progress and waiting cues in existing prompts (chosen).** Use the site's saved counts and the wool basket to make shortages legible at the place the player is already looking. This is small and leaves the game's pace intact.
2. **Optional activities during waits.** This might make a quiet day more interactive, but would need a separate reward and balance design to avoid chores.
3. **Shorter construction or seasonal waits.** This removes some repetition but changes the game's long, gentle rhythm and is not supported by the current evidence.

## Behavior

- A wall side short of stone says its side and progress, such as `North wall 8/30 · bring stone`. A side with stone retains its current `Lay a wall stone, north side (8/30)` action prompt.
- A hall stage short of its material says the stage count and next source: for example, `Hall beams 2/12 · make oak beams at workshop`. The stone and iron stages follow the same pattern.
- When the hall needs hangings and none are ready, the nearby cue includes the hall count and wool for the next hanging, such as `Hall hangings 0/2 · wool 2/3 · weave at loom`. It updates when wool or completed hangings change. If a hanging is already in the castle's goods, the current `Hang a hall hanging (0/2)` action prompt remains.
- A finished section has no construction prompt. Existing blockers still explain why an attempted action is refused.

The counts are for the current side or stage. They do not estimate the day of completion: stone supply, travel, and shearing readiness vary, so a date would be misleading. The sheep panel already shows wool stock and explains when shearing can be done.

## Verification and limits

- Test shortage and ready prompts for wall and hall stages, including a partially finished wall, changing wool stock, a stored hanging, and a finished section.
- Check the longest cue at desktop and phone widths for clipping or obscuring the scene.
- Run the full test suite, lint, build, and the PR's coverage gate.
- These changes address the gaps seen in sampled current-game stages. The samples used generated saves, not a full human playthrough; a longer player session is still the right way to judge whether other stretches need more work.
