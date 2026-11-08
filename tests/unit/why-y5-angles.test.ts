// #2317 (y5-angles, y5-anglefacts): the why names the rule, the nearest ten, or the subtraction that gives the angle.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const draw = (id: string, d: Difficulty) => { const t = TOPICS.find(x => x.id === id)!; return Array.from({ length: 200 }, (_, s) => t.gen(d, rngOf((s + 1) * 104729 + d))); };
const words = (w: string) => w.split(/\s+/).length;

describe('y5-angles why (#2317)', () => {
  it('d1 gives the size against the class rule, and the answer is the class named', () => {
    for (const q of draw('y5-angles', 1)) {
      const deg = (q.visual as { parts: { deg: number }[] }).parts[0].deg, w = q.why!;
      expect(words(w)).toBeLessThanOrEqual(14);
      expect(w.startsWith(`${deg}° is `), w).toBe(true);
      if (q.answer === 'Right') expect(w).toBe('90° is a right angle.'); else expect(w.endsWith(`so ${q.answer.toLowerCase()}.`), w).toBe(true);
    }
  });
  it('d1 quotes the class rule that matches the size drawn', () => {
    const rule = { acute: /^\d+° is less than 90°,/, obtuse: /^\d+° is between 90° and 180°,/, reflex: /^\d+° is more than 180°,/ } as const;
    for (const q of draw('y5-angles', 1)) if (q.answer !== 'Right') expect(q.why, q.why).toMatch(rule[q.answer.toLowerCase() as keyof typeof rule]);
  });
  it('d2 quotes the drawn size, and says a tie rounds up (75° is as near 70° as 80°) rather than calling it nearest', () => {
    let ties = 0;
    for (const q of draw('y5-angles', 2)) {
      const deg = (q.visual as { parts: { deg: number }[] }).parts[0].deg;
      if (deg % 10 === 5) { ties++; expect(q.why).toBe(`${deg}° is halfway, so round up to ${q.answer}.`); }
      else expect(q.why).toBe(`${deg}° is nearest to ${q.answer}.`);
    }
    expect(ties).toBeGreaterThan(0);
  });
  it('d3 names the answer angle and its class', () => {
    for (const q of draw('y5-angles', 3)) {
      expect(q.why!.startsWith(`${q.answer} is `), q.why).toBe(true);
      expect(q.why!.endsWith(`so ${q.prompt.match(/is (\w+)\?/)![1]}.`), q.why).toBe(true);
    }
  });
});

describe('y5-anglefacts why (#2317)', () => {
  it('d1 states the turn and its size', () => {
    for (const q of draw('y5-anglefacts', 1)) {
      expect(q.why!.endsWith(` is ${q.answer}.`), q.why).toBe(true);
      expect(q.why!.slice(0, -` is ${q.answer}.`.length), q.why).toBe(q.prompt.replace(' = ?°', ''));
    }
  });
  it('d2 subtracts the known angles from the total and lands on the answer', () => {
    for (const q of draw('y5-anglefacts', 2)) {
      const total = /line/.test(q.prompt) ? 180 : 360, m = q.why!.match(new RegExp(`${total}° − (\\d+)° = (\\d+)°\\.$`))!;
      expect(m, q.why).toBeTruthy();
      expect(`${m[2]}°`).toBe(q.answer);
      expect(+m[1] + +m[2]).toBe(total);
      const shown = (q.visual as { parts: { kind: string; label?: string }[] }).parts.filter(p => p.kind === 'angle' && p.label !== '?').map(p => parseInt(p.label!));
      expect(shown.reduce((a, b) => a + b, 0), q.why).toBe(+m[1]);
    }
  });
  it('d3 shows the sum that gives the answer', () => {
    for (const q of draw('y5-anglefacts', 3)) {
      const w = q.why!, a = parseInt(q.answer);
      expect(words(w)).toBeLessThanOrEqual(14);
      if (/Width/.test(q.prompt)) expect(w.endsWith(`= ${a}.`), w).toBe(true);
      else if (/Diagonal/.test(q.prompt)) { expect(w).toBe(`90° − ${90 - a}° = ${a}°.`); expect(q.prompt).toContain(`${90 - a}°`); }
      else expect(w).toBe(`Opposite sides of a rectangle are equal: ${a} cm.`);
    }
  });
});
