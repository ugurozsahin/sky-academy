// y6-decdiv (#1267): written division where the answer has up to 2 decimal places (NC 6M22, 9 ÷ 4 = 2.25). d1 a 1–2 digit whole
// number ÷ 2, 4 or 5; d2 a 3-digit whole number or a 1 dp number ÷ 2–9 (both pick-one); d3 a 3–4 digit number ÷ 20, 25, 40 or 50, built
// digit by digit (`buildQ`, the point stays fixed, `slow`). Every value is a scaled integer (`ks2num.ts`), never a float; the
// answer is always 1–2 dp. The first decoy is the slip this topic exists for: the remainder written as the decimal (9 ÷ 4 → 2 r 1 → 2.1).
import type { Difficulty, Generator, Question, Rng } from './types';
import { ri, pick, shuffle, wordQ } from './util';
import { buildQ } from './build';
import { dec, fmt, mulPow10, divPow10, addDec, subDec, parseNum, type Dec } from './ks2num';
import { ks2Say } from './ks2say';

const lab = (a: Dec) => fmt(a);
const canon = (a: Dec): Dec => parseNum(fmt(a))!;
const digits = (s: string) => s.replace(/\D/g, '');
const twins = (ds: string[], ans: string) => ds.some(d => digits(d).slice(-1) === digits(ans).slice(-1)) && ds.some(d => digits(d)[0] === digits(ans)[0]);

/** `dividend` (a scaled integer at `dp` places) ÷ `k` as a Dec, or null unless the answer is exact at ≤2 dp and not whole. */
function quotient(dividend: number, dp: number, k: number): Dec | null {
  const hundredths = dividend * 10 ** (2 - dp);
  if (hundredths % k) return null;
  const ans = canon(dec(hundredths / k, 2));
  return ans.dp === 0 || ans.v <= 0 ? null : ans;
}

/** The remainder-as-decimal slip: the whole quotient, a point, then the remainder (147 ÷ 4 → 36 r 3 → 36.3). */
function remainderSlip(dividend: number, dp: number, k: number): Dec | null {
  const slip = parseNum(`${Math.floor(dividend / k)}.${dividend % k}`);
  return slip && (dp === 0 ? slip : divPow10(slip, dp as 1 | 2 | 3));
}

/** Swap a slip (never the first, a named one) for a fill until the options hold a last- and a leading-digit twin of the answer (#1058). */
function keepTwins(out: string[], fills: string[], ans: string): void {
  for (let i = 1; i < out.length && !twins(out, ans); i++) {
    const swap = fills.find(f => !out.includes(f) && twins(out.map((x, j) => j === i ? f : x), ans));
    if (swap) out[i] = swap;
  }
}

/** Three decoys: the remainder slip first, then a place-value shift, the answer cut to 1 dp, and fills by tens of its last place. */
function decoys(dividend: number, dp: number, k: number, ans: Dec, rng: Rng): string[] {
  const cut = ans.dp === 2 ? dec(Math.floor(ans.v / 10), 1) : null;
  const named: (Dec | null)[] = [remainderSlip(dividend, dp, k), rng() < 0.5 ? mulPow10(ans, 1) : divPow10(ans, 1), cut, rng() < 0.5 ? divPow10(ans, 1) : mulPow10(ans, 1)];
  const labels = (ds: (Dec | null)[]) => ds.filter((d): d is Dec => !!d && d.v > 0).map(d => lab(canon(d))).filter(l => l !== lab(ans));
  const fills = labels(shuffle(rng, [1, 10, 100].flatMap(m => [addDec(ans, dec(m, ans.dp)), subDec(ans, dec(m, ans.dp))])));
  const out = [...new Set([...labels(named), ...fills])].slice(0, 3);
  keepTwins(out, fills, lab(ans));
  return out;
}

/** The why (#2317): a whole dividend shows the remainder turned into a decimal (147 ÷ 4 = 36 r 3; 3 ÷ 4 = 0.75: 36.75); a 1 dp one is divided as hundredths. */
function whyOf(dividend: number, dp: number, k: number, ans: Dec): string {
  if (dp === 1) return `${dividend * 10} hundredths ÷ ${k} = ${dividend * 10 / k} hundredths: ${lab(ans)}`;
  const r = dividend % k;
  return `${dividend.toLocaleString('en-GB')} ÷ ${k} = ${Math.floor(dividend / k)} r ${r}; ${r} ÷ ${k} = ${lab(canon(dec(r * 100 / k, 2)))}: ${lab(ans)}`;
}

function pickOne(rng: Rng, dividend: number, dp: number, k: number, ans: Dec): Question {
  const expr = `${lab(dec(dividend, dp))} ÷ ${k}`;
  return wordQ(rng, `${expr} = ?`, lab(ans), decoys(dividend, dp, k, ans, rng), { say: `What is ${ks2Say(expr)}?`, hint: 'Divide, then carry on past the point with the remainder', hintIsData: false, why: whyOf(dividend, dp, k, ans) });
}

/** d1: a 1–2 digit whole number ÷ 2, 4 or 5 with a non-whole answer. */
function d1(rng: Rng): Question {
  for (;;) {
    const n = ri(rng, 3, 99), k = pick(rng, [2, 4, 5]), ans = quotient(n, 0, k);
    if (ans) return pickOne(rng, n, 0, k, ans);
  }
}

/** d2: a 3-digit whole number or a 1 dp number (11–99 tenths, not a whole) ÷ 2–9. */
function d2(rng: Rng): Question {
  for (;;) {
    const tenths = rng() < 0.5, n = tenths ? ri(rng, 11, 99) : ri(rng, 100, 999), k = ri(rng, 2, 9);
    if (tenths && n % 10 === 0) continue;
    const ans = quotient(n, tenths ? 1 : 0, k);
    if (ans) return pickOne(rng, n, tenths ? 1 : 0, k, ans);
  }
}

/** d3: a 3–4 digit number ÷ 20, 25, 40 or 50, built; the answer is never whole, so the point is always fixed on the card. */
function built(rng: Rng): Question {
  for (;;) {
    const n = ri(rng, 100, 9999), k = pick(rng, [20, 25, 40, 50]), ans = quotient(n, 0, k);
    if (!ans) continue;
    const sum = `${n.toLocaleString('en-GB')} ÷ ${k} = ?`, answer = lab(ans);
    return { ...buildQ(rng, { prompt: sum, say: `${ks2Say(sum.slice(0, -4))}. Build the answer.`, answer, total: Math.min(10, digits(answer).length + 3), hint: 'Slice the digits in order' }), slow: true, why: whyOf(n, 0, k, ans) };
  }
}

export const y6DecDiv: Generator = (d: Difficulty, rng: Rng): Question => d === 1 ? d1(rng) : d === 2 ? d2(rng) : built(rng);
