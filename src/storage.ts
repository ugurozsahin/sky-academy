// Persistent player state (localStorage). Small, versioned, safe on failure.
export interface TopicProgress { stars: number; best: number; plays: number }
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
  totalSlices: number;
  coins: number;                     // ninja coins earned (lifetime)
  stickers: string[];                // unlocked sticker ids
  streak: { last: string; days: number };   // daily play streak (ISO date)
  tutorialSeen: boolean;             // the "slice the bubble" demo hand has done its job
}
const KEY = 'sna:v1';
const DEFAULT: SaveData = { v: 1, name: '', avatar: null, year: 'reception', sound: true, speech: true, progress: {}, endless: {}, sprint: {}, totalSlices: 0, coins: 0, stickers: [], streak: { last: '', days: 0 }, tutorialSeen: false };

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
export function recordEndless(year: string, score: number) {
  const e = load().endless; if ((e[year] ?? 0) < score) save({ endless: { ...e, [year]: score } });
}
/** Ninja Sprint best per year. Returns true when `score` is a new personal best (a score of 0 never is). */
export function recordSprint(year: string, score: number): boolean {
  const s = load().sprint; if (score <= 0 || (s[year] ?? 0) >= score) return false;
  save({ sprint: { ...s, [year]: score } }); return true;
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
export function reset() { cache = null; try { localStorage.removeItem(KEY); } catch { /* ignore */ } }
