import { BALANCE, createGame, type GameState } from '../src/game/state';
import { placeBranches } from '../src/game/clearing';

const { campX, campY } = BALANCE;
const GROUND: GameState['clearing']['cleared'] = ['north-near', 'north-far', 'north-outer', 'south-near', 'south-far', 'south-outer'];

export interface BakehouseOptions {
  millFlour?: number;
  shelf?: number[];
  lastBaked?: number | null;
  grain?: number;
  day?: number;
  windmill?: boolean;
  bakery?: boolean;
}

/** A camp past its cold night with the north and south nooks cleared, standing at the fire, with the field, granary, windmill and bakery. */
export function bakehouseCamp(options: BakehouseOptions = {}): GameState {
  const base = createGame();
  const placed = placeBranches(base.nodes, GROUND);
  const windmill = options.windmill ?? true;
  const bakery = windmill && (options.bakery ?? true);
  return {
    ...base,
    day: options.day ?? 22,
    nodes: base.nodes.map((node, i) => ({ ...node, x: placed[i].x, y: placed[i].y })),
    clearing: { cleared: GROUND, marked: null, felled: [] },
    progress: { ...base.progress, nextStormDay: null, hearthUnlocked: true },
    structures: { ...base.structures, field: true, granary: true, windmill, bakery },
    field: { ...base.field, grain: options.grain ?? 0 },
    millFlour: options.millFlour ?? 0,
    bakery: { shelf: options.shelf ?? [], lastBaked: options.lastBaked ?? null },
    player: { ...base.player, x: campX, y: campY }
  };
}
