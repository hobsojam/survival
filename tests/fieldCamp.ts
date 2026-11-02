import { BALANCE, createGame, type GameState } from '../src/game/state';
import { placeBranches } from '../src/game/clearing';
import type { FieldState, FieldStrip } from '../src/game/field';

const { campX, campY } = BALANCE;
const SOUTH: GameState['clearing']['cleared'] = ['south-near', 'south-far'];

/** A camp past its cold night with the south ground cleared, standing at the fire; the field, granary and workshop as asked. */
export function fieldCamp(structures: Partial<GameState['structures']> = {}, changes: Partial<GameState> = {}): GameState {
  const base = createGame();
  const placed = placeBranches(base.nodes, SOUTH);
  return {
    ...base,
    day: 22,
    nodes: base.nodes.map((node, i) => ({ ...node, x: placed[i].x, y: placed[i].y })),
    clearing: { cleared: SOUTH, marked: null, felled: [] },
    progress: { ...base.progress, nextStormDay: null, hearthUnlocked: true },
    structures: { ...base.structures, field: true, ...structures },
    player: { ...base.player, x: campX, y: campY },
    ...changes
  };
}

export const strip = (changes: Partial<FieldStrip> = {}): FieldStrip => ({ sownDay: null, cut: false, ...changes });
export const withField = (state: GameState, field: Partial<FieldState>): GameState => ({ ...state, field: { ...state.field, ...field } });

