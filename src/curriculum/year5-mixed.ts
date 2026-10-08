// y5-mixed (#1196): mixed numbers and improper fractions, both ways (5M24), pick the answer. d1 improper → mixed (7/4 = ?);
// d2 mixed → improper (2 3/5 = ?); d3 a sum over 1 written as a mixed number (2/5 + 4/5 = ?). A mixed answer keeps the card's
// denominator (1 2/4, not 1 1/2). Every decoy is checked by value against the answer (#296), so the unconverted 6/5 is never offered.
import type { Difficulty, Generator, Question, Rng } from './types';
import { ri, pick, shuffle, wordQ } from './util';
import { equal, parseFrac, type Frac } from './fractions';
import { ks2Say } from './ks2say';

const imp = (n: number, d: number) => `${n}/${d}`;
const mix = (w: number, n: number, d: number) => `${w} ${n}/${d}`;
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

/** Slips first (shuffled), then any that differ from the answer by value; label-valid only (n ≥ 1, n < 100). */
function decoys(rng: Rng, answer: string, slips: string[]): string[] {
  const a = parseFrac(answer) as Frac;
  const out: string[] = [];
  for (const s of shuffle(rng, slips)) {
    const f = parseFrac(s);
    if (f && f.n > 0 && !equal(f, a) && !out.includes(s) && !out.some(o => equal(parseFrac(o) as Frac, f))) out.push(s);
  }
  return out;
}

const q = (rng: Rng, prompt: string, answer: string, slips: string[], say: string, hint: string): Question =>
  wordQ(rng, prompt, answer, decoys(rng, answer, slips), { say, hint, hintIsData: false });

function toMixed(rng: Rng): Question {
  const d = ri(rng, 2, 12), w = ri(rng, 1, 5), r = ri(rng, 1, d - 1), n = w * d + r, ans = mix(w, r, d);
  const lab = imp(n, d);
  return q(rng, `${lab} = ?`, ans, [mix(r, w, d), imp(n - d, d), mix(w + 1, r, d), mix(w, d - r, d), mix(w - 1, r, d), mix(w, r, d + 1)],
    `${cap(ks2Say(lab))} equals what mixed number?`, 'How many whole ones fit in the top? What is left over?');
}

function toImproper(rng: Rng): Question {
  const d = ri(rng, 2, 12), w = ri(rng, 1, 5), r = ri(rng, 1, d - 1), ans = imp(w * d + r, d);
  const lab = mix(w, r, d);
  return q(rng, `${lab} = ?`, ans, [imp(w + r, d), imp(w * r + d, d), imp(w * d - r, d), imp(w * d + r, w * d), imp(w * d + r + 1, d), imp(w * d + r - 1, d)],
    `${cap(ks2Say(lab))} equals what fraction?`, 'Whole × bottom, then add the top');
}

function sumOver1(rng: Rng): Question {
  for (;;) {
    const d = ri(rng, 3, 12), a = ri(rng, 2, d - 1), b = ri(rng, 2, d - 1), t = a + b;
    if (t <= d) continue;
    const w = Math.floor(t / d), r = t - w * d;
    if (r === 0) continue;
    const ans = mix(w, r, d), p = `${imp(a, d)} + ${imp(b, d)} = ?`;
    return q(rng, `${p} Write it as a mixed number.`, ans, [imp(t, d + d), mix(w + 1, r, d), mix(w, b, d), mix(w, a, d), mix(w, t, d), mix(w - 1, r, d)],
      `${cap(ks2Say(p.replace(' = ?', '')))} equals what? Write it as a mixed number.`, 'Add the tops, then see how many wholes it makes');
  }
}

export const y5Mixed: Generator = (d: Difficulty, rng): Question => (d === 1 ? toMixed(rng) : d === 2 ? toImproper(rng) : pick(rng, [sumOver1, toImproper, toMixed])(rng));
