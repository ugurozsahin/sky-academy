import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { LETTERS } from '../../src/curriculum/util';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

describe('y1-alphabet "Alphabet Order" (#976)', () => {
  const t = TOPICS.find(x => x.id === 'y1-alphabet')!;
  const draw = (d: Difficulty) => { const r = rng(9760 + d); return Array.from({ length: 300 }, () => t.gen(d, r)); };
  const isSeq = (p: string) => p.startsWith('Slice the next three');

  it('is registered for Year 1 with sequenceFrom: 3', () => {
    expect(t.year).toBe('year1');
    expect(t.sequenceFrom).toBe(3);
  });

  it('oracle: the answer is the alphabet neighbour in the direction named, never wrapping', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draw(d)) {
      if (isSeq(q.prompt)) continue;
      const m = q.prompt.match(/^Which letter comes (after|before) (\w)\?$/)!;
      const i = LETTERS.indexOf(m[2]);
      expect(q.answer, q.prompt).toBe(LETTERS[m[1] === 'after' ? i + 1 : i - 1]);
      expect(q.answer, q.prompt).toBeDefined();
      expect(q.say).toBe(q.prompt.replace(` ${m[2]}?`, ` ${m[2].toUpperCase()}?`));
    }
  });

  it('d3 sequence cards are the next three letters in order, shown letter at most w; sequences only at d3', () => {
    let seqs = 0;
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draw(d)) {
      if (!isSeq(q.prompt)) { expect(q.sequence).toBeUndefined(); continue; }
      seqs++;
      expect(d).toBe(3);
      const i = LETTERS.indexOf(q.prompt.slice(-1));
      expect(i).toBeLessThanOrEqual(LETTERS.indexOf('w'));
      expect(q.sequence).toEqual(LETTERS.slice(i + 1, i + 4));
      expect(q.answer).toBe(q.sequence!.join(''));
    }
    expect(seqs).toBeGreaterThan(0);
  });

  it('distractors: the right count, unique, never the answer; before/after mix-up and two-steps-away come first', () => {
    for (const d of [1, 2] as Difficulty[]) for (const q of draw(d)) {
      const m = q.prompt.match(/^Which letter comes (after|before) (\w)\?$/)!;
      const dir = m[1] === 'after' ? 1 : -1, i = LETTERS.indexOf(m[2]);
      expect(q.options.length, q.prompt).toBe(d === 1 ? 3 : 4);
      expect(new Set(q.options).size).toBe(q.options.length);
      const wrongSide = LETTERS[i - dir], twoAway = LETTERS[i + 2 * dir];
      if (wrongSide !== undefined) expect(q.options, q.prompt).toContain(wrongSide);
      if (twoAway !== undefined && wrongSide !== undefined) expect(q.options, q.prompt).toContain(twoAway);
    }
    for (const q of draw(3)) {
      expect(new Set(q.options).size).toBe(q.options.length);
      if (isSeq(q.prompt)) expect(q.options.length).toBe(6);
    }
  });
});
