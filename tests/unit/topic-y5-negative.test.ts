import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty, Question } from '../../src/curriculum';
import { leakShares } from './helpers/decoy-leak';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y5-negative')!;
const draw = (d: Difficulty, n = 2000) => { const r = rng(1180 * 10 + d); return Array.from({ length: n }, () => topic.gen(d, r)); };
const num = (s: string) => Number(s.replace('−', '-'));
const nums = (s: string) => (s.match(/−?\d+/g) ?? []).map(num);

/** The answer re-derived from the prompt alone, per card shape. */
function oracle(q: Question): number {
  let m: RegExpMatchArray | null;
  if (q.visual?.type === 'numberline') return q.visual.marks![0].at;
  if ((m = q.prompt.match(/^Start at (\S+) and count back (\d+)/))) return num(m[1]) - Number(m[2]);
  if ((m = q.prompt.match(/^Start at (\S+) and count on (\d+)/))) return num(m[1]) + Number(m[2]);
  if ((m = q.prompt.match(/^It is (\S+) °C\. It gets (\d+) degrees (warmer|colder)/))) return num(m[1]) + (m[3] === 'warmer' ? 1 : -1) * Number(m[2]);
  if ((m = q.prompt.match(/^How many degrees warmer is (\S+) °C than (\S+) °C/))) return num(m[1]) - num(m[2]);
  if ((m = q.prompt.match(/^(.*), … what comes next\?$/))) { const t = nums(m[1]); return t[2] + (t[2] - t[1]); }
  throw new Error(`no oracle for ${q.prompt}`);
}

describe('y5-negative (#1180)', () => {
  it('is registered for Year 5 maths', () => { expect(topic.year).toBe('year5'); expect(topic.subject).toBe('maths'); });

  it('the oracle holds on every card: 2,000 draws per difficulty, answers −30..30, four distinct options', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draw(d)) {
      if (q.prompt === 'Which temperature is the coldest?') expect(num(q.answer)).toBe(Math.min(...q.options.map(num)));
      else expect(num(q.answer)).toBe(oracle(q));
      expect(num(q.answer)).toBeGreaterThanOrEqual(-30); expect(num(q.answer)).toBeLessThanOrEqual(30);
      expect(q.options).toContain(q.answer); expect(new Set(q.options).size).toBe(4);
      for (const o of q.options) { expect(o).not.toMatch(/-/); expect(o).toMatch(/^−?\d+$/); }
    }
  });

  it('every d1 number line has at most 6 ticks, one label per tick with a real minus, and its marker on an inner tick', () => {
    let lines = 0;
    for (const q of draw(1)) {
      const v = q.visual; if (v?.type !== 'numberline') continue;
      lines++;
      const ticks = v.labels!.length, step = v.step!;
      expect(ticks).toBeLessThanOrEqual(6); expect(v.to).toBe(v.from + (ticks - 1) * step);
      expect(v.from).toBeLessThan(0); expect(v.to).toBeGreaterThan(0);
      v.labels!.forEach(l => expect(l).not.toMatch(/-/));
      const at = v.marks![0].at; expect(at).toBeGreaterThan(v.from); expect(at).toBeLessThan(v.to);
      expect((at - v.from) % step).toBe(0);
      // Every printed label is its tick's own value, and the marker sits on the tick whose value is the keyed answer.
      v.labels!.forEach((l, i) => expect(l).toBe(f(v.from + i * step)));
      expect(v.labels![(at - v.from) / step]).toBe(q.answer);
    }
    expect(lines).toBeGreaterThan(800);
  });

  it('a move that crosses zero offers the zero-counted decoy', () => {
    let crossing = 0;
    for (const q of draw(1)) {
      const m = q.prompt.match(/^Start at (\S+) and count (back|on) (\d+)/); if (!m) continue;
      const a = num(q.answer), start = num(m[1]);
      if (Math.sign(a) !== Math.sign(start)) { crossing++; expect(q.options).toContain(f(m[2] === 'back' ? a - 1 : a + 1)); }
    }
    expect(crossing).toBeGreaterThan(200);
  });

  it('the named decoys are present, not back-filled: each card shape offers its own slips', () => {
    const ok = (v: number, a: number) => v !== a && v >= -30 && v <= 30;
    const has = (q: Question, v: number) => expect(q.options, q.prompt).toContain(f(v));
    const seen: Record<string, number> = { line: 0, back: 0, on: 0, change: 0, gap: 0, seq: 0 };
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draw(d, 1500)) {
      const a = num(q.answer); let m: RegExpMatchArray | null;
      if (q.visual?.type === 'numberline') {
        seen.line++; const step = q.visual.step!;
        for (const v of [-a, a + step, a - step]) if (ok(v, a)) has(q, v);
      } else if ((m = q.prompt.match(/^Start at (\S+) and count back (\d+)/))) {
        seen.back++; for (const v of [-a, a - 1, num(m[1]) + Number(m[2])]) if (ok(v, a)) has(q, v);
      } else if ((m = q.prompt.match(/^Start at (\S+) and count on (\d+)/))) {
        seen.on++; for (const v of [-a, a + 1, num(m[1]) - Number(m[2])]) if (ok(v, a)) has(q, v);
      } else if ((m = q.prompt.match(/^It is (\S+) °C\. It gets (\d+) degrees (warmer|colder)/))) {
        seen.change++; const wrong = num(m[1]) + (m[3] === 'warmer' ? -1 : 1) * Number(m[2]);
        for (const v of [-a, wrong]) if (ok(v, a)) has(q, v);
      } else if ((m = q.prompt.match(/^How many degrees warmer is (\S+) °C than (\S+) °C/))) {
        seen.gap++; for (const v of [num(m[1]) - Math.abs(num(m[2])), -a]) if (ok(v, a)) has(q, v);
      } else if (/what comes next\?$/.test(q.prompt)) {
        seen.seq++; const t = nums(q.prompt.replace(/, … what comes next\?$/, '')), dir = Math.sign(t[2] - t[1]);
        for (const v of [-a, a + dir]) if (ok(v, a)) has(q, v);   // zero skipped: one further along the count
      }
    }
    for (const k of Object.keys(seen)) expect(seen[k], k).toBeGreaterThan(100);
  });

  it('"which is the coldest?" always offers at least two negative temperatures', () => {
    let cards = 0;
    for (const q of draw(3)) if (q.prompt === 'Which temperature is the coldest?') { cards++; expect(q.options.filter(o => o.startsWith('\u2212')).length).toBeGreaterThanOrEqual(2); }
    expect(cards).toBeGreaterThan(300);
  });

  it('say never carries a raw minus, degree sign or digit-less symbol', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draw(d, 400)) expect(q.say ?? '').not.toMatch(/[−°-]/);
  });

  it('leak limit: at most 30% of in-scope cards have a last digit no decoy shares', () => {
    for (const d of [1, 2, 3] as Difficulty[]) {
      const s = leakShares(topic.gen, d, 2000, { skipLeading: true });
      expect(s.units).toBeLessThanOrEqual(0.3);
    }
  });
});

function f(n: number): string { return n < 0 ? `−${-n}` : String(n); }
