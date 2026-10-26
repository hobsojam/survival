import Phaser from 'phaser';
import { BALANCE, type GameState } from '../game/state';
import { buildMap, shownTerrainKey, terrainKey, type MapItem } from './map';
import { season } from '../game/calendar';
import { sprites } from '../art/sprites';

export const TILE = 16;
export const worldX = (x: number) => (x + 0.5) * TILE;
export const worldY = (y: number) => (y + 0.5) * TILE;

/** Draws the terrain for the state's current terrain key and returns every object it added. */
export function drawTerrain(scene: Phaser.Scene, state: GameState): Phaser.GameObjects.GameObject[] {
  const key = terrainKey(state);
  const camp = key !== 'quarry';
  const map = buildMap(camp ? state.nodes : [], key, season(state.day));
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
  for (const item of map.pathTiles) stamp(item.sprite, item.x * TILE, item.y * TILE);
  for (const item of map.campEdges) stamp(item.sprite, item.x * TILE, item.y * TILE);
  // Decorations sit on tile centres, like the nodes they keep clear of; rim stones trace the camp circle in tile-corner space.
  for (const item of map.decorations) {
    const def = sprites[item.sprite];
    stamp(item.sprite, Math.round(worldX(item.x) - def.anchor[0]), Math.round(worldY(item.y) - def.anchor[1]));
  }
  for (const item of map.rimStones) {
    const def = sprites[item.sprite];
    stamp(item.sprite, Math.round(item.x * TILE - def.anchor[0]), Math.round(item.y * TILE - def.anchor[1]));
  }
  const name = `terrain-${shownTerrainKey(state)}`;
  scene.textures.addCanvas(name, canvas);
  const objects: Phaser.GameObjects.GameObject[] = [scene.add.image(0, 0, name).setOrigin(0).setDepth(-100)];
  const standing = (item: MapItem) => {
    const def = sprites[item.sprite];
    return scene.add.image(Math.round(worldX(item.x)), Math.round(worldY(item.y)), `${item.sprite}:still`)
      .setOrigin(def.anchor[0] / def.size[0], def.anchor[1] / def.size[1])
      .setDepth(Math.round(worldY(item.y)));
  };
  // The camp's choppable trees are drawn as objects of their own.
  const chopTargets = camp ? state.trees : [];
  objects.push(...map.trees.filter(tree => !chopTargets.some(target => target.x === tree.x && target.y === tree.y)).map(standing));
  return objects;
}
