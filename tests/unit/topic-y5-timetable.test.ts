import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty, Question } from '../../src/curriculum';
import { leakShares } from './helpers/decoy-leak';
import { labelEm, rLblProblem } from './helpers/r-lbl';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y5-timetable')!;
const ALL = [1, 2, 3] as Difficulty[];
const draws = (d: Difficulty, n = 300) => { const r = rng(1216_000 + d); return Array.from({ length: n }, () => topic.gen(d, r)); };
type Table = Extract<NonNullable<Question['visual']>, { type: 'chart'; kind: 'table' }>;
const table = (q: Question): Table => { const v = q.visual; if (v?.type !== 'chart' || v.kind !== 'table') throw new Error('not a table'); return v; };
const clock = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const hhmm = (m: number) => Math.floor(m / 60) * 100 + (m % 60);
const at = (v: Table, name: string) => v.rows.find(r => r.label === name)!.n;
const isGap = (q: Question) => q.prompt.startsWith('How many minutes from');
const isDone = (q: Question) => / takes \d+ min\. Time at /.test(q.prompt);

describe('y5-timetable (#1216)', () => {
  it('is registered once in Year 5 maths, in the stats strand', () => {
    expect(TOPICS.filter(t => t.id === 'y5-timetable')).toHaveLength(1);
    expect(topic.year).toBe('year5'); expect(topic.subject).toBe('maths'); expect(topic.strand).toBe('stats');
  });

  it('oracle: every answer is recomputed from the table minutes (300 draws per difficulty)', () => {
    for (const d of ALL) for (const q of draws(d)) {
      const v = table(q);
      expect(v.time).toBe(true); expect(v.head).toEqual(['Stop', 'Time']);
      expect(v.rows.length).toBeGreaterThanOrEqual(4); expect(v.rows.length).toBeLessThanOrEqual(5);
      for (const r of v.rows) { expect(r.n).toBeGreaterThanOrEqual(360); expect(r.n).toBeLessThanOrEqual(1260); }
      v.rows.forEach((r, k) => { if (k) expect(r.n).toBeGreaterThan(v.rows[k - 1].n); });
      expect(v.rows.some((r, k) => k > 0 && Math.floor(r.n / 60) > Math.floor(v.rows[k - 1].n / 60))).toBe(true);
      if (isGap(q)) {
        const [, a, b] = q.prompt.match(/from (.+) to (.+)\?/)!;
        expect(q.answer).toBe(String(at(v, b) - at(v, a)));
        expect(v.hide).toBeUndefined();
      } else if (isDone(q)) {
        const m = q.prompt.match(/^(.+?) to (.+?) takes (\d+) min\. Time at (.+)\?$/)!;
        expect(m[4]).toBe(m[2]);
        expect(v.rows[v.hide!].label).toBe(m[2]);
        expect(q.answer).toBe(clock(at(v, m[1]) + Number(m[3])));
        expect(q.answer).toBe(clock(v.rows[v.hide!].n));
      } else {
        const m = q.prompt.match(/^When does the (\w+) reach (.+)\?$/)!;
        expect(q.answer).toBe(clock(at(v, m[2])));
        expect(v.hide).toBeUndefined();
      }
      expect(new Set(q.options).size).toBe(q.options.length);
      expect(q.options.filter(o => o === q.answer)).toHaveLength(1);
    }
  });

  it('ladder: d1 reads a time, d2 the minutes between stops, d3 completes a hidden time', () => {
    for (const q of draws(1)) { expect(isGap(q) || isDone(q)).toBe(false); expect(q.answer).toMatch(/^\d\d:\d\d$/); }
    for (const q of draws(2)) expect(isGap(q)).toBe(true);
    const d3 = draws(3, 600);
    expect(d3.filter(isDone).length).toBeGreaterThan(300);
    expect(d3.some(isGap)).toBe(true);
    for (const q of d3.filter(isDone)) expect(q.answer).toMatch(/^\d\d:\d\d$/);
  });

  it('d2: at least half of the cards cross an hour, and the base-100 slip is an option whenever it differs from the answer', () => {
    const d2 = draws(2, 600);
    let crossing = 0;
    for (const q of d2) {
      const v = table(q), [, a, b] = q.prompt.match(/from (.+) to (.+)\?/)!;
      const wrong = String(hhmm(at(v, b)) - hhmm(at(v, a)));
      if (Math.floor(at(v, b) / 60) > Math.floor(at(v, a) / 60)) crossing++;
      if (wrong !== q.answer) expect(q.options, q.prompt).toContain(wrong);
    }
    expect(crossing / d2.length).toBeGreaterThanOrEqual(0.5);
  });

  it('every prompt is 60 characters or fewer, with a full-sentence say, and no timetable data in the hint', () => {
    for (const d of ALL) for (const q of draws(d)) {
      expect(q.prompt.length, q.prompt).toBeLessThanOrEqual(60);
      expect(q.say).toMatch(/^Look at the timetable\./);
      expect(q.say).not.toMatch(/\d:\d|:\d\d/);
      expect(q.hint ?? '').not.toMatch(/\d| · /);
      expect(q.listen ?? '').toBe('');
    }
  });

  it('leak limit (#1058): the last and leading printed digit are unshared by every decoy on at most 30% of cards', () => {
    for (const d of ALL) {
      const s = leakShares(topic.gen, d);
      expect(s.units, `d${d} units`).toBeLessThanOrEqual(0.30);
      expect(s.leading, `d${d} leading`).toBeLessThanOrEqual(0.30);
    }
  });

  it('labels pass R-LBL', () => {
    for (const d of ALL) for (const q of draws(d, 100)) for (const o of q.options) {
      expect(labelEm(o)).toBeGreaterThan(0);
      expect(rLblProblem(q), q.prompt).toBeNull();
    }
  });
});
