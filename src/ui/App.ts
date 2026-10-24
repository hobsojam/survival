import Phaser from 'phaser';
import { BALANCE, BUILDINGS, SITES, createGame, type GameState, type SiteId, type StructureId } from '../game/state';
import { GameScene } from '../scene/GameScene';
import { displayScale, viewportSize, canvasOffset, portraitViewport, LOGICAL_WIDTH, LOGICAL_HEIGHT } from '../scene/pixelScale';
import { autosaveDelayMs, loadGame, saveGame, type LoadResult } from '../game/save';
import { buildStatus, carriedCount, cookBlocker, isAtCamp, isColdNight, lookoutRepairBlocker, sleepBlocker, stargazeBlocker, trailFoodBlocker } from '../game/rules';
import { forecastFireCheck } from '../game/forecast';
import { dayPhase, formatClock, nextChange } from '../game/clock';
import { gateTap, nextOpenTab, type DockTab } from './dock';

const buildOptions = Object.keys(BUILDINGS) as StructureId[];

export class App {
  private state: GameState;
  private scene?: GameScene;
  private game?: Phaser.Game;
  private gameResize?: ResizeObserver;
  private readonly root: HTMLElement;
  private storage?: Storage;
  private previousSave: LoadResult = { kind: 'empty' };
  private lastSaveAt = 0;
  private saveFailures = 0;
  private openTab: DockTab | null = null;
  private toastTimer?: number;

  constructor(root: HTMLElement) {
    this.root = root;
    this.state = createGame();
    try {
      this.storage = window.localStorage;
      this.previousSave = loadGame(this.storage);
    } catch (error) {
      this.previousSave = { kind: 'invalid', reason: `Browser storage is unavailable: ${String(error)}` };
    }
    const buildMarkup = buildOptions.map(id => {
      const { name, description, symbol } = BUILDINGS[id];
      return `<button type="button" class="build-item" data-build="${id}"><span class="build-symbol">${symbol}</span><span class="build-copy"><strong>${name}</strong><small>${description}</small></span><span class="build-cost"><b class="build-verb">Build</b><small class="build-price"></small></span></button>`;
    }).join('');
    this.root.innerHTML = `
      <div class="shell">
        <header class="topbar">
          <div class="brand"><span class="brand-icon">✦</span><div><strong>Hearthwild</strong><small>A little place to begin again</small></div></div>
          <div class="top-actions"><span id="save-status" class="save-status">Local save</span><button id="restart-game" class="restart-button" hidden>New game</button><div class="day-pill" id="day-pill"><span id="day-label">Day 1 · Morning</span><span class="day-dial" aria-hidden="true"><span class="day-dial-night" style="left: ${BALANCE.nightStart / BALANCE.daySeconds * 100}%"></span><span id="day-dial-hand" class="day-dial-hand"></span></span><span id="day-countdown" class="day-countdown"></span></div></div>
        </header>
        <div class="layout">
          <main class="game-panel">
            <div class="game-frame"><div id="game-canvas"></div><div class="phone-meters" aria-hidden="true"><span class="track"><span id="mini-energy" class="fill energy"></span></span><span class="track"><span id="mini-hunger" class="fill hunger"></span></span><span class="track"><span id="mini-warmth" class="fill warmth"></span></span></div><div class="prompt" id="prompt">WASD / arrows  Move</div></div>
            <div class="message" id="message">Gather a few branches. Your camp is waiting.</div>
            <div class="shortcuts"><span><kbd>WASD</kbd> Move</span><span><kbd>E</kbd> Gather</span><span><kbd>V</kbd> Explore</span><span><kbd>F</kbd> Fire</span><span><kbd>R</kbd> Rest</span><span><kbd>Q</kbd> Berries</span><span><kbd>T</kbd> Ration</span><span><kbd>P</kbd> Prepare</span><span><kbd>C</kbd> Cook</span><span><kbd>G</kbd> Stargaze</span><span><kbd>Z</kbd> Sleep</span><span><kbd>L</kbd> Lookout</span><span><kbd>X</kbd> Chop</span></div>
          </main>
          <aside class="sidebar">
            <section class="panel forecast-panel" id="forecast-panel" data-tab="camp"><p class="eyebrow">THE FORECAST</p><h2 id="forecast-title">A cold front is coming</h2><p id="forecast-copy" class="forecast-copy"></p><div class="forecast-checks"><span id="forecast-shelter"></span><span id="forecast-fire"></span></div></section>
            <section class="panel lookout-panel" id="lookout-panel" data-tab="build"><p class="eyebrow">A PLACE BEYOND CAMP</p><h2 id="lookout-title">The old lookout</h2><p id="lookout-copy" class="lookout-copy"></p><button type="button" id="lookout-button" data-action="repairLookout">Repair lookout</button><small id="lookout-cost">4 wood · 2 fiber · 2 stone</small></section>
            <section class="panel axe-panel" data-tab="build"><p class="eyebrow">FOREST TOOLS</p><h2 id="axe-title">Stone axe</h2><p id="axe-copy" class="lookout-copy"></p><button type="button" id="axe-button" data-action="craftAxe">Craft stone axe</button><small id="axe-cost">1 wood · 1 fiber · 1 stone</small></section>
            <section class="panel ration-panel" data-tab="bag"><p class="eyebrow">TRAIL FOOD</p><h2>Drying rack</h2><p class="lookout-copy">Dry a berry at camp for a ration you can eat anywhere. Each restores 45 hunger.</p><button type="button" id="prepare-button" data-action="prepareTrailFood">Prepare trail ration</button><small id="prepare-hint">Build a drying rack first.</small></section>
            <section class="panel sites-panel" data-tab="camp"><p class="eyebrow">BEYOND CAMP</p><h2>Follow the paths</h2><p class="lookout-copy">An old basket, a quiet spring, and a stone cairn wait beyond the clearing.</p><p id="sites-seen" class="sites-seen">Places found: none yet</p><button type="button" id="site-button">Explore nearby place</button><small>Stand beside a place and press V</small></section>
            <section class="panel survivor-panel" data-tab="bag"><p class="eyebrow">YOUR SURVIVOR</p><h2>Take it one day at a time</h2>
              <div class="meter"><div class="meter-title"><span>Energy</span><b id="energy-value">100</b></div><div class="track"><div id="energy-bar" class="fill energy"></div></div></div>
              <div class="meter"><div class="meter-title"><span>Hunger</span><b id="hunger-value">100</b></div><div class="track"><div id="hunger-bar" class="fill hunger"></div></div></div>
              <div class="meter"><div class="meter-title"><span>Warmth</span><b id="warmth-value">100</b></div><div class="track"><div id="warmth-bar" class="fill warmth"></div></div></div>
              <div class="quick-actions"><button data-action="eat">Eat berries</button><button data-action="eatTrailFood" id="eat-ration-button">Eat ration</button><button data-action="rest">Rest</button><button data-action="stokeFire">Feed fire</button><button data-action="sleep" id="sleep-button">Sleep</button></div>
            </section>
            <section class="panel bag-panel" data-tab="bag"><p class="eyebrow">IN YOUR BAG</p><div class="supplies">
              <div><span class="supply-icon wood">▰</span><strong id="wood-count">0</strong><small>Wood</small><button type="button" class="drop-item" data-drop="wood" aria-label="Drop one wood">Drop 1</button></div>
              <div><span class="supply-icon food">●</span><strong id="food-count">0</strong><small>Food</small><button type="button" class="drop-item" data-drop="food" aria-label="Drop one berry">Drop 1</button></div>
              <div><span class="supply-icon fiber">≋</span><strong id="fiber-count">0</strong><small>Fiber</small><button type="button" class="drop-item" data-drop="fiber" aria-label="Drop one fiber">Drop 1</button></div>
              <div><span class="supply-icon stone">◆</span><strong id="stone-count">0</strong><small>Stone</small><button type="button" class="drop-item" data-drop="stone" aria-label="Drop one stone">Drop 1</button></div>
              <div><span class="supply-icon ration">◇</span><strong id="ration-count">0</strong><small>Rations</small><button type="button" class="drop-item" data-drop="trailFood" aria-label="Drop one trail ration">Drop 1</button></div>
              <div><span class="supply-icon space">◫</span><strong id="space-count">0/8</strong><small>Carried</small></div>
            </div><div class="fire-status" id="fire-status">The fire is unlit</div></section>
            <section class="panel night-panel" data-tab="camp"><p class="eyebrow">AFTER DARK</p><h2>A little time for yourself</h2><p class="night-hint" id="night-hint">These small moments are waiting for nightfall.</p><div class="night-actions"><button type="button" data-action="cook" id="cook-button"><span>♨</span><strong>Cook a berry</strong><small>1 berry · 8 seconds</small></button><button type="button" data-action="stargaze" id="stargaze-button"><span>✦</span><strong>Watch the stars</strong><small>12 seconds · a little rest</small></button></div></section>
            <section class="panel build-panel" data-tab="build"><p class="eyebrow">MAKE CAMP HOME</p><h2>Little improvements</h2><p id="build-hint" class="build-hint">Stand inside the marked camp circle to build.</p><div id="build-list">${buildMarkup}</div></section>
            <section class="panel phone-only" data-tab="camp"><p class="eyebrow">THIS CAMP</p><button type="button" id="phone-new-game" class="secondary-button">Start a new game</button></section>
          </aside>
        </div>
        <nav class="phone-dock" aria-label="Camp actions">
          <div class="dock-actions"><button type="button" data-action="eat">Eat</button><button type="button" data-action="rest">Rest</button><button type="button" data-action="stokeFire">Fire</button><button type="button" data-action="sleep" id="dock-sleep">Sleep</button><button type="button" data-action="cook" id="dock-cook" hidden>Cook</button><button type="button" data-action="stargaze" id="dock-stargaze" hidden>Stars</button></div>
          <div class="dock-tabs"><button type="button" data-tab-button="bag">🎒 Bag</button><button type="button" data-tab-button="build">🔨 Build</button><button type="button" data-tab-button="camp">🌙 Camp</button></div>
        </nav>
        <div id="start-screen" class="start-screen"><div class="start-card"><div class="start-mark">✦</div><p class="eyebrow">A SMALL SURVIVAL STORY</p><h1>Make a little place<br>feel like home.</h1><p class="start-copy">Gather what you need, keep a fire glowing, and build a refuge one day at a time.</p><p id="start-note" class="start-note"></p><div class="start-buttons"><button id="continue-game" class="primary-button" hidden>Continue your camp</button><button id="new-game" class="secondary-button">Start a new game</button></div><small>Single player · Saves in this browser</small></div></div>
        <div id="lookout-ending" class="lookout-ending hidden" role="dialog" aria-modal="true" aria-labelledby="ending-title"><div class="start-card"><div class="start-mark">✦</div><p class="eyebrow">A VIEW FROM ABOVE</p><h1 id="ending-title">A place to call home.</h1><p class="start-copy">The lookout stands again. Below, your fire marks a warm clearing among the trees. There is still more to see whenever you are ready.</p><div class="start-buttons"><button id="continue-exploring" class="primary-button">Keep exploring</button></div></div></div>
      </div>`;
    this.root.querySelectorAll<HTMLButtonElement>('[data-action]').forEach(button => {
      button.addEventListener('click', () => {
        const type = button.dataset.action as 'eat' | 'eatTrailFood' | 'prepareTrailFood' | 'rest' | 'stokeFire' | 'sleep' | 'cook' | 'stargaze' | 'repairLookout' | 'craftAxe';
        this.scene?.perform({ type });
      });
    });
    this.root.querySelector('.supplies')!.addEventListener('click', event => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-drop]');
      if (button) this.scene?.perform({ type: 'drop', resource: button.dataset.drop as keyof GameState['inventory'] });
    });
    this.root.querySelector('#build-list')!.addEventListener('click', event => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-build]');
      if (button) this.scene?.perform({ type: 'build', structureId: button.dataset.build as StructureId });
    });
    this.root.querySelector('#site-button')!.addEventListener('click', () => this.scene?.visitNearestSite());
    this.root.querySelector('#new-game')!.addEventListener('click', () => this.beginNewGame());
    this.root.querySelector('#continue-game')!.addEventListener('click', () => this.continueGame());
    this.root.querySelector('#restart-game')!.addEventListener('click', () => this.beginNewGame());
    this.root.querySelector('#phone-new-game')!.addEventListener('click', () => this.beginNewGame());
    this.root.querySelectorAll<HTMLButtonElement>('[data-tab-button]').forEach(button => {
      button.addEventListener('click', () => this.setOpenTab(nextOpenTab(this.openTab, button.dataset.tabButton as DockTab)));
    });
    this.root.querySelector('#continue-exploring')!.addEventListener('click', () => {
      this.root.querySelector('#lookout-ending')?.classList.add('hidden');
      this.game?.scene.resume('GameScene');
    });
    window.addEventListener('pagehide', () => { if (this.scene) this.saveCurrent(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.scene) this.saveCurrent(); });
    this.showStartScreen();
    this.render();
  }

  startGame(state: GameState): void {
    this.gameResize?.disconnect();
    this.game?.destroy(true);
    this.root.querySelector('#start-screen')?.classList.add('hidden');
    this.root.querySelector('#lookout-ending')?.classList.add('hidden');
    const restart = this.root.querySelector<HTMLButtonElement>('#restart-game');
    if (restart) restart.hidden = false;
    this.state = state;
    this.lastSaveAt = Date.now();
    this.saveFailures = 0;
    this.scene = new GameScene(state, (next, cause) => {
      const previous = this.state;
      this.state = next;
      this.render();
      if (cause === 'action' && !previous.progress.lookoutRepaired && next.progress.lookoutRepaired) {
        this.root.querySelector('#lookout-ending')?.classList.remove('hidden');
        this.game?.scene.pause('GameScene');
      }
      // Without storage there is nothing to retry; starting the game already said so once.
      if (!this.storage) return;
      // After a failed save, wait for the backoff instead of retrying on every action.
      const due = Date.now() - this.lastSaveAt >= autosaveDelayMs(this.saveFailures);
      if ((cause === 'action' && next !== previous && !this.saveFailures) || due) this.saveCurrent();
    }, message => this.setMessage(message));
    // A tap on the game while a phone sheet is open only closes the sheet.
    this.scene.setTapGate(() => {
      const dock = this.root.querySelector<HTMLElement>('.phone-dock');
      const { allowTap, closeTab } = gateTap(this.openTab, Boolean(dock && getComputedStyle(dock).display !== 'none'));
      if (closeTab) this.setOpenTab(null);
      return allowTap;
    });
    this.game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: 'game-canvas',
      width: LOGICAL_WIDTH,
      height: LOGICAL_HEIGHT,
      pixelArt: true,
      roundPixels: true,
      antialias: false,
      backgroundColor: '#456a59',
      scene: [this.scene],
      scale: { mode: Phaser.Scale.NONE, width: LOGICAL_WIDTH, height: LOGICAL_HEIGHT }
    });
    const frame = this.root.querySelector<HTMLElement>('.game-frame')!;
    const fitCanvas = () => {
      if (!this.game?.canvas) return;
      const portrait = portraitViewport(frame.clientWidth, frame.clientHeight);
      const scale = portrait?.scale ?? displayScale(frame.clientWidth, frame.clientHeight);
      let viewport = scale === 1 ? viewportSize(frame.clientWidth, frame.clientHeight) : { width: LOGICAL_WIDTH, height: LOGICAL_HEIGHT };
      if (portrait) viewport = { width: portrait.width, height: portrait.height };
      if (this.game.scale.gameSize.width !== viewport.width || this.game.scale.gameSize.height !== viewport.height) {
        this.game.scale.setGameSize(viewport.width, viewport.height);
        this.scene?.resizeViewport(viewport.width, viewport.height);
      }
      if (this.game.scale.zoom !== scale) this.game.scale.setZoom(scale);
      else this.game.scale.refresh();
      const offset = canvasOffset(frame.clientWidth, frame.clientHeight, viewport.width, viewport.height, scale);
      this.game.canvas.style.marginLeft = `${offset.x}px`;
      this.game.canvas.style.marginTop = `${offset.y}px`;
    };
    this.gameResize = new ResizeObserver(fitCanvas);
    this.gameResize.observe(frame);
    fitCanvas();
    this.render();
  }

  private showStartScreen(): void {
    const note = this.root.querySelector<HTMLElement>('#start-note');
    const continueButton = this.root.querySelector<HTMLButtonElement>('#continue-game');
    if (continueButton) continueButton.hidden = this.previousSave.kind !== 'loaded';
    if (note && !this.storage) note.textContent = 'Browser storage is unavailable, so this camp will not be saved.';
    else if (note) note.textContent = this.previousSave.kind === 'loaded'
      ? `Your camp is waiting on day ${this.previousSave.state.day}.`
      : this.previousSave.kind === 'invalid'
        ? `Your existing save could not be loaded: ${this.previousSave.reason}`
        : 'A fresh camp is ready whenever you are.';
  }

  private beginNewGame(): void {
    if (this.storage && this.previousSave.kind !== 'empty' && !window.confirm('Start a new game? Your existing local save will be replaced.')) return;
    this.startGame(createGame());
    this.setMessage('Gather a few branches. Your camp is waiting.');
    this.saveCurrent();
  }

  private continueGame(): void {
    if (this.previousSave.kind !== 'loaded') return;
    this.startGame(this.previousSave.state);
    this.setMessage('Welcome back to your camp.');
    this.setText('save-status', 'Loaded locally');
  }

  private saveCurrent(): void {
    this.state = this.scene?.getState() ?? this.state;
    if (!this.storage) {
      this.setText('save-status', 'Saving unavailable');
      this.setMessage('Browser storage is unavailable; progress will be lost when you close this page.');
      return;
    }
    const result = saveGame(this.storage, this.state);
    this.lastSaveAt = Date.now();
    const status = this.root.querySelector<HTMLElement>('#save-status');
    if (result.ok) {
      this.previousSave = { kind: 'loaded', state: this.state };
      this.saveFailures = 0;
      this.setText('save-status', 'Saved locally');
      status?.removeAttribute('title');
    } else {
      // Report the failure once; later retries only update the status, so gameplay messages stay visible.
      if (!this.saveFailures) this.setMessage(`Could not save locally: ${result.error}`);
      this.saveFailures++;
      this.setText('save-status', 'Save failed · retrying');
      status?.setAttribute('title', result.error);
    }
  }

  getState(): GameState { return this.state; }

  setMessage(message: string): void {
    const element = this.root.querySelector<HTMLElement>('#message');
    if (!element) return;
    element.textContent = message;
    // On phones the message is a toast over the game that fades after a moment.
    element.classList.add('toast');
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => element.classList.remove('toast'), 3000);
  }

  private setOpenTab(tab: DockTab | null): void {
    this.openTab = tab;
    const layout = this.root.querySelector<HTMLElement>('.layout')!;
    if (tab) layout.dataset.openTab = tab;
    else delete layout.dataset.openTab;
    this.root.querySelectorAll<HTMLButtonElement>('[data-tab-button]').forEach(button => {
      button.classList.toggle('active', button.dataset.tabButton === tab);
    });
    this.scene?.cancelWalk();
  }

  private render(): void {
    const { player, inventory, structures } = this.state;
    const { timeOfDay } = this.state;
    const phase = dayPhase(timeOfDay);
    const change = nextChange(timeOfDay);
    this.setText('day-label', `Day ${this.state.day} · ${phase}`);
    this.setText('day-countdown', `${change.event} in ${formatClock(change.seconds)}`);
    this.root.querySelector('#day-pill')?.classList.toggle('night', phase === 'Night');
    const hand = this.root.querySelector<HTMLElement>('#day-dial-hand');
    if (hand) hand.style.left = `${timeOfDay / BALANCE.daySeconds * 100}%`;
    this.root.querySelector('#sleep-button')?.classList.toggle('ready', !sleepBlocker(this.state));
    this.root.querySelector('#dock-sleep')?.classList.toggle('ready', !sleepBlocker(this.state));
    for (const key of ['energy', 'hunger', 'warmth'] as const) {
      const value = Math.round(player[key]);
      this.setText(`${key}-value`, String(value));
      const bar = this.root.querySelector<HTMLElement>(`#${key}-bar`);
      if (bar) bar.style.width = `${value}%`;
      const mini = this.root.querySelector<HTMLElement>(`#mini-${key}`);
      if (mini) mini.style.width = `${value}%`;
    }
    this.setText('wood-count', String(inventory.wood));
    this.setText('food-count', String(inventory.food));
    this.setText('fiber-count', String(inventory.fiber));
    this.setText('stone-count', String(inventory.stone));
    this.setText('ration-count', String(inventory.trailFood));
    const seenSites = (Object.keys(SITES) as SiteId[]).filter(id => this.state.progress.discoveries[id]);
    this.setText('sites-seen', seenSites.length ? `Places found: ${seenSites.map(id => SITES[id].name).join(' · ')}` : 'Places found: none yet');
    const nearSite = (Object.keys(SITES) as SiteId[]).some(id => Math.hypot(player.x - SITES[id].x, player.y - SITES[id].y) <= BALANCE.interactionRadius);
    this.root.querySelector('#site-button')?.classList.toggle('ready', nearSite);
    this.setText('space-count', `${carriedCount(this.state)}/${structures.crate ? BALANCE.crateCapacity : BALANCE.baseCapacity}`);
    this.root.querySelector('#eat-ration-button')?.classList.toggle('ready', inventory.trailFood > 0);
    this.root.querySelector('#prepare-button')?.classList.toggle('ready', !trailFoodBlocker(this.state));
    this.setText('prepare-hint', trailFoodBlocker(this.state) ?? '1 berry · 12 seconds · 1 ration');
    this.root.querySelectorAll<HTMLButtonElement>('[data-drop]').forEach(button => {
      button.disabled = inventory[button.dataset.drop as keyof GameState['inventory']] <= 0;
    });
    this.setText('fire-status', this.state.fireFuel > 0 ? `Fire burning · ${Math.ceil(this.state.fireFuel)}s of warmth` : 'The fire is unlit');
    const lookoutButton = this.root.querySelector<HTMLButtonElement>('#lookout-button');
    if (lookoutButton) {
      lookoutButton.disabled = !this.state.progress.hearthUnlocked || this.state.progress.lookoutRepaired;
      lookoutButton.classList.toggle('ready', !lookoutRepairBlocker(this.state));
    }
    if (this.state.progress.lookoutRepaired) {
      this.setText('lookout-title', 'A place to call home');
      this.setText('lookout-copy', 'The old lookout stands again. The paths are still yours to explore.');
      this.setText('lookout-cost', 'Restored');
    } else if (this.state.progress.hearthUnlocked) {
      this.setText('lookout-title', 'Restore the old lookout');
      this.setText('lookout-copy', 'Follow the northeast path to the lookout. Bring the repair materials and stand beside it.');
      this.setText('lookout-cost', '4 wood · 2 fiber · 2 stone');
    } else {
      this.setText('lookout-title', 'The old lookout');
      this.setText('lookout-copy', 'A damaged lookout waits along the northeast path. Weather the cold front before repairing it.');
      this.setText('lookout-cost', 'Unlocks after the cold front');
    }
    const axeButton = this.root.querySelector<HTMLButtonElement>('#axe-button');
    if (axeButton) {
      axeButton.disabled = !this.state.progress.hearthUnlocked || this.state.progress.axeCrafted;
      const canCraft = this.state.progress.hearthUnlocked && isAtCamp(this.state)
        && inventory.wood >= 1 && inventory.fiber >= 1 && inventory.stone >= 1 && !this.state.progress.axeCrafted;
      axeButton.classList.toggle('ready', canCraft);
    }
    if (this.state.progress.axeCrafted) {
      this.setText('axe-title', 'Stone axe ready');
      this.setText('axe-copy', 'Stand near a mature tree and press X to gather two wood. Stumps regrow after three dawns.');
      this.setText('axe-cost', 'Crafted');
    } else if (this.state.progress.hearthUnlocked) {
      this.setText('axe-title', 'Craft a stone axe');
      this.setText('axe-copy', 'Use stone, fiber, and wood at camp to work with the mature trees. Fallen branches remain easy to gather.');
      this.setText('axe-cost', '1 wood · 1 fiber · 1 stone');
    } else {
      this.setText('axe-title', 'Stone axe');
      this.setText('axe-copy', 'Weather the cold front to learn how to make a useful forest tool.');
      this.setText('axe-cost', 'Unlocks after the cold front');
    }
    const atCamp = isAtCamp(this.state);
    const afterDark = timeOfDay >= BALANCE.nightStart;
    this.setText('night-hint', !afterDark ? 'These small moments are waiting for nightfall.'
      : !atCamp ? 'Return to the camp circle for a quiet evening.'
        : 'Optional comforts while the night passes.');
    this.root.querySelector('#cook-button')?.classList.toggle('ready', !cookBlocker(this.state));
    this.root.querySelector('#stargaze-button')?.classList.toggle('ready', !stargazeBlocker(this.state));
    const dockCook = this.root.querySelector<HTMLButtonElement>('#dock-cook');
    if (dockCook) dockCook.hidden = Boolean(cookBlocker(this.state));
    const dockStargaze = this.root.querySelector<HTMLButtonElement>('#dock-stargaze');
    if (dockStargaze) dockStargaze.hidden = Boolean(stargazeBlocker(this.state));
    const storm = isColdNight(this.state);
    const forecast = this.root.querySelector('#forecast-panel');
    forecast?.classList.toggle('active', storm);
    forecast?.classList.toggle('weathered', this.state.progress.hearthUnlocked);
    if (this.state.progress.hearthUnlocked) {
      this.setText('forecast-title', 'The cold night is behind you');
      this.setText('forecast-copy', 'You kept your camp warm through dawn. The stone hearth is ready to build.');
      this.setText('forecast-shelter', '✓ Shelter held firm');
      this.setText('forecast-fire', '✓ Hearth unlocked');
    } else {
      const day = this.state.progress.nextStormDay!;
      this.setText('forecast-title', storm ? 'The cold front is here' : `Cold front · day ${day} night`);
      this.setText('forecast-copy', storm ? 'Stay at camp and keep the fire alive until dawn.' : `Build a shelter and bring two logs to camp before nightfall on day ${day}.`);
      this.setText('forecast-shelter', `${structures.shelter ? '✓' : '○'} Shelter ${structures.shelter ? 'ready' : 'needed'}`);
      this.setText('forecast-fire', forecastFireCheck(this.state));
    }
    this.setText('prompt', this.scene?.getPrompt() ?? 'WASD / arrows  Move');
    this.setText('build-hint', isAtCamp(this.state) ? 'At camp — click an upgrade to build.' : 'Stand inside the marked camp circle to build.');
    for (const id of buildOptions) {
      const status = buildStatus(this.state, id);
      const built = status === 'built';
      const locked = status === 'locked';
      const needsShelter = status === 'needsShelter';
      const definition = BUILDINGS[id];
      const cost = definition.cost;
      const stoneCost = 'stone' in cost ? cost.stone : 0;
      const button = this.root.querySelector<HTMLButtonElement>(`[data-build="${id}"]`)!;
      button.disabled = built || locked || needsShelter;
      button.classList.toggle('built', built);
      button.classList.toggle('locked', locked || needsShelter);
      button.classList.toggle('ready', status === 'ready');
      button.querySelector<HTMLElement>('.build-copy small')!.textContent = needsShelter ? 'Requires shelter' : definition.description;
      const fiberPrice = cost.fiber ? ` · ${cost.fiber} fiber` : '';
      const stonePrice = stoneCost ? ` · ${stoneCost} stone` : '';
      let verb = 'Build';
      let price = `${cost.wood} wood${fiberPrice}${stonePrice}`;
      if (built) {
        verb = 'Built';
        price = 'Complete';
      } else if (locked) {
        verb = 'Locked';
        price = 'Weather cold night';
      } else if (needsShelter) {
        verb = 'Blocked';
      }
      button.querySelector<HTMLElement>('.build-verb')!.textContent = verb;
      button.querySelector<HTMLElement>('.build-price')!.textContent = price;
    }
    const buildReady = Boolean(this.root.querySelector('[data-tab="build"] .ready'));
    this.root.querySelector('[data-tab-button="build"]')?.classList.toggle('has-dot', buildReady);
  }

  private setText(id: string, text: string): void {
    const element = this.root.querySelector<HTMLElement>(`#${id}`);
    if (element) element.textContent = text;
  }
}
