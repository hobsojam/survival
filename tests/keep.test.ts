import { describe, expect, it } from 'vitest';
import { STEP_IDS, placeBranches } from '../src/game/clearing';
import { KEEP_DOOR_AT, KEEP_SITE, KEEP_STONES, hangDoorBlocker, inKeep, layStoneBlocker, keepFinished, keepNeedsDoor, keepOpen, withKeepDoor, type KeepState } from '../src/game/keep';
import { HILLS_EXIT } from '../src/game/hills';
import { isAtHome } from '../src/game/home';
import { alarmAfter } from '../src/game/companion';
import { isWarmRestHere } from '../src/game/sickness';
import { wolfMessage } from '../src/game/wolves';
import { emptyPony, ponyWith } from '../src/game/pony';
import { bagCapacity } from '../src/game/camp';
import { QUARRY_SITE } from '../src/game/areas';
import { TOO_TIRED_MESSAGE, workSeconds } from '../src/game/needs';
import { advanceTime, applyAction, cookBlocker } from '../src/game/rules';
import { loadGame, saveGame } from '../src/game/save';
import { SAVE_VERSION, upgradeSave } from '../src/game/saveUpgrades';
import { BALANCE, createGame, type GameState } from '../src/game/state';
import { workshopView } from '../src/ui/panels';

const game = createGame();
const placed = placeBranches(game.nodes, [...STEP_IDS]);
const fakeStorage = (): Storage => {
  const items = new Map<string, string>();
  return { getItem: (key: string) => items.get(key) ?? null, setItem: (key: string, value: string) => void items.set(key, value), removeItem: (key: string) => void items.delete(key) } as unknown as Storage;
};
const saves = (state: GameState): boolean => saveGame(fakeStorage(), state).ok;

type Changes = Partial<Omit<GameState, 'keep' | 'inventory' | 'player'>> & { keep?: Partial<KeepState>; inventory?: Partial<GameState['inventory']>; player?: Partial<GameState['player']>; hinges?: boolean };

/** On the hills at the keep's site, with the forge built, the quarry and hills found, 4 stone in the bag, and any changes on top. */
function byKeep({ keep, inventory, player, hinges = false, ...changes }: Changes = {}): GameState {
  return {
    ...game,
    day: 5,
    nodes: game.nodes.map((node, i) => ({ ...node, x: placed[i].x, y: placed[i].y })),
    clearing: { cleared: [...STEP_IDS], marked: null, felled: [] },
    area: 'hills',
    player: { ...game.player, ...KEEP_SITE, ...player },
    structures: { ...game.structures, shelter: true, toolshed: true, workshop: true },
    progress: { ...game.progress, quarryFound: true, hillsFound: true, oreFoundDay: 1, nextStormDay: null, hearthUnlocked: true, packWoven: true,
      workshop: { ...game.progress.workshop, forge: true, hinges } },
    inventory: { ...game.inventory, stone: 4, ...inventory },
    keep: { ...game.keep, ...keep },
    ...changes
  };
}

const lay = (state: GameState) => applyAction(state, { type: 'layStone' });
const hang = (state: GameState) => applyAction(state, { type: 'hangDoor' });
/** A keep with this many stones on it, as it can really be: a door from 24 up, and finished at 60. */
const raised = (stones: number): Partial<KeepState> => ({ stones, door: stones > KEEP_DOOR_AT, startedDay: stones > 0 ? 1 : null, finishedDay: stones >= KEEP_STONES ? 1 : null });

describe('laying stone', () => {
  it('lays one stone from the bag per go, and counts it at once', () => {
    const { state, message } = lay(byKeep());
    expect(state.keep.stones).toBe(1);
    expect(state.keep.startedDay).toBe(5);
    expect(state.inventory.stone).toBe(3);
    expect(message).toBe('You lay the first stone of the keep.');
  });

  it('keeps the day of the first stone, and says a plain line for the rest', () => {
    const { state, message } = lay(byKeep({ keep: raised(2), hinges: true }));
    expect(state.keep).toMatchObject({ stones: 3, startedDay: 1, finishedDay: null });
    expect(message).toBe('You lay another stone on the keep.');
  });

  it('takes half the time and energy of a dig', () => {
    const before = byKeep({ timeOfDay: 40 });
    const { state } = lay(before);
    expect(state.timeOfDay).toBeCloseTo(40 + workSeconds(before, BALANCE.digSeconds / 2));
    const dug = applyAction({ ...before, area: 'quarry', player: { ...before.player, ...QUARRY_SITE }, progress: { ...before.progress, pickaxeCrafted: true } }, { type: 'digQuarry' }).state;
    expect(dug.timeOfDay - 40).toBeCloseTo((state.timeOfDay - 40) * 2);
    expect(before.player.energy - dug.player.energy).toBeCloseTo((before.player.energy - state.player.energy) * 2);
  });

  it.each([
    [8, 'The footings are in.'],
    [24, 'The walls are at head height. They need a door now.'],
    [48, 'The walls are up. Only the top is left.'],
    [60, 'You lay the last stone. The keep is finished.']
  ])('says so when stone %i goes on', (stones, line) => {
    const { state, message } = lay(byKeep({ hinges: true, keep: { ...raised(stones - 1), door: stones > KEEP_DOOR_AT } }));
    expect(state.keep.stones).toBe(stones);
    expect(message).toBe(line);
  });

  it('marks the day the last stone went on', () => {
    const { state } = lay(byKeep({ hinges: true, keep: raised(59) }));
    expect(state.keep.finishedDay).toBe(5);
    expect(keepFinished(state)).toBe(true);
  });

  it('refuses without the forge, from afar, without stone, when too tired, and once finished', () => {
    const noForge = byKeep();
    const unforged = { ...noForge, progress: { ...noForge.progress, workshop: { ...noForge.progress.workshop, forge: false } } };
    expect(keepOpen(unforged)).toBe(false);
    expect(layStoneBlocker(unforged)).toBe('There is nothing to build here yet.');
    expect(layStoneBlocker(byKeep({ player: { x: KEEP_SITE.x + 3 } }))).toBe('Move closer to the keep.');
    expect(layStoneBlocker({ ...byKeep(), area: 'quarry' })).toBe('Move closer to the keep.');
    expect(layStoneBlocker(byKeep({ inventory: { stone: 0 } }))).toBe('Bring stone up from the quarry.');
    expect(layStoneBlocker(byKeep({ player: { energy: 0 } }))).toBe(TOO_TIRED_MESSAGE);
    const finished = byKeep({ hinges: true, keep: raised(60) });
    expect(layStoneBlocker(finished)).toBe('The keep is finished.');
    expect(lay(finished).state).toEqual(finished);
  });

  it('stops at 24 stones until the door is hung', () => {
    const waiting = byKeep({ keep: raised(24) });
    expect(keepNeedsDoor(waiting)).toBe(true);
    expect(layStoneBlocker(waiting)).toBe('The walls need a door first.');
    expect(lay(waiting).state.keep.stones).toBe(24);
    expect(keepNeedsDoor(byKeep({ hinges: true, keep: { ...raised(24), door: true } }))).toBe(false);
  });

  it('never takes camp stone from the hills', () => {
    const state = byKeep({ inventory: { stone: 0 }, storedStone: 5, structures: { ...game.structures, shelter: true, toolshed: true, workshop: true, stonePile: true } });
    expect(layStoneBlocker(state)).toBe('Bring stone up from the quarry.');
  });
});

describe('the door', () => {
  const ready = (changes: Changes = {}) => byKeep({ hinges: true, keep: raised(24), inventory: { wood: 4 }, ...changes });

  it('hangs the door with the hinges and 4 wood from the bag', () => {
    const { state, message } = hang(ready());
    expect(state.keep.door).toBe(true);
    expect(state.inventory.wood).toBe(0);
    expect(message).toBe('You hang the door.');
  });

  it('takes the time and energy of one dig', () => {
    const before = ready({ timeOfDay: 40 });
    const { state } = hang(before);
    expect(state.timeOfDay).toBeCloseTo(40 + workSeconds(before, BALANCE.digSeconds));
    expect(state.player.energy).toBeLessThan(before.player.energy);
  });

  it('hangs the door with wood from the handcart and the store, from the hills', () => {
    const state = ready({ inventory: { wood: 0 }, cartWood: 2, storedWood: 2, structures: { ...game.structures, shelter: true, toolshed: true, workshop: true, woodpile: true } });
    const hung = hang(state).state;
    expect(hung.keep.door).toBe(true);
    expect([hung.cartWood, hung.storedWood]).toEqual([0, 0]);
  });

  it('refuses the door before 24 stones, without hinges and without 4 wood', () => {
    expect(hangDoorBlocker(ready({ keep: raised(23) }))).toBe('The door can wait until the walls are up.');
    expect(hangDoorBlocker(ready({ hinges: false }))).toBe('Make iron hinges at the forge first.');
    expect(hangDoorBlocker(ready({ inventory: { wood: 3 } }))).toBe('You need 4 wood for the door.');
    expect(hang(ready({ inventory: { wood: 3 } })).state.keep.door).toBe(false);
  });

  it('refuses from afar, a second time, and when too tired', () => {
    expect(hangDoorBlocker(ready({ player: { x: KEEP_SITE.x + 3 } }))).toBe('Move closer to the keep.');
    expect(hangDoorBlocker(ready({ keep: { ...raised(24), door: true } }))).toBe('The door is already hung.');
    expect(hangDoorBlocker(ready({ player: { energy: 0 } }))).toBe(TOO_TIRED_MESSAGE);
  });
});

describe('the iron hinges', () => {
  const forgeAt = (changes: Partial<GameState> = {}): GameState => {
    const base = byKeep();
    return { ...base, area: 'camp', player: { ...base.player, x: BALANCE.campX + 1, y: BALANCE.campY }, inventory: { ...base.inventory, wood: 1, stone: 0 }, storedOre: 2, ...changes };
  };

  it('makes the hinges once at the forge for 2 ore and 1 wood', () => {
    const { state, message } = applyAction(forgeAt(), { type: 'makeUpgrade', upgrade: 'hinges' });
    expect(state.progress.workshop.hinges).toBe(true);
    expect(message).toBe('You made a set of iron hinges for the keep door.');
    expect([state.storedOre, state.inventory.wood]).toEqual([0, 0]);
    expect(applyAction(state, { type: 'makeUpgrade', upgrade: 'hinges' }).message).toBe('You already made the iron hinges.');
  });

  it('asks for the forge first', () => {
    const base = forgeAt();
    const noForge = { ...base, progress: { ...base.progress, workshop: { ...base.progress.workshop, forge: false } } };
    expect(applyAction(noForge, { type: 'makeUpgrade', upgrade: 'hinges' }).message).toBe('Add a forge to the workshop first.');
  });

  it('shows the hinges in the workshop panel only once the forge stands', () => {
    const base = forgeAt();
    expect(workshopView(base).rows.hinges.shown).toBe(true);
    expect(workshopView({ ...base, progress: { ...base.progress, workshop: { ...base.progress.workshop, forge: false } } }).rows.hinges.shown).toBe(false);
  });
});

describe('saving the keep', () => {
  it('upgrades a v37 save to no stones, no door and no hinges', () => {
    const old = JSON.parse(JSON.stringify(createGame()));
    delete old.keep; delete old.progress.workshop.hinges;
    const result = upgradeSave(37, old, 38);
    expect(SAVE_VERSION).toBe(38);
    expect(result.ok).toBe(true);
    const state = (result as { state: GameState }).state;
    expect(state.keep).toEqual({ stones: 0, door: false, startedDay: null, finishedDay: null });
    expect(state.progress.workshop.hinges).toBe(false);
  });

  const noForge = (state: GameState): GameState => ({ ...state, progress: { ...state.progress, workshop: { ...state.progress.workshop, forge: false } } });
  it.each<[string, GameState]>([
    ['below zero stones', byKeep({ keep: { stones: -1 } })],
    ['a part of a stone', byKeep({ keep: { stones: 1.5, startedDay: 1 } })],
    ['more than 60 stones', byKeep({ hinges: true, keep: { ...raised(60), stones: 61 } })],
    ['more than 24 stones without a door', byKeep({ hinges: true, keep: { ...raised(25), door: false } })],
    ['a door without hinges', byKeep({ keep: { ...raised(24), door: true } })],
    ['a door before 24 stones', byKeep({ hinges: true, keep: { ...raised(23), door: true } })],
    ['stones without a forge', noForge(byKeep({ keep: raised(1) }))],
    ['hinges without a forge', noForge(byKeep({ hinges: true }))],
    ['stones with no started day', byKeep({ keep: { stones: 1 } })],
    ['a started day with no stones', byKeep({ keep: { startedDay: 1 } })],
    ['a started day from the future', byKeep({ keep: { stones: 1, startedDay: 6 } })],
    ['60 stones with no finished day', byKeep({ hinges: true, keep: { ...raised(60), finishedDay: null } })],
    ['a finished day below 60 stones', byKeep({ hinges: true, keep: { ...raised(59), finishedDay: 1 } })],
    ['no keep at all', { ...byKeep(), keep: undefined as unknown as KeepState }]
  ])('refuses to save %s', (_name, state) => {
    expect(saves(state)).toBe(false);
  });

  it('saves a half-built keep with the survivor by it', () => {
    const storage = fakeStorage();
    const state = byKeep({ hinges: true, keep: raised(30) });
    expect(saveGame(storage, state).ok).toBe(true);
    const loaded = loadGame(storage);
    expect(loaded.kind).toBe('loaded');
    expect((loaded as { state: GameState }).state.keep).toEqual(state.keep);
  });

  it('saves a finished keep', () => {
    expect(saves(byKeep({ hinges: true, keep: raised(60) }))).toBe(true);
  });
});

describe('a night in the keep', () => {
  const NIGHT = 190;
  const WINTER = 12;
  const inFinishedKeep = (changes: Changes = {}): GameState => byKeep({ hinges: true, keep: raised(60), timeOfDay: NIGHT, ...changes });
  const away = (state: GameState): GameState => ({ ...state, player: { ...state.player, x: KEEP_SITE.x + 5 } });
  const sleep = (state: GameState) => applyAction(state, { type: 'sleep' });
  const food = (changes: Partial<GameState['inventory']['food']>) => ({ inventory: { food: { ...game.inventory.food, ...changes } } });

  it('counts only at the door of a finished keep', () => {
    expect(inKeep(inFinishedKeep())).toBe(true);
    expect(inKeep(away(inFinishedKeep()))).toBe(false);
    expect(inKeep({ ...inFinishedKeep(), area: 'quarry' })).toBe(false);
    expect(inKeep(byKeep({ hinges: true, keep: raised(59), timeOfDay: NIGHT }))).toBe(false);
  });

  it('sleeps until morning at the door, and wakes there', () => {
    const before = inFinishedKeep({ player: { energy: 30 } });
    const { state, message } = sleep(before);
    expect(state.day).toBe(before.day + 1);
    expect(state.area).toBe('hills');
    expect([state.player.x, state.player.y]).toEqual([before.player.x, before.player.y]);
    expect(message).toBe('You sleep until morning.');
  });

  it('has a bed, whether or not camp has one', () => {
    const before = inFinishedKeep({ player: { energy: 30 } });
    expect(before.structures.bed).toBe(false);
    expect(sleep(before).state.player.energy).toBe(100);
  });

  it('says nothing of the camp fire going out far away', () => {
    expect(sleep(inFinishedKeep({ fireFuel: 5 })).message).toBe('You sleep until morning.');
  });

  it('refuses to sleep away from the door, or at an unfinished keep', () => {
    expect(sleep(away(inFinishedKeep())).message).toBe('Move closer to the fire to sleep.');
    expect(sleep(byKeep({ hinges: true, keep: raised(59), timeOfDay: NIGHT })).message).toBe('Move closer to the fire to sleep.');
  });

  it('keeps the survivor warm all night with no fuel anywhere', () => {
    const before = inFinishedKeep({ day: WINTER, fireFuel: 0, player: { warmth: 50 } });
    expect(sleep(before).state.player.warmth).toBeGreaterThanOrEqual(50);
    expect(advanceTime(away(before), 20, 'resting').player.warmth).toBeLessThan(50);
  });

  it('keeps the rain off by day', () => {
    const rainy = Array.from({ length: 200 }, (_, day) => day + 1).find(day => {
      const probe = advanceTime(away(inFinishedKeep({ day, timeOfDay: 40, player: { warmth: 50 } })), 10);
      return probe.player.warmth < 50;
    });
    expect(rainy).toBeDefined();
    const before = inFinishedKeep({ day: rainy, timeOfDay: 40, player: { warmth: 50 } });
    expect(advanceTime(before, 10).player.warmth).toBeGreaterThan(50);
  });

  it('takes nothing from the bag when a wolf comes to the dark camp', () => {
    const before = inFinishedKeep({ day: WINTER, fireFuel: 0, ...food({ trailFood: 1 }) });
    const { state } = sleep(before);
    expect(state.inventory.food.trailFood).toBe(1);
    expect(state.lastWolf).toEqual({ day: WINTER, took: 'nothing' });
  });

  it('still takes from the bag when out on the hills away from the keep', () => {
    const after = advanceTime(away(inFinishedKeep({ day: WINTER, fireFuel: 0, ...food({ trailFood: 1 }) })), 1);
    expect(after.inventory.food.trailFood).toBe(0);
    expect(after.lastWolf?.took).toBe('ration');
  });

  it('tells of the wolf without suggesting a theft', () => {
    const before = inFinishedKeep({ day: WINTER, fireFuel: 0, ...food({ trailFood: 1 }) });
    expect(wolfMessage(before, sleep(before).state)).toBe('A wolf circled the dark camp but found nothing to take.');
  });

  it('is not woken by the bird, and the alarm is not spent', () => {
    const friends = { ...game.companion, friends: { ...game.companion.friends, bird: 1 } };
    const before = inFinishedKeep({ day: WINTER, fireFuel: 500, companion: friends });
    expect(alarmAfter(before)).toBeNull();
    expect(alarmAfter(away(before))).not.toBeNull();
    const { state } = sleep(before);
    expect(state.day).toBe(WINTER + 1);
    expect(state.companion.alarmDay).toBe(friends.alarmDay);
  });

  it('counts as the warm rest on a sick day, even with no fire anywhere', () => {
    const ill = { ...game.sickness, sick: true, sickFromDay: 4, ateWarm: true };
    const before = inFinishedKeep({ fireFuel: 0, sickness: ill });
    expect(isWarmRestHere(before)).toBe(true);
    expect(isWarmRestHere(away(before))).toBe(false);
    const { state } = sleep(before);
    expect(state.sickness.uncared).toBe(0);
    expect(state.sickness.cared).toBe(1);
  });

  it('does not count as home', () => {
    const before = inFinishedKeep();
    expect(isAtHome(before)).toBe(false);
    expect(applyAction(before, { type: 'rest' }).message).toBe('Move closer to the fire to rest.');
    expect(cookBlocker(before)).not.toBeNull();
  });

  it('leaves camp as a night out would', () => {
    const before = inFinishedKeep({ fireFuel: 40 });
    const slept = sleep(before).state;
    const out = advanceTime(away(before), 400 - NIGHT, 'resting');
    expect(slept.fireFuel).toBe(out.fireFuel);
    expect(slept.fireplaceFuel).toBe(out.fireplaceFuel);
    expect(slept.storedWood).toBe(out.storedWood);
  });
});

describe('the door and the top', () => {
  const NIGHT = 190;
  const inFinishedKeep = (changes: Changes = {}): GameState => byKeep({ hinges: true, keep: raised(60), timeOfDay: 40, ...changes });
  const climb = (state: GameState) => applyAction(state, { type: 'climbKeep' });

  it('climbs by day for the view, at no cost', () => {
    const before = inFinishedKeep();
    const { state, message } = climb(before);
    expect(state.player.energy).toBe(before.player.energy);
    expect(state.timeOfDay).toBeCloseTo(40 + BALANCE.stargazeSeconds);
    expect(message).toBe('You climb to the top and look out over the hills for a while.');
  });

  it('climbs however tired the survivor is', () => {
    expect(climb(inFinishedKeep({ player: { energy: 0 } })).message).toContain('You climb to the top');
  });

  it('refuses to climb an unfinished keep, at night or from afar', () => {
    expect(climb(byKeep({ hinges: true, keep: raised(59), timeOfDay: 40 })).message).toBe('Move closer to the keep door.');
    expect(climb(inFinishedKeep({ player: { x: KEEP_SITE.x + 5 } })).message).toBe('Move closer to the keep door.');
    expect(climb(inFinishedKeep({ timeOfDay: NIGHT })).message).toBe('It is too dark to see anything from the top.');
  });

  it.each([[40, 'climbKeep'], [NIGHT, 'sleep']])('the door at time %i means %s', (timeOfDay, type) => {
    expect(withKeepDoor(inFinishedKeep({ timeOfDay }), { type: 'enterKeep' })).toEqual({ type });
  });

  it('the door decides when the survivor arrives, not when it was tapped', () => {
    const tapped = inFinishedKeep({ timeOfDay: 164 });
    expect(withKeepDoor(tapped, { type: 'enterKeep' }).type).toBe('climbKeep');
    expect(withKeepDoor({ ...tapped, timeOfDay: 186 }, { type: 'enterKeep' }).type).toBe('sleep');
  });

  it('passes every other action through', () => {
    expect(withKeepDoor(inFinishedKeep(), { type: 'rest' })).toEqual({ type: 'rest' });
  });

  it('runs the same thing as the door means', () => {
    const day = applyAction(inFinishedKeep(), { type: 'enterKeep' });
    expect(day.message).toContain('You climb to the top');
    const night = applyAction(inFinishedKeep({ timeOfDay: NIGHT }), { type: 'enterKeep' });
    expect(night.state.day).toBe(6);
  });
});

describe('the pony at the keep', () => {
  const NIGHT = 190;
  const shod = (state: GameState): GameState => ({ ...state, pony: { ...emptyPony(), trust: BALANCE.ponyTrustTarget, won: 1, home: true, shod: 1 }, progress: { ...state.progress, workshop: { ...state.progress.workshop, horseshoes: true } } });
  const finished = (changes: Changes = {}) => shod(byKeep({ hinges: true, keep: raised(60), timeOfDay: NIGHT, ...changes }));

  it('keeps the shod pony on the hills overnight once the keep is finished', () => {
    const state = finished();
    expect(ponyWith(state)).toBe(true);
    expect(bagCapacity(state)).toBe(BALANCE.packCapacity + BALANCE.ponySpaces);
    expect(ponyWith(applyAction(state, { type: 'sleep' }).state)).toBe(true);
  });

  it('sends the pony home at nightfall from an unfinished keep', () => {
    expect(ponyWith(shod(byKeep({ hinges: true, keep: raised(59), timeOfDay: NIGHT })))).toBe(false);
  });

  it('leaves the pony below the snow in winter, keep or no keep', () => {
    expect(ponyWith(finished({ day: 12 }))).toBe(false);
  });

  it('loses its spaces on leaving the hills at night, and still saves over the limit', () => {
    const at = finished({ player: { ...HILLS_EXIT }, inventory: { stone: 12 } });
    expect(ponyWith(at)).toBe(true);
    const { state } = applyAction(at, { type: 'cross' });
    expect(state.area).toBe('quarry');
    expect(ponyWith(state)).toBe(false);
    expect(saves(state)).toBe(true);
  });
});
