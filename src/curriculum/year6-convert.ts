// y6-convert (#1242): convert length, mass, volume and time both ways to 3 decimal places, and miles to kilometres (6M34–36).
// d1 larger to smaller with up to three decimal places ("1.255 kg = ? g"). d2 both directions across metric and time ("45 m = ?
// km", "90 min = ? h"). d3 miles and kilometres at 5 miles ≈ 8 km (the card gives the ratio and says "about"), a two-unit sum ("2.4 km + 650 m = ? m") and the 3 dp
// conversions with four-digit amounts. Values are scaled integers (`ks2num.ts`), never floats. The slips are the decimal point a
// place out (0.45 for 0.045), the inverse ratio (miles read as km), and decimal time (1.5 h as 150 min).
import type { Difficulty, Generator, Question, Rng } from './types';
import { ri, pick } from './util';
import { dec, fmt, mulPow10, divPow10, type Dec } from './ks2num';
import { finish, show, say, u, type Unit } from './unitcard';

interface Pair { big: Unit; small: Unit; f: number; pow: 1 | 2 | 3 | 0 }
const KM = u('km', 'kilometre'), M = u('m', 'metre'), CM = u('cm', 'centimetre'), MM = u('mm', 'millimetre'), KG = u('kg', 'kilogram'), G = u('g', 'gram');
const L = u('l', 'litre'), ML = u('ml', 'millilitre'), H = u('h', 'hour'), MIN = u('min', 'minute'), S = u('s', 'second');
const MILE = u('miles', 'mile');
const m = (big: Unit, small: Unit, f: number, pow: 0 | 1 | 2 | 3): Pair => ({ big, small, f, pow });
const METRIC = [m(KM, M, 1000, 3), m(M, CM, 100, 2), m(CM, MM, 10, 1), m(KG, G, 1000, 3), m(L, ML, 1000, 3)];
const TIME = [m(H, MIN, 60, 0), m(MIN, S, 60, 0)];

const HINT_METRIC = 'Going to a smaller unit, multiply. Going to a bigger unit, divide';
const HINT_TIME = 'Check how many of the small unit make one of the big unit';
const HINT_MILES = 'Scale both numbers by the same amount';
const HINT_SUM = 'Change both to the same unit, then add';

/** The scaled integer `v` at `dp` places with trailing zeros dropped, so a decoy prints like any other value. */
function norm(v: number, dp: number): Dec {
  while (dp > 0 && v % 10 === 0) { v /= 10; dp--; }
  return dec(v, dp);
}

/** A one-pair card. `big` is the larger-unit amount, `small` the same amount in the smaller unit. */
function card(rng: Rng, p: Pair, big: Dec, small: Dec, down: boolean, hint: string, extra: Dec[] = []): Question {
  const from = down ? big : small, to = down ? small : big, fu = down ? p.big : p.small, tu = down ? p.small : p.big;
  return finish(rng, `${show(from, fu)} = ? ${tu.sym}`, `${say(from, fu)} is how many ${tu.many}?`, to,
    [...extra, mulPow10(to, 1), divPow10(to, 1), mulPow10(to, 2), from].map(d => norm(d.v, d.dp)).filter(d => d.dp <= 3), hint);
}

/** A metric amount of the larger unit with `dp` places and no trailing zero, and its whole number of the smaller unit. */
function metric(rng: Rng, p: Pair, maxDp: number): { big: Dec; small: Dec } {
  const dp = ri(rng, 1, Math.min(maxDp, p.pow)), top = 10 ** (dp + 1) - 1;
  let n = ri(rng, 1, top);
  while (n % 10 === 0) n++;
  return { big: dec(n, dp), small: dec(n * 10 ** (p.pow - dp), 0) };
}

function metricCard(rng: Rng, down: boolean, maxDp: number): Question {
  const p = pick(rng, METRIC), { big, small } = metric(rng, p, maxDp);
  return card(rng, p, big, small, down, HINT_METRIC);
}

/** Time in halves and quarters so the answer is exact: 3.5 min = 210 s, 90 min = 1.5 h. Decimal time is the named slip. */
function timeCard(rng: Rng, down: boolean): Question {
  const p = pick(rng, TIME), whole = ri(rng, 0, 4), q = pick(rng, [25, 50, 75]), n = whole * 100 + q;
  const big = norm(n, 2), small = dec((n * p.f) / 100, 0);
  const extra = down ? dec(n, 0) : norm(whole * 100 + (small.v % 60), 2); // 1.5 h as 150, 90 min as 1.30
  return card(rng, p, big, small, down, HINT_TIME, [extra]);
}

/** "10 miles is about ? km" and "40 km is about ? miles" at 5 miles ≈ 8 km. The slip is the inverse ratio. */
function miles(rng: Rng): Question {
  const toKm = rng() < 0.5, k = ri(rng, 1, 12), mi = 5 * k, km = 8 * k;
  const from = toKm ? mi : km, to = toKm ? km : mi, fu = toKm ? MILE : KM, tu = toKm ? KM : MILE;
  const inverse = toKm ? norm(mi * 625, 3) : norm(km * 16, 1);
  const prompt = `Use 5 miles = 8 km: ${fmt(dec(from, 0))} ${fu.sym} is about ? ${tu.sym}`;
  const ans = dec(to, 0);
  return finish(rng, prompt, `${fmt(dec(from, 0))} ${fu.many} is about how many ${tu.many}?`, ans,
    [inverse, mulPow10(ans, 1), divPow10(ans, 1), dec(from, 0)], HINT_MILES);
}

/** "2.4 km + 650 m = ? m", or a take-away. The slips are the unconverted sum and a place-shifted small unit. */
function sumCard(rng: Rng): Question {
  const p = pick(rng, [METRIC[0], METRIC[3], METRIC[4]]), dp = ri(rng, 1, 2), n = ri(rng, 12, 99);
  const bigSmall = n * 10 ** (3 - dp), s = ri(rng, 2, 19) * 50, plus = rng() < 0.6 || bigSmall <= s;
  const big = dec(n, dp), ans = plus ? bigSmall + s : bigSmall - s;
  const prompt = `${fmt(big)} ${p.big.sym} ${plus ? '+' : '−'} ${fmt(dec(s, 0))} ${p.small.sym} = ? ${p.small.sym}`;
  const spoken = `${fmt(big)} ${p.big.many} ${plus ? 'plus' : 'minus'} ${s} ${p.small.many}, in ${p.small.many}?`;
  const sign = plus ? 1 : -1;
  return finish(rng, prompt, spoken, dec(ans, 0),
    [dec(bigSmall + sign * s * 10, 0), dec(bigSmall / 10 + sign * s, 0), dec(n + sign * s, 0), dec(bigSmall + sign * s / 10, 0)], HINT_SUM);
}

export const y6Convert: Generator = (level: Difficulty, rng) => {
  if (level === 1) return metricCard(rng, true, 3);
  if (level === 2) return rng() < 0.6 ? metricCard(rng, rng() < 0.5, 3) : timeCard(rng, rng() < 0.5);
  const r = rng();
  return r < 0.3 ? miles(rng) : r < 0.55 ? sumCard(rng) : r < 0.8 ? metricCard(rng, rng() < 0.5, 3) : timeCard(rng, rng() < 0.5);
};
