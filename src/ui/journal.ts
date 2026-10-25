import { pathOpen } from '../game/areas';
import { LOOKOUT, SITES, type GameState, type SiteId } from '../game/state';

/** The quarry is in another area, so the camp map marks the end of the west path instead. */
export const QUARRY_MARKER = { x: 1, y: 15 };

interface JournalLocation {
  id: SiteId | 'lookout' | 'quarry';
  label: string;
  visited: boolean;
  x: number;
  y: number;
}

interface JournalMilestone { label: string; done: boolean }

export function journalView(state: GameState): {
  locations: JournalLocation[];
  milestones: JournalMilestone[];
  nextHint: string;
} {
  const directions: Record<SiteId, string> = {
    basket: 'northwest', spring: 'southwest', cairn: 'southeast'
  };
  const locations: JournalLocation[] = (Object.keys(SITES) as SiteId[]).map(id => ({
    id,
    label: state.progress.discoveries[id] ? SITES[id].name : `Unexplored ${directions[id]} path`,
    visited: state.progress.discoveries[id],
    x: SITES[id].x,
    y: SITES[id].y
  }));
  locations.push({ id: 'lookout', label: state.progress.lookoutRepaired ? 'Restored lookout' : 'Old lookout',
    visited: state.progress.lookoutRepaired, x: LOOKOUT.x, y: LOOKOUT.y });
  if (pathOpen(state)) {
    locations.push({ id: 'quarry', label: state.progress.quarryFound ? 'Old quarry' : 'Unexplored west path',
      visited: state.progress.quarryFound, ...QUARRY_MARKER });
  }
  const milestones = [
    { label: 'Build a shelter', done: state.structures.shelter },
    { label: 'Weather the cold front', done: state.progress.hearthUnlocked },
    { label: 'Find the old quarry', done: state.progress.quarryFound },
    { label: 'Restore the lookout', done: state.progress.lookoutRepaired }
  ];
  const sitesFound = Object.values(state.progress.discoveries).every(Boolean);
  let nextHint = 'Build a shelter at camp before the cold front arrives.';
  if (state.structures.shelter) nextHint = `Keep the fire burning through the cold front on day ${state.progress.nextStormDay}.`;
  if (state.progress.hearthUnlocked) nextHint = state.structures.toolshed
    ? 'Follow the northeast path and restore the old lookout.'
    : 'Build a toolshed at camp to make tools.';
  if (state.progress.lookoutRepaired && state.structures.toolshed) {
    if (sitesFound && state.progress.quarryFound) nextHint = 'You have followed all five paths. Your camp is home, and the woods are yours to wander.';
    else if (sitesFound) nextHint = 'Follow the west path out of camp to see what lies beyond.';
    else nextHint = 'Follow an unexplored path to find another quiet place.';
  }
  return { locations, milestones, nextHint };
}
