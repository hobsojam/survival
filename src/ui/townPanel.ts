import type { GameAction } from '../game/rules';
import type { VisitorView } from './panels';

interface TownElement { hidden: boolean; textContent: string | null; dataset: DOMStringMap }
/** As much of the page as the visitor panel needs, so it can be laid out without a browser. */
export interface TownRoot { querySelector(selector: string): TownElement | null }

/** The visitor panel laid out from its view: shown while the traveller is asking, with the ask and its two answers. EASTER EGG: the town, see src/game/town.ts. */
export function renderVisitorPanel(root: TownRoot, view: VisitorView): void {
  const panel = root.querySelector('.visitor-panel');
  if (panel) panel.hidden = !view.shown;
  const copy = root.querySelector('#visitor-copy');
  if (copy) copy.textContent = view.copy;
  const yes = root.querySelector('#visitor-yes');
  if (yes) yes.textContent = view.yes;
  const no = root.querySelector('#visitor-no');
  if (no) no.textContent = view.no;
}

/** What one of the visitor panel's buttons answers. */
export const visitorAction = (dataset: DOMStringMap): GameAction => ({ type: 'answerTraveller', yes: dataset.answer === 'yes' });
