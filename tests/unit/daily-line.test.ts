import { describe, expect, it } from 'vitest';
import { dailyLine, dailyLineFor, keepDailyLine } from '../../src/game/daily-line';

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
});
