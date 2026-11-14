// #2318 (y5-perfect, y5-cohesion): the why gives the time test for the helper, and the job of the linking adverbial.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';
import { FRAMES, formsOf, helperOf, perfectWhy } from '../../src/curriculum/year5-perfect';
import { KINDS, LISTS, cohesionWhy, kindOf } from '../../src/curriculum/year5-cohesion';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const draws = (id: string, d: Difficulty) => Array.from({ length: 200 }, (_, n) => TOPICS.find(x => x.id === id)!.gen(d, rngOf((n + 1) * 104729 + d)));

describe('y5-perfect says why (#2318)', () => {
  it('words the helper and the participle gaps', () => {
    const past = FRAMES.find(x => x.anchor === 'past' && x.verb === 'write')!;
    const now = FRAMES.find(x => x.anchor === 'present' && x.third && x.verb === 'eat')!;
    expect(perfectWhy(past, 'aux')).toBe('It happened before another past moment, so: had written.');
    expect(perfectWhy(now, 'aux')).toBe('It matters now, so: has eaten.');
    expect(perfectWhy(now, 'pp')).toBe('After has comes the participle: has eaten.');
  });
  it('ends in the right helper and participle for every frame', () => {
    for (const fr of FRAMES) for (const gap of ['aux', 'pp'] as const) expect(perfectWhy(fr, gap)).toContain(`${helperOf(fr)} ${formsOf(fr)[2]}.`);
  });
  it('sets a short why on every question', () => {
    for (const d of [1, 2, 3] as const) for (const q of draws('y5-perfect', d)) {
      expect(q.why).toBeTruthy();
      expect(q.why!.split(/\s+/).length).toBeLessThanOrEqual(14);
    }
  });
});

describe('y5-cohesion says why (#2318)', () => {
  it('names the job and the kind', () => {
    expect(cohesionWhy('later', 'time')).toBe('"Later" says when: an adverbial of time.');
    expect(cohesionWhy('Thirdly', 'number')).toBe('"Thirdly" gives the order: an adverbial of number.');
  });
  it('is right for every adverbial in every list', () => {
    for (const k of KINDS) for (const adv of LISTS[k]) expect(cohesionWhy(adv, kindOf(adv)!)).toContain(`adverbial of ${k}.`);
  });
  it('sets a short why on every question', () => {
    for (const d of [1, 2, 3] as const) for (const q of draws('y5-cohesion', d)) {
      expect(q.why).toBeTruthy();
      expect(q.why!.split(/\s+/).length).toBeLessThanOrEqual(14);
      expect(q.why).not.toBe(q.answer);
    }
  });
});
