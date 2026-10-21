import Phaser from 'phaser';
import { BALANCE, type GameState, type ResourceNode } from '../game/state';
import { advanceTime, applyAction, isAtCamp, isColdNight, sleepBlocker, type GameAction } from '../game/rules';
import { TILE, worldX, worldY, drawTerrain, drawObjects, makeSurvivor } from './art';
import { darkness } from './ambient';
import { AmbientLife } from './ambientLife';

export class GameScene extends Phaser.Scene {
  private state: GameState;
  private readonly onStateChange: (state: GameState, cause: 'action' | 'tick') => void;
  private readonly onFeedback: (message: string) => void;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private playerSprite!: Phaser.GameObjects.Container;
  private playerFigure!: Phaser.GameObjects.Container;
  private objects!: Phaser.GameObjects.Graphics;
  private glow!: Phaser.GameObjects.Graphics;
  private night!: Phaser.GameObjects.Rectangle;
  private wind!: Phaser.GameObjects.Graphics;
  private ambient!: AmbientLife;
  private hudElapsed = 0;

  constructor(state: GameState, onStateChange: (state: GameState, cause: 'action' | 'tick') => void, onFeedback: (message: string) => void) {
    super({ key: 'GameScene' });
    this.state = state;
    this.onStateChange = onStateChange;
    this.onFeedback = onFeedback;
  }

  create(): void {
    drawTerrain(this, this.state.nodes);
    this.objects = this.add.graphics().setDepth(5);
    this.glow = this.add.graphics().setDepth(101).setBlendMode(Phaser.BlendModes.ADD);
    this.ambient = new AmbientLife(this);
    const survivor = makeSurvivor(this);
    this.playerSprite = survivor.root;
    this.playerFigure = survivor.figure;
    this.playerSprite.setPosition(worldX(this.state.player.x), worldY(this.state.player.y));
    this.playerSprite.setScale(1.2);
    this.cameras.main.setBounds(0, 0, BALANCE.mapWidth * TILE, BALANCE.mapHeight * TILE);
    this.cameras.main.startFollow(this.playerSprite, true, 0.09, 0.09);
    this.cameras.main.setZoom(1);
    this.night = this.add.rectangle(0, 0, 960, 600, 0x101d36, 1)
      .setOrigin(0).setScrollFactor(0).setDepth(100).setAlpha(0);
    this.wind = this.add.graphics().setScrollFactor(0).setDepth(102);
    this.keys = this.input.keyboard!.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,E,F,R,Q,C,G,Z') as Record<string, Phaser.Input.Keyboard.Key>;
    this.paintObjects();
    this.onStateChange(this.state, 'tick');
  }

  update(_time: number, delta: number): void {
    if (document.hidden || !this.keys) return;
    const dt = Math.min(delta / 1000, 0.05);
    const horizontal = Number(this.keys.D.isDown || this.keys.RIGHT.isDown) - Number(this.keys.A.isDown || this.keys.LEFT.isDown);
    const vertical = Number(this.keys.S.isDown || this.keys.DOWN.isDown) - Number(this.keys.W.isDown || this.keys.UP.isDown);
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
    this.playerSprite.setPosition(worldX(this.state.player.x), worldY(this.state.player.y));
    if (horizontal || vertical) {
      if (horizontal) this.playerSprite.setScale(horizontal < 0 ? -1.2 : 1.2, 1.2);
      this.playerFigure.y = Math.sin(this.time.now / 105) * 1.7;
    } else this.playerFigure.y = 0;
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
    const weatherMessage = this.weatherMessage(before, this.state);
    if (weatherMessage) this.onFeedback(weatherMessage);
    else if (announce && result.message) this.onFeedback(result.message);
    if (announce) {
      this.onStateChange(this.state, 'action');
      if (this.objects) this.paintObjects();
    }
  }

  getPrompt(): string {
    const node = this.closestNode();
    const canSleep = !sleepBlocker(this.state);
    if (node) {
      const gather = node.kind === 'branch' ? 'E  Collect branches' : 'E  Pick berries';
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

  private closestNode(): ResourceNode | undefined {
    return this.state.nodes
      .filter(node => node.amount > 0 && Math.hypot(node.x - this.state.player.x, node.y - this.state.player.y) <= BALANCE.interactionRadius)
      .sort((a, b) => Math.hypot(a.x - this.state.player.x, a.y - this.state.player.y) - Math.hypot(b.x - this.state.player.x, b.y - this.state.player.y))[0];
  }

  private paintObjects(): void {
    drawObjects(this.objects, this.state, this.time.now);
    this.glow.clear();
    if (this.state.fireFuel > 0) {
      const x = worldX(BALANCE.campX);
      const y = worldY(BALANCE.campY);
      const pulse = Math.sin(this.time.now / 300) * 5;
      this.glow.fillStyle(0xffb464, 0.055);
      this.glow.fillCircle(x, y, 118 + pulse);
      this.glow.fillStyle(0xffc874, 0.095);
      this.glow.fillCircle(x, y, 75 + pulse / 2);
      this.glow.fillStyle(0xffe6af, 0.15);
      this.glow.fillCircle(x, y, 28);
    }
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
      const x = (i * 173 + this.time.now * 0.045) % 1080 - 80;
      const y = (i * 137) % 590;
      this.wind.lineBetween(x, y, x + 28, y - 7);
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
