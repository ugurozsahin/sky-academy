// y6-fdp (#1264): a fraction as a division, and fraction–decimal–percentage recall (NC Y6 Fractions). d1 "3 ÷ 4 as a fraction" and its
// reverse, d2 recall over halves, quarters, fifths and tenths in all six directions, d3 decimal equivalents by division (eighths, and
// recurring cases rounded to 3 dp). Values are exact: decimals are integer thousandths printed by `fmt`, never a float. A decoy is never
// equal in value to the answer, whatever its notation. Decoys are the slips: tops-and-bottoms, digit-join, place-value shift, rounding.
import type { Difficulty, Generator, Question, Rng } from './types';
import { ri, pick, wordQ } from './util';
import { dec, fmt } from './ks2num';
import { ks2Say } from './ks2say';

/** An option and its exact value `n/d`. */
interface Opt { readonly label: string; readonly n: number; readonly d: number }
const same = (a: Opt, b: Opt) => a.n * b.d === b.n * a.d;
const gcd = (a: number, b: number): number => b ? gcd(b, a % b) : a;
const frac = (n: number, d: number): Opt => ({ label: `${n}/${d}`, n, d });
const pct = (p: number): Opt => ({ label: `${p}%`, n: p, d: 100 });
/** `v` thousandths, printed exactly ("0.375", "2.667"). */
const th = (v: number): Opt => ({ label: fmt(dec(v, 3)), n: v, d: 1000 });
/** Round-half-up of 1000·n/d, in integers. */
const thousandths = (n: number, d: number) => Math.floor((2000 * n + d) / (2 * d));

/** Three distinct decoys: the named slips first (kept in order), then the fillers. */
function pickDecoys(ans: Opt, named: Opt[], fillers: Opt[]): string[] {
  const out: Opt[] = [];
  const add = (o: Opt) => { if (out.length < 3 && o.n > 0 && !same(o, ans) && o.label !== ans.label && !out.some(x => x.label === o.label)) out.push(o); };
  named.forEach(add);
  for (const f of fillers) add(f);
  return out.map(o => o.label);
}

/** `why` is the working a wrong slice is shown (#2317), ≤ 14 words. */
function card(rng: Rng, prompt: string, ans: Opt, named: Opt[], fillers: Opt[], hint: string, why: string): Question {
  return wordQ(rng, prompt, ans.label, pickDecoys(ans, named, fillers), { say: ks2Say(prompt), hint, hintIsData: false, why });
}

/** d1: a division written as a fraction, or the division that gives a fraction. Proper, lowest terms, tops 1–11, bottoms 2–12. */
function division(rng: Rng): Question {
  let n: number, d: number;
  do { d = ri(rng, 2, 12); n = ri(rng, 1, d - 1); } while (gcd(n, d) > 1);
  const nb = [n + 1, n - 1, n + 2].map(x => frac(x, d)), db = [d + 1, d - 1].map(x => frac(n, x));
  if (rng() < 0.5) {
    return card(rng, `${n} ÷ ${d} as a fraction`, frac(n, d), [frac(d, n), ...nb], db, 'A fraction bar means divided by', `${n} ÷ ${d} is ${n}/${d}`);
  }
  const div = (a: number, b: number): Opt => ({ label: `${a} ÷ ${b}`, n: a, d: b });
  return card(rng, `Which division gives ${n}/${d}?`, div(n, d), [div(d, n), div(n + 1, d), div(n, d + 1)], [div(n - 1, d), div(n, d - 1), div(n + 2, d)], 'A fraction bar means divided by', `${n}/${d} means ${n} ÷ ${d}`);
}

/** d2: the recall set as fractions in lowest terms (thirds are left out: 1/3 has no exact percentage). */
const SET: Frac2[] = [[1, 2], [1, 4], [3, 4], [1, 5], [2, 5], [3, 5], [4, 5], [1, 10], [3, 10], [7, 10], [9, 10]];
type Frac2 = [number, number];
const percentOf = ([n, d]: Frac2) => 100 * n / d;
type Notation = 'F' | 'D' | 'P';
const DIRECTIONS: [Notation, Notation][] = [['F', 'D'], ['F', 'P'], ['D', 'F'], ['D', 'P'], ['P', 'F'], ['P', 'D']];
const asOpt = (f: Frac2, kind: Notation): Opt => kind === 'F' ? frac(f[0], f[1]) : kind === 'P' ? pct(percentOf(f)) : th(percentOf(f) * 10);
const WORD: Record<Notation, string> = { F: 'a fraction', D: 'a decimal', P: 'a percentage' };

/** Every recall runs through "out of a hundred": the percentage is the top over 100, the decimal is that read in hundredths. */
function recallWhy([n, d]: Frac2, src: Notation, dst: Notation, ans: string): string {
  const p = percentOf([n, d]), dec = asOpt([n, d], 'D').label;
  if (src === 'F') return `${n}/${d} = ${p}/100: ${ans}`;
  const from = src === 'P' ? `${p}%` : dec;
  return dst === 'F' ? `${from} is ${p}/100, which is ${ans}` : `${from} is ${p}/100: ${ans}`;
}

function recall(rng: Rng): Question {
  const from = pick(rng, DIRECTIONS);
  const f = pick(rng, SET), [src, dst] = from, p = percentOf(f), ans = asOpt(f, dst);
  const others = SET.filter(g => g !== f);
  const near = [...others].sort((a, b) => Math.abs(percentOf(a) - p) - Math.abs(percentOf(b) - p)).map(g => asOpt(g, dst));
  const named: Opt[] = [];
  const digitsJoined = `${f[0]}${f[1]}`;
  if (dst === 'D') named.push(th(Number((digitsJoined + '000').slice(0, 3))), th(p), th(p * 100));   // 0.35 (digit join), 0.06, 6
  if (dst === 'P') named.push(pct(Number(digitsJoined)), pct(p / 10), pct(p * 10));                   // 35%, 6%, 600%
  if (dst === 'F') named.push(frac(f[1], f[0]), frac(1, Math.round(p / 10)), frac(1, p));             // tops-and-bottoms, "6 on the bottom"
  named.push(near[0], near[1], near[2]);
  const hint = dst === 'F' ? 'Think of the fraction as parts out of a hundred' : 'Per cent means out of a hundred';
  return card(rng, `${asOpt(f, src).label} as ${WORD[dst]}`, ans, named, [], hint, recallWhy(f, src, dst, ans.label));
}

/** d3 sources: eighths (exact) and recurring cases (rounded to 3 dp, marked by `rec`). */
const EIGHTHS: Frac2[] = [[1, 8], [3, 8], [5, 8], [7, 8]];
const RECURRING: Frac2[] = [[1, 3], [2, 3], [1, 6], [5, 6], [1, 9], [2, 9], [4, 9], [5, 9], [7, 9], [8, 9]];

function byDivision(rng: Rng): Question {
  const recurring = rng() < 0.5;
  const [n, d] = pick(rng, recurring ? RECURRING : EIGHTHS);
  const ans = th(thousandths(n, d));
  const trunc = th(Math.floor(1000 * n / d)), early = th(Math.round(thousandths(n, d) / 10) * 10);
  const digits = th(n * 1000 + d * 100), inverted = th(thousandths(d, n));
  const fills = (recurring ? RECURRING : EIGHTHS).map(g => th(thousandths(g[0], g[1])));
  const named = recurring ? [trunc, early, inverted, digits] : [early, digits, inverted];
  const prompt = recurring ? `${n}/${d} as a decimal to 3 decimal places` : rng() < 0.5 ? `${n} ÷ ${d} = ?` : `${n}/${d} as a decimal`;
  return card(rng, prompt, ans, named, fills, recurring ? 'Divide the top by the bottom, then round to 3 places' : 'Divide the top by the bottom',
    recurring ? `${n} ÷ ${d} is ${ans.label} to 3 places` : `${n} ÷ ${d} = ${ans.label}`);
}

export const y6Fdp: Generator = (d: Difficulty, rng: Rng): Question => d === 1 ? division(rng) : d === 2 ? recall(rng) : byDivision(rng);
