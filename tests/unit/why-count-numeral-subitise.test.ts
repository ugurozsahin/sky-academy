// #2317: r-count, r-numeral and r-subitise say why.
import { describe, expect, it } from 'vitest';
import { TOPICS } from '../../src/curriculum';

describe('Reception counting families say why (#2317)', () => {
  for (const [id, re] of [['r-count', /^Count them one by one: (\d+)\.$/], ['r-subitise', /^Count the dots: (\d+)\.$/], ['r-numeral', /^The numeral (\d) matches \1 dots\.$/]] as const) {
    it(`${id}: the why names the answer's number`, () => {
      const t = TOPICS.find(x => x.id === id)!;
      let seed = 1;
      const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      for (let i = 0; i < 100; i++) {
        const q = t.gen(((i % 3) + 1) as 1 | 2 | 3, rng);
        expect(q.why).toMatch(re);
        const n = q.why!.match(/\d+/)![0];
        expect(q.answer === n || q.answer === '●'.repeat(Number(n))).toBe(true);
      }
    });
  }
});
