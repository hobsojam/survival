import { BALANCE, createGame, type GameState } from '../src/game/state';
import { placeBranches } from '../src/game/clearing';

const { campX, campY } = BALANCE;
const GROUND: GameState['clearing']['cleared'] = ['north-near', 'north-far'];

export interface BeehiveOptions {
  honey?: number;
  nextHoney?: number | null;
  built?: boolean;
  day?: number;
}

/** A camp past its cold night with the north near and far ground cleared, standing at the fire, with a beehive. */
export function beehiveCamp(options: BeehiveOptions = {}): GameState {
  const base = createGame();
  const placed = placeBranches(base.nodes, GROUND);
  const built = options.built ?? true;
  const day = options.day ?? 22;
  return {
    ...base,
    day,
    nodes: base.nodes.map((node, i) => ({ ...node, x: placed[i].x, y: placed[i].y })),
    clearing: { cleared: GROUND, marked: null, felled: [] },
    progress: { ...base.progress, nextStormDay: null, hearthUnlocked: true },
    structures: { ...base.structures, beehive: built },
    beehive: { honey: options.honey ?? 0, nextHoney: options.nextHoney !== undefined ? options.nextHoney : built ? 25 : null },
    player: { ...base.player, x: campX, y: campY }
  };
}
