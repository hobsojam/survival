import Phaser from 'phaser';
import { BALANCE, type GameState, type ResourceNode } from '../game/state';

export const TILE = 32;
export const worldX = (x: number) => (x + 0.5) * TILE;
export const worldY = (y: number) => (y + 0.5) * TILE;

const forest = [0x416b52, 0x4b7458, 0x527a5e, 0x3d644d];
const seed = (a: number, b: number) => {
  const value = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return value - Math.floor(value);
};

function tree(g: Phaser.GameObjects.Graphics, x: number, y: number, size: number): void {
  g.fillStyle(0x173e35, 0.3);
  g.fillEllipse(x + 9, y + 12, size * 2.1, size * 0.8);
  g.fillStyle(0x725b42);
  g.fillRoundedRect(x - 4, y - 2, 9, size + 12, 3);
  g.fillStyle(0x294f3e);
  g.fillCircle(x + 7, y + 2, size * 0.83);
  g.fillStyle(0x376b4d);
  g.fillCircle(x - size * 0.44, y - size * 0.25, size * 0.78);
  g.fillStyle(0x43805a);
  g.fillCircle(x + size * 0.3, y - size * 0.42, size * 0.77);
  g.fillStyle(0x69a06a, 0.6);
  g.fillEllipse(x - size * 0.56, y - size * 0.69, size * 0.75, size * 0.3);
  g.fillEllipse(x + size * 0.17, y - size * 0.82, size * 0.65, size * 0.27);
}

export function drawTerrain(scene: Phaser.Scene, nodes: ResourceNode[]): void {
  const g = scene.add.graphics().setDepth(0);
  const width = BALANCE.mapWidth * TILE;
  const height = BALANCE.mapHeight * TILE;
  const cx = worldX(BALANCE.campX);
  const cy = worldY(BALANCE.campY);
  g.fillStyle(0x426b52);
  g.fillRect(0, 0, width, height);

  for (let i = 0; i < 440; i++) {
    const x = seed(i, 3) * width;
    const y = seed(i, 7) * height;
    const radius = 12 + seed(i, 11) * 31;
    g.fillStyle(forest[Math.floor(seed(i, 13) * forest.length)], 0.34);
    g.fillEllipse(x, y, radius * 2, radius * (0.7 + seed(i, 17)));
  }

  // Worn grass and packed earth make the camp the visual anchor.
  g.fillStyle(0xa18e64, 0.16);
  g.fillEllipse(cx + 15, cy + 9, 420, 326);
  g.fillStyle(0x9e916b, 0.53);
  g.fillEllipse(cx, cy + 4, 325, 260);
  g.fillStyle(0xb4a275, 0.46);
  g.fillEllipse(cx - 12, cy - 10, 274, 216);
  for (let i = 0; i < 46; i++) {
    const angle = i * Math.PI * 2 / 46;
    const radius = BALANCE.campRadius * TILE;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    g.fillStyle(i % 4 === 0 ? 0xe3d7ad : 0xd2c399, 0.6);
    g.fillEllipse(x, y, 5 + i % 3, 3 + i % 2);
  }
  g.lineStyle(2, 0xe7d6a5, 0.5);
  g.strokeCircle(cx, cy, BALANCE.campRadius * TILE);

  for (let i = 0; i < 360; i++) {
    const x = seed(i, 23) * width;
    const y = seed(i, 29) * height;
    if (Math.hypot(x - cx, y - cy) < 105) continue;
    const flower = seed(i, 31) > 0.87;
    g.lineStyle(1.5, flower ? 0xb5c891 : 0x93b57a, flower ? 0.8 : 0.45);
    g.lineBetween(x - 3, y + 3, x, y - 2);
    g.lineBetween(x + 2, y + 3, x, y - 2);
    if (flower) {
      g.fillStyle(i % 3 === 0 ? 0xf0ce84 : 0xd9e1b2, 0.9);
      g.fillCircle(x, y - 3, 2.5);
    }
  }

  for (let i = 0; i < 78; i++) {
    const x = 30 + seed(i, 43) * (width - 60);
    const y = 35 + seed(i, 47) * (height - 70);
    if (Math.hypot(x - cx, y - cy) < 178) continue;
    if (nodes.some(node => Math.hypot(x - worldX(node.x), y - worldY(node.y)) < 35)) continue;
    if (seed(i, 53) > 0.28) tree(g, x, y, 15 + seed(i, 59) * 10);
    else {
      g.fillStyle(0x253f37, 0.22);
      g.fillEllipse(x + 5, y + 6, 28, 11);
      g.fillStyle(0x9aa69a);
      g.fillEllipse(x, y, 22, 14);
      g.fillStyle(0xc4cabc, 0.55);
      g.fillEllipse(x - 5, y - 3, 10, 4);
    }
  }
}

function drawBranch(g: Phaser.GameObjects.Graphics, node: ResourceNode, time: number): void {
  const x = worldX(node.x);
  const y = worldY(node.y);
  const ready = node.amount > 0;
  if (ready) {
    g.fillStyle(0xe8bd73, 0.11 + Math.sin(time / 380 + x) * 0.04);
    g.fillEllipse(x, y, 59, 34);
  }
  g.fillStyle(0x213b31, 0.3);
  g.fillEllipse(x + 4, y + 10, 42, 13);
  g.lineStyle(ready ? 9 : 5, ready ? 0x61452f : 0x58624f, ready ? 1 : 0.55);
  g.lineBetween(x - 18, y + 4, x + 18, y + 1);
  g.lineStyle(ready ? 6 : 4, ready ? 0x8e6843 : 0x68705a, ready ? 1 : 0.55);
  g.lineBetween(x - 13, y - 5, x + 12, y + 8);
  if (ready) {
    g.lineStyle(2, 0xb98d5b);
    g.lineBetween(x - 16, y, x + 15, y - 2);
    g.lineBetween(x - 5, y - 3, x + 9, y + 4);
    g.fillStyle(0xe1ba7e);
    g.fillCircle(x + 18, y + 1, 3);
    g.fillCircle(x + 12, y + 8, 2);
  }
}

function drawBerry(g: Phaser.GameObjects.Graphics, node: ResourceNode, time: number): void {
  const x = worldX(node.x);
  const y = worldY(node.y);
  const ready = node.amount > 0;
  if (ready) {
    g.fillStyle(0xd6df9b, 0.09 + Math.sin(time / 420 + x) * 0.03);
    g.fillCircle(x, y, 27);
  }
  g.fillStyle(0x203c32, 0.3);
  g.fillEllipse(x + 5, y + 11, 42, 17);
  g.fillStyle(ready ? 0x265b43 : 0x3c604b, ready ? 1 : 0.67);
  g.fillCircle(x - 10, y + 2, 12);
  g.fillCircle(x + 9, y + 1, 13);
  g.fillStyle(ready ? 0x3d8053 : 0x52745a, ready ? 1 : 0.67);
  g.fillCircle(x, y - 5, 13);
  g.fillStyle(0x72a76b, ready ? 0.8 : 0.3);
  g.fillEllipse(x - 8, y - 8, 12, 5);
  g.fillEllipse(x + 7, y - 11, 9, 5);
  if (ready) {
    g.fillStyle(0xd9695e);
    [[-9, 1], [7, -3], [2, 8], [11, 7], [-2, -9]].forEach(([dx, dy]) => g.fillCircle(x + dx, y + dy, 3.4));
    g.fillStyle(0xf5b099, 0.9);
    g.fillCircle(x - 10, y, 1.2);
    g.fillCircle(x + 6, y - 4, 1.2);
  }
}

function drawShelter(g: Phaser.GameObjects.Graphics, built: boolean, bed: boolean): void {
  const x = worldX(BALANCE.campX - 3);
  const y = worldY(BALANCE.campY - 2);
  g.fillStyle(0x493d30, 0.24);
  g.fillEllipse(x + 4, y + 18, 116, 83);
  if (!built) {
    g.fillStyle(0x877a5a, 0.55);
    g.fillRoundedRect(x - 51, y - 27, 102, 75, 9);
    g.fillStyle(0xb6a47a, 0.62);
    g.fillRoundedRect(x - 44, y - 21, 88, 62, 6);
    g.lineStyle(3, 0xe0c791, 0.82);
    g.strokeRect(x - 45, y - 22, 90, 65);
    for (const dx of [-48, 48]) for (const dy of [-25, 45]) {
      g.fillStyle(0x68543e);
      g.fillCircle(x + dx, y + dy, 4);
      g.fillStyle(0xd7b884);
      g.fillCircle(x + dx - 1, y + dy - 1, 1.5);
    }
    return;
  }
  g.fillStyle(0x574333);
  g.fillRoundedRect(x - 52, y - 27, 104, 76, 8);
  g.fillStyle(0xb57a4d);
  g.fillTriangle(x, y - 62, x - 54, y + 20, x, y + 17);
  g.fillStyle(0xd6a06b);
  g.fillTriangle(x, y - 62, x + 54, y + 20, x, y + 17);
  g.lineStyle(3, 0xf1c894, 0.85);
  g.lineBetween(x, y - 61, x, y + 18);
  g.lineBetween(x - 53, y + 20, x + 53, y + 20);
  g.fillStyle(0x704633);
  g.fillTriangle(x - 18, y + 21, x + 18, y + 21, x, y + 45);
  g.fillStyle(0x322e29);
  g.fillTriangle(x - 9, y + 23, x + 9, y + 23, x, y + 43);
  if (bed) {
    g.fillStyle(0xe3c690);
    g.fillRoundedRect(x - 39, y + 26, 25, 13, 3);
    g.fillStyle(0xf1dfb7);
    g.fillRoundedRect(x - 37, y + 27, 8, 10, 2);
  }
}

function drawCrate(g: Phaser.GameObjects.Graphics, built: boolean): void {
  const x = worldX(BALANCE.campX + 3);
  const y = worldY(BALANCE.campY + 1);
  g.fillStyle(0x3d382c, 0.25);
  g.fillEllipse(x + 4, y + 11, 49, 24);
  if (!built) {
    g.lineStyle(2, 0xdac492, 0.75);
    g.strokeRect(x - 23, y - 17, 46, 34);
    g.lineBetween(x - 23, y - 17, x + 23, y + 17);
    g.lineBetween(x + 23, y - 17, x - 23, y + 17);
    return;
  }
  g.fillStyle(0x775238);
  g.fillRoundedRect(x - 23, y - 18, 46, 36, 4);
  g.fillStyle(0xa47447);
  g.fillRoundedRect(x - 23, y - 18, 46, 13, 3);
  g.lineStyle(3, 0xd1a76b);
  g.strokeRect(x - 20, y - 15, 40, 30);
  g.lineBetween(x - 18, y - 3, x + 18, y + 11);
  g.fillStyle(0xe1bd80);
  g.fillCircle(x - 17, y - 11, 2);
  g.fillCircle(x + 17, y + 11, 2);
}

function drawDryingRack(g: Phaser.GameObjects.Graphics, built: boolean): void {
  const x = worldX(BALANCE.campX + 2);
  const y = worldY(BALANCE.campY - 2);
  g.fillStyle(0x3d382c, 0.22);
  g.fillEllipse(x + 4, y + 13, 67, 20);
  if (!built) {
    g.lineStyle(2, 0xdac492, 0.8);
    g.lineBetween(x - 27, y - 11, x + 27, y - 11);
    g.lineBetween(x - 27, y + 15, x + 27, y + 15);
    for (const dx of [-27, 27]) for (const dy of [-11, 15]) {
      g.fillStyle(0x866a48);
      g.fillCircle(x + dx, y + dy, 3);
    }
    return;
  }
  g.lineStyle(7, 0x573423);
  g.lineBetween(x - 27, y + 14, x - 27, y - 30);
  g.lineBetween(x + 27, y + 14, x + 27, y - 30);
  g.lineStyle(4, 0xb07a47);
  g.lineBetween(x - 31, y - 30, x + 31, y - 30);
  g.lineBetween(x - 27, y - 9, x + 27, y - 9);
  for (const dx of [-17, -5, 7, 19]) {
    g.lineStyle(2, 0xd9a86a);
    g.lineBetween(x + dx, y - 28, x + dx, y - 14);
    g.fillStyle(0xb83a45);
    g.fillCircle(x + dx, y - 13, 4);
    g.fillStyle(0xffc2a8);
    g.fillCircle(x + dx - 1, y - 15, 1);
  }
}

function drawWindbreak(g: Phaser.GameObjects.Graphics, built: boolean): void {
  const x = worldX(BALANCE.campX - 2);
  const y = worldY(BALANCE.campY + 2);
  g.fillStyle(0x3d382c, 0.22);
  g.fillEllipse(x + 4, y + 13, 86, 19);
  if (!built) {
    g.lineStyle(2, 0xdac492, 0.8);
    g.lineBetween(x - 38, y + 9, x + 38, y + 9);
    for (const dx of [-38, -19, 0, 19, 38]) {
      g.fillStyle(0x866a48);
      g.fillCircle(x + dx, y + 9, 3);
    }
    return;
  }
  g.fillStyle(0x573423);
  g.fillRoundedRect(x - 41, y - 24, 82, 31, 4);
  for (const dx of [-35, -18, -1, 16, 33]) {
    g.fillStyle(dx % 2 ? 0x85512f : 0x9b653b);
    g.fillRoundedRect(x + dx - 7, y - 22, 13, 31, 2);
    g.lineStyle(2, 0xd9a86a, 0.65);
    g.lineBetween(x + dx - 4, y - 20, x + dx - 4, y + 4);
  }
  g.lineStyle(5, 0x573423);
  g.lineBetween(x - 43, y + 7, x + 43, y + 7);
}

function drawFire(g: Phaser.GameObjects.Graphics, fuel: number, time: number, hearth: boolean): void {
  const x = worldX(BALANCE.campX);
  const y = worldY(BALANCE.campY);
  g.fillStyle(0x674e37, 0.33);
  g.fillCircle(x, y + 5, 40);
  g.fillStyle(hearth ? 0x718489 : 0x957d5f);
  g.fillCircle(x, y, hearth ? 38 : 29);
  if (hearth) {
    g.lineStyle(4, 0xd8d5bd);
    g.strokeCircle(x, y, 35);
    g.fillStyle(0xc2c9bb);
    g.fillRoundedRect(x - 32, y + 20, 64, 11, 3);
  }
  g.fillStyle(0x3e3d35);
  g.fillCircle(x, y, 22);
  for (let i = 0; i < 9; i++) {
    const angle = i * Math.PI * 2 / 9;
    g.fillStyle(hearth ? (i % 2 ? 0x9eb5b6 : 0xc6d2c7) : (i % 2 ? 0xc3b5a0 : 0xd8c8aa));
    g.fillEllipse(x + Math.cos(angle) * (hearth ? 32 : 25), y + Math.sin(angle) * (hearth ? 32 : 25), hearth ? 14 : 11, 8);
  }
  g.lineStyle(6, 0x815536);
  g.lineBetween(x - 12, y + 8, x + 11, y - 5);
  g.lineBetween(x - 12, y - 5, x + 12, y + 9);
  if (fuel <= 0) {
    g.fillStyle(0x766a5f, 0.5);
    g.fillCircle(x, y, 8);
    return;
  }
  const flicker = Math.sin(time / 140) * 3;
  g.fillStyle(0xe47a3c);
  g.fillTriangle(x - 14, y + 8, x + 13, y + 8, x + flicker, y - 26);
  g.fillStyle(0xffb653);
  g.fillTriangle(x - 9, y + 8, x + 10, y + 8, x - 4 - flicker / 2, y - 17);
  g.fillStyle(0xffe4a1);
  g.fillTriangle(x - 4, y + 7, x + 5, y + 7, x + 2, y - 10);
  g.fillStyle(0xffd47c, 0.8);
  g.fillCircle(x + 14, y - 21 - Math.abs(flicker), 2);
}

export function drawObjects(g: Phaser.GameObjects.Graphics, state: GameState, time: number): void {
  g.clear();
  for (const node of state.nodes) {
    if (node.kind === 'branch') drawBranch(g, node, time);
    else drawBerry(g, node, time);
  }
  drawShelter(g, state.structures.shelter, state.structures.bed);
  drawCrate(g, state.structures.crate);
  drawDryingRack(g, state.structures.dryingRack);
  drawWindbreak(g, state.structures.windbreak);
  drawFire(g, state.fireFuel, time, state.structures.hearth);
}

export function makeSurvivor(scene: Phaser.Scene): { root: Phaser.GameObjects.Container; figure: Phaser.GameObjects.Container } {
  const shadow = scene.add.ellipse(3, 18, 29, 12, 0x20372f, 0.42);
  const boots = [scene.add.ellipse(-7, 13, 10, 7, 0x3c3d35), scene.add.ellipse(7, 13, 10, 7, 0x3c3d35)];
  const pack = scene.add.ellipse(-13, 0, 14, 23, 0xd5a064).setStrokeStyle(2, 0x78583f);
  const coat = scene.add.ellipse(0, 1, 24, 27, 0xb55e4c).setStrokeStyle(2, 0x744b3f);
  const arms = [scene.add.ellipse(-13, 0, 7, 15, 0x9b5143), scene.add.ellipse(13, 0, 7, 15, 0x9b5143)];
  const scarf = scene.add.ellipse(0, -7, 21, 8, 0xe9c47a);
  const face = scene.add.circle(0, -15, 9, 0xeec7a4).setStrokeStyle(1.5, 0xa4735f);
  const hair = scene.add.arc(0, -18, 9, 185, 355, false, 0x4d3d37);
  const highlight = scene.add.ellipse(-3, -19, 7, 3, 0x8b6750, 0.7);
  const figure = scene.add.container(0, 0, [...boots, pack, coat, ...arms, scarf, face, hair, highlight]);
  const root = scene.add.container(0, 0, [shadow, figure]).setDepth(20);
  return { root, figure };
}
