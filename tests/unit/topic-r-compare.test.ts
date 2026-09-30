import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';

// Deterministic RNG (mulberry32), same construction `curriculum.test.ts` uses.
function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

const topic = TOPICS.find(t => t.id === 'r-compare')!;
const DRAWS = 300;

/**
 * #891: the ELG asks for "greater than, less than or the same as", but `r-compare` used to make equal groups
 * unreachable (`while (b === a) b = ri(...)`), so "the same" was never practised. d3 now draws equal groups
 * about a third of the time, answered "=", with "=" offered on every d3 card so its presence alone never
 * gives the answer away.
 */
describe('r-compare (#891)', () => {
  it('the answer is "=" if and only if the two visual counts are equal, and otherwise names the greater/fewer count exactly as the prompt asks', () => {
    for (const d of [1, 2, 3] as Difficulty[]) {
      const r = rng(8910 + d);
      for (let i = 0; i < DRAWS; i++) {
        const q = topic.gen(d, r);
        const v = q.visual as { type: 'objects'; n: number; n2?: number };
        expect(v.type, `d${d} draw ${i}`).toBe('objects');
        const equal = v.n === v.n2;
        expect(q.answer === '=', `d${d} draw ${i}: n=${v.n} n2=${v.n2} answer="${q.answer}"`).toBe(equal);
        if (equal) continue;
        // pin max/min correctness against the prompt's own "more"/"fewer" framing (#891 review:
        // a swapped max/min slipped past every other assertion here undetected until this one).
        expect(q.prompt, `d${d} draw ${i}`).toMatch(/^Which is (more|fewer)\?$/);
        const wantMore = q.prompt.includes('more');
        const expected = wantMore ? Math.max(v.n, v.n2!) : Math.min(v.n, v.n2!);
        expect(q.answer, `d${d} draw ${i}: n=${v.n} n2=${v.n2} prompt="${q.prompt}"`).toBe(String(expected));
      }
    }
  });

  it('option counts: 2 at d1/d2, 3 at d3', () => {
    for (const d of [1, 2, 3] as Difficulty[]) {
      const r = rng(8915 + d);
      for (let i = 0; i < DRAWS; i++) {
        const q = topic.gen(d, r);
        expect(q.options.length, `d${d} draw ${i}`).toBe(d === 3 ? 3 : 2);
      }
    }
  });

  it('d3: "=" is always an option', () => {
    const r = rng(8920);
    for (let i = 0; i < DRAWS; i++) {
      const q = topic.gen(3, r);
      expect(q.options, `draw ${i}`).toContain('=');
    }
  });

  it('d3: equal cards land between 20% and 47% of draws', () => {
    const r = rng(8930);
    let equal = 0;
    for (let i = 0; i < DRAWS; i++) if (topic.gen(3, r).answer === '=') equal++;
    const rate = equal / DRAWS;
    expect(rate, `equal-card rate ${rate}`).toBeGreaterThan(0.20);
    expect(rate, `equal-card rate ${rate}`).toBeLessThan(0.47);
  });

  it('d1 and d2 never draw equal groups, never offer "=", and keep the pre-#891 say wording exactly', () => {
    for (const d of [1, 2] as Difficulty[]) {
      const r = rng(8940 + d);
      for (let i = 0; i < DRAWS; i++) {
        const q = topic.gen(d, r);
        const v = q.visual as { n: number; n2?: number };
        expect(v.n, `d${d} draw ${i}`).not.toBe(v.n2);
        expect(q.options, `d${d} draw ${i}`).not.toContain('=');
        const wantMore = q.prompt.includes('more');
        expect(q.say, `d${d} draw ${i}`).toBe(`Which number is ${wantMore ? 'more' : 'fewer'}, ${v.n} or ${v.n2}?`);
      }
    }
  });

  it('d3: every say names "the same" alongside more/fewer', () => {
    const r = rng(8950);
    for (let i = 0; i < DRAWS; i++) {
      const q = topic.gen(3, r);
      expect(q.say, `draw ${i}: "${q.say}"`).toMatch(/the same/);
    }
  });

  it('every option is unique, and the answer is among them', () => {
    for (const d of [1, 2, 3] as Difficulty[]) {
      const r = rng(8960 + d);
      for (let i = 0; i < DRAWS; i++) {
        const q = topic.gen(d, r);
        expect(new Set(q.options).size, `d${d} draw ${i}`).toBe(q.options.length);
        expect(q.options, `d${d} draw ${i}`).toContain(q.answer);
      }
    }
  });
});
