// Persistent player state (localStorage). Small, versioned, safe on failure.
import { applyEvent, dojoFor, freshDojo, type DojoEvent, type DojoOutcome, type DojoState } from './game/dojo';
import { balance, buy, equip, type ItemKind, type Wallet } from './game/shop';
export interface TopicProgress { stars: number; best: number; plays: number; hits?: number; tries?: number }   // hits/tries = lifetime slices (missions + Sensei training)
export interface SaveData {
  v: 1;
  name: string;
  avatar: string | null;
  year: 'reception' | 'year1' | 'year2';
  sound: boolean;
  speech: boolean;
  progress: Record<string, TopicProgress>;
  endless: Record<string, number>;   // year -> best score
  sprint: Record<string, number>;    // year -> best Ninja Sprint score
  boss: Record<string, number>;      // year -> Hammer Man knock-outs
  memory: Record<string, number>;    // year -> Memory Match boards completed
  training: Record<string, number>;  // year -> Sensei training sessions completed
  totalSlices: number;
  coins: number;                     // ninja coins earned (lifetime)
  stickers: string[];                // unlocked sticker ids
  streak: { last: string; days: number };   // daily play streak (ISO date)
  tutorialSeen: boolean;             // the "slice the bubble" demo hand has done its job
  dojo: DojoState;                   // Daily Dojo challenges (progress resets each day)
  spent: number;                     // coins spent in the shop (#6) — balance = coins − spent, stickers still unlock from lifetime coins
  owned: string[];                   // bought shop item ids
  equipped: Partial<Record<ItemKind, string>>;   // equipped item per kind (missing = the free default)
}
const KEY = 'sna:v1';
const DEFAULT: SaveData = { v: 1, name: '', avatar: null, year: 'reception', sound: true, speech: true, progress: {}, endless: {}, sprint: {}, boss: {}, memory: {}, training: {}, totalSlices: 0, coins: 0, stickers: [], streak: { last: '', days: 0 }, tutorialSeen: false, dojo: freshDojo(''), spent: 0, owned: [], equipped: {} };

let cache: SaveData | null = null;
export function load(): SaveData {
  if (cache) return cache;
  try { const raw = localStorage.getItem(KEY); cache = raw ? { ...DEFAULT, ...JSON.parse(raw) } : { ...DEFAULT }; }
  catch { cache = { ...DEFAULT }; }
  return cache!;
}
export function save(patch: Partial<SaveData> = {}): SaveData {
  cache = { ...load(), ...patch };
  try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch { /* private mode etc. */ }
  return cache;
}
export function recordTopic(topicId: string, stars: number, score: number) {
  const p = load().progress[topicId] ?? { stars: 0, best: 0, plays: 0 };
  const next = { stars: Math.max(p.stars, stars), best: Math.max(p.best, score), plays: p.plays + 1 };
  save({ progress: { ...load().progress, [topicId]: next } });
}
/** Add answered questions to a topic's lifetime tally (Sensei picks the weakest topics from these). */
export function recordAccuracy(topicId: string, hits: number, tries: number) {
  if (tries <= 0) return;
  const p = load().progress[topicId] ?? { stars: 0, best: 0, plays: 0 };
  save({ progress: { ...load().progress, [topicId]: { ...p, hits: (p.hits ?? 0) + hits, tries: (p.tries ?? 0) + tries } } });
}
/** Count a completed Sensei training session for this year. Returns the new total. */
export function recordTraining(year: string): number {
  const t = load().training; const n = (t[year] ?? 0) + 1;
  save({ training: { ...t, [year]: n } }); return n;
}
export function recordEndless(year: string, score: number) {
  const e = load().endless; if ((e[year] ?? 0) < score) save({ endless: { ...e, [year]: score } });
}
/** Ninja Sprint best per year. Returns true when `score` is a new personal best (a score of 0 never is). */
export function recordSprint(year: string, score: number): boolean {
  const s = load().sprint; if (score <= 0 || (s[year] ?? 0) >= score) return false;
  save({ sprint: { ...s, [year]: score } }); return true;
}
/** Count a Boss Battle knock-out for this year. Returns the new total. */
export function recordBossWin(year: string): number {
  const b = load().boss; const n = (b[year] ?? 0) + 1;
  save({ boss: { ...b, [year]: n } }); return n;
}
/** Count a completed Memory Match board for this year. Returns the new total. */
export function recordMemory(year: string): number {
  const m = load().memory; const n = (m[year] ?? 0) + 1;
  save({ memory: { ...m, [year]: n } }); return n;
}
/** Sticker album: unlocked by lifetime coins. Order = avatars then the villain. */
export const STICKER_IDS = ['volt', 'blaze', 'splash', 'terra', 'gust', 'frost', 'sol', 'shadow', 'kai', 'bolt', 'hammer'];
export const STICKER_COST = [30, 70, 120, 180, 250, 330, 420, 520, 630, 750, 900];
export function stickersFor(coins: number) { return STICKER_IDS.filter((_, i) => coins >= STICKER_COST[i]); }
/** Add coins, return newly unlocked sticker ids. */
export function addCoins(n: number): string[] {
  const d = load(); const coins = d.coins + Math.max(0, n);
  const unlocked = stickersFor(coins); const fresh = unlocked.filter(id => !d.stickers.includes(id));
  save({ coins, stickers: unlocked });
  return fresh;
}
export const today = (now = new Date()) => now.toISOString().slice(0, 10);
/** Update the daily streak for a play today. Returns the streak length. */
export function touchStreak(now = new Date()): number {
  const d = load(); const t = today(now);
  if (d.streak.last === t) return d.streak.days;
  const y = new Date(now); y.setDate(y.getDate() - 1);
  const days = d.streak.last === today(y) ? d.streak.days + 1 : 1;
  save({ streak: { last: t, days } });
  return days;
}
/** Today's dojo state (rolled over to a fresh day when needed — not persisted until something is recorded). */
export function dojoToday(now = new Date()): DojoState { return dojoFor(load().dojo, today(now)); }
/** Feed a finished game to the Daily Dojo. Persists the state; the caller pays out `coins` (so sticker unlocks show). */
export function recordDojo(e: DojoEvent, now = new Date()): DojoOutcome {
  const out = applyEvent(load().dojo, e, today(now));
  save({ dojo: out.state }); return out;
}
/** The spendable part of the save. */
export function wallet(): Wallet { const d = load(); return { coins: d.coins, spent: d.spent || 0, owned: Array.isArray(d.owned) ? d.owned : [], equipped: d.equipped ?? {} }; }   // tolerant of hand-edited saves
export const coinBalance = () => balance(wallet());
/** Buy (and equip) a shop item. Returns false when it is already owned, unknown or too dear. */
export function buyItem(id: string): boolean {
  const r = buy(wallet(), id); if (!r.ok) return false;
  save({ spent: r.wallet.spent, owned: r.wallet.owned, equipped: r.wallet.equipped }); return true;
}
/** Equip an owned item. Returns false when nothing changed. */
export function equipItem(id: string): boolean {
  const w = wallet(); const next = equip(w, id); if (next === w) return false;
  save({ equipped: next.equipped }); return true;
}
export function reset() { cache = null; try { localStorage.removeItem(KEY); } catch { /* ignore */ } }
