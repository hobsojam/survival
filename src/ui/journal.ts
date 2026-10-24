import { LOOKOUT, SITES, type GameState, type SiteId } from '../game/state';

interface JournalLocation {
  id: SiteId | 'lookout';
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
  const milestones = [
    { label: 'Build a shelter', done: state.structures.shelter },
    { label: 'Weather the cold front', done: state.progress.hearthUnlocked },
    { label: 'Restore the lookout', done: state.progress.lookoutRepaired }
  ];
  let nextHint = 'Build a shelter at camp before the cold front arrives.';
  if (state.structures.shelter) nextHint = `Keep the fire burning through the cold front on day ${state.progress.nextStormDay}.`;
  if (state.progress.hearthUnlocked) nextHint = 'Follow the northeast path and restore the old lookout.';
  if (state.progress.lookoutRepaired) nextHint = 'Follow an unexplored path to find another quiet place.';
  if (state.progress.lookoutRepaired && Object.values(state.progress.discoveries).every(Boolean)) {
    nextHint = 'You have followed all four paths. Your camp is home, and the woods are yours to wander.';
  }
  return { locations, milestones, nextHint };
}
