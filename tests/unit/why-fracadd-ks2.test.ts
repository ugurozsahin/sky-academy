// #2317 (unlike-denominator fraction add and subtract: y5-fracadd, y6-fracadd): every working in a why is true arithmetic on one bottom,
// ends on the question's own answer, and carries "carry the 1" exactly when the fraction parts reach a whole.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const draws = (id: string, d: Difficulty) => Array.from({ length: 200 }, (_, s) => TOPICS.find(t => t.id === id)!.gen(d, rngOf((s + 1) * 104729 + d)));
const RUN = /(\d+)\/(\d+) ([+−]) (\d+)\/(\d+) = (\d+)\/(\d+)/g;

describe('unlike-denominator fraction whys (#2317)', () => {
  const seen: Record<string, number> = {};
  for (const id of ['y5-fracadd', 'y6-fracadd']) for (const d of [1, 2, 3] as Difficulty[]) {
    it(`${id} d${d}: the working adds up, carries when it should and ends on the answer`, () => {
      for (const q of draws(id, d)) {
        const w = q.why!;
        expect(w, q.prompt).toBeTruthy();
        const runs = [...w.matchAll(RUN)];
        expect(runs.length, `no working found in: ${w}`).toBeGreaterThan(0);
        for (const m of runs) {
          const [a, b, c, D] = [Number(m[1]), Number(m[4]), Number(m[6]), Number(m[2])];
          expect([m[5], m[7]], w).toEqual([m[2], m[2]]);
          expect(m[3] === '+' ? a + b : a - b, w).toBe(c);
          // the mixed-number cards show the carry only for an addition whose fraction parts reach a whole
          if (w.startsWith('Fractions:')) expect(/carry the 1/.test(w), w).toBe(m[3] === '+' && c >= D);
        }
        // the working's tops are the prompt's own operands brought over the working's bottom (whole parts only where the working keeps them)
        const ops = [...q.prompt.matchAll(/(?:(\d+) )?(\d+)\/(\d+)/g)].map(o => ({ whole: Number(o[1] ?? 0), n: Number(o[2]), d: Number(o[3]) }));
        const first = runs[0], L = Number(first[2]);
        const lift = (o: { n: number; d: number }) => (o.n * L) / o.d;
        const extra = w.startsWith('Swap a whole') ? L : w.startsWith('1 ') ? ops[0].whole * L : 0;
        expect([Number(first[1]), Number(first[4])], `${q.prompt} → ${w}`).toEqual([lift(ops[0]) + extra, lift(ops[1])]);
        if (w.startsWith('Same bottom')) expect(w.startsWith(`Same bottom, so ${first[3] === '+' ? 'add' : 'take away'} the tops`), w).toBe(true);
        // the working ends on the question's own answer
        expect(w.endsWith(` = ${q.answer}`) || w.endsWith(` giving ${q.answer}`), `${w} should end on ${q.answer}`).toBe(true);
        const kind = /^(Same bottom|Make the bottoms|Bottoms to|Fractions:|Swap a whole|1 )/.exec(w)?.[1] ?? 'other';
        seen[`${id}:${kind}`] = (seen[`${id}:${kind}`] ?? 0) + 1;
      }
    });
  }
  it('every branch of the working is drawn at least once', () => {
    for (const k of ['y5-fracadd:Same bottom', 'y5-fracadd:Make the bottoms', 'y5-fracadd:1 ', 'y6-fracadd:Bottoms to', 'y6-fracadd:Fractions:', 'y6-fracadd:Swap a whole'])
      expect(seen[k], k).toBeGreaterThan(0);
    expect(Object.keys(seen).filter(k => k.endsWith(':other'))).toEqual([]);
  });
});
