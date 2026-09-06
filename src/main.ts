import './style.css';
import { avatarScreen } from './ui/avatar';
import { mapScreen, islandScreen, rewardsScreen, type StartPlay } from './ui/home';
import { playScreen, type PlayOpts } from './ui/play';
import { memoryScreen } from './ui/memory';
import { load } from './storage';
import type { YearInfo } from './curriculum';

// Tiny screen router: avatar → sky map (islands) → island (topics) → play.
const nav = {
  avatar: () => avatarScreen(() => nav.map()),
  map: () => mapScreen(nav),
  island: (year: YearInfo) => islandScreen(nav, year),
  play: ((o: PlayOpts) => playScreen(o, () => nav.island(o.year), () => nav.play(o))) as StartPlay,
  memory: (year: YearInfo) => memoryScreen({ year }, () => nav.island(year), () => nav.memory(year)),
  rewards: () => rewardsScreen(nav),
};

// ?reset=1 clears saved progress (used by tests).
const params = new URLSearchParams(location.search);
if (params.get('reset')) { try { localStorage.clear(); } catch { /* ignore */ } }
if (load().avatar) nav.map(); else nav.avatar();

// Keep the layout stable on mobile browsers whose toolbars resize the viewport.
const setVH = () => document.documentElement.style.setProperty('--vh', `${window.innerHeight * 0.01}px`);
setVH(); window.addEventListener('resize', setVH);
