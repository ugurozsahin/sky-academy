import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { parseNum } from '../../src/curriculum/ks2num';
import { wordsTo1000 } from '../../src/curriculum/year3-number';
import { leakShares } from './helpers/decoy-leak';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

const topic = TOPICS.find(t => t.id === 'y3-words')!;
const draws = (d: Difficulty, seed: number, n = 300) => { const r = rng(seed + d); return Array.from({ length: n }, () => topic.gen(d, r)); };

// Test-side parser, written independently of the generator: words -> value.
const SMALL: Record<string, number> = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19 };
const TENS: Record<string, number> = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
function parseWords(w: string): number {
  if (w === 'one thousand') return 1000;
  const [hundreds, rest] = w.split(' hundred');
  let v = SMALL[hundreds] * 100;
  const tail = rest.replace(/^ and /, '');
  for (const part of tail.split('-').filter(Boolean)) v += part in TENS ? TENS[part] : SMALL[part];
  return v;
}
const num = (label: string) => parseNum(label)!.v;
const MISSPELT = /fourty|fifty-?ty|ninty|eigty|thirdy|twenny/;

describe('y3-words (#1081)', () => {
  it('is registered once, in Year 3', () => {
    expect(TOPICS.filter(t => t.id === 'y3-words')).toHaveLength(1);
    expect(topic.year).toBe('year3');
  });

  it('wordsTo1000 writes British forms for fixed cases', () => {
    const cases: [number, string][] = [[100, 'one hundred'], [101, 'one hundred and one'], [110, 'one hundred and ten'], [115, 'one hundred and fifteen'], [340, 'three hundred and forty'], [346, 'three hundred and forty-six'], [607, 'six hundred and seven'], [999, 'nine hundred and ninety-nine'], [1000, 'one thousand']];
    for (const [n, words] of cases) expect(wordsTo1000(n), String(n)).toBe(words);
  });

  it('wordsTo1000 round-trips through the independent parser for every number 100-1,000', () => {
    for (let n = 100; n <= 1000; n++) expect(parseWords(wordsTo1000(n)), String(n)).toBe(n);
  });

  it('d1-d2: the numeral answer equals the value of the words on the card, and the words are in the prompt', () => {
    for (const d of [1, 2] as Difficulty[]) for (const q of draws(d, 1081_100)) {
      expect(parseWords(q.prompt), q.prompt).toBe(num(q.answer));
      expect(q.visual, q.prompt).toEqual({ type: 'word', text: q.prompt });
    }
  });

  it('d1 has no zero digit; d2 always has one or is 1,000', () => {
    for (const q of draws(1, 1081_150)) expect(String(num(q.answer)), q.prompt).not.toContain('0');
    for (const q of draws(2, 1081_160)) expect(String(num(q.answer)), q.prompt).toMatch(/0/);
  });

  it('d1-d2: four distinct numeral options, 4-digit labels comma-formatted', () => {
    for (const d of [1, 2] as Difficulty[]) for (const q of draws(d, 1081_200)) {
      expect(new Set(q.options).size, q.prompt).toBe(4);
      expect(q.options, q.prompt).toContain(q.answer);
      for (const o of q.options) { expect(o, q.prompt).toMatch(/^\d{1,3}(,\d{3})*$/); }
    }
  });

  it('d1-d2: written-as-heard is among the decoys (215 -> 20,015)', () => {
    for (const q of draws(1, 1081_250)) {
      const n = num(q.answer);
      expect(q.options, q.prompt).toContain(new Intl.NumberFormat('en-GB').format(Number(`${Math.floor(n / 100) * 100}${n % 100}`)));
    }
  });

  it('d3: the gap word completes the number\'s words; options are single words of 8 letters or fewer', () => {
    for (const q of draws(3, 1081_300)) {
      const m = q.prompt.match(/^(\d{3}) is (\w+ hundred) and ___(?:-(\w+))?$/)!;
      expect(m, q.prompt).toBeTruthy();
      expect(wordsTo1000(Number(m[1])), q.prompt).toBe(`${m[2]} and ${q.answer}${m[3] ? `-${m[3]}` : ''}`);
      expect(new Set(q.options).size, q.prompt).toBe(4);
      for (const o of q.options) { expect(o, q.prompt).toMatch(/^[a-z]{3,8}$/); }
      expect(q.wide, q.prompt).toBe(true);
    }
  });

  it('no option is a misspelt number word', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draws(d, 1081_400)) for (const o of q.options) expect(o).not.toMatch(MISSPELT);
  });

  it('d1-d2 distractors: leak limit (#1058) over 2,000 seeded draws', () => {
    for (const d of [1, 2] as Difficulty[]) {
      const s = leakShares(topic.gen, d, 2000);
      expect(s.units, `d${d} units`).toBeLessThanOrEqual(0.3);
      expect(s.leading, `d${d} leading`).toBeLessThanOrEqual(0.3);
    }
  });
});
