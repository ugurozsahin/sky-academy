import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty, Question } from '../../src/curriculum';
import { sayIsSafe } from '../../src/curriculum/ks2say';
import { leakShares } from './helpers/decoy-leak';
import { rLblProblem } from './helpers/r-lbl';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y6-graphs')!;
const draw = (d: Difficulty, n = 300) => { const r = rng(1250 * 10 + d); return Array.from({ length: n }, () => topic.gen(d, r)); };
type Row = { label: string; n: number };
const chart = (q: Question) => { const v = q.visual; if (v?.type !== 'chart' || v.kind !== 'line') throw new Error('no line graph'); return v; };
// Written here from the definition, not imported: 5 miles = 8 km, so km × 5 ÷ 8 = miles.
const toMiles = (k: number) => k * 5 / 8, toKm = (m: number) => m * 8 / 5;
const isConv = (rows: Row[]) => rows.map(r => r.label).join() === '0,8,16,24,32,40';
const nums = (s: string) => (s.match(/\d+/g) ?? []).map(Number);

describe('y6-graphs (#1250)', () => {
  it('is registered for Year 6 maths in the stats strand', () => { expect(topic).toMatchObject({ year: 'year6', subject: 'maths', strand: 'stats', title: 'Line and Conversion Graphs' }); });

  it('every card has a line graph, four distinct positive options with the answer, a speakable say, a prompt of at most 60 characters, and passes R-LBL', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draw(d)) {
      chart(q);
      expect(q.options).toHaveLength(4); expect(new Set(q.options).size).toBe(4); expect(q.options).toContain(q.answer);
      for (const o of q.options) expect(Number(o)).toBeGreaterThanOrEqual(1);
      expect(q.say, q.prompt).toBeTruthy(); expect(sayIsSafe(q.say!), q.say).toBe(true);
      expect(q.prompt.length, q.prompt).toBeLessThanOrEqual(60);
      expect(rLblProblem(q), q.prompt).toBeNull();
    }
  });

  it('every plotted value is a whole number of the axis step, and the conversion graph is exactly 5 miles = 8 km, every point on a tick and a gridline', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draw(d, 100)) {
      const v = chart(q);
      for (const r of v.rows) { expect(r.n % v.step, q.prompt).toBe(0); expect(r.n).toBeLessThanOrEqual(v.max); }
      if (isConv(v.rows)) { expect(v.step).toBe(5); expect(v.max).toBe(25); for (const r of v.rows) expect(r.n).toBe(toMiles(Number(r.label))); }
    }
  });

  it('d1: the answer is the miles for the km the card gives, read from the plotted data', () => {
    for (const q of draw(1)) {
      const k = Number(/Use the graph\. (\d+) km ≈ \? miles$/.exec(q.prompt)![1]), row = chart(q).rows.find(r => Number(r.label) === k)!;
      expect(q.answer, q.prompt).toBe(String(row.n));
      expect(q.options, q.prompt).toContain(String(k));   // copying the number from the question is a decoy on every card
    }
  });

  it('d2: miles to km read backwards from the plotted data, or the distance in one hour on the time graph', () => {
    let conv = 0, time = 0;
    for (const q of draw(2)) {
      const rows = chart(q).rows;
      if (isConv(rows)) {
        conv++; const m = Number(/Use the graph\. (\d+) miles ≈ \? km$/.exec(q.prompt)![1]);
        expect(q.answer, q.prompt).toBe(String(Number(rows.find(r => r.n === m)!.label)));
        expect(q.options, q.prompt).toContain(String(m));
      } else {
        time++; const [, a, b] = /^Cyclist: how far from (\d\d:00) to (\d\d:00)\? \(km\)$/.exec(q.prompt)!, ra = rows.find(r => r.label === a)!, rb = rows.find(r => r.label === b)!;
        expect(rows.indexOf(rb)).toBe(rows.indexOf(ra) + 1);
        expect(q.answer, q.prompt).toBe(String(rb.n - ra.n));
        expect(rb.n - ra.n).toBeGreaterThan(0);
        expect(q.options).toContain(String(rb.n));
      }
    }
    expect(conv).toBeGreaterThan(150); expect(time).toBeGreaterThan(50);
  });

  it('d3: the Ali and Ben difference, or a distance past the end of the graph', () => {
    let further = 0, beyond = 0;
    for (const q of draw(3)) {
      const f = /^Ali: (\d+) miles\. Ben: (\d+) km\. How many km further is (Ali|Ben)\?$/.exec(q.prompt);
      if (f) {
        further++; const ali = toKm(Number(f[1])), ben = Number(f[2]);
        expect(f[3] === 'Ben' ? ben > ali : ali > ben, q.prompt).toBe(true);
        expect(q.answer).toBe(String(Math.abs(ben - ali)));
      } else {
        beyond++; const m = Number(/Use the graph\. (\d+) miles ≈ \? km$/.exec(q.prompt)![1]);
        expect(m).toBeGreaterThan(25); expect(m % 5).toBe(0); expect(q.answer).toBe(String(toKm(m)));
      }
      expect(isConv(chart(q).rows)).toBe(true);
    }
    expect(further).toBeGreaterThan(100); expect(beyond).toBeGreaterThan(100);
  });

  it('no plotted value is stated in the prompt, hint or say, once the x labels the text names are set aside', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draw(d)) {
      const rows = chart(q).rows, plotted = new Set(rows.map(r => r.n));
      if (isConv(rows)) continue;   // a conversion card names its given on purpose; the readings are the miles
      const text = [q.prompt, q.hint, q.say].join(' ').replace(/\d\d:00/g, '');
      for (const n of nums(text)) expect(plotted.has(n), `${q.prompt} states ${n}`).toBe(false);
    }
  });

  it('on a conversion card the answer is never stated in the prompt, hint or say', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draw(d)) {
      if (!isConv(chart(q).rows)) continue;
      const stated = nums([q.prompt, q.hint, q.say].join(' ')).map(String);
      expect(stated, q.prompt).not.toContain(q.answer);
    }
  });

  it('leak limit (#1058): at most 30 % of in-scope cards have a last or leading digit no decoy shares, at every difficulty', () => {
    for (const d of [1, 2, 3] as Difficulty[]) {
      const s = leakShares(topic.gen, d);
      if (s.counted === 0) continue;
      expect(s.units / s.counted, `units d${d}`).toBeLessThanOrEqual(0.3); expect(s.leading / s.counted, `leading d${d}`).toBeLessThanOrEqual(0.3);
    }
  });
});
