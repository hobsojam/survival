import { SITES, type GameState, type SiteId } from './state';

export function sitePrompt(state: GameState, siteId: SiteId): string {
  if (!state.progress.discoveries[siteId]) return 'V  Explore nearby place';
  return `V  Explore ${SITES[siteId].name.toLowerCase()}`;
}
