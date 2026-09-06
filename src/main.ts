import './style.css';
import { avatarScreen } from './ui/avatar';
import { mapScreen, islandScreen, rewardsScreen, type StartPlay } from './ui/home';
import { playScreen, type PlayOpts } from './ui/play';
import { memoryScreen } from './ui/memory';
import { shopScreen } from './ui/shop';
import { load } from './storage';
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
const nav = {
  avatar: () => avatarScreen(() => nav.map()),
  map: () => { year = null; if (!fromPop && history.state?.screen) { history.back(); return; } fromPop = false; mapScreen(nav); },
  island: (y: YearInfo) => { year = y; enter('island'); islandScreen(nav, y); },
  play: ((o: PlayOpts) => { year = o.year; enter('play'); playScreen(o, up, () => nav.play(o)); }) as StartPlay,
  memory: (y: YearInfo) => { year = y; enter('memory'); memoryScreen({ year: y }, up, () => nav.memory(y)); },
  rewards: () => { enter('rewards'); rewardsScreen(nav); },
  shop: () => { enter('shop'); shopScreen(nav); },
  up,
};
window.addEventListener('popstate', () => {
  const s = history.state?.screen as string | undefined;   // the entry we landed on
  fromPop = true;
  if (s === 'island' && year) nav.island(year); else if (s === 'rewards') nav.rewards(); else if (s === 'play' || s === 'memory' || s === 'shop') { fromPop = false; history.back(); } else nav.map();
});

// ?reset=1 clears saved progress (used by tests).
const params = new URLSearchParams(location.search);
if (params.get('reset')) { try { localStorage.clear(); } catch { /* ignore */ } }
if (load().avatar) nav.map(); else nav.avatar();

// Keep the layout stable on mobile browsers whose toolbars resize the viewport.
const setVH = () => document.documentElement.style.setProperty('--vh', `${window.innerHeight * 0.01}px`);
setVH(); window.addEventListener('resize', setVH);
