import Phaser from 'phaser';
import { BALANCE, type GameState } from '../game/state';
import { advanceTime, applyAction, isColdNight, type GameAction } from '../game/rules';
import { TILE, worldX, worldY, drawTerrain } from './art';
import { terrainKey } from './map';
import { sceneVisuals, playerVisualDepth, WEATHER_DEPTH } from './visuals';
import { sprites } from '../art/sprites';
import { AmbientLife } from './ambientLife';
import { registerSpriteTextures } from '../art/textures';
import { seasonMessage } from '../game/calendar';
import { LOGICAL_WIDTH, LOGICAL_HEIGHT } from './pixelScale';
import { facingFromInput, selectSurvivorVisual, type Facing, type SurvivorAction } from './survivorVisual';
import { SceneEffects } from './SceneEffects';
import { SceneLighting } from './SceneLighting';
import { hasArrived, moveStep, nextWalk, pickTapTarget, targetAction, type TapTarget } from './tapTarget';
import { palette } from '../art/palette';
import type { SoundCue } from '../game/soundscape';
import { ALL_NEED_ALERTS, needAlerts, needsMessage, type NeedAlert } from '../game/needs';
import { KEY_ACTIONS, actionPose, closestSite, closestTree, gatherKeyAction, gatherSpot, promptFor } from './prompts';

export class GameScene extends Phaser.Scene {
  private state: GameState;
  private readonly onStateChange: (state: GameState, cause: 'action' | 'tick') => void;
  private readonly onFeedback: (message: string) => void;
  private readonly onSound: (cue: SoundCue) => void;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private playerSprite!: Phaser.GameObjects.Image;
  private readonly objects = new Map<string, Phaser.GameObjects.Image>();
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
  private needsArmed: ReadonlySet<NeedAlert> = new Set(ALL_NEED_ALERTS);

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
    const action = gatherKeyAction(this.state);
    if (action) this.perform(action);
    else {
      this.cancelWalk();
      this.onFeedback('Nothing to gather here.');
    }
  }

  private pressChop(): void {
    const tree = closestTree(this.state);
    if (tree) this.perform({ type: 'chopTree', treeId: tree.id });
    else {
      this.cancelWalk();
      this.onFeedback('Move closer to a mature tree.');
    }
  }

  private syncPlayerSprite(moving: boolean): void {
    const { warmth, energy, hunger } = this.state.player;
    const visual = selectSurvivorVisual({ facing: this.facing, moving, warmth, energy, hunger,
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
    // The sidebar's buttons still click while the game is paused; nothing should happen.
    if (this.scene.isPaused()) return;
    if (action.type !== 'move') this.walkTarget = nextWalk(this.walkTarget, { kind: 'action' });
    const before = this.state;
    const result = applyAction(before, action);
    this.state = result.state;
    this.showMorningFrost(before, this.state);
    if (result.state !== before) this.showActionDone(action, before);
    if (action.type === 'gather') this.noteBerryPicked(action.nodeId, before);
    const message = this.weatherMessage(before, this.state) ?? (announce ? result.message : '');
    this.say(message, this.needsAlert());
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
    const pose = actionPose(action.type);
    if (pose) this.visualAction = { kind: pose, startedAtMs: this.time.now };
  }

  private noteBerryPicked(nodeId: string, before: GameState): void {
    const node = before.nodes.find(item => item.id === nodeId);
    const remaining = this.state.nodes.find(item => item.id === nodeId)?.amount;
    if (node?.kind === 'berry' && remaining !== undefined && remaining < node.amount)
      this.gatheredBerry = { id: node.id, atMs: this.time.now };
  }

  getPrompt(): string {
    return promptFor(this.state);
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
    const site = closestSite(this.state);
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
    this.say(this.weatherMessage(before, after), seasonMessage(before.day, after.day), this.needsAlert());
  }

  /** The tired or hungry warning due now, if a meter just reached its line. */
  private needsAlert(): string {
    const { armed, fired } = needAlerts(this.needsArmed, this.state);
    this.needsArmed = armed;
    return needsMessage(fired);
  }

  private say(...messages: (string | null)[]): void {
    const text = messages.filter(Boolean).join(' ');
    if (text) this.onFeedback(text);
  }

  private showMorningFrost(before: GameState, after: GameState): void {
    if (isColdNight(before) && !isColdNight(after) && !after.progress.hearthUnlocked)
      this.effects.trigger('frost', this.time.now, BALANCE.campX, BALANCE.campY);
  }
}
