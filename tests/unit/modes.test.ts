import { describe, expect, it } from 'vitest';
import { MODES, type Mode, type ModeCtx, type EndCtx } from '../../src/game/modes';
import { YEARS } from '../../src/curriculum';

const Y1 = YEARS[1];
const ALL: Mode[] = ['mission', 'endless', 'sprint', 'boss'];
const ctx = (o: Partial<ModeCtx> = {}): ModeCtx => ({ year: Y1, stage: 1, questionsAsked: 0, sequence: false, enraged: false, ...o });
const endCtx = (o: Partial<EndCtx> = {}): EndCtx => ({ won: false, score: 0, correct: 0, accuracy: 0, stageStarsTotal: 0, stages: 5, stars: 0, ...o });

describe('mode table', () => {
  it('every mode has an entry whose id matches its key', () => {
    for (const m of ALL) { expect(MODES[m], m).toBeDefined(); expect(MODES[m].id).toBe(m); }
  });
  it('lives / staged / timed / boss / villain flags match each mode', () => {
    expect(MODES.sprint.hasLives).toBe(false);                                   // a slip only costs time
    for (const m of ['mission', 'endless', 'boss'] as Mode[]) expect(MODES[m].hasLives).toBe(true);
    expect(ALL.filter(m => MODES[m].staged)).toEqual(['mission']);               // only missions have five staged waves
    expect(ALL.filter(m => MODES[m].timed)).toEqual(['sprint']);
    expect(ALL.filter(m => MODES[m].boss)).toEqual(['boss']);
    expect(ALL.filter(m => MODES[m].villain)).toEqual(['endless', 'boss']);      // Hammer Man + TNT
  });
  it('difficulty and speed ramp within 1..3', () => {
    for (const m of ALL) for (const q of [0, 5, 12, 25, 40]) {
      const d = MODES[m].difficulty(ctx({ questionsAsked: q, stage: Math.min(5, 1 + (q / 8 | 0)) }));
      expect(d, `${m} d@${q}`).toBeGreaterThanOrEqual(1); expect(d).toBeLessThanOrEqual(3);
      const s = MODES[m].speed(ctx({ questionsAsked: q, stage: Math.min(5, 1 + (q / 8 | 0)) }));
      expect(s, `${m} s@${q}`).toBeGreaterThanOrEqual(1); expect(s).toBeLessThanOrEqual(3);
    }
  });
  it('a sequence question is never faster than the same non-sequence one', () => {
    for (const m of ALL) {
      const plain = MODES[m].speed(ctx({ sequence: false, questionsAsked: 20 }));
      const seq = MODES[m].speed(ctx({ sequence: true, questionsAsked: 20 }));
      expect(seq, m).toBeLessThanOrEqual(plain);
    }
  });
  it('boss fights faster only when enraged', () => {
    expect(MODES.boss.speed(ctx({ enraged: true }))).toBeGreaterThanOrEqual(MODES.boss.speed(ctx({ enraged: false })));
  });
  it('coins read back the stars just computed (sprint / boss award +5 per star)', () => {
    const e = endCtx({ won: true, correct: 12, accuracy: 1 });
    const sStars = MODES.sprint.stars(e);                                        // 12 correct -> 3 stars
    expect(sStars).toBe(3);
    expect(MODES.sprint.coins({ ...e, stars: sStars })).toBe(12 + 3 * 5);        // 1/correct + 5/star, no stage stars
    const bStars = MODES.boss.stars(e);                                          // won, 100% -> 3 stars
    expect(MODES.boss.coins({ ...e, stars: bStars })).toBe(12 + 20 + 3 * 5);     // + KO bonus
  });
  it('a completed mission awards 1/correct + 5 per stage star + 20', () => {
    const e = endCtx({ won: true, correct: 30, stageStarsTotal: 15, stages: 5 });
    expect(MODES.mission.stars(e)).toBe(3);                                      // round(15 / 5)
    expect(MODES.mission.coins({ ...e, stars: 3 })).toBe(30 + 15 * 5 + 20);
  });
});
