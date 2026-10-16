import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty, Question } from '../../src/curriculum';
import { sayIsSafe } from '../../src/curriculum/ks2say';
import { leakShares } from './helpers/decoy-leak';
import { cardBudgetProblem } from './helpers/card-budget';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y5-story-measure')!;
const draw = (d: Difficulty, n = 300) => { const r = rng(1207 * 10 + d); return Array.from({ length: n }, () => topic.gen(d, r)); };
/** Exact tenths / pence as integers, parsed from the card's own text: no float arithmetic anywhere. */
const scaled = (s: string, dp: number) => { const [i, f = ''] = s.replace(/[£,]/g, '').split('.'); return Number(i + f.padEnd(dp, '0')); };
const T = (s: string) => scaled(s, 1), P = (s: string) => scaled(s, 2), N = '(\\d+\\.\\d+|\\d+)', M = '£(\\d+\\.\\d{2})';
const out = (v: number, dp: number, money = false) => (money ? '£' : '') + (dp ? (v / 10 ** dp).toFixed(dp) : String(v));
const grp = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
const trim = (s: string) => (s.includes('.') ? s.replace(/0+$/, '').replace(/\.$/, '') : s);

// One entry per template: a regex over the prompt and the test's own recomputation (answer label, and the decimal places of the numbers).
const ORACLE: Array<{ re: RegExp; ans: (m: RegExpExecArray) => string }> = [
  { re: new RegExp(`^A ribbon is ${N} m long\\. ${N} m is cut off\\.`), ans: m => trim(out(T(m[1]) - T(m[2]), 1)) },
  { re: new RegExp(`^A tank has ${N} litres\\. ${N} litres leak out\\.`), ans: m => trim(out(T(m[1]) - T(m[2]), 1)) },
  { re: new RegExp(`^A bag of ${N} kg has ${N} kg used\\.`), ans: m => trim(out(T(m[1]) - T(m[2]), 1)) },
  { re: new RegExp(`^A box is ${N} kg and a tin is ${N} kg\\.`), ans: m => trim(out(T(m[1]) + T(m[2]), 1)) },
  { re: new RegExp(`^A jug has ${N} litres of juice and ${N} litres of water\\.`), ans: m => trim(out(T(m[1]) + T(m[2]), 1)) },
  { re: new RegExp(`^A path is ${N} km, then ${N} km more\\.`), ans: m => trim(out(T(m[1]) + T(m[2]), 1)) },
  { re: new RegExp(`^(\\d+) bags of ${N} kg each\\.`), ans: m => trim(out(Number(m[1]) * T(m[2]), 1)) },
  { re: new RegExp(`^One stride is ${N} m\\. How many metres in (\\d+) strides`), ans: m => trim(out(Number(m[2]) * T(m[1]), 1)) },
  { re: new RegExp(`^(\\d+) tickets cost ${M} each`), ans: m => out(Number(m[1]) * P(m[2]), 2, true) },
  { re: new RegExp(`^(\\d+) equal bags weigh ${N} kg in all`), ans: m => trim(out(T(m[2]) / Number(m[1]), 1)) },
  { re: new RegExp(`^${N} litres is shared equally into (\\d+) bottles`), ans: m => trim(out(T(m[1]) / Number(m[2]), 1)) },
  { re: new RegExp(`^(\\d+) pens cost ${M} in all`), ans: m => out(P(m[2]) / Number(m[1]), 2, true) },
  { re: /^A recipe for (\d+) uses (\d+) g of \w+\. How many grams for (\d+)\?/, ans: m => grp((Number(m[2]) / Number(m[1])) * Number(m[3])) },
  { re: new RegExp(`^How many grams is ${N} kg \\+ (\\d+) g\\?`), ans: m => grp(T(m[1]) * 100 + Number(m[2])) },
  { re: new RegExp(`^(\\d+) \\w+ cost ${M} each\\. How much change from £(\\d+)\\.00\\?`), ans: m => out(Number(m[3]) * 100 - Number(m[1]) * P(m[2]), 2, true) },
  { re: new RegExp(`^A jug holds ${N} litres\\. (\\d+) cups of ${N} litres`), ans: m => trim(out(T(m[1]) - Number(m[2]) * T(m[3]), 1)) },
  { re: new RegExp(`^(\\d+) apples cost ${M}\\. How much do (\\d+) apples cost\\?`), ans: m => out((P(m[2]) / Number(m[1])) * Number(m[3]), 2, true) },
];
const oracle = (q: Question) => { for (const o of ORACLE) { const m = o.re.exec(q.prompt); if (m) return o.ans(m); } return undefined; };

describe('y5-story-measure (#1207)', () => {
  it('is registered for Year 5 maths in the measure strand', () => { expect(topic.year).toBe('year5'); expect(topic.subject).toBe('maths'); expect(topic.strand).toBe('measure'); });

  it('oracle: every answer equals the test\'s own re-parse and recomputation, and every template is hit', () => {
    const hit = new Set<RegExp>();
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draw(d)) {
      const want = oracle(q);
      expect(want, q.prompt).toBeDefined();
      expect(q.answer, q.prompt).toBe(want);
      hit.add(ORACLE.find(o => o.re.test(q.prompt))!.re);
      expect(q.options).toContain(q.answer);
      expect(new Set(q.options).size, q.prompt).toBe(4);
    }
    expect(hit.size).toBe(ORACLE.length);
  });

  it('ladder: d1 adds or subtracts, d2 multiplies or divides, d3 takes two steps or scales', () => {
    for (const q of draw(1)) expect(ORACLE.indexOf(ORACLE.find(o => o.re.test(q.prompt))!), q.prompt).toBeLessThan(6);
    for (const q of draw(2)) { const i = ORACLE.indexOf(ORACLE.find(o => o.re.test(q.prompt))!); expect(i, q.prompt).toBeGreaterThanOrEqual(6); expect(i, q.prompt).toBeLessThan(12); }
    for (const q of draw(3)) expect(ORACLE.indexOf(ORACLE.find(o => o.re.test(q.prompt))!), q.prompt).toBeGreaterThanOrEqual(12);
  });

  it('no float artefacts; money always has two decimal places on the card and never "x.y pounds" aloud', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draw(d)) {
      const all = [q.prompt, ...q.options].join(' ');
      expect(all, q.prompt).not.toMatch(/\d\.\d{3,}/);
      for (const m of all.match(/£\d[\d,]*\.?\d*/g) ?? []) expect(m, q.prompt).toMatch(/^£\d[\d,]*\.\d{2}$/);
      if (q.options.some(o => o.startsWith('£'))) for (const o of q.options) expect(o, q.prompt).toMatch(/^£\d+\.\d{2}$/);
      expect(q.say, q.prompt).toBeDefined();
      expect(q.say!, q.prompt).not.toMatch(/\d\.\d+ pounds/); expect(q.say!).not.toContain('£');
      expect(sayIsSafe(q.say!), q.say).toBe(true);
      for (const o of q.options) expect(o).not.toMatch(/^−|^0\.0*$/);
    }
  });

  it('no spoken line ends in a bare single-letter unit, and d3 cards are slow (#1207 review)', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draw(d)) {
      expect(q.say!, q.prompt).not.toMatch(/(^|\s)[a-z]\s*[?.]?$/i);
      expect(q.say!, q.prompt).not.toMatch(/equals what/);
      expect(!!q.slow, q.prompt).toBe(d === 3);
    }
  });

  it('money is spoken as pounds and pence', () => {
    const r = rng(5); let seen = false;
    for (let i = 0; i < 400 && !seen; i++) { const q = topic.gen(2, r); const m = /^(\d+) tickets cost £(\d+)\.(\d{2}) each/.exec(q.prompt); if (m) { seen = true; expect(q.say).toContain(`${m[2]} pound${m[2] === '1' ? '' : 's'}`); } }
    expect(seen).toBe(true);
  });

  it('every prompt fits the card budget (#1051) and is crude-word clean', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draw(d)) {
      expect(cardBudgetProblem(q), q.prompt).toBeNull();
      expect(q.prompt).not.toMatch(/\b(?:sex|bum|poo|wee)\b/i);
    }
  });

  it('decoys include a decimal place shift on every card', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draw(d, 150)) {
      const digits = (s: string) => s.replace(/\D/g, '');
      const a = digits(q.answer).replace(/^0+/, '');
      expect(q.options.some(o => o !== q.answer && digits(o).replace(/^0+/, '').startsWith(a.slice(0, 1))), q.prompt).toBe(true);
    }
  });

  it('leak limit (#1058): at most 0.30 on both digits at every difficulty', () => {
    for (const d of [1, 2, 3] as Difficulty[]) { const s = leakShares(topic.gen, d); expect(s.units, `d${d} last`).toBeLessThanOrEqual(0.3); expect(s.leading, `d${d} lead`).toBeLessThanOrEqual(0.3); }
  });
});
