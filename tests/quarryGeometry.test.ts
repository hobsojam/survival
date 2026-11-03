import { describe, expect, it } from 'vitest';
import { FACE_HEIGHT, TRACK_HALF_WIDTH, faceBottom, floorDepth, quarryGroundAt, trackDistance } from '../src/scene/quarryGeometry';
import { QUARRY_EXIT, QUARRY_SITE, RUBBLE_SITE } from '../src/game/areas';
import { QUARRY_PATHS, QUARRY_SIGN } from '../src/scene/mapGeometry';
import { quarryGroundTile, terrainSprites } from '../src/art/terrain';
import { BALANCE } from '../src/game/state';

/** The ground at a tile-space point, read at the pixel it falls in. */
const groundAt = (x: number, y: number) => quarryGroundAt(Math.floor(x * 16), Math.floor(y * 16));

describe('the quarry\'s shapes', () => {
  it('puts the dig spot on the floor just below the face', () => {
    expect(faceBottom(QUARRY_SITE.x)).toBe(11);
    expect(floorDepth(QUARRY_SITE.x + .5, QUARRY_SITE.y + .5)).toBeLessThan(.92);
    const below = QUARRY_SITE.y + .5 - faceBottom(QUARRY_SITE.x + .5)!;
    expect(below).toBeGreaterThanOrEqual(1);
    expect(below).toBeLessThanOrEqual(2);
  });

  it('puts the rubble on the floor', () => {
    expect(floorDepth(RUBBLE_SITE.x + .5, RUBBLE_SITE.y + .5)).toBeLessThan(1);
  });

  it('runs the track from the floor to the exit', () => {
    const [fromX, fromY, toX, toY] = QUARRY_PATHS[0];
    expect([fromX, fromY]).toEqual([19, 14]);
    for (let i = 0; i <= 40; i++) {
      const x = fromX + .5 + (toX - fromX) * i / 40, y = fromY + .5 + (toY - fromY) * i / 40;
      expect(['track', 'floor'], `${x},${y}`).toContain(groundAt(x, y));
    }
    expect(groundAt(QUARRY_EXIT.x + .5, QUARRY_EXIT.y + .5)).toBe('track');
    expect(trackDistance(QUARRY_EXIT.x + .5, QUARRY_EXIT.y + .5)).toBeLessThan(TRACK_HALF_WIDTH);
  });

  it('keeps the signpost off the track and the floor', () => {
    expect(groundAt(QUARRY_SIGN.x + .5, QUARRY_SIGN.y + .5)).toBe('grass');
  });

  it('ends the cliff east of the dig spot, stepping back as it goes', () => {
    expect(faceBottom(19)).toBeNull();
    expect(faceBottom(16)).toBeLessThan(11);
    expect(faceBottom(16)).toBeGreaterThan(8);
    expect(FACE_HEIGHT).toBe(2.5);
  });

  it('draws the face with seams, a lip and plateau above, and a shadow at its foot', () => {
    const column = Array.from({ length: 13 * 16 }, (_, py) => quarryGroundAt(5 * 16 + 3, py));
    expect(column[11 * 16 - 8]).toMatch(/^(face|seam)$/);
    expect(column).toContain('seam');
    expect(column[11 * 16]).toBe('foot');
    expect(column[Math.floor((11 - FACE_HEIGHT) * 16) - 1]).toBe('lip');
    expect(column[2 * 16]).toBe('plateau');
  });

  it('gives the track a soft edge, not an outline', () => {
    const classes = Array.from({ length: 6 * 16 }, (_, i) => groundAt(30.5, 12 + i / 16));
    const runs = classes.filter((item, i) => i === 0 || item !== classes[i - 1]);
    expect(runs).toEqual(['grass', 'trackEdge', 'track', 'trackEdge', 'grass']);
  });
});

describe('the quarry\'s ground tiles', () => {
  const colours = (name: string): string[] => {
    const tile = terrainSprites[name];
    return [...new Set(tile.frames.still.join('').split(''))].map(c => tile.legend[c]);
  };

  it('draws plain grass where nothing is worked', () => {
    expect(quarryGroundTile(30, 25)).toMatch(/^grass\d$/);
  });

  it('draws every quarry ground tile as a registered sprite', () => {
    for (let y = 0; y < BALANCE.mapHeight; y++) for (let x = 0; x < BALANCE.mapWidth; x++)
      expect(terrainSprites[quarryGroundTile(x, y)], `${x},${y}`).toBeDefined();
  });

  it('draws the track in path colours, so it snows over like the camp paths, and nothing outside the seasons\' reach', () => {
    const track = colours(quarryGroundTile(30, 15));
    expect(track.some(colour => colour.startsWith('path'))).toBe(true);
    expect(track.every(colour => /^(path|grass)\d$/.test(colour))).toBe(true);
    for (let y = 0; y < BALANCE.mapHeight; y++) for (let x = 0; x < BALANCE.mapWidth; x++)
      for (const colour of colours(quarryGroundTile(x, y))) expect(colour, `${x},${y}`).toMatch(/^(grass|path|leaf|stone|earth)\d$|^shadow$/);
  });

  it('paints the face in stone with seams', () => {
    const face = colours(quarryGroundTile(8, 9));
    expect(face).toContain('stone1');
    expect(face.some(colour => colour === 'stone2' || colour === 'stone3')).toBe(true);
    expect(face.some(colour => colour.startsWith('grass'))).toBe(false);
  });

  it('paints the floor pale, with no hard outline at its edge', () => {
    const floor = colours(quarryGroundTile(13, 14));
    expect(floor.every(colour => /^(stone[34]|earth[34])$/.test(colour))).toBe(true);
    expect(colours(quarryGroundTile(13, 18)).includes('earth0')).toBe(false);
  });
});
