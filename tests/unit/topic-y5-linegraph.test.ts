import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty, Question } from '../../src/curriculum';
import { leakShares } from './helpers/decoy-leak';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

const topic = TOPICS.find(t => t.id === 'y5-linegraph')!;
const DRAWS = 300;
type Chart = Extract<NonNullable<Question['visual']>, { type: 'chart' }>;
const chart = (q: Question) => { expect(q.visual?.type, q.prompt).toBe('chart'); expect((q.visual as Chart).kind).toBe('line'); return q.visual as Chart & { step: number; max: number }; };
const val = (c: Chart, label: string) => { const r = c.rows.find(x => x.label === label); expect(r, `row ${label}`).toBeTruthy(); return r!.n; };

/** Re-derive the answer from the visual's rows and the prompt alone, never from the generator's own working. */
function oracle(q: Question): string {
  const c = chart(q), ns = c.rows.map(r => r.n);
  let m: RegExpMatchArray | null;
  if ((m = q.prompt.match(/^(?:What was the temperature at|How much rain fell on|How tall was the plant in|How many visitors came on) (.+)\? \(.+\)$/))) return String(val(c, m[1]));
  if ((m = q.prompt.match(/^(?:How much warmer at|How much taller in|How much more rain fell on|How many more visitors on) (.+) than (?:at |in |on )?(.+)\? \(.+\)$/))) return String(val(c, m[1]) - val(c, m[2]));
  if (/^(?:When was it warmest|When was the plant tallest|Which day had the (?:most rain|most visitors))\?$/.test(q.prompt)) return c.rows[ns.indexOf(Math.max(...ns))].label;
  if (/^(?:When was it coldest|When was the plant shortest|Which day had the (?:least rain|fewest visitors))\?$/.test(q.prompt)) return c.rows[ns.indexOf(Math.min(...ns))].label;
  if ((m = q.prompt.match(/^Total \w+, (\w+) to (\w+) \(.+\)$/))) {
    const a = c.rows.findIndex(r => r.label === m![1]), z = c.rows.findIndex(r => r.label === m![2]);
    return String(ns.slice(a, z + 1).reduce((s, v) => s + v, 0));
  }
  if (/^Highest take lowest \w+ \(.+\)$/.test(q.prompt)) return String(Math.max(...ns) - Math.min(...ns));
  throw new Error(`unrecognised prompt: ${q.prompt}`);
}

/** The two x labels a spoken difference question names, in order, with "at/in/on" and the spoken-hour form undone. */
const SPOKEN_HOUR = /^(\w+) o'clock$/;
const HOURS = ['eight', 'ten', 'twelve', 'fourteen', 'sixteen', 'eighteen'];
function unspeak(w: string): string {
  const h = SPOKEN_HOUR.exec(w);
  if (h) return `${String(8 + 2 * HOURS.indexOf(h[1])).padStart(2, '0')}:00`;
  const k = /^week (\w+)$/.exec(w);
  return k ? `Wk ${['one', 'two', 'three', 'four', 'five', 'six'].indexOf(k[1]) + 1}` : w;
}

describe('y5-linegraph (#1215)', () => {
  it('is a Year 5 statistics topic', () => {
    expect(topic.year).toBe('year5');
    expect(topic.strand).toBe('stats');
  });

  it('every answer matches the oracle read from the visual alone', () => {
    for (const d of [1, 2, 3] as Difficulty[]) {
      const r = rng(1215_000 + d);
      for (let i = 0; i < DRAWS; i++) {
        const q = topic.gen(d, r);
        expect(q.answer, q.prompt).toBe(oracle(q));
        expect(q.options, q.prompt).toContain(q.answer);
      }
    }
  });

  it('the spoken difference names the same two labels in the same order as the prompt', () => {
    let seen = 0;
    for (const d of [2, 3] as Difficulty[]) {
      const r = rng(1215_400 + d);
      for (let i = 0; i < DRAWS; i++) {
        const q = topic.gen(d, r), m = q.prompt.match(/^(?:How much warmer at|How much taller in|How much more rain fell on|How many more visitors on) (.+) than (?:at |in |on )?(.+)\? \(.+\)$/);
        if (!m) continue;
        seen++;
        const said = (q.say ?? '').match(/(?:warmer at|taller in|more rain fell on|more visitors on) (.+?) than (?:at |in |on )?(.+?)\?/);
        expect(said, q.say).toBeTruthy();
        expect([unspeak(said![1]), unspeak(said![2])], q.say).toEqual([m[1], m[2]]);
      }
    }
    expect(seen).toBeGreaterThan(50);
  });

  it('every option is on the axis step grid, and no read card offers a value above the axis maximum', () => {
    for (const d of [1, 2, 3] as Difficulty[]) {
      const r = rng(1215_500 + d);
      for (let i = 0; i < DRAWS; i++) {
        const q = topic.gen(d, r), c = chart(q);
        if (/^(?:When|Which day)/.test(q.prompt)) continue;
        for (const o of q.options) {
          expect(Number(o) % c.step, `${q.prompt} ${q.options}`).toBe(0);
          expect(Number(o), `${q.prompt} ${q.options}`).toBeGreaterThanOrEqual(c.step);
        }
        if (d === 1) for (const o of q.options) expect(Number(o), `${q.prompt} ${q.options}`).toBeLessThanOrEqual(c.max);
      }
    }
  });

  it('every plotted value is a multiple of the axis step, 5-6 points, and the extreme of a "when" card is unique', () => {
    for (const d of [1, 2, 3] as Difficulty[]) {
      const r = rng(1215_100 + d);
      for (let i = 0; i < DRAWS; i++) {
        const q = topic.gen(d, r), c = chart(q), ns = c.rows.map(x => x.n);
        expect(c.rows.length, q.prompt).toBeGreaterThanOrEqual(5);
        expect(c.rows.length, q.prompt).toBeLessThanOrEqual(6);
        for (const v of ns) { expect(v % c.step, q.prompt).toBe(0); expect(v, q.prompt).toBeLessThanOrEqual(c.max); }
        if (/^(?:When|Which day)/.test(q.prompt)) {
          const e = oracle(q), pool = /warmest|tallest|most|^Which day had the m/.test(q.prompt) ? Math.max(...ns) : Math.min(...ns);
          expect(c.rows.filter(x => x.n === pool).map(x => x.label), q.prompt).toEqual([e]);
        }
      }
    }
  });

  it('never states a plotted value in the prompt or the spoken text once the x labels are removed', () => {
    for (const d of [1, 2, 3] as Difficulty[]) {
      const r = rng(1215_200 + d);
      for (let i = 0; i < DRAWS; i++) {
        const q = topic.gen(d, r), c = chart(q);
        const text = `${q.prompt} ${q.say ?? ''}`.replace(/\d{2}:\d{2}|Wk \d/g, '');
        for (const row of c.rows) expect(text, q.prompt).not.toMatch(new RegExp(`(^|[^\\d])${row.n}([^\\d]|$)`));
        expect(q.prompt, q.prompt).not.toContain(' · ');
        expect(q.hint ?? '', q.prompt).not.toContain(' · ');
      }
    }
  });

  it('every prompt is at most 60 characters, and a difference is never negative', () => {
    for (const d of [1, 2, 3] as Difficulty[]) {
      const r = rng(1215_300 + d);
      for (let i = 0; i < DRAWS; i++) {
        const q = topic.gen(d, r);
        expect(q.prompt.length, q.prompt).toBeLessThanOrEqual(60);
        expect(Number(q.answer) >= 0 || Number.isNaN(Number(q.answer)), q.prompt).toBe(true);
      }
    }
  });

  it('keeps the distractor leak within #1058\'s limit at every difficulty', () => {
    // On a step-10 axis a two-digit answer is the only gridline with its leading digit (40 on an 80 axis), so no on-grid decoy can share it:
    // that bank is measured on the last digit alone; the step-2 and step-5 banks are measured on both.
    const fine = (d: Difficulty, r: () => number): Question => { let q: Question; do q = topic.gen(d, r); while (chart(q).step === 10); return q; };
    for (const d of [1, 2, 3] as Difficulty[]) {
      const all = leakShares(topic.gen, d), sub = leakShares(fine, d);
      expect(all.counted, `d${d} counted`).toBeGreaterThan(100);
      expect(all.units, `d${d} last digit`).toBeLessThanOrEqual(0.3);
      expect(sub.counted, `d${d} fine counted`).toBeGreaterThan(100);
      expect(sub.leading, `d${d} leading digit (steps 2 and 5)`).toBeLessThanOrEqual(0.3);
    }
  });
});
