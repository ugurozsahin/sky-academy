import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty, Question } from '../../src/curriculum';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y4-area')!;
const draw = (d: Difficulty, n: number) => { const r = rng(1151 * 10 + d); return Array.from({ length: n }, () => topic.gen(d, r)); };

// Independent oracle helpers, written from the grid strings alone.
const gridOf = (q: Question) => { const v = q.visual as { type: string; grid: string[]; mirror?: false }; expect(v.type).toBe('symmetry'); expect(v.mirror).toBe(false); return v.grid; };
const on = (g: string[], r: number, c: number) => g[r]?.[c] === '#';
const area = (g: string[]) => g.join('').split('#').length - 1;
const perim = (g: string[]) => { let n = 0; g.forEach((row, r) => [...row].forEach((_, c) => { if (on(g, r, c)) n += [[-1, 0], [1, 0], [0, -1], [0, 1]].filter(([dr, dc]) => !on(g, r + dr, c + dc)).length; })); return n; };
const flood = (g: string[], start: [number, number], ok: (r: number, c: number) => boolean) => {
  const seen = new Set<string>(), todo = [start];
  while (todo.length) { const [r, c] = todo.pop()!; const k = `${r},${c}`; if (seen.has(k) || r < -1 || c < -1 || r > g.length || c > g[0].length || !ok(r, c)) continue; seen.add(k); todo.push([r + 1, c], [r - 1, c], [r, c + 1], [r, c - 1]); }
  return seen.size;
};
const connected = (g: string[]) => { const r = g.findIndex(row => row.includes('#')); return flood(g, [r, g[r].indexOf('#')], (y, x) => on(g, y, x)) === area(g); };
const noHoles = (g: string[]) => flood(g, [-1, -1], (y, x) => !on(g, y, x)) === (g.length + 2) * (g[0].length + 2) - area(g);
const isRect = (g: string[]) => area(g) === g.length * g[0].length;
const isAreaCard = (q: Question) => q.prompt.startsWith('What is the area');
const leakFree = (q: Question) => Number(q.answer) >= 20 && !q.options.some(o => o !== q.answer && Number(o) % 10 === Number(q.answer) % 10);

describe('y4-area (#1151)', () => {
  it('is registered for Year 4', () => { expect(topic.year).toBe('year4'); });

  it('d1: area of a full rectangle of at most 24 squares, perimeter offered as a decoy', () => {
    for (const q of draw(1, 300)) {
      const g = gridOf(q);
      expect(isRect(g)).toBe(true); expect(area(g)).toBeLessThanOrEqual(24);
      expect(q.answer).toBe(String(area(g)));
      expect(q.options).toHaveLength(4); expect(new Set(q.options).size).toBe(4);
      if (perim(g) !== area(g)) expect(q.options).toContain(String(perim(g)));
    }
  });

  it('d2: every shape is one piece, no holes, at most 8×8, no mirror line; area and perimeter by the oracle', () => {
    let areas = 0, perims = 0, nonRect = 0;
    for (const q of draw(2, 600)) {
      const g = gridOf(q);
      expect(g.length).toBeLessThanOrEqual(8); g.forEach(r => expect(r.length).toBe(g[0].length)); expect(g[0].length).toBeLessThanOrEqual(8);
      expect(connected(g)).toBe(true); expect(noHoles(g)).toBe(true);
      if (!isRect(g)) nonRect++;
      if (isAreaCard(q)) { areas++; expect(q.answer).toBe(String(area(g))); if (perim(g) !== area(g)) expect(q.options).toContain(String(perim(g))); }
      else { perims++; expect(q.prompt).toBe('Each square has 1 cm sides. What is the perimeter in cm?'); expect(q.answer).toBe(String(perim(g))); if (perim(g) !== area(g)) expect(q.options).toContain(String(area(g))); }
      expect(q.options).toContain(q.answer); expect(new Set(q.options).size).toBe(4);
    }
    expect(areas).toBeGreaterThan(200); expect(perims).toBeGreaterThan(200); expect(nonRect).toBe(600);
  });

  it('d3: perimeter from the sides, 2(a + b) or 4a, in cm or m, sides 2–15, answer at most 60, no grid', () => {
    const units = new Set<string>(); let squares = 0, rects = 0;
    for (const q of draw(3, 600)) {
      expect(q.visual).toBeUndefined();
      const sq = q.prompt.match(/^A square has (\d+) (cm|m) sides\. What is its perimeter in (cm|m)\?$/);
      const rc = q.prompt.match(/^A rectangle is (\d+) (cm|m) long and (\d+) (cm|m) wide\. What is its perimeter in (cm|m)\?$/);
      if (sq) { squares++; const s = Number(sq[1]); expect(s).toBeGreaterThanOrEqual(2); expect(s).toBeLessThanOrEqual(15); expect(q.answer).toBe(String(4 * s)); expect(q.options).toContain(String(s * s)); units.add(sq[2]); expect(sq[3]).toBe(sq[2]); }
      else { rects++; expect(rc).not.toBeNull(); const [l, b] = [Number(rc![1]), Number(rc![3])]; expect(Math.min(l, b)).toBeGreaterThanOrEqual(2); expect(Math.max(l, b)).toBeLessThanOrEqual(15); expect(q.answer).toBe(String(2 * (l + b))); expect(q.options).toContain(String(l * b)); expect(rc![2]).toBe(rc![4]); expect(rc![5]).toBe(rc![2]); units.add(rc![2]); }
      expect(Number(q.answer)).toBeLessThanOrEqual(60);
      expect(new Set(q.options).size).toBe(4); expect(q.options).toContain(q.answer);
    }
    expect([...units].sort()).toEqual(['cm', 'm']); expect(squares).toBeGreaterThan(50); expect(rects).toBeGreaterThan(300);
  });

  it('options are bare numbers, and no card names square units (Year 5 notation)', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draw(d, 300)) {
      q.options.forEach(o => expect(o).toMatch(/^\d+$/));
      const text = `${q.prompt} ${q.say ?? ''} ${q.hint ?? ''}`;
      expect(text).not.toMatch(/cm²|cm2|m²|square centimetre|square metre/i);
    }
  });

  it('answers of 20 or more: at most 30% have a units digit no decoy shares (2,000 draws per difficulty)', () => {
    for (const d of [2, 3] as Difficulty[]) {
      const big = draw(d, 2000).filter(q => Number(q.answer) >= 20);
      expect(big.length).toBeGreaterThan(100);
      expect(big.filter(leakFree).length / big.length).toBeLessThanOrEqual(0.3);
    }
  });
});
