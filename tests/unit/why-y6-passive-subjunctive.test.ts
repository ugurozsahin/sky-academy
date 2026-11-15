// #2318 (y6-passive, y6-subjunctive): the why gives the test that settles the card.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';
import { PASSIVES, ACTIVE_WHY, NOT_PASSIVE, NOT_PASSIVE_WHY, buildWhy, doerWhy, passiveWhy } from '../../src/curriculum/year6-passive';
import { SUBJUNCTIVES, subjunctiveWhy } from '../../src/curriculum/year6-subjunctive';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const draws = (id: string, d: Difficulty) => Array.from({ length: 200 }, (_, n) => TOPICS.find(x => x.id === id)!.gen(d, rngOf((n + 1) * 104729 + d)));

describe('y6-passive says why (#2318)', () => {
  it('words each test', () => {
    const r = PASSIVES[0];
    expect(passiveWhy(r)).toBe('"Was chased" is be + a participle: the sentence is passive.');
    expect(ACTIVE_WHY).toBe('The doer comes before the verb: the sentence is active.');
    expect(NOT_PASSIVE_WHY).toBe('No be + participle, so it is active, even if it sounds passive.');
    expect(buildWhy(r)).toBe('The past of be, then the participle: was chased.');
    expect(doerWhy(r, false)).toBe('The doer follows "by": the dog.');
    expect(doerWhy(r, true)).toContain('not told');
  });
});

describe('y6-passive wiring (#2318)', () => {
  it('reads right for every row, with no ungrammatical "Me does it"', () => {
    for (const r of PASSIVES) { expect(passiveWhy(r)).toContain(r[3].replace(/^./, c => c.toUpperCase())); expect(ACTIVE_WHY).not.toMatch(/^Me /); }
    expect(NOT_PASSIVE.length).toBeGreaterThan(0);
    expect(NOT_PASSIVE_WHY).not.toMatch(/subject does it/);
  });
  it('each draw names its voice, the doer or "not told", and the verb it builds', () => {
    for (const d of [1, 2, 3] as const) for (const q of draws('y6-passive', d)) {
      const w = q.why!;
      if (q.answer === 'passive') expect(w).toMatch(/passive/);
      else if (q.answer === 'active') expect(w).toMatch(/active/);
      else if (q.answer === 'not told') expect(w).toContain('not told');
      else { expect(w).toContain(q.answer); if (d === 3) expect(w).toContain(`"by"`); }
    }
  });
});

describe('y6-subjunctive says why (#2318)', () => {
  it('words each kind', () => {
    expect(subjunctiveWhy(SUBJUNCTIVES[0])).toBe('It is only imagined, so formal writing says "were", not "was".');
    expect(subjunctiveWhy(SUBJUNCTIVES.find(r => r.kind === 'mandative')!)).toBe('After insist, suggest or require, the plain verb follows: "be".');
    expect(subjunctiveWhy(SUBJUNCTIVES.find(r => r.kind === 'inversion')!)).toContain('"Were"');
  });
});

describe('y6-subjunctive wiring (#2318)', () => {
  it('never names the right form as the wrong one', () => {
    for (const r of SUBJUNCTIVES.filter(x => x.kind === 'were')) expect(subjunctiveWhy(r)).toContain('not "was"');
    for (const d of [1, 2, 3] as const) for (const q of draws('y6-subjunctive', d)) if (q.answer !== 'Were') expect(q.why).toMatch(/were|plain verb/);
  });
});

describe.each(['y6-passive', 'y6-subjunctive'])('%s sets a short why on every question', id => {
  it('is short and is not the bare answer', () => {
    for (const d of [1, 2, 3] as const) for (const q of draws(id, d)) {
      expect(q.why).toBeTruthy();
      expect(q.why!.split(/\s+/).length).toBeLessThanOrEqual(14);
    }
  });
});
