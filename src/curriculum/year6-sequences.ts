// y6-sequences (#1271): generate and describe linear number sequences (NC 6M30). d1 the next term of a rising whole-number sequence,
// d2 the next term or the term after next, falling, crossing zero or in steps of 0.5 / 0.25, d3 the term-to-term rule that makes the
// four terms shown ("+ 3", "− 3", "× 2": exactly one fits every pair). Every term is an integer in hundredths, so no float is printed.
import type { Difficulty, Generator, Question, Rng } from './types';
import { ri, pick, shuffle, wordQ } from './util';
import { dec, fmt } from './ks2num';
import { ks2Say } from './ks2say';

const K = 100;
const label = (v: number) => fmt(dec(v, 2));
const digits = (s: string) => s.replace(/\D/g, '');
const lead = (v: number) => digits(label(v))[0];
const last = (v: number) => digits(label(v)).slice(-1);
const terms = (t1: number, s: number, n: number) => Array.from({ length: n }, (_, i) => t1 + i * s);
const list = (ts: number[]) => ts.map(label).join(', ');

/** The three decoys: `named` slips first (the first always kept), then one sharing the answer's last digit and one its leading digit when #1058's scope applies. */
function options(rng: Rng, ans: number, named: number[], u: number): string[] {
  const ok = (v: number, taken: number[]) => v !== ans && !taken.includes(v) && (ans < 0 || v > 0) && Math.abs(v) <= 1000 * K;
  const res: number[] = [];
  const add = (...cs: number[]) => { const c = cs.find(v => ok(v, res)); if (c !== undefined) res.push(c); return c !== undefined; };
  add(named[0]);
  const rest = shuffle(rng, named.slice(1));
  if (ans >= 20 * K || ans % K !== 0) {
    const tens = [ans + 10 * K, ans - 10 * K], near = [1, -1, 2, -2, 3, -3, 4, -4, 5, -5].map(t => ans + t * u);
    const has = (f: (v: number) => string) => res.some(v => f(v) === f(ans));
    if (!has(last)) add(...rest.filter(v => last(v) === last(ans)), ...tens.filter(v => last(v) === last(ans)));
    if (!has(lead)) add(...rest.filter(v => lead(v) === lead(ans)), ...near.filter(v => lead(v) === lead(ans) && last(v) !== last(ans)));
  }
  for (const v of rest) if (res.length < 3) add(v);
  for (let t = 1; res.length < 3; t++) add(ans + t * u, ans - t * u);
  return res.map(label);
}

/** d1–d2: terms t1..t4 shown; the card asks for the `ahead`-th term after t4. */
function nextCard(rng: Rng, t1: number, s: number, ahead: 1 | 2, u: number): Question {
  const ts = terms(t1, s, 4), t4 = ts[3], ans = t4 + ahead * s;
  const named = [t4 + (ahead + 1) * s, ahead === 2 ? t4 + s : t4, ans + (rng() < 0.5 ? u : -u), t4 - ahead * s, t4 + K];
  const text = list(ts);
  const prompt = ahead === 1 ? `${text}, ?` : `Term after next: ${text}`;
  const say = ks2Say(ahead === 1 ? `${text}. What comes next?` : `${text}. What is the term after the next one?`);
  return wordQ(rng, prompt, label(ans), options(rng, ans, named, u), { say });
}

function d2(rng: Rng): Question {
  const ahead = pick(rng, [1, 2] as const), kind = pick(rng, ['whole', 'cross', 'decimal'] as const);
  if (kind === 'whole') {
    const s = ri(rng, 2, 15), up = rng() < 0.5;
    return nextCard(rng, (up ? ri(rng, 1, 60) : ri(rng, 4 * s + 1, 4 * s + 60)) * K, (up ? s : -s) * K, ahead, K);
  }
  if (kind === 'cross') {
    for (;;) {
      const s = ri(rng, 2, 9), t4 = ri(rng, -4, 2);
      if (t4 - ahead * s < 0) return nextCard(rng, (t4 + 3 * s) * K, -s * K, ahead, K);
    }
  }
  const s = pick(rng, [50, 25]), up = rng() < 0.5, t1 = ri(rng, up ? 1 : 12, up ? 30 : 40) * s;
  return nextCard(rng, t1, up ? s : -s, ahead, 25);
}

/** d3: "+ 3", "− 3", "+ 4", "× 2" for 5, 8, 11, 14. Constant-difference terms fit no multiplicative rule beyond the first pair. */
function rule(rng: Rng): Question {
  const sign = (plus: boolean) => (plus ? '+ ' : '− ');
  let s = ri(rng, 2, 12), up = rng() < 0.5, t1 = up ? ri(rng, 1, 40) : 3 * s + ri(rng, 1, 20);
  if (up && rng() < 0.6) { const a = ri(rng, 1, 6), m = ri(rng, 2, 4); t1 = a; s = (m - 1) * a; } // 3, 6, 9: "× 2" fits the first pair
  if (s < 2) s = 2;
  const ts = terms(t1 * K, (up ? s : -s) * K, 4), near = [s - 1, s + 1].filter(v => v >= 1);
  const k = ts[1] % ts[0] === 0 ? ts[1] / ts[0] : 2;
  const wrong = [`${sign(!up)}${s}`, `${sign(up)}${pick(rng, near)}`, `× ${k}`];
  return wordQ(rng, `Which rule makes ${list(ts)}?`, `${sign(up)}${s}`, wrong, {
    say: ks2Say(`Which rule makes ${list(ts)}?`), optionsAreContent: true,
  });
}

export const y6Sequences: Generator = (d: Difficulty, rng: Rng): Question => {
  if (d === 1) return nextCard(rng, ri(rng, 1, 50) * K, ri(rng, 2, 12) * K, 1, K);
  return d === 2 ? d2(rng) : rule(rng);
};
