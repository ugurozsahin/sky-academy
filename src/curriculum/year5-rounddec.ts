// y5-rounddec (#1200): Year 5 rounding decimals with two places to the nearest whole number and to one decimal place (5M29).
// d1 is the Year 4 recap, one place to the nearest whole (3.7 → 4); d2 is two places to the nearest whole, half the cards in
// pounds ("Round £3.46 to the nearest pound"); d3 is two places to one place (4.65 → 4.7, 3.96 → 4.0). Values are scaled
// integers (`ks2num.ts`), never floats, and halves round up. A one-place answer always prints its place (4.0, not 4).
// The slips are cutting the digits off, always rounding up, rounding to the wrong place and missing the carry on a 9.
// No decoy is worth the answer, so 4 is never offered beside 4.0. The answer shares its last printed digit with a decoy (#1058).
import type { Difficulty, Generator, Question, Rng } from './types';
import { ri, wordQ, numberWord } from './util';
import { addDec, subDec, compareDec, dec, fmt, roundTo, roundWhy, type Dec } from './ks2num';
import { ks2Say } from './ks2say';

const HINT = 'Look at the digit after the place you are rounding to: five or more rounds up';

type Kind = 'whole' | 'money' | 'dp1';
const show = (d: Dec, kind: Kind) => kind === 'money' ? `£${fmt(d)}` : fmt(d, kind === 'dp1' ? { fixedDp: 1 } : {});

/** A quarter of the cards are an exact half in the place being cut; one in five at d3 is a 9 that carries (3.95–3.99). */
function draw(rng: Rng, dp: 1 | 2, target: 0 | 1): Dec {
  const r = rng(), whole = ri(rng, 0, 98);
  if (r < 0.25) return dp === 1 ? dec(whole * 10 + 5, 1) : dec(whole * 100 + (target === 0 ? 50 : ri(rng, 0, 9) * 10 + 5), 2);
  if (r < 0.45 && target === 1) return dec(whole * 100 + 90 + ri(rng, 5, 9), 2);
  const v = dp === 1 ? whole * 10 + ri(rng, 1, 9) : whole * 100 + ri(rng, 1, 99);
  return dec(v === 0 ? 1 : v, dp);
}

/** £3.46 spoken as pounds and pence: the pound sign is not something ks2Say reads. */
function moneySay(n: Dec): string {
  const w = Math.floor(n.v / 100), p = n.v % 100;
  return `Round ${w ? numberWord(w) : 'no'} ${w === 1 ? 'pound' : 'pounds'} and ${numberWord(p)} ${p === 1 ? 'penny' : 'pence'} to the nearest pound.`;
}

/** Three distinct decoys, none worth the answer: the slips first, then steps away from it; one shares the answer's last digit. */
function decoys(n: Dec, answer: Dec, target: 0 | 1, kind: Kind): string[] {
  const label = show(answer, kind), one = dec(1, target);
  const down = target === 0 ? dec(Math.floor(n.v / 10 ** n.dp), 0) : dec(Math.floor(n.v / 10), 1); // cutting the digits off
  const wrongPlace = target === 0 ? roundTo(n, 0.1) : roundTo(n, 1); // the other place asked for
  // Each pick keeps its value beside its label: "4" and "4.0" are one value, and a candidate worth the answer or an
  // earlier pick is refused by value, not by spelling (#1900).
  const picked: { label: string; value: Dec }[] = [];
  const fresh = (c: Dec) => compareDec(c, answer) !== 0 && !picked.some(p => compareDec(p.value, c) === 0);
  const add = (c: Dec) => {
    const s = show(c, kind === 'dp1' && c.dp === 0 ? 'whole' : kind);
    const sane = c.v >= 0 && !(kind === 'money' && c.dp > 0);
    if (picked.length < 3 && sane && fresh(c) && s !== label && !picked.some(p => p.label === s)) picked.push({ label: s, value: c });
  };
  [down, addDec(down, one), wrongPlace, addDec(answer, one), subDec(answer, one)].forEach(add);
  for (let k = 2; picked.length < 3; k++) add(addDec(answer, dec(k, answer.dp)));
  if (!picked.some(p => p.label.slice(-1) === label.slice(-1))) {
    const ten = dec(10, answer.dp);
    const swap = [addDec(answer, ten), ...(answer.v >= ten.v ? [subDec(answer, ten)] : [])].filter(c => fresh(c) && show(c, kind) !== label && !picked.some(p => p.label === show(c, kind)));
    if (swap.length) picked[2] = { label: show(swap[0], kind), value: swap[0] };
  }
  const out = picked.map(p => p.label);
  return out;
}

function card(rng: Rng, n: Dec, target: 0 | 1, kind: Kind): Question {
  const answer = target === 0 ? roundTo(n, 1) : roundTo(n, 0.1);
  const given = (kind === 'money' ? '£' : '') + fmt(n, { fixedDp: n.dp });
  const prompt = target === 1 ? `Round ${given} to one decimal place.` : `Round ${given} to the nearest ${kind === 'money' ? 'pound' : 'whole number'}.`;
  return wordQ(rng, prompt, show(answer, kind), decoys(n, answer, target, kind), { say: kind === 'money' ? moneySay(n) : ks2Say(prompt), hint: HINT, hintIsData: false, why: roundWhy(n, target === 0 ? 1 : 0.1) });
}

export const y5RoundDec: Generator = (level: Difficulty, rng) => {
  if (level === 1) return card(rng, draw(rng, 1, 0), 0, 'whole');
  if (level === 2) return card(rng, draw(rng, 2, 0), 0, rng() < 0.5 ? 'money' : 'whole');
  return card(rng, draw(rng, 2, 1), 1, 'dp1');
};
