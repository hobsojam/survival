import type { BuildListView, CampStoresView } from './panels';

/** The little of a page element these helpers touch. */
export interface Shown { hidden: boolean | string; textContent: string | null }
/** Finds an element on the page by selector, or null. */
export type Find = (selector: string) => Shown | null;

/** Shows the Camp stores panel once any store exists, with a line for each store that does. */
export function showCampStores(find: Find, view: CampStoresView): void {
  const panel = find('#stores-panel');
  if (panel) panel.hidden = !view.shown;
  for (const line of view.lines) {
    const element = find(`#store-line-${line.id}`);
    if (!element) continue;
    element.hidden = !line.shown;
    element.textContent = line.text;
  }
}

/** Writes the build list's hint, and shows its shelter upgrades heading only while an upgrade is offered. */
export function showBuildList(find: Find, view: BuildListView): void {
  const hint = find('#build-hint');
  if (hint) hint.textContent = view.hint;
  const heading = find('#shelter-upgrades-heading');
  if (heading) heading.hidden = !view.shelterHeading;
}
