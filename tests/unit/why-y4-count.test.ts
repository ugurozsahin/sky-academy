// #2317 (y4-count): the why shows the one step that made the answer, from the term before the gap or the base number.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const draw = (d: Difficulty) => Array.from({ length: 200 }, (_, s) => TOPICS.find(x => x.id === 'y4-count')!.gen(d, rngOf((s + 1) * 104729 + d)));
const num = (s: string) => Number(s.replace(/,/g, ''));

describe('y4-count why (#2317)', () => {
  it('is one real step that lands on the answer, in the run\'s own direction', () => {
    let runs = 0, more = 0;
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draw(d)) {
      const m = /^([\d,]+) ([+−]) ([\d,]+) = ([\d,]+)$/.exec(q.why!);
      expect(m, q.why).toBeTruthy();
      const [, a, op, b, r] = m!;
      expect(num(a) + (op === '+' ? 1 : -1) * num(b), q.why).toBe(num(r));
      expect(r, q.why).toBe(q.answer);
      if (/^1,000 (more|less) than/.test(q.prompt)) { more++; expect(q.prompt, q.why).toContain(`than ${a} =`); expect(b).toBe('1,000'); expect(q.prompt.includes(op === '+' ? 'more' : 'less')).toBe(true); }
      else { runs++; expect(q.prompt, q.why).toContain(a); }
    }
    expect(runs).toBeGreaterThan(0);
    expect(more).toBeGreaterThan(0);
  });
});
