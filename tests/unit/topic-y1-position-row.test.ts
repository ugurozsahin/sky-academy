import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y1-position')!;
const DRAWS = 400;

/** #989: the row-of-animals cards of `y1-position`, answers re-derived from the strip itself. */
describe('y1-position row cards (#989)', () => {
  for (const d of [1, 2, 3] as Difficulty[]) {
    it(`d${d}: the oracle holds, rows are 5 distinct animals, next-to is asked of an end only`, () => {
      const r = rng(9890 + d);
      const seen = new Set<string>();
      let rows = 0;
      for (let i = 0; i < DRAWS; i++) {
        const q = topic.gen(d, r);
        if (q.visual?.type !== 'strip') continue;
        rows++;
        const row = q.visual.text.split(' ');
        expect(row, q.prompt).toHaveLength(5);
        expect(new Set(row).size, q.prompt).toBe(5);
        const m = q.prompt.match(/^Which is (first|last|between|next to) ?(?:in the row)?(?: (\S+))?(?: and (\S+))?\?$/);
        expect(m, q.prompt).not.toBeNull();
        const form = m![1];
        seen.add(form);
        let want: string;
        if (form === 'first') want = row[0];
        else if (form === 'last') want = row[4];
        else if (form === 'between') {
          const a = row.indexOf(m![2]), b = row.indexOf(m![3]);
          expect(b - a, q.prompt).toBe(2);
          want = row[a + 1];
        } else {
          const at = row.indexOf(m![2]);
          expect([0, 4], q.prompt).toContain(at);
          want = row[at === 0 ? 1 : 3];
        }
        expect(q.answer, q.prompt).toBe(want);
        expect(q.options.filter(o => o === want)).toHaveLength(1);
        expect(q.options.every(o => row.includes(o)), q.prompt).toBe(true);
        expect(new Set(q.options).size).toBe(q.options.length);
        // no option is an animal named in the prompt
        for (const o of q.options) if (o !== q.answer) expect(q.prompt.includes(o), q.prompt).toBe(false);
        expect(q.options.length, q.prompt).toBeGreaterThanOrEqual(3);
        expect(q.say, q.prompt).toMatch(/in a row/);
      }
      expect(rows).toBeGreaterThan(20);
      const allowed = d === 1 ? ['first', 'last'] : d === 2 ? ['first', 'last', 'between'] : ['first', 'last', 'between', 'next to'];
      expect([...seen].sort()).toEqual([...allowed].sort());
    });
  }

  it('the arrow and turn cards are still drawn at every difficulty', () => {
    for (const d of [1, 2, 3] as Difficulty[]) {
      const r = rng(9899 + d);
      const kinds = new Set<string>();
      for (let i = 0; i < DRAWS; i++) kinds.add(topic.gen(d, r).visual?.type === 'strip' ? 'row' : 'other');
      expect(kinds, `d${d}`).toEqual(new Set(['row', 'other']));
    }
  });
});
