import Phaser from 'phaser';
import { BALANCE, type GameState, type ResourceNode } from '../game/state';
import { advanceTime, applyAction, isAtCamp, type GameAction } from '../game/rules';

const TILE = 32;
const worldX = (x: number) => (x + 0.5) * TILE;
const worldY = (y: number) => (y + 0.5) * TILE;

export class GameScene extends Phaser.Scene {
  private state: GameState;
  private readonly onStateChange: (state: GameState, cause: 'action' | 'tick') => void;
  private readonly onFeedback: (message: string) => void;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private playerSprite!: Phaser.GameObjects.Container;
  private objects!: Phaser.GameObjects.Graphics;
  private glow!: Phaser.GameObjects.Graphics;
  private night!: Phaser.GameObjects.Rectangle;
  private hudElapsed = 0;

  constructor(state: GameState, onStateChange: (state: GameState, cause: 'action' | 'tick') => void, onFeedback: (message: string) => void) {
    super({ key: 'GameScene' });
    this.state = state;
    this.onStateChange = onStateChange;
    this.onFeedback = onFeedback;
  }

  create(): void {
    this.drawGround();
    this.objects = this.add.graphics().setDepth(5);
    this.glow = this.add.graphics().setDepth(101);
    this.playerSprite = this.makePlayer();
    this.cameras.main.setBounds(0, 0, BALANCE.mapWidth * TILE, BALANCE.mapHeight * TILE);
    this.cameras.main.startFollow(this.playerSprite, true, 0.09, 0.09);
    this.cameras.main.setZoom(1);
    this.night = this.add.rectangle(0, 0, 960, 600, 0x101d36, 0)
      .setOrigin(0).setScrollFactor(0).setDepth(100);
    this.keys = this.input.keyboard!.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,E,F,R,Q') as Record<string, Phaser.Input.Keyboard.Key>;
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
    this.state = advanceTime(this.state, dt);
    this.playerSprite.setPosition(worldX(this.state.player.x), worldY(this.state.player.y));
    this.paintObjects();
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
    if (node) return node.kind === 'branch' ? 'E  Collect branches' : 'E  Pick berries';
    if (isAtCamp(this.state)) {
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

  private makePlayer(): Phaser.GameObjects.Container {
    const shadow = this.add.ellipse(0, 13, 25, 10, 0x1d332f, 0.36);
    const body = this.add.ellipse(0, 1, 19, 23, 0x446876);
    const pack = this.add.rectangle(-10, 1, 10, 15, 0xd89c5e);
    const face = this.add.circle(0, -12, 9, 0xf5c9a4);
    const hair = this.add.arc(0, -15, 9, 185, 355, false, 0x3e3434);
    const scarf = this.add.rectangle(0, -4, 19, 5, 0xe7a163);
    return this.add.container(worldX(this.state.player.x), worldY(this.state.player.y), [shadow, pack, body, face, hair, scarf]).setDepth(20);
  }

  private drawGround(): void {
    const g = this.add.graphics().setDepth(0);
    g.fillStyle(0x456a59);
    g.fillRect(0, 0, BALANCE.mapWidth * TILE, BALANCE.mapHeight * TILE);
    for (let y = 0; y < BALANCE.mapHeight; y++) {
      for (let x = 0; x < BALANCE.mapWidth; x++) {
        const hash = (x * 73 + y * 131 + x * y * 17) % 13;
        g.fillStyle(hash < 3 ? 0x4b705b : hash < 7 ? 0x486c58 : 0x456a59);
        g.fillRect(x * TILE, y * TILE, TILE, TILE);
        if (hash === 2 || hash === 10) {
          g.fillStyle(0x8da879, 0.4);
          g.fillEllipse(x * TILE + 8, y * TILE + 14, 3, 7);
          g.fillEllipse(x * TILE + 12, y * TILE + 13, 3, 7);
        }
      }
    }
    g.fillStyle(0xb6a078, 0.18);
    g.fillEllipse(worldX(BALANCE.campX), worldY(BALANCE.campY), 320, 235);
    g.lineStyle(2, 0xe8d4a6, 0.7);
    g.strokeCircle(worldX(BALANCE.campX), worldY(BALANCE.campY), BALANCE.campRadius * TILE);
    for (let i = 0; i < 82; i++) {
      const x = (i * 223 + 97) % (BALANCE.mapWidth * TILE);
      const y = (i * 347 + 51) % (BALANCE.mapHeight * TILE);
      if (Math.hypot(x - worldX(BALANCE.campX), y - worldY(BALANCE.campY)) < 150) continue;
      g.fillStyle(0x203f36, 0.35);
      g.fillEllipse(x + 5, y + 9, 32, 15);
      g.fillStyle(i % 3 === 0 ? 0x294f40 : 0x315949);
      g.fillCircle(x, y, 13 + i % 5);
      g.fillStyle(0x3e6952, 0.8);
      g.fillCircle(x - 4, y - 4, 9 + i % 4);
    }
  }

  private paintObjects(): void {
    const g = this.objects;
    g.clear();
    for (const node of this.state.nodes) {
      const x = worldX(node.x), y = worldY(node.y);
      if (node.kind === 'branch') {
        g.fillStyle(node.amount ? 0x4b382b : 0x53624d, node.amount ? 1 : 0.45);
        g.fillRoundedRect(x - 17, y - 5, 30, 9, 4);
        g.fillRoundedRect(x - 11, y - 10, 27, 8, 4);
        g.lineStyle(2, 0xc39765, node.amount ? 0.8 : 0.2);
        g.lineBetween(x - 10, y - 8, x + 11, y - 8);
      } else {
        g.fillStyle(node.amount ? 0x2e6046 : 0x40634c, node.amount ? 1 : 0.4);
        g.fillCircle(x, y + 2, 13);
        g.fillStyle(0x4e8158, node.amount ? 1 : 0.3);
        g.fillCircle(x - 5, y - 3, 8);
        g.fillCircle(x + 7, y - 2, 7);
        if (node.amount) {
          g.fillStyle(0xd46b6a);
          g.fillCircle(x - 4, y + 1, 3);
          g.fillCircle(x + 6, y - 4, 3);
          g.fillCircle(x + 3, y + 7, 2);
        }
      }
    }
    const cx = worldX(BALANCE.campX), cy = worldY(BALANCE.campY);
    g.fillStyle(0xb38d5e, 0.28);
    g.fillCircle(cx, cy, 58);
    g.lineStyle(4, 0xa79a7c);
    g.strokeCircle(cx, cy, 19);
    for (let i = 0; i < 7; i++) {
      const angle = i * Math.PI * 2 / 7;
      g.fillStyle(0xb7aa89);
      g.fillCircle(cx + Math.cos(angle) * 19, cy + Math.sin(angle) * 19, 5);
    }
    if (this.state.fireFuel > 0) {
      const flicker = 2 * Math.sin(this.time.now / 150);
      g.fillStyle(0xffb15e);
      g.fillTriangle(cx - 10, cy + 9, cx + 9, cy + 9, cx + flicker, cy - 22);
      g.fillStyle(0xffe09c);
      g.fillTriangle(cx - 5, cy + 8, cx + 6, cy + 8, cx + 1, cy - 12);
    } else {
      g.fillStyle(0x3d3c3a);
      g.fillCircle(cx, cy, 8);
    }
    if (this.state.structures.shelter) {
      const x = worldX(BALANCE.campX - 3), y = worldY(BALANCE.campY - 2);
      g.fillStyle(0x483b31, 0.45);
      g.fillRoundedRect(x - 42, y - 24, 90, 66, 7);
      g.fillStyle(0xbd8c5c);
      g.fillRoundedRect(x - 45, y - 29, 90, 63, 7);
      g.fillStyle(0xd4ab75);
      g.fillTriangle(x - 49, y - 30, x + 49, y - 30, x, y - 60);
      g.fillStyle(0x513c31);
      g.fillRoundedRect(x - 12, y + 13, 24, 20, 4);
    } else {
      const x = worldX(BALANCE.campX - 3), y = worldY(BALANCE.campY - 2);
      g.lineStyle(2, 0xd0b883, 0.7);
      g.strokeRect(x - 39, y - 25, 78, 55);
    }
    if (this.state.structures.bed) {
      const x = worldX(BALANCE.campX - 3), y = worldY(BALANCE.campY - 1);
      g.fillStyle(0x886e54);
      g.fillRoundedRect(x - 20, y - 6, 40, 20, 5);
      g.fillStyle(0xe6cda2);
      g.fillRoundedRect(x - 16, y - 3, 13, 14, 4);
    }
    if (this.state.structures.crate) {
      const x = worldX(BALANCE.campX + 3), y = worldY(BALANCE.campY + 1);
      g.fillStyle(0x7d5637);
      g.fillRoundedRect(x - 17, y - 15, 34, 30, 4);
      g.lineStyle(3, 0xd1a26a);
      g.strokeRect(x - 14, y - 12, 28, 24);
      g.lineBetween(x - 12, y - 11, x + 12, y + 11);
    }
    this.glow.clear();
    if (this.state.fireFuel > 0) {
      this.glow.fillStyle(0xffba65, 0.16);
      this.glow.fillCircle(cx, cy, 95);
      this.glow.fillStyle(0xffd18a, 0.12);
      this.glow.fillCircle(cx, cy, 55);
    }
  }

  private paintNight(): void {
    const t = this.state.timeOfDay;
    const alpha = t >= BALANCE.nightStart
      ? Math.min(0.5, (t - BALANCE.nightStart) / 30 * 0.5)
      : t < 25 ? (1 - t / 25) * 0.5 : 0;
    this.night.setAlpha(alpha);
  }
}
