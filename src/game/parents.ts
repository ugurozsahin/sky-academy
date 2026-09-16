// Parent dashboard: a read-only summary of a child's progress, behind a grown-ups gate.
// Pure logic (no DOM) so it can be unit-tested. Reads only what storage.ts already records.
import type { Rng, Topic, YearId, YearInfo } from '../curriculum';
import type { SaveData, TopicProgress } from '../storage';
import { safeRecord } from '../storage';
import { accuracy } from './sensei';

// ---------- Grown-ups gate ----------
// A times-table question a Reception/Year-1 child cannot do yet, but any grown-up answers at a glance.
export interface Gate { a: number; b: number; prompt: string; answer: number }
export function gateChallenge(rng: Rng): Gate {
  const a = 6 + Math.floor(rng() * 4);   // 6–9
  const b = 6 + Math.floor(rng() * 4);   // 6–9
  return { a, b, prompt: `${a} × ${b}`, answer: a * b };
}
/** True when the typed text is exactly the answer (ignores surrounding spaces; anything non-numeric fails). */
export function checkGate(input: string, answer: number): boolean {
  const t = input.trim();
  if (!/^-?\d+$/.test(t)) return false;
  return Number(t) === answer;
}

// ---------- Progress summary ----------
export interface TopicStat {
  id: string; title: string; icon: string; year: YearId; subject: Topic['subject'];
  stars: number; plays: number; hits: number; tries: number; accuracy: number | null;
}
export interface YearStat {
  id: YearId; title: string;
  stars: number; maxStars: number; answered: number; correct: number; accuracy: number | null;
  topicsTried: number; topicsTotal: number;
}
export interface ModeBest {
  id: YearId; title: string;
  endless: number; sprint: number; boss: number; memory: number; training: number;
}
export interface ParentSummary {
  totalAnswered: number; totalCorrect: number; overallAccuracy: number | null;
  starsEarned: number; starsMax: number; topicsTried: number; topicsTotal: number;
  years: YearStat[];
  weakest: TopicStat[]; strongest: TopicStat[];
  modes: ModeBest[];
  streakDays: number; coins: number; stickers: number; stickersTotal: number;
}

/** Only topics a child has actually answered enough of for the accuracy to mean something rank against each other. */
export const RANK_MIN_TRIES = 5;

function stat(t: Topic, p: TopicProgress | undefined): TopicStat {
  return {
    id: t.id, title: t.title, icon: t.icon, year: t.year, subject: t.subject,
    stars: p?.stars ?? 0, plays: p?.plays ?? 0, hits: p?.hits ?? 0, tries: p?.tries ?? 0,
    accuracy: accuracy(p),
  };
}

/** Build the whole read-only dashboard model from the save. `stickersTotal` is passed in so storage stays the source of the album size. */
export function parentSummary(data: SaveData, topics: Topic[], years: YearInfo[], stickersTotal: number): ParentSummary {
  // #95: `data` can be a hand-edited or corrupted "Restore" paste — importSave() only checks the version, so
  // any of these fields can arrive as anything. Read the same tolerant way storage.ts's own achievement
  // calculations already do, rather than indexing `data.progress` directly and throwing on the dashboard.
  const progress = safeRecord<TopicProgress>(data.progress);
  const endless = safeRecord<number>(data.endless), sprint = safeRecord<number>(data.sprint);
  const boss = safeRecord<number>(data.boss), memory = safeRecord<number>(data.memory), training = safeRecord<number>(data.training);
  const stats = topics.map(t => stat(t, progress[t.id]));
  const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
  const acc = (correct: number, answered: number) => (answered > 0 ? correct / answered : null);

  const years_: YearStat[] = years.map(y => {
    const ts = stats.filter(s => s.year === y.id);
    const answered = sum(ts.map(s => s.tries)), correct = sum(ts.map(s => s.hits));
    return {
      id: y.id, title: y.title,
      stars: sum(ts.map(s => s.stars)), maxStars: ts.length * 3,
      answered, correct, accuracy: acc(correct, answered),
      topicsTried: ts.filter(s => s.plays > 0).length, topicsTotal: ts.length,
    };
  });

  const totalAnswered = sum(stats.map(s => s.tries)), totalCorrect = sum(stats.map(s => s.hits));
  const ranked = stats.filter(s => s.tries >= RANK_MIN_TRIES && s.accuracy !== null);
  const byAcc = (a: TopicStat, b: TopicStat) => (a.accuracy! - b.accuracy!) || (a.tries - b.tries);

  const modes: ModeBest[] = years.map(y => ({
    id: y.id, title: y.title,
    endless: endless[y.id] ?? 0, sprint: sprint[y.id] ?? 0,
    boss: boss[y.id] ?? 0, memory: memory[y.id] ?? 0, training: training[y.id] ?? 0,
  }));

  return {
    totalAnswered, totalCorrect, overallAccuracy: acc(totalCorrect, totalAnswered),
    starsEarned: sum(stats.map(s => s.stars)), starsMax: stats.length * 3,
    topicsTried: stats.filter(s => s.plays > 0).length, topicsTotal: stats.length,
    years: years_,
    weakest: [...ranked].sort(byAcc).slice(0, 4),
    strongest: [...ranked].sort((a, b) => byAcc(b, a)).slice(0, 4),
    modes,
    streakDays: data.streak.days, coins: data.coins, stickers: data.stickers.length, stickersTotal,
  };
}

/** Whole-number percent for display (null → em dash handled by the caller). */
export const pct = (x: number | null): number | null => (x === null ? null : Math.round(x * 100));
