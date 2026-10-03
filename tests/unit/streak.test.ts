import { describe, expect, it } from 'vitest';
import { missedDays, nextStreak } from '../../src/game/streak';
import { applyEvent, carriedStreak, dailyChallenges, multiplier, type DojoState } from '../../src/game/dojo';
import { touchStreak } from '../../src/storage';
import { ACHIEVEMENTS } from '../../src/storage/stickers';

const play = (s: ReturnType<typeof nextStreak>, ...days: string[]) => days.reduce(nextStreak, s);
const mem: Record<string, string> = {};
(globalThis as any).localStorage = { getItem: (k: string) => mem[k] ?? null, setItem: (k: string, v: string) => { mem[k] = v; }, removeItem: (k: string) => { delete mem[k]; }, clear: () => { for (const k in mem) delete mem[k]; } };
const none = { last: '', days: 0 };

describe('nextStreak (#950)', () => {
  it('same day unchanged; yesterday +1', () => {
    expect(nextStreak({ last: '2026-09-07', days: 3 }, '2026-09-07')).toEqual({ last: '2026-09-07', days: 3 });
    expect(nextStreak({ last: '2026-09-06', days: 3 }, '2026-09-07')).toEqual({ last: '2026-09-07', days: 4 });
    expect(nextStreak(none, '2026-09-07').days).toBe(1);
  });
  it('one missed day is held: rest recorded, days +1 for the play only', () => {
    expect(nextStreak({ last: '2026-09-07', days: 2 }, '2026-09-09')).toEqual({ last: '2026-09-09', days: 3, rest: '2026-09-08' });
  });
  it('a second missed day inside seven days of a rest resets to 1', () => {
    const s = { last: '2026-09-09', days: 3, rest: '2026-09-08' };
    expect(nextStreak(s, '2026-09-11').days).toBe(1);
    expect(nextStreak(s, '2026-09-11').rest).toBe('2026-09-08');
  });
  it('a missed day 7+ days after the last rest is forgiven; 6 is not', () => {
    expect(nextStreak({ last: '2026-09-14', days: 5, rest: '2026-09-08' }, '2026-09-16').days).toBe(6);
    expect(nextStreak({ last: '2026-09-13', days: 5, rest: '2026-09-08' }, '2026-09-15').days).toBe(1);
  });
  it('two or more missed days reset', () => { expect(nextStreak({ last: '2026-09-07', days: 9 }, '2026-09-10').days).toBe(1); });
  it('Mon, Tue, rest Wed, Thu gives 3 and earns frost; 7 played days bridged by a rest earn sol', () => {
    const thu = play(none, '2026-09-07', '2026-09-08', '2026-09-10');
    expect(thu.days).toBe(3);
    const frost = ACHIEVEMENTS.find(x => x.id === 'frost')!, sol = ACHIEVEMENTS.find(x => x.id === 'sol')!;
    const data = (days: number) => ({ streak: { last: '', days } }) as never;
    expect(frost.progress(data(thu.days)).done).toBe(3);
    const wk = play(none, '2026-09-07', '2026-09-08', '2026-09-09', '2026-09-11', '2026-09-12', '2026-09-13', '2026-09-14', '2026-09-15');
    expect(wk.days).toBe(8);
    expect(sol.progress(data(wk.days)).done).toBe(7);
  });
  it('works across month and year ends', () => { expect(nextStreak({ last: '2026-12-30', days: 1 }, '2027-01-01')).toEqual({ last: '2027-01-01', days: 2, rest: '2026-12-31' }); });
  it('touchStreak saves the rest day', () => {
    localStorage.clear();
    touchStreak(new Date(2026, 8, 7, 12)); touchStreak(new Date(2026, 8, 9, 12));
    expect(JSON.parse(localStorage.getItem('sna:v1')!).streak).toEqual({ last: '2026-09-09', days: 2, rest: '2026-09-08' });
  });
});

const dojo = (last: string, days: number): DojoState => ({ date: '2026-09-20', progress: {}, done: [], setDone: false, streak: { last, days }, total: 0 });
describe('Dojo carried streak (#950)', () => {
  it('missedDays', () => { expect([missedDays('2026-09-19', '2026-09-20'), missedDays('2026-09-18', '2026-09-20'), missedDays('', '2026-09-20')]).toEqual([0, 1, 0]); });
  it.each([[2, 0, 2], [2, 1, 1], [2, 2, 0], [2, 5, 0], [4, 1, 3], [4, 2, 2], [10, 0, 10], [10, 1, 3], [10, 5, 0]])('days %i, %i missed → carried %i', (days, missed, want) => {
    const last = new Date(Date.parse('2026-09-19T12:00:00Z') - missed * 86_400_000).toISOString().slice(0, 10);
    expect(carriedStreak(dojo(last, days), '2026-09-20')).toBe(want);
  });
  it('one missed day steps ×2 to ×1.75 and the multiplier is never below ×1', () => {
    expect(multiplier(carriedStreak(dojo('2026-09-18', 4), '2026-09-20'))).toBe(1.75);
    expect(multiplier(carriedStreak(dojo('2026-09-01', 4), '2026-09-20'))).toBe(1);
  });
  it('a finished set after one missed day from 10 days stores days = 4', () => {
    const s = { ...dojo('2026-09-18', 10), done: dailyChallenges('2026-09-20').map(c => c.id) };
    const out = applyEvent(s, { mode: 'mission', won: false, correct: 0, attempts: 0, stars: 0, bestCombo: 0, score: 0 } as never, '2026-09-20');
    expect(out.setDone).toBe(true);
    expect(out.state.streak).toEqual({ last: '2026-09-20', days: 4 });
  });
});
