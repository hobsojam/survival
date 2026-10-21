# Cozy Survival: First Playable Design

## Purpose

Build a private, single-player browser game that delivers the small-scale survival experience suggested by the *Tiles Survive!* advertisements. The player directly controls one survivor, gathers supplies, and gradually makes a wilderness campsite feel safe and lived in. This is a personal game: advertising, monetization, competitive play, and a large live-service progression system are outside its purpose.

## First-playable outcome

A player can start a new game, move around one small map, gather wood and food, tend a fire, build a shelter, survive several day/night cycles, and return to the same state after closing and reopening the page. The camp should visibly improve as the player builds. A session of roughly 10–20 minutes should contain meaningful choices about how to spend daylight and supplies.

## Scope

- One fixed, readable 2D wilderness map and one directly controlled survivor.
- Keyboard movement (WASD and arrow keys), a nearby interaction key, and a pointer-operated build menu.
- Gatherable branches and berry bushes. Gathered sources replenish over time, so resources remain renewable.
- Wood, food, carried inventory capacity, energy, hunger, and warmth.
- A fire that consumes wood as fuel; a basic shelter, bed, and storage crate built from gathered materials.
- Day/night cycle. Night increases cold exposure; the fire and shelter mitigate it.
- Local browser save with a visible new-game and continue choice.

Friends, combat, enemies, procedural worlds, weather systems, crafting trees, and mobile controls are later possibilities, not first-playable requirements.

## Player loop and rules

The player leaves camp to gather supplies, returns to manage the fire and food, and spends surplus resources on upgrades. Daylight is limited, so gathering, exploring, and building compete for time. Inventory capacity makes trips back to camp relevant. The shelter and upgrades reduce the effort needed to stay comfortable, giving visible and mechanical progress.

The first version uses gentle survival pressure. Hunger and cold reduce energy or action speed; they do not kill the survivor or erase progress. Eating, resting, and warming by the fire recover the player. If the fire goes out or inventory is empty, the player can still collect renewable supplies and recover. Movement and basic gathering never become permanently unavailable, preventing a soft lock. The exact rates and costs live in data/configuration so playtesting can tune them. Moderate consequences may be added after the core loop proves enjoyable.

## Presentation

The view is a colorful, readable top-down 2D scene. The survivor, gatherable objects, build sites, fire state, and shelter state have distinct silhouettes. Warm light and simple animation make the camp feel more inviting at night. Initial art can use simple original shapes and colors; the interaction and pacing should work before investing in detailed assets.

The interface shows time of day, carried supplies, energy, hunger, warmth, and a contextual interaction prompt. Build options show their costs and whether they are currently available. Feedback appears when resources are collected, spent, or insufficient.

## Technical design

Use Phaser and TypeScript in a browser project. Keep the simulation rules and serializable game state separate from rendering and input. The scene reads state and sends player actions to the rules layer; the rules layer applies costs, time, resource replenishment, and survival effects. Build definitions and balance values are data rather than scattered conditionals. Save the state locally in the browser, with a schema version so incompatible saves can be detected and handled clearly. There is no server or account system.

The game pauses simulation when the browser tab is inactive. On save failure or an unreadable save, show a clear message and allow a new game; do not silently overwrite an unreadable save.

## Verification

The first playable is complete when a player can, without developer commands:

1. Start a new game and learn movement and interaction from on-screen prompts.
2. Gather food and wood, light and refuel the fire, build the shelter, and see the camp change.
3. Play through at least three day/night cycles with choices that affect comfort or building progress.
4. Recover from depleted hunger, energy, or an extinguished fire without resetting the game.
5. Close and reopen the page, continue, and find position, inventory, structures, and time preserved.

Automated checks should cover resource spending, day/night effects, recovery from depleted states, and save serialization. A browser playthrough should check controls, feedback, legibility, pacing, and save/continue behavior.
