// Year 2: derive related facts up to 100 from facts to 10 (#1000). Lives in its own module because year2.ts and
// util.ts are on the #714 ratchet — see year2-topics.ts's header for the import direction rule this file follows.
import type { Generator } from './types';
import { ri, numQ, symSay } from './util';

/**
 * "3 + 4 = 7, so 30 + 40 = ?" — the known fact is shown beside its tens version. d1 adds (fact sum ≤ 10), d2
 * subtracts (90 − 50 from 9 − 5), d3 hides a middle number (`30 + ? = 70`, `90 − ? = 40`). Every prompt keeps
 * the plain `a op b = c` shape, so the generic arithmetic oracle checks it for free.
 */
export const y2Related: Generator = (d, rng) => {
  const sub = d === 2 || (d >= 3 && rng() < 0.5);
  let a: number, b: number, c: number;   // the fact is a + b = c, or c − b = a when subtracting
  if (sub) { c = ri(rng, 3, 10); b = ri(rng, 1, c - 1); a = c - b; } else { a = ri(rng, 1, 9); b = ri(rng, 1, Math.min(9, 10 - a)); c = a + b; }
  const fact = sub ? `${c} − ${b} = ${a}` : `${a} + ${b} = ${c}`;
  const hidden = d >= 3 ? (rng() < 0.5 ? 'b' : 'r') : 'r';   // d3: the second number or the result is the unknown
  const [x, y, z] = sub ? [c, b, a] : [a, b, c];             // the prompt reads x op y = z
  const op = sub ? '−' : '+';
  const t = (n: number) => String(n * 10);
  const prompt = hidden === 'b' ? `${t(x)} ${op} ? = ${t(z)}` : `${t(x)} ${op} ${t(y)} = ?`;
  const known = hidden === 'b' ? y : z;                      // the unscaled fact number the child is hunting for
  return numQ(rng, prompt, known * 10, {
    min: 0, max: 100,
    distractors: [known, known * 10 - 10, known * 10 + 10],
    visual: { type: 'word', text: fact },
    say: `${symSay(fact)}. So ${symSay(prompt)}`,
  });
};
