import { CAMP_EXIT, QUARRY_SITE, RUBBLE_SITE } from '../../src/game/areas';
import { daysLeftInSeason, isWinter, nightStart, season } from '../../src/game/calendar';
import { CHICKEN_SITE, COOP_SITE } from '../../src/game/chickens';
import { CLEARING_STEPS, STEP_IDS, nextStep, type Side, type StepId, choppableTrees, isClearingStump } from '../../src/game/clearing';
import { availableFiber, availableStone, availableWood, carriedCount, fullCapacity, isAtCamp, isInClearing } from '../../src/game/camp';
import { offerFor } from '../../src/game/companion';
import { BUILDINGS } from '../../src/game/state';
import { FOOD_ITEMS, availableFood, foodCount, keptFoodTotal } from '../../src/game/food';
import { HILLS_EXIT, OUTCROP_SITE, availableOre, outcropLeft } from '../../src/game/hills';
import { HOUSE_SPOT, fuelLeft, hasWoodStore, livesInHouse, woodStoreCapacity } from '../../src/game/home';
import { recordJournal } from '../../src/game/journalEntries';
import { NEEDS, isRevealed } from '../../src/game/castle';
import { castleSpots } from '../../src/game/castleSites';
import { KEEP_DOOR_AT, KEEP_DOOR_WOOD, KEEP_SITE, keepFinished, keepOpen } from '../../src/game/keep';
import { ORCHARD_SPOTS, spotAction } from '../../src/game/orchard';
import { PONY_SPOTS, wildPonyAt, ponyOfferBlocker } from '../../src/game/pony';
import { MINE_COST, advanceLiveTime, applyAction, type GameAction } from '../../src/game/rules';
import { APPLE_TREE, HOMESTEAD_SHED } from '../../src/game/homestead';
import { BALANCE, LOOKOUT, SITES, createGame, type AreaId, type GameState, type StructureId } from '../../src/game/state';
import { WORKSHOP_UPGRADES, type UpgradeId } from '../../src/game/workshop';
import { journalView } from '../../src/ui/journal';
import { axeView, buildButtonView, buildListView, clearingView, fishingLineView, packView, pickaxeView, potView, workshopView } from '../../src/ui/panels';
import { MILESTONES } from './milestones';

// A scripted player for checking the whole game from a new camp to the finished keep. It plays through the real rules with
// the same walking, ticking and journal the scene uses, and it only takes up work that the game's own panels are showing,
// so a dead end or a gap in the guidance shows up as a stall instead of being scripted around.

/** Orderly takes the panels' work in their order; wandering picks at random; unhurried wanders and also dawdles between jobs. */
export type Style = 'orderly' | 'wandering' | 'unhurried';

export interface Hit { id: string; label: string; day: number; playMinutes: number }

export interface RunResult {
  seed: number;
  style: Style;
  hits: Hit[];
  ended: 'finished' | 'died' | 'out of days';
  days: number;
  playMinutes: number;
  /** Minutes of live play spent waiting with nothing the panels offered that could be done, by year of 40 days. */
  idleMinutesByYear: number[];
  /** Times the bag was too full for the next job, and something had to be eaten, stored, burnt or set down. */
  fullBagRefusals: number;
  /** Times a job's cost couldn't fit in the bag and the stores together, so it waited for more room. */
  tooBigForBag: number;
  sickDays: number;
  foodShortDays: number;
  offeredButRefused: Record<string, number>;
  /** Before the keep is done: days with a moment of no work offered at all, and days when all of it had to wait on something. */
  nothingOfferedDays: number;
  allWaitingDays: number;
  neverDone: string[];
  neverShown: string[];
  /** What the journal's "what next" line said, and for how long. */
  journalHints: { hint: string; fromDay: number; toDay: number }[];
  /** Dawns when the build list said none were left while one still wasn't built, with the ones it left out. */
  noneLeftDays: number;
  unbuiltWhenNoneLeft: string[];
}

type Material = 'wood' | 'fiber' | 'stone';
type Cost = Record<Material, number> & { ore?: number };

const AVAILABLE: Record<Material, (state: GameState) => number> = { wood: availableWood, fiber: availableFiber, stone: availableStone };

interface Task {
  id: string;
  shown: (state: GameState) => boolean;
  done: (state: GameState) => boolean;
  /** Takes one step toward the task. False means it has to wait, for now, on something else. */
  step: () => boolean;
}

const FISHING_LINE_COST_IN_FULL: Cost = { wood: 1, fiber: 1, stone: 0 };
const COOKED_FOODS = ['fish', 'rabbit', 'egg'] as const;
const SIDES: readonly Side[] = ['north', 'east', 'south', 'west'];
const STEP_SECONDS = 0.25;
const KEY_PRESS_SECONDS = 1;
const DAWDLE_SECONDS = 15;
const OFFERING_WAIT = 25;
const WINTER_FOOD = 8;
const WOOD_FOR_THE_HOUSE = 3;
const ROOM_FOR_HARVEST = 6;
const FOOD_TO_CARRY = 3;
const WALK_SPEED = 3.5;
const REACH = BALANCE.interactionRadius - 0.3;
const CAMP = { x: BALANCE.campX, y: BALANCE.campY };

/** A small, seedable generator, so a run can be repeated exactly. */
function randomFrom(seed: number): () => number {
  let value = seed * 2654435761 % 4294967296;
  return () => {
    value = (value + 0x6d2b79f5) % 4294967296;
    let mixed = Math.imul(value ^ (value >>> 15), value | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

export class Player {
  state: GameState = createGame();
  private readonly random: () => number;
  private seconds = 0;
  private readonly hits = new Map<string, Hit>();
  private readonly idle: number[] = [];
  private fullBag = 0;
  private sickDays = 0;
  private foodShortDays = 0;
  private lastSickDay = 0;
  private lastShortDay = 0;
  private readonly refused = new Map<string, number>();
  /** The day each task was last put off until, so the player moves on to something else. */
  private readonly waiting = new Map<string, number>();
  private readonly tasks: Task[];
  private current: Task | null = null;
  private lastChoresAt = -1;
  private readonly nothingOfferedDays = new Set<number>();
  private readonly allWaitingDays = new Set<number>();
  private readonly journalHints: RunResult['journalHints'] = [];
  private noneLeftDays = 0;
  private readonly unbuiltWhenNoneLeft = new Set<string>();
  private sampledDay = 0;
  /** What the job in hand is being saved up for. */
  private saving: Cost | null = null;
  private tooBigForBag = 0;

  constructor(readonly seed: number, readonly style: Style) {
    this.random = randomFrom(seed);
    this.tasks = this.allTasks();
    this.note();
  }

  // ---- Moving and acting, as the scene does it ----

  private get playMinutes(): number {
    return this.seconds / 60;
  }

  /** Once a day, what the game itself is telling the player to do next. */
  private readGuidance(): void {
    if (this.sampledDay === this.state.day) return;
    this.sampledDay = this.state.day;
    const hint = journalView(this.state).nextHint;
    const last = this.journalHints.at(-1);
    if (last?.hint === hint) last.toDay = this.state.day;
    else this.journalHints.push({ hint, fromDay: this.state.day, toDay: this.state.day });
    if (buildListView(this.state).hint.startsWith('No structures left')) {
      const unbuilt = (Object.keys(BUILDINGS) as StructureId[]).filter(id => !this.state.structures[id]);
      if (unbuilt.length > 0) this.noneLeftDays += 1;
      for (const id of unbuilt) this.unbuiltWhenNoneLeft.add(id);
    }
  }

  private note(): void {
    this.readGuidance();
    for (const milestone of MILESTONES) {
      if (!this.hits.has(milestone.id) && milestone.reached(this.state)) {
        this.hits.set(milestone.id, { id: milestone.id, label: milestone.label, day: this.state.day, playMinutes: this.playMinutes });
      }
    }
    if (this.state.sickness.sick && this.lastSickDay !== this.state.day) {
      this.lastSickDay = this.state.day;
      this.sickDays += 1;
    }
    if (this.state.player.hunger <= 20 && this.lastShortDay !== this.state.day) {
      this.lastShortDay = this.state.day;
      this.foodShortDays += 1;
    }
  }

  private spend(next: GameState, realSeconds: number): void {
    this.seconds += realSeconds;
    this.state = next;
    this.note();
  }

  /** Every action tried, for looking into a run by hand. */
  readonly log: string[] = [];

  private act(action: GameAction): boolean {
    const before = this.state;
    const result = applyAction(before, action);
    if (result.state === before) return false;
    if (action.type === 'enterKeep') this.noteKeep(result.state.day > before.day);
    if (action.type !== 'move') this.log.push(`d${before.day} t${Math.round(before.timeOfDay)} ${JSON.stringify(action)} ${result.message}`);
    // An action's own time passes in a moment on screen, a night's sleep included; only a key press is really spent.
    this.spend(recordJournal(before, result.state, action).state, action.type === 'move' ? 0 : KEY_PRESS_SECONDS);
    return true;
  }

  private noteKeep(slept: boolean): void {
    const [id, label] = slept ? ['keep-night', 'Slept a night in the keep'] : ['keep-climbed', 'Looked out from the top of the keep'];
    if (!this.hits.has(id)) this.hits.set(id, { id, label, day: this.state.day, playMinutes: this.playMinutes });
  }

  private tick(realSeconds: number): void {
    const before = this.state;
    this.spend(recordJournal(before, advanceLiveTime(before, realSeconds)).state, realSeconds);
  }

  private wait(realSeconds: number): void {
    const year = Math.floor((this.state.day - 1) / 40);
    this.idle[year] = (this.idle[year] ?? 0) + realSeconds / 60;
    this.tick(realSeconds);
  }

  private away(point: { x: number; y: number }): number {
    return Math.hypot(point.x - this.state.player.x, point.y - this.state.player.y);
  }

  /** One step of walking toward a point in this area. True once there. */
  private walkTo(point: { x: number; y: number }, reach: number = REACH): boolean {
    let guard = 400;
    while (this.away(point) > reach && guard-- > 0 && !this.state.ending) {
      const distance = this.away(point);
      const step = Math.min(WALK_SPEED * STEP_SECONDS, distance);
      const dx = (point.x - this.state.player.x) / distance * step;
      const dy = (point.y - this.state.player.y) / distance * step;
      const area = this.state.area;
      this.act({ type: 'move', dx, dy });
      this.tick(STEP_SECONDS);
      if (this.state.area !== area) return false;
    }
    return this.away(point) <= reach;
  }

  /** Walks off the edge of this area toward the next one on the way, as a player does. */
  private cross(dx: number): void {
    const edge = dx < 0 ? 0.3 : (this.state.area === 'hills' ? HILLS_EXIT.x - 0.3 : BALANCE.mapWidth - 1.3);
    this.walkTo({ x: edge, y: CAMP_EXIT.y }, 0.2);
    this.act({ type: 'move', dx: dx * 2, dy: 0 });
    this.tick(STEP_SECONDS);
  }

  /** Walks to an area, by the only ways the paths go. */
  private goTo(area: AreaId): boolean {
    let guard = 6;
    while (this.state.area !== area && guard-- > 0) {
      const here = this.state.area;
      if (here === 'homestead') this.cross(-1);
      else if (here === 'hills') this.cross(1);
      else if (here === 'quarry') this.cross(area === 'hills' ? -1 : 1);
      else if (!this.state.structures.shelter) return false;
      else this.cross(area === 'homestead' ? 1 : -1);
    }
    return this.state.area === area;
  }

  private goHome(): boolean {
    if (!this.goTo('camp')) return false;
    return livesInHouse(this.state) ? this.walkTo(HOUSE_SPOT, BALANCE.homeRadius - 0.3) : this.walkTo(CAMP, BALANCE.campRadius - 0.5);
  }

  private free(): number {
    return fullCapacity(this.state) - carriedCount(this.state);
  }

  // ---- Fetching what a job needs ----

  private gatherNode(kind: GameState['nodes'][number]['kind']): boolean {
    if (!this.goTo('camp')) return false;
    const { player } = this.state;
    const nodes = this.state.nodes.filter(node => node.kind === kind && node.amount > 0)
      .sort((a, b) => Math.hypot(a.x - player.x, a.y - player.y) - Math.hypot(b.x - player.x, b.y - player.y));
    for (const node of nodes) {
      if (!this.walkTo(node)) continue;
      if (this.act({ type: 'gather', nodeId: node.id })) return true;
    }
    return false;
  }

  /** Makes space in the bag the ways a player can: eating, the larder, then burning or setting down whatever isn't wanted now. */
  private makeRoom(needed: number, wanted?: Material): boolean {
    if (this.free() >= needed) return true;
    this.fullBag += 1;
    if (this.goTo('camp') && this.walkTo(CAMP, 1)) this.tick(STEP_SECONDS);
    while (this.free() < needed && this.state.player.hunger < 90 && this.eat()) { /* make use of it */ }
    if (this.state.structures.larder) {
      for (const item of FOOD_ITEMS) {
        while (this.free() < needed && this.act({ type: 'storeFood', item })) { /* put it by */ }
      }
    }
    // What the job in hand still needs stays in the bag, or the work just undoes itself.
    const spare = (kind: Material): boolean => this.state.inventory[kind] > 0 && AVAILABLE[kind](this.state) > (this.saving?.[kind] ?? 0);
    const shed = (kind: Material, action: GameAction): void => {
      while (this.free() < needed && kind !== wanted && spare(kind) && this.act(action)) { /* let it go */ }
    };
    if (!this.saving?.ore) while (this.free() < needed && this.act({ type: 'dropOre' })) { /* set it down */ }
    shed('stone', { type: 'dropStone' });
    shed('fiber', { type: 'burnFiber' });
    shed('wood', { type: 'stokeFire' });
    return this.free() >= needed;
  }

  private fetchWood(): boolean {
    if (!this.makeRoom(1, 'wood')) return false;
    if (this.gatherNode('branch')) return true;
    if (!this.state.progress.axeCrafted || !this.goTo('camp')) return false;
    const trees = choppableTrees(this.state).filter(tree => !isClearingStump(tree) && !tree.id.startsWith('mark-') && tree.readyDay <= this.state.day);
    const { player } = this.state;
    trees.sort((a, b) => Math.hypot(a.x - player.x, a.y - player.y) - Math.hypot(b.x - player.x, b.y - player.y));
    if (trees.length === 0) return false;
    if (!this.makeRoom(this.state.progress.workshop.saw ? 4 : 2, 'wood')) return false;
    return this.walkTo(trees[0]) && this.act({ type: 'chopTree', treeId: trees[0].id });
  }

  private fetchFiber(): boolean {
    return this.makeRoom(1, 'fiber') && this.gatherNode('fiber');
  }

  private fetchStone(): boolean {
    if (!this.makeRoom(BALANCE.stoneSpaces, 'stone')) return false;
    if (this.state.area === 'camp' && this.gatherNode('stone')) return true;
    if (!this.state.structures.shelter || !this.goTo('quarry')) return false;
    if (this.walkTo(RUBBLE_SITE) && this.act({ type: 'gatherRubble' })) return true;
    return this.state.progress.pickaxeCrafted && this.walkTo(QUARRY_SITE) && this.act({ type: 'digQuarry' });
  }

  private fetchOre(): boolean {
    if (!this.state.progress.pickaxeCrafted || outcropLeft(this.state) <= 0 || !this.makeRoom(BALANCE.stoneSpaces) || !this.goTo('hills')) return false;
    return this.walkTo(OUTCROP_SITE) && this.act({ type: 'digOre' });
  }

  /** Whether a cost can be gathered at all as things stand: what the stores can't hold has to fit in the bag together. */
  private fits(cost: Cost): boolean {
    const { structures } = this.state;
    const inStore = (need: number, room: number): number => Math.max(0, need - room);
    const spaces = inStore(cost.wood, hasWoodStore(this.state) ? woodStoreCapacity(this.state) : 0)
      + inStore(cost.fiber, structures.fibreStack ? BALANCE.fibreStackCapacity : 0)
      + inStore(cost.stone, structures.stonePile ? BALANCE.stonePileCapacity : 0) * BALANCE.stoneSpaces
      + (cost.ore ?? 0) * BALANCE.stoneSpaces;
    return spaces <= fullCapacity(this.state);
  }

  /** Fetches the next thing short of a cost, or returns null with nothing left to fetch. */
  private fetchFor(cost: Cost): boolean | null {
    this.saving = cost;
    if (availableFiber(this.state) < cost.fiber) return this.fetchFiber();
    if (availableStone(this.state) < cost.stone) return this.fetchStone();
    if (availableOre(this.state) < (cost.ore ?? 0)) return this.fetchOre();
    if (availableWood(this.state) < cost.wood) return this.fetchWood();
    return null;
  }

  /** Pays for something made in the clearing: fetches what's short, or else goes to the clearing and does it. */
  private payFor(cost: Cost, action: GameAction): boolean {
    if (!this.fits(cost)) {
      this.tooBigForBag += 1;
      return false;
    }
    const fetched = this.fetchFor(cost);
    if (fetched !== null) return fetched;
    if (!this.goTo('camp') || !this.walkTo(CAMP, 2)) return false;
    if (this.act(action)) return true;
    const why = `${action.type}: ${applyAction(this.state, action).message}`;
    this.refused.set(why, (this.refused.get(why) ?? 0) + 1);
    return false;
  }

  // ---- What the panels can offer ----

  private buildTask(id: StructureId): Task {
    const definition = BUILDINGS[id];
    return {
      id: `build:${id}`,
      shown: state => buildButtonView(state, id).shown,
      done: state => state.structures[id],
      step: () => this.payFor({ wood: definition.cost.wood, fiber: definition.cost.fiber, stone: 'stone' in definition.cost ? definition.cost.stone : 0 }, { type: 'build', structureId: id })
    };
  }

  private toolTask(id: string, shown: Task['shown'], done: Task['done'], cost: Cost, action: GameAction): Task {
    return { id: `tool:${id}`, shown, done, step: () => this.payFor(cost, action) };
  }

  private upgradeTask(id: UpgradeId): Task {
    const { cost } = WORKSHOP_UPGRADES[id];
    return {
      id: `upgrade:${id}`,
      shown: state => state.structures.workshop && workshopView(state).rows[id].shown,
      done: state => state.progress.workshop[id],
      step: () => this.payFor(cost, { type: 'makeUpgrade', upgrade: id })
    };
  }

  private clearingStep(): boolean {
    const { marked, felled } = this.state.clearing;
    if (!marked) {
      const sides = this.style === 'orderly' ? SIDES : [...SIDES].sort(() => this.random() - 0.5);
      const step = sides.map(side => nextStep(this.state, side)).find((id): id is StepId => id !== null && this.act({ type: 'markClearing', step: id }));
      return Boolean(step);
    }
    const { trees, cost } = CLEARING_STEPS[marked];
    if (felled.length >= trees.length) return this.payFor(cost, { type: 'clearGround' });
    if (!this.goTo('camp')) return false;
    const left = choppableTrees(this.state).filter(tree => tree.id.startsWith('mark-') && !isClearingStump(tree));
    if (left.length === 0) return false;
    if (!this.makeRoom(this.state.progress.workshop.saw ? 4 : 2, 'wood')) return false;
    return this.walkTo(left[0]) && this.act({ type: 'chopTree', treeId: left[0].id });
  }

  private allTasks(): Task[] {
    const progress = (state: GameState) => state.progress;
    const builds = (Object.keys(BUILDINGS) as StructureId[]).map(id => this.buildTask(id));
    const upgrades = (Object.keys(WORKSHOP_UPGRADES) as UpgradeId[])
      // The portcullis has no panel row yet, so this player has no way to ask for it.
      .filter(id => id !== 'portcullis').map(id => this.upgradeTask(id));
    return [
      ...builds,
      this.toolTask('axe', state => axeView(state).shown !== false && progress(state).hearthUnlocked && state.structures.toolshed, state => progress(state).axeCrafted, { wood: 1, fiber: 1, stone: 1 }, { type: 'craftAxe' }),
      this.toolTask('pickaxe', state => pickaxeView(state).shown && state.structures.toolshed, state => progress(state).pickaxeCrafted, { wood: 2, fiber: 1, stone: 2 }, { type: 'craftPickaxe' }),
      this.toolTask('pot', state => potView(state).shown !== false && state.structures.toolshed, state => progress(state).potCrafted, { wood: 1, fiber: 0, stone: 2 }, { type: 'craftPot' }),
      this.toolTask('pack', state => packView(state).shown !== false && state.structures.toolshed, state => progress(state).packWoven, { wood: 2, fiber: 4, stone: 0 }, { type: 'craftPack' }),
      this.toolTask('line', state => fishingLineView(state).shown !== false, state => progress(state).fishingLine, FISHING_LINE_COST_IN_FULL, { type: 'makeFishingLine' }),
      ...upgrades,
      { id: 'clear', shown: state => clearingView(state).shown, done: state => state.clearing.cleared.length === STEP_IDS.length, step: () => this.clearingStep() },
      { id: 'find:quarry', shown: state => state.structures.shelter, done: state => progress(state).quarryFound, step: () => this.goTo('quarry') && this.walkTo(QUARRY_SITE) },
      { id: 'find:homestead', shown: state => state.structures.shelter, done: state => progress(state).homesteadFound, step: () => this.goTo('homestead') },
      { id: 'find:hills', shown: state => progress(state).quarryFound, done: state => progress(state).hillsFound, step: () => this.goTo('hills') },
      { id: 'find:ore', shown: state => progress(state).hillsFound && progress(state).pickaxeCrafted, done: state => progress(state).oreFoundDay !== null, step: () => this.fetchOre() },
      { id: 'lookout', shown: state => progress(state).hearthUnlocked, done: state => progress(state).lookoutRepaired, step: () => this.repairLookout() },
      { id: 'shed', shown: state => progress(state).homesteadFound, done: state => state.homestead.shedSearched, step: () => this.goTo('homestead') && this.walkTo(HOMESTEAD_SHED) && this.act({ type: 'searchShed' }) },
      { id: 'chickens', shown: state => progress(state).homesteadFound, done: state => state.chickens.discovered, step: () => this.goTo('homestead') && this.walkTo(CHICKEN_SITE) && this.act({ type: 'meetChickens' }) },
      { id: 'lead-chickens', shown: state => state.structures.chickenCoop, done: state => state.chickens.rescued, step: () => this.leadChickens() },
      { id: 'pony', shown: state => progress(state).hillsFound, done: state => state.pony.won !== null, step: () => this.offerPony() },
      { id: 'keep', shown: keepOpen, done: keepFinished, step: () => this.raiseKeep() },
      { id: 'keep-view', shown: keepFinished, done: () => this.hits.has('keep-climbed'), step: () => this.climb() },
      // The castle: a second climb on a later day shows the line of stones, then the road is laid from the quarry to the keep.
      { id: 'castle-line', shown: state => keepFinished(state) && this.hits.has('keep-climbed'), done: isRevealed, step: () => this.seeTheLine() },
      { id: 'castle-road', shown: isRevealed, done: state => state.castle.road >= NEEDS.road, step: () => this.layRoad() },
      { id: 'mine', shown: state => progress(state).pickaxeCrafted, done: state => progress(state).mineBuilt, step: () => this.buildMine() },
      ...(['basket', 'cairn'] as const).map(site => ({
        id: `visit:${site}`,
        shown: (state: GameState) => progress(state).lookoutRepaired,
        done: (state: GameState) => progress(state).discoveries[site],
        step: () => this.makeRoom(4) && this.goTo('camp') && this.walkTo(SITES[site]) && this.act({ type: 'visitSite', siteId: site })
      }))
    ];
  }

  private repairLookout(): boolean {
    const fetched = this.fetchFor(LOOKOUT.cost);
    if (fetched !== null) return fetched;
    return this.goTo('camp') && this.walkTo(LOOKOUT) && this.act({ type: 'repairLookout' });
  }

  private leadChickens(): boolean {
    if (!this.goTo('homestead') || !this.walkTo(CHICKEN_SITE)) return false;
    if (!this.state.chickens.following && !this.act({ type: 'leadChickens' })) return false;
    return this.goTo('camp') && this.walkTo(COOP_SITE, 1);
  }

  private offerPony(): boolean {
    // Apples and vegetables win it. They're not to be hunted for: this waits until there are some in the bag.
    if (this.state.pony.lastOffer === this.state.day) return false;
    if (availableFood(this.state, 'apple') + availableFood(this.state, 'vegetables') === 0) return false;
    if (!this.goTo('hills')) return false;
    const pony = wildPonyAt(this.state) ?? PONY_SPOTS[0];
    this.walkTo(pony, 2.5);
    return !ponyOfferBlocker(this.state) && this.act({ type: 'offerPony' });
  }

  private quarryStone(): boolean {
    return this.goTo('quarry') && ((this.walkTo(RUBBLE_SITE) && this.act({ type: 'gatherRubble' })) || (this.walkTo(QUARRY_SITE) && this.act({ type: 'digQuarry' })));
  }

  private raiseKeep(): boolean {
    const { keep } = this.state;
    if (keep.stones === KEEP_DOOR_AT && !keep.door) {
      if (!this.state.progress.workshop.hinges) return false;
      if (availableWood(this.state) < KEEP_DOOR_WOOD) return this.fetchWood();
      return this.goTo('hills') && this.walkTo(KEEP_SITE) && this.act({ type: 'hangDoor' });
    }
    if (this.state.inventory.stone === 0 && !this.makeRoom(BALANCE.stoneSpaces, 'stone')) return false;
    // Whatever the face gives today is brought up together, then laid.
    if (this.free() >= BALANCE.stoneSpaces && this.quarryStone()) return true;
    return this.state.inventory.stone > 0 && this.goTo('hills') && this.walkTo(KEEP_SITE) && this.act({ type: 'layStone' });
  }

  private climb(): boolean {
    if (this.state.timeOfDay >= nightStart(this.state.day) - 20 || !this.goTo('hills') || !this.walkTo(KEEP_SITE)) return false;
    return this.act({ type: 'enterKeep' });
  }

  private seeTheLine(): boolean {
    const first = this.state.castle.firstClimbDay;
    return (first === null || this.state.day > first) && this.climb();
  }

  private layRoad(): boolean {
    const spot = castleSpots(this.state)[0];
    if (!spot) return false;
    if (this.state.inventory.stone === 0 && !this.makeRoom(BALANCE.stoneSpaces, 'stone')) return false;
    if (this.free() >= BALANCE.stoneSpaces && this.quarryStone()) return true;
    return this.state.inventory.stone > 0 && this.goTo(spot.area) && this.walkTo(spot) && this.act({ type: 'castleWork', site: spot.site });
  }

  private buildMine(): boolean {
    const fetched = this.fetchFor(MINE_COST);
    if (fetched !== null) return fetched;
    return this.goTo('quarry') && this.walkTo(QUARRY_SITE) && this.act({ type: 'buildMine' });
  }

  // ---- Staying alive, and the small daily jobs ----

  private eat(): boolean {
    return this.act({ type: 'eat' }) || this.act({ type: 'eatTrailFood' });
  }

  /** Fish, rabbit and eggs only count once they're cooked, and a cold fire gets lit first, by fetching a log if need be. */
  private cookWhatsCarried(): boolean {
    if (!COOKED_FOODS.some(item => availableFood(this.state, item) > 0) || !this.goHome()) return false;
    if (fuelLeft(this.state) <= 0 && !this.act({ type: 'stokeFire' })) return this.fetchWood();
    return this.act({ type: 'cook' });
  }

  private findFood(): boolean {
    this.saving = null;
    if (!this.makeRoom(1)) return false;
    if (!isWinter(this.state.day) && this.gatherNode('berry')) return true;
    if (isWinter(this.state.day) && this.state.progress.fishingLine) {
      return this.goTo('camp') && this.walkTo(SITES.spring) && this.act({ type: 'fish', roll: this.random() });
    }
    return this.gatherNode('hazel') || this.gatherNode('greens') || this.gatherNode('honey');
  }

  private careForSelf(): boolean {
    const { player } = this.state;
    if (player.hunger <= 45) {
      if (this.cookWhatsCarried() || this.eat()) return true;
      if (isWinter(this.state.day) && !this.state.progress.fishingLine && this.payFor(FISHING_LINE_COST_IN_FULL, { type: 'makeFishingLine' })) return true;
      if (this.state.structures.larder && this.goTo('camp') && this.walkTo(CAMP, 2) && this.eat()) return true;
      if (this.findFood()) return true;
    }
    if (this.state.sickness.sick && this.goHome() && this.act({ type: 'cook' })) return true;
    if (player.energy <= 25) {
      if (this.goHome() && this.act({ type: 'rest' })) return true;
    }
    return false;
  }

  /** In the last of autumn, nuts and rations put by for the winter ahead. */
  private layInFood(): boolean {
    if (!this.state.structures.shelter || season(this.state.day) !== 'autumn' || daysLeftInSeason(this.state.day) > 5) return false;
    if (keptFoodTotal(this.state) >= WINTER_FOOD) return false;
    if (this.state.structures.dryingRack && isInClearing(this.state) && this.act({ type: 'prepareTrailFood' })) return true;
    return this.makeRoom(1) && (this.gatherNode('hazel') || this.gatherNode('berry'));
  }

  /** Food beyond a little for the road goes in the larder, as far as it holds. */
  private putFoodBy(): void {
    if (!this.state.structures.larder) return;
    const carried = (): number => FOOD_ITEMS.reduce((total, item) => total + foodCount(this.state.inventory.food, item), 0);
    for (const item of FOOD_ITEMS) {
      while (carried() > FOOD_TO_CARRY && this.act({ type: 'storeFood', item })) { /* put it by */ }
    }
  }

  private chores(): boolean {
    if (this.state.area !== 'camp' || !isInClearing(this.state) || this.state.player.energy < 35) return false;
    this.putFoodBy();
    const { state } = this;
    const { structures } = state;
    if ((state.chickens.rescued && this.act({ type: 'takeEgg' })) || (structures.bakery && this.act({ type: 'takeLoaf' })) || (structures.beehive && this.act({ type: 'takeHoney' }))) return true;
    if (structures.field) {
      for (let index = 0; index < 4; index++) {
        if (this.act({ type: 'threshStrip', index }) || this.act({ type: 'cutStrip', index }) || this.act({ type: 'sowStrip', index })) return true;
      }
      if (state.field.seed < 4 && state.field.strips.some(strip => strip.sownDay === null) && this.gatherNode('wildGrain')) return true;
    }
    if (structures.vegetableBeds) {
      for (let index = 0; index < 3; index++) {
        if (this.free() >= ROOM_FOR_HARVEST && (this.act({ type: 'harvestBed', index }) || this.act({ type: 'sowBed', index }))) return true;
      }
      if (this.lastChoresAt !== state.day && structures.well) {
        this.lastChoresAt = state.day;
        if (this.act({ type: 'drawWater' })) return true;
      }
    }
    if (structures.windmill && this.act({ type: 'millGrain' })) return true;
    if (structures.sheepPen && (this.act({ type: 'feedSheep' }) || this.act({ type: 'shearFlock' }))) return true;
    if (structures.loom) for (const item of ['blanket', 'jumper', 'rug'] as const) if (this.act({ type: 'weave', item })) return true;
    if (offerFor(state) && this.act({ type: 'befriend' })) return true;
    return this.plantOrPick();
  }

  private plantOrPick(): boolean {
    if (!this.state.structures.orchard) return false;
    for (let spot = 0; spot < ORCHARD_SPOTS.length; spot++) {
      if (spotAction({ ...this.state, player: { ...this.state.player, ...ORCHARD_SPOTS[spot] } }, spot) && this.walkTo(ORCHARD_SPOTS[spot], 1)) {
        const action = spotAction(this.state, spot);
        if (action && this.act(action)) return true;
      }
    }
    return false;
  }

  /** In autumn, apples from the old homestead are what the orchard and the pony both start from. */
  private fetchApples(): boolean {
    if (season(this.state.day) !== 'autumn' || !this.state.progress.homesteadFound || this.state.orchard.pips >= 3 || this.free() < 1) return false;
    if (!this.goTo('homestead') || !this.walkTo(APPLE_TREE)) return false;
    if (!this.act({ type: 'gatherApples' })) return false;
    // Eating one keeps its pips; the rest are for the pony.
    return (this.state.orchard.pips < 6 && this.act({ type: 'eat', item: 'apple' })) || true;
  }

  /** The fox comes round at nightfall, and in winter the wolves after dark, for whoever leaves something out. */
  private leaveAnOffering(night: number): void {
    const friends = this.state.companion.friends;
    if (friends.fox !== null && friends.wolf !== null) return;
    const day = this.state.day;
    while (this.state.day === day && this.state.timeOfDay < night + OFFERING_WAIT && !this.state.ending) {
      if (offerFor(this.state) && this.act({ type: 'befriend' })) return;
      this.tick(1);
    }
  }

  private settleForTheNight(): void {
    const night = nightStart(this.state.day);
    if (keepFinished(this.state) && !this.hits.has('keep-night') && this.goTo('hills') && this.walkTo(KEEP_SITE)) {
      while (this.state.timeOfDay < night && !this.state.ending) this.wait(1);
      this.act({ type: 'enterKeep' });
      return;
    }
    if (this.state.area === 'hills' && keepFinished(this.state) && this.walkTo(KEEP_SITE)) {
      while (this.state.timeOfDay < night && !this.state.ending) this.wait(1);
      this.act({ type: 'enterKeep' });
      return;
    }
    this.goHome();
    this.leaveAnOffering(night);
    if (!livesInHouse(this.state) && isAtCamp(this.state)) {
      const remaining = BALANCE.daySeconds - Math.max(this.state.timeOfDay, night);
      const burn = this.state.progress.nextStormDay === this.state.day || isWinter(this.state.day) ? 2 : 1;
      const perLog = this.state.structures.hearth ? BALANCE.hearthFireSecondsPerWood : BALANCE.fireSecondsPerWood;
      while (this.state.fireFuel < remaining * burn + perLog / 2 && availableWood(this.state) > 0 && this.act({ type: 'stokeFire' })) { /* burn what the night needs */ }
    }
    while (this.state.timeOfDay < night && this.state.timeOfDay > night - 45 && !this.state.ending) this.wait(1);
    if (this.act({ type: 'sleep' })) return;
    // Before there's a shelter the night is sat out by the fire.
    const day = this.state.day;
    while (this.state.day === day && !this.state.ending) {
      if (!this.act({ type: 'rest' })) this.wait(5);
    }
  }

  /** Wood for tonight comes before anything else on a day that needs a lot of it. */
  private woodForTonight(): boolean {
    if (!this.state.structures.shelter) return false;
    if (livesInHouse(this.state)) return availableWood(this.state) < WOOD_FOR_THE_HOUSE && this.fetchWood();
    const night = nightStart(this.state.day);
    const stormy = this.state.progress.nextStormDay === this.state.day || isWinter(this.state.day);
    if (!stormy || this.state.timeOfDay < night - 100) return false;
    const perLog = this.state.structures.hearth ? BALANCE.hearthFireSecondsPerWood : BALANCE.fireSecondsPerWood;
    const needed = Math.ceil((BALANCE.daySeconds - night) * 2 / perLog) + 1;
    return availableWood(this.state) + Math.floor(this.state.fireFuel / perLog) < needed && this.fetchWood();
  }

  // ---- The run ----

  private openTasks(): Task[] {
    const open = this.tasks.filter(task => !task.done(this.state) && task.shown(this.state) && (this.waiting.get(task.id) ?? 0) < this.state.day);
    // A roof comes before anything, and a fishing line before the ice: the journal and the forecast both say so.
    const urgent = open.filter(task => task.id === 'build:shelter' || (task.id === 'tool:line' && (isWinter(this.state.day) || (season(this.state.day) === 'autumn' && daysLeftInSeason(this.state.day) <= 5))));
    if (urgent.length > 0) return urgent;
    if (this.style === 'orderly') return open;
    const shuffled = [...open];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(this.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  private work(): void {
    if (this.current && !this.current.done(this.state) && (this.waiting.get(this.current.id) ?? 0) < this.state.day) {
      if (this.current.step()) return;
      this.waiting.set(this.current.id, this.state.day);
    }
    this.current = null;
    for (const task of this.openTasks()) {
      if (task.step()) {
        this.current = task;
        return;
      }
      this.waiting.set(task.id, this.state.day);
    }
    const shown = this.tasks.filter(task => !task.done(this.state) && task.shown(this.state)).map(task => task.id);
    if (!this.finished()) (shown.length === 0 ? this.nothingOfferedDays : this.allWaitingDays).add(this.state.day);
    this.wait(5);
  }

  private turn(): void {
    const dusk = nightStart(this.state.day) - 25;
    if (this.state.timeOfDay >= dusk) {
      this.settleForTheNight();
      return;
    }
    if (this.careForSelf() || this.woodForTonight() || this.chores() || this.fetchApples() || this.layInFood()) return;
    this.work();
    if (this.style === 'unhurried') this.tick(DAWDLE_SECONDS);
  }

  private finished(): boolean {
    return MILESTONES_THAT_END.every(id => this.hits.has(id));
  }

  /** Plays to the finished keep, then on for a while, so whatever else the game offers gets a chance to be taken up. */
  run(maxDays: number, daysAfter = DAYS_AFTER_THE_KEEP): RunResult {
    let stopAt = maxDays;
    let turnsLeft = maxDays * 4000;
    while (!this.state.ending && this.state.day <= stopAt && turnsLeft-- > 0) {
      if (this.finished() && stopAt === maxDays) stopAt = this.state.day + daysAfter;
      if (this.finished() && this.tasks.every(task => task.done(this.state))) break;
      this.turn();
    }
    let ended: RunResult['ended'] = 'out of days';
    if (this.state.ending) ended = 'died';
    else if (this.finished()) ended = 'finished';
    return {
      seed: this.seed,
      style: this.style,
      hits: [...this.hits.values()],
      ended,
      days: this.state.day,
      playMinutes: this.playMinutes,
      idleMinutesByYear: Array.from(this.idle, minutes => Math.round(minutes ?? 0)),
      fullBagRefusals: this.fullBag,
      tooBigForBag: this.tooBigForBag,
      sickDays: this.sickDays,
      foodShortDays: this.foodShortDays,
      offeredButRefused: Object.fromEntries(this.refused),
      nothingOfferedDays: this.nothingOfferedDays.size,
      allWaitingDays: this.allWaitingDays.size,
      neverDone: this.tasks.filter(task => !task.done(this.state)).map(task => task.id),
      neverShown: this.tasks.filter(task => !task.done(this.state) && !task.shown(this.state)).map(task => task.id),
      journalHints: this.journalHints,
      noneLeftDays: this.noneLeftDays,
      unbuiltWhenNoneLeft: [...this.unbuiltWhenNoneLeft]
    };
  }
}

const DAYS_AFTER_THE_KEEP = 40;
const MILESTONES_THAT_END = ['keep-finished', 'keep-night', 'keep-climbed'];
