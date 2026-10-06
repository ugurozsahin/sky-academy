// y4-decimals (#1146): tenths, hundredths, ¼, ½ and ¾ written as decimals, both directions. Every value is a
// scaled integer (#1043), never a float. A card fixes its decimal places: 1 on tenths and ½, 2 on hundredths,
// ¼ and ¾, so the count never picks out the answer. Plain prompts, no visual (#1041).
// d1 tenths; d2 hundredths; d3 ¼ ½ ¾ and tenths beyond one (13/10 = 1.3).
import type { Difficulty, Generator, Question, Rng } from './types';
import { ri, pick, shuffle, wordQ } from './util';
import { dec, fmt } from './ks2num';
import { ks2Say } from './ks2say';

/** A value as n/d, so a decimal and a fraction compare exactly. */
type Val = readonly [number, number];
interface Opt { readonly label: string; readonly val: Val }
const same = (a: Val, b: Val) => a[0] * b[1] === b[0] * a[1];

/** A card: the fraction n/den and its decimal v at dp places (v = n × 10^dp ÷ den, always whole). */
export interface Spec { readonly n: number; readonly den: number; readonly dp: number }

const decOpt = (v: number, dp: number): Opt => ({ label: fmt(dec(v, dp), { fixedDp: dp }), val: [v, 10 ** dp] });
const fracOpt = (n: number, den: number): Opt => ({ label: `${n}/${den}`, val: [n, den] });
const decimalOf = (s: Spec): Opt => decOpt((s.n * 10 ** s.dp) / s.den, s.dp);
const isSimple = (s: Spec) => s.den === 2 || s.den === 4;

/** Decimal answer: the place-value shift (×10), the whole-number slip (+1), the fraction's digits pushed together on ¼ ½ ¾, then a neighbour in the last place. */
export function decimalDecoys(rng: Rng, s: Spec): Opt[] {
  const v = (s.n * 10 ** s.dp) / s.den, one = 10 ** s.dp;
  const first = [decOpt(v * 10, s.dp), decOpt(v + one, s.dp)];
  if (isSimple(s)) first.push(decOpt(Number(`${s.n}${s.den}`), s.dp));
  return dedupe(decimalOf(s), [...first, ...shuffle(rng, [v - 1, v + 1, v - 2, v + 2].filter(x => x > 0)).map(x => decOpt(x, s.dp))]);
}

const reversed = (n: number) => Number(String(n).split('').reverse().join(''));

/** Fraction answer: the numerator over the other power of ten, the digits reversed, then neighbours; ¼ ½ ¾ cards offer each other and the digit-split slip (0.75 → 7/5). */
export function fractionDecoys(rng: Rng, s: Spec): Opt[] {
  const answer = fracOpt(s.n, s.den);
  if (isSimple(s)) {
    const others = [fracOpt(1, 2), fracOpt(1, 4), fracOpt(3, 4)];
    const digits = String((s.n * 10 ** s.dp) / s.den);
    // 0.75 → 7/5, 0.25 → 2/5; a one-digit decimal (0.5) has no split, so 1/5 stands in
    const slip = digits.length > 1 ? [fracOpt(Number(digits[0]), Number(digits.slice(-1)))] : [];
    return dedupe(answer, [...shuffle(rng, others), ...slip, fracOpt(1, 5), fracOpt(1, 3)]);
  }
  const other = fracOpt(s.n, s.den === 10 ? 100 : 10);
  const near = shuffle(rng, [s.n - 1, s.n + 1, s.n - 2, s.n + 2].filter(x => x > 0)).map(x => fracOpt(x, s.den));
  return dedupe(answer, [other, ...(s.n > 9 ? [fracOpt(reversed(s.n), s.den)] : []), ...near]);
}

/** The first three candidates that differ in value from the answer and from each other. */
function dedupe(answer: Opt, cands: Opt[]): Opt[] {
  const out: Opt[] = [];
  for (const c of cands) if (!same(c.val, answer.val) && !out.some(o => same(o.val, c.val))) out.push(c);
  return out.slice(0, 3);
}

function card(rng: Rng, s: Spec): Question {
  const toDecimal = rng() < 0.5;
  const f = fracOpt(s.n, s.den), d = decimalOf(s);
  const [from, to] = toDecimal ? [f, d] : [d, f];
  const ds = toDecimal ? decimalDecoys(rng, s) : fractionDecoys(rng, s);
  return wordQ(rng, `${from.label} = ?`, to.label, ds.map(o => o.label),
    { say: `${ks2Say(from.label)} equals what?`, hint: toDecimal ? 'Tenths have one decimal place, hundredths have two' : 'Read the decimal places: one is tenths, two is hundredths', hintIsData: false });
}

/** d1: tenths, 1/10 to 9/10. */
const tenths = (rng: Rng): Question => card(rng, { n: ri(rng, 1, 9), den: 10, dp: 1 });
/** d2: hundredths, 1/100 to 99/100, never a whole number of tenths (30/100 would equal 3/10). */
const hundredths = (rng: Rng): Question => card(rng, { n: pick(rng, Array.from({ length: 99 }, (_, i) => i + 1).filter(n => n % 10 !== 0)), den: 100, dp: 2 });
/** d3: ¼, ½ and ¾, or tenths beyond one (11/10 to 39/10, not a whole number). */
function stretch(rng: Rng): Question {
  if (rng() < 0.55) return card(rng, pick(rng, [{ n: 1, den: 4, dp: 2 }, { n: 1, den: 2, dp: 1 }, { n: 3, den: 4, dp: 2 }]));
  return card(rng, { n: pick(rng, Array.from({ length: 29 }, (_, i) => i + 11).filter(n => n % 10 !== 0)), den: 10, dp: 1 });
}

export const y4Decimals: Generator = (level: Difficulty, rng) => (level === 1 ? tenths(rng) : level === 2 ? hundredths(rng) : stretch(rng));
