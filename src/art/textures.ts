import type Phaser from 'phaser';
import { palette } from './palette';
import { sprites, type SpriteDef } from './sprites';

export function validateSprite(def: SpriteDef): void {
  const [width, height] = def.size;
  const [anchorX, anchorY] = def.anchor;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) throw new Error('Invalid sprite size.');
  if (!Number.isInteger(anchorX) || !Number.isInteger(anchorY) || anchorX < 0 || anchorX >= width || anchorY < 0 || anchorY >= height) throw new Error('Invalid sprite anchor.');
  for (const [symbol, color] of Object.entries(def.legend)) {
    if (symbol.length !== 1 || symbol === '.' || !(color in palette)) throw new Error(`Invalid palette symbol ${symbol}.`);
  }
  if (Object.keys(def.frames).length === 0) throw new Error('Sprite has no frames.');
  for (const [name, rows] of Object.entries(def.frames)) {
    if (rows.length !== height) throw new Error(`Frame ${name} has wrong height.`);
    for (const row of rows) {
      if (row.length !== width) throw new Error(`Frame ${name} has wrong width.`);
      for (const symbol of row) if (symbol !== '.' && !(symbol in def.legend)) throw new Error(`Frame ${name} has unknown symbol ${symbol}.`);
    }
  }
}

export function rasterizeFrame(def: SpriteDef, frame: string): Uint8ClampedArray {
  validateSprite(def);
  const rows = def.frames[frame];
  if (!rows) throw new Error(`Unknown frame ${frame}.`);
  const [width, height] = def.size;
  const bytes = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const symbol = rows[y][x];
    if (symbol === '.') continue;
    const key = def.legend[symbol];
    const hex = palette[key].slice(1);
    const offset = (y * width + x) * 4;
    bytes[offset] = parseInt(hex.slice(0, 2), 16);
    bytes[offset + 1] = parseInt(hex.slice(2, 4), 16);
    bytes[offset + 2] = parseInt(hex.slice(4, 6), 16);
    bytes[offset + 3] = key === 'shadow' ? 115 : 255;
  }
  return bytes;
}

export function registerSpriteTextures(scene: Phaser.Scene): void {
  for (const [name, def] of Object.entries(sprites)) for (const frame of Object.keys(def.frames)) {
    const key = `${name}:${frame}`;
    if (scene.textures.exists(key)) continue;
    const texture = scene.textures.createCanvas(key, ...def.size);
    if (!texture) throw new Error(`Could not create texture ${key}.`);
    const image = texture.context.createImageData(...def.size);
    image.data.set(rasterizeFrame(def, frame));
    texture.context.putImageData(image, 0, 0);
    texture.refresh();
  }
}
