import { describe, expect, it } from 'vitest';
import { nightStart } from '../src/game/calendar';
import { BALANCE, BUILDINGS, createGame, type GameState, type StructureId } from '../src/game/state';
import { CLEARING_STEPS } from '../src/game/clearing';
import { BAG_FOODS, bagFoodMarkup, larderMarkup, larderView, axeView, clearingView, bagView, buildButtonView, buildListView, campStoresView, cloakView, foodLaidByDays, forecastView, gardenPanelView, gardenPlotMarkup, keepsakeView, lookoutView, nightDishesView, nightHint, pickaxeView, pillowView, potView, startNote } from '../src/ui/panels';
import { dishBlocker } from '../src/game/cooking';
import { addFood, emptyFood } from '../src/game/food';
import { stock } from './stock';

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

    const spring = gardenPanelView(game({ structures: { garden: true }, inventory: { food: stock(1) } }, { day: 21 }));
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
    expect(nightHint({ ...night, player: { ...night.player, x: 5, y: 25 } })).toBe('Return to the clearing for a quiet evening.');
  });
});

describe('food laid by for winter', () => {
  it('counts the days of hunger the kept food in the bag and the larder would fill', () => {
    expect(foodLaidByDays(game({ inventory: { food: { ...emptyFood(), trailFood: 2, hazelnut: 1 } } }))).toBe(3);
    expect(foodLaidByDays(game({}, { larder: { ...emptyFood(), trailFood: 20 } }))).toBe(10);
  });

  it('counts a fish as the cooked meal it makes', () => {
    expect(foodLaidByDays(game({ inventory: { food: { ...emptyFood(), fish: 2 } } }))).toBe(Math.floor(2 * BALANCE.cookedFishHunger / 30));
  });

  it('counts neither pine needles nor fresh food', () => {
    expect(foodLaidByDays(game({ inventory: { food: { ...emptyFood(), pineNeedles: 40, berry: [9, 9, 9, 9, 9, 9], greens: [9, 9, 9] } } }))).toBe(0);
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
    // The midwinter night burns 182 s of fuel at double rate: two logs (180 s) are not enough.
    const retry = game({}, { day: 7 });
    retry.progress.nextStormDay = 16;
    expect(forecastView(retry).copy).toBe('Build a shelter and bring three logs to camp before nightfall on day 16.');
  });

  it('calls the survivor home while the front is here', () => {
    const day = createGame().progress.nextStormDay!;
    expect(forecastView(game({}, { day, timeOfDay: nightStart(day) + 1 })))
      .toMatchObject({ active: true, title: 'The cold night is here', copy: 'Stay at camp and keep the fire alive until dawn.' });
  });

  it('warns of winter nights once the front is weathered', () => {
    const winter = game({ progress: afterColdNight }, { day: 12 });
    // nightStart(12) is 152, so the night needs (240 - 152) × 2 = 176 s of fire.
    expect(forecastView(winter)).toEqual({ active: false, shown: true, title: 'Winter nights',
      copy: 'Winter nights are bitter. Keep the fire alive until dawn, or the wolves will come close.',
      shelter: '○ Shelter needed', fire: '○ Fire: 0 / 176s for the night · 2 more logs', food: '' });
    expect(forecastView({ ...winter, timeOfDay: nightStart(12) + 1 })).toMatchObject({ active: true, title: 'A bitter night' });
  });

  it('counts a fire lit on a winter afternoon toward tonight', () => {
    const afternoon = game({ progress: afterColdNight, inventory: { wood: 2 } }, { day: 12, timeOfDay: 100, fireFuel: 100 });
    // 100 s of fuel less the 52 s until nightfall leaves 48 s; two carried logs reach past 176 s.
    expect(forecastView(afternoon).fire).toBe('○ Fire: 48 / 176s for the night · add carried wood at nightfall');
  });

  it('keeps the cold night card while a front is still pending in winter', () => {
    const pending = game({}, { day: 12 });
    pending.progress.nextStormDay = 12;
    expect(forecastView(pending).title).toBe('Cold night · day 12');
  });

  it('warns that winter is coming on autumn days 8 to 10 once no cold night is pending', () => {
    for (const day of [8, 9, 10]) {
      const view = forecastView(game({ progress: afterColdNight, inventory: { food: { ...emptyFood(), trailFood: 2, hazelnut: 1 } } }, { day }));
      expect(view).toEqual({ active: false, shown: true, title: 'Winter is coming',
        copy: 'The bushes stay bare all winter. Lay by food that keeps: dry rations and gather hazelnuts. The quiet spring freezes in winter, and a fishing line could see you through.',
        shelter: '', fire: '', food: '○ Food laid by: enough for 3 of 10 days' });
    }
    expect(forecastView(game({ progress: afterColdNight }, { day: 7 })).shown).toBe(false);
    expect(forecastView(game({ progress: afterColdNight }, { day: 38 })).shown).toBe(false);
  });

  it('ticks the food laid by once there is enough for the whole winter', () => {
    const stocked = game({ progress: afterColdNight }, { day: 9, larder: { ...emptyFood(), trailFood: 20 } });
    expect(forecastView(stocked).food).toBe('✓ Food laid by: enough for 10 of 10 days');
  });

  it('counts the larder in the food laid by, wherever the survivor stands', () => {
    const away = game({ progress: afterColdNight }, { day: 9, larder: { ...emptyFood(), roastedHazelnuts: 4 }, area: 'quarry' });
    expect(forecastView(away).food).toBe('○ Food laid by: enough for 6 of 10 days');
  });

  it('adds the food laid by to a cold night card in late autumn, and nowhere else', () => {
    const pending = game({}, { day: 9 });
    pending.progress.nextStormDay = 9;
    expect(forecastView(pending).food).toBe('○ Food laid by: enough for 0 of 10 days');
    const early = game({}, { day: 4 });
    early.progress.nextStormDay = 5;
    expect(forecastView(early).food).toBe('');
    expect(forecastView(game({ progress: afterColdNight }, { day: 12 })).food).toBe('');
  });

  it('lets a pending cold night win over the bare-bushes card', () => {
    const pending = game({}, { day: 9 });
    pending.progress.nextStormDay = 9;
    expect(forecastView(pending).title).toBe('Cold night · day 9');
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
  it('says how many berries go soft at the next dawn', () => {
    const berries = (picked: number[]) => game({ inventory: { food: { ...emptyFood(), berry: picked } } }, { day: 3 });
    expect(bagView(berries([1, 2, 3])).berries).toBe('Berries 3 (1 going soft)');
    expect(bagView(berries([2, 3, 3])).berries).toBe('Berries 3');
  });

  it('says how many greens go soft at the next dawn, in the greens cell', () => {
    const greens = (picked: number[]) => game({ inventory: { food: { ...emptyFood(), greens: picked } } }, { day: 3 });
    expect(bagView(greens([1, 1, 3])).foods.greens).toEqual({ count: 3, shown: true, note: '(2 going soft)' });
    expect(bagView(greens([2, 3])).foods.greens.note).toBe('');
    expect(bagView(greens([1])).foods.hazelnut.note).toBe('');
    const cell = bagFoodMarkup().split('</div>').find(part => part.includes('data-food="greens"'))!;
    expect(cell).toContain('id="greens-note" class="supply-note"');
    expect(bagFoodMarkup()).not.toContain('id="hazelnut-note"');
  });

  it('shows a forage cell only while the bag holds some', () => {
    const food = addFood(addFood(emptyFood(), 'hazelnut', 2, 1), 'greens', 1, 1);
    const { foods } = bagView(game({ inventory: { food } }));
    expect(foods.hazelnut).toEqual({ count: 2, shown: true, note: '' });
    expect(foods.greens).toEqual({ count: 1, shown: true, note: '' });
    expect(foods.honey).toEqual({ count: 0, shown: false, note: '' });
    expect(foods.pineNeedles.shown).toBe(false);
    expect(foods.roastedHazelnuts.shown).toBe(false);
  });

  it('draws each forage cell with its icon, and an Eat button for all but pine needles', () => {
    expect(BAG_FOODS.map(cell => cell.item)).toEqual(['greens', 'hazelnut', 'honey', 'pineNeedles', 'roastedHazelnuts', 'vegetables', 'fish']);
    const markup = bagFoodMarkup();
    for (const { item } of BAG_FOODS) {
      const cell = markup.split('</div>').find(part => part.includes(`data-food="${item}"`))!;
      expect(cell, item).toContain('src="data:image/svg+xml,');
      expect(cell, item).toContain(`id="${item}-count"`);
      expect(cell.includes(`data-action="eat" data-item="${item}"`), item).toBe(item !== 'pineNeedles');
    }
  });

  it('counts spaces and describes the fire and trail rations', () => {
    const view = bagView(game({ inventory: { wood: 2, stone: 1 } }, { fireFuel: 12.2 }));
    expect(view).toMatchObject({ spaces: '4/8', fire: 'Fire burning · 13s of warmth', storedAtCamp: '' });
    expect(view.prepareReady).toBe(false);
    expect(bagView(game()).fire).toBe('The fire is unlit');
  });

  it('shows the stone pile once it is built', () => {
    expect(bagView(game({ structures: { stonePile: true } }, { storedStone: 3 })))
      .toMatchObject({ storedAtCamp: '+3 at camp' });
  });

  it('offers trail rations with a drying rack and a berry at camp', () => {
    const view = bagView(game({ structures: { dryingRack: true }, inventory: { food: stock(1) } }));
    expect(view).toMatchObject({ prepareReady: true, prepareHint: '1 berry · 12 seconds · 1 ration' });
  });
});

describe('build buttons', () => {
  it('prices a building and marks it ready when affordable at camp', () => {
    expect(buildButtonView(game({ inventory: supplies }), 'shelter')).toEqual({ shown: true, disabled: false, built: false, locked: false, ready: true,
      description: 'A roof against the night cold', verb: 'Build', price: '6 wood · 2 fiber' });
    expect(buildButtonView(game({ inventory: supplies }), 'dryingRack')).toMatchObject({ price: '4 wood', ready: true });
  });

  it('includes stone in the price, and locks the hearth until the cold night', () => {
    expect(buildButtonView(game(), 'hearth')).toMatchObject({ disabled: true, locked: true, verb: 'Locked', price: 'Weather cold night' });
    expect(buildButtonView(game({ progress: afterColdNight }), 'hearth')).toMatchObject({ verb: 'Build', price: '2 wood · 3 stone', ready: false });
  });

  it('blocks buildings that need the shelter', () => {
    expect(buildButtonView(game(), 'toolshed')).toMatchObject({ disabled: true, locked: true, verb: 'Blocked', description: 'Requires shelter', price: '5 wood · 2 fiber' });
  });

  it('shows built structures as complete', () => {
    expect(buildButtonView(game({ structures: { dryingRack: true } }), 'dryingRack')).toMatchObject({ disabled: true, built: true, locked: false, verb: 'Built', price: 'Complete' });
  });
});

describe('the build list shows only what can be built', () => {
  const ALL = Object.keys(BUILDINGS) as StructureId[];
  const shownIn = (state: GameState) => ALL.filter(id => buildButtonView(state, id).shown);
  const SHELTER_UPGRADES = ['shelterThatched', 'shelterStonework', 'shelterPorch', 'shelterFinished'] as const;
  const everything = Object.fromEntries(ALL.map(id => [id, true])) as Partial<GameState['structures']>;

  it('on a new game, offers the shelter and the buildings that need nothing first', () => {
    expect(shownIn(game()).sort()).toEqual(['dryingRack', 'garden', 'shelter', 'stonePile', 'windbreak'].sort());
    for (const id of ['bed', 'toolshed', 'hearth', 'larder', 'house', ...SHELTER_UPGRADES] as const) expect(buildButtonView(game(), id).shown, id).toBe(false);
  });

  it('hides what is built or waits on cleared ground, and keeps what is only short of materials', () => {
    expect(buildButtonView(game({ structures: { dryingRack: true } }), 'dryingRack').shown).toBe(false);
    expect(buildButtonView(game({ inventory: supplies }), 'larder').shown).toBe(false);
    const short = buildButtonView(game(), 'dryingRack');
    expect(short).toMatchObject({ shown: true, ready: false });
  });

  it('shows the shelter upgrades heading only while an upgrade is offered', () => {
    expect(buildListView(game()).shelterHeading).toBe(false);
    expect(buildListView(game({ structures: { shelter: true } })).shelterHeading).toBe(true);
    const finished = Object.fromEntries(['shelter', ...SHELTER_UPGRADES].map(id => [id, true]));
    expect(buildListView(game({ structures: finished })).shelterHeading).toBe(false);
  });

  it('says so when there is nothing new to build, and otherwise keeps its usual hint', () => {
    expect(buildListView(game({ structures: everything }))).toEqual({ shelterHeading: false, empty: true,
      hint: 'Nothing new to build for now. Clear more land or explore to find what comes next.' });
    expect(buildListView(game())).toMatchObject({ empty: false, hint: 'In the clearing — click an upgrade to build.' });
    expect(buildListView(game({}, { area: 'quarry' }))).toMatchObject({ empty: false, hint: 'Stand anywhere in the clearing to build.' });
  });
});

describe('the camp stores panel', () => {
  const shownLines = (state: GameState) => campStoresView(state).lines.filter(line => line.shown).map(({ id, text }) => ({ id, text }));
  const FINISHED_SHELTER = { shelter: true, shelterThatched: true, shelterStonework: true, shelterPorch: true, shelterFinished: true };

  it('stays hidden on a new game', () => {
    expect(campStoresView(game()).shown).toBe(false);
  });

  it('shows only the stores that exist', () => {
    const state = game({ structures: { stonePile: true } }, { storedStone: 6 });
    expect(campStoresView(state).shown).toBe(true);
    expect(shownLines(state)).toEqual([{ id: 'stone', text: 'Stone 6/12' }]);
  });

  it('counts the whole wood store, the fibre stack and the cart', () => {
    const base = game({ structures: { ...FINISHED_SHELTER, woodpile: true, house: true, fibreStack: true }, progress: { workshop: { saw: false, handcart: true, bedTools: false } } },
      { storedWood: 20, storedFiber: 5, cartWood: 3 });
    expect(shownLines(base)).toEqual([{ id: 'wood', text: 'Wood 20/36' }, { id: 'fiber', text: 'Fiber 5/12' }, { id: 'cart', text: 'Cart 3/12' }]);
  });

  it('shows for the larder alone, with no store lines', () => {
    const state = game({ structures: { larder: true } });
    expect(campStoresView(state).shown).toBe(true);
    expect(shownLines(state)).toEqual([]);
  });
});

describe('exhaustion in the panels', () => {
  it('shows heavy work as not ready while exhausted', () => {
    const tired = (state: GameState) => ({ ...state, player: { ...state.player, energy: 5 } });
    const shed = game({ progress: { ...afterColdNight, quarryFound: true }, structures: { shelter: true, toolshed: true }, inventory: supplies });
    expect(axeView(tired(shed)).ready).toBe(false);
    expect(pickaxeView(tired(shed)).ready).toBe(false);
    expect(buildButtonView(tired(game({ inventory: supplies })), 'dryingRack').ready).toBe(false);
    const atLookout = { ...shed, player: { ...shed.player, x: 30, y: 8 } };
    expect(lookoutView(tired(atLookout)).ready).toBe(false);
  });

  it('quotes the slower ration time when tired', () => {
    const rack = game({ structures: { dryingRack: true }, inventory: { food: stock(1) } });
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

describe('clearing panel', () => {
  const withAxe = (clearing: Partial<GameState['clearing']> = {}, inventory: Changes['inventory'] = {}) => {
    const base = game({ progress: { axeCrafted: true }, inventory });
    return { ...base, clearing: { ...base.clearing, ...clearing } };
  };

  it('appears once the axe is crafted', () => {
    expect(clearingView(game()).shown).toBe(false);
    expect(clearingView(withAxe()).shown).toBe(true);
  });

  it('lists each side with its next step, its trees and its cost', () => {
    const { sides } = clearingView(withAxe());
    expect(sides.map(side => side.label)).toEqual(['North · near', 'East · near', 'South · near', 'West · near']);
    expect(sides[0]).toMatchObject({ detail: "4 trees, then 4 wood and 2 fiber. There's room for a larder now.", disabled: false, done: false });
    expect(sides[3].detail).toBe("2 trees, then 4 wood and 2 fiber. There's room for vegetable beds now.");
  });

  it('moves a side on to its far step, and marks it cleared when both are done', () => {
    const near = clearingView(withAxe({ cleared: ['north-near'] })).sides[0];
    expect(near.label).toBe('North · far');
    expect(near.detail).toBe(`${CLEARING_STEPS['north-far'].trees.length} trees, then 6 wood and 3 fiber. There's room for a house now.`);
    const done = clearingView(withAxe({ cleared: ['north-near', 'north-far'] })).sides[0];
    expect(done).toMatchObject({ label: 'North · cleared', done: true, disabled: true });
  });

  it('shows the marked side as chosen and locks the others once a tree is down', () => {
    const fresh = clearingView(withAxe({ marked: 'north-near' })).sides;
    expect(fresh[0].chosen).toBe(true);
    expect(fresh.slice(1).every(side => !side.chosen && !side.disabled)).toBe(true);
    const started = clearingView(withAxe({ marked: 'north-near', felled: [0] })).sides;
    expect(started[0]).toMatchObject({ chosen: true, disabled: false });
    expect(started.slice(1).every(side => side.disabled)).toBe(true);
  });

  it('describes the ground to clear and follows the blocker', () => {
    expect(clearingView(withAxe()).clear).toMatchObject({ title: 'Clear the ground', disabled: true, ready: false });
    const three = clearingView(withAxe({ marked: 'north-near', felled: [0] })).clear;
    expect(three.copy).toBe('Fell the 3 marked trees left on the north side.');
    expect(three.disabled).toBe(true);
    expect(clearingView(withAxe({ marked: 'north-near', felled: [0, 1, 2] })).clear.copy).toBe('Fell the 1 marked tree left on the north side.');
    const stocked = { wood: 4, fiber: 2 };
    const ready = clearingView(withAxe({ marked: 'north-near', felled: [0, 1, 2, 3] }, stocked)).clear;
    expect(ready).toMatchObject({ copy: 'Ready to clear the north side.', cost: '4 wood · 2 fiber', disabled: false, ready: true });
  });
});

describe('cooking pot panel', () => {
  it('asks for the toolshed, then is ready with wood and stone at camp, then reads as made', () => {
    expect(potView(game({ inventory: supplies }))).toMatchObject({ title: 'Cooking pot', copy: 'Build a toolshed first.', cost: '1 wood · 2 stone', ready: false });
    const shed = game({ structures: { shelter: true, toolshed: true }, inventory: supplies });
    expect(potView(shed)).toMatchObject({ title: 'Cooking pot', cost: '1 wood · 2 stone', ready: true, disabled: false });
    expect(potView({ ...shed, progress: { ...shed.progress, potCrafted: true } })).toMatchObject({ title: 'Cooking pot', cost: 'Made', disabled: true, ready: false });
  });
});

describe('the pot dishes after dark', () => {
  const night = (potCrafted: boolean) => {
    const base = game({ structures: { shelter: true, toolshed: true }, progress: { potCrafted },
      inventory: { food: addFood(emptyFood(), 'pineNeedles', 1, 1) } });
    return { ...base, timeOfDay: nightStart(1) + 5, fireFuel: 30 };
  };

  it('lists nothing until the pot is made', () => {
    expect(nightDishesView(night(false))).toEqual([]);
  });

  it('lists each pot dish with its blocker', () => {
    const state = night(true);
    const dishes = nightDishesView(state);
    expect(dishes.map(entry => entry.dish)).toEqual(['pineTea', 'salad', 'roastedHazelnuts', 'honeyCake', 'stew']);
    for (const entry of dishes) {
      const blocker = dishBlocker(state, entry.dish);
      expect(entry.disabled, entry.dish).toBe(Boolean(blocker));
      if (blocker) expect(entry.title).toBe(blocker);
      expect(entry.icon).toMatch(/^data:image\//);
    }
    expect(dishes[0]).toMatchObject({ name: 'Pine needle tea', disabled: false });
    expect(dishes[1]).toMatchObject({ disabled: true, title: 'You need 1 greens and 1 berry for greens and berry salad.' });
  });
});

describe('eating from the bag panel with a larder', () => {
  const north = { cleared: ['north-near' as const], marked: null, felled: [] };
  const kept = addFood(addFood(stock(1, 1), 'hazelnut', 2, 1), 'pineNeedles', 1, 1);
  const atCamp = game({ structures: { larder: true } }, { clearing: north, larder: kept });

  it('enables Eat for food within reach, the larder included in the clearing', () => {
    const view = bagView(atCamp);
    expect(view.eatable).toEqual({ berry: true, trailFood: true, greens: false, hazelnut: true, honey: false, roastedHazelnuts: false, vegetables: false, fish: false });
    expect(view.foods.hazelnut).toEqual({ count: 0, shown: true, note: '' });
    expect(view.foods.pineNeedles.shown).toBe(false);
  });

  it('follows the bag alone away from camp', () => {
    const away = { ...atCamp, player: { ...atCamp.player, x: 5, y: 5 }, inventory: { ...atCamp.inventory, food: addFood(emptyFood(), 'honey', 1, 1) } };
    const view = bagView(away);
    expect(view.eatable).toEqual({ berry: false, trailFood: false, greens: false, hazelnut: false, honey: true, roastedHazelnuts: false, vegetables: false, fish: false });
    expect(view.foods.hazelnut.shown).toBe(false);
  });
});

describe('larder controls', () => {
  const north = { cleared: ['north-near' as const], marked: null, felled: [] };
  const stocked = (built: boolean, bag = emptyFood(), larder = emptyFood()) =>
    game({ structures: { larder: built }, inventory: { food: bag } }, { clearing: north, larder });

  it('is hidden until the larder is built', () => {
    expect(larderView(stocked(false)).shown).toBe(false);
    expect(larderView(stocked(true))).toMatchObject({ shown: true, stored: 'Stored food 0/10', rows: [] });
  });

  it('shows a row for each item in the bag or the larder, with what each button would do', () => {
    const view = larderView(stocked(true, stock(2), addFood(emptyFood(), 'honey', 3, 1)));
    expect(view.stored).toBe('Stored food 3/10');
    expect(view.rows).toEqual([
      { item: 'berry', label: 'Berries', kept: 0, storeDisabled: false, storeTitle: 'Store 1 berry.', takeDisabled: true, takeTitle: 'The larder has no berries.' },
      { item: 'honey', label: 'Honey', kept: 3, storeDisabled: true, storeTitle: 'You have no honey to store.', takeDisabled: false, takeTitle: 'Take 1 honey.' }
    ]);
  });

  it('greys out both ways away from camp', () => {
    const away = { ...stocked(true, stock(1), stock(1)), player: { ...createGame().player, x: 5, y: 5 } };
    expect(larderView(away).rows[0]).toMatchObject({ storeDisabled: true, takeDisabled: true, storeTitle: 'Return to camp to use the larder.' });
  });

  it('draws a hidden row with Store 1 and Take 1 for every food', () => {
    const markup = larderMarkup();
    expect(markup).toContain('id="larder-controls"');
    expect(markup).toContain('id="larder-stored">Stored food 0/10');
    for (const item of ['berry', 'greens', 'hazelnut', 'honey', 'pineNeedles', 'roastedHazelnuts', 'trailFood', 'vegetables']) {
      expect(markup).toContain(`data-action="storeFood" data-item="${item}"`);
      expect(markup).toContain(`data-action="takeFood" data-item="${item}"`);
      expect(markup).toContain(`data-larder-item="${item}" hidden`);
    }
  });

  it('blocks the larder\'s build button until the north side\'s near ground is cleared', () => {
    expect(buildButtonView(game({ inventory: supplies }), 'larder')).toMatchObject({ disabled: true, locked: true, verb: 'Blocked', description: "Clear the north side's near ground first", price: '5 wood · 2 fiber · 2 stone' });
    expect(buildButtonView(game({ inventory: supplies }, { clearing: north }), 'larder')).toMatchObject({ disabled: false, ready: true, verb: 'Build', description: 'Keep up to 10 food raised off the ground' });
  });
});
