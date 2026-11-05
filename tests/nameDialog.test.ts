import { describe, expect, it } from 'vitest';
import type { GameAction } from '../src/game/rules';
import { createGame, type GameState } from '../src/game/state';
import { NameDialog, namePromptCopy, wireNameDialog } from '../src/ui/nameDialog';

const game = createGame();
const sheepHere: GameState = { ...game, structures: { ...game.structures, sheepPen: true }, sheep: { ...game.sheep, arrived: true } };

describe('asking for a name', () => {
  it.each([
    [{ kind: 'friend', animal: 'fox' }, 'The fox has stayed. What will you call it?'],
    [{ kind: 'friend', animal: 'wolf' }, 'The young wolf has stayed. What will you call it?'],
    [{ kind: 'friend', animal: 'bird' }, 'The little bird has stayed. What will you call it?'],
    [{ kind: 'sheep', index: 1 }, 'What will you call this sheep?'],
    [{ kind: 'chicken', index: 0 }, 'What will you call this hen?']
  ] as const)('words it for %j', (target, title) => {
    expect(namePromptCopy(target).title).toBe(title);
  });
});

describe('the naming box', () => {
  const IN_THE_BOX = 'in the box';
  const setup = (state: GameState = sheepHere) => {
    const held: boolean[] = [];
    const typing: boolean[] = [];
    const performed: GameAction[] = [];
    const focused = { count: 0 };
    const parts = {
      overlay: { hidden: true },
      form: { contains: (node: unknown) => node === IN_THE_BOX },
      input: { value: '', focus: () => { focused.count++; } },
      title: { textContent: '' as string | null },
      error: { textContent: '' as string | null }
    };
    const dialog = new NameDialog(parts, {
      state: () => state,
      holdGame: hold => held.push(hold),
      setTyping: on => typing.push(on),
      perform: action => performed.push(action)
    });
    return { parts, dialog, held, typing, performed, focused };
  };
  const key = (name: string, target: unknown = null) => {
    const seen = { stopped: 0, prevented: 0 };
    return { seen, event: { key: name, target, stopPropagation: () => { seen.stopped++; }, preventDefault: () => { seen.prevented++; } } };
  };
  const sheep = { kind: 'sheep', index: 0 } as const;

  it('opens empty over a held game, ready to type', () => {
    const { parts, dialog, held, typing, focused } = setup();
    parts.input.value = 'old';
    parts.error.textContent = 'old';
    dialog.ask(sheep);
    expect(dialog.open).toBe(true);
    expect(parts.overlay.hidden).toBe(false);
    expect(parts.title.textContent).toBe('What will you call this sheep?');
    expect(parts.input.value).toBe('');
    expect(parts.error.textContent).toBe('');
    expect(held).toEqual([true]);
    expect(typing).toEqual([true]);
    expect(focused.count).toBe(1);
  });

  it('asks about only one animal at a time', () => {
    const { parts, dialog, held } = setup();
    dialog.ask(sheep);
    dialog.ask({ kind: 'chicken', index: 0 });
    expect(parts.title.textContent).toBe('What will you call this sheep?');
    expect(held).toEqual([true]);
  });

  it('gives the game back when closed', () => {
    const { parts, dialog, held, typing } = setup();
    dialog.ask(sheep);
    dialog.close();
    expect(dialog.open).toBe(false);
    expect(parts.overlay.hidden).toBe(true);
    expect(held).toEqual([true, false]);
    expect(typing).toEqual([true, false]);
  });

  it('does nothing when closed twice', () => {
    const { dialog, held } = setup();
    dialog.close();
    expect(held).toEqual([]);
  });

  it('names the animal, once the game is running again', () => {
    const { parts, dialog, held, performed } = setup();
    dialog.ask(sheep);
    parts.input.value = 'Maud';
    dialog.confirm();
    expect(parts.overlay.hidden).toBe(true);
    expect(held).toEqual([true, false]);
    expect(performed).toEqual([{ type: 'nameAnimal', target: sheep, name: 'Maud' }]);
  });

  it('stays open and says why when the name will not do', () => {
    const { parts, dialog, performed } = setup();
    dialog.ask(sheep);
    parts.input.value = '   ';
    dialog.confirm();
    expect(parts.overlay.hidden).toBe(false);
    expect(parts.error.textContent).toBe('Give it a name of one to twelve letters.');
    expect(performed).toEqual([]);
  });

  it('names nothing when there is no box open', () => {
    const { dialog, performed } = setup();
    dialog.confirm();
    expect(performed).toEqual([]);
  });

  it('closes on Esc wherever the focus has gone, and the key goes no further', () => {
    const { dialog } = setup();
    dialog.ask(sheep);
    const { seen, event } = key('Escape');
    dialog.handleKey(event);
    expect(dialog.open).toBe(false);
    expect(seen).toEqual({ stopped: 1, prevented: 1 });
  });

  it('keeps every other key from the game, and leaves it free to reach the box', () => {
    const { dialog } = setup();
    dialog.ask(sheep);
    const { seen, event } = key('d');
    dialog.handleKey(event);
    expect(dialog.open).toBe(true);
    expect(seen).toEqual({ stopped: 1, prevented: 0 });
  });

  it('brings a stray key back to the box', () => {
    const { dialog, focused } = setup();
    dialog.ask(sheep);
    focused.count = 0;
    dialog.handleKey(key('d').event);
    expect(focused.count).toBe(1);
  });

  it('leaves a key pressed inside the box where it is, so Not now can still be reached', () => {
    const { dialog, focused } = setup();
    dialog.ask(sheep);
    focused.count = 0;
    dialog.handleKey(key('Enter', IN_THE_BOX).event);
    expect(focused.count).toBe(0);
  });

  it('leaves keys alone while it is closed', () => {
    const { dialog } = setup();
    const { seen, event } = key('Escape');
    dialog.handleKey(event);
    expect(seen).toEqual({ stopped: 0, prevented: 0 });
  });

  it('is wired so keys reach it before anything else on the page, and a click anywhere returns to the box', () => {
    const { parts, dialog, focused } = setup();
    const listeners: { type: string; capture: boolean | undefined; run: (event: never) => void }[] = [];
    const clicks: Record<string, () => void> = {};
    const submits: ((event: { preventDefault(): void }) => void)[] = [];
    wireNameDialog({
      overlay: { addEventListener: (_type, run) => { clicks.overlay = run; } },
      form: { addEventListener: (_type, run) => { submits.push(run); } },
      cancel: { addEventListener: (_type, run) => { clicks.cancel = run; } }
    }, { addEventListener: (type: string, run: (event: never) => void, capture?: boolean) => { listeners.push({ type, capture, run }); } }, dialog);
    expect(listeners.map(listener => [listener.type, listener.capture])).toEqual([['keydown', true], ['keyup', true]]);

    dialog.ask(sheep);
    focused.count = 0;
    clicks.overlay();
    expect(focused.count).toBe(1);

    const up = key('d');
    listeners[1].run(up.event as never);
    expect(up.seen.stopped).toBe(1);

    parts.input.value = '  ';
    let prevented = 0;
    submits[0]({ preventDefault: () => { prevented++; } });
    expect(prevented).toBe(1);
    expect(parts.error.textContent).not.toBe('');

    clicks.cancel();
    expect(dialog.open).toBe(false);
  });
});
