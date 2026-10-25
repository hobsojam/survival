import Phaser from 'phaser';
import { BALANCE, BUILDINGS, SITES, createGame, type GameState, type SiteId, type StructureId } from '../game/state';
import { GameScene } from '../scene/GameScene';
import { displayScale, viewportSize, canvasOffset, portraitViewport, LOGICAL_WIDTH, LOGICAL_HEIGHT } from '../scene/pixelScale';
import { autosaveDelayMs, loadGame, saveGame, type LoadResult } from '../game/save';
import { cookBlocker, isAtCamp, sleepBlocker, stargazeBlocker } from '../game/rules';
import { dayPhase, formatClock, nextChange } from '../game/clock';
import { gateTap, nextOpenTab, type DockTab } from './dock';
import { journalView, QUARRY_MARKER } from './journal';
import { axeView, bagView, buildButtonView, forecastView, lookoutView, nightHint, pickaxeView, startNote, type ActionPanelView } from './panels';
import { Soundscape } from '../game/soundscape';

const buildOptions = Object.keys(BUILDINGS) as StructureId[];

export class App {
  private state: GameState;
  private scene?: GameScene;
  private game?: Phaser.Game;
  private gameResize?: ResizeObserver;
  private readonly root: HTMLElement;
  private readonly soundscape: Soundscape;
  private readonly storage?: Storage;
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
    this.soundscape = new Soundscape(this.storage);
    const buildMarkup = buildOptions.map(id => {
      const { name, description, symbol } = BUILDINGS[id];
      return `<button type="button" class="build-item" data-build="${id}"><span class="build-symbol">${symbol}</span><span class="build-copy"><strong>${name}</strong><small>${description}</small></span><span class="build-cost"><b class="build-verb">Build</b><small class="build-price"></small></span></button>`
        + (id === 'stonePile' ? `<div id="stone-pile-controls" class="stone-pile-controls" hidden><span id="stone-pile-stored">Stored stone 0/${BALANCE.stonePileCapacity}</span><button type="button" data-action="storeStone">Store 1</button><button type="button" data-action="takeStone">Take 1</button></div>` : '');
    }).join('');
    // The quarry marker is always in the markup and shown only once the west path opens.
    const markerPlaces = [...journalView(this.state).locations.filter(place => place.id !== 'quarry'), { id: 'quarry', ...QUARRY_MARKER }];
    const mapMarkers = markerPlaces.map(place =>
      `<span id="map-${place.id}" class="map-point" style="left:${place.x / BALANCE.mapWidth * 100}%;top:${place.y / BALANCE.mapHeight * 100}%"${place.id === 'quarry' ? ' hidden' : ''}>?</span>`
    ).join('');
    this.root.innerHTML = `
      <div class="shell">
        <header class="topbar">
          <div class="brand"><span class="brand-icon">✦</span><div><strong>Hearthwild</strong><small>A little place to begin again</small></div></div>
          <div class="top-actions"><button type="button" id="sound-toggle" class="sound-toggle" aria-pressed="true" aria-label="Mute game sounds" title="Mute game sounds"><span aria-hidden="true">♫</span><span class="sound-toggle-label">Sound on</span></button><span id="save-status" class="save-status">Local save</span><button id="restart-game" class="restart-button" hidden>New game</button><div class="day-pill" id="day-pill"><span id="day-label">Day 1 · Morning</span><span class="day-dial" aria-hidden="true"><span class="day-dial-night" style="left: ${BALANCE.nightStart / BALANCE.daySeconds * 100}%"></span><span id="day-dial-hand" class="day-dial-hand"></span></span><span id="day-countdown" class="day-countdown"></span></div></div>
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
            <section class="panel axe-panel" data-tab="build"><p class="eyebrow">FOREST TOOLS</p><div class="tool-row"><h2 id="axe-title">Stone axe</h2><p id="axe-copy" class="lookout-copy"></p><button type="button" id="axe-button" data-action="craftAxe">Craft stone axe</button><small id="axe-cost">1 wood · 1 fiber · 1 stone</small></div><div id="pickaxe-row" class="tool-row" hidden><h2 id="pickaxe-title">Pickaxe</h2><p id="pickaxe-copy" class="lookout-copy"></p><button type="button" id="pickaxe-button" data-action="craftPickaxe">Craft pickaxe</button><small id="pickaxe-cost">2 wood · 1 fiber · 2 stone</small></div></section>
            <section class="panel ration-panel" data-tab="bag"><p class="eyebrow">TRAIL FOOD</p><h2>Drying rack</h2><p class="lookout-copy">Dry a berry at camp for a ration you can eat anywhere. Each restores 45 hunger.</p><button type="button" id="prepare-button" data-action="prepareTrailFood">Prepare trail ration</button><small id="prepare-hint">Build a drying rack first.</small></section>
            <section class="panel sites-panel" data-tab="camp"><p class="eyebrow">BEYOND CAMP</p><h2>Follow the paths</h2><p class="lookout-copy">An old basket, a quiet spring, and a stone cairn wait beyond the clearing.</p><p id="sites-seen" class="sites-seen">Places found: none yet</p><button type="button" id="site-button">Explore nearby place</button><small>Stand beside a place and press V</small></section>
            <section class="panel journal-panel" data-tab="camp"><p class="eyebrow">YOUR FIELD JOURNAL</p><h2>Paths from camp</h2><p id="journal-hint" class="journal-hint"></p><details open><summary>Map and milestones</summary><div class="journal-map" aria-hidden="true"><svg viewBox="0 0 40 30" preserveAspectRatio="none"><path d="M20 15 L8 8 M20 15 L30 8 M20 15 L10 20 M20 15 L31 21" /><path id="map-west-path" d="M20 15 L1 15" style="display:none" /></svg><span class="map-point camp" style="left:50%;top:50%">✦</span>${mapMarkers}<span id="map-player" class="map-player"></span></div><p class="map-key">✦ Camp &nbsp; ● You &nbsp; ? Unexplored</p><ul id="journal-places" class="journal-list"></ul><p class="journal-subhead">Camp milestones</p><ul id="journal-milestones" class="journal-list"></ul></details></section>
            <section class="panel survivor-panel" data-tab="bag"><p class="eyebrow">YOUR SURVIVOR</p><h2>Take it one day at a time</h2>
              <div class="meter"><div class="meter-title"><span>Energy</span><b id="energy-value">100</b></div><div class="track"><div id="energy-bar" class="fill energy"></div></div></div>
              <div class="meter"><div class="meter-title"><span>Hunger</span><b id="hunger-value">100</b></div><div class="track"><div id="hunger-bar" class="fill hunger"></div></div></div>
              <div class="meter"><div class="meter-title"><span>Warmth</span><b id="warmth-value">100</b></div><div class="track"><div id="warmth-bar" class="fill warmth"></div></div></div>
              <div class="quick-actions"><button data-action="eat">Eat berries</button><button data-action="eatTrailFood" id="eat-ration-button">Eat ration</button><button data-action="rest">Rest</button><button data-action="stokeFire">Feed fire</button><button data-action="sleep" id="sleep-button">Sleep</button></div>
            </section>
            <section class="panel bag-panel" data-tab="bag"><p class="eyebrow">IN YOUR BAG</p><div class="supplies">
              <div><span class="supply-icon wood">▰</span><strong id="wood-count">0</strong><small>Wood</small><button type="button" class="supply-action" data-action="stokeFire" data-supply="wood" aria-label="Burn one wood">Burn</button></div>
              <div><span class="supply-icon food">●</span><strong id="food-count">0</strong><small>Food</small><button type="button" class="supply-action" data-action="eat" data-supply="food" aria-label="Eat one berry">Eat</button></div>
              <div><span class="supply-icon fiber">≋</span><strong id="fiber-count">0</strong><small>Fiber</small><button type="button" class="supply-action" data-action="burnFiber" data-supply="fiber" aria-label="Burn one fiber">Burn</button></div>
              <div><span class="supply-icon stone">◆</span><strong id="stone-count">0</strong><small>Stone</small><small id="stone-stored" class="stone-stored"></small><button type="button" class="supply-action" data-action="dropStone" data-supply="stone" aria-label="Drop one stone">Drop</button></div>
              <div><span class="supply-icon ration">◇</span><strong id="ration-count">0</strong><small>Rations</small><button type="button" class="supply-action" data-action="eatTrailFood" data-supply="trailFood" aria-label="Eat one trail ration">Eat</button></div>
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
        const type = button.dataset.action as 'eat' | 'eatTrailFood' | 'prepareTrailFood' | 'rest' | 'stokeFire' | 'sleep' | 'cook' | 'stargaze' | 'repairLookout' | 'craftAxe' | 'craftPickaxe' | 'burnFiber' | 'dropStone' | 'storeStone' | 'takeStone';
        this.scene?.perform({ type });
      });
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
    this.root.querySelector('#sound-toggle')!.addEventListener('click', () => {
      this.soundscape.toggle();
      this.updateSoundToggle();
    });
    document.addEventListener('pointerdown', () => this.soundscape.resume(), { passive: true });
    document.addEventListener('keydown', () => this.soundscape.resume());
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
    this.updateSoundToggle();
    this.render();
  }

  startGame(state: GameState): void {
    this.gameResize?.disconnect();
    this.game?.destroy(true);
    this.root.querySelector('#start-screen')?.classList.add('hidden');
    this.root.querySelector('#lookout-ending')?.classList.add('hidden');
    const restart = this.root.querySelector<HTMLButtonElement>('#restart-game');
    if (restart) restart.hidden = false;
    this.setOpenTab(null);
    this.state = state;
    this.lastSaveAt = Date.now();
    this.saveFailures = 0;
    this.soundscape.update(state);
    this.soundscape.start();
    this.scene = new GameScene(state, (next, cause) => {
      const previous = this.state;
      this.state = next;
      this.soundscape.update(next);
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
    }, message => this.setMessage(message), cue => this.soundscape.playCue(cue));
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
    if (note) note.textContent = startNote(this.previousSave, Boolean(this.storage));
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
    this.setMessage(this.previousSave.state.area === 'quarry' ? 'Welcome back. You are out by the old quarry.' : 'Welcome back to your camp.');
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
  }

  private render(): void {
    this.renderClock();
    this.renderSurvivor();
    this.renderBag();
    this.renderJournal();
    this.renderTools();
    this.renderNight();
    this.renderForecast();
    this.renderBuild();
  }

  private renderClock(): void {
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
  }

  private renderSurvivor(): void {
    const { player } = this.state;
    for (const key of ['energy', 'hunger', 'warmth'] as const) {
      const value = Math.round(player[key]);
      this.setText(`${key}-value`, String(value));
      const bar = this.root.querySelector<HTMLElement>(`#${key}-bar`);
      if (bar) bar.style.width = `${value}%`;
      const mini = this.root.querySelector<HTMLElement>(`#mini-${key}`);
      if (mini) mini.style.width = `${value}%`;
    }
    const nearSite = this.state.area === 'camp' && (Object.keys(SITES) as SiteId[]).some(id => Math.hypot(player.x - SITES[id].x, player.y - SITES[id].y) <= BALANCE.interactionRadius);
    this.root.querySelector('#site-button')?.classList.toggle('ready', nearSite);
  }

  private renderBag(): void {
    const { inventory } = this.state;
    const bag = bagView(this.state);
    this.setText('wood-count', String(inventory.wood));
    this.setText('food-count', String(inventory.food));
    this.setText('fiber-count', String(inventory.fiber));
    this.setText('stone-count', String(inventory.stone));
    this.setText('ration-count', String(inventory.trailFood));
    this.setText('space-count', bag.spaces);
    this.root.querySelector('#eat-ration-button')?.classList.toggle('ready', inventory.trailFood > 0);
    this.root.querySelector('#prepare-button')?.classList.toggle('ready', bag.prepareReady);
    this.setText('prepare-hint', bag.prepareHint);
    this.root.querySelectorAll<HTMLButtonElement>('[data-supply]').forEach(button => {
      button.disabled = inventory[button.dataset.supply as keyof GameState['inventory']] <= 0;
    });
    this.setText('stone-stored', bag.storedAtCamp);
    const pileControls = this.root.querySelector<HTMLElement>('#stone-pile-controls');
    if (pileControls) pileControls.hidden = !bag.pileShown;
    this.setText('stone-pile-stored', bag.pileStored);
    this.setText('fire-status', bag.fire);
  }

  private renderJournal(): void {
    const journal = journalView(this.state);
    this.setText('journal-hint', journal.nextHint);
    const placeList = this.root.querySelector('#journal-places');
    if (placeList) {
      placeList.replaceChildren(...journal.locations.map(place => {
        const item = document.createElement('li');
        item.textContent = place.label;
        item.classList.toggle('found', place.visited);
        return item;
      }));
    }
    const milestoneList = this.root.querySelector('#journal-milestones');
    if (milestoneList) {
      milestoneList.replaceChildren(...journal.milestones.map(milestone => {
        const item = document.createElement('li');
        item.textContent = `${milestone.done ? '✓' : '○'} ${milestone.label}`;
        item.classList.toggle('found', milestone.done);
        return item;
      }));
    }
    this.renderMap(journal.locations);
  }

  private renderMap(locations: ReturnType<typeof journalView>['locations']): void {
    const { player } = this.state;
    const quarryKnown = locations.some(place => place.id === 'quarry');
    const quarryMarker = this.root.querySelector<HTMLElement>('#map-quarry');
    if (quarryMarker) quarryMarker.hidden = !quarryKnown;
    const westPath = this.root.querySelector<SVGPathElement>('#map-west-path');
    if (westPath) westPath.style.display = quarryKnown ? '' : 'none';
    for (const place of locations) {
      const marker = this.root.querySelector(`#map-${place.id}`);
      if (marker) {
        let symbol = '?';
        if (place.id === 'lookout') symbol = '⌂';
        else if (place.visited) symbol = '✓';
        marker.textContent = symbol;
        marker.classList.toggle('found', place.visited);
      }
    }
    const playerMarker = this.root.querySelector<HTMLElement>('#map-player');
    if (playerMarker) {
      // The camp map can't show the quarry area, so away there the survivor sits at the west path's end.
      const mapPosition = this.state.area === 'camp' ? player : QUARRY_MARKER;
      playerMarker.style.left = `${mapPosition.x / BALANCE.mapWidth * 100}%`;
      playerMarker.style.top = `${mapPosition.y / BALANCE.mapHeight * 100}%`;
    }
  }

  /** Writes a one-button panel's view into the elements named after it, such as #axe-title and #axe-button. */
  private renderActionPanel(name: string, view: ActionPanelView): void {
    const button = this.root.querySelector<HTMLButtonElement>(`#${name}-button`);
    if (button) {
      button.disabled = view.disabled;
      button.classList.toggle('ready', view.ready);
    }
    this.setText(`${name}-title`, view.title);
    this.setText(`${name}-copy`, view.copy);
    this.setText(`${name}-cost`, view.cost);
  }

  private renderTools(): void {
    this.renderActionPanel('lookout', lookoutView(this.state));
    this.renderActionPanel('axe', axeView(this.state));
    const pickaxe = pickaxeView(this.state);
    const pickaxeRow = this.root.querySelector<HTMLElement>('#pickaxe-row');
    if (pickaxeRow) pickaxeRow.hidden = !pickaxe.shown;
    this.renderActionPanel('pickaxe', pickaxe);
  }

  private renderNight(): void {
    this.setText('night-hint', nightHint(this.state));
    this.root.querySelector('#cook-button')?.classList.toggle('ready', !cookBlocker(this.state));
    this.root.querySelector('#stargaze-button')?.classList.toggle('ready', !stargazeBlocker(this.state));
    const dockCook = this.root.querySelector<HTMLButtonElement>('#dock-cook');
    if (dockCook) dockCook.hidden = Boolean(cookBlocker(this.state));
    const dockStargaze = this.root.querySelector<HTMLButtonElement>('#dock-stargaze');
    if (dockStargaze) dockStargaze.hidden = Boolean(stargazeBlocker(this.state));
  }

  private renderForecast(): void {
    const view = forecastView(this.state);
    const forecast = this.root.querySelector('#forecast-panel');
    forecast?.classList.toggle('active', view.active);
    forecast?.classList.toggle('weathered', view.weathered);
    this.setText('forecast-title', view.title);
    this.setText('forecast-copy', view.copy);
    this.setText('forecast-shelter', view.shelter);
    this.setText('forecast-fire', view.fire);
  }

  private renderBuild(): void {
    this.setText('prompt', this.scene?.getPrompt() ?? 'WASD / arrows  Move');
    this.setText('build-hint', isAtCamp(this.state) ? 'At camp — click an upgrade to build.' : 'Stand inside the marked camp circle to build.');
    for (const id of buildOptions) this.renderBuildButton(id);
    const buildReady = Boolean(this.root.querySelector('[data-tab="build"] .ready'));
    this.root.querySelector('[data-tab-button="build"]')?.classList.toggle('has-dot', buildReady);
  }

  private renderBuildButton(id: StructureId): void {
    const view = buildButtonView(this.state, id);
    const button = this.root.querySelector<HTMLButtonElement>(`[data-build="${id}"]`)!;
    button.disabled = view.disabled;
    button.classList.toggle('built', view.built);
    button.classList.toggle('locked', view.locked);
    button.classList.toggle('ready', view.ready);
    button.querySelector<HTMLElement>('.build-copy small')!.textContent = view.description;
    button.querySelector<HTMLElement>('.build-verb')!.textContent = view.verb;
    button.querySelector<HTMLElement>('.build-price')!.textContent = view.price;
  }


  private setText(id: string, text: string): void {
    const element = this.root.querySelector<HTMLElement>(`#${id}`);
    if (element) element.textContent = text;
  }

  private updateSoundToggle(): void {
    const button = this.root.querySelector<HTMLButtonElement>('#sound-toggle');
    if (!button) return;
    const soundOn = !this.soundscape.isMuted;
    const label = soundOn ? 'Sound on' : 'Sound off';
    const action = soundOn ? 'Mute game sounds' : 'Turn on game sounds';
    button.querySelector('.sound-toggle-label')!.textContent = label;
    button.setAttribute('aria-pressed', String(soundOn));
    button.setAttribute('aria-label', action);
    button.title = action;
  }
}
