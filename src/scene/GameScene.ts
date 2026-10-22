import Phaser from 'phaser';
import { BALANCE, type GameState, type ResourceNode } from '../game/state';
import { advanceTime, applyAction, isAtCamp, isColdNight, sleepBlocker, type GameAction } from '../game/rules';
import { TILE, worldX, worldY, drawTerrain } from './art';
import { sceneVisuals, playerVisualDepth, NIGHT_DEPTH, WEATHER_DEPTH } from './visuals';
import { sprites } from '../art/sprites';
import { darkness } from './ambient';
import { AmbientLife } from './ambientLife';
import { registerSpriteTextures } from '../art/textures';
import { LOGICAL_WIDTH, LOGICAL_HEIGHT } from './pixelScale';
import { facingFromInput, selectSurvivorVisual, type Facing, type SurvivorAction } from './survivorVisual';

export class GameScene extends Phaser.Scene {
  private state: GameState;
  private readonly onStateChange: (state: GameState, cause: 'action' | 'tick') => void;
  private readonly onFeedback: (message: string) => void;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private playerSprite!: Phaser.GameObjects.Image;
  private objects = new Map<string, Phaser.GameObjects.Image>();
  private gatheredBerry?: { id: string; atMs: number };
  private night!: Phaser.GameObjects.Rectangle;
  private wind!: Phaser.GameObjects.Graphics;
  private ambient!: AmbientLife;
  private hudElapsed = 0;
  private facing: Facing = 'down';
  private visualAction?: { kind: SurvivorAction; startedAtMs: number };

  constructor(state: GameState, onStateChange: (state: GameState, cause: 'action' | 'tick') => void, onFeedback: (message: string) => void) {
    super({ key: 'GameScene' });
    this.state = state;
    this.onStateChange = onStateChange;
    this.onFeedback = onFeedback;
  }

  create(): void {
    registerSpriteTextures(this);
    drawTerrain(this, this.state.nodes);
    this.ambient = new AmbientLife(this);
    const playerArt = sprites.survivor;
    this.playerSprite = this.add.image(Math.round(worldX(this.state.player.x)), Math.round(worldY(this.state.player.y)), 'survivor:idleDown0')
      .setOrigin(playerArt.anchor[0] / playerArt.size[0], playerArt.anchor[1] / playerArt.size[1]);
    this.playerSprite.setDepth(playerVisualDepth(this.state));
    this.cameras.main.setBounds(0, 0, BALANCE.mapWidth * TILE, BALANCE.mapHeight * TILE);
    this.cameras.main.startFollow(this.playerSprite, true, 0.09, 0.09);
    this.cameras.main.setZoom(1);
    this.cameras.main.roundPixels = true;
    this.night = this.add.rectangle(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT, 0x101d36, 1)
      .setOrigin(0).setScrollFactor(0).setDepth(NIGHT_DEPTH).setAlpha(0);
    this.wind = this.add.graphics().setScrollFactor(0).setDepth(WEATHER_DEPTH);
    this.keys = this.input.keyboard!.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,E,F,R,Q,C,G,Z') as Record<string, Phaser.Input.Keyboard.Key>;
    this.paintObjects();
    this.onStateChange(this.state, 'tick');
  }

  update(_time: number, delta: number): void {
    if (document.hidden || !this.keys) return;
    const dt = Math.min(delta / 1000, 0.05);
    const horizontal = Number(this.keys.D.isDown || this.keys.RIGHT.isDown) - Number(this.keys.A.isDown || this.keys.LEFT.isDown);
    const vertical = Number(this.keys.S.isDown || this.keys.DOWN.isDown) - Number(this.keys.W.isDown || this.keys.UP.isDown);
    const walking = Boolean(horizontal || vertical);
    if (walking) {
      this.facing = facingFromInput(horizontal, vertical, this.facing);
      this.visualAction = undefined;
    }
    if (horizontal || vertical) {
      const length = Math.hypot(horizontal, vertical);
      this.perform({ type: 'move', dx: horizontal / length * dt * 3.5, dy: vertical / length * dt * 3.5 }, false);
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.E)) {
      const node = this.closestNode();
      this.perform(node ? { type: 'gather', nodeId: node.id } : { type: 'rest' });
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.F)) this.perform({ type: 'stokeFire' });
    if (Phaser.Input.Keyboard.JustDown(this.keys.R)) this.perform({ type: 'rest' });
    if (Phaser.Input.Keyboard.JustDown(this.keys.Q)) this.perform({ type: 'eat' });
    if (Phaser.Input.Keyboard.JustDown(this.keys.C)) this.perform({ type: 'cook' });
    if (Phaser.Input.Keyboard.JustDown(this.keys.G)) this.perform({ type: 'stargaze' });
    if (Phaser.Input.Keyboard.JustDown(this.keys.Z)) this.perform({ type: 'sleep' });
    const beforeTick = this.state;
    this.state = advanceTime(this.state, dt);
    this.reportWeather(beforeTick, this.state);
    const visual = selectSurvivorVisual({ facing: this.facing, moving: walking, warmth: this.state.player.warmth,
      nowMs: this.time.now, action: this.visualAction });
    if (this.playerSprite.texture.key !== visual.texture) this.playerSprite.setTexture(visual.texture);
    this.playerSprite.setPosition(Math.round(worldX(this.state.player.x)), Math.round(worldY(this.state.player.y)));
    this.playerSprite.setDepth(playerVisualDepth(this.state));
    this.playerSprite.setFlipX(visual.flipX);
    this.paintObjects();
    this.ambient.update(this.state, dt, this.time.now);
    this.paintNight();
    this.paintWind();
    this.hudElapsed += delta;
    if (this.hudElapsed >= 250) {
      this.onStateChange(this.state, 'tick');
      this.hudElapsed = 0;
    }
  }

  perform(action: GameAction, announce = true): void {
    const before = this.state;
    const result = applyAction(before, action);
    this.state = result.state;
    if (result.state !== before && (action.type === 'gather' || action.type === 'rest' || action.type === 'cook' || action.type === 'stargaze'))
      this.visualAction = { kind: action.type, startedAtMs: this.time.now };
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
    const node = this.closestNode();
    const canSleep = !sleepBlocker(this.state);
    if (node) {
      const gather = node.kind === 'branch' ? 'E  Collect branches' : node.kind === 'berry' ? 'E  Pick berries' : 'E  Gather fiber';
      return canSleep ? `${gather} · Z Sleep until morning` : gather;
    }
    if (isAtCamp(this.state)) {
      if (canSleep) return 'At camp · C Cook · G Stargaze · Z Sleep · F Fire';
      if (this.state.timeOfDay >= BALANCE.nightStart) return 'At camp · C Cook · G Stargaze · F Fire · R Rest';
      return 'At camp · F Fire · R Rest · Click an upgrade to build';
    }
    return 'WASD / arrows  Move';
  }

  getState(): GameState { return this.state; }

  resizeViewport(width: number, height: number): void {
    if (this.night) this.night.setSize(width, height);
  }

  private closestNode(): ResourceNode | undefined {
    return this.state.nodes
      .filter(node => node.amount > 0 && Math.hypot(node.x - this.state.player.x, node.y - this.state.player.y) <= BALANCE.interactionRadius)
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

  private paintNight(): void {
    const storm = isColdNight(this.state);
    this.night.setFillStyle(storm ? 0x24465d : 0x101d36, 1);
    this.night.setAlpha(darkness(this.state.day, this.state.timeOfDay) * (storm ? 0.64 : 0.5));
  }

  private paintWind(): void {
    this.wind.clear();
    if (!isColdNight(this.state)) return;
    this.wind.lineStyle(2, 0xe0f2f2, 0.24);
    for (let i = 0; i < 13; i++) {
      const x = (i * 86 + this.time.now * 0.0225) % (this.scale.width + 60) - 40;
      const y = (i * 68) % this.scale.height;
      this.wind.lineBetween(x, y, x + 14, y - 4);
    }
  }

  private weatherMessage(before: GameState, after: GameState): string | null {
    if (!isColdNight(before) && isColdNight(after)) return 'The cold front has arrived. Keep the fire alive until dawn.';
    if (isColdNight(before) && !isColdNight(after)) return after.progress.hearthUnlocked
      ? 'You weathered the cold night! The stone hearth is now unlocked.'
      : `The fire did not last. Recover today; another cold front comes on day ${after.progress.nextStormDay}.`;
    return null;
  }

  private reportWeather(before: GameState, after: GameState): void {
    const message = this.weatherMessage(before, after);
    if (message) this.onFeedback(message);
  }
}
