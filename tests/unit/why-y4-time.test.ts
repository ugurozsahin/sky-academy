// #2317 (y4-time): the why gives the am/pm rule that turns the prompt's time into the answer, in 14 words or fewer.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const draw = (d: Difficulty) => { const t = TOPICS.find(x => x.id === 'y4-time')!; return Array.from({ length: 200 }, (_, s) => t.gen(d, rngOf((s + 1) * 104729 + d))); };

describe('y4-time why (#2317)', () => {
  it('every question has a short why that ends in its own answer', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draw(d)) {
      const w = q.why!;
      expect(w, q.prompt).toBeTruthy();
      expect(w.split(/\s+/).length, w).toBeLessThanOrEqual(14);
      expect(w.endsWith(`${q.answer}.`), `${w} / ${q.answer}`).toBe(true);
    }
  });
  it('12 am, 12 pm, am and pm each get their own rule', () => {
    const ws = [2, 3].flatMap(d => draw(d as Difficulty)).map(q => q.why!);
    for (const re of [/^12 am is 00/, /^12 pm stays 12/, /^am hours stay/, /^pm: \d+ \+ 12/, /^00 is 12 am/, /^12 is 12 pm/, /^Before 12 is am/, /^pm: \d+ − 12/]) expect(ws.some(w => re.test(w)), String(re)).toBe(true);
  });
  it('the part-of-day card teaches the same rule as the text card, at 12 am and 12 pm too', () => {
    const cards = draw(3).filter(q => q.prompt.startsWith('It is '));
    expect(cards.length).toBeGreaterThan(20);
    const seen = new Set<string>();
    for (const q of cards) {
      const [h, m] = (q.answer as string).split(':').map(Number), w = q.why!;
      if (h === 12) { expect(w).toBe(`12 pm stays 12: 12:${String(m).padStart(2, '0')}.`); seen.add('12pm'); }
      else if (h === 0) { expect(w).toMatch(/^12 am is 00/); seen.add('12am'); }
      else if (h > 12) { expect(w).toMatch(new RegExp(`^pm: ${h - 12} \\+ 12 = ${h},`)); seen.add('pm'); }
      else { expect(w).toMatch(/^am hours stay/); seen.add('am'); }
    }
    expect(seen.has('pm') && seen.has('am') && seen.has('12pm') && seen.has('12am')).toBe(true);
  });
  it('the analogue clock card names the minute-hand number, including 12 at the hour', () => {
    const cards = draw(1);
    expect(cards.some(q => /minute hand on 12:/.test(q.why!))).toBe(true);
    expect(cards.some(q => (q.visual as { m: number }).m >= 30 && /just past/.test(q.why!))).toBe(true);
    for (const q of cards) {
      const h = (q.visual as { h: number; m: number }).h, m = (q.visual as { m: number }).m;
      expect(q.why).toBe(`Hour hand ${m === 0 ? 'on' : 'just past'} ${h}, minute hand on ${m / 5 || 12}: ${q.answer}.`);
    }
  });
});
