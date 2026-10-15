import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty, Question } from '../../src/curriculum';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

const topic = TOPICS.find(t => t.id === 'y4-graphs')!;
const DRAWS = 600;
type Chart = Extract<NonNullable<Question['visual']>, { type: 'chart' }>;
const chart = (q: Question) => { expect(q.visual?.type, q.prompt).toBe('chart'); return q.visual as Chart; };
const val = (c: Chart, label: string) => { const r = c.rows.find(x => x.label === label); expect(r, `row ${label}`).toBeTruthy(); return r!.n; };

/** Re-derive the answer from the visual's rows and the prompt alone, never from the generator's own working. */
function oracle(q: Question): string {
  const c = chart(q);
  let m: RegExpMatchArray | null;
  if ((m = q.prompt.match(/^How many chose (\w+)\?$/))) return String(val(c, m[1]));
  if ((m = q.prompt.match(/^How many more chose (\w+) than (\w+)\?$/))) return String(val(c, m[1]) - val(c, m[2]));
  if ((m = q.prompt.match(/^How many chose (\w+) and (\w+) altogether\?$/))) return String(val(c, m[1]) + val(c, m[2]));
  if ((m = q.prompt.match(/^What was the .+ (?:at|in|on) (.+)\? \(.+\)$/))) return String(val(c, m[1]));
  if ((m = q.prompt.match(/^How much \w+ was it (?:at|in|on) (.+) than (?:at|in|on) (.+)\? \(.+\)$/))) return String(val(c, m[1]) - val(c, m[2]));
  if (/^When was the .+ (?:warmest|tallest|deepest)\?$/.test(q.prompt)) return [...c.rows].sort((a, b) => b.n - a.n)[0].label;
  if (q.prompt === 'What is the total of the two smallest bars?') return String([...c.rows].map(r => r.n).sort((a, b) => a - b).slice(0, 2).reduce((s, v) => s + v));
  throw new Error(`unrecognised prompt: ${q.prompt}`);
}

describe('y4-graphs (#1156)', () => {
  it('is a Year 4 statistics topic', () => {
    expect(topic.year).toBe('year4');
    expect(topic.strand).toBe('stats');
  });

  it('every answer matches the oracle read from the visual alone', () => {
    for (const d of [1, 2, 3] as Difficulty[]) {
      const r = rng(1156_000 + d);
      for (let i = 0; i < DRAWS; i++) {
        const q = topic.gen(d, r);
        expect(q.answer, q.prompt).toBe(oracle(q));
        expect(q.options, q.prompt).toContain(q.answer);
      }
    }
  });

  it('never states a data value in the prompt or the spoken text, and never asks a negative difference', () => {
    for (const d of [1, 2, 3] as Difficulty[]) {
      const r = rng(1156_100 + d);
      for (let i = 0; i < DRAWS; i++) {
        const q = topic.gen(d, r), c = chart(q);
        const text = `${q.prompt} ${q.say ?? ''}`.replace(/\d{2}:\d{2}|Wk \d/g, '');
        for (const row of c.rows) expect(text, q.prompt).not.toMatch(new RegExp(`(^|[^\\d])${row.n}([^\\d]|$)`));
        expect(Number(q.answer) >= 0 || Number.isNaN(Number(q.answer)), q.prompt).toBe(true);
      }
    }
  });

  it('d1: bar charts on a scale of 2, 5 or 10, values on the gridlines', () => {
    const r = rng(1156_200);
    for (let i = 0; i < DRAWS; i++) {
      const c = chart(topic.gen(1, r));
      expect(c.kind).toBe('bar');
      if (c.kind !== 'bar') continue;
      expect([2, 5, 10]).toContain(c.step);
      for (const row of c.rows) expect(row.n % c.step).toBe(0);
    }
  });

  it('d2 draws both time graphs and bar charts on a scale of 20, 50 or 100; d3 draws a peak card, a table and halfway points on an even scale', () => {
    const kinds = (d: Difficulty) => { const r = rng(1156_300 + d), out = new Set<string>(); for (let i = 0; i < DRAWS; i++) { const c = chart(topic.gen(d, r)); out.add(c.kind); if (c.kind === 'bar' && d === 2) expect([20, 50, 100]).toContain(c.step); } return out; };
    expect([...kinds(2)].sort()).toEqual(['bar', 'line']);
    expect([...kinds(3)].sort()).toEqual(['bar', 'line', 'table']);
    const r = rng(1156_400);
    let half = 0;
    for (let i = 0; i < DRAWS; i++) {
      const c = chart(topic.gen(3, r));
      if (c.kind !== 'line') continue;
      for (const row of c.rows) if (row.n % c.step !== 0) { half++; expect(c.step % 2, 'a halfway point only on an even scale').toBe(0); expect(row.n * 2 % c.step).toBe(0); }
    }
    expect(half).toBeGreaterThan(0);
  });

  it('a line graph draws 3–6 points inside its axis, and the peak is never tied', () => {
    for (const d of [2, 3] as Difficulty[]) {
      const r = rng(1156_500 + d);
      for (let i = 0; i < DRAWS; i++) {
        const q = topic.gen(d, r), c = chart(q);
        if (c.kind !== 'line') continue;
        expect(c.rows.length).toBeGreaterThanOrEqual(3);
        expect(c.rows.length).toBeLessThanOrEqual(6);
        expect(c.max % c.step).toBe(0);
        for (const row of c.rows) { expect(row.n).toBeGreaterThan(0); expect(row.n).toBeLessThanOrEqual(c.max); }
        if (q.prompt.startsWith('When was')) { const top = Math.max(...c.rows.map(x => x.n)); expect(c.rows.filter(x => x.n === top)).toHaveLength(1); }
      }
    }
  });

  it('options are unique, and at most 30% of cards with an answer of 20 or more leave the last digit unshared by every decoy', () => {
    for (const d of [1, 2, 3] as Difficulty[]) {
      const r = rng(1156_600 + d);
      let big = 0, leak = 0;
      for (let i = 0; i < 2000; i++) {
        const q = topic.gen(d, r);
        expect(new Set(q.options).size, q.prompt).toBe(q.options.length);
        const a = Number(q.answer);
        if (Number.isNaN(a) || a < 20) continue;
        big++;
        if (!q.options.some(o => o !== q.answer && Number(o) % 10 === a % 10)) leak++;
      }
      expect(big === 0 || leak / big <= 0.3, `d${d}: ${leak}/${big}`).toBe(true);
    }
  });
});
