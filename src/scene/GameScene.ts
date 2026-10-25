import Phaser from 'phaser';
import { BALANCE, LOOKOUT, SITES, type GameState, type SiteId, type TreeNode } from '../game/state';
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
import { closestGatherable, hasArrived, moveStep, nextWalk, pickTapTarget, targetAction, type TapTarget } from './tapTarget';
import { palette } from '../art/palette';
import { sitePrompt } from '../game/sitePrompt';
import type { SoundCue } from '../game/soundscape';

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
    const horizontal = Number(this.keys.D.isDown || this.keys.RIGHT.isDown) - Number(this.keys.A.isDown || this.keys.LEFT.isDown);
    const vertical = Number(this.keys.S.isDown || this.keys.DOWN.isDown) - Number(this.keys.W.isDown || this.keys.UP.isDown);
    const walking = Boolean(horizontal || vertical);
    if (walking) {
      this.facing = facingFromInput(horizontal, vertical, this.facing);
      this.visualAction = undefined;
      this.walkTarget = nextWalk(this.walkTarget, { kind: 'keyMove' });
    }
    if (horizontal || vertical) {
      const length = Math.hypot(horizontal, vertical);
      this.perform({ type: 'move', dx: horizontal / length * dt * 3.5, dy: vertical / length * dt * 3.5 }, false);
    }
    const tapWalking = this.walkTowardTarget(dt);
    if (Phaser.Input.Keyboard.JustDown(this.keys.E)) {
      const found = closestGatherable(this.state);
      if (found?.kind === 'node') this.perform({ type: 'gather', nodeId: found.node.id });
      else if (found?.kind === 'pile') this.perform({ type: 'pickUpStone', pileId: found.pile.id });
      else if (isAtCamp(this.state)) this.perform({ type: 'rest' });
      else {
        this.cancelWalk();
        this.onFeedback('Nothing to gather here.');
      }
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.F)) this.perform({ type: 'stokeFire' });
    if (Phaser.Input.Keyboard.JustDown(this.keys.R)) this.perform({ type: 'rest' });
    if (Phaser.Input.Keyboard.JustDown(this.keys.Q)) this.perform({ type: 'eat' });
    if (Phaser.Input.Keyboard.JustDown(this.keys.T)) this.perform({ type: 'eatTrailFood' });
    if (Phaser.Input.Keyboard.JustDown(this.keys.P)) this.perform({ type: 'prepareTrailFood' });
    if (Phaser.Input.Keyboard.JustDown(this.keys.C)) this.perform({ type: 'cook' });
    if (Phaser.Input.Keyboard.JustDown(this.keys.G)) this.perform({ type: 'stargaze' });
    if (Phaser.Input.Keyboard.JustDown(this.keys.Z)) this.perform({ type: 'sleep' });
    if (Phaser.Input.Keyboard.JustDown(this.keys.L)) this.perform({ type: 'repairLookout' });
    if (Phaser.Input.Keyboard.JustDown(this.keys.X)) {
      const tree = this.closestTree();
      if (tree) this.perform({ type: 'chopTree', treeId: tree.id });
      else {
        this.cancelWalk();
        this.onFeedback('Move closer to a mature tree.');
      }
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.V)) this.visitNearestSite();
    const beforeTick = this.state;
    this.state = advanceTime(this.state, dt);
    this.reportWeather(beforeTick, this.state);
    const visual = selectSurvivorVisual({ facing: this.facing, moving: walking || tapWalking, warmth: this.state.player.warmth,
      nowMs: this.time.now, action: this.visualAction });
    if (this.playerSprite.texture.key !== visual.texture) this.playerSprite.setTexture(visual.texture);
    this.playerSprite.setPosition(Math.round(worldX(this.state.player.x)), Math.round(worldY(this.state.player.y)));
    this.playerSprite.setDepth(playerVisualDepth(this.state));
    this.playerSprite.setFlipX(visual.flipX);
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

  perform(action: GameAction, announce = true): void {
    if (action.type !== 'move') this.walkTarget = nextWalk(this.walkTarget, { kind: 'action' });
    const before = this.state;
    const result = applyAction(before, action);
    this.state = result.state;
    this.showMorningFrost(before, this.state);
    if (result.state !== before) {
      if (action.type === 'gather' || action.type === 'chopTree' || action.type === 'pickUpStone') this.onSound('gather');
      if (action.type === 'build') this.onSound('build');
      if (action.type === 'gather') {
        const node = before.nodes.find(item => item.id === action.nodeId);
        if (node) this.effects?.trigger('gather', this.time.now, node.x, node.y, node.kind);
      }
      if (action.type === 'chopTree') {
        const tree = before.trees.find(item => item.id === action.treeId);
        if (tree) this.effects?.trigger('gather', this.time.now, tree.x, tree.y, 'branch');
      }
      if (action.type === 'pickUpStone') {
        const pile = before.stonePiles.find(item => item.id === action.pileId);
        if (pile) this.effects?.trigger('gather', this.time.now, pile.x, pile.y, 'stone');
      }
      if (action.type === 'cook' || action.type === 'stargaze')
        this.effects?.trigger(action.type, this.time.now, this.state.player.x, this.state.player.y);
    }
    if (result.state !== before && (action.type === 'gather' || action.type === 'rest' || action.type === 'cook' || action.type === 'stargaze'))
      this.visualAction = { kind: action.type, startedAtMs: this.time.now };
    if (result.state !== before && (action.type === 'chopTree' || action.type === 'pickUpStone')) this.visualAction = { kind: 'gather', startedAtMs: this.time.now };
    if (action.type === 'gather') {
      const node = before.nodes.find(item => item.id === action.nodeId);
      const remaining = this.state.nodes.find(item => item.id === action.nodeId)?.amount;
      if (node?.kind === 'berry' && remaining !== undefined && remaining < node.amount)
        this.gatheredBerry = { id: node.id, atMs: this.time.now };
    }
    const weatherMessage = this.weatherMessage(before, this.state);
    if (weatherMessage) this.onFeedback(weatherMessage);
    else if (announce && result.message) this.onFeedback(result.message);
    if (announce) {
      this.onStateChange(this.state, 'action');
      if (this.playerSprite) this.paintObjects();
    }
  }

  getPrompt(): string {
    const found = closestGatherable(this.state);
    const tree = this.closestTree();
    const site = this.closestSite();
    const canSleep = !sleepBlocker(this.state);
    const byLookout = Math.hypot(this.state.player.x - LOOKOUT.x, this.state.player.y - LOOKOUT.y) <= BALANCE.interactionRadius;
    let lookoutPrompt = '';
    if (byLookout && this.state.progress.lookoutRepaired) lookoutPrompt = 'The lookout stands again';
    else if (byLookout && this.state.progress.hearthUnlocked) lookoutPrompt = 'L  Repair lookout';
    else if (byLookout) lookoutPrompt = 'Lookout · weather the cold front first';
    let treePrompt = '';
    if (tree && tree.readyDay > this.state.day) treePrompt = `Stump · regrows day ${tree.readyDay}`;
    else if (tree && this.state.progress.axeCrafted) treePrompt = 'X  Chop mature tree';
    else if (tree) treePrompt = 'Mature tree · craft an axe at camp';
    const nearbySitePrompt = site ? sitePrompt(this.state, site.id) : '';
    if (found) {
      let gather = 'E  Pick up fallen branches';
      if (found.kind === 'pile') gather = `E  Pick up stone (×${found.pile.count})`;
      else if (found.node.kind === 'berry') gather = 'E  Pick berries';
      else if (found.node.kind === 'fiber') gather = 'E  Gather fiber';
      else if (found.node.kind === 'stone') gather = 'E  Collect stone';
      if (lookoutPrompt) return `${gather} · ${lookoutPrompt}`;
      if (nearbySitePrompt) return `${gather} · ${nearbySitePrompt}`;
      if (treePrompt) return `${gather} · ${treePrompt}`;
      return canSleep ? `${gather} · Z Sleep until morning` : gather;
    }
    if (lookoutPrompt) return lookoutPrompt;
    if (nearbySitePrompt) return nearbySitePrompt;
    if (treePrompt) return treePrompt;
    if (isAtCamp(this.state)) {
      if (canSleep) return 'At camp · C Cook · G Stargaze · Z Sleep · F Fire';
      if (this.state.timeOfDay >= BALANCE.nightStart) return 'At camp · C Cook · G Stargaze · F Fire · R Rest';
      return 'At camp · F Fire · R Rest · Click an upgrade to build';
    }
    return 'WASD / arrows  Move';
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
    return this.state.trees
      .filter(tree => Math.hypot(tree.x - this.state.player.x, tree.y - this.state.player.y) <= BALANCE.interactionRadius)
      .sort((a, b) => Math.hypot(a.x - this.state.player.x, a.y - this.state.player.y) - Math.hypot(b.x - this.state.player.x, b.y - this.state.player.y))[0];
  }

  private closestSite(): { id: SiteId; name: string; x: number; y: number } | undefined {
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
