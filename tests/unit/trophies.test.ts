// #912: topic trophies from the per-topic Sprint best.
import { describe, expect, it } from 'vitest';
import { YEARS } from '../../src/curriculum';
import { MODES } from '../../src/game/modes';
import { raisesTrophy, trophyFor } from '../../src/game/trophies';
import { resultMedal, resultsLines, trophyCandidate } from '../../src/ui/results';

const topic = { id: 'y1-bonds', title: 'Number Bonds' } as never;

describe('trophyFor', () => {
  for (const y of YEARS) {
    const { threeStar, twoStar } = y.sprintStars;
    it(`${y.id}: tiers at the threshold edges`, () => {
      expect(trophyFor(0, y)).toBeNull();
      expect(trophyFor(1, y)).toBe('🥉');
      expect(trophyFor(twoStar - 1, y)).toBe('🥉');
      expect(trophyFor(twoStar, y)).toBe('🥈');
      expect(trophyFor(threeStar - 1, y)).toBe('🥈');
      expect(trophyFor(threeStar, y)).toBe('🥇');
    });
    it(`${y.id}: agrees with the Sprint medal at every correct count 0–20`, () => {
      for (let c = 0; c <= 20; c++) {
        const stars = MODES.sprint.stars({ correct: c, year: y } as never);
        const medal = resultMedal({ mode: 'sprint', won: true, score: 0, stars });
        expect(trophyFor(c, y) ?? '💪').toBe(medal);
      }
    });
  }
});

describe('trophy announcement', () => {
  const y1 = YEARS.find(y => y.id === 'year1')!;
  it('appears only when the tier rises', () => {
    expect(raisesTrophy(0, 1, y1)).toBe(true);
    expect(raisesTrophy(1, 5, y1)).toBe(false);   // still bronze
    expect(raisesTrophy(5, 6, y1)).toBe(true);    // bronze → silver
    expect(trophyCandidate(topic, y1, 7, 9)).toBeNull();
    expect(trophyCandidate(topic, y1, 0, 0)).toBeNull();
  });
  it('is shown with the emoji and spoken with the metal', () => {
    expect(trophyCandidate(topic, y1, 1, 6)).toEqual({
      kind: 'trophy', text: 'New trophy: 🥈 Number Bonds!', spoken: 'New silver trophy for Number Bonds!',
    });
  });
  it('outranks a plain best line in resultsLines', () => {
    const c = trophyCandidate(topic, y1, 0, 12)!;
    expect(resultsLines([{ kind: 'best', text: 'b' }, { kind: 'rest', text: 'r' }, c])[0]).toBe(c);
  });
});
