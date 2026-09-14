// Persistent player state (localStorage). Small, versioned, safe on failure.
import { applyEvent, dojoFor, freshDojo, type DojoEvent, type DojoOutcome, type DojoState } from './game/dojo';
import { balance, buy, equip, type ItemKind, type Wallet } from './game/shop';
import type { YearId } from './curriculum';
export interface TopicProgress { stars: number; best: number; plays: number; hits?: number; tries?: number }   // hits/tries = lifetime slices (missions + Sensei training)
export interface SaveData {
  v: 2;
  name: string;
  avatar: string | null;
  year: YearId;
  sound: boolean;
  speech: boolean;
  voice: 'unknown' | 'yes' | 'no';   // last observed TTS result; probed again on the next launch (#65)
  progress: Record<string, TopicProgress>;
  endless: Record<string, number>;   // year -> best score
  sprint: Record<string, number>;    // year -> best Ninja Sprint score
  boss: Record<string, number>;      // year -> Hammer Man knock-outs
  memory: Record<string, number>;    // year -> Memory Match boards completed
  training: Record<string, number>;  // year -> Sensei training sessions completed
  coins: number;                     // ninja coins earned (lifetime)
  stickers: string[];                // unlocked sticker ids
  streak: { last: string; days: number };   // daily play streak (ISO date)
  tutorialSeen: boolean;             // the "slice the bubble" demo hand has done its job
  dojo: DojoState;                   // Daily Dojo challenges (progress resets each day)
  spent: number;                     // coins spent in the shop (#6) — balance = coins − spent, stickers still unlock from lifetime coins
  owned: string[];                   // bought shop item ids
  equipped: Partial<Record<ItemKind, string>>;   // equipped item per kind (missing = the free default)
}
export const SAVE_VERSION = 2 as const;   // bump when the stored shape changes; add the step to MIGRATIONS below
const KEY = 'sna:v1';                       // stable localStorage slot (its `v1` is historical; `raw.v` drives migration)
const DEFAULT: SaveData = { v: SAVE_VERSION, name: '', avatar: null, year: 'reception', sound: true, speech: true, voice: 'unknown', progress: {}, endless: {}, sprint: {}, boss: {}, memory: {}, training: {}, coins: 0, stickers: [], streak: { last: '', days: 0 }, tutorialSeen: false, dojo: freshDojo(''), spent: 0, owned: [], equipped: {} };

// A raw blob read back from storage: JSON of unknown shape (any past version, or hand-edited). Migrations walk it.
type RawSave = Record<string, unknown>;
// Each step upgrades a v(n) blob to v(n+1). Empty while we are still on v1 — this is the seam a future shape
// change slots into (e.g. #26's per-mode `bests` record, or a Y3+ key change): the step drops the old keys and
// writes the new ones, instead of leaning on load()'s merge, which silently keeps stale keys across a reshape.
const MIGRATIONS: Record<number, (s: RawSave) => RawSave> = {
  // v1 → v2 (#65): the launch-to-launch TTS verdict. A blob that already carries a valid one (an e2e seed, a
  // save restored from a newer device) keeps it; anything else — absent, or a value outside the union — becomes
  // `unknown`, so the key never carries a verdict the detector could not have written.
  1: s => ({ ...s, voice: s.voice === 'yes' || s.voice === 'no' ? s.voice : 'unknown' }),
};

/**
 * Bring a raw stored blob up to the current SaveData shape. Drives off `raw.v`, not the key name, so a shape
 * change gets a real migration step rather than load() papering over it. Tolerant of hand-edited / corrupt data:
 * a non-object, or JSON that is not a save, falls back to a fresh default.
 */
/** The shape version a raw blob is in. A blob with no `v` predates versioning but shares the v1 shape, so it
 *  walks every migration from 1 — reading it as *current* would skip them all and hand a reshaping step stale keys. */
export const saveVersionOf = (s: RawSave): number => (typeof s.v === 'number' ? s.v : 1);
export function migrate(raw: unknown): SaveData {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ...DEFAULT };
  let s = raw as RawSave;
  let v = saveVersionOf(s);
  while (v < SAVE_VERSION && MIGRATIONS[v]) { s = MIGRATIONS[v](s); v++; }
  return { ...DEFAULT, ...s, v: SAVE_VERSION };           // fill any missing keys and stamp the current version
}

let cache: SaveData | null = null;
export function load(): SaveData {
  if (cache) return cache;
  try { const raw = localStorage.getItem(KEY); cache = raw ? migrate(JSON.parse(raw)) : { ...DEFAULT }; }
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

/**
 * The save as a code the grown-up can copy to another device (#64). Every APK the workflow builds is signed
 * with a fresh debug key, so an update has to be installed over an uninstall — which takes localStorage, and
 * the child's coins, stars and streak, with it. Until the signing key is stable this is the way progress
 * survives a reinstall, and it is the same code #20's profiles and #16's second player would move about.
 */
export function exportSave(): string { return JSON.stringify(load()); }

/**
 * Restore a save from an exported code, replacing what is on this device. Returns false and changes nothing
 * when the text is not one of our codes: a stray paste must not be able to wipe a child's progress, so the
 * blob has to carry a version we know how to read. A code from a newer build is refused too — migrations
 * only run forwards, so there is nothing to bring a v2 save down to v1.
 *
 * Deliberately not routed through save(), which merges a patch over the current save: restoring is a
 * replacement, and a merge would leave the old device's keys sitting under the new ones.
 */
export function importSave(text: string): boolean {
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { return false; }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false;
  const v = (raw as RawSave).v;
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 1 || v > SAVE_VERSION) return false;
  const next = migrate(raw);
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* private mode etc. */ }
  cache = next;
  return true;
}
