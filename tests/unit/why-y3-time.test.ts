// #2317 (y3-time): the why names the hour and minutes read, the am/pm rule, or the 12-hour sum.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const draw = (d: Difficulty) => { const t = TOPICS.find(x => x.id === 'y3-time')!; return Array.from({ length: 300 }, (_, s) => t.gen(d, rngOf((s + 1) * 104729 + d))); };

describe('y3-time why (#2317)', () => {
  it('every question has a why of at most 14 words that ends on the answer', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draw(d)) {
      expect(q.why!.split(/\s+/).length, q.why).toBeLessThanOrEqual(14);
      expect(q.why!.endsWith(`${q.answer}.`), q.why).toBe(true);
    }
  });
  it('clock cards name the hour and the minutes the answer shows', () => {
    let n = 0;
    for (const d of [1, 2] as Difficulty[]) for (const q of draw(d).filter(x => x.visual)) {
      n++;
      const [h, m] = q.answer.split(' ')[0].split(':').map(Number);
      expect(q.why!.startsWith(`Hour ${h}, `), q.why).toBe(true);
      expect(q.why, q.why).toMatch(m === 0 ? /no minutes/ : new RegExp(`, ${m} minutes?[,:]`));
    }
    expect(n).toBeGreaterThan(0);
  });
  it('the vocabulary cards give the right am/pm rule', () => {
    const qs = draw(2).filter(x => /^Which time/.test(x.prompt));
    expect(qs.length).toBeGreaterThan(0);
    for (const q of qs) {
      const pm = q.why!.includes(' is pm: '), am = q.why!.includes(' is am: ');
      expect(pm !== am, q.why).toBe(true);
      expect(q.answer.endsWith(pm ? 'pm' : 'am'), q.why).toBe(true);
    }
  });
  it('the 24-hour sums add up and land on the answer hour', () => {
    let n = 0;
    for (const q of draw(3)) {
      const to24 = q.why!.match(/^pm: (\d+) \+ 12 = (\d+)/), to12 = q.why!.match(/^(\d+) − 12 = (\d+), so pm/);
      if (to24) { n++; expect(Number(to24[1]) + 12, q.why).toBe(Number(to24[2])); expect(Number(to24[2]), q.why).toBe(Number(q.answer.slice(0, 2))); }
      if (to12) { n++; expect(Number(to12[1]) - 12, q.why).toBe(Number(to12[2])); expect(Number(to12[2]), q.why).toBe(Number(q.answer.split(':')[0])); }
    }
    expect(n).toBeGreaterThan(0);
  });
  it('exact noon and midnight are not "just after"', () => {
    let n = 0;
    const t = TOPICS.find(x => x.id === 'y3-time')!;
    for (const q of Array.from({ length: 20000 }, (_, i) => t.gen(3, rngOf(i + 1)))) if (/^(00|12):00 is /.test(q.why!)) { n++; expect(q.why).not.toMatch(/just after/); }
    expect(n).toBeGreaterThan(0);
  });
  it('to-24 noon and midnight whys say "just after" unless the minutes are 00', () => {
    let exact = 0, after = 0;
    const t = TOPICS.find(x => x.id === 'y3-time')!;
    for (const q of Array.from({ length: 20000 }, (_, i) => t.gen(3, rngOf(i + 1)))) {
      const w = q.why!.match(/^12 (pm|am) is (just after )?(noon|midnight)/);
      if (!w) continue;
      if (w[2]) { after++; expect(q.answer, q.why).not.toMatch(/^(12|00):00$/); }
      else { exact++; expect(q.answer, q.why).toMatch(/^(12|00):00$/); }
    }
    expect(exact).toBeGreaterThan(0);
    expect(after).toBeGreaterThan(0);
  });
});
