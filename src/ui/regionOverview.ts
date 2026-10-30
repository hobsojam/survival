import type { AreaId } from '../game/state';
import type { RegionSummary } from './journal';

export function renderRegionOverview(root: HTMLElement, doc: Document, regions: RegionSummary[], currentArea: AreaId): void {
  const homeStatus = root.querySelector<HTMLElement>('#region-home-status');
  if (homeStatus) homeStatus.textContent = currentArea === 'camp' ? 'You are here' : 'Home';
  const destinations = root.querySelector<HTMLElement>('#region-destinations');
  if (!destinations) return;
  if (!regions.length) {
    const note = doc.createElement('p');
    note.className = 'region-empty';
    note.textContent = 'Build a shelter to open the west path.';
    destinations.replaceChildren(note);
    return;
  }
  destinations.replaceChildren(...regions.map(region => {
    const route = doc.createElement('div');
    route.className = 'region-route';
    const direction = doc.createElement('span');
    direction.className = 'region-direction';
    direction.textContent = `${region.direction} path`;
    const card = doc.createElement('div');
    card.className = 'region-card';
    card.classList.toggle('unknown', region.status === 'unknown');
    card.classList.toggle('current', region.current);
    const heading = doc.createElement('strong');
    heading.textContent = region.label;
    const status = doc.createElement('small');
    let statusText = 'Unexplored';
    if (region.status === 'scouted') statusText = 'Seen from lookout';
    if (region.status === 'visited') statusText = 'Visited';
    if (region.current) statusText = 'You are here';
    status.textContent = statusText;
    card.append(heading, status);
    if (region.resources.length) {
      const resources = doc.createElement('p');
      resources.textContent = `Resources: ${region.resources.join(', ')}`;
      const features = doc.createElement('p');
      features.textContent = `Places: ${region.features.join(', ')}`;
      card.append(resources, features);
    }
    route.append(direction, card);
    return route;
  }));
}
