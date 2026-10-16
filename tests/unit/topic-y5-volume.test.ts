import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty, Question } from '../../src/curriculum';
import { sayIsSafe } from '../../src/curriculum/ks2say';
import { CAPACITY, capLabel } from '../../src/curriculum/year5-volume';
import { leakShares } from './helpers/decoy-leak';
import { areaOf, edgeWalk } from './helpers/grid-measure';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y5-volume')!;
const draw = (d: Difficulty, n = 300) => { const r = rng(1206 * 10 + d); return Array.from({ length: n }, () => topic.gen(d, r)); };
const gridOf = (q: Question) => { const v = q.visual as { type: string; grid: string[]; mirror?: false } | undefined; if (!v) return undefined; expect(v.type).toBe('symmetry'); expect(v.mirror).toBe(false); return v.grid; };
const layersOf = (q: Question) => { const m = /^(\d+) layers like this/.exec(q.prompt); return m ? Number(m[1]) : 1; };
const ml = (label: string) => { const [n, u] = label.split(' '); return Number(n.replace(/,/g, '')) * (u === 'l' ? 1000 : 1); };

describe('y5-volume (#1206)', () => {
  it('is registered for Year 5 maths in the measure strand with the NC row', () => {
    expect(topic.year).toBe('year5'); expect(topic.subject).toBe('maths'); expect(topic.strand).toBe('measure'); expect(topic.title).toBe('Volume and Capacity'); expect(topic.icon).toBe('🧊');
  });

  it('every card has four distinct options including the answer, and a speakable say', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draw(d)) {
      expect(new Set(q.options).size, q.prompt).toBe(4); expect(q.options).toContain(q.answer);
      expect(q.say, q.prompt).toBeTruthy(); expect(sayIsSafe(q.say!), q.say).toBe(true);
    }
  });

  it('volume cards: the answer is the cubes counted in the drawn layer × the layers in the prompt; the grid is flat and at most 14 × 14', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draw(d, 400)) {
      const g = gridOf(q);
      if (!g) { expect(d).toBe(3); continue; }
      expect(g.length).toBeLessThanOrEqual(14); expect(g[0].length).toBeLessThanOrEqual(14); expect(g.join('')).not.toMatch(/h/);
      const layers = layersOf(q), cube = areaOf(g);
      expect(q.prompt).toMatch(layers === 1 ? /^One layer of 1 cm³ cubes\. Volume = \? cm³$/ : /^\d+ layers like this, each cube 1 cm³\. Volume = \? cm³$/);
      expect(q.answer).toBe(String(cube * layers));
      expect(q.prompt).not.toMatch(/×|length|width|height/);   // no formula, no 3-D wording
      if (d === 1) expect(layers).toBe(1);
      if (d >= 2) { expect(d === 2 ? g.join('').split('.').length === 1 : true).toBe(true); expect(layers).toBeGreaterThanOrEqual(2); expect(layers).toBeLessThanOrEqual(5); expect(cube * layers).toBeLessThanOrEqual(100); }
    }
  });

  it('d1: one layer of at most 20 cubes, a full rectangle; perimeter is offered', () => {
    for (const q of draw(1)) { const g = gridOf(q)!; expect(areaOf(g)).toBeLessThanOrEqual(20); expect(g.join('')).not.toMatch(/\./); if (edgeWalk(g) !== areaOf(g)) expect(q.options).toContain(String(edgeWalk(g))); }
  });

  it('d2: adding instead of multiplying, one layer only, and perimeter × layers are offered', () => {
    for (const q of draw(2, 600)) {
      const g = gridOf(q)!, layers = layersOf(q), cube = areaOf(g);
      const named = [cube + layers, cube, edgeWalk(g) * layers].filter(v => v !== cube * layers);
      expect(named.filter(v => q.options.includes(String(v))).length, q.prompt).toBeGreaterThanOrEqual(Math.min(cube * layers >= 20 ? 1 : 3, named.length));   // 20+ keeps one slip so a decoy can share each digit (#1058)
      expect(q.options).toContain(String(cube + layers));
    }
  });

  it('d3: an L-shaped layer (one corner out) or a capacity estimate', () => {
    let l = 0, cap = 0;
    for (const q of draw(3, 600)) {
      const g = gridOf(q);
      if (g) { l++; expect(g.join('')).toMatch(/\./); expect(layersOf(q)).toBeGreaterThanOrEqual(2); continue; }
      cap++; expect(q.prompt).toMatch(/^About how much does .+ hold\?$/);
    }
    expect(l).toBeGreaterThan(250); expect(cap).toBeGreaterThan(150);
  });

  it('capacity: the answer is the bank value and every decoy is at least ×10 or ÷10 away', () => {
    const bank = new Map(CAPACITY.map(([t, v]) => [`About how much does ${t} hold?`, v]));
    const seen = new Set<string>();
    for (const q of draw(3, 800).filter(x => !x.visual)) {
      const v = bank.get(q.prompt)!; expect(v, q.prompt).toBeDefined(); seen.add(q.prompt);
      expect(q.answer).toBe(capLabel(v));
      for (const o of q.options.filter(x => x !== q.answer)) { const r = ml(o) / v; expect(r >= 10 || r <= 0.1, `${q.prompt} ${o}`).toBe(true); }
    }
    expect(seen.size).toBe(CAPACITY.length);
  });

  it('the capacity bank is about a dozen everyday containers, in British English', () => {
    expect(CAPACITY.length).toBeGreaterThanOrEqual(10);
    const text = JSON.stringify(draw(3, 800).map(q => [q.prompt, q.say, q.options]));
    expect(text).not.toMatch(/liter|meter|gallon/i);
  });

  it('leak limit: at most 30% of in-scope cards have an answer whose last or leading digit no decoy shares', () => {
    for (const d of [1, 2, 3] as Difficulty[]) { const s = leakShares(topic.gen, d); if (s.counted < 100) continue; expect(s.units, `d${d} last`).toBeLessThanOrEqual(0.3); expect(s.leading, `d${d} leading`).toBeLessThanOrEqual(0.3); }
  });
});
