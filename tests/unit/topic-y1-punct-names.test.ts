import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { AVOID } from '../../src/curriculum/util';
import { PUNCT_NAMES } from '../../src/curriculum/year1-punct';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

const topic = TOPICS.find(t => t.id === 'y1-punct')!;
const NAMES = new Set(['ben', 'mia', 'zak', 'amy', 'lily', 'tom', 'ruby', 'max', 'noah', 'sam', 'leeds', 'london', 'bath', 'york',
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday', 'i']);
const words = (s: string) => s.slice(0, -1).split(' ');
const isNamesCard = (prompt: string) => prompt === 'Which word needs a capital letter?';

describe('y1-punct names-and-I form (#980)', () => {
  it('bank: at least 20 sentences; exactly one name/day/place/I is lower case, it is the stored answer and not the first word', () => {
    expect(PUNCT_NAMES.length).toBeGreaterThanOrEqual(20);
    for (const [sent, ans] of PUNCT_NAMES) {
      const ws = words(sent);
      const bad = ws.filter(w => NAMES.has(w.toLowerCase()) && w === w.toLowerCase());
      expect(bad, sent).toEqual([ans]);
      expect(ws[0], sent).toMatch(/^[A-Z]/);
      expect(ws.slice(1).filter(w => w !== ans && w === w.toLowerCase()).length, sent).toBeGreaterThanOrEqual(3);
      expect(AVOID.has(ans)).toBe(false);
    }
  });
  it('cards: one option is the stored answer, decoys are other lower-case words of the sentence, never the first word', () => {
    for (const d of [2, 3] as Difficulty[]) {
      const r = rng(9800 + d);
      let seen = 0;
      for (let i = 0; i < 300; i++) {
        const q = topic.gen(d, r);
        if (!isNamesCard(q.prompt)) continue;
        seen++;
        const sent = (q.visual as { text: string }).text;
        const entry = PUNCT_NAMES.find(([s]) => s === sent)!;
        expect(q.answer).toBe(entry[1]);
        expect(q.options.filter(o => o === q.answer)).toHaveLength(1);
        expect(q.options).toHaveLength(d + 1);
        expect(new Set(q.options).size).toBe(q.options.length);
        for (const o of q.options.filter(o => o !== q.answer)) {
          expect(words(sent).slice(1)).toContain(o);
          expect(o).toBe(o.toLowerCase());
          expect(AVOID.has(o)).toBe(false);
        }
        expect(q.prompt.length).toBeLessThanOrEqual(65);
      }
      expect(seen, `d${d}`).toBeGreaterThan(50);
    }
  });
  it('ladder: d1 never asks it; d2 and d3 do, and the old forms are still asked', () => {
    for (const d of [1, 2, 3] as Difficulty[]) {
      const r = rng(9810 + d);
      const qs = Array.from({ length: 300 }, () => topic.gen(d, r));
      expect(qs.some(q => isNamesCard(q.prompt))).toBe(d !== 1);
      expect(qs.some(q => q.answer === '.' || q.answer === '?' || q.answer === '!')).toBe(d !== 1 || false);
      expect(qs.some(q => /^_/.test(q.prompt))).toBe(d !== 3);
      qs.forEach(q => expect(q.prompt.length).toBeLessThanOrEqual(65));
    }
  });
});
