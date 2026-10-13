import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import { Y1_COMPOUNDS } from '../../src/curriculum/year1-compound';
import { AVOID, GAP_WORDS } from '../../src/curriculum/util';
import type { Difficulty } from '../../src/curriculum';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

const topic = TOPICS.find(t => t.id === 'y1-compound')!;
const DS: Difficulty[] = [1, 2, 3];

/** #978: compound words spelt as their two parts. The bank is hand-curated; no code builds a decoy. */
describe('y1-compound (#978)', () => {
  it('is a registered Year 1 writing topic directly after y1-plurals', () => {
    expect(topic.year).toBe('year1');
    expect(topic.subject).toBe('writing');
    const ids = TOPICS.map(t => t.id);
    expect(ids.indexOf('y1-compound')).toBe(ids.indexOf('y1-plurals') + 1);
  });

  it('the bank has at least 12 entries, each compound 9 letters or fewer with exactly 3 decoys', () => {
    expect(Y1_COMPOUNDS.length).toBeGreaterThanOrEqual(12);
    for (const [a, b, , ds] of Y1_COMPOUNDS) { expect((a + b).length, a + b).toBeLessThanOrEqual(9); expect(ds, a + b).toHaveLength(3); }
  });

  it('every decoy is a non-word, differs from the answer, and is never a listed or avoided word', () => {
    for (const [a, b, , ds] of Y1_COMPOUNDS) for (const x of ds) {
      expect(x, a + b).not.toBe(a + b);
      expect(GAP_WORDS.has(x), x).toBe(false);
      expect(AVOID.has(x), x).toBe(false);
      expect(Y1_COMPOUNDS.some(([p, q]) => p + q === x), x).toBe(false);
    }
  });

  it.each(DS)('d%i: the answer is the two shown parts joined, other options are that entry\'s decoys', (d) => {
    for (let seed = 1; seed <= 300; seed++) {
      const q = topic.gen(d, rng(seed));
      const [a, b] = q.prompt.split(' = ')[0].split(' + ');
      const entry = Y1_COMPOUNDS.find(([x, y]) => x === a && y === b)!;
      expect(entry, q.prompt).toBeDefined();
      expect(q.answer).toBe(a + b);
      expect(q.options.filter(o => o === q.answer)).toHaveLength(1);
      for (const o of q.options) if (o !== q.answer) expect(entry[3], o).toContain(o);
    }
  });

  it('the ladder: d1 offers 2 decoys (reversed, dropped letter), d2 and d3 all 3; d3 drops the emoji', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const q1 = topic.gen(1, rng(seed)), q2 = topic.gen(2, rng(seed)), q3 = topic.gen(3, rng(seed));
      expect(q1.options).toHaveLength(3);
      expect(q2.options).toHaveLength(4);
      expect(q3.options).toHaveLength(4);
      const [a, b] = q1.prompt.split(' = ')[0].split(' + ');
      const entry = Y1_COMPOUNDS.find(([x, y]) => x === a && y === b)!;
      expect(q1.options).not.toContain(entry[3][2]);
      expect(q1.visual).toMatchObject({ type: 'word', emoji: entry[2] });
      expect(q2.visual).toMatchObject({ type: 'word' });
      expect(q3.visual).toBeUndefined();
    }
  });
});
