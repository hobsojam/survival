import Phaser from 'phaser';
import { BALANCE, type GameState, type ResourceNode } from '../game/state';
import { advanceTime, applyAction, isAtCamp, sleepBlocker, type GameAction } from '../game/rules';
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
    this.keys = this.input.keyboard!.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,E,F,R,Q,Z') as Record<string, Phaser.Input.Keyboard.Key>;
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
    if (Phaser.Input.Keyboard.JustDown(this.keys.Z)) this.perform({ type: 'sleep' });
    this.state = advanceTime(this.state, dt);
    this.playerSprite.setPosition(worldX(this.state.player.x), worldY(this.state.player.y));
    if (horizontal || vertical) {
      if (horizontal) this.playerSprite.setScale(horizontal < 0 ? -1.2 : 1.2, 1.2);
      this.playerFigure.y = Math.sin(this.time.now / 105) * 1.7;
    } else this.playerFigure.y = 0;
    this.paintObjects();
    this.ambient.update(this.state, dt, this.time.now);
    this.paintNight();
    this.hudElapsed += delta;
    if (this.hudElapsed >= 250) {
      this.onStateChange(this.state, 'tick');
      this.hudElapsed = 0;
    }
  }

  perform(action: GameAction, announce = true): void {
    const result = applyAction(this.state, action);
    this.state = result.state;
    if (announce && result.message) this.onFeedback(result.message);
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
      if (canSleep) return 'At camp · Z Sleep until morning · F Fire · R Rest';
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
    this.night.setAlpha(darkness(this.state.day, this.state.timeOfDay) * 0.5);
  }
}
