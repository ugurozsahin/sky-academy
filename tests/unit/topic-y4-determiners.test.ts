import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { AVOID } from '../../src/curriculum/util';
import { DET_BANK, POSS_BANK, TWINS } from '../../src/curriculum/year4-determiners';
import { rLblProblem } from './helpers/r-lbl';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y4-determiners')!;
const draws = (d: Difficulty, n = 600) => { const r = rng(1169 + d); return Array.from({ length: n }, () => topic.gen(d, r)); };
const text = (q: { visual?: unknown }) => (q.visual as { text: string }).text;
// `AVOID` is a gap-spelling denylist and lists no crude whole words (G13): a short local set too.
const EXCLUDE = ['gay', 'queer', 'bitch', 'butt'];

// The test's own lists. Never read from the module's tags. "his" and "her" are both kinds, so they stay out.
const DETS = ['the', 'a', 'an', 'this', 'that', 'these', 'those', 'some', 'every', 'my', 'your', 'our', 'their'];
const POSS = ['mine', 'yours', 'hers', 'ours', 'theirs'];
const klass = (w: string) => (DETS.includes(w.toLowerCase()) ? 'D' : POSS.includes(w.toLowerCase()) ? 'P' : 'other');
const words = (t: string) => t.toLowerCase().match(/[a-z]+/g)!;

describe('y4-determiners (#1169)', () => {
  it('is registered once in Year 4 grammar', () => {
    expect(TOPICS.filter(t => t.id === 'y4-determiners')).toHaveLength(1);
    expect(topic).toMatchObject({ year: 'year4', subject: 'writing', strand: 'grammar', title: 'Determiners and Pronouns' });
  });

  it('every recorded class agrees with the test\'s own lists', () => {
    for (const [t, m] of [...DET_BANK, ...POSS_BANK]) for (const [w, c] of Object.entries(m)) {
      expect(words(t), `${t} ${w}`).toContain(w.toLowerCase());
      if (c === 'D' || c === 'P') expect(klass(w), `${t} ${w}`).toBe(c); else expect(klass(w), `${t} ${w}`).toBe('other');
    }
  });

  it('d1: exactly one option is a determiner, it is the answer, and the sentence holds no other', () => {
    for (const q of draws(1)) {
      const t = text(q);
      expect(q.prompt).toBe('Which word is the determiner?');
      expect(q.options).toHaveLength(4);
      expect(q.wide).toBe(true);
      expect(q.options.filter(o => klass(o) === 'D'), t).toEqual([q.answer]);
      expect(words(t).filter(w => DETS.includes(w)), t).toHaveLength(1);
      for (const o of q.options) expect(words(t), t).toContain(o.toLowerCase());
    }
  });

  it('d2: exactly one option is a possessive pronoun, it is the answer, and a determiner is always a decoy', () => {
    const possDet = new Set<string>();
    for (const q of draws(2)) {
      const t = text(q);
      expect(q.prompt).toBe('Which word is the possessive pronoun?');
      expect(q.options).toHaveLength(4);
      expect(q.options.filter(o => klass(o) === 'P'), t).toEqual([q.answer]);
      expect(q.options.some(o => klass(o) === 'D'), t).toBe(true);
      // this, that, these, those come directly before a noun in the bank, so they are never the pronoun.
      for (const o of q.options) if (['this', 'that', 'these', 'those'].includes(o.toLowerCase())) expect(q.answer).not.toBe(o);
      for (const o of q.options) if (['my', 'your', 'our', 'their'].includes(o.toLowerCase())) possDet.add(o.toLowerCase());
    }
    expect(possDet.size).toBeGreaterThanOrEqual(3);
  });

  it('d2: a possessive determiner in the sentence is always offered', () => {
    for (const q of draws(2)) {
      const t = text(q), poss = words(t).filter(w => ['my', 'your', 'our', 'their'].includes(w));
      for (const p of poss) if (q.options.map(o => o.toLowerCase()).includes(p) === false) expect(q.options.some(o => klass(o) === 'D'), t).toBe(true);
    }
    for (const [t, m] of POSS_BANK) {
      const dets = Object.keys(m).filter(w => m[w] === 'D');
      expect(dets.length, t).toBeGreaterThanOrEqual(1);
    }
  });

  it('d3: the bubbles are the four terms only, wide, and the answer follows the quoted word', () => {
    const seen = new Set<string>();
    for (const q of draws(3)) {
      const t = text(q), w = /"([a-z]+)"/i.exec(q.prompt)![1];
      expect([...q.options].sort()).toEqual(['adjective', 'determiner', 'noun', 'pronoun']);
      expect(q.wide).toBe(true);
      expect(words(t), t).toContain(w.toLowerCase());
      expect(q.answer, t).toBe(klass(w) === 'D' ? 'determiner' : 'pronoun');
      for (const o of q.options) expect(o).not.toMatch(/possessive/);
      seen.add(q.answer);
    }
    expect(seen.size).toBe(2);
  });

  it('d3: every sentence has its twin in the bank, one with the determiner and one with the pronoun', () => {
    expect(TWINS.length).toBeGreaterThanOrEqual(6);
    for (const [det, dw, pron, pw] of TWINS) {
      expect(klass(dw), det).toBe('D'); expect(klass(pw), pron).toBe('P');
      expect(words(det), det).toContain(dw.toLowerCase()); expect(words(pron), pron).toContain(pw.toLowerCase());
      expect(words(det).filter(w => klass(w) === 'P'), det).toEqual([]);
    }
    const prons = new Set(TWINS.map(t => t[3]));
    for (const d of new Set(TWINS.map(t => t[1].toLowerCase()))) expect([...prons].some(p => p.startsWith(d === 'my' ? 'min' : d)), d).toBe(true);
  });

  it('bank shape: short hand-written sentences, no first name, no AVOID or crude word, no his or her', () => {
    expect(DET_BANK.length).toBeGreaterThanOrEqual(10);
    expect(POSS_BANK.length).toBeGreaterThanOrEqual(8);
    const all = [...DET_BANK, ...POSS_BANK].map(r => r[0]).concat(TWINS.flatMap(t => [t[0], t[2]]));
    for (const t of all) {
      expect(t.length, t).toBeLessThanOrEqual(60);
      expect(t, t).not.toMatch(/[‘’']/);
      for (const w of words(t)) { expect(AVOID.has(w) || EXCLUDE.includes(w) || w === 'his' || w === 'her', `${t} ${w}`).toBe(false); }
      expect((t.match(/(?<!^|[.?] )\b[A-Z][a-z]*/g) ?? []).filter(w => w !== 'Mum'), t).toEqual([]);
    }
  });

  it('every label passes R-LBL on d1–d3', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const c of draws(d, 300)) expect(rLblProblem(c), `${d} ${c.answer}`).toBeNull();
  });
});
