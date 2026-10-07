import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { AVOID } from '../../src/curriculum/util';
import { WORD_ADV, PHRASE_ADV, FIT_BANK } from '../../src/curriculum/year4-adverbials';
import { rLblProblem } from './helpers/r-lbl';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y4-adverbials')!;
const draws = (d: Difficulty, n = 1500) => { const r = rng(1166 + d); return Array.from({ length: n }, () => topic.gen(d, r)); };
const text = (q: { visual?: unknown }) => (q.visual as { text: string }).text;
const MARK = /\s*\([A-D]\)/g;
const isFit = (q: { prompt: string }) => q.prompt === 'Which fits the gap?';
// `AVOID` is a gap-spelling denylist and lists no crude whole words (G13): a short local set too.
const EXCLUDE = ['gay', 'queer', 'bitch', 'butt'];
const TIME_PLACE = ['day', 'morning', 'afternoon', 'evening', 'night', 'week', 'month', 'year', 'time', 'today', 'tomorrow', 'yesterday', 'home', 'here', 'there', 'outside'];
// The word each bank row's `verbAt` must point at (the first verb of the clause, `will` for the future), listed by the test itself.
const VERBS = new Set(['opened', 'crept', 'went', 'will', 'ran', 'stopped', 'reached', 'fell', 'planted', 'crossed', 'found', 'knocked', 'glided', 'ate', 'cooks', 'fed', 'shine', 'played', 'stroked',
  'heard', 'began', 'visited', 'turned', 'covered', 'stood', 'rang', 'swim', 'sang', 'lit', 'reads', 'built', 'hooted', 'went']);
const IRREGULAR_PAST = ['ate', 'ran', 'sang', 'swam', 'drew', 'fell', 'flew', 'took', 'rang', 'grew', 'hid', 'sat'];

describe('y4-adverbials (#1166)', () => {
  it('is registered once in Year 4 grammar', () => {
    expect(TOPICS.filter(t => t.id === 'y4-adverbials')).toHaveLength(1);
    expect(topic).toMatchObject({ year: 'year4', subject: 'writing', strand: 'grammar', title: 'Fronted Adverbials' });
  });

  it('where-is-the-comma cards: the answer gap follows the adverbial exactly, no other gap does', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draws(d).filter(c => !isFit(c))) {
      const t = text(q);
      const row = [...WORD_ADV, ...PHRASE_ADV].find(r => t.replace(MARK, '') === `${r[0]} ${r[1]}`)!;
      expect(row, t).toBeDefined();
      const before = (letter: string) => t.slice(0, t.indexOf(`(${letter})`)).replace(MARK, '').trim();
      expect(before(q.answer), t).toBe(row[0]);
      for (const o of q.options.filter(x => x !== q.answer)) expect(before(o), t).not.toBe(row[0]);
      expect(q.prompt).toBe('Where does the comma go?');
      expect([...q.options].sort()).toEqual((t.match(/\([A-D]\)/g) ?? []).map(m => m[1]).sort());
    }
  });

  it('gap counts and adverbial length by difficulty; d2–d3 always offer a gap inside the adverbial; the comma-before-the-verb gap is always there', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draws(d, 600).filter(c => !isFit(c))) {
      const t = text(q);
      const row = [...WORD_ADV, ...PHRASE_ADV].find(r => t.replace(MARK, '') === `${r[0]} ${r[1]}`)!;
      expect(q.options).toHaveLength(d === 3 ? 4 : 3);
      const k = row[0].split(' ').length;
      if (d === 1) expect(k).toBe(1); else expect(k).toBeGreaterThan(1);
      // The test's own parse: a gap sits after word i when a marker token follows it.
      const toks = t.split(' '), gapAt: number[] = [];
      let n = 0;
      for (const tok of toks) { if (/^\([A-D]\)$/.test(tok)) gapAt.push(n - 1); else n++; }
      if (d >= 2) expect(gapAt, t).toContain(0);
      expect(gapAt, t).toContain(k + row[2] - 1);
    }
  });

  it('each letter answers 25–45% of cards at d1 and d2 (three letters), 15–35% at d3 (four letters)', () => {
    for (const [d, lo, hi, letters] of [[1, .25, .45, 'ABC'], [2, .25, .45, 'ABC'], [3, .15, .35, 'ABCD']] as [Difficulty, number, number, string][]) {
      const cards = draws(d).filter(c => !isFit(c));
      for (const l of letters) {
        const share = cards.filter(c => c.answer === l).length / cards.length;
        expect(share, `d${d} ${l}`).toBeGreaterThan(lo);
        expect(share, `d${d} ${l}`).toBeLessThan(hi);
      }
    }
  });

  it('fit-the-adverbial cards appear only at d3, with an adverbial, a noun phrase and a verb as wide bubbles ≤ 10 characters', () => {
    for (const d of [1, 2] as Difficulty[]) expect(draws(d, 300).some(isFit)).toBe(false);
    const fits = draws(3).filter(isFit);
    expect(fits.length).toBeGreaterThan(400);
    for (const q of fits) {
      expect(q.wide).toBe(true);
      expect(q.options).toHaveLength(3);
      for (const o of q.options) expect(o.length, o).toBeLessThanOrEqual(10);
      const row = FIT_BANK.find(r => text(q) === `___, ${r[0]}`)!;
      expect(q.answer).toBe(row[1]);
      expect([...q.options].sort()).toEqual([row[1], row[2], row[3]].sort());
    }
  });

  it('fit decoys: the noun phrase has no time or place word, the verb is an irregular simple past', () => {
    for (const [rest, adv, noun, verb] of FIT_BANK) {
      expect(rest.endsWith('.'), rest).toBe(true);
      expect(new Set([adv, noun, verb]).size, rest).toBe(3);
      expect(IRREGULAR_PAST, adv).not.toContain(adv.toLowerCase());
      const ws = noun.toLowerCase().split(' ');
      for (const t of TIME_PLACE) expect(ws, noun).not.toContain(t);
      expect(IRREGULAR_PAST, verb).toContain(verb.toLowerCase());
    }
  });

  it('every sentence is ≤ 60 characters with markers, lettered cards have no underscore and no comma', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draws(d, 600)) {
      expect(text(q).length, text(q)).toBeLessThanOrEqual(60);
      if (!isFit(q)) { expect(text(q)).not.toContain('_'); expect(text(q)).not.toContain(','); }
    }
  });

  it('the bank is clean: lengths, no crude or AVOID word, British English, no underscores', () => {
    expect(WORD_ADV.length).toBeGreaterThanOrEqual(15);
    expect(PHRASE_ADV.length).toBeGreaterThanOrEqual(15);
    for (const [a, r, v] of [...WORD_ADV, ...PHRASE_ADV]) {
      expect(`${a} ${r}`.length + 4 * 4, a).toBeLessThanOrEqual(60);
      expect(r.split(' ').length, a).toBeGreaterThan(v);
      expect(r.endsWith('.'), a).toBe(true);
      expect(VERBS.has(r.replace('.', '').split(' ')[v]), `${a}: word ${v} of "${r}" is not a verb`).toBe(true);
    }
    for (const r of WORD_ADV) expect(r[0].includes(' '), r[0]).toBe(false);
    for (const r of PHRASE_ADV) expect(r[0].includes(' '), r[0]).toBe(true);
    const words = [...WORD_ADV, ...PHRASE_ADV, ...FIT_BANK].flatMap(r => r.filter(x => typeof x === 'string').join(' ').toLowerCase().match(/[a-z]+/g)!);
    for (const w of words) expect(AVOID.has(w) || EXCLUDE.includes(w), w).toBe(false);
  });

  it('every label passes R-LBL on d1–d3', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const c of draws(d, 400)) expect(rLblProblem(c), `${d} ${c.answer}`).toBeNull();
  });
});
