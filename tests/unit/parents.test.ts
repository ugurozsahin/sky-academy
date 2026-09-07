import { describe, it, expect } from 'vitest';
import { gateChallenge, checkGate, parentSummary, pct, RANK_MIN_TRIES } from '../../src/game/parents';
import { TOPICS, YEARS, topicsFor } from '../../src/curriculum';
import { STICKER_IDS, type SaveData, type TopicProgress } from '../../src/storage';
import { freshDojo } from '../../src/game/dojo';

const base: SaveData = {
  v: 1, name: 'Test', avatar: 'kai', year: 'year1', sound: true, speech: true,
  progress: {}, endless: {}, sprint: {}, boss: {}, memory: {}, training: {},
  coins: 0, spent: 0, owned: [], equipped: {}, stickers: [], streak: { last: '', days: 0 }, tutorialSeen: false, dojo: freshDojo(''),
};
const p = (stars: number, plays: number, hits?: number, tries?: number): TopicProgress => ({ stars, best: 0, plays, hits, tries });
// small deterministic rng
const rngOf = (seed: number) => { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; };

describe('grown-ups gate', () => {
  it('asks a times-table question with both factors 6–9', () => {
    const r = rngOf(7);
    for (let i = 0; i < 500; i++) {
      const g = gateChallenge(r);
      expect(g.a).toBeGreaterThanOrEqual(6); expect(g.a).toBeLessThanOrEqual(9);
      expect(g.b).toBeGreaterThanOrEqual(6); expect(g.b).toBeLessThanOrEqual(9);
      expect(g.answer).toBe(g.a * g.b);
      expect(g.prompt).toBe(`${g.a} × ${g.b}`);
    }
  });
  it('accepts only the exact whole-number answer', () => {
    expect(checkGate('42', 42)).toBe(true);
    expect(checkGate('  42 ', 42)).toBe(true);       // surrounding spaces are fine
    expect(checkGate('43', 42)).toBe(false);
    expect(checkGate('', 42)).toBe(false);
    expect(checkGate('4two', 42)).toBe(false);
    expect(checkGate('42x', 42)).toBe(false);
    expect(checkGate('4.2', 42)).toBe(false);        // not a whole number
    expect(checkGate('042', 42)).toBe(true);         // leading zeros still parse
  });
});

describe('parent dashboard summary', () => {
  it('an untouched save reports nothing played but the full topic count', () => {
    const sm = parentSummary(base, TOPICS, YEARS, STICKER_IDS.length);
    expect(sm.totalAnswered).toBe(0);
    expect(sm.overallAccuracy).toBeNull();
    expect(sm.starsEarned).toBe(0);
    expect(sm.starsMax).toBe(TOPICS.length * 3);
    expect(sm.topicsTried).toBe(0);
    expect(sm.topicsTotal).toBe(TOPICS.length);
    expect(sm.weakest).toEqual([]);
    expect(sm.strongest).toEqual([]);
    expect(sm.stickersTotal).toBe(STICKER_IDS.length);
    expect(sm.modes).toHaveLength(YEARS.length);
  });

  it('aggregates accuracy, stars, weakest/strongest and per-mode bests', () => {
    const data: SaveData = {
      ...base,
      progress: {
        'y1-add': p(3, 5, 45, 50),    // 90 %
        'y1-sub': p(1, 3, 6, 20),     // 30 %  → weakest
        'y1-bonds': p(2, 2, 3, 5),    // 60 %  (tries == RANK_MIN_TRIES, still ranked)
        'r-count': p(1, 1, 2, 3),     // only 3 tries → below the ranking threshold
      },
      endless: { year1: 120 }, sprint: { year1: 15 }, boss: { year1: 2 }, memory: { year1: 1 }, training: { year1: 3 },
      coins: 70, stickers: ['volt', 'blaze'], streak: { last: '2026-09-06', days: 4 },
    };
    const sm = parentSummary(data, TOPICS, YEARS, STICKER_IDS.length);

    expect(sm.totalAnswered).toBe(50 + 20 + 5 + 3);
    expect(sm.totalCorrect).toBe(45 + 6 + 3 + 2);
    expect(pct(sm.overallAccuracy)).toBe(Math.round((56 / 78) * 100));   // 72
    expect(sm.starsEarned).toBe(3 + 1 + 2 + 1);
    expect(sm.topicsTried).toBe(4);

    // ranking uses only topics with >= RANK_MIN_TRIES answers, weakest first
    expect(sm.weakest.map(t => t.id)).toEqual(['y1-sub', 'y1-bonds', 'y1-add']);
    expect(sm.strongest[0].id).toBe('y1-add');
    expect(sm.weakest.some(t => t.id === 'r-count')).toBe(false);        // excluded: only 3 tries
    expect(RANK_MIN_TRIES).toBe(5);

    const y1 = sm.years.find(y => y.id === 'year1')!;
    expect(y1.answered).toBe(50 + 20 + 5);
    expect(y1.correct).toBe(45 + 6 + 3);
    expect(pct(y1.accuracy)).toBe(Math.round((54 / 75) * 100));          // 72
    expect(y1.stars).toBe(6);
    expect(y1.maxStars).toBe(topicsFor('year1').length * 3);
    expect(y1.topicsTried).toBe(3);

    const rec = sm.years.find(y => y.id === 'reception')!;
    expect(rec.answered).toBe(3);
    expect(rec.correct).toBe(2);
    expect(rec.topicsTried).toBe(1);

    const m1 = sm.modes.find(m => m.id === 'year1')!;
    expect(m1).toMatchObject({ endless: 120, sprint: 15, boss: 2, memory: 1, training: 3 });
    const m2 = sm.modes.find(m => m.id === 'year2')!;
    expect(m2).toMatchObject({ endless: 0, sprint: 0, boss: 0, memory: 0, training: 0 });

    expect(sm.coins).toBe(70);
    expect(sm.stickers).toBe(2);
    expect(sm.streakDays).toBe(4);
  });

  it('pct rounds and passes null through', () => {
    expect(pct(null)).toBeNull();
    expect(pct(0.725)).toBe(73);
    expect(pct(1)).toBe(100);
    expect(pct(0)).toBe(0);
  });
});
