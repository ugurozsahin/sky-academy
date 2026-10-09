import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { AVOID, GAP_WORDS } from '../../src/curriculum/util';
import { REAL_LOOKALIKES } from '../../src/curriculum/spelling-rules';
import { ADJ_BANK, ADV_BANK, KEEP_E_BANK, type AbleRow } from '../../src/curriculum/year5-able';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y5-able')!;
const ALL: readonly AbleRow[] = [...ADJ_BANK, ...ADV_BANK, ...KEEP_E_BANK];
const EXCLUDE = ['gay', 'queer', 'bitch', 'butt'];
const draws = (d: Difficulty, n = 400) => { const r = rng(1220 + d); return Array.from({ length: n }, () => topic.gen(d, r)); };
const crude = (s: string) => [...AVOID, ...EXCLUDE].some(a => s.toLowerCase().includes(a));
// Real words a decoy could complete to: the adjective/adverb pairs and the dictionary variants the issue names.
const REAL = new Set([...ALL.map(([s, a]) => s + a), 'forcible', 'forceable', 'collectable', 'collectible']);

describe('y5-able (#1220)', () => {
  it('is registered once in Year 5 spelling', () => {
    expect(TOPICS.filter(t => t.id === 'y5-able')).toHaveLength(1);
    expect(topic).toMatchObject({ year: 'year5', subject: 'writing', strand: 'spelling', title: 'Endings: -able, -ible, -ably, -ibly' });
  });

  it('every bank row: the answer completes the NC word and each decoy completes a non-word', () => {
    for (const [stem, answer, decoys, sentence] of ALL) {
      expect(sentence.split(`${stem}___`).length - 1, sentence).toBe(1);
      expect(decoys.length, stem).toBeGreaterThanOrEqual(2);
      for (const dc of decoys) {
        const w = stem + dc;
        expect(dc, w).not.toBe(answer);
        expect(REAL.has(w) || GAP_WORDS.has(w) || REAL_LOOKALIKES.has(w), `${w} is a real word`).toBe(false);
        expect(dc.length, w).toBeLessThanOrEqual(5);
      }
      expect(answer.length).toBeLessThanOrEqual(5);
      expect(crude(stem + answer + sentence), stem).toBe(false);
      for (const dc of decoys) expect(crude(stem + dc), stem + dc).toBe(false);
    }
  });

  it('adjective cards never offer an adverb ending, nor adverb cards an adjective one', () => {
    for (const [, , decoys] of ADV_BANK) for (const dc of decoys) expect(dc).toMatch(/y$/);
    for (const [, a, decoys] of ADJ_BANK) for (const dc of [a, ...decoys]) expect(dc).not.toMatch(/y$/);
  });

  it('the -ce/-ge rule: changeable and noticeable are answered eable, changable and noticable are decoys', () => {
    for (const stem of ['chang', 'notic']) {
      const row = KEEP_E_BANK.find(r => r[0] === stem)!;
      expect(row[1]).toBe('eable');
      expect(row[2]).toContain('able');
    }
  });

  it('ladder: d1 able/ible, d2 ably/ibly, d3 everything with 3 bubbles; every card has a sentence and a say', () => {
    for (const q of draws(1)) { expect(q.options).toHaveLength(2); expect(q.options.every(o => /^(able|ible|eable)$/.test(o))).toBe(true); expect(q.answer).toMatch(/^(able|ible)$/); }
    for (const q of draws(2)) { expect(q.options).toHaveLength(2); expect(q.options.every(o => /^(ably|ibly|eably|eibly)$/.test(o))).toBe(true); }
    const d3 = draws(3);
    for (const q of d3) expect(q.options).toHaveLength(3);
    expect(d3.some(q => q.answer === 'eable')).toBe(true);
    expect(d3.some(q => q.answer === 'ibly')).toBe(true);
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draws(d, 60)) {
      expect(q.visual?.type).toBe('sentence');
      expect(q.say).toBeTruthy();
      expect(q.options.every(o => o.length <= 5)).toBe(true);
      expect(q.options.some(o => crude(o))).toBe(false);
    }
  });

  it('the option inventory is pinned', () => {
    const seen = new Set<string>();
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draws(d)) seen.add([...q.options].sort().join('|'));
    expect([...seen].sort()).toEqual(['able|eable', 'able|eable|ible', 'able|ible', 'ably|eably', 'ably|eably|ibly', 'ably|eibly|ibly', 'ably|ibly', 'eable|ible', 'eibly|ibly'].sort());
  });
});
