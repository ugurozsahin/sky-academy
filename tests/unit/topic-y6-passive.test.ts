import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { AVOID } from '../../src/curriculum/util';
import { PASSIVES, NOT_PASSIVE, passiveDecoys } from '../../src/curriculum/year6-passive';
import { rLblProblem } from './helpers/r-lbl';
import { cardBudgetProblem } from './helpers/card-budget';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y6-passive')!;
const draws = (d: Difficulty, n = 300) => { const r = rng(1279 * 10 + d); return Array.from({ length: n }, () => topic.gen(d, r)); };
// Literal participle list (not imported from the bank): every bank passive verb's participle.
const PARTICIPLES = ['chased', 'broken', 'burnt', 'damaged', 'painted', 'stolen', 'opened', 'cooked', 'washed', 'kicked', 'written', 'eaten', 'chosen', 'drawn', 'fed', 'baked', 'swept', 'helped', 'parked', 'received', 'frozen'];
const BE = 'am|is|are|was|were|be|been|being|get|gets|got|getting';
const hasPassive = (s: string) => new RegExp(`\\b(${BE}) (${PARTICIPLES.join('|')})\\b`, 'i').test(s);
const isBe = (v: string, t: string) => (t === 'past' ? /^was /.test(v) : /^is /.test(v));

describe('y6-passive (#1279)', () => {
  it('is registered once in Year 6 writing, in the grammar strand', () => {
    expect(TOPICS.filter(t => t.id === 'y6-passive')).toHaveLength(1);
    expect(topic).toMatchObject({ year: 'year6', subject: 'writing', strand: 'grammar' });
  });

  it('bank: 16–20 rows, the NC example, 4+ agentless, the two glossary non-examples', () => {
    expect(PASSIVES.length).toBeGreaterThanOrEqual(16); expect(PASSIVES.length).toBeLessThanOrEqual(20);
    expect(PASSIVES.some(r => r[0] === 'I broke the window in the greenhouse.' && r[8] === 'The window in the greenhouse was broken.')).toBe(true);
    expect(PASSIVES.filter(r => r[8]).length).toBeGreaterThanOrEqual(4);
    expect(NOT_PASSIVE.length).toBeGreaterThanOrEqual(4); expect(NOT_PASSIVE.length).toBeLessThanOrEqual(6);
    expect(NOT_PASSIVE).toEqual(expect.arrayContaining(['He received a warning.', 'We had an accident.']));
  });

  it('every passive has be/get + the participle, every active and NOT_PASSIVE sentence has none', () => {
    for (const r of PASSIVES) {
      expect(r[1].includes(r[3]), r[1]).toBe(true);
      expect(hasPassive(r[1]), r[1]).toBe(true);
      expect(hasPassive(r[0]), r[0]).toBe(false);
      expect(isBe(r[3], r[4]), r[3]).toBe(true);
      if (r[8]) { expect(hasPassive(r[8]), r[8]).toBe(true); expect(r[8]).not.toMatch(/ by /); }
    }
    NOT_PASSIVE.forEach(s => expect(hasPassive(s), s).toBe(false));
  });

  it('d1: the answer matches the literal participle check, and passive is 40–60 % of 300 draws', () => {
    const qs = draws(1);
    for (const q of qs) {
      const s = (q.visual as { text: string }).text;
      expect(q.options.sort()).toEqual(['active', 'passive']);
      expect(q.answer, s).toBe(hasPassive(s) ? 'passive' : 'active');
    }
    const share = qs.filter(q => q.answer === 'passive').length / qs.length;
    expect(share).toBeGreaterThan(0.4); expect(share).toBeLessThan(0.6);
  });

  it('d2: the answer is the passive verb in the row’s tense, the decoys are the three generated forms', () => {
    for (const q of draws(2)) {
      const [active] = (q.visual as { text: string }).text.split('\n');
      const row = PASSIVES.find(r => r[0] === active)!;
      expect(q.answer).toBe(row[3]);
      expect(isBe(q.answer, row[4])).toBe(true);
      expect(q.options).toHaveLength(4);
      expect([...q.options].sort()).toEqual([row[3], ...passiveDecoys(row)].sort());
      expect(new Set(q.options).size).toBe(4);
      expect(q.options).toContain(row[2]);
      expect(q.options.some(o => o.endsWith('ing'))).toBe(true);
      expect(q.options.filter(o => hasPassive(`${o} ${row[3].split(' ').pop()}`))).toContain(row[3]);
    }
  });

  it('d3: Who did it? answers the agent, or not told exactly on agentless sentences; the rest are d1 cards', () => {
    const qs = draws(3);
    let who = 0, told = 0;
    for (const q of qs) {
      const s = (q.visual as { text: string }).text;
      if (q.prompt !== 'Slice who did it') { expect(q.answer, s).toBe(hasPassive(s) ? 'passive' : 'active'); continue; }
      who++;
      const row = PASSIVES.find(r => r[1] === s || r[8] === s)!;
      expect(q.options).toHaveLength(3);
      expect(q.options).toEqual(expect.arrayContaining([row[5], row[6], 'not told']));
      if (row[8] === s) { told++; expect(q.answer).toBe('not told'); } else expect(q.answer).toBe(row[5]);
    }
    expect(who).toBeGreaterThan(80); expect(told).toBeGreaterThan(10);
    expect(qs.some(q => (q.visual as { text: string }).text === 'He received a warning.' && q.answer === 'active') || draws(3, 900).some(q => (q.visual as { text: string }).text === 'He received a warning.' && q.answer === 'active')).toBe(true);
  });

  it('no word is in AVOID, every card has a say, labels pass R-LBL and the card budget', () => {
    const words = [...PASSIVES.flatMap(r => [r[0], r[1], r[8], r[5], r[6]]), ...NOT_PASSIVE].flatMap(s => s.toLowerCase().match(/[a-z]+/g) ?? []);
    words.forEach(w => expect(AVOID.has(w), w).toBe(false));
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draws(d)) {
      expect(q.say).toBeTruthy();
      expect(rLblProblem(q), q.options.join()).toBeNull();
      expect(cardBudgetProblem(q)).toBeNull();
    }
  });
});
