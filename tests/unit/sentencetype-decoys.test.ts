import { describe, expect, it } from 'vitest';
import { y2SentenceType, SENTENCE_TYPES, SENTENCE_TYPE_NAMES } from '../../src/curriculum/year2/sentences';

const rngOf = (seed: number) => () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const typeOf = (shown: string) => {
  const hits = SENTENCE_TYPES.filter(([s]) => s.replace(/[.?!]$/, '_') === shown);
  return hits.map(h => h[1]);
};

describe('y2-sentencetype decoys are honest (#2320)', () => {
  it('the bank gives every sentence exactly one type', () => {
    const seen = new Map<string, string>();
    for (const [s, t] of SENTENCE_TYPES) { expect(seen.has(s), s).toBe(false); seen.set(s, t); }
  });

  for (const d of [1, 2, 3] as const) {
    it(`d${d}: options are exactly the types unlocked so far, the mark is hidden, one answer, over 200 seeds`, () => {
      const unlocked = SENTENCE_TYPE_NAMES.slice(0, d + 1);
      for (let seed = 1; seed <= 200; seed++) {
        const q = y2SentenceType(d, rngOf(seed));
        expect([...q.options].sort(), `seed ${seed}`).toEqual([...unlocked].sort());
        const v = q.visual as { type: string; text: string };
        expect(v.text, `seed ${seed}`).toMatch(/_$/);
        const types = typeOf(v.text);
        expect(types, `seed ${seed}: ${v.text}`).toEqual([q.answer]);
      }
    });
  }

  it('d2: the statement and the command are each other\'s decoy (they share a full stop, so only reading tells them apart)', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const q = y2SentenceType(2, rngOf(seed));
      if (q.answer === 'statement') expect(q.options).toContain('command');
      if (q.answer === 'command') expect(q.options).toContain('statement');
    }
  });

  it('d3: an exclamation card also offers the question, which shares its What/How opening', () => {
    let seen = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const q = y2SentenceType(3, rngOf(seed));
      if (q.answer === 'exclamation') { seen++; expect(q.options).toContain('question'); }
    }
    expect(seen).toBeGreaterThan(0);
  });

  it('d1: only statements and questions of 4 to 5 words appear', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const q = y2SentenceType(1, rngOf(seed));
      const n = (q.visual as { text: string }).text.split(' ').length;
      expect(['statement', 'question']).toContain(q.answer);
      expect(n).toBeGreaterThanOrEqual(4); expect(n).toBeLessThanOrEqual(5);
    }
  });
});
