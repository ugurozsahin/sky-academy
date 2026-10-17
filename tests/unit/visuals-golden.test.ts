import { describe, expect, it, vi } from 'vitest';
import type { Visual } from '../../src/curriculum';
import { coinSVG, renderVisual } from '../../src/ui/visuals';
import golden from './golden/visuals.json';

// One sample per visual kind (and variant), pinned byte-for-byte so a refactor of renderVisual cannot change a look (#1405).
const row = (label: string, n: number) => ({ label, n });
const rows = [row('a', 3), row('b', 5), row('c', 2)];
const SAMPLES: Record<string, Visual> = {
  objects: { type: 'objects', emoji: '🍎', n: 7 },
  objectsPlus: { type: 'objects', emoji: '🍎', n: 3, n2: 4, emoji2: '🍐' },
  objectsTake: { type: 'objects', emoji: '🍎', n: 7, n2: -3 },
  tenframe: { type: 'tenframe', n: 6, n2: 7 },
  dots: { type: 'dots', n: 5 },
  array: { type: 'array', rows: 3, cols: 4 },
  coins: { type: 'coins', coins: [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000] },
  clock: { type: 'clock', h: 4, m: 25 },
  clockRoman: { type: 'clock', h: 9, m: 0, roman: true },
  fractionCircle: { type: 'fraction', parts: 4, shaded: 3 },
  fractionBar: { type: 'fraction', parts: 12, shaded: 5, shape: 'bar' },
  fractionStack: { type: 'fraction', parts: 4, shaded: 2, stack: [{ parts: 4, shaded: 2 }, { parts: 4, shaded: 2 }] },
  numberline: { type: 'numberline', from: 0, to: 10, mark: 4 },
  scales: { type: 'scales', left: '3 + 4', right: '? + 2' },
  tally: { type: 'chart', kind: 'tally', rows },
  block: { type: 'chart', kind: 'block', rows },
  pictogram: { type: 'chart', kind: 'pictogram', rows, each: 1, icon: '⭐' },
  table: { type: 'chart', kind: 'table', rows, head: ['Fruit', 'Number'] },
  bar: { type: 'chart', kind: 'bar', rows, step: 2, max: 6 },
  line: { type: 'chart', kind: 'line', rows, step: 2, max: 6 },
  symmetry: { type: 'symmetry', grid: ['#.', '##'] },
  geometry: { type: 'geometry', parts: [] },
  coords: { type: 'coords', size: 4, points: [{ x: 1, y: 2, label: 'A' }] },
  pie: { type: 'pie', slices: rows },
  word: { type: 'word', text: 'cat', emoji: '🐱' },
  sentence: { type: 'sentence', text: 'The _ sat.\nOn the mat' },
  strip: { type: 'strip', text: 'a_c' },
};

describe('renderVisual output is pinned per kind (#1405)', () => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  const g = golden as Record<string, string>;
  for (const [name, v] of Object.entries(SAMPLES)) it(name, () => expect(renderVisual(v)).toBe(g[name]));
  for (const p of [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000]) it(`coin ${p}`, () => expect(coinSVG(p)).toBe(g[`coin${p}`]));
  it('has no stale golden entries', () => expect(Object.keys(g).length).toBe(Object.keys(SAMPLES).length + 10));
});
