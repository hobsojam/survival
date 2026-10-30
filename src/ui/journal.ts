import { pathOpen } from '../game/areas';
import { SITES, type AreaId, type GameState, type SiteId } from '../game/state';

interface JournalLocation {
  id: SiteId | 'lookout';
  label: string;
  visited: boolean;
}

interface JournalMilestone { label: string; done: boolean }

export interface RegionSummary {
  id: Exclude<AreaId, 'camp'>;
  direction: string;
  label: string;
  status: 'unknown' | 'scouted' | 'visited';
  resources: string[];
  features: string[];
  current: boolean;
}

const REGION_DEFINITIONS = [{
  id: 'quarry' as const,
  direction: 'West',
  label: 'Old quarry',
  resources: ['Stone'],
  features: ['Loose rubble', 'Quarry face'],
  routeOpen: pathOpen,
  visibleFromLookout: true,
  visited: (state: GameState) => state.progress.quarryFound
}];

function regionSummaries(state: GameState): RegionSummary[] {
  return REGION_DEFINITIONS.filter(region => region.routeOpen(state)).map(region => {
    const visited = region.visited(state) || state.area === region.id;
    const known = visited || (region.visibleFromLookout && state.progress.lookoutRepaired);
    let status: RegionSummary['status'] = 'unknown';
    if (visited) status = 'visited';
    else if (known) status = 'scouted';
    return {
      id: region.id,
      direction: region.direction,
      label: known ? region.label : 'Unexplored area',
      status,
      resources: known ? [...region.resources] : [],
      features: known ? [...region.features] : [],
      current: state.area === region.id
    };
  });
}

export function journalView(state: GameState): {
  locations: JournalLocation[];
  milestones: JournalMilestone[];
  nextHint: string;
  regions: RegionSummary[];
} {
  const directions: Record<SiteId, string> = {
    basket: 'northwest', spring: 'southwest', cairn: 'southeast'
  };
  const locations: JournalLocation[] = (Object.keys(SITES) as SiteId[]).map(id => ({
    id,
    label: state.progress.discoveries[id] ? SITES[id].name : `Unexplored ${directions[id]} path`,
    visited: state.progress.discoveries[id]
  }));
  locations.push({ id: 'lookout', label: state.progress.lookoutRepaired ? 'Restored lookout' : 'Old lookout',
    visited: state.progress.lookoutRepaired });
  // Once the lookout stands, the year journal takes over and the checklist steps aside.
  const milestones = state.progress.lookoutRepaired ? [] : [
    { label: 'Build a shelter', done: state.structures.shelter },
    { label: 'Weather the cold night', done: state.progress.hearthUnlocked },
    { label: 'Find the old quarry', done: state.progress.quarryFound },
    { label: 'Restore the lookout', done: state.progress.lookoutRepaired }
  ];
  const sitesFound = Object.values(state.progress.discoveries).every(Boolean);
  let nextHint = 'Build a shelter at camp before the cold night arrives.';
  if (state.structures.shelter) nextHint = `Keep the fire burning through the cold night on day ${state.progress.nextStormDay}.`;
  if (state.progress.hearthUnlocked) nextHint = state.structures.toolshed
    ? 'Follow the northeast path and restore the old lookout.'
    : 'Build a toolshed at camp to make tools.';
  if (state.progress.lookoutRepaired && state.structures.toolshed) {
    if (sitesFound && state.progress.quarryFound) nextHint = 'You have followed all five paths. Your camp is home, and the woods are yours to wander.';
    else if (sitesFound) nextHint = 'Follow the west path out of camp to see what lies beyond.';
    else nextHint = 'Follow an unexplored path to find another quiet place.';
  }
  return { locations, milestones, nextHint, regions: regionSummaries(state) };
}
