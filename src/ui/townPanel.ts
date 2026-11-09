import type { GameAction } from '../game/rules';
import { JOB_IDS, type JobId } from '../game/town';
import type { VisitorView } from './panels';

interface TownElement { hidden: boolean; textContent: string | null; dataset: DOMStringMap }
/** As much of the page as the visitor panel needs, so it can be laid out without a browser. */
export interface TownRoot { querySelector(selector: string): TownElement | null }

/** The visitor panel laid out from its view: shown while the traveller is asking, with the ask, a button for each free job, and a no. EASTER EGG: the town, see src/game/town.ts. */
export function renderVisitorPanel(root: TownRoot, view: VisitorView): void {
  const panel = root.querySelector('.visitor-panel');
  if (panel) panel.hidden = !view.shown;
  const copy = root.querySelector('#visitor-copy');
  if (copy) copy.textContent = view.copy;
  for (const { job, label, shown } of view.jobs) {
    const button = root.querySelector(`#visitor-job-${job}`);
    if (!button) continue;
    button.hidden = !shown;
    button.textContent = label;
    button.dataset.job = job;
  }
  const no = root.querySelector('#visitor-no');
  if (no) no.textContent = view.no;
}

/** What one of the visitor panel's buttons answers: a job button is a yes with that job, anything else a no. */
export const visitorAction = (dataset: DOMStringMap): GameAction => (JOB_IDS.includes(dataset.job as JobId)
  ? { type: 'answerTraveller', yes: true, job: dataset.job as JobId }
  : { type: 'answerTraveller', yes: false });
