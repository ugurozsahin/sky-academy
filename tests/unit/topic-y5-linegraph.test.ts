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
    for (const d of [1, 2, 3] as Difficulty[]) {
      const s = leakShares(topic.gen, d);
      if (s.counted < 100) continue;
      expect(s.units, `d${d} last digit`).toBeLessThanOrEqual(0.3);
      expect(s.leading, `d${d} leading digit`).toBeLessThanOrEqual(0.3);
    }
  });
});
