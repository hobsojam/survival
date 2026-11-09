import { readSaveText, saveText } from '../game/save';
import type { GameState } from '../game/state';

// Backing a game up and bringing one back: a save file to download, the same save as a code to copy, and a box that
// loads either. The save is checked exactly as the browser's own is, and nothing is replaced without asking.

/** The download's name: the camp's day, so two backups tell themselves apart. */
export const saveFileName = (state: GameState): string => `hearthwild-day-${state.day}.json`;

/** What the box asks before a loaded save replaces the camp in play, or null with no camp to replace. */
export function loadConfirmCopy(current: GameState | null, incoming: GameState): string | null {
  return current ? `This replaces your camp on day ${current.day} with one on day ${incoming.day}.` : null;
}

/** Copies a save code, true once it is on the clipboard. False when the browser has no clipboard or won't allow it. */
export async function copySave(clipboard: { writeText(text: string): Promise<void> } | undefined, code: string): Promise<boolean> {
  if (!clipboard) return false;
  try {
    await clipboard.writeText(code);
    return true;
  } catch {
    return false;
  }
}

interface SaveLoaderParts {
  overlay: { hidden: HTMLElement['hidden'] };
  /** Where a save code is pasted. */
  code: { value: string };
  error: { textContent: string | null };
  /** The question asked before a camp is replaced, and its line. */
  ask: { hidden: HTMLElement['hidden'] };
  askCopy: { textContent: string | null };
  /** The file picker and the paste box, set aside while the question is asked. */
  choose: { hidden: HTMLElement['hidden'] };
}

interface SaveLoaderDeps {
  /** The camp a load would replace, or null when there is none. */
  current(): GameState | null;
  /** Stops or restarts the scene. */
  holdGame(hold: boolean): void;
  /** Tells the scene to stop or start listening to the keyboard. */
  setTyping(typing: boolean): void;
  load(state: GameState): void;
}

/** The box that loads a save from a file or a pasted code. It holds the game still while it's open, says why a save is
 * refused, and asks before replacing a camp. */
export class SaveLoader {
  private pending: GameState | null = null;
  private opened = false;

  constructor(private readonly parts: SaveLoaderParts, private readonly deps: SaveLoaderDeps) {}

  get isOpen(): boolean {
    return this.opened;
  }

  open(): void {
    if (this.opened) return;
    this.opened = true;
    this.parts.code.value = '';
    this.choosing();
    this.parts.overlay.hidden = false;
    this.deps.holdGame(true);
    this.deps.setTyping(true);
  }

  close(): void {
    if (!this.opened) return;
    this.opened = false;
    this.pending = null;
    this.parts.overlay.hidden = true;
    this.deps.holdGame(false);
    this.deps.setTyping(false);
  }

  /** A save's text from a file or the paste box: refused with its reason, loaded, or held while the box asks. */
  offer(text: string): void {
    const read = readSaveText(text);
    if (!read.ok) {
      this.choosing(read.reason);
      return;
    }
    const ask = loadConfirmCopy(this.deps.current(), read.state);
    if (ask === null) {
      this.finish(read.state);
      return;
    }
    this.pending = read.state;
    this.parts.error.textContent = '';
    this.parts.askCopy.textContent = ask;
    this.parts.ask.hidden = false;
    this.parts.choose.hidden = true;
  }

  offerCode(): void {
    this.offer(this.parts.code.value);
  }

  /** Yes to the question: the held save replaces the camp. */
  confirm(): void {
    if (this.pending) this.finish(this.pending);
  }

  /** No to the question: back to choosing, with the camp as it was. */
  keep(): void {
    this.choosing();
  }

  /** While the box is open every key is for the box, so typing a code moves no one, and Esc closes it. */
  handleKey(event: KeyEvent): void {
    if (!this.opened) return;
    event.stopPropagation();
    if (event.key !== 'Escape') return;
    event.preventDefault();
    this.close();
  }

  private choosing(error = ''): void {
    this.pending = null;
    this.parts.error.textContent = error;
    this.parts.ask.hidden = true;
    this.parts.choose.hidden = false;
  }

  private finish(state: GameState): void {
    this.close();
    this.deps.load(state);
  }
}

interface KeyEvent { key: string; stopPropagation(): void; preventDefault(): void }
interface Listens { addEventListener(type: string, listener: (event: KeyEvent) => unknown, capture?: boolean): void }
type Clickable = Listens;

/** As much of the page as the save panel and the load box need, so they can be wired without a browser. */
export interface SaveBackupPage {
  saveFile: Clickable;
  copy: Clickable;
  /** The "Load a save…" buttons: the Camp tab's and the start screen's. */
  open: Clickable[];
  chooseFile: Clickable;
  fileInput: Listens & { click(): void; value: string; files: ArrayLike<{ text(): Promise<string> }> | null };
  loadCode: Clickable;
  cancel: Clickable;
  yes: Clickable;
  keep: Clickable;
  note: { textContent: string | null };
  /** The code shown to copy by hand when the browser won't copy it. */
  codeOut: { value: string; hidden: HTMLElement['hidden']; select(): void };
  code: { focus(): void };
}

interface SaveBackupDeps {
  /** The camp as it is now. */
  state(): GameState;
  /** Hands the browser a file to download. */
  download(text: string, name: string): void;
  clipboard?: { writeText(text: string): Promise<void> };
}

/** Connects the save panel's buttons and the load box to the page. Keys are caught on the way down while the box is open. */
export function wireSaveBackup(page: SaveBackupPage, doc: Listens, loader: SaveLoader, deps: SaveBackupDeps): void {
  const on = (target: Listens, type: string, listener: () => unknown) => target.addEventListener(type, listener);
  doc.addEventListener('keydown', event => loader.handleKey(event), true);
  doc.addEventListener('keyup', event => { if (loader.isOpen) event.stopPropagation(); }, true);
  for (const button of page.open) on(button, 'click', () => { loader.open(); page.code.focus(); });
  on(page.chooseFile, 'click', () => page.fileInput.click());
  on(page.fileInput, 'change', async () => {
    const file = page.fileInput.files?.[0];
    page.fileInput.value = '';
    if (file) loader.offer(await file.text());
  });
  on(page.loadCode, 'click', () => loader.offerCode());
  on(page.cancel, 'click', () => loader.close());
  on(page.yes, 'click', () => loader.confirm());
  on(page.keep, 'click', () => loader.keep());
  on(page.saveFile, 'click', () => {
    const state = deps.state();
    const name = saveFileName(state);
    deps.download(saveText(state), name);
    page.note.textContent = `Saved ${name} to your downloads.`;
  });
  on(page.copy, 'click', async () => {
    const text = saveText(deps.state());
    if (await copySave(deps.clipboard, text)) {
      page.codeOut.hidden = true;
      page.note.textContent = 'Copied. Paste it into "Load a save…" on your other device.';
      return;
    }
    // The browser won't copy for us: the code is shown, selected, to copy by hand.
    page.codeOut.value = text;
    page.codeOut.hidden = false;
    page.codeOut.select();
    page.note.textContent = 'Copy this code, then paste it into "Load a save…" on your other device.';
  });
}

/** The save panel as it was before anything was saved or copied: for a camp just loaded. */
export function clearSaveNote(page: Pick<SaveBackupPage, 'note' | 'codeOut'>): void {
  page.note.textContent = '';
  page.codeOut.hidden = true;
}
