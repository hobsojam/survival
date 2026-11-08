import type { GameAction } from '../game/rules';
import type { HomeChoiceView } from './panels';

interface HomeElement { hidden: boolean; textContent: string | null; dataset: DOMStringMap }
/** As much of the page as the Home panel needs, so it can be laid out without a browser. */
export interface HomeRoot { querySelector(selector: string): HomeElement | null }

/** The Home panel laid out from its view: shown once the hall is offered, with its copy and the one button that changes home. EASTER EGG: the castle, see src/game/castle.ts. */
export function renderHomePanel(root: HomeRoot, view: HomeChoiceView): void {
  const panel = root.querySelector('.home-panel');
  if (panel) panel.hidden = !view.shown;
  const copy = root.querySelector('#home-copy');
  if (copy) copy.textContent = view.copy;
  const button = root.querySelector('#home-button');
  if (button) {
    button.textContent = view.button;
    button.dataset.homeChoice = view.choose;
  }
}

/** What the Home panel's button asks for, read from the home it was last laid out to offer. */
export const homeChoiceAction = (dataset: DOMStringMap): GameAction => ({ type: 'chooseHome', home: dataset.homeChoice === 'house' ? 'house' : 'hall' });
