import { withFishing } from '../game/fishing';
import { KEEP_SITE, withKeepDoor } from '../game/keep';
import Phaser from 'phaser';
import { BALANCE, type GameState } from '../game/state';
import { newsBetween } from '../game/news';
import { coldNightMessage } from '../game/coldNight';
import { recordJournal } from '../game/journalEntries';
import { advanceLiveTime, applyAction, type GameAction } from '../game/rules';
import { TILE, worldX, worldY, drawTerrain } from './art';
import { shownTerrainKey } from './map';
import { sceneVisuals, playerVisualDepth, WEATHER_DEPTH } from './visuals';
import { SheepWalk } from './sheepWalk';
import { sprites } from '../art/sprites';
import { AmbientLife } from './ambientLife';
import { registerSpriteTextures } from '../art/textures';
import { season, type Season } from '../game/calendar';
import { seasonPalette } from '../art/seasonPalette';
import { ENDING_TEXTURE, effectPose, facingFromInput, puffDue, selectSurvivorVisual, type Facing, type SurvivorAction, type SurvivorPuff } from './survivorVisual';
import { isSick } from '../game/sickness';
import { ENDING_FADE_MS } from '../ui/ending';
import { SceneEffects } from './SceneEffects';
import { SceneLighting } from './SceneLighting';
import { NightWatch } from './sleepReplay';
import { DoorFade, doorFadeFor } from './doorFade';
import { KeepViewLayer } from './KeepViewLayer';
import { newlyStayed, newlyWon, type NameTarget } from '../game/names';
import { unnamedAnimalAt } from './animalTap';
import { hasArrived, moveStep, nextWalk, pickTapTarget, targetAction, type TapTarget } from './tapTarget';
import { palette } from '../art/palette';
import type { SoundCue } from '../game/soundscape';
import { ALL_NEED_ALERTS, needAlerts, needsMessage, type NeedAlert } from '../game/needs';
import { KEY_ACTIONS, actionEffect, actionPose, closestSite, closestTree, gatherSpot, promptFor, useKeyAction, lineToSay } from './prompts';

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
  private lastPuffMs?: number;
  private endingFaded = false;
  private walkTarget?: TapTarget;
  private tapGate: () => boolean = () => true;
  private askName: (target: NameTarget) => void = () => undefined;
  private terrain: Phaser.GameObjects.GameObject[] = [];
  private terrainShown = '';
  private seasonPainted: Season | null = null;
  private areaShown = '';
  private needsArmed: ReadonlySet<NeedAlert> = new Set(ALL_NEED_ALERTS);
  private readonly nightWatch = new NightWatch();
  private readonly doorFade = new DoorFade();
  private fadeCover!: Phaser.GameObjects.Rectangle;
  /** Going in at the keep's door: it happens once the screen is black, so morning doesn't show before the fade does. */
  private pendingDoor?: GameAction;
  private readonly sheepWalk = new SheepWalk();
  private viewShown = false;
  private keepView!: KeepViewLayer;

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
    const { width, height } = this.scale.gameSize;
    // Well over the size of the screen, since the view from the keep pulls the camera back and a rotated phone is wider.
    this.fadeCover = this.add.rectangle(width / 2, height / 2, BALANCE.mapWidth * TILE * 6, BALANCE.mapWidth * TILE * 6, 0x000000)
      .setScrollFactor(0).setDepth(WEATHER_DEPTH + 2).setVisible(false);
    this.keepView = new KeepViewLayer(this);
    this.keys = this.input.keyboard!.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,E,F,R,Q,T,P,C,G,Z,L,O,X,V') as Record<string, Phaser.Input.Keyboard.Key>;
    this.input.keyboard!.on('keydown', (event: KeyboardEvent) => this.keyComesDown(event));
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      const over = this.unnamedAnimalUnder(pointer.worldX, pointer.worldY);
      this.game.canvas.style.cursor = over ? 'pointer' : '';
    });
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
    this.updateDoorFade(this.time.now);
    const walking = this.walkFromKeys(dt);
    const tapWalking = this.walkTowardTarget(dt);
    this.handleActionKeys();
    const beforeTick = this.state;
    // While a sleep plays out, the replay sets the clock instead of the tick.
    // From going in at the keep's door until it has happened, the clock waits, so night or dawn can't get there first.
    const written = this.nightWatch.tick(this.time.now, () => (this.pendingDoor || this.doorFade.holdsClock(this.time.now) ? { state: this.state, messages: [] } : recordJournal(beforeTick, advanceLiveTime(this.state, dt))));
    this.state = written.state;
    this.reportWeather(beforeTick, this.state, written.messages);
    this.syncPlayerSprite(walking || tapWalking);
    this.paintObjects();
    this.ambient.update(this.state, dt, this.time.now);
    this.effects.update(this.state, this.time.now);
    if (this.viewShown) {
      this.lighting.hide();
      this.keepView.update(this.time.now);
    }
    else this.lighting.update(this.state, this.time.now, this.nightWatch.sunriseAgeMs(this.time.now));
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
    if (pressed('E')) this.pressUse();
    for (const [key, action] of KEY_ACTIONS) if (pressed(key)) this.perform(action);
    if (pressed('X')) this.pressChop();
    if (pressed('V')) this.visitNearestSite();
  }

  /** E uses whatever is in reach, as a tap on it would. */
  private pressUse(): void {
    if (this.doorFading()) return;
    const action = useKeyAction(this.state);
    if (action) this.perform(action);
    else {
      this.cancelWalk();
      this.onFeedback('Nothing to use here.');
    }
  }

  private pressChop(): void {
    if (this.doorFading()) return;
    const tree = closestTree(this.state);
    if (tree) this.perform({ type: 'chopTree', treeId: tree.id });
    else {
      this.cancelWalk();
      this.onFeedback('Move closer to a mature tree.');
    }
  }

  private syncPlayerSprite(moving: boolean): void {
    if (this.state.ending) {
      this.layDown();
      return;
    }
    const { warmth, energy, hunger } = this.state.player;
    const now = this.time.now;
    const visual = selectSurvivorVisual({ facing: this.facing, moving, warmth, energy, hunger, sick: isSick(this.state),
      nowMs: now, action: this.visualAction, packed: this.state.progress.packWoven });
    if (this.playerSprite.texture.key !== visual.texture) this.playerSprite.setTexture(visual.texture);
    // How the survivor feels plays on top of every pose, walking included.
    const nudge = effectPose(visual.effect, now);
    this.playerSprite.setPosition(Math.round(worldX(this.state.player.x)) + nudge.dx, Math.round(worldY(this.state.player.y)) + nudge.dy);
    this.playerSprite.setRotation(nudge.rotation);
    if (visual.puff && !this.doorFading() && puffDue(this.lastPuffMs, now)) {
      this.lastPuffMs = now;
      this.letOutPuff(visual.puff);
    }
    this.playerSprite.setDepth(playerVisualDepth(this.state));
    this.playerSprite.setFlipX(visual.flipX);
    if (this.state.area !== this.areaShown) {
      // Crossing to the other area snaps the camera instead of panning across the map.
      this.areaShown = this.state.area;
      this.cameras.main.centerOn(this.playerSprite.x, this.playerSprite.y);
    }
  }

  /** The story has ended: the survivor lies still and the view fades slowly out. */
  private layDown(): void {
    if (this.playerSprite.texture.key !== ENDING_TEXTURE) this.playerSprite.setTexture(ENDING_TEXTURE);
    this.playerSprite.setRotation(0).setFlipX(false)
      .setPosition(Math.round(worldX(this.state.player.x)), Math.round(worldY(this.state.player.y)));
    if (this.endingFaded) return;
    this.endingFaded = true;
    this.cameras.main.fadeOut(ENDING_FADE_MS, 23, 51, 38);
  }

  /** A small cloud by the survivor's face that drifts up and fades: white breath in the cold, a grey-cream cough when sick. */
  private letOutPuff(kind: SurvivorPuff): void {
    const side = this.playerSprite.flipX ? -1 : 1;
    const puff = this.add.circle(this.playerSprite.x + 3 * side, this.playerSprite.y - 15, kind === 'cough' ? 2 : 1.5, kind === 'cough' ? 0xd9d0b8 : 0xffffff, 0.8)
      .setDepth(this.playerSprite.depth + 1);
    this.tweens.add({ targets: puff, alpha: 0, y: puff.y - 6, x: puff.x + 2 * side, scale: 1.6, duration: 900, onComplete: () => puff.destroy() });
  }

  perform(requested: GameAction, announce = true): void {
    // The sidebar's buttons still click while the game is paused; nothing should happen.
    if (this.scene.isPaused() || this.nightWatch.running || this.doorFading()) return;
    // A visit to the frozen spring with a line is a go at fishing, and fishing needs a roll of chance.
    // The keep's door means whatever it means as the survivor reaches it.
    const action = withKeepDoor(this.state, withFishing(this.state, requested, Math.random()));
    if (action.type !== 'move') this.walkTarget = nextWalk(this.walkTarget, { kind: 'action' });
    const fade = doorFadeFor(action, this.state);
    if (fade) {
      this.doorFade.begin(fade, this.time.now);
      this.pendingDoor = action;
      return;
    }
    this.carryOut(action, announce);
  }

  /** The fade at the keep's door, each frame. Everything it changes is put back as soon as it stops running, so a late frame can't leave it moved. */
  private updateDoorFade(now: number): void {
    if (this.pendingDoor && (this.doorFade.hold(now) || !this.doorFade.running(now))) {
      const action = this.pendingDoor;
      this.pendingDoor = undefined;
      this.carryOut(action, true);
    }
    const running = this.doorFade.running(now);
    this.fadeCover.setVisible(running).setAlpha(this.doorFade.alpha(now));
    this.playerSprite.setVisible(!running);
    const viewing = this.doorFade.viewing(now);
    if (viewing === this.viewShown) return;
    this.viewShown = viewing;
    if (viewing) this.keepView.show(this.state, this.scale.gameSize.width, this.scale.gameSize.height);
    else this.keepView.hide();
  }

  /** Whether the view from the top of the keep is up. */
  viewing(): boolean {
    return this.viewShown;
  }

  /** A fresh key press comes down from the view. Esc still pauses, and a key held from the door doesn't count. */
  private keyComesDown(event: { key: string; repeat: boolean }): void {
    if (this.viewShown && !event.repeat && event.key !== 'Escape' && !this.scene.isPaused()) this.doorFade.comeDown(this.time.now);
  }

  private doorFading(): boolean {
    return this.doorFade.running(this.time.now);
  }

  private carryOut(action: GameAction, announce: boolean): void {
    const before = this.state;
    const result = applyAction(before, action);
    const written = recordJournal(before, result.state, action);
    if (this.nightWatch.begin(before, written, action, this.time.now)) {
      this.onFeedback('You bed down by the fire as the cold night blows in…');
      return;
    }
    this.state = written.state;
    this.showDawn(before, this.state);
    const stayed = newlyStayed(before, this.state);
    if (result.state !== before) this.showActionDone(action, before);
    if (action.type === 'gather') this.noteBerryPicked(action.nodeId, before);
    const message = coldNightMessage(before, this.state) ?? lineToSay(before, this.state, result.message, announce);
    this.say(message, ...newsBetween(before, this.state), ...written.messages, this.needsAlert());
    if (stayed) this.askName({ kind: 'friend', animal: stayed });
    if (newlyWon(before, this.state)) this.askName({ kind: 'pony' });
    if (announce) {
      this.onStateChange(this.state, 'action');
      if (this.playerSprite) this.paintObjects();
    }
  }

  /** Plays the effect and survivor pose for an action that changed the game. */
  private showActionDone(action: GameAction, before: GameState): void {
    const spot = gatherSpot(action, before);
    if (spot) this.onSound('gather');
    if (action.type === 'build' || action.type === 'decorate' || action.type === 'buildMine' || action.type === 'layStone' || action.type === 'hangDoor') this.onSound('build');
    if (spot) this.effects?.trigger('gather', this.time.now, spot.x, spot.y, spot.kind);
    const effect = actionEffect(action, this.state);
    if (effect) this.effects?.trigger(effect.kind, this.time.now, effect.x, effect.y);
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

  private unnamedAnimalUnder(pixelX: number, pixelY: number): NameTarget | null {
    return unnamedAnimalAt(this.state, this.time.now, pixelX / TILE - 0.5, pixelY / TILE - 0.5, { pony: this.ambient.ponyDrawn, friends: this.ambient.friendsDrawn, stillSeconds: this.ambient.stillSeconds, replaying: this.nightWatch.running });
  }

  setNameAsker(ask: (target: NameTarget) => void): void {
    this.askName = ask;
  }

  /** While a name is being typed the game hears no keys, and a key held as the box opened doesn't stay down. */
  setTyping(typing: boolean): void {
    const keyboard = this.input.keyboard!;
    keyboard.resetKeys();
    keyboard.enabled = !typing;
  }

  /** Swallows taps while the gate says no, such as when a phone sheet is open. */
  setTapGate(gate: () => boolean): void {
    this.tapGate = gate;
  }

  cancelWalk(): void {
    this.walkTarget = nextWalk(this.walkTarget, { kind: 'action' });
  }

  visitNearestSite(): void {
    if (this.doorFading()) return;
    const site = closestSite(this.state);
    if (site) this.perform({ type: 'visitSite', siteId: site.id });
    else {
      this.cancelWalk();
      this.onFeedback('Follow a path and move closer to a place to explore.');
    }
  }

  resizeViewport(width: number, height: number): void {
    if (this.lighting) this.lighting.resize(width, height);
    this.keepView?.resize(width, height);
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
    if (this.viewShown && !this.scene.isPaused()) this.doorFade.comeDown(this.time.now);
    if (this.doorFading()) return;
    const animal = this.unnamedAnimalUnder(pixelX, pixelY);
    if (animal) {
      this.walkTarget = undefined;
      this.askName(animal);
      return;
    }
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
    for (const visual of this.sheepWalk.apply(sceneVisuals(this.state, this.time.now, this.gatheredBerry), this.time.now)) {
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
