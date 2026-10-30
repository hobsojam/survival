import { describe, expect, it } from 'vitest';
import { nightStart } from '../src/game/calendar';
import { BALANCE, createGame, type GameState } from '../src/game/state';
import { axeView, bagView, buildButtonView, cloakView, forecastView, gardenPanelView, gardenPlotMarkup, keepsakeView, lookoutView, nightHint, pickaxeView, pillowView, startNote } from '../src/ui/panels';

type Changes = { structures?: Partial<GameState['structures']>; progress?: Partial<GameState['progress']>; inventory?: Partial<GameState['inventory']> };

/** A fresh game with some flags and supplies changed, standing at the fire. */
function game(changes: Changes = {}, extra: Partial<GameState> = {}): GameState {
  const base = createGame();
  return {
    ...base,
    ...extra,
    player: { ...base.player, x: BALANCE.campX, y: BALANCE.campY },
    structures: { ...base.structures, ...changes.structures },
    progress: { ...base.progress, ...changes.progress },
    inventory: { ...base.inventory, ...changes.inventory }
  };
}

const supplies = { wood: 8, fiber: 5, stone: 4 };
const afterColdNight = { hearthUnlocked: true, nextStormDay: null };

describe('garden panel', () => {
  it('shows planting and harvest availability with useful blockers', () => {
    const unbuilt = gardenPanelView(game());
    expect(unbuilt.shown).toBe(false);
    expect(unbuilt.plots[0]).toMatchObject({ label: 'Empty plot', plantDisabled: true, plantTitle: 'Build a garden first.' });

    const spring = gardenPanelView(game({ structures: { garden: true }, inventory: { food: 1 } }, { day: 21 }));
    expect(spring.shown).toBe(true);
    expect(spring.plots[0]).toMatchObject({ label: 'Empty plot', plantDisabled: false, harvestDisabled: true });
    expect(gardenPlotMarkup(spring.plots[0], 0)).not.toContain('data-action="plantGarden" data-plot-index="0" disabled');

    const ready = gardenPanelView(game({ structures: { garden: true }, inventory: { wood: 4, stone: 2 } }, {
      day: 41,
      gardenPlots: [{ plantedYear: 1, harvestedYear: null, harvestReady: true }, ...createGame().gardenPlots.slice(1)]
    }));
    expect(ready.plots[0]).toMatchObject({ label: 'Berries ready to pick', harvestDisabled: true });
    expect(ready.plots[0].harvestTitle).toContain('room');

    const harvestable = gardenPanelView(game({ structures: { garden: true } }, {
      day: 41,
      gardenPlots: [{ plantedYear: 1, harvestedYear: null, harvestReady: true }, ...createGame().gardenPlots.slice(1)]
    }));
    expect(harvestable.plots[0]).toMatchObject({ harvestDisabled: false, harvestTitle: 'Pick 2 berries.' });
    expect(gardenPlotMarkup(harvestable.plots[0], 0)).not.toContain('data-action="harvestGarden" data-plot-index="0" disabled');
  });

  it('renders plot action hints in the button markup', () => {
    const row = gardenPanelView(game({ structures: { garden: true } }, { day: 21 })).plots[0];
    expect(gardenPlotMarkup(row, 0)).toContain('title="You need a berry to plant."');
    expect(gardenPlotMarkup(row, 0)).toContain('title="Those berries are not ready yet."');
  });
});

describe('lookout panel', () => {
  it('waits for the cold night, then asks for repairs, then celebrates', () => {
    expect(lookoutView(game())).toEqual({ title: 'The old lookout',
      copy: 'A damaged lookout waits along the northeast path. Weather the cold night before repairing it.',
      cost: 'Unlocks after the cold night', disabled: true, ready: false });
    expect(lookoutView(game({ progress: afterColdNight }))).toMatchObject({ title: 'Restore the old lookout', cost: '4 wood · 2 fiber · 2 stone', disabled: false, copy: expect.stringMatching(/survey.*areas/i) });
    expect(lookoutView(game({ progress: { ...afterColdNight, lookoutRepaired: true } }))).toMatchObject({ title: 'A place to call home', cost: 'Restored', disabled: true, copy: expect.stringMatching(/journal.*areas/i) });
  });

  it('is ready only beside the lookout with the materials', () => {
    const state = game({ progress: afterColdNight, inventory: supplies });
    expect(lookoutView(state).ready).toBe(false);
    expect(lookoutView({ ...state, player: { ...state.player, x: 30, y: 8 } }).ready).toBe(true);
  });
});

describe('axe panel', () => {
  it('stays locked until the cold night is weathered', () => {
    expect(axeView(game())).toEqual({ title: 'Stone axe', copy: 'Weather the cold night to learn how to make a useful forest tool.',
      cost: 'Unlocks after the cold night', disabled: true, ready: false });
  });

  it('asks for the toolshed, then for materials at camp', () => {
    expect(axeView(game({ progress: afterColdNight, inventory: supplies }))).toMatchObject({ copy: 'Build a toolshed first.', disabled: false, ready: false });
    const shed = game({ progress: afterColdNight, structures: { toolshed: true }, inventory: supplies });
    expect(axeView(shed)).toMatchObject({ title: 'Craft a stone axe', cost: '1 wood · 1 fiber · 1 stone', ready: true });
    expect(axeView({ ...shed, player: { ...shed.player, x: 5, y: 25 } }).ready).toBe(false);
  });

  it('reads as crafted once made', () => {
    expect(axeView(game({ progress: { ...afterColdNight, axeCrafted: true }, structures: { toolshed: true } })))
      .toMatchObject({ title: 'Stone axe ready', cost: 'Crafted', disabled: true, ready: false,
        copy: 'Tap a mature tree, or stand by one and press X, to gather two wood. Stumps regrow after three dawns.' });
  });
});

describe('axe panel in spring', () => {
  it('promises faster regrowth in spring', () => {
    const crafted = { progress: { ...afterColdNight, axeCrafted: true }, structures: { toolshed: true } };
    expect(axeView(game(crafted, { day: 22 })).copy).toBe('Tap a mature tree, or stand by one and press X, to gather two wood. Stumps regrow after two dawns.');
    expect(axeView(game(crafted, { day: 8 })).copy).toMatch(/three dawns\.$/);
  });
});

describe('pickaxe panel', () => {
  it('is hidden until the quarry is found', () => {
    expect(pickaxeView(game())).toMatchObject({ shown: false, disabled: true, ready: false });
  });

  it('explains what is missing, then is ready at camp with the toolshed and materials', () => {
    const found = game({ progress: { quarryFound: true }, structures: { shelter: true }, inventory: supplies });
    expect(pickaxeView(found)).toMatchObject({ shown: true, copy: 'Build a toolshed first.', ready: false, disabled: false });
    expect(pickaxeView({ ...found, structures: { ...found.structures, toolshed: true } }))
      .toMatchObject({ title: 'Craft a pickaxe', copy: 'Your toolshed is ready. Craft a pickaxe to work the quarry face.', cost: '2 wood · 1 fiber · 2 stone', ready: true });
  });

  it('reads as crafted once made', () => {
    expect(pickaxeView(game({ progress: { quarryFound: true, pickaxeCrafted: true }, structures: { shelter: true, toolshed: true } })))
      .toMatchObject({ title: 'Pickaxe ready', cost: 'Crafted', disabled: true, ready: false,
        copy: 'Tap the quarry face, or stand at it and press E, to dig a stone. It is ready again each dawn.' });
  });
});

describe('night hint', () => {
  it('waits for nightfall, then invites the survivor back to camp', () => {
    expect(nightHint(game())).toBe('These small moments are waiting for nightfall.');
    const night = game({}, { timeOfDay: nightStart(1) + 1 });
    expect(nightHint(night)).toBe('Optional comforts while the night passes.');
    expect(nightHint({ ...night, player: { ...night.player, x: 5, y: 25 } })).toBe('Return to the camp circle for a quiet evening.');
  });
});

describe('forecast panel', () => {
  it('names the cold night day ahead of time', () => {
    const view = forecastView(game());
    const day = createGame().progress.nextStormDay;
    expect(view).toMatchObject({ active: false, title: `Cold night · day ${day}`, shelter: '○ Shelter needed' });
    expect(view.copy).toBe(`Build a shelter and bring two logs to camp before nightfall on day ${day}.`);
    expect(forecastView(game({ structures: { shelter: true } })).shelter).toBe('✓ Shelter ready');
  });

  it('asks for enough logs for a longer retry night', () => {
    // The day-9 night lasts 94 s, which burns 188 s of fuel at double rate: two logs (180 s) are not enough.
    const retry = game({}, { day: 7 });
    retry.progress.nextStormDay = 9;
    expect(forecastView(retry).copy).toBe('Build a shelter and bring three logs to camp before nightfall on day 9.');
  });

  it('calls the survivor home while the front is here', () => {
    const day = createGame().progress.nextStormDay!;
    expect(forecastView(game({}, { day, timeOfDay: nightStart(day) + 1 })))
      .toMatchObject({ active: true, title: 'The cold night is here', copy: 'Stay at camp and keep the fire alive until dawn.' });
  });

  it('warns of winter nights once the front is weathered', () => {
    const winter = game({ progress: afterColdNight }, { day: 12 });
    // nightStart(12) is 136, so the night needs (240 - 136) × 2 = 208 s of fire.
    expect(forecastView(winter)).toEqual({ active: false, shown: true, title: 'Winter nights',
      copy: 'Winter nights are bitter. Keep the fire alive until dawn, or the wolves will come close.',
      shelter: '○ Shelter needed', fire: '○ Fire: 0 / 208s for the night · 3 more logs' });
    expect(forecastView({ ...winter, timeOfDay: nightStart(12) + 1 })).toMatchObject({ active: true, title: 'A bitter night' });
  });

  it('counts a fire lit on a winter afternoon toward tonight', () => {
    const afternoon = game({ progress: afterColdNight, inventory: { wood: 2 } }, { day: 12, timeOfDay: 100, fireFuel: 100 });
    // 100 s of fuel less the 36 s until nightfall leaves 64 s; two carried logs reach past 208 s.
    expect(forecastView(afternoon).fire).toBe('○ Fire: 64 / 208s for the night · add carried wood at nightfall');
  });

  it('keeps the cold night card while a front is still pending in winter', () => {
    const pending = game({}, { day: 12 });
    pending.progress.nextStormDay = 12;
    expect(forecastView(pending).title).toBe('Cold night · day 12');
  });

  it('has nothing to forecast once the front is weathered, outside winter', () => {
    expect(forecastView(game({ progress: afterColdNight })).shown).toBe(false);
    expect('weathered' in forecastView(game({ progress: afterColdNight }))).toBe(false);
  });
});

describe('start note', () => {
  it('describes the save waiting, or why there is none', () => {
    const state = createGame();
    expect(startNote({ kind: 'loaded', state: { ...state, day: 4 } }, true)).toBe('Your camp is waiting on day 4.');
    expect(startNote({ kind: 'invalid', reason: 'bad data' }, true)).toBe('Your existing save could not be loaded: bad data');
    expect(startNote({ kind: 'empty' }, true)).toBe('A fresh camp is ready whenever you are.');
    expect(startNote({ kind: 'empty' }, false)).toBe('Browser storage is unavailable, so this camp will not be saved.');
  });
});

describe('bag panel', () => {
  it('counts spaces and describes the fire and trail rations', () => {
    const view = bagView(game({ inventory: { wood: 2, stone: 1 } }, { fireFuel: 12.2 }));
    expect(view).toMatchObject({ spaces: '4/8', fire: 'Fire burning · 13s of warmth', pileShown: false, storedAtCamp: '' });
    expect(view.prepareReady).toBe(false);
    expect(bagView(game()).fire).toBe('The fire is unlit');
  });

  it('shows the stone pile once it is built', () => {
    expect(bagView(game({ structures: { stonePile: true } }, { storedStone: 3 })))
      .toMatchObject({ pileShown: true, storedAtCamp: '+3 at camp', pileStored: 'Stored stone 3/12' });
  });

  it('offers trail rations with a drying rack and a berry at camp', () => {
    const view = bagView(game({ structures: { dryingRack: true }, inventory: { food: 1 } }));
    expect(view).toMatchObject({ prepareReady: true, prepareHint: '1 berry · 12 seconds · 1 ration' });
  });
});

describe('build buttons', () => {
  it('prices a building and marks it ready when affordable at camp', () => {
    expect(buildButtonView(game({ inventory: supplies }), 'shelter')).toEqual({ disabled: false, built: false, locked: false, ready: true,
      description: 'A roof against the night cold', verb: 'Build', price: '6 wood · 2 fiber' });
    expect(buildButtonView(game({ inventory: supplies }), 'crate')).toMatchObject({ price: '4 wood', ready: true });
  });

  it('includes stone in the price, and locks the hearth until the cold night', () => {
    expect(buildButtonView(game(), 'hearth')).toMatchObject({ disabled: true, locked: true, verb: 'Locked', price: 'Weather cold night' });
    expect(buildButtonView(game({ progress: afterColdNight }), 'hearth')).toMatchObject({ verb: 'Build', price: '2 wood · 3 stone', ready: false });
  });

  it('blocks buildings that need the shelter', () => {
    expect(buildButtonView(game(), 'toolshed')).toMatchObject({ disabled: true, locked: true, verb: 'Blocked', description: 'Requires shelter', price: '5 wood · 2 fiber' });
  });

  it('shows built structures as complete', () => {
    expect(buildButtonView(game({ structures: { crate: true } }), 'crate')).toMatchObject({ disabled: true, built: true, locked: false, verb: 'Built', price: 'Complete' });
  });
});

describe('exhaustion in the panels', () => {
  it('shows heavy work as not ready while exhausted', () => {
    const tired = (state: GameState) => ({ ...state, player: { ...state.player, energy: 5 } });
    const shed = game({ progress: { ...afterColdNight, quarryFound: true }, structures: { shelter: true, toolshed: true }, inventory: supplies });
    expect(axeView(tired(shed)).ready).toBe(false);
    expect(pickaxeView(tired(shed)).ready).toBe(false);
    expect(buildButtonView(tired(game({ inventory: supplies })), 'crate').ready).toBe(false);
    const atLookout = { ...shed, player: { ...shed.player, x: 30, y: 8 } };
    expect(lookoutView(tired(atLookout)).ready).toBe(false);
  });

  it('quotes the slower ration time when tired', () => {
    const rack = game({ structures: { dryingRack: true }, inventory: { food: 1 } });
    expect(bagView({ ...rack, player: { ...rack.player, energy: 15 } }).prepareHint).toBe('1 berry · 18 seconds · 1 ration');
  });
});

describe('forecast card visibility', () => {
  it('shows while a cold night is due or in winter, and steps aside otherwise', () => {
    expect(forecastView(game()).shown).toBe(true);
    expect(forecastView(game({ progress: afterColdNight }, { day: 14 })).shown).toBe(true);
    expect(forecastView(game({ progress: afterColdNight }, { day: 24 })).shown).toBe(false);
  });
});

describe('keepsakes and what they make', () => {
  const friend = (friendId: 'bird' | 'fox', changes: Partial<GameState['companion']> = {}): GameState => {
    const state = createGame();
    return { ...state, companion: { ...state.companion, friend: friendId, since: 1, ...changes } };
  };

  it('counts feathers or fur until the item is made', () => {
    expect(keepsakeView(createGame()).shown).toBe(false);
    expect(keepsakeView(friend('bird', { keepsakes: 3 }))).toEqual({ shown: true, text: 'Feathers 3/6' });
    expect(keepsakeView(friend('fox', { keepsakes: 1 }))).toEqual({ shown: true, text: 'Fur 1/6' });
    expect(keepsakeView(friend('fox', { cloak: true })).shown).toBe(false);
  });

  it('shows only the item a friend can give', () => {
    expect(cloakView(createGame()).shown).toBe(false);
    expect(pillowView(createGame()).shown).toBe(false);
    expect([pillowView(friend('bird')).shown, cloakView(friend('bird')).shown]).toEqual([true, false]);
    expect(cloakView(friend('fox')).shown).toBe(true);
    expect(cloakView(friend('fox', { cloak: true }))).toMatchObject({ title: 'Fur cloak', cost: 'Made', disabled: true });
    expect(pillowView(friend('bird', { keepsakes: 2 }))).toMatchObject({ copy: 'Build a toolshed first.', cost: '6 feathers', ready: false });
  });
});
