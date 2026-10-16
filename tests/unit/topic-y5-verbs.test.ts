import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { AVOID, GAP_WORDS } from '../../src/curriculum/util';
import { VERB_BANK, REAL_LOOKALIKES, VERB_SUFFIXES, verbGap, verbOf } from '../../src/curriculum/year5-verbs';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y5-verbs')!;
const EXCLUDE = ['gay', 'queer', 'bitch', 'butt'];
const draws = (d: Difficulty, n = 300) => { const r = rng(1222 + d); return Array.from({ length: n }, () => topic.gen(d, r)); };
/** The bank row a card came from: by its root in the prompt (d1/d2) or its gapped sentence (d3). */
const rowOf = (c: { prompt: string; visual?: { type: string; text?: string } }) =>
  VERB_BANK.find(r => (c.visual ? c.visual.text === r[3].replace('{}', verbGap(r)) : c.prompt === `Slice the ending: ${r[0]} into ${verbGap(r)}`))!;

/** Every verb a card can complete to, right and wrong, sorted. Hand-read once: each wrong one is a non-word (#418 method). */
const INVENTORY = [
  'apologate', 'apologify', 'apologise', 'beautate', 'beautify', 'beautise', 'captivate', 'captivify', 'captivise', 'criticate', 'criticify', 'criticise',
  'customate', 'customify', 'customise', 'energate', 'energify', 'energise', 'finalate', 'finalify', 'finalise', 'fossilate', 'fossilify', 'fossilise',
  'glorate', 'glorify', 'glorise', 'humidate', 'humidify', 'humidise', 'justate', 'justify', 'justise', 'memorate', 'memorify', 'memorise',
  'motivate', 'motivify', 'motivise', 'originate', 'originify', 'originise', 'purate', 'purify', 'purise', 'realate', 'realify', 'realise',
  'simplate', 'simplify', 'simplise', 'summarate', 'summarify', 'summarise', 'symbolate', 'symbolify', 'symbolise', 'vaccinate', 'vaccinify', 'vaccinise',
].sort();

describe('y5-verbs (#1222)', () => {
  it('is registered once in Year 5 writing, as grammar', () => {
    expect(TOPICS.filter(t => t.id === 'y5-verbs')).toHaveLength(1);
    expect(topic).toMatchObject({ year: 'year5', subject: 'writing', strand: 'grammar' });
  });

  it('oracle: the answer is the entry suffix, and stem + answer is the bank verb', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const c of draws(d)) {
      const row = rowOf(c as never);
      expect(row).toBeDefined();
      expect(c.answer).toBe(row[2]);
      expect(row[1] + c.answer).toBe(verbOf(row));
    }
  });

  it('every verb uses British -ise spelling, never -ize', () => {
    for (const r of VERB_BANK) expect(verbOf(r), verbOf(r)).not.toMatch(/ize$/);
    expect(VERB_BANK.some(r => r[2] === 'ise')).toBe(true);
  });

  it('ladder: d1 roots are unchanged, d2 roots change, d3 is sentence cards with no root shown', () => {
    for (const c of draws(1)) { const r = rowOf(c as never); expect(r[1]).toBe(r[0]); expect(c.visual).toBeUndefined(); }
    for (const c of draws(2)) { const r = rowOf(c as never); expect(r[1]).not.toBe(r[0]); expect(c.visual).toBeUndefined(); }
    for (const c of draws(3)) {
      const r = rowOf(c as never);
      expect(c.visual?.type).toBe('sentence');
      expect(c.prompt).not.toMatch(new RegExp(`\\b${r[0]}\\b`));
      expect((c.visual as { text: string }).text).not.toMatch(new RegExp(`\\b${r[0]}\\b`));
    }
  });

  it('every card has exactly the three bubbles ate, ise and ify, and a say', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const c of draws(d)) {
      expect([...c.options].sort()).toEqual([...VERB_SUFFIXES].sort());
      expect(c.say).toBeTruthy();
    }
  });

  it('d3 say speaks the sentence with the whole verb', () => {
    for (const c of draws(3)) expect(c.say).toContain(verbOf(rowOf(c as never)));
  });

  it('no wrong completion is a real word, and every sentence has one gap', () => {
    for (const r of VERB_BANK) {
      expect(r[3].split('{}')).toHaveLength(2);
      for (const s of VERB_SUFFIXES.filter(x => x !== r[2])) {
        const w = r[1] + s;
        expect(GAP_WORDS.has(w) || AVOID.has(w) || REAL_LOOKALIKES.has(w), w).toBe(false);
      }
      expect(REAL_LOOKALIKES.has(verbOf(r)), verbOf(r)).toBe(false);
    }
  });

  it('crude words stay out of every verb, completion, sentence and bubble', () => {
    for (const r of VERB_BANK) for (const x of [verbOf(r), r[3], ...VERB_SUFFIXES.map(s => r[1] + s)])
      for (const a of [...AVOID, ...EXCLUDE]) expect(x.toLowerCase(), x).not.toContain(a);
  });

  it('pins the whole option inventory as a literal sorted list', () => {
    expect([...new Set(VERB_BANK.flatMap(r => VERB_SUFFIXES.map(s => r[1] + s)))].sort()).toEqual(INVENTORY);
  });
});
