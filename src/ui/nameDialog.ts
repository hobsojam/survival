import { nameBlocker, type NameTarget } from '../game/names';
import type { GameAction } from '../game/rules';
import type { Friend, GameState } from '../game/state';

const FRIEND_WORDS: Record<Friend, string> = { bird: 'The little bird', fox: 'The fox', wolf: 'The young wolf' };

/** What the naming box says about the animal it's asking about. */
export function namePromptCopy(target: NameTarget): { title: string } {
  if (target.kind === 'friend') return { title: `${FRIEND_WORDS[target.animal]} has stayed. What will you call it?` };
  return { title: `What will you call this ${target.kind === 'sheep' ? 'sheep' : 'hen'}?` };
}

interface NameDialogParts {
  overlay: { hidden: HTMLElement['hidden'] };
  form: { contains(node: never): boolean };
  input: { value: string; focus(): void };
  title: { textContent: string | null };
  error: { textContent: string | null };
}

interface NameDialogDeps {
  state(): GameState;
  /** Stops or restarts the scene. */
  holdGame(hold: boolean): void;
  /** Tells the scene to stop or start listening to the keyboard. */
  setTyping(typing: boolean): void;
  perform(action: GameAction): void;
}

interface KeyEvent { key: string; target: unknown; stopPropagation(): void; preventDefault(): void }

/** The box that asks for a name. It holds the game still while it's open, and the pause control stands aside until it closes. */
export class NameDialog {
  private target: NameTarget | null = null;

  constructor(private readonly parts: NameDialogParts, private readonly deps: NameDialogDeps) {}

  get open(): boolean {
    return this.target !== null;
  }

  ask(target: NameTarget): void {
    if (this.open) return;
    this.target = target;
    this.parts.title.textContent = namePromptCopy(target).title;
    this.parts.error.textContent = '';
    this.parts.input.value = '';
    this.parts.overlay.hidden = false;
    this.deps.setTyping(true);
    this.deps.holdGame(true);
    this.focusBox();
  }

  close(): void {
    if (!this.open) return;
    this.target = null;
    this.parts.overlay.hidden = true;
    this.deps.holdGame(false);
    this.deps.setTyping(false);
  }

  confirm(): void {
    const target = this.target;
    if (!target) return;
    const name = this.parts.input.value;
    const blocker = nameBlocker(this.deps.state(), target, name);
    if (blocker) {
      this.parts.error.textContent = blocker;
      return;
    }
    this.close();
    this.deps.perform({ type: 'nameAnimal', target, name });
  }

  focusBox(): void {
    this.parts.input.focus();
  }

  /** While the box is open every key is for the box, wherever the focus has wandered, and Esc closes it. */
  handleKey(event: KeyEvent): void {
    if (!this.open) return;
    event.stopPropagation();
    if (event.key === 'Escape') {
      event.preventDefault();
      this.close();
    } else if (!this.parts.form.contains(event.target as never)) this.focusBox();
  }

  /** A key let go goes no further while the box is open. */
  handleKeyUp(event: Pick<KeyEvent, 'stopPropagation'>): void {
    if (this.open) event.stopPropagation();
  }
}

interface Clickable { addEventListener(type: 'click', listener: () => void): void }

/** Connects the box to the page. Keys are caught on the way down, before the game or the pause key can hear them. */
export function wireNameDialog(
  page: { overlay: Clickable; form: { addEventListener(type: 'submit', listener: (event: { preventDefault(): void }) => void): void }; cancel: Clickable },
  doc: { addEventListener(type: 'keydown' | 'keyup', listener: (event: KeyEvent) => void, capture: boolean): void },
  dialog: NameDialog
): void {
  doc.addEventListener('keydown', event => dialog.handleKey(event), true);
  doc.addEventListener('keyup', event => dialog.handleKeyUp(event), true);
  page.form.addEventListener('submit', event => {
    event.preventDefault();
    dialog.confirm();
  });
  page.cancel.addEventListener('click', () => dialog.close());
  // A click on the card or the backdrop would otherwise leave nowhere to type.
  page.overlay.addEventListener('click', () => dialog.focusBox());
}
