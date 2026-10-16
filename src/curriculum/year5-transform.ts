// y5-transform (#1214): where a shape ends up after a translation or a reflection (NC 5M47), on the `coords` grid.
// d1 translation: which lettered shape is the shaded one moved 3 right and 2 up. d2 reflection in a drawn mirror line.
// d3 one of three: how far A moved, a corner's new coordinates, or that a reflection keeps the area. Every answer is
// computed from the vertex data (`transform`), so the picture and the key cannot disagree. Wrong shapes are named
// slips: the moves swapped, the wrong way, a slid copy not flipped, the other axis, the mirror distance miscounted.
import type { Difficulty, Generator, Question, Rng, Visual } from './types';
import { pick, ri, shuffle, wideFor, wordQ } from './util';

type P = [number, number];
type Coords = Extract<Visual, { type: 'coords' }>;
const SIZE = 10;
/** Asymmetric outlines, 3–5 corners, each inside a 3 × 3 box starting at the origin. */
const BASES: P[][] = [
  [[0, 0], [3, 0], [0, 2]], [[0, 0], [2, 0], [0, 3]], [[0, 0], [3, 0], [2, 2], [0, 1]], [[0, 0], [3, 0], [3, 1], [1, 2]],
  [[0, 0], [3, 0], [3, 1], [1, 3], [0, 2]], [[0, 0], [2, 1], [3, 3], [0, 3]],
];
const key = (pts: P[]) => pts.map(p => p.join(',')).sort().join(';');
const box = (pts: P[]) => ({ x0: Math.min(...pts.map(p => p[0])), x1: Math.max(...pts.map(p => p[0])), y0: Math.min(...pts.map(p => p[1])), y1: Math.max(...pts.map(p => p[1])) });
const fits = (pts: P[]) => pts.every(([x, y]) => x >= 0 && y >= 0 && x <= SIZE && y <= SIZE);
/** Two outlines overlap when their bounding boxes share area (touching at an edge is fine). */
const clash = (a: P[], b: P[]) => { const p = box(a), q = box(b); return p.x0 < q.x1 && q.x0 < p.x1 && p.y0 < q.y1 && q.y0 < p.y1; };
const fmt = (p: P) => `(${p[0]}, ${p[1]})`;

/** The topic's own oracle: a shape after a move, or after a reflection in the line x = at (axis 'x') or y = at (axis 'y'). */
export const transform = {
  move: (pts: P[], dx: number, dy: number): P[] => pts.map(([x, y]) => [x + dx, y + dy]),
  reflect: (pts: P[], axis: 'x' | 'y', at: number): P[] => pts.map(([x, y]) => axis === 'x' ? [2 * at - x, y] : [x, 2 * at - y]),
};

const place = (rng: Rng): P[] => { const base = pick(rng, BASES), flip = rng() < 0.5; const o = ri(rng, 0, SIZE - 3), r = ri(rng, 0, SIZE - 3); return base.map(([x, y]): P => flip ? [3 - x + o, y + r] : [x + o, y + r]); };

/** Three lettered outlines (one right) plus the shaded one; null when a candidate is off the grid, repeated or overlaps another. */
function build(rng: Rng, shaded: P[], right: P[], wrong: P[][], mirror?: Coords['mirror'], extra: Coords['points'] = []): { q: Pick3; v: Coords } | null {
  const cands = [right, ...wrong];
  const ks = new Set(cands.map(key));
  if (ks.size !== cands.length || ks.has(key(shaded))) return null;
  for (const c of cands) if (!fits(c) || clash(shaded, c)) return null;
  for (let i = 0; i < cands.length; i++) for (let j = i + 1; j < cands.length; j++) if (clash(cands[i], cands[j])) return null;
  const order = shuffle(rng, cands), letters = ['A', 'B', 'C'];
  const v: Coords = { type: 'coords', size: SIZE, points: extra, shapes: [{ pts: shaded, shaded: true }, ...order.map((pts, i) => ({ label: letters[i], pts }))], ...(mirror ? { mirror } : {}) };
  return { q: { letter: letters[order.indexOf(right)], letters }, v };
}
type Pick3 = { letter: string; letters: string[] };
const retry = <T>(f: () => T | null): T => { for (let i = 0; i < 500; i++) { const r = f(); if (r) return r; } throw new Error('y5-transform: no card fits the grid'); };
const letterCard = (prompt: string, say: string, b: { q: Pick3; v: Coords }, hint: string): Question =>
  ({ prompt, say, answer: b.q.letter, options: b.q.letters, wide: false, visual: b.v, hint, hintIsData: false });

const dir = (n: number, pos: string, neg: string) => `${Math.abs(n)} ${n > 0 ? pos : neg}`;

/** d1: the shaded shape moved by (dx, dy), one axis a long way (3 or 4), the other 1–4, never equal. */
function translateCard(rng: Rng): Question {
  return retry(() => {
    const big = ri(rng, 3, 4), small = pick(rng, [1, 2, 3, 4].filter(n => n !== big)), horiz = rng() < 0.5;
    const dx = (horiz ? big : small) * (rng() < 0.5 ? 1 : -1), dy = (horiz ? small : big) * (rng() < 0.5 ? 1 : -1);
    const shaded = place(rng), right = transform.move(shaded, dx, dy);
    const slips = shuffle(rng, [transform.move(shaded, dy, dx), transform.move(shaded, -dx, dy), transform.move(shaded, dx, -dy)]);
    const b = build(rng, shaded, right, slips.slice(0, 2));
    if (!b) return null;
    const ask = `${dir(dx, 'right', 'left')} and ${dir(dy, 'up', 'down')}`;
    return letterCard(`Which shape is the shaded one moved ${ask}?`, `Which shape is the shaded one moved ${ask}?`, b, 'Count the squares along, then up or down');
  });
}

/** d2: the shaded shape reflected in a drawn mirror line; the shape sits at least one square from the line, and its image stays on the grid. */
function reflectCard(rng: Rng): Question {
  return retry(() => {
    const axis: 'x' | 'y' = rng() < 0.5 ? 'x' : 'y', flip = rng() < 0.5, at0 = ri(rng, 4, 6);
    // Built on the low side of the line (offset `o` along the axis), then the whole card is optionally turned over the grid's middle.
    const o = ri(rng, Math.max(0, 2 * at0 - 10), at0 - 4), r = ri(rng, 0, SIZE - 3), base = pick(rng, BASES), mf = rng() < 0.5;
    const raw: P[] = base.map(([x, y]): P => { const a = (mf ? 3 - x : x) + o, c = y + r; return axis === 'x' ? [a, c] : [c, a]; });
    const turn = (p: P): P => axis === 'x' ? [flip ? SIZE - p[0] : p[0], p[1]] : [p[0], flip ? SIZE - p[1] : p[1]];
    const shaded = raw.map(turn), at = flip ? SIZE - at0 : at0;
    const right = transform.reflect(shaded, axis, at), b0 = box(shaded);
    const gap = 2 * at - (axis === 'x' ? b0.x0 + b0.x1 : b0.y0 + b0.y1);   // slides the outline across the line without flipping it
    const across = axis === 'x' ? 'y' : 'x';
    // The unflipped copy lands on the far side of the line but a few squares along it, so no two outlines share a box.
    for (const sh of shuffle(rng, [-6, -5, -4, -3, 3, 4, 5, 6])) for (const c of shuffle(rng, [1, 2, 3, 4, 5, 6, 7, 8, 9])) {
      const slid = transform.move(shaded, axis === 'x' ? gap : sh, axis === 'y' ? gap : sh);
      const b = build(rng, shaded, right, [slid, transform.reflect(shaded, across, c)], { axis, at });
      if (b) return letterCard('Which shape is the shaded one reflected in the mirror line?', 'Which shape is the shaded one reflected in the dashed mirror line?', b, 'Each corner is as far behind the mirror as it was in front');
    }
    return null;
  });
}

/** d3 describe: A is the shaded shape, B its image; how many squares did it move along (or up)? */
function describeCard(rng: Rng): Question {
  const big = ri(rng, 3, 5), small = ri(rng, 1, 2), dx = rng() < 0.5 ? big : small, dy = dx === big ? small : big, alongX = rng() < 0.5;
  const shaded = retry(() => { const s = place(rng); return fits(transform.move(s, dx, dy)) && clash(s, transform.move(s, dx, dy)) === false ? s : null; });
  const image = transform.move(shaded, dx, dy), ans = alongX ? dx : dy, other = alongX ? dy : dx;
  const ds = [other, ans + 1, ans - 1, ans + other].filter((n, i, a) => n > 0 && n !== ans && a.indexOf(n) === i).slice(0, 3);
  for (let n = 1; ds.length < 3; n++) if (n !== ans && !ds.includes(n)) ds.push(n);
  const what = alongX ? 'squares right' : 'squares up', say = `How many ${what} did A move to reach B?`;
  const v: Coords = { type: 'coords', size: SIZE, points: [], shapes: [{ label: 'A', pts: shaded, shaded: true }, { label: 'B', pts: image }] };
  return { ...wordQ(rng, `How many ${what} did A move to reach B?`, String(ans), ds.map(String), { say, hint: 'Count the squares one corner moves', hintIsData: false }), visual: v };
}

/** d3 corner: a labelled corner P moves with its shape; where is it now? */
function cornerCard(rng: Rng): Question {
  return retry(() => {
    const mirrored = rng() < 0.5, shaded = place(rng), pt = pick(rng, shaded);
    let to: P, slips: P[], how: string;
    if (mirrored) {
      const at = ri(rng, 3, 7), b0 = box(shaded);
      if (!(b0.x1 < at || b0.x0 > at)) return null;
      to = transform.reflect([pt], 'x', at)[0]; how = `Reflect P in the line x = ${at}.`;
      slips = [[pt[0], pt[1]], [to[1], to[0]], [2 * (at + 1) - pt[0], pt[1]], [pt[0], 2 * at - pt[1]]];
      const v: Coords = { type: 'coords', size: SIZE, points: [{ x: pt[0], y: pt[1], label: 'P' }], shapes: [{ pts: shaded, shaded: true }], mirror: { axis: 'x', at } };
      return cornerQ(rng, v, to, slips, how);
    }
    const dx = ri(rng, 1, 4) * (rng() < 0.5 ? 1 : -1), dy = ri(rng, 1, 4) * (rng() < 0.5 ? 1 : -1);
    if (dx === dy || Math.abs(dx) === Math.abs(dy)) return null;
    to = [pt[0] + dx, pt[1] + dy]; how = `P moves ${dir(dx, 'right', 'left')} and ${dir(dy, 'up', 'down')}.`;
    slips = [[pt[0] + dy, pt[1] + dx], [pt[0] - dx, pt[1] + dy], [pt[0] + dx, pt[1] - dy]];
    const v: Coords = { type: 'coords', size: SIZE, points: [{ x: pt[0], y: pt[1], label: 'P' }], shapes: [{ pts: shaded, shaded: true }] };
    return cornerQ(rng, v, to, slips, how);
  });
}
function cornerQ(rng: Rng, v: Coords, to: P, slips: P[], how: string): Question | null {
  const ds = [...new Set(slips.filter(s => fits([s]) && fmt(s) !== fmt(to)).map(fmt))].slice(0, 3);
  if (!fits([to]) || ds.length < 3) return null;
  const p = v.points[0], at = `P is at ${fmt([p.x, p.y])}.`;
  return { ...wordQ(rng, `${at} ${how} Where does P go?`, fmt(to), ds, { say: `${at} ${how} Where does P go?`.replace(/\((\d+), (\d+)\)/g, '$1, $2'), hint: 'Move the corner, not the whole picture', hintIsData: false }), visual: v };
}

/** d3 area: a reflection never changes the shape, so the area stays the same. */
function areaCard(rng: Rng): Question {
  const axis: 'x' | 'y' = rng() < 0.5 ? 'x' : 'y', at = ri(rng, 4, 6);
  const shaded = retry(() => { const s = place(rng), b = box(s); return (axis === 'x' ? b.x1 < at || b.x0 > at : b.y1 < at || b.y0 > at) ? s : null; });
  const v: Coords = { type: 'coords', size: SIZE, points: [], shapes: [{ pts: shaded, shaded: true }], mirror: { axis, at } };
  const q = wordQ(rng, 'After a reflection, the shape\'s area is…', 'same', ['bigger', 'smaller'], { say: 'After a reflection, is the area of the shape the same, bigger or smaller?', hint: 'A reflection only flips the shape', hintIsData: false });
  return { ...q, options: shuffle(rng, ['same', 'bigger', 'smaller']), wide: wideFor(['same', 'bigger', 'smaller']), visual: v };
}

export const y5Transform: Generator = (d: Difficulty, rng: Rng): Question => {
  if (d === 1) return translateCard(rng);
  if (d === 2) return reflectCard(rng);
  return pick(rng, [describeCard, cornerCard, areaCard])(rng);
};
