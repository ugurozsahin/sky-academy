// y5-decimals (#1201): Year 5 thousandths, and ordering and comparing decimals to three places (5M28, 5M30). d1 is the Year 4
// recap: the largest of four tenths-and-hundredths values, and hundredths in a tenth. d2 is thousandths: thousandths in a tenth
// or hundredth, "0.001 more", and a lettered marker on a number line of 0.002 steps. d3 orders four values that use the same
// digits (0.405, 0.45, 0.045, 0.54), asking for the smallest, largest, second smallest or second largest. Values are scaled
// integers (`ks2num.ts`), never floats. The slips are "longer is larger" (the value with the most digits wins), zero placement,
// and adding in the wrong place. A rank card's four values are distinct, so exactly one has the asked rank.
import type { Difficulty, Generator, Question, Rng } from './types';
import { ri, pick, shuffle, wordQ } from './util';
import { addDec, subDec, compareDec, dec, fmt, parseNum, type Dec } from './ks2num';
import { ks2Say } from './ks2say';

const HINT_ORDER = 'Line up the whole numbers, then compare tenths, then hundredths, then thousandths';
const HINT_PLACE = 'Ten of one place make one of the next place up';
const HINT_LINE = 'Count the small steps from the left end';

/** Last printed digit of a label. */
const last = (s: string) => s.slice(-1);

/** The answer's own last place, ten units of it: 2.306 → 0.01, 4.7 → 1 (#1058's "answer ± 10"). */
function tenUnits(answer: Dec): Dec {
  const a = parseNum(fmt(answer)) ?? answer;
  return dec(10, a.dp);
}

/** Three distinct decoys from `named` then `fill`; a decimal or 20+ answer whose last digit no decoy shares swaps its last decoy for answer ± 10 (#1058). */
function finish(rng: Rng, prompt: string, answer: Dec, named: Dec[], fill: Dec[], extra: Partial<Omit<Question, 'hint' | 'hintIsData'>> & { hint: string }): Question {
  const label = fmt(answer), out: string[] = [];
  for (const c of [...named, ...fill]) {
    const s = fmt(c);
    if (out.length < 3 && c.v >= 0 && s !== label && !out.includes(s)) out.push(s);
  }
  if (!out.some(s => last(s) === last(label))) {
    const ten = tenUnits(answer), up = fmt(addDec(answer, ten)), down = answer.v >= ten.v * 10 ** (answer.dp - ten.dp) ? fmt(subDec(answer, ten)) : '';
    const swap = [up, down].filter(s => s && s !== label && !out.includes(s));
    if (swap.length) out[2] = pick(rng, swap);
  }
  return wordQ(rng, prompt, label, out, { ...extra, hintIsData: false });
}

const RANKS = [
  { ask: 'largest', from: 'top' as const, n: 0 }, { ask: 'smallest', from: 'bottom' as const, n: 0 },
  { ask: 'second largest', from: 'top' as const, n: 1 }, { ask: 'second smallest', from: 'bottom' as const, n: 1 },
];

/** A rank card over four distinct values; redrawn by the caller until another value shares the answer's last printed digit. */
function rank(rng: Rng, make: () => Dec[], asks: typeof RANKS): Question {
  for (let tries = 0; ; tries++) {
    const vals = make(), r = pick(rng, asks);
    const sorted = vals.slice().sort((a, b) => compareDec(a, b));
    const answer = fmt(r.from === 'top' ? sorted[sorted.length - 1 - r.n] : sorted[r.n]);
    const labels = vals.map(v => fmt(v));
    if (tries < 200 && !labels.some(s => s !== answer && last(s) === last(answer))) continue;
    const prompt = `Which is the ${r.ask}?`;
    return wordQ(rng, prompt, answer, labels.filter(s => s !== answer), { say: prompt, hint: HINT_ORDER, hintIsData: false });
  }
}

const distinct = (vs: Dec[]) => new Set(vs.map(v => fmt(v))).size === vs.length;

/** d1: tenths and hundredths sharing a whole part, at least one of each. */
function tenthsAndHundredths(rng: Rng): Dec[] {
  const w = ri(rng, 0, 5);
  for (;;) {
    const vs = [dec(w * 10 + ri(rng, 1, 9), 1), dec(w * 10 + ri(rng, 1, 9), 1), dec(w * 100 + ri(rng, 1, 99), 2), dec(w * 100 + ri(rng, 1, 99), 2)];
    if (distinct(vs) && vs.every(v => fmt(v) !== String(w))) return vs;
  }
}

/** d3: the same two digits placed four ways under one whole part, so the longest value is never simply the biggest. */
function sameDigits(rng: Rng): Dec[] {
  const w = ri(rng, 0, 9), x = ri(rng, 1, 9);
  let y = ri(rng, 1, 9);
  while (y === x) y = ri(rng, 1, 9);
  const k = 10 ** 3 * w;
  return shuffle(rng, [dec(k + 100 * x + y, 3), dec(k + 100 * x + 10 * y, 3), dec(k + 10 * x + y, 3), dec(k + 100 * y + 10 * x, 3)]);
}

function hundredthsIn(rng: Rng): Question {
  const t = ri(rng, 1, 9), answer = t * 10, v = dec(t, 1);
  const q = `How many hundredths make ${fmt(v)}?`;
  return finish(rng, q, dec(answer, 0), [dec(t, 0), dec(t * 100, 0), dec(t * 10 + 1, 0)], [dec(answer + 10, 0), dec(answer - 10, 0)], { say: ks2Say(q), hint: HINT_PLACE });
}

function thousandthsIn(rng: Rng): Question {
  const small = rng() < 0.6, n = ri(rng, 1, 9), v = small ? dec(n, 1) : dec(n, 2), answer = small ? n * 100 : n * 10;
  const q = `How many thousandths make ${fmt(v)}?`;
  return finish(rng, q, dec(answer, 0), [dec(answer / 10, 0), dec(answer * 10, 0), dec(n, 0)], [dec(answer + 1, 0), dec(answer + 100, 0)], { say: ks2Say(q), hint: HINT_PLACE });
}

function oneThousandthMore(rng: Rng): Question {
  const base = dec(ri(rng, 1, 9) * 1000 + ri(rng, 1, 999), 3), answer = addDec(base, dec(1, 3));
  const q = `What is 0.001 more than ${fmt(base)}?`;
  return finish(rng, q, answer, [addDec(base, dec(1, 2)), addDec(base, dec(1, 1)), dec(base.v - 1, 3)], [addDec(base, dec(2, 3)), addDec(base, dec(11, 3)), addDec(base, dec(101, 3))], { say: ks2Say(q), hint: HINT_PLACE });
}

/** A line from a to a + 0.01 with six ticks 0.002 apart; only the ends print, and marker A sits on an inner tick. */
function line(rng: Rng): Question {
  const a = dec(ri(rng, 1, 9) * 100 + ri(rng, 1, 98), 2), ticks = Array.from({ length: 6 }, (_, i) => addDec(a, dec(2 * i, 3)));
  const at = ri(rng, 1, 4), answer = ticks[at], from = Number(fmt(a)), to = Number(fmt(ticks[5]));
  const labels = ticks.map((t, i) => (i === 0 || i === 5 ? fmt(t) : ''));
  const visual = { type: 'numberline' as const, from, to, step: 0.002, labels, marks: [{ label: 'A', at: Number(fmt(answer)) }] };
  const neighbours = ticks.filter((_, i) => i !== at && i !== 0 && i !== 5);
  return finish(rng, 'What number is at A?', answer, neighbours, [ticks[0], ticks[5]], { visual, say: 'What number is at A?', hint: HINT_LINE });
}

export const y5Decimals: Generator = (level: Difficulty, rng) => {
  if (level === 1) return rng() < 0.7 ? rank(rng, () => tenthsAndHundredths(rng), RANKS.slice(0, 2)) : hundredthsIn(rng);
  if (level === 2) { const r = rng(); return r < 0.3 ? thousandthsIn(rng) : r < 0.6 ? oneThousandthMore(rng) : line(rng); }
  return rank(rng, () => sameDigits(rng), RANKS);
};
