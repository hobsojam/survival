import { box, define, dot, type Grid } from './sheepSprites';
import type { SpriteDef } from './sprites';

// The orchard's plot, all of it flat on the ground, so trees and the survivor stand over it.

const WIDE = 88;
const TALL = 104;

function plot(g: Grid): void {
  for (const y of [1, TALL - 3]) box(g, 0, y, WIDE, 1, 'b');
  for (const x of [1, WIDE - 3]) box(g, x, 1, 1, TALL - 3, 'b');
  const post = (x: number, y: number): void => {
    box(g, x, y, 3, 4, 'c');
    dot(g, x, y, 'd');
  };
  for (let x = 0; x <= WIDE - 3; x += 17) { post(x, 0); post(x, TALL - 4); }
  for (let y = 0; y <= TALL - 4; y += 17) { post(0, y); post(WIDE - 4, y); }
}

function plotSite(g: Grid): void {
  for (let x = 0; x <= WIDE - 2; x += 34) { box(g, x, 0, 2, 3, 'c'); box(g, x, TALL - 3, 2, 3, 'c'); }
  for (let y = 0; y <= TALL - 3; y += 34) { box(g, 0, y, 2, 3, 'c'); box(g, WIDE - 2, y, 2, 3, 'c'); }
  for (let x = 5; x < WIDE - 4; x += 6) { dot(g, x, 1, 'v'); dot(g, x, TALL - 2, 'v'); }
  for (let y = 5; y < TALL - 4; y += 6) { dot(g, 1, y, 'v'); dot(g, WIDE - 2, y, 'v'); }
}

export const orchardSprites: Record<string, SpriteDef> = {
  orchard: define(WIDE, TALL, { built: plot }, [WIDE / 2, TALL / 2]),
  orchardSite: define(WIDE, TALL, { still: plotSite }, [WIDE / 2, TALL / 2])
};
