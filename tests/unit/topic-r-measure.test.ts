import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

const topic = TOPICS.find(t => t.id === 'r-measure')!;
const DRAWS = 150;

// The oracle, written out again here on purpose: [bigger, smaller] for each attribute, keyed by hand.
const BANK: Record<string, [string, string][]> = {
  taller: [['🦒', '🐭'], ['🌳', '🌷'], ['🏢', '🏠'], ['🐘', '🐜']],
  longer: [['🐍', '🐛'], ['🚂', '🚲'], ['🚌', '🛴'], ['🦕', '🐸']],
  heavier: [['🐘', '🐁'], ['🚗', '🎈'], ['🚛', '🚲'], ['🐳', '🐟']],
  'holds more': [['🛁', '☕'], ['🛁', '🥛'], ['🚰', '🥄'], ['🛢️', '🍼']],
};
const FORM: Record<string, { attr: string; opposite: boolean }> = {
  'Which is taller?': { attr: 'taller', opposite: false }, 'Which is shorter?': { attr: 'taller', opposite: true },
  'Which is longer?': { attr: 'longer', opposite: false },
  'Which is heavier?': { attr: 'heavier', opposite: false }, 'Which is lighter?': { attr: 'heavier', opposite: true },
  'Which holds more?': { attr: 'holds more', opposite: false }, 'Which holds less?': { attr: 'holds more', opposite: true },
};

describe('r-measure (#971)', () => {
  it('the answer is the hand-keyed member of the pair for the asked form; two emoji options, no numbers, spoken', () => {
    for (const d of [1, 2, 3] as Difficulty[]) {
      const r = rng(9710 + d);
      for (let i = 0; i < DRAWS; i++) {
        const q = topic.gen(d, r);
        const f = FORM[q.prompt] ?? FORM['Which is shorter?'];
        expect(q.options, `d${d} draw ${i}`).toHaveLength(2);
        expect(q.say, `d${d} draw ${i}`).toBe(q.prompt);
        for (const o of q.options) expect(o, `d${d} draw ${i}`).not.toMatch(/\d/);
        expect(q.prompt).not.toMatch(/\d/);
        const attrs = q.prompt === 'Which is shorter?' ? ['taller', 'longer'] : [f.attr];
        const ok = attrs.some(a => BANK[a].some(([big, small]) => q.options.includes(big) && q.options.includes(small) && q.answer === (f.opposite || q.prompt === 'Which is shorter?' ? small : big)));
        expect(ok, `d${d} draw ${i}: ${q.prompt} ${q.options.join(' ')} → ${q.answer}`).toBe(true);
      }
    }
  });

  it('ladder: d1 asks only taller/longer; d2 adds heavier and the opposite forms; d3 adds holds more/less', () => {
    const seen = (d: Difficulty) => { const r = rng(9720 + d); return new Set(Array.from({ length: 400 }, () => topic.gen(d, r).prompt)); };
    expect([...seen(1)].sort()).toEqual(['Which is longer?', 'Which is taller?']);
    const d2 = seen(2);
    expect(d2.has('Which is heavier?') && d2.has('Which is lighter?') && d2.has('Which is shorter?')).toBe(true);
    expect([...d2].some(p => p.includes('holds'))).toBe(false);
    const d3 = seen(3);
    expect(d3.has('Which holds more?') && d3.has('Which holds less?')).toBe(true);
  });

  it('the bank has at least 4 pairs per attribute, and no emoji holds opposite roles within an attribute', () => {
    for (const [attr, pairs] of Object.entries(BANK)) {
      expect(pairs.length, attr).toBeGreaterThanOrEqual(4);
      const bigs = new Set(pairs.map(p => p[0])), smalls = new Set(pairs.map(p => p[1]));
      for (const b of bigs) expect(smalls.has(b), `${attr}: ${b}`).toBe(false);
    }
  });
});
