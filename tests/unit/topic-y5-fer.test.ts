import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { AVOID, GAP_WORDS } from '../../src/curriculum/util';
import { FER_BANK, ferGap, ferWord } from '../../src/curriculum/year5-fer';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y5-fer')!;
const EXCLUDE = ['gay', 'queer', 'bitch', 'butt'];
const draws = (d: Difficulty, n = 300) => { const r = rng(1221 + d); return Array.from({ length: n }, () => topic.gen(d, r)); };
const rowOf = (c: { visual?: { type: string; text?: string } }) => FER_BANK.find(r => c.visual?.text === r[3].replace('{}', ferGap(r)))!;

/** Every completed spelling a card can show, right and wrong, sorted. Hand-read once: each wrong one is a non-word (#418 method). */
const INVENTORY = [
  'confered', 'conference', 'confering', 'conferred', 'conferrence', 'conferring', 'differed', 'differing', 'differred', 'differring',
  'infered', 'inference', 'infering', 'inferred', 'inferrence', 'inferring', 'offered', 'offerred', 'offering', 'offerring',
  'prefered', 'preference', 'prefering', 'preferred', 'preferrence', 'preferring', 'refered', 'referee', 'reference', 'referral',
  'referred', 'referree', 'referrence', 'referring', 'refering', 'referal', 'suffered', 'sufferred', 'suffering', 'sufferring',
  'transfered', 'transference', 'transfering', 'transferred', 'transferrence', 'transferring',
].sort();

describe('y5-fer (#1221)', () => {
  it('is registered once in Year 5 writing, as spelling', () => {
    expect(TOPICS.filter(t => t.id === 'y5-fer')).toHaveLength(1);
    expect(topic).toMatchObject({ year: 'year5', subject: 'writing', strand: 'spelling' });
  });

  it('oracle: the answer is rr exactly when the bank marks the entry doubled, and filling the gap gives the bank word', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const c of draws(d)) {
      const row = rowOf(c as never);
      expect(row).toBeDefined();
      expect(c.answer).toBe(row[2] ? 'rr' : 'r');
      const filled = (c.visual as { text: string }).text.replace('_', c.answer);
      expect(filled).toBe(row[3].replace('{}', ferWord(row)));
    }
  });

  it('rebuilds each word by the rule: stressed -fer doubles before a vowel ending, referring and reference differ', () => {
    for (const [root, ending, doubled] of FER_BANK) expect(ferWord([root, ending, doubled, '']), root + ending).toBe(root + (doubled ? 'r' : '') + ending);
    const ans = (w: string) => FER_BANK.find(r => ferWord(r) === w)![2];
    expect(ans('referring')).toBe(true);
    expect(ans('reference')).toBe(false);
  });

  it('covers every p.19 example word, each in its own sentence', () => {
    const words = FER_BANK.map(r => ferWord(r));
    for (const w of ['referring', 'referred', 'referral', 'preferring', 'preferred', 'transferring', 'transferred', 'reference', 'referee', 'preference', 'transference'])
      expect(words, w).toContain(w);
    expect(new Set(FER_BANK.map(r => r[3])).size).toBe(FER_BANK.length);
    for (const r of FER_BANK) expect(r[3].split('{}')).toHaveLength(2);
  });

  it('ladder: d1 doubled only, d2 adds the stress-moved cases, d3 adds offer, suffer and differ', () => {
    for (const c of draws(1)) expect(c.answer).toBe('rr');
    const d2 = draws(2, 600);
    expect(new Set(d2.map(c => c.answer))).toEqual(new Set(['r', 'rr']));
    const never = (c: { visual?: { type: string; text?: string } }) => /^(offer|suffer|differ)$/.test(rowOf(c)[0]);
    for (const c of d2) expect(never(c as never)).toBe(false);
    expect(draws(3, 800).some(c => never(c as never))).toBe(true);
  });

  it('every card has exactly two bubbles, r and rr, a sentence visual and a say with the whole word', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const c of draws(d)) {
      expect([...c.options].sort()).toEqual(['r', 'rr']);
      expect(c.visual?.type).toBe('sentence');
      expect(c.say).toContain(ferWord(rowOf(c as never)));
      expect(c.hint).toBe('One r or two?');
    }
  });

  it('no wrong spelling is a real word, and crude words stay out of every word, sentence and bubble', () => {
    for (const r of FER_BANK) {
      const w = ferWord(r, false);
      expect(GAP_WORDS.has(w) || AVOID.has(w), w).toBe(false);
      for (const x of [ferWord(r), w, r[3]]) for (const a of [...AVOID, ...EXCLUDE]) expect(x.toLowerCase(), x).not.toContain(a);
    }
  });

  it('pins the whole option inventory as a literal sorted list', () => {
    const inv = [...new Set(FER_BANK.flatMap(r => [ferWord(r), ferWord(r, false)]))].sort();
    expect(inv).toEqual(INVENTORY);
  });
});
