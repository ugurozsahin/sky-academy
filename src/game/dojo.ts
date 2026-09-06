// Daily Dojo: three challenges a day, picked deterministically from the date, with bonus coins and a
// streak multiplier for finishing the whole set on consecutive days. Pure logic (no DOM, no storage).
export type DojoGroup = 'volume' | 'mode' | 'focus';
export interface Challenge { id: string; group: DojoGroup; icon: string; title: string; goal: number; bonus: number }
/** What one finished game tells the dojo (built by the results screens). */
export interface DojoEvent {
  mode: 'mission' | 'endless' | 'sprint' | 'boss' | 'memory';
  won: boolean; correct: number; attempts: number; bestCombo: number; stars: number; score: number;
  training?: boolean;              // Sensei session (a mission over a pool)
  mathsCorrect?: number; writingCorrect?: number;   // per-subject hits (from the session's per-topic tally)
}
export interface DojoState {
  date: string;                    // ISO day these challenges/progress belong to
  progress: Record<string, number>;
  done: string[];                  // challenge ids completed today (bonus already paid)
  setDone: boolean;                // all three finished today (set bonus paid)
  streak: { last: string; days: number };   // consecutive days the whole set was finished
  total: number;                   // lifetime challenges completed
}

export const CHALLENGE_BONUS = 10;
export const SET_BONUS = 25;
const POOL: Challenge[] = [
  { id: 'correct15', group: 'volume', icon: '🎯', title: 'Answer 15 questions right', goal: 15, bonus: CHALLENGE_BONUS },
  { id: 'correct20', group: 'volume', icon: '🎯', title: 'Answer 20 questions right', goal: 20, bonus: CHALLENGE_BONUS },
  { id: 'correct25', group: 'volume', icon: '🎯', title: 'Answer 25 questions right', goal: 25, bonus: CHALLENGE_BONUS },
  { id: 'mission2', group: 'mode', icon: '🏁', title: 'Complete 2 missions', goal: 2, bonus: CHALLENGE_BONUS },
  { id: 'sprint1', group: 'mode', icon: '⏱️', title: 'Play a Ninja Sprint', goal: 1, bonus: CHALLENGE_BONUS },
  { id: 'boss1', group: 'mode', icon: '🥊', title: 'Knock out Hammer Man', goal: 1, bonus: CHALLENGE_BONUS },
  { id: 'storm80', group: 'mode', icon: '⛈️', title: 'Score 80 in Sky Storm', goal: 80, bonus: CHALLENGE_BONUS },
  { id: 'memory1', group: 'mode', icon: '🃏', title: 'Finish a Memory Match board', goal: 1, bonus: CHALLENGE_BONUS },
  { id: 'sensei1', group: 'mode', icon: '🥋', title: 'Train with Sensei', goal: 1, bonus: CHALLENGE_BONUS },
  { id: 'combo5', group: 'focus', icon: '🔥', title: 'Get a 5-slice combo', goal: 5, bonus: CHALLENGE_BONUS },
  { id: 'stars3', group: 'focus', icon: '⭐', title: 'Earn 3 stars in a mission', goal: 1, bonus: CHALLENGE_BONUS },
  { id: 'perfect', group: 'focus', icon: '💎', title: 'Finish a mission with no slips', goal: 1, bonus: CHALLENGE_BONUS },
  { id: 'writing6', group: 'focus', icon: '✍️', title: 'Get 6 writing answers right', goal: 6, bonus: CHALLENGE_BONUS },
  { id: 'maths10', group: 'focus', icon: '🔢', title: 'Get 10 maths answers right', goal: 10, bonus: CHALLENGE_BONUS },
];
export const challengeById = (id: string) => POOL.find(c => c.id === id);

/** Small string hash → deterministic rng for a given day. */
function seeded(seed: string) {
  let h = 2166136261; for (const ch of seed) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
}
/** Today's three challenges: one per group (volume · mode · focus), the same for every island. */
export function dailyChallenges(date: string): Challenge[] {
  const rng = seeded(`dojo:${date}`);
  return (['volume', 'mode', 'focus'] as DojoGroup[]).map(g => { const c = POOL.filter(x => x.group === g); return c[Math.floor(rng() * c.length)]; });
}
export const freshDojo = (date: string, prev?: DojoState): DojoState => ({ date, progress: {}, done: [], setDone: false, streak: prev?.streak ?? { last: '', days: 0 }, total: prev?.total ?? 0 });
/** Roll the state over to `date` when the day has changed (streak/total survive; progress resets). */
export const dojoFor = (s: DojoState, date: string): DojoState => (s.date === date ? s : freshDojo(date, s));

const yesterdayOf = (date: string) => { const d = new Date(date + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().slice(0, 10); };
/** Consecutive days the set was finished *before* `date` (the streak carried into today). */
export function carriedStreak(s: DojoState, date: string): number {
  if (s.streak.last === date) return Math.max(0, s.streak.days - 1);
  return s.streak.last === yesterdayOf(date) ? s.streak.days : 0;
}
/** Streak multiplier for today's bonuses: ×1, then +0.25 per carried day up to ×2. */
export const multiplier = (carried: number) => 1 + 0.25 * Math.min(4, carried);

/** How far one event moves a challenge (absolute progress, never below the current value). */
function measure(c: Challenge, cur: number, e: DojoEvent): number {
  const mission = e.mode === 'mission' && !e.training;
  switch (c.id) {
    case 'correct15': case 'correct20': case 'correct25': return cur + e.correct;
    case 'mission2': return cur + (mission && e.won ? 1 : 0);
    case 'sprint1': return cur + (e.mode === 'sprint' ? 1 : 0);
    case 'boss1': return cur + (e.mode === 'boss' && e.won ? 1 : 0);
    case 'storm80': return e.mode === 'endless' ? Math.max(cur, e.score) : cur;
    case 'memory1': return cur + (e.mode === 'memory' ? 1 : 0);
    case 'sensei1': return cur + (e.mode === 'mission' && e.training && e.won ? 1 : 0);
    case 'combo5': return Math.max(cur, e.bestCombo);
    case 'stars3': return cur + (mission && e.won && e.stars === 3 ? 1 : 0);
    case 'perfect': return cur + (mission && e.won && e.attempts > 0 && e.correct === e.attempts ? 1 : 0);
    case 'writing6': return cur + (e.writingCorrect ?? 0);
    case 'maths10': return cur + (e.mathsCorrect ?? 0);
  }
  return cur;
}
export interface DojoOutcome { state: DojoState; completed: Challenge[]; setDone: boolean; coins: number; multiplier: number }
/** Apply a finished game to the day's state. Returns the new state, what was just completed and the bonus coins earned. */
export function applyEvent(prev: DojoState, e: DojoEvent, date: string): DojoOutcome {
  const s = dojoFor(prev, date); const cs = dailyChallenges(date);
  const mult = multiplier(carriedStreak(s, date));
  const progress = { ...s.progress }; const done = [...s.done]; const completed: Challenge[] = [];
  for (const c of cs) {
    progress[c.id] = Math.min(c.goal, measure(c, progress[c.id] ?? 0, e));
    if (progress[c.id] >= c.goal && !done.includes(c.id)) { done.push(c.id); completed.push(c); }
  }
  const setDone = !s.setDone && cs.every(c => done.includes(c.id));
  const coins = Math.floor((completed.length * CHALLENGE_BONUS + (setDone ? SET_BONUS : 0)) * mult);
  const streak = setDone ? { last: date, days: carriedStreak(s, date) + 1 } : s.streak;
  return { state: { ...s, progress, done, setDone: s.setDone || setDone, streak, total: s.total + completed.length }, completed, setDone, coins, multiplier: mult };
}
