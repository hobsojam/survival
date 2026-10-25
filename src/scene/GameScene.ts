import Phaser from 'phaser';
import { BALANCE, LOOKOUT, SITES, type GameState, type ResourceKind, type SiteId, type TreeNode } from '../game/state';
import { advanceTime, applyAction, isAtCamp, isColdNight, sleepBlocker, type GameAction } from '../game/rules';
import { TILE, worldX, worldY, drawTerrain } from './art';
import { terrainKey } from './map';
import { sceneVisuals, playerVisualDepth, WEATHER_DEPTH } from './visuals';
import { sprites } from '../art/sprites';
import { AmbientLife } from './ambientLife';
import { registerSpriteTextures } from '../art/textures';
import { LOGICAL_WIDTH, LOGICAL_HEIGHT } from './pixelScale';
import { facingFromInput, selectSurvivorVisual, type Facing, type SurvivorAction } from './survivorVisual';
import { SceneEffects } from './SceneEffects';
import { SceneLighting } from './SceneLighting';
import { closestGatherable, hasArrived, moveStep, nextWalk, pickTapTarget, targetAction, type Gatherable, type TapTarget } from './tapTarget';
import { palette } from '../art/palette';
import { sitePrompt } from '../game/sitePrompt';
import { CAMP_EXIT, QUARRY_EXIT, QUARRY_SITE, RUBBLE_SITE, pathOpen } from '../game/areas';
import type { SoundCue } from '../game/soundscape';

/** Single-press keys that map straight to an action; E, X and V need a target and are handled apart. */
const KEY_ACTIONS: [string, GameAction][] = [
  ['F', { type: 'stokeFire' }], ['R', { type: 'rest' }], ['Q', { type: 'eat' }], ['T', { type: 'eatTrailFood' }],
  ['P', { type: 'prepareTrailFood' }], ['C', { type: 'cook' }], ['G', { type: 'stargaze' }], ['Z', { type: 'sleep' }],
  ['L', { type: 'repairLookout' }]
];

const ACTION_POSES: Partial<Record<GameAction['type'], SurvivorAction>> = {
  gather: 'gather', rest: 'rest', cook: 'cook', stargaze: 'stargaze',
  chopTree: 'gather', pickUpStone: 'gather', gatherRubble: 'gather', digQuarry: 'gather'
};

const GATHER_PROMPTS: Record<ResourceKind, string> = {
  branch: 'E  Pick up fallen branches', berry: 'E  Pick berries', fiber: 'E  Gather fiber', stone: 'E  Collect stone'
};

function gatherPrompt(found: Gatherable): string {
  if (found.kind === 'pile') return `E  Pick up stone (×${found.pile.count})`;
  return found.kind === 'node' ? GATHER_PROMPTS[found.node.kind] : GATHER_PROMPTS.branch;
}

function gatherAction(found: Gatherable | undefined): GameAction | undefined {
  switch (found?.kind) {
    case 'node': return { type: 'gather', nodeId: found.node.id };
    case 'pile': return { type: 'pickUpStone', pileId: found.pile.id };
    case 'rubble': return { type: 'gatherRubble' };
    case 'quarry': return { type: 'digQuarry' };
    default: return undefined;
  }
}

/** Where a gathering action happened, read from the state before it, for the pick-up sparkle. */
function gatherSpot(action: GameAction, before: GameState): { x: number; y: number; kind: ResourceKind } | undefined {
  switch (action.type) {
    case 'gather': return before.nodes.find(item => item.id === action.nodeId);
    case 'chopTree': {
      const tree = before.trees.find(item => item.id === action.treeId);
      return tree && { x: tree.x, y: tree.y, kind: 'branch' };
    }
    case 'pickUpStone': {
      const pile = before.stonePiles.find(item => item.id === action.pileId);
      return pile && { x: pile.x, y: pile.y, kind: 'stone' };
    }
    case 'gatherRubble': return { ...RUBBLE_SITE, kind: 'stone' };
    case 'digQuarry': return { ...QUARRY_SITE, kind: 'stone' };
    default: return undefined;
  }
}

export class GameScene extends Phaser.Scene {
  private state: GameState;
  private readonly onStateChange: (state: GameState, cause: 'action' | 'tick') => void;
  private readonly onFeedback: (message: string) => void;
  private readonly onSound: (cue: SoundCue) => void;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private playerSprite!: Phaser.GameObjects.Image;
  private objects = new Map<string, Phaser.GameObjects.Image>();
  private gatheredBerry?: { id: string; atMs: number };
  private lighting!: SceneLighting;
  private ambient!: AmbientLife;
  private effects!: SceneEffects;
  private hudElapsed = 0;
  private facing: Facing = 'down';
  private visualAction?: { kind: SurvivorAction; startedAtMs: number };
  private walkTarget?: TapTarget;
  private tapGate: () => boolean = () => true;
  private terrain: Phaser.GameObjects.GameObject[] = [];
  private terrainShown = '';
  private areaShown = '';

  constructor(state: GameState, onStateChange: (state: GameState, cause: 'action' | 'tick') => void, onFeedback: (message: string) => void, onSound: (cue: SoundCue) => void = () => undefined) {
    super({ key: 'GameScene' });
    this.state = state;
    this.onStateChange = onStateChange;
    this.onFeedback = onFeedback;
    this.onSound = onSound;
  }

  create(): void {
    registerSpriteTextures(this);
    this.redrawTerrain();
    this.ambient = new AmbientLife(this);
    this.effects = new SceneEffects(this);
    const playerArt = sprites.survivor;
    this.playerSprite = this.add.image(Math.round(worldX(this.state.player.x)), Math.round(worldY(this.state.player.y)), 'survivor:idleDown0')
      .setOrigin(playerArt.anchor[0] / playerArt.size[0], playerArt.anchor[1] / playerArt.size[1]);
    this.playerSprite.setDepth(playerVisualDepth(this.state));
    this.cameras.main.startFollow(this.playerSprite, true, 0.09, 0.09);
    this.areaShown = this.state.area;
    this.cameras.main.setZoom(1);
    this.cameras.main.roundPixels = true;
    this.lighting = new SceneLighting(this, LOGICAL_WIDTH, LOGICAL_HEIGHT);
    this.keys = this.input.keyboard!.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,E,F,R,Q,T,P,C,G,Z,L,X,V') as Record<string, Phaser.Input.Keyboard.Key>;
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      // Right and middle clicks don't walk; touches report button 0.
      if (pointer.button === 0) this.handleTap(pointer.worldX, pointer.worldY);
    });
    this.paintObjects();
    this.onStateChange(this.state, 'tick');
  }

  update(_time: number, delta: number): void {
    if (document.hidden || !this.keys) return;
    if (terrainKey(this.state) !== this.terrainShown) this.redrawTerrain();
    const dt = Math.min(delta / 1000, 0.05);
    const walking = this.walkFromKeys(dt);
    const tapWalking = this.walkTowardTarget(dt);
    this.handleActionKeys();
    const beforeTick = this.state;
    this.state = advanceTime(this.state, dt);
    this.reportWeather(beforeTick, this.state);
    this.syncPlayerSprite(walking || tapWalking);
    this.paintObjects();
    this.ambient.update(this.state, dt, this.time.now);
    this.effects.update(this.state, this.time.now);
    this.lighting.update(this.state, this.time.now);
    this.hudElapsed += delta;
    if (this.hudElapsed >= 250) {
      this.onStateChange(this.state, 'tick');
      this.hudElapsed = 0;
    }
  }

  /** Moves the survivor by the held arrow or WASD keys and reports whether any were held. */
  private walkFromKeys(dt: number): boolean {
    const keys = this.keys!;
    const horizontal = Number(keys.D.isDown || keys.RIGHT.isDown) - Number(keys.A.isDown || keys.LEFT.isDown);
    const vertical = Number(keys.S.isDown || keys.DOWN.isDown) - Number(keys.W.isDown || keys.UP.isDown);
    if (!horizontal && !vertical) return false;
    this.facing = facingFromInput(horizontal, vertical, this.facing);
    this.visualAction = undefined;
    this.walkTarget = nextWalk(this.walkTarget, { kind: 'keyMove' });
    const length = Math.hypot(horizontal, vertical);
    this.perform({ type: 'move', dx: horizontal / length * dt * 3.5, dy: vertical / length * dt * 3.5 }, false);
    return true;
  }

  private handleActionKeys(): void {
    const pressed = (key: string): boolean => Phaser.Input.Keyboard.JustDown(this.keys![key]);
    if (pressed('E')) this.pressGather();
    for (const [key, action] of KEY_ACTIONS) if (pressed(key)) this.perform(action);
    if (pressed('X')) this.pressChop();
    if (pressed('V')) this.visitNearestSite();
  }

  private pressGather(): void {
    const action = gatherAction(closestGatherable(this.state)) ?? (isAtCamp(this.state) ? { type: 'rest' as const } : undefined);
    if (action) this.perform(action);
    else {
      this.cancelWalk();
      this.onFeedback('Nothing to gather here.');
    }
  }

  private pressChop(): void {
    const tree = this.closestTree();
    if (tree) this.perform({ type: 'chopTree', treeId: tree.id });
    else {
      this.cancelWalk();
      this.onFeedback('Move closer to a mature tree.');
    }
  }

  private syncPlayerSprite(moving: boolean): void {
    const visual = selectSurvivorVisual({ facing: this.facing, moving, warmth: this.state.player.warmth,
      nowMs: this.time.now, action: this.visualAction });
    if (this.playerSprite.texture.key !== visual.texture) this.playerSprite.setTexture(visual.texture);
    this.playerSprite.setPosition(Math.round(worldX(this.state.player.x)), Math.round(worldY(this.state.player.y)));
    this.playerSprite.setDepth(playerVisualDepth(this.state));
    this.playerSprite.setFlipX(visual.flipX);
    if (this.state.area !== this.areaShown) {
      // Crossing to the other area snaps the camera instead of panning across the map.
      this.areaShown = this.state.area;
      this.cameras.main.centerOn(this.playerSprite.x, this.playerSprite.y);
    }
  }

  perform(action: GameAction, announce = true): void {
    if (action.type !== 'move') this.walkTarget = nextWalk(this.walkTarget, { kind: 'action' });
    const before = this.state;
    const result = applyAction(before, action);
    this.state = result.state;
    this.showMorningFrost(before, this.state);
    if (result.state !== before) this.showActionDone(action, before);
    if (action.type === 'gather') this.noteBerryPicked(action.nodeId, before);
    const weatherMessage = this.weatherMessage(before, this.state);
    if (weatherMessage) this.onFeedback(weatherMessage);
    else if (announce && result.message) this.onFeedback(result.message);
    if (announce) {
      this.onStateChange(this.state, 'action');
      if (this.playerSprite) this.paintObjects();
    }
  }

  /** Plays the effect and survivor pose for an action that changed the game. */
  private showActionDone(action: GameAction, before: GameState): void {
    const spot = gatherSpot(action, before);
    if (spot) this.onSound('gather');
    if (action.type === 'build') this.onSound('build');
    if (spot) this.effects?.trigger('gather', this.time.now, spot.x, spot.y, spot.kind);
    if (action.type === 'cook' || action.type === 'stargaze')
      this.effects?.trigger(action.type, this.time.now, this.state.player.x, this.state.player.y);
    const pose = ACTION_POSES[action.type];
    if (pose) this.visualAction = { kind: pose, startedAtMs: this.time.now };
  }

  private noteBerryPicked(nodeId: string, before: GameState): void {
    const node = before.nodes.find(item => item.id === nodeId);
    const remaining = this.state.nodes.find(item => item.id === nodeId)?.amount;
    if (node?.kind === 'berry' && remaining !== undefined && remaining < node.amount)
      this.gatheredBerry = { id: node.id, atMs: this.time.now };
  }

  getPrompt(): string {
    const found = closestGatherable(this.state);
    if (this.state.area === 'quarry') return this.quarryPrompt(found);
    const site = this.closestSite();
    const nearby = this.lookoutPrompt() || (site ? sitePrompt(this.state, site.id) : '') || this.treePrompt();
    if (found) {
      const gather = gatherPrompt(found);
      if (nearby) return `${gather} · ${nearby}`;
      return sleepBlocker(this.state) ? gather : `${gather} · Z Sleep until morning`;
    }
    return nearby || this.campPrompt();
  }

  private lookoutPrompt(): string {
    if (!this.within(LOOKOUT)) return '';
    if (this.state.progress.lookoutRepaired) return 'The lookout stands again';
    if (this.state.progress.hearthUnlocked) return 'L  Repair lookout';
    return 'Lookout · weather the cold front first';
  }

  private treePrompt(): string {
    const tree = this.closestTree();
    if (!tree) return '';
    if (tree.readyDay > this.state.day) return `Stump · regrows day ${tree.readyDay}`;
    if (this.state.progress.axeCrafted) return 'X  Chop mature tree';
    return 'Mature tree · craft an axe at camp';
  }

  private campPrompt(): string {
    if (pathOpen(this.state) && this.within(CAMP_EXIT)) return 'Walk west to leave camp';
    if (!isAtCamp(this.state)) return 'WASD / arrows  Move';
    if (!sleepBlocker(this.state)) return 'At camp · C Cook · G Stargaze · Z Sleep · F Fire';
    if (this.state.timeOfDay >= BALANCE.nightStart) return 'At camp · C Cook · G Stargaze · F Fire · R Rest';
    return 'At camp · F Fire · R Rest · Click an upgrade to build';
  }

  private quarryPrompt(found: Gatherable | undefined): string {
    if (found?.kind === 'pile') return `E  Pick up stone (×${found.pile.count})`;
    if (found?.kind === 'rubble') return 'E  Gather rubble';
    if (found?.kind === 'quarry') return this.state.progress.pickaxeCrafted ? 'E  Dig the quarry' : 'Quarry · craft a pickaxe at the toolshed';
    if (this.within(QUARRY_SITE) && this.state.quarryReadyDay > this.state.day) return 'Quarry · worked out until morning';
    if (this.within(QUARRY_EXIT)) return 'Walk east to return to camp';
    return 'WASD / arrows  Move';
  }

  private within(point: { x: number; y: number }): boolean {
    return Math.hypot(this.state.player.x - point.x, this.state.player.y - point.y) <= BALANCE.interactionRadius;
  }

  getState(): GameState { return this.state; }

  /** Swallows taps while the gate says no, such as when a phone sheet is open. */
  setTapGate(gate: () => boolean): void {
    this.tapGate = gate;
  }

  cancelWalk(): void {
    this.walkTarget = nextWalk(this.walkTarget, { kind: 'action' });
  }

  visitNearestSite(): void {
    const site = this.closestSite();
    if (site) this.perform({ type: 'visitSite', siteId: site.id });
    else {
      this.cancelWalk();
      this.onFeedback('Follow a path and move closer to a place to explore.');
    }
  }

  resizeViewport(width: number, height: number): void {
    if (this.lighting) this.lighting.resize(width, height);
  }

  /** Swaps the terrain when the area changes or the west path opens. */
  private redrawTerrain(): void {
    for (const object of this.terrain) object.destroy();
    if (this.terrainShown) this.textures.remove(`terrain-${this.terrainShown}`);
    this.terrainShown = terrainKey(this.state);
    this.terrain = drawTerrain(this, this.state);
    this.cameras.main.setBounds(0, 0, BALANCE.mapWidth * TILE, BALANCE.mapHeight * TILE);
  }

  private handleTap(pixelX: number, pixelY: number): void {
    if (!this.tapGate()) return;
    const target = pickTapTarget(this.state, pixelX / TILE - 0.5, pixelY / TILE - 0.5);
    this.showTapMarker(target);
    this.walkTarget = nextWalk(this.walkTarget, { kind: 'tap', target });
    if (!hasArrived(this.state, target)) return;
    const action = targetAction(target);
    // Already in range: act now (which also ends the walk), or simply stop on tapped ground.
    if (action) this.perform(action);
    else this.walkTarget = undefined;
  }

  /** Walks one frame toward the tapped target, acting once on arrival. Returns whether the survivor moved. */
  private walkTowardTarget(dt: number): boolean {
    const target = this.walkTarget;
    if (!target) return false;
    if (hasArrived(this.state, target)) {
      this.walkTarget = undefined;
      const action = targetAction(target);
      if (action) this.perform(action);
      return false;
    }
    const step = moveStep(this.state, target, dt);
    this.facing = facingFromInput(step.dx, step.dy, this.facing);
    this.visualAction = undefined;
    this.perform({ type: 'move', ...step }, false);
    return true;
  }

  private showTapMarker(target: TapTarget): void {
    const ring = this.add.graphics({ x: Math.round(worldX(target.x)), y: Math.round(worldY(target.y)) })
      .lineStyle(1, Phaser.Display.Color.HexStringToColor(palette.paper).color, 1)
      .strokeCircle(0, 0, 5)
      .setDepth(WEATHER_DEPTH + 1);
    this.tweens.add({ targets: ring, alpha: 0, scale: 1.4, duration: 400, onComplete: () => ring.destroy() });
  }

  private closestTree(): TreeNode | undefined {
    if (this.state.area !== 'camp') return undefined;
    return this.state.trees
      .filter(tree => Math.hypot(tree.x - this.state.player.x, tree.y - this.state.player.y) <= BALANCE.interactionRadius)
      .sort((a, b) => Math.hypot(a.x - this.state.player.x, a.y - this.state.player.y) - Math.hypot(b.x - this.state.player.x, b.y - this.state.player.y))[0];
  }

  private closestSite(): { id: SiteId; name: string; x: number; y: number } | undefined {
    if (this.state.area !== 'camp') return undefined;
    return (Object.keys(SITES) as SiteId[])
      .map(id => ({ id, ...SITES[id] }))
      .filter(site => Math.hypot(site.x - this.state.player.x, site.y - this.state.player.y) <= BALANCE.interactionRadius)
      .sort((a, b) => Math.hypot(a.x - this.state.player.x, a.y - this.state.player.y) - Math.hypot(b.x - this.state.player.x, b.y - this.state.player.y))[0];
  }

  private paintObjects(): void {
    const shown = new Set<string>();
    for (const visual of sceneVisuals(this.state, this.time.now, this.gatheredBerry)) {
      shown.add(visual.id);
      let image = this.objects.get(visual.id);
      const [name] = visual.texture.split(':');
      const art = sprites[name];
      if (!image) {
        image = this.add.image(visual.x, visual.y, visual.texture)
          .setOrigin(art.anchor[0] / art.size[0], art.anchor[1] / art.size[1]);
        this.objects.set(visual.id, image);
      }
      if (image.texture.key !== visual.texture) image.setTexture(visual.texture);
      image.setOrigin(art.anchor[0] / art.size[0], art.anchor[1] / art.size[1])
        .setPosition(visual.x, visual.y).setDepth(visual.depth);
    }
    for (const [id, image] of this.objects) if (!shown.has(id)) { image.destroy(); this.objects.delete(id); }
  }

  private weatherMessage(before: GameState, after: GameState): string | null {
    if (!isColdNight(before) && isColdNight(after)) return 'The cold front has arrived. Keep the fire alive until dawn.';
    if (isColdNight(before) && !isColdNight(after)) return after.progress.hearthUnlocked
      ? 'You weathered the cold night! The stone hearth is now unlocked.'
      : `The fire did not last. Recover today; another cold front comes on day ${after.progress.nextStormDay}.`;
    return null;
  }

  private reportWeather(before: GameState, after: GameState): void {
    this.showMorningFrost(before, after);
    const message = this.weatherMessage(before, after);
    if (message) this.onFeedback(message);
  }

  private showMorningFrost(before: GameState, after: GameState): void {
    if (isColdNight(before) && !isColdNight(after) && !after.progress.hearthUnlocked)
      this.effects.trigger('frost', this.time.now, BALANCE.campX, BALANCE.campY);
  }
}
