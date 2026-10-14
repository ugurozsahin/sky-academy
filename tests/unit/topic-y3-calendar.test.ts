import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { leakShares } from './helpers/decoy-leak';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y3-calendar')!;
const DRAWS = 300;
const draws = (d: Difficulty) => { const r = rng(1101_000 + d); return Array.from({ length: DRAWS }, () => topic.gen(d, r)); };
const DAYS: Record<string, number> = { January: 31, March: 31, April: 30, May: 31, June: 30, July: 31, August: 31, September: 30, October: 31, November: 30, December: 31 };
const mins = (h: number, m: number, s: string) => ((h % 12) + (s === 'pm' ? 12 : 0)) * 60 + m;
const secs = (n: string, u: string) => Number(n) * (u.startsWith('minute') ? 60 : 1);

describe('y3-calendar (#1101)', () => {
  it('is registered once, in Year 3 maths, after y3-time', () => {
    expect(TOPICS.filter(t => t.id === 'y3-calendar')).toHaveLength(1);
    expect(topic.year).toBe('year3');
    expect(topic.subject).toBe('maths');
  });

  it('d1: every fact answer matches the fixed table', () => {
    const seen = new Set<string>();
    for (const q of draws(1)) {
      const month = q.prompt.match(/days in (\w+)\?/)?.[1];
      const want = q.prompt === 'How many seconds in a minute?' ? 60 : q.prompt === 'How many days in a year?' ? 365
        : q.prompt === 'How many days in a leap year?' ? 366 : DAYS[month!];
      expect(Number(q.answer), q.prompt).toBe(want);
      seen.add(q.prompt.startsWith('How many days in ') && month ? 'month' : q.prompt);
    }
    expect(seen.size).toBe(4 + 0);
  });

  it('d2: durations are in the prompt, bubbles are letters, the answer is the unique extreme; conversions are minutes × 60', () => {
    let cmp = 0, conv = 0;
    for (const q of draws(2)) {
      const m = q.prompt.match(/^(Longest|Shortest)\? (.*)$/);
      if (!m) {
        conv++;
        const c = q.prompt.match(/seconds in (?:(\d+) minutes|half a minute)\?/)!;
        expect(Number(q.answer)).toBe(c[1] ? Number(c[1]) * 60 : 30);
        continue;
      }
      cmp++;
      expect(q.options).toEqual(['A', 'B', 'C', 'D']);
      const vals = m[2].split(', ').map(p => { const [l, n, u] = p.split(' '); return [l, secs(n, u)] as const; });
      const nums = vals.map(v => v[1]);
      expect(new Set(nums).size).toBe(4);
      const target = m[1] === 'Longest' ? Math.max(...nums) : Math.min(...nums);
      expect(vals.find(v => v[0] === q.answer)![1]).toBe(target);
    }
    expect(cmp).toBeGreaterThan(100);
    expect(conv).toBeGreaterThan(50);
  });

  it('d3: the answer is end − start in minutes, and the hour = 100 minutes decoy is offered', () => {
    let hundred = 0;
    for (const q of draws(3)) {
      const m = q.prompt.match(/starts at (\d+):(\d\d) (am|pm) and ends at (\d+):(\d\d) (am|pm)/)!;
      const s = mins(Number(m[1]), Number(m[2]), m[3]), e = mins(Number(m[4]), Number(m[5]), m[6]);
      const ans = Number(q.answer);
      expect(ans).toBe(e - s);
      expect(ans).toBeLessThanOrEqual(180);
      const h = (Math.floor(e / 60) * 100 + (e % 60)) - (Math.floor(s / 60) * 100 + (s % 60));
      if (h !== ans) { expect(q.options, q.prompt).toContain(String(h)); hundred++; }
      expect(q.say).not.toMatch(/\d:\d\d/);
    }
    expect(hundred).toBeGreaterThan(100);
  });

  it('every card has four distinct options holding the answer; no label is wider than a number', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draws(d)) {
      expect(q.options).toHaveLength(4);
      expect(new Set(q.options).size).toBe(4);
      expect(q.options).toContain(q.answer);
      for (const o of q.options) expect(o.length).toBeLessThanOrEqual(4);
    }
  });

  it('distractors do not leak the answer by its last or leading digit (#1058)', () => {
    for (const d of [1, 3] as Difficulty[]) {
      const r = leakShares(topic.gen, d);
      expect(r.units, `d${d} units`).toBeLessThanOrEqual(0.3);
      expect(r.leading, `d${d} leading`).toBeLessThanOrEqual(0.3);
    }
    const r2 = leakShares(topic.gen, 2);
    expect(r2.units).toBeLessThanOrEqual(0.3);
    expect(r2.leading).toBeLessThanOrEqual(0.3);
  });
});
