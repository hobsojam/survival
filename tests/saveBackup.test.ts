import { describe, expect, it } from 'vitest';
import { SAVE_VERSION, readSaveText, saveText } from '../src/game/save';
import { createGame, type GameState } from '../src/game/state';
import { SaveLoader, clearSaveNote, copySave, loadConfirmCopy, saveFileName, wireSaveBackup } from '../src/ui/saveBackup';
import { finishedCastleCamp } from './townStreet';

const NOT_A_SAVE = 'This isn\'t a Hearthwild save.';

describe('a save as text', () => {
  it('comes back as the same game, however it was pasted', () => {
    for (const state of [createGame(), finishedCastleCamp()]) {
      expect(readSaveText(saveText(state))).toEqual({ ok: true, state });
      expect(readSaveText(`\n  ${saveText(state)}  \n`)).toEqual({ ok: true, state });
    }
  });

  it('is named for the camp\'s day', () => {
    expect(saveFileName({ ...createGame(), day: 330 })).toBe('hearthwild-day-330.json');
  });

  it('brings an older save up to date', () => {
    const old = JSON.parse(saveText(finishedCastleCamp()));
    old.version = SAVE_VERSION - 1;
    delete old.state.town.square;
    old.state.town.houses = old.state.town.houses.slice(0, 8);
    const read = readSaveText(JSON.stringify(old));
    expect(read.ok && read.state.town.houses.length).toBe(12);
  });

  it.each([
    ['plain words', 'hello there', NOT_A_SAVE],
    ['nothing', '   ', NOT_A_SAVE],
    ['some other JSON', '{"name":"Ada"}', NOT_A_SAVE],
    ['a list', '[1,2,3]', NOT_A_SAVE],
    ['a newer game\'s save', JSON.stringify({ version: SAVE_VERSION + 1, state: {} }), 'This save is from a newer version of the game.'],
    ['a damaged save', JSON.stringify({ version: SAVE_VERSION, state: { ...createGame(), day: -4 } }), 'This save is damaged, so it can\'t be loaded.'],
    ['an ended story', JSON.stringify({ version: SAVE_VERSION, state: { ...createGame(), ending: { day: 1 } } }), 'This save\'s story has ended, so there is no camp in it to load.']
  ])('refuses %s, and says why', (_, text, reason) => {
    expect(readSaveText(text)).toEqual({ ok: false, reason });
  });
});

describe('asking before a load', () => {
  it('names both camps by their day, and asks nothing with no camp to replace', () => {
    expect(loadConfirmCopy({ ...createGame(), day: 412 }, { ...createGame(), day: 330 })).toBe('This replaces your camp on day 412 with one on day 330.');
    expect(loadConfirmCopy(null, createGame())).toBeNull();
  });
});

describe('copying a save code', () => {
  it('says so once it is copied', async () => {
    const copied: string[] = [];
    expect(await copySave({ writeText: async text => { copied.push(text); } }, 'CODE')).toBe(true);
    expect(copied).toEqual(['CODE']);
  });

  it('owns up when the browser won\'t copy', async () => {
    expect(await copySave({ writeText: async () => { throw new Error('denied'); } }, 'CODE')).toBe(false);
    expect(await copySave(undefined, 'CODE')).toBe(false);
  });
});

describe('the load box', () => {
  const setup = (current: GameState | null = { ...createGame(), day: 412 }) => {
    const held: boolean[] = [];
    const typing: boolean[] = [];
    const loaded: GameState[] = [];
    const parts = {
      overlay: { hidden: true },
      code: { value: '' },
      error: { textContent: '' as string | null },
      ask: { hidden: true },
      askCopy: { textContent: '' as string | null },
      choose: { hidden: false }
    };
    const box = new SaveLoader(parts, { current: () => current, holdGame: hold => held.push(hold), setTyping: on => typing.push(on), load: state => loaded.push(state) });
    return { box, parts, held, typing, loaded };
  };
  /** A camp on day 60 with the castle finished. */
  const other = finishedCastleCamp();

  it('opens empty, holding the game still, and closes again', () => {
    const { box, parts, held, typing } = setup();
    parts.code.value = 'old';
    box.open();
    expect(box.isOpen).toBe(true);
    expect(parts).toMatchObject({ overlay: { hidden: false }, code: { value: '' }, error: { textContent: '' }, ask: { hidden: true }, choose: { hidden: false } });
    box.close();
    expect(parts.overlay.hidden).toBe(true);
    expect(held).toEqual([true, false]);
    expect(typing).toEqual([true, false]);
  });

  it('says why a save is refused, and loads nothing', () => {
    const { box, parts, loaded } = setup();
    box.open();
    box.offer('hello');
    expect(parts.error.textContent).toBe(NOT_A_SAVE);
    expect(box.isOpen).toBe(true);
    expect(loaded).toEqual([]);
  });

  it('asks before replacing a camp, and loads only on a yes', () => {
    const { box, parts, loaded } = setup();
    box.open();
    box.offer('hello');
    box.offer(saveText(other));
    expect(parts).toMatchObject({ ask: { hidden: false }, choose: { hidden: true }, error: { textContent: '' }, askCopy: { textContent: 'This replaces your camp on day 412 with one on day 60.' } });
    expect(loaded).toEqual([]);
    box.keep();
    expect(parts).toMatchObject({ ask: { hidden: true }, choose: { hidden: false } });
    expect(loaded).toEqual([]);
    box.offer(saveText(other));
    box.confirm();
    expect(loaded).toEqual([other]);
    expect(box.isOpen).toBe(false);
  });

  it('loads at once with no camp to replace, and confirms nothing it wasn\'t offered', () => {
    const { box, loaded } = setup(null);
    box.open();
    box.confirm();
    expect(loaded).toEqual([]);
    box.offer(saveText(other));
    expect(loaded).toEqual([other]);
  });

  it('loads the code pasted in the box', () => {
    const { box, parts, loaded } = setup(null);
    box.open();
    parts.code.value = saveText(other);
    box.offerCode();
    expect(loaded).toEqual([other]);
  });

  it('keeps every key to itself while open, and closes on Esc', () => {
    const { box } = setup();
    const key = (name: string) => {
      const seen = { stopped: false, prevented: false };
      box.handleKey({ key: name, stopPropagation: () => { seen.stopped = true; }, preventDefault: () => { seen.prevented = true; } });
      return seen;
    };
    expect(key('w')).toEqual({ stopped: false, prevented: false });
    box.open();
    expect(key('w')).toEqual({ stopped: true, prevented: false });
    expect(box.isOpen).toBe(true);
    expect(key('Escape')).toEqual({ stopped: true, prevented: true });
    expect(box.isOpen).toBe(false);
  });
});

describe('the save panel on the page', () => {
  type Key = { key: string; stopPropagation(): void; preventDefault(): void };
  type Listener = (event: Key) => unknown;
  const NO_KEY: Key = { key: '', stopPropagation: () => {}, preventDefault: () => {} };
  const element = () => {
    const listeners: Record<string, Listener[]> = {};
    return {
      listeners, hidden: true, value: '', textContent: '' as string | null, clicks: 0, focused: 0, selected: 0,
      files: null as { text(): Promise<string> }[] | null,
      addEventListener(type: string, listener: Listener) { (listeners[type] ??= []).push(listener); },
      fire(type: string, event: Partial<Key> = {}) { return Promise.all((listeners[type] ?? []).map(listener => listener({ ...NO_KEY, ...event }))); },
      click() { this.clicks++; }, focus() { this.focused++; }, select() { this.selected++; }
    };
  };
  const setup = (clipboard?: { writeText(text: string): Promise<void> }) => {
    const page = {
      saveFile: element(), copy: element(), open: [element(), element()], chooseFile: element(), fileInput: element(),
      loadCode: element(), cancel: element(), yes: element(), keep: element(), note: element(), codeOut: element(), code: element()
    };
    const doc = element();
    const state = finishedCastleCamp();
    const loaded: GameState[] = [];
    const downloads: [string, string][] = [];
    const parts = { overlay: { hidden: true }, code: page.code, error: { textContent: '' as string | null }, ask: { hidden: true }, askCopy: { textContent: '' as string | null }, choose: { hidden: false } };
    const loader = new SaveLoader(parts, { current: () => null, holdGame: () => {}, setTyping: () => {}, load: each => loaded.push(each) });
    wireSaveBackup(page, doc, loader, { state: () => state, download: (text, name) => downloads.push([text, name]), clipboard });
    return { page, doc, loader, loaded, downloads, state, parts };
  };

  it('downloads the camp as a file named for its day, and says where it went', async () => {
    const { page, downloads, state } = setup();
    await page.saveFile.fire('click');
    expect(downloads).toEqual([[saveText(state), 'hearthwild-day-60.json']]);
    expect(page.note.textContent).toBe('Saved hearthwild-day-60.json to your downloads.');
  });

  it('copies the code, or shows it selected when the browser won\'t', async () => {
    const copied: string[] = [];
    const ok = setup({ writeText: async text => { copied.push(text); } });
    await ok.page.copy.fire('click');
    expect(copied).toEqual([saveText(ok.state)]);
    expect(ok.page.note.textContent).toBe('Copied. Paste it into "Load a save…" on your other device.');
    expect(ok.page.codeOut.hidden).toBe(true);
    const refused = setup();
    await refused.page.copy.fire('click');
    expect(refused.page.codeOut).toMatchObject({ hidden: false, value: saveText(refused.state), selected: 1 });
    expect(refused.page.note.textContent).toBe('Copy this code, then paste it into "Load a save…" on your other device.');
  });

  it('opens the load box from either button and loads a chosen file', async () => {
    const { page, loader, loaded, state } = setup();
    await page.open[1].fire('click');
    expect(loader.isOpen).toBe(true);
    expect(page.code.focused).toBe(1);
    await page.chooseFile.fire('click');
    expect(page.fileInput.clicks).toBe(1);
    page.fileInput.value = 'C:\\fakepath\\hearthwild-day-60.json';
    page.fileInput.files = [{ text: async () => saveText(state) }];
    await page.fileInput.fire('change');
    expect(loaded).toEqual([state]);
    expect(page.fileInput.value).toBe('');
  });

  it('wires the code, cancel, yes and keep buttons, and the keys', async () => {
    const { page, doc, loader, parts } = setup();
    await page.open[0].fire('click');
    page.code.value = 'hello';
    await page.loadCode.fire('click');
    expect(parts.error.textContent).toBe(NOT_A_SAVE);
    await page.keep.fire('click');
    await page.yes.fire('click');
    expect(loader.isOpen).toBe(true);
    let stopped = 0;
    await doc.fire('keyup', { stopPropagation: () => { stopped++; } });
    await doc.fire('keydown', { key: 'a', stopPropagation: () => { stopped++; }, preventDefault: () => {} });
    expect(stopped).toBe(2);
    await page.cancel.fire('click');
    expect(loader.isOpen).toBe(false);
    await doc.fire('keyup', { stopPropagation: () => { stopped++; } });
    expect(stopped).toBe(2);
  });

  it('clears the panel\'s note and shown code once a camp is loaded', () => {
    const { page } = setup();
    page.note.textContent = 'Copied.';
    page.codeOut.hidden = false;
    clearSaveNote(page);
    expect(page.note.textContent).toBe('');
    expect(page.codeOut.hidden).toBe(true);
  });
});
