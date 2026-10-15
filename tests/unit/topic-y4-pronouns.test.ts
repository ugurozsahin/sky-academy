import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { AVOID } from '../../src/curriculum/util';
import { SUBJ_ONE, SUBJ_PLURAL, OBJ, NOUN_BANK } from '../../src/curriculum/year4-pronouns';
import { rLblProblem } from './helpers/r-lbl';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y4-pronouns')!;
const draws = (d: Difficulty, n = 800) => { const r = rng(1168 + d); return Array.from({ length: n }, () => topic.gen(d, r)); };
const text = (q: { visual?: unknown }) => (q.visual as { text: string }).text;
// `AVOID` is a gap-spelling denylist and lists no crude whole words (G13): a short local set too.
const EXCLUDE = ['gay', 'queer', 'bitch', 'butt'];

// The test's own literal lexicon: antecedent -> kind, and the pronoun table. Never read from the module's tags.
type Kind = 'F' | 'M' | 'T' | 'P';
const LEX: Record<string, Kind> = {
  'grandma': 'F', 'my sister': 'F', 'the king': 'M', 'the prince': 'M', 'my brother': 'M',
  'the ball': 'T', 'the box': 'T', 'the girls': 'P', 'the boys': 'P', 'the kites': 'P',
};
const PRON: Record<Kind, { subject: string; object: string }> = {
  F: { subject: 'she', object: 'her' }, M: { subject: 'he', object: 'him' }, T: { subject: 'it', object: 'it' }, P: { subject: 'they', object: 'them' },
};
const ANIMALS = ['dog', 'cat', 'rabbit', 'horse', 'bird', 'pony', 'fish'];

/** Antecedents named before the gap, matched in the text against the test's own lexicon. */
const before = (t: string) => t.slice(0, t.indexOf('___')).toLowerCase();
const antecedents = (t: string) => Object.keys(LEX).filter(n => before(t).includes(n));
const gapCase = (t: string) => (/___\.$/.test(t) ? 'object' : 'subject') as 'subject' | 'object';
const capital = (t: string) => /(^|\. )___/.test(t);

describe('y4-pronouns (#1168)', () => {
  it('is registered once in Year 4 grammar', () => {
    expect(TOPICS.filter(t => t.id === 'y4-pronouns')).toHaveLength(1);
    expect(topic).toMatchObject({ year: 'year4', subject: 'writing', strand: 'grammar', title: 'Pronoun or Noun?' });
  });

  it('d1–d2: the answer is the one pronoun that agrees in number, gender and case, read from the card text', () => {
    for (const d of [1, 2] as Difficulty[]) for (const q of draws(d)) {
      const t = text(q), ants = antecedents(t), c = gapCase(t);
      expect(ants, t).toHaveLength(1);
      const want = PRON[LEX[ants[0]]][c];
      expect(q.answer, t).toBe(want);
      expect(q.options.filter(o => o === want), t).toHaveLength(1);
      expect(q.options).toHaveLength(d === 1 ? 3 : 4);
      // Every decoy is a different pronoun, so it is a wrong case, gender or number.
      for (const o of q.options.filter(x => x !== q.answer)) expect(o).not.toBe(want);
    }
  });

  it('d1 uses a subject gap after "Then " and one earlier singular noun; d2 adds object gaps and plurals', () => {
    for (const q of draws(1)) {
      const t = text(q);
      expect(t, t).toMatch(/\. Then ___ /);
      expect(LEX[antecedents(t)[0]]).not.toBe('P');
    }
    const d2 = draws(2).map(text);
    expect(d2.some(t => gapCase(t) === 'object')).toBe(true);
    expect(d2.some(t => LEX[antecedents(t)[0]] === 'P')).toBe(true);
    for (const t of d2) expect(/\. Then ___ /.test(t) || /___\.$/.test(t), t).toBe(true);
  });

  it('no single-person card offers they or them', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draws(d)) {
      const t = text(q), ants = antecedents(t);
      if (ants.length === 1 && ['F', 'M'].includes(LEX[ants[0]])) for (const o of q.options) expect(o.toLowerCase(), t).not.toMatch(/^(they|them)$/);
      if (ants.length === 2 && ['F', 'M'].includes(LEX[ants[0]])) for (const o of q.options) expect(o.toLowerCase(), t).not.toMatch(/^(they|them)$/);
    }
  });

  it('d3: noun cards have two same-pronoun antecedents, the answer is one of them, and the other is never offered', () => {
    const cards = draws(3);
    const nounCards = cards.filter(q => antecedents(text(q)).length === 2);
    expect(nounCards.length).toBeGreaterThan(200);
    expect(cards.length - nounCards.length).toBeGreaterThan(200); // d3 mixes in d2-style cards
    for (const q of nounCards) {
      const t = text(q), [a, b] = antecedents(t);
      expect(LEX[a], t).toBe(LEX[b]);
      expect(capital(t)).toBe(true);
      expect(q.options).toHaveLength(4);
      expect(q.wide).toBe(true);
      const nouns = q.options.filter(o => Object.keys(LEX).includes(o.toLowerCase()));
      expect(nouns, t).toEqual([q.answer]);
      expect([a, b], t).toContain(q.answer.toLowerCase());
      const other = [a, b].find(n => n !== q.answer.toLowerCase())!;
      for (const o of q.options) expect(o.toLowerCase(), t).not.toBe(other);
      // The ambiguous pronoun is offered as a decoy, and "They" never is.
      const k = LEX[a];
      expect(q.options, t).toContain(PRON[k].subject[0].toUpperCase() + PRON[k].subject.slice(1));
      for (const o of q.options) expect(o.toLowerCase(), t).not.toBe('they');
      // Decoys take the same capital letter as the gap, so case never gives the answer away.
      for (const o of q.options) expect(o[0], o).toBe(o[0].toUpperCase());
    }
  });

  it('capitalisation follows the gap on every card', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draws(d, 300)) {
      const t = text(q);
      for (const o of q.options) expect(o[0] === o[0].toUpperCase(), `${t} ${o}`).toBe(capital(t));
    }
  });

  it('bank shape: every sentence is hand-written, ≤ 60 characters, one gap, no first name, no animal, no crude or AVOID word', () => {
    expect(SUBJ_ONE.length).toBeGreaterThanOrEqual(6);
    expect(OBJ.length).toBeGreaterThanOrEqual(6);
    expect(NOUN_BANK.length).toBeGreaterThanOrEqual(6);
    const all = [...SUBJ_ONE, ...SUBJ_PLURAL, ...OBJ].map(r => r[0]).concat(NOUN_BANK.map(r => r[0]));
    for (const t of all) {
      expect(t.length, t).toBeLessThanOrEqual(60);
      expect(t.split('___'), t).toHaveLength(2);
      // The only capitalised words are sentence starts, pronoun "We", and the role noun Grandma: never a first name.
      const caps = (t.match(/(?<!^|\. )\b[A-Z][a-z]*/g) ?? []).filter(w => w !== 'Grandma');
      expect(caps, t).toEqual([]);
      for (const w of t.toLowerCase().match(/[a-z]+/g)!) { expect(ANIMALS.includes(w) || AVOID.has(w) || EXCLUDE.includes(w), `${t} ${w}`).toBe(false); }
      expect(gapCase(t) === 'object' || /\. Then ___ |\. ___ /.test(t), t).toBe(true);
    }
    for (const [t, ant] of [...SUBJ_ONE, ...SUBJ_PLURAL, ...OBJ]) expect(LEX[antecedents(t)[0]], t).toBe(ant);
    for (const r of SUBJ_ONE) expect(LEX[antecedents(r[0])[0]], r[0]).not.toBe('P');
  });

  it('prompts follow the paper voice and every card has its own say', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draws(d, 200)) {
      expect(q.prompt).toMatch(/^Which /);
      expect(q.say, q.prompt).toContain('blank');
    }
  });

  it('every label passes R-LBL on d1–d3', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const c of draws(d, 300)) expect(rLblProblem(c), `${d} ${c.answer}`).toBeNull();
  });
});
