// y6-coords (#1213): coordinates in all four quadrants (NC 6M46), on a −5…5 grid. d1 read a lettered point's (x, y); d2
// find the letter at a pair; d3 the fourth corner of a rectangle. Every answer is computed from the plotted points alone
// (`coordsAnswer`), so the picture and the key cannot disagree. Each wrong option is a named slip: x and y swapped, a
// minus dropped or added on one coordinate, or on both. Labels use the real minus sign U+2212, never a hyphen.
import type { Difficulty, Generator, Question, Rng, Visual } from './types';
import { pick, ri, shuffle, wideFor } from './util';

type Pt = { x: number; y: number };
type Pts = Extract<Visual, { type: 'coords' }>['points'];
const SIZE = 5, MIN = -5;

const num = (n: number) => (n < 0 ? '−' : '') + Math.abs(n);
export const fmt = (p: Pt) => `(${num(p.x)}, ${num(p.y)})`;
/** The pair read as two numbers: "minus 3, 4", never "minus thirty-four". */
const say = (s: string) => s.replace(/\((−?\d+), (−?\d+)\)/g, '$1, $2').replace(/−/g, 'minus ');
const key = (p: Pt) => `${p.x},${p.y}`;
/** A non-zero coordinate in −5…5, so no point sits on an axis. */
const coord = (rng: Rng) => pick(rng, [-5, -4, -3, -2, -1, 1, 2, 3, 4, 5]);

/** The answer to each kind of card, from the point data only — the topic's own oracle (the unit test recomputes it). */
export const coordsAnswer = {
  read: (points: Pts, label: string): string => fmt(points.find(q => q.label === label)!),
  at: (points: Pts, pair: Pt): string => points.filter(p => p.x === pair.x && p.y === pair.y).map(p => p.label).join(''),
  /** The fourth corner of a rectangle whose right angle is at A, with B and C on its two sides: B + C − A. */
  corner: (a: Pt, b: Pt, c: Pt): Pt => ({ x: b.x + c.x - a.x, y: b.y + c.y - a.y }),
};

/** The slips on a pair, swapped pair first: swapped x and y, a minus on x only, on y only, on both. */
const slips = (p: Pt): Pt[] => [{ x: p.y, y: p.x }, { x: -p.x, y: p.y }, { x: p.x, y: -p.y }, { x: -p.x, y: -p.y }];
const card = (prompt: string, answer: string, options: string[], points: Pts, hint: string, join?: string[]): Question => ({
  prompt, say: say(prompt), answer, options, wide: wideFor(options),
  visual: { type: 'coords', size: SIZE, min: MIN, points, ...(join ? { join } : {}) }, hint, hintIsData: false,
});

/** d1: "What are the coordinates of A?" — three or four points, none on an axis. */
function readCard(rng: Rng): Question {
  const seen = new Set<string>(), pts: Pt[] = [], n = ri(rng, 3, 4);
  while (pts.length < n) { const p = { x: coord(rng), y: coord(rng) }; if (!seen.has(key(p))) { seen.add(key(p)); pts.push(p); } }
  const points: Pts = pts.map((p, i) => ({ ...p, label: 'ABCD'[i] })), target = pick(rng, points), ans = fmt(target);
  const decoys = [...new Set(slips(target).map(fmt))].filter(o => o !== ans).slice(0, 3);
  return card(`What are the coordinates of ${target.label}?`, coordsAnswer.read(points, target.label), shuffle(rng, [ans, ...decoys]), points, 'Slice the coordinates');
}

/** d2: "Which point is at (−2, −5)?" — the other three letters sit at the target's swapped and sign-slip places. */
function findCard(rng: Rng): Question {
  for (;;) {
    const t = { x: coord(rng), y: coord(rng) };
    if (Math.abs(t.x) === Math.abs(t.y)) continue;   // the swapped pair and the sign slips must all be different places
    const [swap, ...signs] = slips(t), others = [swap, ...shuffle(rng, signs).slice(0, 2)];
    const places = shuffle(rng, [t, ...others]);
    const points: Pts = places.map((p, i) => ({ ...p, label: 'ABCD'[i] }));
    return card(`Which point is at ${fmt(t)}?`, coordsAnswer.at(points, t), points.map(p => p.label), points, 'Slice the right letter');
  }
}

/** d3: A, B, C are three corners of a rectangle with its right angle at A; it crosses an axis; where is the fourth corner? */
function cornerCard(rng: Rng): Question {
  for (;;) {
    const a = { x: coord(rng), y: coord(rng) }, b = { x: coord(rng), y: a.y }, c = { x: a.x, y: coord(rng) };
    if (b.x === a.x || c.y === a.y) continue;
    if (b.x * a.x > 0 && c.y * a.y > 0) continue;   // it must straddle an axis
    const want = coordsAnswer.corner(a, b, c), ans = fmt(want);
    const decoys = [...new Set(slips(want).map(fmt))].filter(o => o !== ans).slice(0, 3);
    const points: Pts = [{ ...a, label: 'A' }, { ...b, label: 'B' }, { ...c, label: 'C' }];
    return card('A, B, C: three corners of a rectangle. Fourth corner?', ans, shuffle(rng, [ans, ...decoys]), points, 'Slice the coordinates', ['B', 'A', 'C']);
  }
}

export const y6Coords: Generator = (d: Difficulty, rng) => d === 1 ? readCard(rng) : d === 2 ? findCard(rng) : cornerCard(rng);
