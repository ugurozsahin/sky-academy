// y5-imperial (#1204): Year 5 approximate metric and imperial equivalences (5M35). The school table is 1 in ≈ 2.5 cm, 1 foot ≈ 30 cm,
// 1 kg ≈ 2.2 lb and 1 pint ≈ 570 ml, each card using one direction. d1 is a single equivalence, d2 scales it, d3 reverses it or asks
// which of two amounts is more. Every answer is within 10 % of the exact conversion and every decoy at least 40 % away from it, so
// "about" never decides a card. Decoys are named slips, tried in a fixed order: the inverse operation, ×10, ÷10, another pair's
// factor, then ×2 and ÷2. `finish()` is not used: its ± fill would break the 40 % rule.
import type { Difficulty, Generator, Question, Rng } from './types';
import { pick, wordQ } from './util';
import { dec, fmt, type Dec } from './ks2num';
import { ks2Say } from './ks2say';

/** `f10` is tenths of `b` per one `a` (the school table); `exact` is the true factor, used only as the oracle. */
interface Eq { a: string; aOne: string; aMany: string; b: string; bOne: string; bMany: string; f10: number; exact: number; fwd: number[]; rev: number[] }
const EQS: Eq[] = [
  { a: 'in', aOne: 'inch', aMany: 'inches', b: 'cm', bOne: 'centimetre', bMany: 'centimetres', f10: 25, exact: 2.54, fwd: [2, 3, 4, 6, 8, 10, 12], rev: [2, 4, 6, 8, 10, 12] },
  { a: 'foot', aOne: 'foot', aMany: 'feet', b: 'cm', bOne: 'centimetre', bMany: 'centimetres', f10: 300, exact: 30.48, fwd: [2, 3, 4, 5, 6], rev: [2, 3, 4, 5, 6] },
  { a: 'kg', aOne: 'kilogram', aMany: 'kilograms', b: 'lb', bOne: 'pound', bMany: 'pounds', f10: 22, exact: 2.2046, fwd: [2, 3, 4, 5, 10], rev: [2, 3, 4, 5, 10] },
  { a: 'pint', aOne: 'pint', aMany: 'pints', b: 'ml', bOne: 'millilitre', bMany: 'millilitres', f10: 5700, exact: 568.26, fwd: [2, 3, 4, 5, 6, 8], rev: [2, 3, 4, 5, 6, 8] },
];

const lab = (e: Eq, which: 'a' | 'b', n: number) => which === 'b' || e.a === 'in' || e.a === 'kg' ? e[which] : n === 1 ? e.aOne : e.aMany;
const spoken = (e: Eq, which: 'a' | 'b', n: number) => (which === 'a' ? (n === 1 ? e.aOne : e.aMany) : (n === 1 ? e.bOne : e.bMany));
const HINT_FWD = 'Multiply to change into the smaller unit, divide to change into the bigger one';
const HINT_CMP = 'Change one amount into the other\'s unit, then compare';

/** Whole when the answer is 10 or more, otherwise one decimal place. */
function round(x: number, whole: boolean): Dec {
  return whole ? dec(Math.round(x), 0) : dec(Math.round(x * 10), 1);
}
const value = (d: Dec) => d.v / 10 ** d.dp;

/** The first three decoys from the named slips that are ≥ 40 % from `exact`, within 100× either way of it (#1902), nonzero once rounded and distinct. */
function decoys(source: number, answer: Dec, exact: number, whole: boolean, forward: boolean, f: number, others: number[]): string[] {
  const op = (x: number, y: number) => forward ? x * y : x / y;
  const inverse = (x: number, y: number) => forward ? x / y : x * y;
  const named = [inverse(source, f), op(source, f) * 10, op(source, f) / 10, ...others.map(o => op(source, o)), op(source, f) * 2, op(source, f) / 2];
  const out: string[] = [], seen = new Set([fmt(answer)]);
  for (const c of named) {
    const d = round(c, whole), s = fmt(d), v = value(d);
    if (out.length < 3 && d.v !== 0 && !seen.has(s) && Math.abs(v - exact) >= 0.4 * exact && v <= 100 * exact && v >= exact / 100) { out.push(s); seen.add(s); }
  }
  return out;
}

/** "4 in ≈ ? cm" (forward) or "30 cm ≈ ? in" (reverse): the table value is exact, the oracle is the true conversion. */
function convert(rng: Rng, e: Eq, k: number, forward: boolean): Question {
  const metricAmt = (k * e.f10) / 10;
  const src = forward ? k : metricAmt, ans = forward ? metricAmt : k;
  const answer = round(ans, ans >= 10), whole = ans >= 10;
  const exact = forward ? k * e.exact : metricAmt / e.exact;
  const fromW: 'a' | 'b' = forward ? 'a' : 'b', toW: 'a' | 'b' = forward ? 'b' : 'a';
  const others = EQS.filter(o => o !== e).map(o => o.f10 / 10);
  const ds = decoys(src, answer, exact, whole, forward, e.f10 / 10, others);
  const fromS = fmt(round(src, src >= 10)), prompt = `${fromS} ${lab(e, fromW, src)} is about ? ${lab(e, toW, ans)}`;
  const say = ks2Say(`About how many ${spoken(e, toW, 2)} is ${fromS} ${spoken(e, fromW, src)}?`);
  const why = `1 ${lab(e, 'a', 1)} ≈ ${(e.f10 / 10).toLocaleString('en-GB')} ${e.b}: ${fromS} ${forward ? '×' : '÷'} ${(e.f10 / 10).toLocaleString('en-GB')} = ${fmt(answer)}`;
  return wordQ(rng, prompt, fmt(answer), ds, { say, hint: HINT_FWD, hintIsData: false, why });
}

/** Imperial amount against a metric one: the larger is at least 25 % more than the smaller, judged on the exact conversion. */
interface Cmp { word: string; ask: string; imp: (n: number) => string; met: (n: number) => string; impW: (n: number) => string; metW: (n: number) => string; ns: number[]; toMetric: (n: number) => number; nice: (x: number) => number }
const plural = (n: number, one: string, many: string) => `${fmt(dec(n, 0))} ${n === 1 ? one : many}`;
const CMPS: Cmp[] = [
  { word: 'longer', ask: 'Which is longer?', imp: n => `${n} in`, met: n => `${fmt(dec(n, 0))} cm`, impW: n => plural(n, 'inch', 'inches'), metW: n => plural(n, 'centimetre', 'centimetres'),
    ns: [1, 2, 3, 4, 6, 8, 10, 12], toMetric: n => n * 2.54, nice: x => Math.max(1, Math.round(x)) },
  { word: 'longer', ask: 'Which is longer?', imp: n => `${n} ${n === 1 ? 'foot' : 'feet'}`, met: n => `${fmt(dec(n, 0))} cm`, impW: n => plural(n, 'foot', 'feet'), metW: n => plural(n, 'centimetre', 'centimetres'),
    ns: [1, 2, 3, 4, 5], toMetric: n => n * 30.48, nice: x => Math.max(10, Math.round(x / 10) * 10) },
  { word: 'heavier', ask: 'Which is heavier?', imp: n => `${n} lb`, met: n => `${n} kg`, impW: n => plural(n, 'pound', 'pounds'), metW: n => plural(n, 'kilogram', 'kilograms'),
    ns: [3, 4, 5, 6, 8, 10, 12], toMetric: n => n / 2.2046, nice: x => Math.max(1, Math.round(x)) },
  { word: 'more', ask: 'Which is more?', imp: n => `${n} ${n === 1 ? 'pint' : 'pints'}`, met: n => `${fmt(dec(n, 0))} ml`, impW: n => plural(n, 'pint', 'pints'), metW: n => plural(n, 'millilitre', 'millilitres'),
    ns: [1, 2, 3, 4, 5], toMetric: n => n * 568.26, nice: x => Math.max(100, Math.round(x / 100) * 100) },
];

function compare(rng: Rng): Question {
  const c = pick(rng, CMPS);
  for (let tries = 0; tries < 50; tries++) {
    const n = pick(rng, c.ns), exactImp = c.toMetric(n), m = c.nice(exactImp * pick(rng, [0.5, 0.6, 0.7, 1.4, 1.6, 2]));
    if (Math.max(exactImp, m) < 1.25 * Math.min(exactImp, m)) continue;
    const impBig = exactImp > m, big = impBig ? c.imp(n) : c.met(m), small = impBig ? c.met(m) : c.imp(n);
    const say = ks2Say(`${c.ask.slice(0, -1)}, ${c.impW(n)} or ${c.metW(m)}?`);
    // #2317: under 10 the conversion keeps one decimal ("3 lb is about 1.4 kg"), so a whole-number round never blurs the comparison
    const approx = exactImp < 10 ? String(Number(exactImp.toFixed(1))) : c.met(c.nice(exactImp)).split(' ')[0];
    const why = `${c.imp(n)} is about ${approx} ${c.met(0).split(' ')[1]}, so ${big} is ${c.word}`;
    return wordQ(rng, c.ask, big, [small], { say, hint: HINT_CMP, hintIsData: false, why });
  }
  throw new Error('y5-imperial: no comparison with a 25 % margin found');
}

export const y5Imperial: Generator = (level: Difficulty, rng) => {
  if (level === 1) return convert(rng, pick(rng, EQS), 1, true);
  if (level === 2) { const e = pick(rng, EQS); return convert(rng, e, pick(rng, e.fwd), true); }
  if (rng() < 0.6) { const e = pick(rng, EQS); return convert(rng, e, pick(rng, e.rev), false); }
  return compare(rng);
};
