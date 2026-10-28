import { afterEach, describe, expect, it, vi } from 'vitest';
import { createGame } from '../src/game/state';
import { worldX } from '../src/scene/art';
import { BIRD_HOMES, EYE_SPOTS, RABBIT_HOMES, WOLF_SPOTS, rabbitCount, wolfCount } from '../src/scene/ambient';
import { nightStart } from '../src/game/calendar';
import { AmbientLife } from '../src/scene/ambientLife';

function sceneWithImages() {
  const images: Array<{ kind: string; texture: string; x: number; visible: boolean; alpha: number }> = [];
  const scene = {
    add: {
      image: (_x: number, _y: number, key: string) => {
        const image = {
          // What the image was made as (bird, fox, eyes...), so tests don't depend on creation order.
          kind: key.split(':')[0], texture: key, x: 0, visible: false, alpha: 1,
          setOrigin() { return this; },
          setDepth() { return this; },
          setVisible(value: boolean) { this.visible = value; return this; },
          setTexture(value: string) { this.texture = value; return this; },
          setPosition(x: number) { this.x = x; return this; },
          setFlipX() { return this; },
          setAlpha(value: number) { this.alpha = value; return this; }
        };
        images.push(image);
        return image;
      }
    }
  };
  const of = (kind: string) => images.filter(image => image.kind === kind);
  return { scene, images, of };
}

describe('ambient bird foraging', () => {
  afterEach(() => vi.restoreAllMocks());

  it('flies to a berry bush and pecks without taking the player’s berries', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.49);
    const { scene, of } = sceneWithImages();
    const life = new AmbientLife(scene as never);
    const bird = of('bird')[0];
    const state = createGame();
    const berriesBefore = state.nodes.filter(node => node.kind === 'berry').map(node => node.amount);
    life.update(state, 0, 0);
    life.update(state, 1.6, 1600);
    life.update(state, 0.1, 1700);
    expect(bird.visible).toBe(true);
    expect(bird.texture).toMatch(/^bird:peck/);
    expect(bird.x).not.toBe(Math.round(worldX(BIRD_HOMES[0].x)));
    life.update(state, 0.1, 5200);
    life.update(state, 1.6, 6800);
    life.update(state, 0.1, 6900);
    expect(bird.x).toBe(Math.round(worldX(BIRD_HOMES[0].x)));
    expect(state.nodes.filter(node => node.kind === 'berry').map(node => node.amount)).toEqual(berriesBefore);
  });

  it('flees from a bush when the survivor approaches', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.49);
    const { scene, of } = sceneWithImages();
    const life = new AmbientLife(scene as never);
    const bird = of('bird')[0];
    const state = createGame();
    life.update(state, 0, 0);
    life.update(state, 1.6, 1600);
    life.update(state, 0.1, 1700);
    state.player.x = 16;
    state.player.y = 18;
    life.update(state, 0.1, 1800);
    expect(bird.visible).toBe(false);
    life.update(state, 0.1, 1900);
    expect(bird.texture).toMatch(/^bird:fly/);
  });
});

describe('ambient life by area', () => {
  it('hides the birds, the fox and the fireflies in the quarry area', () => {
    const { scene, images, of } = sceneWithImages();
    const life = new AmbientLife(scene as never);
    const state = createGame();
    // A summer night, when the fireflies are out.
    state.day = 32;
    state.timeOfDay = 220;
    life.update(state, 0.1, 0);
    expect(images.some(image => image.visible)).toBe(true);
    life.update({ ...state, area: 'quarry' }, 0.1, 100);
    expect(images.filter(image => image.kind !== 'eyes' && image.visible)).toEqual([]);
    life.update({ ...state, area: 'quarry', day: 2, timeOfDay: 60 }, 0.1, 1000);
    expect(of('leaf').filter(image => image.visible)).toEqual([]);
  });
});

describe('seasonal life at camp', () => {
  const glowing = (day: number) => {
    const { scene, of } = sceneWithImages();
    const life = new AmbientLife(scene as never);
    const state = { ...createGame(), day, timeOfDay: 230 };
    let seen = 0;
    for (let t = 0; t < 4000; t += 250) { life.update(state, 0.25, t); seen += of('firefly').filter(image => image.visible).length; }
    return seen;
  };

  it('brings out the fireflies on summer nights only', () => {
    expect(glowing(31)).toBeGreaterThan(0);
    expect(glowing(1)).toBe(0);
    expect(glowing(21)).toBe(0);
  });

  it('lets leaves fall on autumn days only', () => {
    const falling = (day: number) => {
      const { scene, of } = sceneWithImages();
      const life = new AmbientLife(scene as never);
      const state = { ...createGame(), day, timeOfDay: 60 };
      let seen = 0;
      for (let t = 0; t < 9000; t += 500) { life.update(state, 0.5, t); seen += of('leaf').filter(image => image.visible).length; }
      return seen;
    };
    expect(falling(1)).toBeGreaterThan(0);
    expect(falling(11)).toBe(0);
  });
});

describe('ambient quarry eyes', () => {
  it('shows no eyes at camp on an autumn day or night', () => {
    const { scene, of } = sceneWithImages();
    const life = new AmbientLife(scene as never);
    const eyes = of('eyes');
    // The quarry's eyes, the wolves', and the one trusting pair.
    expect(eyes).toHaveLength(EYE_SPOTS.length + WOLF_SPOTS.length + 1);
    const state = createGame();
    state.timeOfDay = 200;
    for (let t = 0; t < 12000; t += 500) life.update(state, 0.5, t);
    expect(eyes.every(image => !image.visible)).toBe(true);
  });

  it('shows some eyes at the quarry at night, none by day', () => {
    const { scene, of } = sceneWithImages();
    const life = new AmbientLife(scene as never);
    const eyes = of('eyes');
    const state = createGame();
    state.area = 'quarry';
    state.player.x = 38; state.player.y = 2;
    state.timeOfDay = 10;
    life.update(state, 0.5, 3000);
    expect(eyes.every(image => !image.visible)).toBe(true);
    state.timeOfDay = 200;
    life.update(state, 0.5, 3000);
    expect(eyes.some(image => image.visible)).toBe(true);
  });
});

describe('winter at camp', () => {
  const base = createGame();
  const winterNight = { ...base, day: 12, timeOfDay: nightStart(12) + 40, fireFuel: 0,
    player: { ...base.player, x: 20, y: 15 }, progress: { ...base.progress, hearthUnlocked: true, nextStormDay: null } };

  /** Runs a few one-second updates so the wolves' presence settles, ending at a moment every spot is watching. */
  function settle(life: AmbientLife, state: typeof winterNight) {
    for (let i = 0; i < 3; i++) life.update(state, 1, 12000 * (i + 1) + 1000);
  }

  it('shows the day\'s wolves at the camp edge while the fire is out, and none in autumn', () => {
    const { scene, of } = sceneWithImages();
    const life = new AmbientLife(scene as never);
    settle(life, winterNight);
    expect(of('eyes').filter(image => image.visible)).toHaveLength(wolfCount(12));
    const autumn = sceneWithImages();
    const autumnLife = new AmbientLife(autumn.scene as never);
    settle(autumnLife, { ...winterNight, day: 8, timeOfDay: nightStart(8) + 40 });
    expect(autumn.of('eyes').filter(image => image.visible)).toHaveLength(0);
  });

  it('lets the wolf eyes fade, not vanish, when the fire is fed', () => {
    const { scene, of } = sceneWithImages();
    const life = new AmbientLife(scene as never);
    settle(life, winterNight);
    life.update({ ...winterNight, fireFuel: 100 }, 0.5, 37200);
    const shown = of('eyes').filter(image => image.visible);
    expect(shown.length).toBeGreaterThan(0);
    expect(shown.every(image => image.alpha > 0.3 && image.alpha < 0.7)).toBe(true);
    life.update({ ...winterNight, fireFuel: 100 }, 1, 37400);
    expect(of('eyes').filter(image => image.visible)).toHaveLength(0);
  });

  it('sends the birds away for the winter', () => {
    const { scene, of } = sceneWithImages();
    const life = new AmbientLife(scene as never);
    const day = { ...base, day: 12, timeOfDay: 30, player: { ...base.player, x: 2, y: 2 } };
    life.update(day, 0.1, 100);
    life.update(day, 0.1, 200);
    expect(of('bird').some(image => image.visible)).toBe(false);
    const autumn = sceneWithImages();
    const autumnLife = new AmbientLife(autumn.scene as never);
    autumnLife.update({ ...day, day: 8 }, 0.1, 100);
    autumnLife.update({ ...day, day: 8 }, 0.1, 200);
    expect(autumn.of('bird').some(image => image.visible)).toBe(true);
  });
});

describe('spring rabbits at camp', () => {
  const base = createGame();
  const springDay = { ...base, day: 21, timeOfDay: 60, player: { ...base.player, x: 20, y: 15 } };
  const visible = (images: { visible: boolean }[]) => images.filter(image => image.visible).length;

  it('shows the day\'s rabbits on a spring day, and none in summer or at night', () => {
    const { scene, of } = sceneWithImages();
    const life = new AmbientLife(scene as never);
    life.update(springDay, 0.1, 100);
    expect(visible(of('rabbit'))).toBe(rabbitCount(21));
    life.update({ ...springDay, day: 31 }, 0.1, 200);
    expect(visible(of('rabbit'))).toBe(0);
    life.update({ ...springDay, timeOfDay: nightStart(21) + 40 }, 0.1, 300);
    expect(visible(of('rabbit'))).toBe(0);
  });

  it('runs off when the survivor comes close, and comes back once they leave', () => {
    const { scene, of } = sceneWithImages();
    const life = new AmbientLife(scene as never);
    const home = RABBIT_HOMES[0];
    const near = { ...springDay, player: { ...springDay.player, x: home.x, y: home.y } };
    const rabbit = of('rabbit')[0];
    life.update(near, 0.1, 100);
    for (let t = 200; t <= 1200; t += 100) life.update(near, 0.1, t);
    expect(rabbit.visible).toBe(false);
    for (let t = 1300; t <= 10500; t += 100) life.update(springDay, 0.1, t);
    expect(rabbit.visible).toBe(true);
  });
});

describe('the camp friend', () => {
  const base = createGame();
  const befriended = (friend: 'bird' | 'fox' | 'wolf', changes: Partial<ReturnType<typeof createGame>['companion']> = {}) => ({
    ...base, day: 1, timeOfDay: 60, player: { ...base.player, x: 22, y: 16 },
    companion: { ...base.companion, friend, since: 1, ...changes }
  });

  it('is the fox itself, so the wild fox no longer comes by at dusk', () => {
    const { scene, of } = sceneWithImages();
    const life = new AmbientLife(scene as never);
    const [wild, friend] = of('fox');
    const state = befriended('fox');
    for (let time = nightStart(1) - 20; time <= nightStart(1) + 50; time += 5) {
      life.update({ ...state, timeOfDay: time }, 0.1, time * 1000);
      expect(wild.visible).toBe(false);
    }
    expect(friend.visible).toBe(true);
  });

  it('shows the friend at camp, and a shed piece by the fire', () => {
    const { scene, of } = sceneWithImages();
    const life = new AmbientLife(scene as never);
    life.update(befriended('wolf', { keepsakeLying: true }), 0.1, 100);
    expect(of('wolf')[0].visible).toBe(true);
    expect(of('keepsake')[0]).toMatchObject({ visible: true, texture: 'keepsake:fur' });
    life.update(befriended('bird'), 0.1, 200);
    expect(of('keepsake')[0].visible).toBe(false);
    expect(of('wolf')[0].visible).toBe(false);
  });

  it('lets a trusting wolf watch from the edge of the firelight even with the fire lit', () => {
    const { scene, of } = sceneWithImages();
    const life = new AmbientLife(scene as never);
    const night = { ...befriended('wolf'), companion: { ...base.companion, trust: { bird: 0, fox: 0, wolf: 1 } },
      day: 12, timeOfDay: nightStart(12) + 40, fireFuel: 100, player: { ...base.player, x: 20, y: 15 } };
    const seen = Array.from({ length: 40 }, (_, i) => { life.update(night, 0.25, i * 250); return of('eyes').some(image => image.visible); });
    expect(seen).toContain(true);
    const untrusted = sceneWithImages();
    const wary = new AmbientLife(untrusted.scene as never);
    const unseen = Array.from({ length: 40 }, (_, i) => { wary.update({ ...night, companion: base.companion }, 0.25, i * 250); return untrusted.of('eyes').some(image => image.visible); });
    expect(unseen).not.toContain(true);
  });
});

describe('the friend in motion', () => {
  const base = createGame();

  it('cues the wolf chorus once a cycle on winter nights, and never in autumn', () => {
    const { scene } = sceneWithImages();
    const cues: string[] = [];
    const life = new AmbientLife(scene as never, cue => cues.push(cue));
    const night = { ...base, day: 12, timeOfDay: nightStart(12) + 20, fireFuel: 100,
      companion: { ...base.companion, friend: 'wolf' as const, since: 1 } };
    for (let t = 23000; t <= 49000; t += 250) life.update(night, 0.25, t);
    expect(cues).toEqual(['wolfChorus', 'wolfChorus']);
    const autumn: string[] = [];
    const quiet = new AmbientLife(sceneWithImages().scene as never, cue => autumn.push(cue));
    for (let t = 23000; t <= 49000; t += 250) quiet.update({ ...night, day: 5, timeOfDay: nightStart(5) + 20 }, 0.25, t);
    expect(autumn).toEqual([]);
  });

  it('flies the bird between perches rather than jumping', () => {
    const { scene, of } = sceneWithImages();
    const life = new AmbientLife(scene as never);
    const day = { ...base, day: 5, timeOfDay: 60, structures: { ...base.structures, shelter: true, dryingRack: true },
      player: { ...base.player, x: 21, y: 14 }, companion: { ...base.companion, friend: 'bird' as const, since: 1 } };
    const bird = of('bird').at(-1)!;
    life.update(day, 0.1, 100);
    life.update(day, 0.1, 200);
    expect(bird.texture).toBe('bird:idle');
    life.update({ ...day, player: { ...day.player, x: 18 } }, 0.1, 300);
    expect(bird.texture).toMatch(/^bird:fly/);
    for (let t = 400; t <= 1500; t += 100) life.update({ ...day, player: { ...day.player, x: 18 } }, 0.1, t);
    expect(bird.texture).toBe('bird:idle');
  });
});
