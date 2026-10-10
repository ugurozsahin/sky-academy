import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { AVOID } from '../../src/curriculum/util';
import { GAP_BANK, GAP_PATTERN, gapped } from '../../src/curriculum/year6-spellgap';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y6-spellgap')!;
const draws = (d: Difficulty, n = 300) => { const r = rng(1237 + d); return Array.from({ length: n }, () => topic.gen(d, r)); };
const D: Difficulty[] = [1, 2, 3];
const words = (s: string) => s.toLowerCase().match(/[a-z]+/g)!;
// Gap-spelling AVOID does not list every crude whole word: a short local set too.
const EXCLUDE = ['gay', 'queer', 'bitch', 'butt'];

describe('y6-spellgap (#1237)', () => {
  it('is registered once in Year 6, drawing a sequence from d1', () => {
    expect(TOPICS.filter(t => t.id === 'y6-spellgap')).toHaveLength(1);
    expect(topic).toMatchObject({ year: 'year6', subject: 'writing', sequenceFrom: 1 });
  });

  it('the oracle: the joined sequence equals the target, which occurs once as a whole word and is replaced by the one gap', () => {
    for (const x of GAP_BANK) {
      expect(words(x.s).filter(t => t === x.w), x.w).toHaveLength(1);
      expect(x.s.length, x.w).toBeLessThanOrEqual(60);
      expect(gapped(x).split('______'), x.w).toHaveLength(2);
      expect(words(gapped(x)), x.w).not.toContain(x.w);
    }
    expect(GAP_PATTERN.length).toBeGreaterThanOrEqual(30);
    for (const d of D) for (const c of draws(d)) {
      expect(c.sequence!.join(''), c.answer).toBe(c.answer);
      for (const s of c.sequence!) expect(c.options, c.answer).toContain(s);
      expect(c.options.length, c.answer).toBeLessThanOrEqual(10);
      expect(c.prompt).toContain('______');
      expect(c.prompt.toLowerCase()).not.toContain(c.answer);
    }
  });

  it('one spoken line gives the word, the sentence and the word again; no voice peeks, then hides', () => {
    for (const d of D) for (const c of draws(d, 100)) {
      const x = GAP_BANK.find(b => b.w === c.answer)!;
      expect(c.say).toBe(`The word is ${x.w}. ${x.s} The word is ${x.w}.`);
      expect(c.listen).toBe(c.answer);
      expect(c.peek).toBe(true);
    }
  });

  it('words of 10+ letters are chunk-built (labels of 4 or fewer), shorter ones letter by letter, with the matching hint', () => {
    for (const d of D) for (const c of draws(d)) {
      for (const o of c.options) expect(o.length, c.answer).toBeLessThanOrEqual(4);
      if (c.answer.length >= 10) { expect(c.sequence!.length).toBeLessThan(c.answer.length); expect(c.peekHint).toBe('Slice the parts in order'); }
      else { expect(c.sequence).toEqual(c.answer.split('')); expect(c.peekHint).toBe('Slice the letters in order'); }
    }
    expect(GAP_BANK.filter(x => x.w.length >= 10).every(x => x.chunks)).toBe(true);
  });

  it('rises: d1 holds short list words, d2 stops at 9 letters, d3 reaches the long chunk-built ones', () => {
    for (const c of draws(1)) expect(c.answer.length, c.answer).toBeLessThanOrEqual(7);
    for (const c of draws(2)) expect(c.answer.length, c.answer).toBeLessThanOrEqual(9);
    expect(draws(2).some(c => GAP_PATTERN.some(p => p.w === c.answer))).toBe(true);
    expect(draws(3).some(c => c.answer.length >= 10)).toBe(true);
  });

  it('a letter-built pattern word offers its confusable letter, and the tile count is constant', () => {
    const swapped = GAP_PATTERN.filter(x => x.swap && !x.chunks);
    expect(swapped.length).toBeGreaterThan(10);
    for (const x of swapped) {
      expect(x.swap!.length, x.w).toBe(1);
      expect(x.w.includes(x.swap!), x.w).toBe(false);
    }
    const hits = draws(3, 1500).filter(c => swapped.some(x => x.w === c.answer));
    expect(hits.length).toBeGreaterThan(0);
    for (const c of hits) {
      const x = swapped.find(s => s.w === c.answer)!;
      expect(c.options, c.answer).toContain(x.swap);
      expect(c.options.length, c.answer).toBe(Math.min(c.answer.length + 3, 10));
    }
  });

  it('keeps crude words out of every word, sentence word, chunk and decoy', () => {
    for (const x of GAP_BANK) for (const w of [x.w, ...words(x.s), ...(x.chunks ?? []), ...(x.decoys ?? [])]) {
      expect(AVOID.has(w) || EXCLUDE.includes(w), `${x.w}: ${w}`).toBe(false);
    }
  });

  it('every word in the bank is reachable', () => {
    const seen = new Set<string>();
    for (const d of D) for (const c of draws(d, 2000)) seen.add(c.answer);
    expect(GAP_BANK.map(x => x.w).filter(w => !seen.has(w))).toEqual([]);
  });
});
