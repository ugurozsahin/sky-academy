import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { AVOID } from '../../src/curriculum/util';
import { MODALS, ADVERBS, CERTAIN, POSSIBLE, MODAL_BANK, ADVERB_BANK, CERTAIN_BANK, POSSIBLE_BANK, wordsOf } from '../../src/curriculum/year5-modal';
import { rLblProblem } from './helpers/r-lbl';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y5-modal')!;
const draws = (d: Difficulty, n = 1000) => { const r = rng(1225 + d); return Array.from({ length: n }, () => topic.gen(d, r)); };
const text = (q: { visual?: unknown }) => (q.visual as { text: string }).text;
const ALL = [...MODALS, ...ADVERBS];
const marks = (s: string) => wordsOf(s).filter(w => ALL.includes(w));
const EXCLUDE = ['gay', 'queer', 'bitch', 'butt'];
const BANKS = [...MODAL_BANK, ...ADVERB_BANK, ...CERTAIN_BANK, ...POSSIBLE_BANK];

describe('y5-modal (#1225)', () => {
  it('is registered once in Year 5 grammar', () => {
    expect(TOPICS.filter(t => t.id === 'y5-modal')).toHaveLength(1);
    expect(topic).toMatchObject({ year: 'year5', subject: 'writing', strand: 'grammar' });
  });

  it('every bank sentence holds exactly one marker word, of the right list', () => {
    const check = (bank: readonly string[], list: readonly string[]) => {
      for (const s of bank) { expect(marks(s), s).toHaveLength(1); expect(list, s).toContain(marks(s)[0]); }
    };
    check(MODAL_BANK, MODALS); check(ADVERB_BANK, ADVERBS); check(CERTAIN_BANK, CERTAIN); check(POSSIBLE_BANK, POSSIBLE);
  });

  it('d3 sentences never use must, should, surely or probably', () => {
    for (const s of [...CERTAIN_BANK, ...POSSIBLE_BANK]) for (const w of ['must', 'should', 'surely', 'probably']) expect(wordsOf(s), s).not.toContain(w);
  });

  it('banks cover every modal and adverb, are unique and short', () => {
    for (const m of MODALS) expect(MODAL_BANK.some(s => marks(s)[0] === m), m).toBe(true);
    for (const a of ADVERBS) expect(ADVERB_BANK.some(s => marks(s)[0] === a), a).toBe(true);
    expect(new Set(BANKS).size).toBe(BANKS.length);
    for (const s of BANKS) expect(s.length, s).toBeLessThanOrEqual(44);
  });

  it('no bank word is in AVOID or the local EXCLUDE set', () => {
    for (const s of BANKS) for (const w of wordsOf(s)) { expect(AVOID.has(w), w).toBe(false); expect(EXCLUDE, w).not.toContain(w); }
  });

  it('d1 and d2: the answer is the sentence\'s one marker, among 4 single-word bubbles of the sentence', () => {
    for (const [d, prompt, bank] of [[1, 'Slice the modal verb', MODAL_BANK], [2, 'Slice the adverb of possibility', ADVERB_BANK]] as const) {
      for (const q of draws(d)) {
        expect(q.prompt).toBe(prompt);
        expect(bank).toContain(text(q));
        expect(marks(text(q))).toEqual([q.answer.toLowerCase()]);
        expect(q.options).toHaveLength(4);
        expect(q.options).toContain(q.answer);
        expect(q.options.filter(o => ALL.includes(o.toLowerCase()))).toEqual([q.answer]);
        for (const o of q.options) { expect(o).toMatch(/^[A-Za-z]+$/); expect(wordsOf(text(q))).toContain(o.toLowerCase()); }
      }
    }
  });

  it('d3: certain or possible, read from the class lists', () => {
    const seen = new Set<string>();
    for (const q of draws(3)) {
      expect([...q.options].sort()).toEqual(['certain', 'possible']);
      const w = marks(text(q))[0];
      expect(q.answer).toBe(CERTAIN.includes(w) ? 'certain' : 'possible');
      seen.add(q.answer);
    }
    expect(seen.size).toBe(2);
  });

  it('no card is a gap card, every card has a sentence visual and a say, and labels pass R-LBL', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draws(d, 300)) {
      expect(text(q)).not.toContain('_');
      expect(q.say).toBeTruthy();
      expect(rLblProblem(q), q.options.join()).toBeNull();
    }
  });
});
