import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import { AVOID } from '../../src/curriculum/util';
import { BANK, SENSES } from '../../src/curriculum/year4-context';
import { rLblProblem } from './helpers/r-lbl';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y4-context')!;
const EXCLUDE = new Set(['gay', 'queer', 'bitch', 'butt']);
const own = (w: string) => SENSES.find(s => s[0] === w)![1];
const wordsOf = (s: string) => s.toLowerCase().match(/[a-z']+/g)!;
const allSenses = new Set(SENSES.flatMap(s => s[1]));

describe('y4-context (#1131)', () => {
  it('is registered as a Year 4 reading topic', () => {
    expect(topic.year).toBe('year4');
    expect(topic.strand).toBe('reading');
  });
  it('has at least 16 words of 2–3 senses, each sense 1–2 words', () => {
    expect(SENSES.length).toBeGreaterThanOrEqual(16);
    for (const [w, ss] of SENSES) {
      expect(ss.length, w).toBeGreaterThanOrEqual(2);
      expect(ss.length, w).toBeLessThanOrEqual(3);
      for (const s of ss) expect(s.split(' ').length, s).toBeLessThanOrEqual(3);
    }
  });
  it('every sense of every word is the answer in at least one sentence', () => {
    for (const [w, ss] of SENSES) ss.forEach((_, i) => expect(BANK.some(r => r[1] === w && r[2] === i), `${w}/${i}`).toBe(true));
  });
  it('each word appears exactly once in its sentence, which is at most 60 characters', () => {
    for (const [sentence, word] of BANK) {
      expect(wordsOf(sentence).filter(x => x === word).length, sentence).toBe(1);
      expect(sentence.length, sentence).toBeLessThanOrEqual(60);
    }
  });
  it('no sentence word, bank word or sense is crude (AVOID / EXCLUDE)', () => {
    for (const [sentence, word] of BANK) for (const w of [...wordsOf(sentence), word]) {
      expect(AVOID.has(w), w).toBe(false);
      expect(EXCLUDE.has(w), w).toBe(false);
    }
    for (const s of allSenses) for (const w of wordsOf(s)) { expect(AVOID.has(w), w).toBe(false); expect(EXCLUDE.has(w), w).toBe(false); }
  });
  for (const d of [1, 2, 3] as const) {
    it(`d${d}: shape of the bubbles, keyed sense and R-LBL`, () => {
      const r = rng(1131 + d);
      for (let i = 0; i < 300; i++) {
        const q = topic.gen(d, r);
        const word = /"(.+)"/.exec(q.prompt)![1];
        const sentence = (q.visual as { text: string }).text;
        const row = BANK.find(b => b[0] === sentence)!;
        expect(row[1]).toBe(word);
        expect(q.answer).toBe(own(word)[row[2]]);
        expect(q.options).toContain(q.answer);
        expect(new Set(q.options).size).toBe(q.options.length);
        for (const o of q.options) expect(allSenses.has(o), o).toBe(true);
        const foreign = q.options.filter(o => !own(word).includes(o));
        if (d === 1) { expect(q.options).toHaveLength(2); expect(foreign).toHaveLength(0); }
        if (d === 2) { expect(q.options).toHaveLength(3); expect(foreign).toHaveLength(1); }
        if (d === 3) { expect(q.options).toHaveLength(3); expect(foreign).toHaveLength(0); }
        expect(rLblProblem(q), q.prompt).toBeNull();
      }
    });
  }
});
