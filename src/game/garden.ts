import { isSummer, isWinter, season, yearOf } from './calendar';
import type { GardenPlot, GameState } from './state';

export const GARDEN_PLOT_COUNT = 3;

export type GardenPlotStage = 'empty' | 'seedling' | 'growing' | 'ripe' | 'dormant';

/** Art and copy state for one garden plot, derived from its saved cycle and the calendar. */
export function gardenPlotStage(state: GameState, plot: GardenPlot): GardenPlotStage {
  if (plot.plantedYear === null) return 'empty';
  if (plot.harvestReady) return 'ripe';
  if (plot.harvestedYear === yearOf(state.day)) {
    return isSummer(state.day) ? 'growing' : 'dormant';
  }
  if (season(state.day) === 'spring') return 'seedling';
  if (isSummer(state.day)) return 'growing';
  if (season(state.day) === 'autumn') return 'ripe';
  if (isWinter(state.day)) return 'dormant';
  return 'seedling';
}

export function gardenPlotLabel(stage: GardenPlotStage, harvestReady: boolean): string {
  if (harvestReady) return 'Berries ready to pick';
  switch (stage) {
    case 'empty': return 'Empty plot';
    case 'seedling': return 'Spring seedling';
    case 'growing': return 'Growing through summer';
    case 'ripe': return 'Berries ready to pick';
    case 'dormant': return 'Dormant until spring';
  }
}

/** At the first autumn dawn each planted bush bears one harvest until the player picks it. */
export function gardenDawn(state: GameState): GameState['gardenPlots'] {
  if (season(state.day) !== 'autumn') return state.gardenPlots;
  const year = yearOf(state.day);
  return state.gardenPlots.map(plot => {
    if (plot.plantedYear === null || plot.harvestReady || plot.harvestedYear === year) return plot;
    return { ...plot, harvestReady: true };
  });
}
