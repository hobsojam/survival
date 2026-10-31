import { isWinter } from './calendar';
import { SITES, type GameState, type SiteId } from './state';

export function sitePrompt(state: GameState, siteId: SiteId): string {
  if (siteId === 'spring' && isWinter(state.day) && state.progress.fishingLine) return 'V  Fish through the ice';
  if (!state.progress.discoveries[siteId]) return 'V  Explore nearby place';
  return `V  Explore ${SITES[siteId].name.toLowerCase()}`;
}
