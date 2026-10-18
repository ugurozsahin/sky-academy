import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { clockPhrase } from '../../src/curriculum/year2';
import { DUR_FACTS, GRID_DURATIONS, INTERVALS } from '../../src/curriculum/year2/measure';

// #658-#661 (split from #357): the clock words and the duration tables, pinned by hand-written oracles.
function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

/** Hand-written: minutes -> the words, `H` is the hour shown, `N` the next hour. Not derived from clockPhrase. */
const WORDS: Record<number, string> = {
  0: "H o'clock", 5: '5 past H', 10: '10 past H', 15: 'quarter past H', 20: '20 past H', 25: '25 past H',
  30: 'half past H', 35: '25 to N', 40: '20 to N', 45: 'quarter to N', 50: '10 to N', 55: '5 to N',
};
const expected = (h: number, m: number) => WORDS[m].replace('H', String(h)).replace('N', String(h === 12 ? 1 : h + 1));

const ALL = new Set<string>();
for (let h = 1; h <= 12; h++) for (const m of Object.keys(WORDS)) ALL.add(expected(h, Number(m)));

describe('clockPhrase (#658, #660)', () => {
  it('says every five-minute time on the dial exactly as a teacher would', () => {
    for (let h = 1; h <= 12; h++) for (let m = 0; m < 60; m += 5) expect(clockPhrase(h, m), `${h}:${m}`).toBe(expected(h, m));
    // The three phrasings the issue named, spelt out in full.
    expect(clockPhrase(4, 50)).toBe('10 to 5');
    expect(clockPhrase(3, 20)).toBe('20 past 3');
    expect(clockPhrase(12, 45)).toBe('quarter to 1');
  });
  it('folds any whole hour onto the 12-hour dial and never says "0 o\'clock" (#660)', () => {
    expect(clockPhrase(0, 0)).toBe("12 o'clock");
    expect(clockPhrase(0, 30)).toBe('half past 12');
    expect(clockPhrase(0, 45)).toBe('quarter to 1');
    expect(clockPhrase(13, 15)).toBe('quarter past 1');
    expect(clockPhrase(24, 0)).toBe("12 o'clock");
    for (let t = 0; t < 24 * 60; t += 5) expect(clockPhrase(Math.floor(t / 60), t % 60), `t=${t}`).not.toMatch(/\b0\b/);
  });
});

describe('y2-time wording (#658)', () => {
  it('the answer phrase is the visual clock read aloud, at every difficulty, options included', () => {
    const t = TOPICS.find(x => x.id === 'y2-time')!; const r = rng(658);
    const seen = new Set<number>();
    for (const d of [1, 2, 3] as Difficulty[]) for (let i = 0; i < 400; i++) {
      const q = t.gen(d, r);
      const v = q.visual as { type: string; h: number; m: number };
      expect(v.type).toBe('clock');
      expect(q.answer, `${v.h}:${v.m}`).toBe(expected(v.h, v.m));
      for (const o of q.options) expect(ALL.has(o), `option "${o}" is not a clock phrase`).toBe(true);
      seen.add(v.m);
    }
    expect([...seen].sort((a, b) => a - b), 'd3 reaches every five-minute step').toEqual(Object.keys(WORDS).map(Number));
  });
});

describe('y2-duration spoken lines (#659)', () => {
  const t = TOPICS.find(x => x.id === 'y2-duration')!;
  it('fact cards say the prompt; end-time cards say the prompt', () => {
    const r = rng(659);
    for (const d of [1, 3] as Difficulty[]) for (let i = 0; i < 200; i++) { const q = t.gen(d, r); expect(q.say, q.prompt).toBe(q.prompt); }
  });
  it('comparison cards say every interval, then the question; and the option count follows comparative/superlative', () => {
    const r = rng(660);
    let pairs = 0, triples = 0;
    for (let i = 0; i < 400; i++) {
      const q = t.gen(2, r);
      expect(q.prompt).toMatch(/^Which takes (longer|less time|the longest|the shortest)\?$/);
      const listed = q.say!.slice(0, q.say!.length - q.prompt.length - 2).split(', ');
      expect(q.say, 'list, full stop, the question').toBe(`${listed.join(', ')}. ${q.prompt}`);
      expect([...listed].sort(), 'what the child hears is what the bubbles show').toEqual([...q.options].sort());
      const superlative = /longest|shortest/.test(q.prompt);
      expect(/longer|less time/.test(q.prompt)).toBe(!superlative);
      expect(q.options.length, q.prompt).toBe(superlative ? 3 : 2);
      if (superlative) triples++; else pairs++;
    }
    expect(pairs).toBeGreaterThan(100); expect(triples).toBeGreaterThan(100);
  });
});

describe('duration tables (#661)', () => {
  it('INTERVALS: pairwise-distinct minutes and labels, each short enough for a bubble', () => {
    expect(new Set(INTERVALS.map(i => i.mins)).size, 'a tie would make "the longest" ambiguous').toBe(INTERVALS.length);
    expect(new Set(INTERVALS.map(i => i.label)).size).toBe(INTERVALS.length);
    for (const i of INTERVALS) expect(i.label.length, i.label).toBeLessThanOrEqual('quarter past 12'.length);
  });
  it('GRID_DURATIONS: every value a multiple of 15, positive, distinct', () => {
    for (const g of GRID_DURATIONS) { expect(g.mins % 15, g.phrase).toBe(0); expect(g.mins).toBeGreaterThan(0); }
    expect(new Set(GRID_DURATIONS.map(g => g.mins)).size).toBe(GRID_DURATIONS.length);
  });
  it('DUR_FACTS: distinct phrases', () => {
    expect(new Set(DUR_FACTS.map(f => f.phrase)).size).toBe(DUR_FACTS.length);
  });
  it('the three tables are not assignable to one another (compile-time)', () => {
    // @ts-expect-error DUR_FACTS has no `label`/`mins`
    const a: typeof INTERVALS = DUR_FACTS;
    // @ts-expect-error INTERVALS has no `phrase`
    const b: typeof GRID_DURATIONS = INTERVALS;
    // @ts-expect-error GRID_DURATIONS has no `n`
    const c: typeof DUR_FACTS = GRID_DURATIONS;
    expect([a, b, c]).toHaveLength(3);
  });
});
