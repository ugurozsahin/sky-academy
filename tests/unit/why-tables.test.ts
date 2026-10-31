// #2317 (times tables, y3 and y4): every form's why is the multiplication or division fact behind the answer.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const IDS = TOPICS.filter(t => /^y[34]-tables/.test(t.id)).map(t => t.id);

describe('y3/y4 times-table whys (#2317)', () => {
  it('covers all ten topics', () => expect(IDS).toHaveLength(10));
  for (const id of IDS) it(`${id}: why is a true fact that involves the answer`, () => {
    const topic = TOPICS.find(t => t.id === id)!;
    for (const d of [1, 2, 3] as Difficulty[]) for (let s = 0; s < 200; s++) {
      const q = topic.gen(d, rngOf((s + 1) * 7919 + d));
      const m = /^(\d+) ([×÷]) (\d+) = (\d+)$/.exec(q.why ?? '');
      expect(m, `${q.prompt}: ${q.why}`).not.toBeNull();
      const [a, b, r] = [Number(m![1]), Number(m![3]), Number(m![4])];
      expect(m![2] === '×' ? a * b : a / b, q.why).toBe(r);
      expect([a, b, r].map(String).concat(`${a} ${m![2]} ${b}`), `${q.prompt}: ${q.why}`).toContain(q.answer);
    }
  });
});
