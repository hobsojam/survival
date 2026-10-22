import Phaser from 'phaser';
import { BALANCE, type GameState, type ResourceNode } from '../game/state';
import { buildMap, type MapItem } from './map';
import { sprites } from '../art/sprites';

export const TILE = 16;
export const worldX = (x: number) => (x + 0.5) * TILE;
export const worldY = (y: number) => (y + 0.5) * TILE;

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
