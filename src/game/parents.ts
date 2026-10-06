// Parent dashboard: a read-only summary of a child's progress, behind a grown-ups gate.
// Pure logic (no DOM) so it can be unit-tested. Reads only what storage.ts already records.
import type { Rng, Topic, YearId, YearInfo } from '../curriculum';
import { numberWord } from '../curriculum/util';
import type { SaveData, TopicProgress } from '../storage';
import { safeRecord, today } from '../storage';
import type { LogDay } from '../save-records';
import { accuracy } from './sensei';
import { beltFor } from './belts';
import { leastSecure } from '../fact-record';

// ---------- Grown-ups gate ----------
// A times-table question a Reception/Year-1 child cannot do yet, but any grown-up answers at a glance.
export interface Gate { a: number; b: number; prompt: string; answer: number }
// Once a KS2 island is shown (#1053) the facts are 13–99 products in words: Year 4 is tested on 6–12 tables.
export function gateChallenge(rng: Rng, ks2Shown = false): Gate {
  if (ks2Shown) {
    const a = 13 + Math.floor(rng() * 87), b = 13 + Math.floor(rng() * 87);   // 13–99
    return { a, b, prompt: `${numberWord(a)} times ${numberWord(b)}`, answer: a * b };
  }
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
  nc: string;   // the curriculum statement in words (#944)
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
  starsEarned: number; belt: string; starsMax: number; topicsTried: number; topicsTotal: number;
  years: YearStat[];
  weakest: TopicStat[]; strongest: TopicStat[];
  modes: ModeBest[];
  streakDays: number; coins: number; stickers: number; stickersTotal: number;
  slips: SlipRow[];
  week: WeekSummary;
  /** The "Facts to practise" lines (#1123); null when no × answer is recorded, so the section stays hidden. */
  facts: string[] | null;
}
/** The last seven local days of play (#939), read from the day log. `accuracy` is null with no questions. */
export interface WeekSummary { days: number; questions: number; accuracy: number | null; topics: string[] }
/** Seven local days ending `day` (`YYYY-MM-DD`): days played, questions, accuracy and the distinct topic ids. */
export function weekSummary(log: readonly LogDay[], day: string): WeekSummary {
  const [y, m, d] = day.split('-').map(Number), from = today(new Date(y, m - 1, d - 6));
  const inWeek = (Array.isArray(log) ? log : []).filter(l => l.date >= from && l.date <= day);
  const questions = inWeek.reduce((n, l) => n + l.q, 0), ok = inWeek.reduce((n, l) => n + l.ok, 0);
  return { days: inWeek.length, questions, accuracy: questions ? ok / questions : null, topics: [...new Set(inWeek.flatMap(l => l.topics))] };
}
/** One row of the "Recent slips" list (#938): a stored `Slip` (#903) with its topic resolved to an icon. */
export interface SlipRow { icon: string; prompt: string; answer: string; picked: string; at: string }
/**
 * The last 20 wrong answers, newest first (`data.slips` is already stored that way — #903), for grown-ups.
 * A slip whose topic id no longer exists in the registry (a removed or renamed topic) is dropped rather than
 * shown with no icon, since nothing here can throw on a hand-edited or `Restore`-pasted save (#95's rule).
 */
export function recentSlips(data: SaveData, topics: Topic[]): SlipRow[] {
  const byId = new Map(topics.map(t => [t.id, t]));
  const rows: SlipRow[] = [];
  for (const s of data.slips) {
    const t = byId.get(s.topic); if (!t) continue;
    rows.push({ icon: t.icon, prompt: s.prompt, answer: s.answer, picked: s.picked, at: s.at });
  }
  return rows;
}

/** Only topics a child has actually answered enough of for the accuracy to mean something rank against each other. */
export const RANK_MIN_TRIES = 5;

/** A topic's `nc` reference with its four abbreviated prefixes spelled out for a grown-up (#944); the rest is untouched. */
export const ncForGrownUps = (nc: string): string => nc
  .replace(/\bA&S\b/g, 'Addition and subtraction').replace(/\bNPV\b/g, 'Number and place value')
  .replace(/\bM&D\b/g, 'Multiplication and division').replace(/\bELG\b/g, 'Early learning goal');

function stat(t: Topic, p: TopicProgress | undefined): TopicStat {
  return {
    id: t.id, title: t.title, icon: t.icon, year: t.year, subject: t.subject,
    stars: p?.stars ?? 0, plays: p?.plays ?? 0, hits: p?.hits ?? 0, tries: p?.tries ?? 0,
    accuracy: accuracy(p), nc: ncForGrownUps(t.nc),
  };
}

/** Build the whole read-only dashboard model from the save. `stickersTotal` is passed in so storage stays the source of the album size. */
export function parentSummary(data: SaveData, topics: Topic[], years: YearInfo[], stickersTotal: number, now = new Date()): ParentSummary {
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
    starsEarned: sum(stats.map(s => s.stars)), belt: beltFor(sum(stats.map(s => s.stars))).name, starsMax: stats.length * 3,
    topicsTried: stats.filter(s => s.plays > 0).length, topicsTotal: stats.length,
    years: years_,
    weakest: [...ranked].sort(byAcc).slice(0, 4),
    strongest: [...ranked].sort((a, b) => byAcc(b, a)).slice(0, 4),
    modes,
    streakDays: data.streak.days, coins: data.coins, stickers: data.stickers.length, stickersTotal,
    slips: recentSlips(data, topics),
    week: weekSummary(data.log, today(now)),
    facts: factsToPractise(data),
  };
}

/** The grown-ups "Facts to practise" lines (#1123), e.g. `9 × 6 and 6 × 9`; null when no times-table answer is recorded. */
export function factsToPractise(data: SaveData): string[] | null {
  const facts = data.ks2?.facts ?? {};
  if (!Object.keys(facts).length) return null;
  return leastSecure(facts).map(l => l.map(f => f.replace('×', ' × ')).join(' and '));
}

/** Whole-number percent for display (null → em dash handled by the caller). */
export const pct = (x: number | null): number | null => (x === null ? null : Math.round(x * 100));

// ---------- Progress text for sharing (#942) ----------
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const titles = (ts: readonly TopicStat[]) => ts.map(t => t.title).join(', ');
/**
 * A short plain-text progress note a grown-up can paste into a reading record, an email or a school app. Only
 * the child's name, the date, the week figures, stars per island and topic titles — no save code, no device data.
 * An empty save reads sensibly: no accuracy is quoted without questions and no list is left blank.
 */
export function progressText(sm: ParentSummary, name: string, now: Date = new Date()): string {
  const w = sm.week, who = name.trim() || 'your ninja';
  const week = w.days
    ? `This week: ${w.days}/7 days played, ${w.questions} questions${w.accuracy === null ? '' : `, ${pct(w.accuracy)}% right`}.`
    : 'This week: no play yet.';
  return [
    `Sky Ninja Academy — progress for ${who}, ${now.getDate()} ${MONTHS[now.getMonth()]} ${now.getFullYear()}`,
    week,
    `Stars: ${sm.years.map(y => `${y.title} ${y.stars}/${y.maxStars}`).join(' · ')} (${sm.starsEarned}/${sm.starsMax} in all)`,
    `Going well: ${sm.strongest.length ? titles(sm.strongest) : 'not enough play yet'}`,
    `Where to help: ${sm.weakest.length ? titles(sm.weakest) : 'not enough play yet'}`,
  ].join('\n');
}
/** How the summary leaves the device: the browser's share sheet, the APK's, the clipboard, else selected for copying by hand. */
export type SummaryRoute = 'share' | 'capacitor' | 'copy' | 'select';
export function summaryRoute(caps: { webShare: boolean; capacitorShare: boolean; clipboard: boolean }): SummaryRoute {
  if (caps.webShare) return 'share';
  if (caps.capacitorShare) return 'capacitor';
  return caps.clipboard ? 'copy' : 'select';
}
