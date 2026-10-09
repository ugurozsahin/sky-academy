// y5-fracmult (#1198): Year 5 multiplying proper fractions and mixed numbers by a whole number (5M26). d1 a unit fraction
// bar times a whole with a product under 1 (3 × 1/4 = 3/4; the bar shows the unit fraction, never the product); d2 a
// non-unit fraction whose product is over 1, written as a mixed number (4 × 2/5 = 1 3/5); d3 a mixed number times a whole
// (3 × 1 2/5 = 4 1/5). Every card is checked by value with `fractions.ts`, so no decoy is ever worth the answer. The slips
// are multiplying the bottom too, adding the whole instead, multiplying only the whole part, and swapping quotient and remainder.
import type { Difficulty, Generator, Question, Rng } from './types';
import { ri, wordQ, numberWord } from './util';
import { equal, parseFrac, type Frac } from './fractions';
import { ks2Say } from './ks2say';

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
const mixed = (whole: number, n: number, d: number) => (whole ? `${whole} ${n}/${d}` : `${n}/${d}`);

/** Up to three distinct decoys not worth `answer` by value, topped up with neighbours of its whole and fraction parts. */
function decoys(answer: string, slips: string[], whole: number, rem: number, d: number): string[] {
  const target = parseFrac(answer) as Frac;
  const fill = [mixed(whole + 1, rem, d), mixed(Math.max(whole - 1, 0), rem, d), mixed(whole, Math.min(rem + 1, d - 1), d), mixed(whole, Math.max(rem - 1, 1), d)];
  const out: string[] = [];
  for (const c of [...slips, ...fill]) {
    const f = parseFrac(c);
    if (f && c !== answer && !equal(f, target) && !out.includes(c) && out.length < 3) out.push(c);
  }
  return out;
}

function d1Card(rng: Rng): Question {
  const b = ri(rng, 3, 12), k = ri(rng, 2, Math.min(6, b - 1)), unit = `1/${b}`, ans = `${k}/${b}`;
  const slips = [`${k}/${b * k}`, `${k + 1}/${b}`, `1/${b + k}`, `${b}/${k}`];
  return wordQ(rng, `${k} × ${unit} = ?`, ans, decoys(ans, slips, 0, k, b),
    { visual: { type: 'fraction', parts: b, shaded: 1, shape: 'bar' }, say: `${cap(numberWord(k))} times ${ks2Say(unit)} equals what?`,
      hint: 'Multiply the top by the whole number. The bottom stays the same', hintIsData: false });
}

/** A non-unit fraction n/b times k whose product is over 1 and not a whole number. */
function d2Card(rng: Rng): Question {
  let b: number, n: number, k: number;
  do { b = ri(rng, 3, 12); n = ri(rng, 2, b - 1); k = ri(rng, 2, 6); } while (n * k <= b || (n * k) % b === 0);
  const top = n * k, whole = Math.floor(top / b), rem = top % b, fr = `${n}/${b}`, ans = mixed(whole, rem, b);
  const slips = [`${top}/${b * k}`, `${n + k}/${b}`, mixed(rem, whole, b), mixed(whole + 1, n, b)];
  return wordQ(rng, `${k} × ${fr} = ? Give it as a mixed number.`, ans, decoys(ans, slips, whole, rem, b),
    { say: `${cap(numberWord(k))} times ${ks2Say(fr)} equals what? Give it as a mixed number.`,
      hint: 'Multiply the top, then turn the extra into wholes', hintIsData: false });
}

function d3Card(rng: Rng): Question {
  let b: number, w: number, a: number, k: number;
  do { b = ri(rng, 2, 8); w = ri(rng, 1, 3); a = ri(rng, 1, b - 1); k = ri(rng, 2, 6); } while ((k * a) % b === 0);
  const top = k * (w * b + a), whole = Math.floor(top / b), rem = top % b, mx = `${w} ${a}/${b}`, ans = mixed(whole, rem, b);
  const slips = [`${w * k} ${a}/${b}`, `${w + k} ${a}/${b}`, mixed(rem, whole, b), `${w * k} ${a * k}/${b * k}`, `${k * w + a} ${k}/${b}`];
  return wordQ(rng, `${k} × ${mx} = ? Give it as a mixed number.`, ans, decoys(ans, slips, whole, rem, b),
    { say: `${cap(numberWord(k))} times ${ks2Say(mx)} equals what? Give it as a mixed number.`,
      hint: 'Multiply the wholes and the fractions, then put them together', hintIsData: false });
}

export const y5FracMult: Generator = (level: Difficulty, rng) => {
  if (level === 1) return d1Card(rng);
  if (level === 2) return d2Card(rng);
  return rng() < 0.75 ? d3Card(rng) : d2Card(rng);
};
