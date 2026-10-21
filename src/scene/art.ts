import Phaser from 'phaser';
import { BALANCE, type GameState, type ResourceNode } from '../game/state';
import { buildMap, type MapItem } from './map';
import { sprites } from '../art/sprites';

export const TILE = 16;
export const worldX = (x: number) => (x + 0.5) * TILE;
export const worldY = (y: number) => (y + 0.5) * TILE;

// Temporary Phase 1 adapter. Procedural art is replaced by sprites in later phases.
const LEGACY_TILE = 32;
export const legacyWorldX = (x: number) => (x + 0.5) * LEGACY_TILE;
export const legacyWorldY = (y: number) => (y + 0.5) * LEGACY_TILE;

export function drawTerrain(scene: Phaser.Scene, nodes: ResourceNode[]): void {
  const map = buildMap(nodes);
  const canvas = document.createElement('canvas');
  canvas.width = BALANCE.mapWidth * TILE;
  canvas.height = BALANCE.mapHeight * TILE;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Terrain canvas is unavailable.');
  context.imageSmoothingEnabled = false;
  const stamp = (name: string, x: number, y: number) => {
    const source = scene.textures.get(`${name}:still`).getSourceImage() as CanvasImageSource;
    context.drawImage(source, x, y);
  };
  for (let y = 0; y < map.ground.length; y++) for (let x = 0; x < map.ground[y].length; x++)
    stamp(map.ground[y][x], x * TILE, y * TILE);
  for (const item of [...map.decorations, ...map.rimStones]) {
    const def = sprites[item.sprite];
    stamp(item.sprite, Math.round(item.x * TILE - def.anchor[0]), Math.round(item.y * TILE - def.anchor[1]));
  }
  scene.textures.addCanvas('terrainMap', canvas);
  scene.add.image(0, 0, 'terrainMap').setOrigin(0).setDepth(-100);
  const standing = (item: MapItem) => {
    const def = sprites[item.sprite];
    scene.add.image(Math.round(worldX(item.x)), Math.round(worldY(item.y)), `${item.sprite}:still`)
      .setOrigin(def.anchor[0] / def.size[0], def.anchor[1] / def.size[1])
      .setDepth(Math.round(worldY(item.y)));
  };
  map.trees.forEach(standing);
  map.rocks.forEach(standing);
}

function drawBranch(g: Phaser.GameObjects.Graphics, node: ResourceNode, time: number): void {
  const x = legacyWorldX(node.x);
  const y = legacyWorldY(node.y);
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
  const x = legacyWorldX(node.x);
  const y = legacyWorldY(node.y);
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

function drawFiber(g: Phaser.GameObjects.Graphics, node: ResourceNode, time: number): void {
  const x = legacyWorldX(node.x);
  const y = legacyWorldY(node.y);
  const ready = node.amount > 0;
  g.fillStyle(0x233d32, 0.34);
  g.fillEllipse(x + 3, y + 10, 32, 10);
  for (const offset of [-11, -5, 2, 9]) {
    const sway = ready ? Math.sin(time / 600 + offset) * 2 : 0;
    const top = ready ? y - 18 - offset % 4 : y + 3;
    g.lineStyle(ready ? 3 : 2, ready ? 0x72975a : 0x617358, ready ? 1 : 0.65);
    g.lineBetween(x + offset, y + 7, x + offset + sway, top);
    if (ready) {
      g.fillStyle(0xd9c789);
      g.fillEllipse(x + offset + sway, top - 3, 6, 10);
    }
  }
}

function drawShelter(g: Phaser.GameObjects.Graphics, built: boolean, bed: boolean): void {
  const x = legacyWorldX(BALANCE.campX - 3);
  const y = legacyWorldY(BALANCE.campY - 2);
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
  const x = legacyWorldX(BALANCE.campX + 3);
  const y = legacyWorldY(BALANCE.campY + 1);
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
  const x = legacyWorldX(BALANCE.campX + 2);
  const y = legacyWorldY(BALANCE.campY - 2);
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
  const x = legacyWorldX(BALANCE.campX - 2);
  const y = legacyWorldY(BALANCE.campY + 2);
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
  const x = legacyWorldX(BALANCE.campX);
  const y = legacyWorldY(BALANCE.campY);
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
    else if (node.kind === 'berry') drawBerry(g, node, time);
    else drawFiber(g, node, time);
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
