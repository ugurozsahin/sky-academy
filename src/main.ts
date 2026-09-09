import './style.css';
import { avatarScreen } from './ui/avatar';
import { mapScreen, islandScreen, rewardsScreen, type StartPlay } from './ui/home';
import { playScreen, type PlayOpts } from './ui/play';
import { memoryScreen } from './ui/memory';
import { shopScreen } from './ui/shop';
import { parentsScreen } from './ui/parents';
import { load } from './storage';
import { initGameSpeed } from './game/speed';
import type { YearInfo } from './curriculum';

// Tiny screen router: avatar → sky map (islands) → island (topics) → play.
// Each screen below the map pushes a history entry, so the Android back button (and the browser's) steps
// back one screen — play → island → map — instead of leaving the app (#53).
let year: YearInfo | null = null; let fromPop = false;
const enter = (screen: string) => {
  if (fromPop) { fromPop = false; return; }                                   // re-rendering after a pop: the entry already exists
  if (history.state?.screen === screen) history.replaceState({ screen }, ''); else history.pushState({ screen }, '');
};
/** Go up one screen by popping history (so the stack stays [map, island?, play|memory?] / [map, rewards?]). */
const up = () => { if (history.state?.screen) history.back(); else nav.map(); };
// Play and Memory own a rAF loop, timers, speech and window listeners; replacing `#app` does not stop any of
// them, so every route change tears the old screen down first. Missing this leaked a ticking Arena on every
// back-button exit — see the guard rail in tests/e2e/game.spec.ts (#73).
let dispose: (() => void) | null = null;
const leave = () => { const d = dispose; dispose = null; d?.(); };
const nav = {
  avatar: () => { leave(); avatarScreen(() => nav.map()); },
  map: () => { leave(); year = null; if (!fromPop && history.state?.screen) { history.back(); return; } fromPop = false; mapScreen(nav); },
  island: (y: YearInfo) => { leave(); year = y; enter('island'); islandScreen(nav, y); },
  play: ((o: PlayOpts) => { leave(); year = o.year; enter('play'); dispose = playScreen(o, up, () => nav.play(o)); }) as StartPlay,
  memory: (y: YearInfo) => { leave(); year = y; enter('memory'); dispose = memoryScreen({ year: y }, up, () => nav.memory(y)); },
  rewards: () => { leave(); enter('rewards'); rewardsScreen(nav); },
  shop: () => { leave(); enter('shop'); shopScreen(nav); },
  parents: () => { leave(); enter('parents'); parentsScreen(nav); },
  up,
};
window.addEventListener('popstate', () => {
  const s = history.state?.screen as string | undefined;   // the entry we landed on
  fromPop = true;
  if (s === 'island' && year) nav.island(year); else if (s === 'rewards') nav.rewards(); else if (s === 'play' || s === 'memory' || s === 'shop' || s === 'parents') { fromPop = false; history.back(); } else nav.map();
});

// ?reset=1 clears saved progress (used by tests).
const params = new URLSearchParams(location.search);
if (params.get('reset')) { try { localStorage.clear(); } catch { /* ignore */ } }
initGameSpeed();   // #32: test-only `?fast=N` time compression; default 1 (ordinary play)
if (load().avatar) nav.map(); else nav.avatar();

// Keep the layout stable on mobile browsers whose toolbars resize the viewport.
const setVH = () => document.documentElement.style.setProperty('--vh', `${window.innerHeight * 0.01}px`);
setVH(); window.addEventListener('resize', setVH);
