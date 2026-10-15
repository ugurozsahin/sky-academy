import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { AVOID } from '../../src/curriculum/util';
import { Y3_DICTATION } from '../../src/curriculum/dictation-y3';
import { rLblProblem } from './helpers/r-lbl';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y3-dictation')!;
const draws = (d: Difficulty, n = 300) => { const r = rng(1114 + d); return Array.from({ length: n }, () => topic.gen(d, r)); };
const EXCLUDE = ['gay', 'queer', 'bitch', 'butt'];
const WORDS: Record<Difficulty, [number, number]> = { 1: [4, 5], 2: [5, 6], 3: [6, 7] };
const bare = (w: string) => w.toLowerCase().replace(/[.!?,]/g, '');

describe('y3-dictation (#1114)', () => {
  it('is registered once in Year 3 writing, spelling strand, sequencing from d1', () => {
    expect(TOPICS.filter(t => t.id === 'y3-dictation')).toHaveLength(1);
    expect(topic).toMatchObject({ year: 'year3', subject: 'writing', strand: 'spelling', sequenceFrom: 1 });
  });

  for (const d of [1, 2, 3] as Difficulty[]) {
    const bank = Y3_DICTATION[d - 1];
    it(`d${d} bank: ≥10 sentences, ${WORDS[d].join('–')} words, each with its focus word, no crude words`, () => {
      expect(bank.length).toBeGreaterThanOrEqual(10);
      expect(new Set(bank.map(b => b[0])).size).toBe(bank.length);
      for (const [s, focus] of bank) {
        const w = s.split(' ');
        expect(w.length, s).toBeGreaterThanOrEqual(WORDS[d][0]);
        expect(w.length, s).toBeLessThanOrEqual(WORDS[d][1]);
        expect(s, s).toMatch(/^[A-Z].*[.?!]$/);
        expect(w.map(bare), s).toContain(focus.toLowerCase());
        if (d === 1) expect(s, s).toMatch(/[.?]$/);
        if (d === 2) expect(s, s).toMatch(/'|,/);
        for (const x of w.map(bare)) { expect(AVOID.has(x), x).toBe(false); expect(EXCLUDE, x).not.toContain(x); }
      }
    });

    it(`d${d} cards: the sequence is the sentence, listen + peek, options ≤10 and unique`, () => {
      const sentences = new Set(bank.map(b => b[0]));
      for (const q of draws(d)) {
        expect(sentences.has(q.answer), q.answer).toBe(true);
        expect(q.sequence!.join(' ')).toBe(q.answer);
        expect(q.listen).toBe(q.answer);
        expect(q.peek).toBe(true);
        expect(q.visual).toEqual({ type: 'word', text: '🎧' });
        expect(q.options.length).toBeLessThanOrEqual(10);
        expect(new Set(q.options).size).toBe(q.options.length);
        for (const w of q.sequence!) expect(q.options).toContain(w);
        const decoys = q.options.filter(o => !q.sequence!.includes(o));
        for (const x of decoys) { expect(AVOID.has(bare(x)), x).toBe(false); expect(EXCLUDE, x).not.toContain(bare(x)); }
      }
    });
  }

  it('d3: exactly one decoy is the last word with a different end mark; d1–d2 have none', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draws(d, 100)) {
      const last = q.sequence![q.sequence!.length - 1];
      const variants = q.options.filter(o => o !== last && bare(o) === bare(last) && !q.sequence!.includes(o));
      expect(variants, q.answer).toHaveLength(d === 3 ? 1 : 0);
      if (d === 3) expect(variants[0].slice(-1)).not.toBe(last.slice(-1));
    }
  });

  it('every label passes R-LBL (#1046)', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draws(d, 100))
      expect(rLblProblem(q as { options: string[] }), q.answer).toBeNull();
  });
});
