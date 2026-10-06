// y4-coords (#1129): coordinates in the first quadrant (NC 4M38–40). d1 read a lettered point's (x, y), or find the
// point at a pair; d2 where a point lands after a move; d3 which lettered point completes a rectangle. Every answer
// is computed from the plotted points alone (`coordsAnswer`), so the picture and the key cannot disagree; each wrong
// option is a named slip — the swapped pair ("along then up"), off by one (counting lines, not spaces), a move the
// wrong way, and for d3 the corner from the wrong diagonal, which makes a parallelogram.
import type { Difficulty, Generator, Question, Rng, Visual } from './types';
import { pick, ri, shuffle, wideFor } from './util';

type Pt = { x: number; y: number };
type Pts = Extract<Visual, { type: 'coords' }>['points'];
const SIZE: Record<Difficulty, number> = { 1: 5, 2: 8, 3: 10 };

export const fmt = (p: Pt) => `(${p.x}, ${p.y})`;
/** The coordinate pair read as two numbers, never one ("3, 4", not "thirty-four"). */
const say = (s: string) => s.replace(/\((\d+), (\d+)\)/g, '$1, $2');
const inGrid = (p: Pt, size: number) => p.x >= 0 && p.y >= 0 && p.x <= size && p.y <= size;
const key = (p: Pt) => `${p.x},${p.y}`;

/** The answer to each kind of card, from the point data only — the topic's own oracle (the unit test uses it too). */
export const coordsAnswer = {
  read: (points: Pts, label: string): string => { const p = points.find(q => q.label === label)!; return fmt(p); },
  at: (points: Pts, pair: Pt): string => points.filter(p => p.x === pair.x && p.y === pair.y).map(p => p.label).join(''),
  move: (from: Pt, dx: number, dy: number): string => fmt({ x: from.x + dx, y: from.y + dy }),
  /** The fourth corner of a rectangle whose corner B sits between A and C. */
  corner: (a: Pt, b: Pt, c: Pt): Pt => ({ x: a.x + c.x - b.x, y: a.y + c.y - b.y }),
};

const pt = (rng: Rng, size: number, lo = 1): Pt => ({ x: ri(rng, lo, size), y: ri(rng, lo, size) });
function distinctPoints(rng: Rng, size: number, n: number): Pt[] {
  const seen = new Set<string>(), out: Pt[] = [];
  while (out.length < n) { const p = pt(rng, size); if (!seen.has(key(p))) { seen.add(key(p)); out.push(p); } }
  return out;
}
const labelled = (ps: Pt[], letters: string): Pts => ps.map((p, i) => ({ ...p, label: letters[i] }));
/** Up to three distinct on-grid pairs from `pool`, none the answer, padded with nearby pairs when the pool runs short. */
function pairDecoys(rng: Rng, size: number, answer: Pt, pool: Pt[]): string[] {
  const out: string[] = [];
  const add = (p: Pt) => { const s = fmt(p); if (inGrid(p, size) && key(p) !== key(answer) && !out.includes(s)) out.push(s); };
  pool.forEach(add);
  for (let tries = 0; out.length < 3 && tries < 50; tries++) add({ x: Math.max(0, Math.min(size, answer.x + ri(rng, -2, 2))), y: Math.max(0, Math.min(size, answer.y + ri(rng, -2, 2))) });
  return out.slice(0, 3);
}
const card = (prompt: string, answer: string, options: string[], size: number, points: Pts, hint: string, join?: string[]): Question => ({
  prompt, say: say(prompt), answer, options, wide: wideFor(options),
  visual: { type: 'coords', size, points, ...(join ? { join } : {}) }, hint, hintIsData: false,
});

/** d1: "What are the coordinates of A?" (answer a pair) or "Which point is at (3, 4)?" (answer a letter). */
function readCard(rng: Rng): Question {
  const size = SIZE[1], n = ri(rng, 3, 4), points = labelled(distinctPoints(rng, size, n), 'ABCD');
  if (rng() < 0.5) {
    const target = pick(rng, points), ans = target;
    const others = points.filter(p => p !== target).map(p => ({ x: p.x, y: p.y }));
    const pool = [{ x: ans.y, y: ans.x }, { x: ans.x + 1, y: ans.y }, { x: ans.x, y: ans.y + 1 }, { x: ans.x - 1, y: ans.y }, { x: ans.x, y: ans.y - 1 }, ...others];
    const options = shuffle(rng, [fmt(ans), ...pairDecoys(rng, size, ans, pool)]);
    return card(`What are the coordinates of ${target.label}?`, coordsAnswer.read(points, target.label), options, size, points, 'Slice the coordinates');
  }
  const target = pick(rng, points);
  return card(`Which point is at ${fmt(target)}?`, coordsAnswer.at(points, target), shuffle(rng, points.map(p => p.label)), size, points, 'Slice the right letter');
}

/** d2: "A moves 3 right and 2 up. Where does it land?" — a move in one or both directions, always ending on the grid. */
function moveCard(rng: Rng): Question {
  const size = SIZE[2];
  for (;;) {
    const from = pt(rng, size), dx = ri(rng, -4, 4), dy = ri(rng, -4, 4);
    const to = { x: from.x + dx, y: from.y + dy };
    if ((dx === 0 && dy === 0) || !inGrid(to, size)) continue;
    const parts = [dx ? `${Math.abs(dx)} ${dx > 0 ? 'right' : 'left'}` : '', dy ? `${Math.abs(dy)} ${dy > 0 ? 'up' : 'down'}` : ''].filter(Boolean);
    const pool = [
      { x: from.x + dy, y: from.y + dx },          // the swapped move
      { x: from.x - dx, y: from.y + dy }, { x: from.x + dx, y: from.y - dy },   // one direction the wrong way
      { x: to.x + 1, y: to.y }, { x: to.x, y: to.y + 1 }, { x: to.x - 1, y: to.y }, { x: to.x, y: to.y - 1 },   // off by one
    ];
    const decoys = pairDecoys(rng, size, to, pool);
    if (decoys.length < 3) continue;
    return card(`A moves ${parts.join(' and ')}. Where does it land?`, coordsAnswer.move(from, dx, dy), shuffle(rng, [fmt(to), ...decoys]), size, [{ ...from, label: 'A' }], 'Slice the coordinates');
  }
}

/** d3: A, B, C are three corners of a rectangle (B between A and C); D, E, F are candidates for the fourth. */
function cornerCard(rng: Rng): Question {
  const size = SIZE[3];
  for (;;) {
    const b = pt(rng, size), a = { x: b.x, y: ri(rng, 1, size) }, c = { x: ri(rng, 1, size), y: b.y };
    if (a.y === b.y || c.x === b.x) continue;
    const want = coordsAnswer.corner(a, b, c);
    const taken = new Set([a, b, c, want].map(key));
    const pool = [
      { x: a.x + b.x - c.x, y: a.y + b.y - c.y },   // the wrong diagonal: a parallelogram
      { x: b.x + c.x - a.x, y: b.y + c.y - a.y },
      { x: want.x + 1, y: want.y }, { x: want.x, y: want.y + 1 }, { x: want.x - 1, y: want.y }, { x: want.x, y: want.y - 1 },
    ].filter(p => inGrid(p, size) && !taken.has(key(p)));
    const decoys: Pt[] = [];
    for (const p of pool) if (!decoys.some(d => key(d) === key(p))) decoys.push(p);
    if (decoys.length < 2) continue;
    const cands = shuffle(rng, [want, decoys[0], decoys[1]]), answer = 'DEF'[cands.indexOf(want)];
    const points = [...labelled([a, b, c], 'ABC'), ...labelled(cands, 'DEF')];
    const shape = Math.abs(a.y - b.y) === Math.abs(c.x - b.x) ? 'square' : 'rectangle';
    return card(`Which point completes the ${shape}?`, answer, ['D', 'E', 'F'], size, points, 'Slice the right letter', ['A', 'B', 'C']);
  }
}

export const y4Coords: Generator = (d, rng) => d === 1 ? readCard(rng) : d === 2 ? moveCard(rng) : cornerCard(rng);
