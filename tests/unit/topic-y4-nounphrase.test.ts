import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { AVOID } from '../../src/curriculum/util';
import { GAP_BANK, NP_BANK, VP_BANK, ADV_BANK, HEAD_BANK, phraseText, headText } from '../../src/curriculum/year4-nounphrase';
import { rLblProblem } from './helpers/r-lbl';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y4-nounphrase')!;
const draws = (d: Difficulty, n = 800) => { const r = rng(1165 + d); return Array.from({ length: n }, () => topic.gen(d, r)); };
const text = (q: { visual?: unknown }) => (q.visual as { text: string }).text;
// `AVOID` is a gap-spelling denylist and lists no crude whole words (G13): a short local set too.
const EXCLUDE = ['gay', 'queer', 'bitch', 'butt'];

// The test's own closed lexicon: word -> class. Written here, never imported from the module, so a mis-tagged bank entry cannot pass.
type Cls = 'det' | 'adj' | 'noun' | 'verb' | 'adv' | 'prep';
const LEX: Record<string, Cls> = {};
const add = (c: Cls, words: string) => { for (const w of words.split(' ')) { if (LEX[w] && LEX[w] !== c) throw new Error(`${w} has two classes`); LEX[w] = c; } };
add('det', 'the a an my our some');
add('prep', 'with in over on at near by from to');
add('adj', 'fluffy black tall heavy wooden long kind clever tiny dark old big red green shiny new funny little hungry brown cold juicy small noisy strict happy tasty bright busy quiet friendly sour salty crunchy squeaky sleepy');
add('noun', 'dog cat tree bag cake chocolate gate road boy girl bird sky book farm school man bus frog coin brother bear wind winter apple team football stick hat kite garden maths teacher fan stand stone bridge river flag cheese sandwich pickle birthday table history office block park lamp door city street bakery village shop corner paper boat pond dinner lady hall lock beard picture room film ball hill ducks wall');
add('verb', 'ran went ate sang swam drank grew flew kicked opened found climbed read fed painted cleaned watched jumped');
add('adv', 'quickly slowly loudly gently happily very quite really fast ever so much later far away carefully suddenly rather quietly soon');
const cls = (w: string) => { const c = LEX[w]; if (!c) throw new Error(`"${w}" is not in the test lexicon`); return c; };
const words = (s: string) => s.split(' ');
// The test's own literal list (#2321): adjectives that cannot describe the noun, which d1 offers as decoys. Same word class as the answer, so only sense separates them.
const CLASH: Record<string, string[]> = {
  dog: ['sour', 'wooden'], cat: ['salty', 'crunchy'], tree: ['sour', 'squeaky'], bag: ['sleepy', 'hungry', 'sour'], cake: ['sleepy', 'wooden'],
  gate: ['hungry', 'sleepy'], road: ['sleepy', 'juicy'], boy: ['wooden', 'juicy'], girl: ['wooden', 'sour'], bird: ['sour', 'juicy'],
  sky: ['sleepy', 'crunchy'], book: ['hungry', 'sleepy'],
};

/** A noun phrase per the test's own rule: det, one or more adjectives or nouns, a noun, optionally prep det noun. Returns the head noun or null. */
function npHead(ws: string[]): string | null {
  const m = ws.map(cls);
  if (m[0] !== 'det') return null;
  let i = 1;
  while (i < ws.length - 1 && (m[i] === 'adj' || m[i] === 'noun') && (m[i + 1] === 'adj' || m[i + 1] === 'noun')) i++;
  if (m[i] !== 'noun') return null;
  const head = ws[i];
  const rest = m.slice(i + 1);
  if (rest.length === 0 || (rest.length === 3 && rest[0] === 'prep' && rest[1] === 'det' && rest[2] === 'noun')) return head;
  return null;
}

describe('y4-nounphrase (#1165)', () => {
  it('is registered once in Year 4 grammar', () => {
    expect(TOPICS.filter(t => t.id === 'y4-nounphrase')).toHaveLength(1);
    expect(topic).toMatchObject({ year: 'year4', subject: 'writing', strand: 'grammar', title: 'Expanded Noun Phrases' });
  });

  it('d1: the decoys are two adjectives that cannot describe the noun, the same word class as the answer (#2321)', () => {
    const phrases = [...NP_BANK.map(phraseText), ...HEAD_BANK.map(headText)];
    for (const q of draws(1)) {
      expect(q.options).toHaveLength(3);
      expect(q.wide).toBe(true);
      expect(text(q)).toMatch(/^\w+ ___ \w+$/);
      const noun = words(text(q))[2];
      const decoys = q.options.filter(o => o !== q.answer);
      expect(decoys, text(q)).toHaveLength(2);
      expect(new Set(decoys).size, text(q)).toBe(2);
      for (const o of decoys) {
        expect(cls(o), `${text(q)} ${o}`).toBe('adj');
        expect(CLASH[noun], `${text(q)} ${o}`).toContain(o);
        // No decoy ever describes this noun in any phrase the bank itself writes.
        expect(phrases.some(p => words(p).includes(o) && words(p).includes(noun)), `${noun} ${o}`).toBe(false);
      }
      // The completed phrase is a noun phrase by the test's rule.
      expect(npHead(words(text(q).replace('___', q.answer))), text(q)).toBe(noun);
    }
  });

  it('d2: the answer letter marks the only expanded noun phrase; the others are a verb phrase with a bare noun and a noun-free adverbial', () => {
    for (const q of draws(2)) {
      const lines = text(q).split('\n').map(l => l.slice(3));
      expect(lines).toHaveLength(3);
      expect(text(q).split('\n').map(l => l.slice(0, 2))).toEqual(['A:', 'B:', 'C:']);
      expect([...q.options].sort()).toEqual(['A', 'B', 'C']);
      for (const l of lines) expect(l.length, l).toBeLessThanOrEqual(30);
      const nps = lines.map((l, i) => ({ l, i })).filter(({ l }) => cls(words(l)[0]) === 'det');
      expect(nps, text(q)).toHaveLength(1);
      expect(npHead(words(nps[0].l)), nps[0].l).not.toBeNull();
      expect(words(nps[0].l).length, nps[0].l).toBeGreaterThanOrEqual(3);
      expect('ABC'[nps[0].i], text(q)).toBe(q.answer);
      const vps = lines.filter(l => cls(words(l)[0]) === 'verb');
      expect(vps, text(q)).toHaveLength(1);
      const vw = words(vps[0]).map(cls);
      const n = vw.lastIndexOf('noun');
      expect(vw[n - 1], vps[0]).toBe('det');
      const advs = lines.filter(l => words(l).every(w => cls(w) === 'adv'));
      expect(advs, text(q)).toHaveLength(1);
    }
  });

  it('d3: the answer is the last noun before the first preposition, derived from the card text', () => {
    for (const q of draws(3)) {
      const ws = words(text(q)), m = ws.map(cls);
      const p = m.indexOf('prep');
      const before = ws.slice(0, p), nouns = before.filter(w => cls(w) === 'noun');
      expect(q.answer, text(q)).toBe(nouns[nouns.length - 1]);
      expect(npHead(ws), text(q)).toBe(q.answer);
      expect(q.options).toHaveLength(4);
      // Both named misconceptions are always offered: the noun modifier (first noun) and the noun inside the preposition phrase (last noun).
      expect(q.options, text(q)).toContain(nouns[0]);
      expect(q.options, text(q)).toContain(ws[ws.length - 1]);
      expect(nouns[0], text(q)).not.toBe(q.answer);
      for (const o of q.options) expect(o.includes(' '), o).toBe(false);
    }
  });

  it('prompts follow the paper voice, every card has its own say, and answers are spread over the letters', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draws(d, 200)) {
      expect(q.prompt).toMatch(/^Which /);
      expect(q.say, q.prompt).toBeTruthy();
    }
    const cards = draws(2, 1500);
    for (const l of 'ABC') {
      const share = cards.filter(c => c.answer === l).length / cards.length;
      expect(share, l).toBeGreaterThan(0.25);
      expect(share, l).toBeLessThan(0.42);
    }
  });

  it('bank shape: sizes, every word in the lexicon with one class, tags agree with the lexicon', () => {
    for (const b of [GAP_BANK, NP_BANK, VP_BANK, ADV_BANK, HEAD_BANK]) expect(b.length).toBeGreaterThanOrEqual(12);
    for (const [det, head, mod, clash] of GAP_BANK) {
      expect(cls(det)).toBe('det'); expect(cls(head)).toBe('noun');
      for (const c of clash) expect(cls(c), head).toBe('adj');
      expect(clash).not.toContain(mod);
      expect(['adj', 'noun'], mod).toContain(cls(mod));
    }
    for (const r of NP_BANK) { expect(npHead(words(phraseText(r))), phraseText(r)).toBe(r[2]); expect(phraseText(r).length).toBeLessThanOrEqual(30); }
    for (const r of HEAD_BANK) {
      const ws = words(headText(r)), m = ws.map(cls);
      const nouns = ws.slice(0, m.indexOf('prep')).filter(w => cls(w) === 'noun');
      expect(nouns[nouns.length - 1], headText(r)).toBe(r[3]);
      expect(cls(r[2]), headText(r)).toBe('noun');
      for (const a of r[1]) expect(cls(a)).toBe('adj');
      expect(r[4][2]).not.toBe(r[3]);
    }
    for (const v of VP_BANK) expect(v.length).toBeLessThanOrEqual(30);
    for (const a of ADV_BANK) { expect(a.length).toBeLessThanOrEqual(30); for (const w of words(a)) expect(cls(w)).toBe('adv'); }
  });

  it('the bank is clean: no crude or AVOID word', () => {
    const all = [...GAP_BANK.flat(), ...NP_BANK.map(phraseText), ...VP_BANK, ...ADV_BANK, ...HEAD_BANK.map(headText)].join(' ').toLowerCase().match(/[a-z]+/g)!;
    for (const w of all) expect(AVOID.has(w) || EXCLUDE.includes(w), w).toBe(false);
  });

  it('every label passes R-LBL on d1–d3', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const c of draws(d, 300)) expect(rLblProblem(c), `${d} ${c.answer}`).toBeNull();
  });
});
