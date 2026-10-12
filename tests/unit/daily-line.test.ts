import { describe, expect, it } from 'vitest';
import { recordSprintOutcome } from '../../src/ui/results';
import { exportSave, importSave, reset } from '../../src/storage';
import { YEARS } from '../../src/curriculum';
import { dailyLine, dailyLineFor, forgetDailyLine, keepDailyLine } from '../../src/game/daily-line';

describe('Daily Sprint result line (#925)', () => {
  it('prints year, date, correct count and stars, exactly', () => {
    expect(dailyLine({ correct: 14, stars: 3 }, 'Year 1', '2026-09-28')).toBe('Sky Ninja Academy · Daily Sprint · Year 1 · 2026-09-28 · 14 correct · ⭐⭐⭐');
    expect(dailyLine({ correct: 0, stars: 0 }, 'Year 2', '2026-09-28')).toBe('Sky Ninja Academy · Daily Sprint · Year 2 · 2026-09-28 · 0 correct');
  });
  it('is kept per profile and day, and only in memory', () => {
    keepDailyLine('p1', '2026-09-28', 'line');
    expect(dailyLineFor('p1', '2026-09-28')).toBe('line');
    expect(dailyLineFor('p2', '2026-09-28')).toBeNull();
    expect(dailyLineFor('p1', '2026-09-29')).toBeNull();
  });
  it('shows one, two and three stars, and clamps above three', () => {
    for (const [stars, glyphs] of [[1, '⭐'], [2, '⭐⭐'], [3, '⭐⭐⭐'], [5, '⭐⭐⭐']] as const)
      expect(dailyLine({ correct: 4, stars }, 'Year 1', '2026-09-28')).toMatch(new RegExp(` · 4 correct · ${glyphs}$`));
  });
  it('forgetDailyLine drops the kept line (delete, reset and restore call it)', () => {
    keepDailyLine('p2', '2026-09-28', 'line');
    forgetDailyLine();
    expect(dailyLineFor('p2', '2026-09-28')).toBeNull();
  });
  it('only a daily Sprint keeps a line: recordSprintOutcome(..., daily) is the switch', () => {
    forgetDailyLine();
    const year = YEARS[1]; const today = new Date();
    recordSprintOutcome(year, undefined, { correct: 3, score: 30, stars: 1 }, true, false);
    expect(dailyLineFor('p1', `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`)).toBeNull();
    recordSprintOutcome(year, undefined, { correct: 3, score: 30, stars: 1 }, true, true);
    expect(dailyLineFor('p1', `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`)).toContain('3 correct');
  });
  it('a restore and a reset both forget the kept line (#925 review)', () => {
    keepDailyLine('p1', '2026-09-28', 'line');
    expect(importSave(exportSave())).toBe(true);
    expect(dailyLineFor('p1', '2026-09-28')).toBeNull();
    keepDailyLine('p1', '2026-09-28', 'line');
    reset();
    expect(dailyLineFor('p1', '2026-09-28')).toBeNull();
  });
});
