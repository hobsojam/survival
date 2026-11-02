import { isWinter } from './calendar';
import { SITES, type GameState, type SiteId } from './state';

/** What visiting a place along the paths would do now, in words for the prompt. */
export function sitePrompt(state: GameState, siteId: SiteId): string {
  if (siteId === 'spring' && isWinter(state.day) && state.progress.fishingLine) return 'Fish through the ice';
  if (!state.progress.discoveries[siteId]) return 'Explore nearby place';
  return `Explore ${SITES[siteId].name.toLowerCase()}`;
}
