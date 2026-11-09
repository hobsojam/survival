import { street } from './townStreet';
import { describe, expect, it } from 'vitest';
import { castleSprites } from '../src/art/castleSprites';
import { keepSprites } from '../src/art/keepSprites';
import { townSprites } from '../src/art/townSprites';
import { MOAT_TILES, NEEDS, WALLS, emptyCastle } from '../src/game/castle';
import { CART_SPOTS, FRAMES_SPOT, GATE_SPOT, HALL_SPOT, goodBatch, goodBlocker, goodRoom } from '../src/game/castleSites';
import { STEP_IDS, placeBranches } from '../src/game/clearing';
import { OUTCROP_SITE } from '../src/game/hills';
import { KEEP_SITE } from '../src/game/keep';
import { TOO_TIRED_MESSAGE } from '../src/game/needs';
import { applyAction } from '../src/game/rules';
import { BALANCE, createGame, type GameState } from '../src/game/state';
import { HOUSE_COUNT } from '../src/game/town';
import { HOUSE_PLOTS, houseStage, townSpots, townWorkBlocker } from '../src/game/townSites';
import { PLOT_DAYS } from '../src/game/houseOpen';
import { townNews } from '../src/game/traveller';
import { castleGoodsTitle, castleGoodsView } from '../src/ui/panels';
import { HILLS_PATHS, pathDistance } from '../src/scene/mapGeometry';
import { promptFor, useKeyAction } from '../src/scene/prompts';
import { pickTapTarget, targetAction } from '../src/scene/tapTarget';
import { HILL_TREES, sceneVisuals } from '../src/scene/visuals';

// EASTER EGG: the town, see src/game/town.ts. The first house, built for the first neighbour.

const TOWER = { stones: NEEDS.towerStones, beams: NEEDS.towerBeams, fittings: NEEDS.towerFittings };
const DAY = 65;
const PLOT = HOUSE_PLOTS[0];
const ada = { name: 'Ada', job: 'hens' as const, house: null, arrivedDay: 62 };

/** A finished castle with the hall home and Ada staying in it, the survivor rested at the house plot with stone, beams and a fitting to hand, on a spring day. */
const waiting = (change: (state: GameState) => void = () => {}): GameState => {
  const state = createGame();
  state.day = DAY;
  state.timeOfDay = 60;
  state.progress.quarryFound = true; state.progress.hillsFound = true; state.progress.oreFoundDay = 2; state.progress.homesteadFound = true;
  state.clearing = { cleared: [...STEP_IDS], marked: null, felled: [] };
  state.nodes = placeBranches(state.nodes, [...STEP_IDS]);
  Object.assign(state.structures, { shelter: true, toolshed: true, workshop: true, larder: true, chickenCoop: true });
  state.chickens = { discovered: true, following: false, rescued: true, eggs: 0, nextEggDay: 66 };
  state.progress.nextStormDay = null; state.progress.hearthUnlocked = true; state.progress.packWoven = true;
  Object.assign(state.progress.workshop, { forge: true, hinges: true, stoneCart: true, portcullis: true });
  state.keep = { stones: 60, door: true, startedDay: 1, finishedDay: 2, ponyNight: null };
  state.castle = { ...emptyCastle(), firstClimbDay: 4, revealedDay: 5, road: NEEDS.road, frames: NEEDS.frames,
    wall: { north: NEEDS.wallSide, east: NEEDS.wallSide, south: NEEDS.wallSide, west: NEEDS.wallSide },
    towers: { nw: TOWER, ne: TOWER, se: TOWER, sw: TOWER }, gatehouse: NEEDS.gatehouse,
    moat: { stretches: NEEDS.moat, lastDugDay: 8, dugDay: 8 }, hall: { stones: NEEDS.hallStones, beams: NEEDS.hallBeams, fittings: NEEDS.hallFittings, hangings: NEEDS.hallHangings },
    feast: { ...NEEDS.feast }, goods: { beams: 4, fittings: 1, hangings: 0 },
    doneDays: { road: 6, frames: 7, 'wall-north': 8, 'wall-east': 8, 'wall-south': 8, 'wall-west': 8, 'tower-nw': 8, 'tower-ne': 8, 'tower-se': 8, 'tower-sw': 8, gatehouse: 8, moat: 8, hall: 8 },
    finishedDay: 9, home: 'hall', offeredHome: true };
  state.town = { ...state.town, people: [ada], namesUsed: 1 };
  state.area = 'hills';
  state.player = { ...state.player, x: PLOT.x, y: PLOT.y + 0.5, energy: 100 };
  state.inventory = { ...state.inventory, stone: 5 };
  change(state);
  return state;
};

const work = (state: GameState) => applyAction(state, { type: 'townWork', plot: 0 });
const withHouse = (house: Partial<GameState['town']['houses'][number]>) => waiting(state => { state.town.houses = street({ ...state.town.houses[0], ...house }); });

describe('where the house stands', () => {
  const px = (spot: { x: number; y: number }, def: { anchor: number[]; size: number[] }) => {
    const left = Math.round((spot.x + 0.5) * 16) - def.anchor[0];
    const top = Math.round((spot.y + 0.5) * 16) - def.anchor[1];
    return { left, top, right: left + def.size[0], bottom: top + def.size[1] };
  };
  const overlap = (a: ReturnType<typeof px>, b: ReturnType<typeof px>) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

  it('lays out eight plots on the hills below the castle, outside its walls', () => {
    expect(HOUSE_PLOTS).toEqual([[31, 23], [26, 21], [22, 21], [27, 25], [18, 21], [23, 25], [14, 21], [19, 25]].map(([x, y]) => ({ area: 'hills', x, y })));
    expect(HOUSE_COUNT).toBe(HOUSE_PLOTS.length);
    for (const plot of HOUSE_PLOTS) expect(plot.y).toBeGreaterThan(WALLS.bottom);
  });

  it.each(HOUSE_PLOTS.map((plot, index) => [index, plot] as const))('keeps plot %i clear of the moat, the trees, the paths, the cart, the gate and the outcrop', (_index, plot) => {
    for (const tile of MOAT_TILES) expect(Math.hypot(tile.x - plot.x, tile.y - plot.y)).toBeGreaterThan(3);
    for (const tree of HILL_TREES) expect(Math.hypot(tree.x - plot.x, tree.y - plot.y), `${tree.x},${tree.y}`).toBeGreaterThanOrEqual(2.5);
    expect(pathDistance(plot.x, plot.y, HILLS_PATHS)).toBeGreaterThan(2);
    for (const spot of [CART_SPOTS.hills, GATE_SPOT, OUTCROP_SITE]) expect(Math.hypot(spot.x - plot.x, spot.y - plot.y)).toBeGreaterThan(3);
  });

  it.each(HOUSE_PLOTS.map((plot, index) => [index, plot] as const))('keeps plot %i\'s picture off the castle, the keep, the outcrop and the other houses', (index, plot) => {
    const box = px(plot, townSprites.townHouse);
    expect(overlap(box, px(KEEP_SITE, keepSprites.keep))).toBe(false);
    expect(overlap(box, px(HALL_SPOT, castleSprites.castleHall))).toBe(false);
    expect(overlap(box, px(FRAMES_SPOT, castleSprites.castleFrames))).toBe(false);
    expect(overlap(box, px(GATE_SPOT, castleSprites.castleGatehouse))).toBe(false);
    expect(overlap(box, px(OUTCROP_SITE, { anchor: [8, 15], size: [16, 16] }))).toBe(false);
    for (let x = WALLS.left; x <= WALLS.right; x++) expect(overlap(box, px({ x, y: WALLS.bottom }, castleSprites.castleWall))).toBe(false);
    for (let y = WALLS.top; y <= WALLS.bottom; y++) {
      expect(overlap(box, px({ x: WALLS.right, y }, castleSprites.castleWall))).toBe(false);
      expect(overlap(box, px({ x: WALLS.left, y }, castleSprites.castleWall))).toBe(false);
    }
    for (const [x, y] of [[WALLS.right, WALLS.bottom], [WALLS.left, WALLS.bottom]]) expect(overlap(box, px({ x, y }, castleSprites.castleTower))).toBe(false);
    HOUSE_PLOTS.forEach((other, otherIndex) => {
      if (otherIndex !== index) expect(overlap(box, px(other, townSprites.townHouse)), `plot ${otherIndex}`).toBe(false);
    });
  });
});

describe('when the plot opens', () => {
  it('stays shut before anyone has stayed, and opens once someone needs a house', () => {
    expect(townSpots(waiting(state => { state.town.people = []; state.town.namesUsed = 0; }))).toEqual([]);
    expect(townSpots(waiting(state => { state.town.traveller = { name: 'Ada', arrivedDay: 64, refusals: 0, askedDay: null }; state.town.people = []; }))).toEqual([]);
    expect(townSpots(waiting())).toEqual([{ plot: 0, area: 'hills', x: PLOT.x, y: PLOT.y }]);
  });

  it('opens one plot at a time, in order, while there is work for a newcomer', () => {
    const plots = (state: GameState) => townSpots(state).map(spot => spot.plot);
    expect(plots(waiting())).toEqual([0]);
    const housed = (change: (state: GameState) => void = () => {}) => waiting(state => {
      state.town.houses = street({ stone: 30, beams: 4, fittings: 1, doneDay: DAY - PLOT_DAYS });
      state.town.people = [{ ...ada, house: 0 }];
      state.structures.beehive = true;
      change(state);
    });
    expect(plots(housed())).toEqual([1]);
    expect(plots(housed(state => { state.town.houses = street({ stone: 30, beams: 4, fittings: 1, doneDay: 64 }, { stone: 30, beams: 4, fittings: 1, doneDay: 64 }); }))).toEqual([]);
    expect(plots(housed(state => { state.structures.beehive = false; }))).toEqual([]);
  });

  it('opens the next plot a few days after the last house is finished, not at once', () => {
    expect(PLOT_DAYS).toBe(5);
    const lived = (doneDay: number) => waiting(state => {
      state.town.houses = street({ stone: 30, beams: 4, fittings: 1, doneDay });
      state.town.people = [{ ...ada, house: 0 }];
      state.structures.beehive = true;
    });
    expect(townSpots(lived(DAY - PLOT_DAYS + 1))).toEqual([]);
    expect(townSpots(lived(DAY - PLOT_DAYS)).map(spot => spot.plot)).toEqual([1]);
  });

  it('shuts once the house is finished', () => {
    expect(townSpots(waiting(state => {
      state.town.houses = street({ stone: 30, beams: 4, fittings: 1, doneDay: DAY - PLOT_DAYS });
      state.town.people = [{ ...ada, house: 0 }];
    }))).toEqual([]);
  });
});

describe('working at the plot', () => {
  it('gives the same work from the prompt, the E key and a tap', () => {
    const state = waiting();
    expect(promptFor(state)).toContain('Lay a house stone (0/30)');
    expect(useKeyAction(state)).toEqual({ type: 'townWork', plot: 0 });
    expect(targetAction(pickTapTarget(state, PLOT.x, PLOT.y))).toEqual({ type: 'townWork', plot: 0 });
  });

  it('says what is missing, in the prompt and when tried', () => {
    const noStone = waiting(state => { state.inventory.stone = 0; });
    expect(work(noStone).message).toBe('Bring stone up from the quarry.');
    expect(promptFor(noStone)).toContain('House · bring stone up from the quarry');
    expect(useKeyAction(noStone)).toBeUndefined();
    expect(work(waiting(state => { state.town.houses = street({ stone: 30, beams: 0, fittings: 0, doneDay: null }); state.castle.goods.beams = 0; })).message).toBe('Make beams at the workshop.');
    expect(work(waiting(state => { state.town.houses = street({ stone: 30, beams: 4, fittings: 0, doneDay: null }); state.castle.goods.fittings = 0; })).message).toBe('Make an iron fitting at the forge.');
    expect(work(waiting(state => { state.player.x = PLOT.x + 4; })).message).toBe('Move closer to the house.');
    expect(work(waiting(state => { state.player.energy = 0; })).message).toBe(TOO_TIRED_MESSAGE);
    expect(townWorkBlocker(waiting(state => { state.town.people = []; state.town.namesUsed = 0; }), 0)).not.toBeNull();
  });

  it('takes the cart\'s stone before the bag\'s, as the castle does', () => {
    const state = waiting(state => { state.castle.cart = { ...state.castle.cart, at: 'hills', stone: 2 }; });
    const after = work(state).state;
    expect(after.castle.cart.stone).toBe(1);
    expect(after.inventory.stone).toBe(5);
    expect(after.town.houses[0].stone).toBe(1);
  });

  it('lays stone, then beams, then the fitting, with a line at each stage', () => {
    expect(work(waiting()).message).toBe('You lay another stone on the house.');
    expect(work(withHouse({ stone: 9 })).message).toBe('The footings are in.');
    expect(work(withHouse({ stone: 29 })).message).toBe('The walls are up.');
    const beam = work(withHouse({ stone: 30 }));
    expect(beam.message).toBe('You fit another beam.');
    expect(beam.state.castle.goods.beams).toBe(3);
    expect(beam.state.town.houses[0]).toMatchObject({ stone: 30, beams: 1, fittings: 0 });
    expect(work(withHouse({ stone: 30, beams: 3 })).message).toBe('The roof is on.');
  });

  it('takes time and energy for each go', () => {
    const state = waiting();
    const after = work(state).state;
    expect(after.timeOfDay).toBeGreaterThan(state.timeOfDay);
    expect(after.player.energy).toBeLessThan(state.player.energy);
  });

  it('moves the neighbour in with the last fitting, and the morning says so', () => {
    const done = work(withHouse({ stone: 30, beams: 4 }));
    expect(done.message).toBe('You hang the door and lay the hearth. The house is finished.');
    expect(done.state.town.houses[0]).toEqual({ stone: 30, beams: 4, fittings: 1, doneDay: DAY });
    expect(done.state.town.people).toEqual([{ ...ada, house: 0 }]);
    expect(done.state.castle.goods.fittings).toBe(0);
    expect(townNews(done.state, { ...done.state, day: DAY + 1 })).toEqual(['Ada has moved into the new house.']);
    expect(townNews({ ...done.state, day: DAY + 1 }, { ...done.state, day: DAY + 2 })).toEqual([]);
    expect(townSpots(done.state)).toEqual([]);
  });
});

describe('the house\'s stages', () => {
  it('counts footings at ten stone, walls at thirty, the roof at four beams and the door at its fitting', () => {
    const stage = (stone: number, beams = 0, fittings = 0) => houseStage({ stone, beams, fittings, doneDay: null });
    expect([stage(0), stage(9), stage(10), stage(29), stage(30), stage(30, 3), stage(30, 4), stage(30, 4, 1)]).toEqual([0, 0, 1, 1, 2, 2, 3, 4]);
  });

  it('shows each stage on the hills, with snow in winter, and nothing before the footings', () => {
    const texture = (house: Partial<GameState['town']['houses'][number]>, day = DAY) => {
      const state = withHouse(house);
      state.day = day;
      return sceneVisuals(state, 0).find(visual => visual.id === 'town-house-0')?.texture;
    };
    expect(texture({ stone: 5 })).toBeUndefined();
    expect(texture({ stone: 10 })).toBe('townHouse:1');
    expect(texture({ stone: 30 })).toBe('townHouse:2');
    expect(texture({ stone: 30, beams: 4 })).toBe('townHouse:3');
    expect(texture({ stone: 30, beams: 4, fittings: 1, doneDay: 64 })).toBe('townHouse:4');
    expect(texture({ stone: 30, beams: 4 }, 55)).toBe('townHouse:3s');
    for (const frame of ['1', '2', '3', '4', '1s', '2s', '3s', '4s']) expect(townSprites.townHouse.frames).toHaveProperty(frame);
  });

  it('is not drawn on another area', () => {
    const state = withHouse({ stone: 30 });
    state.area = 'camp';
    expect(sceneVisuals(state, 0).find(visual => visual.id === 'town-house-0')).toBeUndefined();
  });
});

describe('the castle goods for the house', () => {
  const atCamp = (change: (state: GameState) => void = () => {}) => waiting(state => {
    state.area = 'camp';
    state.player = { ...state.player, x: BALANCE.campX, y: BALANCE.campY };
    state.castle.goods = { beams: 0, fittings: 0, hangings: 0 };
    change(state);
  });

  it('counts only the house\'s need once the castle is finished', () => {
    expect(goodRoom(atCamp(), 'beams')).toBe(4);
    expect(goodRoom(atCamp(), 'fittings')).toBe(1);
    expect(goodRoom(atCamp(), 'hangings')).toBe(0);
    expect(goodBatch(atCamp(), 'beams')).toBe(4);
    expect(goodRoom(atCamp(state => { state.town.houses = street({ stone: 30, beams: 3, fittings: 0, doneDay: null }); }), 'beams')).toBe(1);
    expect(goodRoom(atCamp(state => { state.castle.goods.beams = 4; }), 'beams')).toBe(0);
  });

  it('counts nothing for the house before anyone needs one', () => {
    const quiet = atCamp(state => { state.town.people = []; state.town.namesUsed = 0; });
    expect(goodRoom(quiet, 'beams')).toBe(0);
    expect(castleGoodsView(quiet).filter(row => row.shown)).toEqual([]);
  });

  it('shows the beams and fittings rows while the house needs them', () => {
    const rows = castleGoodsView(atCamp());
    expect(rows.filter(row => row.shown).map(row => row.good)).toEqual(['beams', 'fittings']);
    expect(goodBlocker(atCamp(state => { state.castle.goods.beams = 4; }), 'beams')).toBe('There is enough beams for now.');
  });

  it('heads the rows for the town once the castle is finished, and for the castle before', () => {
    expect(castleGoodsTitle(atCamp())).toBe('FOR THE TOWN');
    expect(castleGoodsTitle(atCamp(state => { state.castle.finishedDay = null; }))).toBe('FOR THE CASTLE');
  });

  it('makes beams for the house at the workshop', () => {
    const state = atCamp(state => { state.inventory.wood = 8; });
    const made = applyAction(state, { type: 'makeCastleGood', good: 'beams' });
    expect(made.state.castle.goods.beams).toBe(4);
  });
});
