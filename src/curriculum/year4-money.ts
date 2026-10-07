// y4-money (#1149): money written as a decimal for the first time (£3.45; Year 3 and below write "£3 and 45p").
// Every amount is held in whole pence and every label is £x.yy, £0.01–£99.99 (no comma ever arises). Plain
// prompts, no coins visual (#1041). Speech never says a decimal point: amounts go through `poundsSay`, a
// fraction through `ks2Say` (#1057).
// d1 notation (345p = £3.45, which is more); d2 add, subtract and change; d3 one-step fraction and multiplier problems.
import type { Difficulty, Generator, Question, Rng } from './types';
import { ri, pick, shuffle, wordQ } from './util';
import { dec, fmt } from './ks2num';
import { ks2Say } from './ks2say';

const MAX = 9999;
/** £3.45, £0.45, £12.00 — always two decimal places. */
export const pounds = (p: number): string => '£' + fmt(dec(p, 2), { fixedDp: 2 });
/** Spoken form of an amount: "3 pounds 45", "45 pence", "12 pounds". */
export function poundsSay(p: number): string {
  const l = Math.floor(p / 100), r = p % 100;
  if (l === 0) return `${r} ${r === 1 ? 'penny' : 'pence'}`;
  const pw = `${l} ${l === 1 ? 'pound' : 'pounds'}`;
  return r === 0 ? pw : `${pw} ${r}`;
}

/** The two pence digits swapped (£3.45 → £3.54); the amount itself when the digits match. */
const swapPence = (p: number): number => { const r = p % 100; return p - r + (r % 10) * 10 + Math.floor(r / 10); };
const sign = (rng: Rng) => (rng() < 0.5 ? -1 : 1);

/** Three distinct amounts in range that are not the answer; `first` leads, then neighbours in whole pence fill any gap. */
export function moneyDecoys(answer: number, first: number[]): number[] {
  const out: number[] = [];
  for (const c of [...first, answer + 1, answer - 1, answer + 2, answer - 2, answer + 3])
    if (c >= 1 && c <= MAX && c !== answer && !out.includes(c)) out.push(c);
  return out.slice(0, 3);
}

const lab = (p: number) => pounds(p);
function ask(rng: Rng, prompt: string, say: string, answer: number, decoys: number[], hint: string): Question {
  return wordQ(rng, prompt, lab(answer), decoys.map(lab), { say, hint, hintIsData: false });
}

/** d1: pence to pounds. 305p must offer £30.50 (the place-value shift) and £3.50 (the zero dropped). */
function notation(rng: Rng): Question {
  const l = ri(rng, 1, 9), r = rng() < 0.4 ? ri(rng, 1, 9) : ri(rng, 10, 99), p = l * 100 + r;
  const shifted = p * 10, second = r < 10 ? l * 100 + r * 10 : swapPence(p);
  return ask(rng, `${p}p = ?`, `${p} pence is how much in pounds?`, p, moneyDecoys(p, [shifted, p + sign(rng) * 100, second]), 'Every hundred pence make one pound, so split the pence into pounds and pence');
}

/** d1 only: "Which is more: £4.05 or 399p?" — two bubbles, both written £x.yy. */
export function compareCard(rng: Rng): Question {
  const p = ri(rng, 131, 969), q = p + sign(rng) * ri(rng, 1, 30), pounds1 = rng() < 0.5;
  const a = pounds1 ? q : p, b = pounds1 ? p : q;
  return wordQ(rng, `Which is more: ${lab(a)} or ${b}p?`, lab(Math.max(p, q)), [lab(Math.min(p, q))],
    { say: `Which is more: ${poundsSay(a)} or ${b} pence?`, hint: 'Write both amounts in pence, then compare', hintIsData: false });
}

/** d2: add or subtract two amounts, or change from £5, £10 or £20. */
function sums(rng: Rng): Question {
  const k = rng();
  let prompt: string, say: string, ans: number;
  if (k < 0.34) {
    const a = ri(rng, 100, 4900), b = ri(rng, 50, 4900); ans = a + b;
    prompt = `${lab(a)} + ${lab(b)} = ?`; say = `${poundsSay(a)} plus ${poundsSay(b)} equals what?`;
  } else if (k < 0.67) {
    const a = ri(rng, 300, 9500), b = ri(rng, 50, a - 50); ans = a - b;
    prompt = `${lab(a)} − ${lab(b)} = ?`; say = `${poundsSay(a)} take away ${poundsSay(b)} equals what?`;
  } else {
    const pay = pick(rng, [500, 1000, 2000]), cost = ri(rng, 105, pay - 5); ans = pay - cost;
    prompt = `${lab(cost)} from ${lab(pay).replace('.00', '')}. Change?`; say = `You pay with ${poundsSay(pay)} for ${poundsSay(cost)}. What is the change?`;
  }
  return ask(rng, prompt, say, ans, moneyDecoys(ans, [ans + sign(rng) * 100, ans + sign(rng) * 10, swapPence(ans)]), 'Add or take away the pounds and the pence, and watch for a carry');
}

const ITEMS = ['book', 'kite', 'scarf', 'game', 'puzzle', 'toy car', 'football', 'diary'];
const SMALL = ['pen', 'rubber', 'sticker pack', 'pencil', 'badge', 'balloon'];
const FRACS: ReadonlyArray<readonly [number, number]> = [[1, 2], [1, 4], [3, 4], [1, 5], [2, 5], [1, 10], [3, 10]];

/** d3: one fraction or multiplier step. Every fraction of an amount is whole pence (the price is u × den). */
function problems(rng: Rng): Question {
  const t = ri(rng, 0, 5);
  if (t >= 4) {
    const unit = ri(rng, 20, 495), n = ri(rng, 2, t === 4 ? 9 : 6);
    if (t === 4) {
      const item = pick(rng, SMALL), ans = unit * n;
      return ask(rng, `${n} ${item}s at ${lab(unit)} each. How much?`, `${n} ${item}s at ${poundsSay(unit)} each. How much?`, ans,
        moneyDecoys(ans, [unit, ans + sign(rng) * 100, unit * (n + sign(rng)), ans + sign(rng) * 10]), 'Multiply the cost of one by how many');
    }
    const total = unit * n;
    return ask(rng, `${lab(total)} is shared equally by ${n} friends. Each gets?`, `${poundsSay(total)} is shared equally by ${n} friends. How much does each get?`, unit,
      moneyDecoys(unit, [unit + sign(rng) * 100, total, unit + sign(rng) * 10, swapPence(unit)]), 'Divide the money by the number of friends');
  }
  const [num, den] = pick(rng, FRACS), u = ri(rng, 10, Math.floor(MAX / den / 2)), price = u * den, off = u * num, item = pick(rng, ITEMS);
  const f = `${num}/${den}`, fs = ks2Say(f);
  const tpl = [
    [`A ${item} costs ${lab(price)}. It is ${f} off. How much is taken off?`, `A ${item} costs ${poundsSay(price)}. It is ${fs} off. How much is taken off?`, off, [price - off, u, off + sign(rng) * 100, off + sign(rng) * 10]],
    [`${f} off a ${lab(price)} ${item}. What is the saving?`, `${fs} off a ${poundsSay(price)} ${item}. What is the saving?`, off, [price - off, u, off + sign(rng) * 100, off + sign(rng) * 10]],
    [`A ${item} costs ${lab(price)}. It is ${f} off. What is the new price?`, `A ${item} costs ${poundsSay(price)}. It is ${fs} off. What is the new price?`, price - off, [off, price - off + sign(rng) * 100, price - u, price - off + sign(rng) * 10]],
    [`${lab(price)} ${item}, sale: ${f} off. Pay?`, `A ${poundsSay(price)} ${item} in a sale: ${fs} off. How much do you pay?`, price - off, [off, price - off + sign(rng) * 100, price - u, price - off + sign(rng) * 10]],
  ][t] as [string, string, number, number[]];
  // the unit-fraction amount (u) is a real decoy only when it differs from the answer, i.e. on a non-unit fraction
  return ask(rng, tpl[0], tpl[1], tpl[2], moneyDecoys(tpl[2], shuffle(rng, tpl[3].slice(0, 2)).concat(tpl[3].slice(2))), 'Find one part first, then take the right number of parts');
}

/** Every card but the d1 "Which is more?" form, which prints both options in its prompt (#1058 leak test). */
export function y4MoneyCard(level: Difficulty, rng: Rng): Question {
  return level === 1 ? notation(rng) : level === 2 ? sums(rng) : problems(rng);
}

export const y4Money: Generator = (level, rng) => (level === 1 && rng() < 0.25 ? compareCard(rng) : y4MoneyCard(level, rng));
