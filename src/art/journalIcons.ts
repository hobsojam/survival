import type { CastleJournalId, JournalId, TownJournalId } from '../game/journalEntries';
import { palette, type PaletteKey } from './palette';

// The year journal's little pictures, drawn in the game's own palette so they look the same on every machine.

export const JOURNAL_ICON_SIZE = 10;

export interface JournalIcon { legend: Record<string, PaletteKey>; rows: readonly string[] }

const flame = { r: 'fire1', o: 'fire2', O: 'fire3', W: 'fire4' } as const;
/** A cloud's outline and body, for the snow and rain icons. */
const cloud = (light: PaletteKey, dark: PaletteKey): Record<string, PaletteKey> => ({ c: dark, C: light });

/** A feather beside a tuft of fur, with a touch of the season in the corner: the same picture for either find. */
const keepsakeIcon = (accent: PaletteKey, top: readonly [string, string]): JournalIcon => ({
  legend: { x: accent, g: 'stone2', w: 'stone4', k: 'wood1', f: 'fox2', F: 'fox3' },
  rows: [...top, '..gg......', '.gwwg.....', '.gwwg.....', '..gwg.ff..', '..gw.fFFf.', '...k.fFFf.', '...k..ff..', '..........']
});

/** A little paw with a touch of the season in the corner: the lines about an animal with a name. */
const namedIcon = (accent: PaletteKey, top: readonly [string, string]): JournalIcon => ({
  legend: { x: accent, k: 'wood1', K: 'wood2' },
  rows: [...top, '..........', '.k.k......', '.k.k.k....', '..KKK.....', '.KKKKK....', '.KKKKK....', '..KKK.....', '..........']
});

/** A low hill with a little of its season showing, in the marks of its own top rows. */
const hillIcon = (slope: PaletteKey, mark: PaletteKey, top: readonly [string, string, string]): JournalIcon => ({
  legend: { s: slope, t: mark },
  rows: ['..........', ...top, '.ssssss...', 'ssssssssss', 'ssssssssss', 'ssssssssss', 'ssssssssss', '..........']
});

/** The tower on a hill in its season's colour, from the top of which the lines are written. */
const keepViewIcon = (slope: PaletteKey, mark: PaletteKey, top: string): JournalIcon => ({
  legend: { s: slope, t: mark, b: 'stone2', d: 'stone0' },
  rows: [top, '...b.b.b..', '...bbbbb..', '...bdbdb..', '...bbbbb..', '...bbdbb..', 'ssssssssss', 'ssssssssss', 'ssssssssss', '..........']
});

/** The finished tower with a last stone beside it, and a touch of the season in the corner. */
const keepFinishedIcon = (accent: PaletteKey, top: string): JournalIcon => ({
  legend: { x: accent, b: 'stone2', d: 'stone0', e: 'stone4' },
  rows: [top, '..b.b.b...', '..bbbbb...', '..bdbdb...', '..bbbbb...', '..bbbbb...', '..bbdbb...', '..bbdbb.ee', '..bbdbb.ee', '..........']
});

/** A row of old stones in the grass of the season, with the keep standing small behind. */
const castleLineIcon = (grass: PaletteKey, mark: PaletteKey, top: string): JournalIcon => ({
  legend: { s: grass, t: mark, b: 'stone2', d: 'stone0' },
  rows: [top, '....bb....', '....bd....', 'ssssssssss', 'ssssssssss', 's.b.bb.b.s', 'ssssssssss', 'ssssssssss', 'sstssssts.', '..........']
});

/** The castle's moments in pictures: a small scene for each, with a touch of the season in the top row. */
const CASTLE_SCENES = {
  castleRoad: ['..........', '..........', '..........', 'bb.bb.bb..', 'bbbbbbbbbb', '.dbbdbbdb.', '..........', '..........', '..........'],
  castleWall: ['..........', '..........', 'b.b.b.b.b.', 'bbbbbbbbbb', 'bdbbbdbbbd', 'bbbbbbbbbb', 'bbdbbbbdbb', '..........', '..........'],
  castleTowers: ['..b.....b.', '.bbb...bbb', '.bbb...bbb', '.bdb...bdb', '.bbb...bbb', '.bbb...bbb', '.bdb...bdb', 'bbbb..bbbb', '..........'],
  castleGatehouse: ['..........', '.bbbbbbbb.', '.bbbbbbbb.', '.bb.dd.bb.', '.bb.dd.bb.', '.bb.dd.bb.', '.bb.dd.bb.', '..........', '..........'],
  castleMoatFull: ['..........', '..........', 'bbbbbbbbbb', 'bdbbbbbbdb', 'wwwwwwwwww', 'wvwwwwvwww', 'wwwwwwwwww', '..........', '..........'],
  castleFeast: ['..........', '..........', '..y..y....', '.rrrrrrrr.', '.kkkkkkkk.', '..k....k..', '..k....k..', '..........', '..........'],
  castleFinished: ['..y.b.y...', '..bbbbb...', '..bdbdb...', '..bbbbb...', '.bbbbbbb..', '.bbydybb..', '.bbbdbbb..', '..........', '..........']
} as const;
const CASTLE_SEASONS = { Autumn: ['fox3', '.......x..'], Winter: ['paper', '.x.....x..'], Spring: ['flower1', '.x........'], Summer: ['flower3', 'x........x'] } as const;
const castleMomentIcon = (moment: keyof typeof CASTLE_SCENES, season: keyof typeof CASTLE_SEASONS): JournalIcon => ({
  legend: { x: CASTLE_SEASONS[season][0], b: 'stone2', d: 'stone0', w: 'storm', v: 'frost', y: 'scarf3', r: 'berry2', k: 'wood1' },
  rows: [CASTLE_SEASONS[season][1], ...CASTLE_SCENES[moment]]
});
const castleMomentIcons: Record<CastleJournalId, JournalIcon> = Object.fromEntries(
  (Object.keys(CASTLE_SEASONS) as (keyof typeof CASTLE_SEASONS)[]).flatMap(season => (Object.keys(CASTLE_SCENES) as (keyof typeof CASTLE_SCENES)[]).map(moment => [`${moment}${season}`, castleMomentIcon(moment, season)]))
) as Record<CastleJournalId, JournalIcon>;

/** The town's moments: a figure at the hall's lit door, two figures by it for a neighbour who stays, the bridge, and the meadow road's milestone. EASTER EGG: the town, see src/game/town.ts. */
const TOWN_SCENES = {
  traveller: ['..........', '.bbbbbbb..', '.bbyyybb..', '.bbyyybb..', '.bbyyyb.h.', '.bbyyyb.cc', '.bbyyyb.cc', '.bbyyyb.k.', '..........'],
  neighbour: ['..........', '.bbbbbbb..', '.bbyyybb..', '.bbyyybb..', '.bhyyyb.h.', '.ccyyyb.cc', '.ccyyyb.cc', '.kbyyyb.k.', '..........'],
  // The bridge's arch over the stream, and the milestone beside the cleared road.
  meadowFound: ['..........', 'bbbbbbbbbb', 'bbbbbbbbbb', 'bbbddddbbb', 'bbd....dbb', 'bb......bb', 'bbwwwwwwbb', 'wwwwwwwwww', '..........'],
  meadowRoad: ['.......bb.', '.......bd.', '.......bb.', '.......bd.', '.......bb.', '......kbbk', 'eeeeeeeeee', 'edeedeedee', '..........']
} as const;
const townIcon = (moment: keyof typeof TOWN_SCENES, season: keyof typeof CASTLE_SEASONS): JournalIcon => ({
  legend: { x: CASTLE_SEASONS[season][0], b: 'stone2', d: 'stone0', y: 'scarf3', h: 'fox1', c: 'wood2', k: 'wood1', w: 'storm', e: 'earth2' },
  rows: [CASTLE_SEASONS[season][1], ...TOWN_SCENES[moment]]
});
const townIcons = Object.fromEntries(
  (Object.keys(CASTLE_SEASONS) as (keyof typeof CASTLE_SEASONS)[]).flatMap(season => (Object.keys(TOWN_SCENES) as (keyof typeof TOWN_SCENES)[]).map(moment => [`${moment}${season}`, townIcon(moment, season)]))
) as Record<TownJournalId, JournalIcon>;

export const JOURNAL_ICONS: Record<JournalId, JournalIcon> = {
  ...castleMomentIcons,
  ...townIcons,
  keepViewAutumn: keepViewIcon('fox1', 'fox3', '.......t..'),
  keepViewWinter: keepViewIcon('frost', 'paper', '.t.....t..'),
  keepViewSpring: keepViewIcon('leaf2', 'flower1', '.t........'),
  keepViewSummer: keepViewIcon('leaf2', 'flower3', '.t......t.'),
  keepFinishedAutumn: keepFinishedIcon('fox3', '.......xx.'),
  keepFinishedWinter: keepFinishedIcon('frost', '.x.....x..'),
  keepFinishedSpring: keepFinishedIcon('flower1', '.x........'),
  keepFinishedSummer: keepFinishedIcon('flower3', 'x........x'),
  castleLineAutumn: castleLineIcon('fox1', 'fox3', '.......t..'),
  castleLineWinter: castleLineIcon('frost', 'paper', '.t.....t..'),
  castleLineSpring: castleLineIcon('leaf2', 'flower1', '.t........'),
  castleLineSummer: castleLineIcon('leaf2', 'flower3', '.t......t.'),
  hillsAutumn: hillIcon('fox1', 'fox3', ['.t.....t..', 'tt.t..tt.t', '.t..t..t..']),
  hillsWinter: hillIcon('frost', 'paper', ['...tt.....', '..tttt....', '.tttttt...']),
  hillsSpring: hillIcon('leaf2', 'flower1', ['..........', '..t...tt..', '.ttt.tttt.']),
  hillsSummer: hillIcon('leaf2', 'flower3', ['..........', '.t.t.t.t..', 'tttttttttt']),
  namedAutumn: namedIcon('fire2', ['.......xx.', '........x.']),
  namedWinter: namedIcon('frost', ['.......x.x', '........x.']),
  namedSpring: namedIcon('leaf3', ['........x.', '.......xx.']),
  namedSummer: namedIcon('scarf3', ['.......xx.', '.......xx.']),
  autumnKeepsake: keepsakeIcon('fire2', ['.......xx.', '........x.']),
  winterKeepsake: keepsakeIcon('frost', ['.......x.x', '........x.']),
  // An apple with a leaf.
  orchardApple: { legend: { r: 'fire2', g: 'leaf3', k: 'ink' }, rows: [
    '.....kg...',
    '.....kgg..',
    '..rrrkrr..',
    '.rrrrrrrr.',
    '.rrrrrrrr.',
    '.rrrrrrrr.',
    '.rrrrrrrr.',
    '..rrrrrr..',
    '...rr.rr..',
    '..........'
  ] },
  // A little sheep, seen from the side.
  shearing: { legend: { w: 'paper', x: 'canvas3', k: 'ink', l: 'stone1' }, rows: [
    '..........',
    '...wwww...',
    '.wwwwwwww.',
    'wwwwwwwwkk',
    'wwwwwwwwkk',
    'xwwwwwwwk.',
    '.xxxxxxx..',
    '.l.l.l.l..',
    '.l.l.l.l..',
    '..........'
  ] },
  springKeepsake: keepsakeIcon('leaf3', ['........x.', '.......xx.']),
  summerKeepsake: keepsakeIcon('scarf3', ['.......xx.', '.......xx.']),
  // A sheaf of grain, tied round its middle.
  grainIn: { legend: { g: 'scarf2', G: 'scarf3', W: 'scarf4', t: 'wood1' }, rows: [
    '..........',
    '..W.W.W...',
    '.WGWGWGW..',
    '..GgGgG...',
    '...ggg....',
    '...ttt....',
    '...ggg....',
    '..g.g.g...',
    '.g..g..g..',
    '..........'
  ] },
  // A round loaf on a board, steam rising.
  winterBread: { legend: { k: 'wood1', c: 'earth2', C: 'earth3', W: 'earth4', b: 'wood3', s: 'frost' }, rows: [
    '...s..s...',
    '..s..s....',
    '..........',
    '...kkkk...',
    '..kCWWCk..',
    '.kCWCCWCk.',
    '.kcCCCCck.',
    'bbbbbbbbbb',
    '.b......b.',
    '..........'
  ] },
  // A sheaf of grain with an autumn leaf falling past it.
  autumnGrain: { legend: { g: 'scarf2', G: 'scarf3', t: 'wood1', o: 'fire1', O: 'fire2' }, rows: [
    '......oO..',
    '.......o..',
    '.G.G.G....',
    '..GgG.....',
    '...g......',
    '..ttt.....',
    '...g......',
    '..g.g.....',
    '.g..g.g...',
    '..........'
  ] },
  // A loaf on a board under a summer sun.
  summerBread: { legend: { k: 'wood1', c: 'earth2', C: 'earth3', W: 'earth4', b: 'wood3', y: 'fire3', Y: 'fire4' }, rows: [
    '.......y.y',
    '........Y.',
    '.......y.y',
    '..kkkk....',
    '.kCWWCk...',
    'kCWCCWCk..',
    'kcCCCCck..',
    'bbbbbbbbbb',
    '.b......b.',
    '..........'
  ] },
  // A stone oven's arched mouth with a loaf inside, smoke curling from its chimney.
  ovenBread: { legend: { s: 'stone1', S: 'stone2', k: 'ink', c: 'earth2', C: 'earth3', m: 'frost' }, rows: [
    '.......m..',
    '......m...',
    '......SS..',
    '..SSSSSS..',
    '.SSSSSSSS.',
    '.SSkkkkSS.',
    '.SkcCCckS.',
    '.SkkkkkkS.',
    'ssssssssss',
    '..........'
  ] },
  leaves: { legend: { o: 'fire1', O: 'fire2', s: 'wood2' }, rows: [
    '..........',
    '.....oo...',
    '....oOOo..',
    '...oOOOo..',
    '..oOOOo...',
    '..oOOo....',
    '...oo.....',
    '..s.......',
    '.s........',
    '..........'
  ] },
  fox: { legend: { d: 'fox1', O: 'fox2', w: 'fox4', k: 'ink' }, rows: [
    '..........',
    '.d......d.',
    '.dO....Od.',
    '.dOOOOOOd.',
    '.OOkOOkOO.',
    '.wOOOOOOw.',
    '..wwOOww..',
    '...wwww...',
    '....kk....',
    '..........'
  ] },
  coldFront: { legend: { b: 'storm', F: 'frost' }, rows: [
    '....b.....',
    '.b..b..b..',
    '..b.b.b...',
    '...bbb....',
    'bbbbFbbbb.',
    '...bbb....',
    '..b.b.b...',
    '.b..b..b..',
    '....b.....',
    '..........'
  ] },
  driedBerries: { legend: { w: 'wood2', k: 'canvas2', b: 'berry1', B: 'berry3' }, rows: [
    '..........',
    '..........',
    'wwwwwwwwww',
    '..k..k..k.',
    '.bBb.k.bBb',
    '.bbb.k.bbb',
    '..b.bBb.b.',
    '....bbb...',
    '.....b....',
    '..........'
  ] },
  stars: { legend: { y: 'scarf2', Y: 'fire4' }, rows: [
    '..........',
    '...y......',
    '...y......',
    '.yyYyy....',
    '...y...y..',
    '...y..yYy.',
    '.......y..',
    '..y.......',
    '.yYy......',
    '..y.......'
  ] },
  firstSnow: { legend: { ...cloud('stone3', 'stone2'), f: 'flower4' }, rows: [
    '..........',
    '...ccc....',
    '.ccCCCcc..',
    'cCCCCCCCc.',
    '.cccccccc.',
    '..........',
    '.f..f..f..',
    '...f..f...',
    '.f..f..f..',
    '..........'
  ] },
  wolfTracks: { legend: { p: 'earth1' }, rows: [
    '..........',
    '...p..p...',
    '...p..p...',
    '.p......p.',
    '.p.pppp.p.',
    '..pppppp..',
    '..pppppp..',
    '...pppp...',
    '..........',
    '..........'
  ] },
  frozenSpring: { legend: { s: 'stone2', I: 'frost', i: 'flower4' }, rows: [
    '..........',
    '..........',
    '..ssssss..',
    '.sIIIIiIs.',
    'sIiIIIiIIs',
    'sIIiIiIIIs',
    '.sIIIIIIs.',
    '..ssssss..',
    '..........',
    '..........'
  ] },
  winterFire: { legend: { ...flame, d: 'wood1', w: 'wood2' }, rows: [
    '....r.....',
    '....rr....',
    '...ror....',
    '..roOor.r.',
    '..roOOorr.',
    '.roOWOOor.',
    '.roOWWOor.',
    '..ooOOoo..',
    '.ddwwwwdd.',
    '..dd..dd..'
  ] },
  winterCooking: { legend: { k: 'stone0', K: 'stone1', B: 'berry2', s: 'stone3' }, rows: [
    '..s...s...',
    '...s...s..',
    '..s...s...',
    '..........',
    'kkkkkkkkkk',
    '.kBBBBBBk.',
    '.kkkkkkkk.',
    '.kKKKKKKk.',
    '..kKKKKk..',
    '...kkkk...'
  ] },
  firstRain: { legend: { ...cloud('stone2', 'stone1'), r: 'storm' }, rows: [
    '..........',
    '...ccc....',
    '.ccCCCcc..',
    'cCCCCCCCc.',
    '.cccccccc.',
    '..r...r...',
    '.r..r...r.',
    '...r...r..',
    '.r...r....',
    '..........'
  ] },
  rabbits: { legend: { e: 'bird2', W: 'flower2', k: 'ink' }, rows: [
    '...e.e....',
    '...e.e....',
    '...eeee...',
    '..ekeeee..',
    '..eeeeee..',
    '....eeeee.',
    '...eeeeeee',
    '...eeeeeeW',
    '...ee..ee.',
    '..........'
  ] },
  bushesFull: { legend: { l: 'leaf2', L: 'leaf3', b: 'berry2' }, rows: [
    '..........',
    '...ll.....',
    '..lLLll...',
    '.lLbLLLl..',
    '.lLLLLbLl.',
    'lLbLLLLLl.',
    'lLLLLbLLLl',
    '.lLLLLLLl.',
    '..llllll..',
    '..........'
  ] },
  stumpGrowing: { legend: { g: 'leaf3', G: 'leaf4', w: 'wood1', W: 'wood3', d: 'wood2' }, rows: [
    '..........',
    '.....gg...',
    '...gg.g...',
    '....gGg...',
    '.....g....',
    '..wwwwww..',
    '.wWWWWWWw.',
    '.wddddddw.',
    '.wddddddw.',
    'wwwwwwwwww'
  ] },
  springRest: { legend: { b: 'storm', B: 'flower4', W: 'frost' }, rows: [
    '....b.....',
    '....b.....',
    '...bBb....',
    '...bBb....',
    '..bBBBb...',
    '..bBWBb...',
    '.bBBWBBb..',
    '.bBBBBBb..',
    '..bBBBb...',
    '...bbb....'
  ] },
  fireflies: { legend: { g: 'grass3', Y: 'scarf3' }, rows: [
    '..........',
    '.g........',
    'gYg....g..',
    '.g....gYg.',
    '.......g..',
    '...g......',
    '..gYg.....',
    '...g...g..',
    '......gYg.',
    '.......g..'
  ] },
  twoHandfuls: { legend: { h: 'skin2', b: 'berry1', B: 'berry3' }, rows: [
    '..........',
    '..........',
    '..b.B.b...',
    '.bBbBbBb..',
    'bBbBbBbBb.',
    'hbbbbbbbh.',
    'hhhbbbhhh.',
    '.hhhhhhh..',
    '..hhhhh...',
    '..........'
  ] },
  goldEvening: { legend: { y: 'fire2', Y: 'golden', W: 'fire4', g: 'grass1', G: 'grass0' }, rows: [
    '..........',
    '..........',
    '...yyyy...',
    '..yYYYYy..',
    '.yYYWWYYy.',
    '.yYYYYYYy.',
    'gggggggggg',
    'GGGGGGGGGG',
    '..........',
    '..........'
  ] },
  warmSleep: { legend: { m: 'scarf2' }, rows: [
    '..........',
    '...mmmm...',
    '..mmm.....',
    '.mmm....m.',
    '.mmm......',
    '.mmm......',
    '.mmmm.....',
    '..mmmmmm..',
    '...mmmm...',
    '..........'
  ] },
  fireside: { legend: { ...flame, d: 'wood1', w: 'wood2', s: 'stone1' }, rows: [
    '......ss..',
    '...dd.ss..',
    '..dwwdss..',
    '.dwwwwdd..',
    'dwwwwwwwd.',
    '.wwwwwwww.',
    '.wwroOwww.',
    '.wwoWOwww.',
    '.wwwwwwww.',
    '.dddddddd.'
  ] },
  lookoutEvening: { legend: { w: 'wood2', W: 'wood3', d: 'wood1' }, rows: [
    '....ww....',
    '..wwWWww..',
    '.wWWWWWWw.',
    '..d....d..',
    '..dwwwwd..',
    '..d.d..d..',
    '..d..d.d..',
    '..d...dd..',
    '.dd....dd.',
    '..........'
  ] },
  hazelnuts: { legend: { n: 'wood3', N: 'wood1', l: 'fire1', L: 'fire2' }, rows: [
    '..........',
    '...N......',
    '..nnn.....',
    '.nnnnn.l..',
    '.nnNnn.Ll.',
    '..nnn.lLl.',
    '..........',
    '.l.nn..L..',
    '..nnnn.l..',
    '...nn.....'
  ] },
  pineTea: { legend: { g: 'leaf3', G: 'leaf2', k: 'stone0', t: 'wood3', s: 'stone3' }, rows: [
    '..s...s...',
    '...s......',
    '..G.G.G...',
    '.kkkkkkk..',
    '.ktttttkk.',
    '.kttttttk.',
    '.kgGgGgk.k',
    '..kttttk.k',
    '...kkkkkk.',
    '..........'
  ] },
  salad: { legend: { g: 'leaf4', G: 'leaf3', b: 'berry3', B: 'berry2', w: 'wood3' }, rows: [
    '..........',
    '..........',
    '..gG.gG...',
    '.gGbGgGBg.',
    '.GgGGbGgG.',
    'wwwwwwwwww',
    '.wwwwwwww.',
    '..wwwwww..',
    '...wwww...',
    '..........'
  ] },
  wildHoney: { legend: { h: 'wood4', H: 'fire3', o: 'fire2', w: 'wood2', d: 'wood1' }, rows: [
    '...dddd...',
    '..dwwwwd..',
    '..dwddwd..',
    '..dwddwd..',
    '..dwwwwd..',
    '...hHh....',
    '...HoH....',
    '...hoh....',
    '....H.....',
    '....h.....'
  ] }
};

/** The icon as a small SVG, one square per pixel, ready for a CSS background. */
export function journalIconUrl(id: JournalId): string {
  return iconUrl(JOURNAL_ICONS[id]);
}

/** Paints a 10×10 icon as a crisp SVG data URL in the game palette. */
export function iconUrl({ legend, rows }: JournalIcon): string {
  const pixels = rows.flatMap((row, y) => [...row].flatMap((pixel, x) =>
    pixel === '.' ? [] : [`<rect x="${x}" y="${y}" width="1" height="1" fill="${palette[legend[pixel]]}"/>`]));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${JOURNAL_ICON_SIZE} ${JOURNAL_ICON_SIZE}" shape-rendering="crispEdges">${pixels.join('')}</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
