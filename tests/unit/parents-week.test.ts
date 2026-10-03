import { beforeEach, describe, expect, it } from 'vitest';
import { load, recordGameEnd, reset, today } from '../../src/storage';
import { logGame, type LogDay } from '../../src/save-records';
import { parentSummary, pct, progressText, summaryRoute, weekSummary } from '../../src/game/parents';
import { weekHTML } from '../../src/ui/parents-week';
import { listedTopics, shownYears, type Topic } from '../../src/curriculum';

const mem: Record<string, string> = {};
(globalThis as any).localStorage = { getItem: (k: string) => mem[k] ?? null, setItem: (k: string, v: string) => { mem[k] = v; }, removeItem: (k: string) => { delete mem[k]; }, clear: () => { for (const k in mem) delete mem[k]; } };

const at = (d: string) => new Date(`${d}T12:00:00`);   // local noon, so `today()` reads the same date
const game = (correct: number, attempts: number) => ({ mode: 'mission' as const, won: true, correct, attempts, bestCombo: 0, stars: 2, score: 50 });
const day = (date: string, q = 0, ok = 0, topics: string[] = []): LogDay => ({ date, games: 1, q, ok, topics });

describe('the day log written by recordGameEnd (#939)', () => {
  beforeEach(() => reset());
  it('two games today and one yesterday: today is bumped in place, yesterday is its own day', () => {
    recordGameEnd({ ...game(4, 5), topics: ['y1-bonds'] }, 0, at('2026-09-29'));
    recordGameEnd({ ...game(3, 5), topics: ['y1-bonds', 'y1-add'] }, 0, at('2026-09-30'));
    recordGameEnd({ ...game(5, 5), topics: ['y1-add'] }, 0, at('2026-09-30'));
    expect(load().log).toEqual([
      { date: '2026-09-29', games: 1, q: 5, ok: 4, topics: ['y1-bonds'] },
      { date: '2026-09-30', games: 2, q: 10, ok: 8, topics: ['y1-bonds', 'y1-add'] },
    ]);
  });
  it('Memory Match counts as a game but adds no questions', () => {
    recordGameEnd({ mode: 'memory', won: true, correct: 8, attempts: 12, bestCombo: 0, stars: 3, score: 80 }, 0, at('2026-09-30'));
    expect(load().log).toEqual([{ date: '2026-09-30', games: 1, q: 0, ok: 0, topics: [] }]);
  });
  it('never holds more than 30 days: the 31st drops the oldest', () => {
    for (let i = 1; i <= 31; i++) recordGameEnd(game(1, 1), 0, new Date(2026, 0, i, 12));
    const log = load().log;
    expect(log).toHaveLength(30);
    expect(log[0].date).toBe('2026-01-02'); expect(log[29].date).toBe('2026-01-31');
  });
  it('a finished game is still one storage write, now carrying the log too', () => {
    let writes = 0; const real = localStorage.setItem;
    (localStorage as any).setItem = (k: string, v: string) => { writes++; real.call(localStorage, k, v); };
    try { recordGameEnd({ ...game(2, 2), topics: ['y1-add'] }, 5, at('2026-09-30')); } finally { (localStorage as any).setItem = real; }
    expect(writes).toBe(1);
    expect(load().log[0].games).toBe(1);
  });
  it('a bad count (NaN, negative, fractional, ok above q) is clamped and never erases the day', () => {
    const log = logGame([day('2026-09-30', 2, 1, ['a'])], '2026-09-30', { q: NaN, ok: -3 });
    expect(log).toEqual([{ date: '2026-09-30', games: 2, q: 2, ok: 1, topics: ['a'] }]);
    expect(logGame([], '2026-09-30', { q: 2.7, ok: 9 })[0]).toMatchObject({ q: 2, ok: 2 });
  });
  it('logGame does not mutate the log it is given', () => {
    const before = [day('2026-09-30', 2, 1, ['a'])]; const copy = JSON.parse(JSON.stringify(before));
    logGame(before, '2026-09-30', { q: 1, ok: 1, topics: ['b'] });
    expect(before).toEqual(copy);
  });
});

describe('weekSummary (#939)', () => {
  const TODAY = '2026-09-30';
  it('counts the seven local days ending today: day 7 is in, day 8 is out', () => {
    const w = weekSummary([day('2026-09-23', 10, 10), day('2026-09-24', 10, 5), day(TODAY, 10, 10)], TODAY);
    expect(w.days).toBe(2);                    // 09-23 is 7 days back: out; 09-24 is the 7th day: in
    expect(w.questions).toBe(20); expect(pct(w.accuracy)).toBe(75);
  });
  it('is empty with an empty log: no days, no NaN, accuracy null', () => {
    expect(weekSummary([], TODAY)).toEqual({ days: 0, questions: 0, accuracy: null, topics: [] });
  });
  it('accuracy is null at 0 questions even with a game played (Memory only)', () => {
    const w = weekSummary([day(TODAY)], TODAY);
    expect(w.days).toBe(1); expect(w.accuracy).toBeNull();
  });
  it('crosses a month boundary and lists distinct topics once', () => {
    const w = weekSummary([day('2026-09-28', 1, 1, ['a', 'b']), day('2026-10-02', 1, 1, ['b', 'c'])], '2026-10-02');
    expect(w.days).toBe(2); expect(w.topics).toEqual(['a', 'b', 'c']);
  });
  it('ignores a future-dated entry left by a clock set backwards', () => {
    expect(weekSummary([day('2026-10-05', 3, 3)], TODAY).days).toBe(0);
  });
  it('agrees with today(): a game logged today is in the week', () => {
    expect(weekSummary([day(today(), 1, 1)], today()).days).toBe(1);
  });
});

describe('weekHTML (#939)', () => {
  const topics = Array.from({ length: 8 }, (_, i) => ({ id: `t${i}`, title: `Topic ${i}` }) as Topic);
  it('says so with no play this week, with no NaN and no dash-percent', () => {
    const html = weekHTML(weekSummary([], '2026-09-30'), topics);
    expect(html).toContain('0/7'); expect(html).toContain('No play yet this week.');
    expect(html).not.toMatch(/NaN|—%/);
  });
  it('shows the tiles and lists at most six topic names, then "+N more"', () => {
    const html = weekHTML({ days: 2, questions: 12, accuracy: 0.75, topics: topics.map(t => t.id) }, topics);
    expect(html).toContain('2/7'); expect(html).toContain('75%');
    expect(html).toContain('Topic 5'); expect(html).not.toContain('Topic 6'); expect(html).toContain('+2 more');
  });
});

describe('progressText and summaryRoute (#942)', () => {
  beforeEach(() => reset());
  const sm = (log: LogDay[] = []) => { const d = load(); d.log = log; return parentSummary(d, listedTopics(), shownYears(), 0, new Date('2026-10-03T12:00:00')); };
  const now = new Date('2026-10-03T12:00:00');

  it('an empty save has no NaN, undefined or a dash percentage, and a nameless child is "your ninja"', () => {
    const t = progressText(sm(), '', now);
    expect(t).toContain('progress for your ninja, 3 October 2026');
    expect(t).toContain('This week: no play yet.');
    expect(t).not.toMatch(/NaN|undefined|—%|-%/);
    expect(t.split('\n')).toHaveLength(5);
  });
  it('a played week quotes days, questions and accuracy; stars come per island; no save code leaks', () => {
    const d = load(); d.progress['y1-add'] = { plays: 3, stars: 3, hits: 9, tries: 10, best: 50 };
    const s = parentSummary({ ...d, log: [day('2026-10-02', 10, 8, ['y1-add'])] }, listedTopics(), shownYears(), 0, now);
    const t = progressText(s, 'Mia', now);
    expect(t).toContain('progress for Mia, 3 October 2026');
    expect(t).toContain('This week: 1/7 days played, 10 questions, 80% right.');
    expect(t).toMatch(/Stars: .*\d+\/\d+ · /);
    expect(t.length).toBeLessThan(700);
  });
  it('summaryRoute truth table: share sheet, then the APK, then the clipboard, then by hand', () => {
    const r = (webShare: boolean, capacitorShare: boolean, clipboard: boolean) => summaryRoute({ webShare, capacitorShare, clipboard });
    expect([r(true, true, true), r(false, true, true), r(false, false, true), r(false, false, false), r(true, false, false)])
      .toEqual(['share', 'capacitor', 'copy', 'select', 'share']);
  });
});
