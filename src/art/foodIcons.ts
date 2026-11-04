import { iconUrl, type JournalIcon } from './journalIcons';

// The Bag panel's little pictures of foraged food and what the camp makes from it, on the journal icons' 10×10 grid.

type FoodIconId = 'greens' | 'hazelnut' | 'honey' | 'pineNeedles' | 'roastedHazelnuts' | 'vegetables' | 'fish' | 'rabbit' | 'pineTea' | 'salad' | 'honeyCake' | 'stew' | 'bread' | 'flour' | 'loaf' | 'apple' | 'egg' | 'omelette' | 'bakedApple' | 'eggOnBread' | 'applePie';

/** A round loaf, its crust scored and dusted with flour. */
const LOAF: JournalIcon = { legend: { k: 'wood1', c: 'earth2', C: 'earth3', W: 'earth4', s: 'canvas4' }, rows: [
    '..........',
    '..........',
    '...kkkk...',
    '..kCWWCk..',
    '.kCWsWsCk.',
    '.kCCWWCCk.',
    '.kcCCCCck.',
    '..kcccck..',
    '...kkkk...',
    '..........'
  ] };

export const FOOD_ICONS: Record<FoodIconId, JournalIcon> = {
  apple: { legend: { d: 'wood2', l: 'leaf3', L: 'leaf4', r: 'berry1', R: 'berry2', W: 'berry3' }, rows: [
    '..........',
    '....d.....',
    '...dLL....',
    '..rrrRR...',
    '.rRRRRRR..',
    '.rRWRRRRr.',
    '.rRRRRRRr.',
    '..rRRRr...',
    '...rrr....',
    '..........'
  ] },
  egg: { legend: { c: 'canvas1', C: 'canvas3', W: 'canvas4', s: 'stone1' }, rows: [
    '..........',
    '....cc....',
    '...cWWc...',
    '..cWWWWc..',
    '..cWWWWc..',
    '.cWWWWWWc.',
    '.cWWWWWWc.',
    '..cCCCCc..',
    '...cccc...',
    '..........'
  ] },
  omelette: { legend: { p: 'stone2', P: 'stone3', y: 'scarf2', Y: 'scarf3', o: 'fire2' }, rows: [
    '..........',
    '..........',
    '..pppppp..',
    '.pPYYYYPp.',
    'pPYYYYYYPp',
    'pPYYoYYYYp',
    '.pPYYYYPp.',
    '..pPPPPp..',
    '...pppp...',
    '..........'
  ] },
  // An apple split open on a stone, its middle gone soft and golden.
  bakedApple: { legend: { d: 'wood1', r: 'berry1', R: 'berry2', o: 'fire2', O: 'fire3', p: 'stone2' }, rows: [
    '..........',
    '....d.....',
    '..rrdrr...',
    '.rRRRRRr..',
    '.rRoooRr..',
    '.rRoOoRr..',
    '.rRRRRRr..',
    '..rrrrr...',
    '.ppppppp..',
    '..........'
  ] },
  // A fried egg on a thick slice.
  eggOnBread: { legend: { k: 'wood1', C: 'earth3', e: 'canvas4', y: 'scarf3' }, rows: [
    '..........',
    '..........',
    '..kkkkkk..',
    '.kCCCCCCk.',
    '.kCeeeeCk.',
    '.keeyyeek.',
    '.kCeeeeCk.',
    '.kCCCCCCk.',
    '..kkkkkk..',
    '..........'
  ] },
  // A lattice-topped pie, with apple showing through, in its dish.
  applePie: { legend: { c: 'earth2', W: 'earth4', r: 'berry2', d: 'stone2' }, rows: [
    '..........',
    '..........',
    '...cccc...',
    '..cWrWrc..',
    '.cWWWWWWc.',
    '.crWrWrWc.',
    '.cWWWWWWc.',
    '.dddddddd.',
    '..dddddd..',
    '..........'
  ] },
  bread: LOAF,
  loaf: LOAF,
  // A little sack of flour, tied at the neck.
  flour: { legend: { k: 'canvas0', c: 'canvas2', C: 'canvas3', W: 'canvas4', t: 'wood2' }, rows: [
    '..........',
    '....tt....',
    '...kttk...',
    '...kCCk...',
    '..kCWWCk..',
    '.kCWWWWCk.',
    '.kCWWWWCk.',
    '.kcCCCCck.',
    '..kkkkkk..',
    '..........'
  ] },
  rabbit: { legend: { d: 'earth1', f: 'earth2', F: 'earth3', w: 'fox4', e: 'ink' }, rows: [
    '..........',
    '...d.d....',
    '...f.f....',
    '...ffF....',
    '..dfeFf...',
    '..dfFFFf..',
    '.wdfFFFFf.',
    '.wwfFFFFf.',
    '...dfffd..',
    '..........'
  ] },
  fish: { legend: { d: 'stone1', f: 'stone2', F: 'stone3', w: 'stone4', s: 'frost', e: 'night' }, rows: [
    '..........',
    '..........',
    '...ffff...',
    '.dfFFFFfd.',
    'dfFwweFffd',
    'dFsssssFfd',
    '.dfFFFFfd.',
    '...dddd...',
    '..........',
    '..........'
  ] },
  greens: { legend: { d: 'leaf1', g: 'leaf2', G: 'leaf3', L: 'leaf4' }, rows: [
    '..........',
    '...L...L..',
    '..GG..GG..',
    '..GG.GGg..',
    '.LGg.Gg...',
    '.GGgGGg.L.',
    '..GgGg.GG.',
    '...dGdGg..',
    '....ddd...',
    '..........'
  ] },
  hazelnut: { legend: { k: 'wood1', n: 'wood2', N: 'wood3', W: 'wood4', g: 'leaf3', L: 'leaf4' }, rows: [
    '..........',
    '....kk....',
    '...gLLg...',
    '..gnNNng..',
    '..nNNWNn..',
    '..nNNNWn..',
    '..nNNNNn..',
    '...nNNn...',
    '....kk....',
    '..........'
  ] },
  honey: { legend: { c: 'canvas1', C: 'canvas3', h: 'scarf2', H: 'scarf3', W: 'scarf4', k: 'wood1' }, rows: [
    '...kkkk...',
    '...cCCc...',
    '..cCCCCc..',
    '.cHHHHHHc.',
    '.cHWHHHHc.',
    '.cHWHHHhc.',
    '.cHHHHHhc.',
    '.chHHHhhc.',
    '..cccccc..',
    '..........'
  ] },
  pineNeedles: { legend: { k: 'wood1', i: 'leaf1', j: 'leaf2', l: 'leaf3' }, rows: [
    '..........',
    '.l...l..l.',
    '..j..j.j..',
    '...j.jj...',
    '.l..ijj..l',
    '..jjii.jj.',
    '....ii....',
    '....kk....',
    '...kk.....',
    '..........'
  ] },
  roastedHazelnuts: { legend: { k: 'wood0', n: 'wood1', N: 'wood2', W: 'wood3', o: 'fire2' }, rows: [
    '..........',
    '..........',
    '...nN.....',
    '..nNWn.nN.',
    '..nNNnnNWn',
    '.nN.nnNNNn',
    'nNWn.nNNn.',
    'nNNnkk.k..',
    '.nnk..o...',
    '..........'
  ] },
  vegetables: { legend: { g: 'leaf3', G: 'leaf4', o: 'fire2', O: 'fire3', b: 'leaf2', B: 'leaf4', p: 'earth3', P: 'earth4', k: 'earth2' }, rows: [
    '..G.......',
    '.gGg......',
    '..oO...bB.',
    '..oO..bBb.',
    '..oo.bBb..',
    '...o.bb...',
    '..kppk....',
    '.kpPPpk...',
    '.kppPpk...',
    '..kkkk....'
  ] },
  pineTea: { legend: { c: 'stone2', C: 'stone3', t: 'scarf1', T: 'scarf2', l: 'leaf3', s: 'frost' }, rows: [
    '...s..s...',
    '....s..s..',
    '...s..s...',
    '.cCCCCCc..',
    '.cTlTlTcc.',
    '.cTTlTTc.c',
    '.ctTTTtcc.',
    '..cttttc..',
    '...cccc...',
    '..........'
  ] },
  salad: { legend: { b: 'wood2', B: 'wood3', g: 'leaf2', G: 'leaf3', L: 'leaf4', r: 'berry2', f: 'flower2' }, rows: [
    '..........',
    '...L.G....',
    '..GLGrGL..',
    '.gGfGGrGg.',
    '.gGGgrGGg.',
    'bBBBBBBBBb',
    '.bBBBBBBb.',
    '..bbbbbb..',
    '..........',
    '..........'
  ] },
  honeyCake: { legend: { c: 'earth2', C: 'earth3', W: 'earth4', h: 'scarf3', H: 'scarf4' }, rows: [
    '..........',
    '...hHHh...',
    '..hHHHHh..',
    '.chhhhhhc.',
    '.cCWCCWCc.',
    '.cCCCCCCc.',
    '.cWCCWCCc.',
    '.cccccccc.',
    '..........',
    '..........'
  ] },
  stew: { legend: { c: 'stone1', C: 'stone2', b: 'earth2', o: 'fire2', g: 'leaf3', y: 'scarf3', s: 'frost' }, rows: [
    '..s...s...',
    '...s...s..',
    '..s...s...',
    '.cCCCCCCc.',
    'ccbobgbycc',
    '.cbgybobc.',
    '.cCbbbbCc.',
    '..cCCCCc..',
    '...cccc...',
    '..........'
  ] }
};

/** A food's icon as a small SVG data URL, for an `<img>` in the Bag panel. */
export function foodIconUrl(id: keyof typeof FOOD_ICONS): string {
  return iconUrl(FOOD_ICONS[id]);
}
