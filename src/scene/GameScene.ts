import Phaser from 'phaser';
import { BALANCE, type GameState } from '../game/state';
import { newsBetween } from '../game/news';
import { coldNightMessage } from '../game/coldNight';
import { recordJournal } from '../game/journalEntries';
import { advanceLiveTime, applyAction, type GameAction } from '../game/rules';
import { TILE, worldX, worldY, drawTerrain } from './art';
import { shownTerrainKey } from './map';
import { sceneVisuals, playerVisualDepth, WEATHER_DEPTH } from './visuals';
import { sprites } from '../art/sprites';
import { AmbientLife } from './ambientLife';
import { registerSpriteTextures } from '../art/textures';
import { season, type Season } from '../game/calendar';
import { seasonPalette } from '../art/seasonPalette';
import { facingFromInput, selectSurvivorVisual, type Facing, type SurvivorAction } from './survivorVisual';
import { SceneEffects } from './SceneEffects';
import { SceneLighting } from './SceneLighting';
import { NightWatch } from './sleepReplay';
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
  private seasonPainted: Season | null = null;
  private areaShown = '';
  private needsArmed: ReadonlySet<NeedAlert> = new Set(ALL_NEED_ALERTS);
  private readonly nightWatch = new NightWatch();

  constructor(state: GameState, onStateChange: (state: GameState, cause: 'action' | 'tick') => void, onFeedback: (message: string) => void, onSound: (cue: SoundCue) => void = () => undefined) {
    super({ key: 'GameScene' });
    this.state = state;
    this.onStateChange = onStateChange;
    this.onFeedback = onFeedback;
    this.onSound = onSound;
  }

  create(): void {
    this.redrawTerrain();
    this.ambient = new AmbientLife(this, cue => this.onSound(cue));
    this.effects = new SceneEffects(this);
    const playerArt = sprites.survivor;
    this.playerSprite = this.add.image(Math.round(worldX(this.state.player.x)), Math.round(worldY(this.state.player.y)), 'survivor:idleDown0')
      .setOrigin(playerArt.anchor[0] / playerArt.size[0], playerArt.anchor[1] / playerArt.size[1]);
    this.playerSprite.setDepth(playerVisualDepth(this.state));
    this.cameras.main.startFollow(this.playerSprite, true, 0.09, 0.09);
    this.areaShown = this.state.area;
    this.cameras.main.setZoom(1);
    this.cameras.main.roundPixels = true;
    // The phone viewport can be set before the scene boots, so take the size the game already has.
    this.lighting = new SceneLighting(this, this.scale.gameSize.width, this.scale.gameSize.height);
    this.keys = this.input.keyboard!.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,E,F,R,Q,T,P,C,G,Z,L,O,X,V') as Record<string, Phaser.Input.Keyboard.Key>;
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      // Right and middle clicks don't walk; touches report button 0.
      if (pointer.button === 0) this.handleTap(pointer.worldX, pointer.worldY);
    });
    this.paintObjects();
    this.onStateChange(this.state, 'tick');
  }

  update(_time: number, delta: number): void {
    if (document.hidden || !this.keys) return;
    if (shownTerrainKey(this.state) !== this.terrainShown) this.redrawTerrain();
    const dt = Math.min(delta / 1000, 0.05);
    const walking = this.walkFromKeys(dt);
    const tapWalking = this.walkTowardTarget(dt);
    this.handleActionKeys();
    const beforeTick = this.state;
    // While a sleep plays out, the replay sets the clock instead of the tick.
    const written = this.nightWatch.tick(this.time.now, () => recordJournal(beforeTick, advanceLiveTime(this.state, dt)));
    this.state = written.state;
    this.reportWeather(beforeTick, this.state, written.messages);
    this.syncPlayerSprite(walking || tapWalking);
    this.paintObjects();
    this.ambient.update(this.state, dt, this.time.now);
    this.effects.update(this.state, this.time.now);
    this.lighting.update(this.state, this.time.now, this.nightWatch.sunriseAgeMs(this.time.now));
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
      nowMs: this.time.now, action: this.visualAction, packed: this.state.progress.packWoven });
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
    if (this.scene.isPaused() || this.nightWatch.running) return;
    if (action.type !== 'move') this.walkTarget = nextWalk(this.walkTarget, { kind: 'action' });
    const before = this.state;
    const result = applyAction(before, action);
    const written = recordJournal(before, result.state, action);
    if (this.nightWatch.begin(before, written, action, this.time.now)) {
      this.onFeedback('You bed down by the fire as the cold night blows in…');
      return;
    }
    this.state = written.state;
    this.showDawn(before, this.state);
    if (result.state !== before) this.showActionDone(action, before);
    if (action.type === 'gather') this.noteBerryPicked(action.nodeId, before);
    const message = coldNightMessage(before, this.state) ?? (announce ? result.message : '');
    this.say(message, ...newsBetween(before, this.state), ...written.messages, this.needsAlert());
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

  /** Swaps the terrain when the area, the west path or the season changes; a new season repaints every sprite first. */
  private redrawTerrain(): void {
    const now = season(this.state.day);
    if (now !== this.seasonPainted) {
      registerSpriteTextures(this, seasonPalette(now));
      this.seasonPainted = now;
    }
    for (const object of this.terrain) object.destroy();
    if (this.terrainShown) this.textures.remove(`terrain-${this.terrainShown}`);
    this.terrainShown = shownTerrainKey(this.state);
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

  private reportWeather(before: GameState, after: GameState, journal: string[] = []): void {
    this.showDawn(before, after);
    this.say(coldNightMessage(before, after), ...newsBetween(before, after), ...journal, this.needsAlert());
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

  private showDawn(before: GameState, after: GameState): void {
    if (this.nightWatch.dawn(before, after, this.time.now)) this.effects.trigger('frost', this.time.now, BALANCE.campX, BALANCE.campY);
  }
}
