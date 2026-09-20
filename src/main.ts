import './style.css';
import { chooseNinjaScreen, changeAvatarScreen, introScreen, nameScreen } from './ui/avatar';
import { mapScreen, islandScreen, rewardsScreen, type StartPlay } from './ui/home';
import { playScreen, type PlayOpts } from './ui/play';
import { memoryScreen } from './ui/memory';
import { duelScreen } from './ui/duel';
import { shopScreen } from './ui/shop';
import { clearPendingReset, isPendingReset, parentsScreen } from './ui/parents';
import { profilesScreen } from './ui/profiles';
import { load, profileIds, save } from './storage';
import { initGameSpeed } from './game/speed';
import { fontReady } from './ui/font';
import { startServiceWorker } from './pwa';
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
// The first-run wizard (#67): chooseNinjaScreen (pick a ninja) → nameScreen (the child's name) → introScreen
// (Sensei's welcome, first run only) → map. A returning player re-entering via `#change-av` (home.ts) gets
// changeAvatarScreen instead — ninja only, straight back to home — because `onboarded` is already true by
// the time that button exists.
//
// Finishing the wizard unwinds both of its pushed history entries (onboard-name, onboard-intro) in one go —
// history.back() only undoes one, which would leave a dead onboard-name entry between the map and the start
// of a fresh session's history and land there instead of the map on the next hardware-back press.
const renderIntro = () => introScreen(() => { save({ onboarded: true }); history.go(-2); });
const renderName = () => nameScreen(() => { enter('onboard-intro'); renderIntro(); });
const nav = {
  avatar: () => {
    leave(); fromPop = false;
    if (load().onboarded) { changeAvatarScreen(() => nav.map()); return; }
    chooseNinjaScreen(() => { enter('onboard-name'); renderName(); });
  },
  map: () => { leave(); year = null; if (!fromPop && history.state?.screen) { history.back(); return; } fromPop = false; mapScreen(nav); },
  island: (y: YearInfo) => { leave(); year = y; enter('island'); islandScreen(nav, y); },
  play: ((o: PlayOpts) => { leave(); year = o.year; enter('play'); dispose = playScreen(o, up, () => nav.play(o)); }) as StartPlay,
  memory: (y: YearInfo) => { leave(); year = y; enter('memory'); dispose = memoryScreen({ year: y }, up, () => nav.memory(y)); },
  duel: (y: YearInfo) => { leave(); year = y; enter('duel'); dispose = duelScreen({ year: y }, up, () => nav.duel(y)); },   // #16
  rewards: () => { leave(); enter('rewards'); rewardsScreen(nav); },
  shop: () => { leave(); enter('shop'); shopScreen(nav); },
  parents: () => { leave(); enter('parents'); parentsScreen(nav); },
  // #20 slice 2: the profile picker. Deliberately pushes **no** history entry, which makes it a launch screen
  // rather than a step in the stack: the sky map is the root here (`mapScreen` pushes nothing either), and
  // `nav.map()` pops whenever an entry exists — so an entry for the picker would send every "chosen, go to the
  // map" straight back to the picker. Back from the picker leaves the app, exactly as back from the map does.
  profiles: () => { leave(); fromPop = false; profilesScreen(() => afterPick(), () => nav.avatar()); },
  up,
};
/** Where a chosen profile lands: their sky map, or onboarding when that slot has never been played. */
const afterPick = () => { if (load().onboarded) nav.map(); else nav.avatar(); };
window.addEventListener('popstate', () => {
  const s = history.state?.screen as string | undefined;   // the entry we landed on
  fromPop = true;
  // The grown-ups screen's guarded reset (#115) must land on onboarding, never the map with an empty profile,
  // however it is left — including the hardware/browser back button landing here rather than through
  // parents.ts's own `#back` click handler.
  //
  // 'onboard-name'/'onboard-intro' only mean anything while `onboarded` is still false (#197 review): a
  // reload mid-wizard leaves that step's entry as the current one, but boot always restarts at step 1
  // regardless, and a fresh walk-through then pushes new entries *on top of* the stale one rather than
  // replacing it. Without the `!load().onboarded` guard, finishing the wizard a second time — or a later
  // hardware-back press — could land back on that stale entry and silently re-show a wizard step to a
  // player who has already finished onboarding. Once `onboarded` is true, every history entry from before
  // it is inert as far as the wizard is concerned; only the map (or wherever `nav.map()` sends it next) is.
  if (s === 'island' && year) nav.island(year); else if (s === 'rewards') nav.rewards(); else if (s === 'onboard-intro' && !load().onboarded) { fromPop = false; leave(); renderIntro(); } else if (s === 'onboard-name' && !load().onboarded) { fromPop = false; leave(); renderName(); } else if (s === 'play' || s === 'memory' || s === 'duel' || s === 'shop' || s === 'parents') { fromPop = false; history.back(); } else if (isPendingReset()) { clearPendingReset(); nav.avatar(); } else if (!load().onboarded) nav.avatar(); else nav.map();
});

// ?reset=1 clears saved progress (used by tests).
const params = new URLSearchParams(location.search);
if (params.get('reset')) { try { localStorage.clear(); } catch { /* ignore */ } }
initGameSpeed();   // #32: test-only `?fast=N` time compression; default 1 (ordinary play)
// #44: start waiting for Fredoka at boot, not when a mission starts. The result is cached, so by the time a
// child has picked an avatar, an island and a topic the answer is already in — and the wait, including the
// full 1200 ms an offline APK always pays, is spent on the menus instead of out of a Sprint or Boss clock
// that starts before the first wave spawns. (Raised reviewing #139.)
void fontReady();
// #15: offline play. Deliberately fire-and-forget and deliberately after the first screen is decided — a
// worker that fails to register, or a browser that has none, must change nothing about the game starting.
void startServiceWorker();
// #20 slice 2: "Who is playing?" comes first once siblings share the device. With one profile — every player
// today — it never appears and boot is unchanged, which is the owner's decision at the top of #20.
//
// #67: `onboarded`, not `avatar` — a profile mid-wizard already has an avatar chosen (choices save as they
// are made) but must still see the rest of the wizard on the next launch, not jump straight to the map.
if (profileIds().length > 1) nav.profiles(); else if (load().onboarded) nav.map(); else nav.avatar();

// Keep the layout stable on mobile browsers whose toolbars resize the viewport.
const setVH = () => document.documentElement.style.setProperty('--vh', `${window.innerHeight * 0.01}px`);
setVH(); window.addEventListener('resize', setVH);
