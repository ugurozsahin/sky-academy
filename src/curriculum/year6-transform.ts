// y6-transform (#1249): translate a point or a shape and reflect it in the axes, on the four-quadrant `coords` grid (NC 6M47, −5…5).
// d1 where a point lands after a move, d2 which lettered shape is the shaded one reflected in the y-axis or the x-axis, d3 a point
// reflected in an axis, or moved and then reflected. Every answer is computed from the vertex data (`transform`), so the picture and
// the key cannot disagree. Each wrong option is a named slip: the other axis, a copy slid across without flipping, a half turn,
// the moves swapped or the wrong way, x and y swapped, the steps in the wrong order. Labels use the real minus sign U+2212.
import type { Difficulty, Generator, Question, Rng, Visual } from './types';
import { pick, ri, shuffle, wideFor } from './util';

type P = [number, number];
type Axis = 'x' | 'y';
type Coords = Extract<Visual, { type: 'coords' }>;
const SIZE = 5, MIN = -5;
const inGrid = (p: P): boolean => p[0] >= MIN && p[0] <= SIZE && p[1] >= MIN && p[1] <= SIZE;

const num = (n: number) => (n < 0 ? '−' : '') + Math.abs(n);
export const fmt = (p: P) => `(${num(p[0])}, ${num(p[1])})`;
const say = (s: string) => s.replace(/\((−?\d+), (−?\d+)\)/g, '$1, $2').replace(/−/g, 'minus ');

/** The topic's own oracle: a point or an outline after a move, or after a reflection in an axis (`'y'` is the y-axis, so x changes sign). */
export const transform = {
  move: (pts: P[], dx: number, dy: number): P[] => pts.map(([x, y]) => [x + dx, y + dy]),
  reflect: (pts: P[], axis: Axis): P[] => pts.map(([x, y]) => axis === 'y' ? [-x, y] : [x, -y]),
  half: (pts: P[]): P[] => pts.map(([x, y]) => [-x, -y]),
};

const card = (prompt: string, spoken: string, answer: string, options: string[], visual: Coords, hint: string): Question =>
  ({ prompt, say: spoken, answer, options, wide: wideFor(options), visual, hint, hintIsData: false });
const grid = (extra: Partial<Coords>): Coords => ({ type: 'coords', size: SIZE, min: MIN, points: [], ...extra });
/** Three distinct wrong pairs from `slips` that stay on the grid and differ from `ans`; null when fewer than three do. */
function decoys(ans: P, slips: P[]): string[] | null {
  const out = [...new Set(slips.filter(p => inGrid(p) && fmt(p) !== fmt(ans)).map(fmt))];
  return out.length >= 3 ? out.slice(0, 3) : null;
}

const dirs = (dx: number, dy: number) => [dx ? `${Math.abs(dx)} ${dx > 0 ? 'right' : 'left'}` : '', dy ? `${Math.abs(dy)} ${dy > 0 ? 'up' : 'down'}` : ''].filter(Boolean).join(', ');

/** d1: a point moved by (dx, dy), both non-zero and different; the slips are the moves swapped, a direction reversed, and x and y swapped. */
function pointMove(rng: Rng): Question {
  for (;;) {
    const p: P = [ri(rng, -4, 4), ri(rng, -4, 4)], dx = ri(rng, 1, 5) * (rng() < 0.5 ? 1 : -1), dy = ri(rng, 1, 4) * (rng() < 0.5 ? 1 : -1);
    if (Math.abs(dx) === Math.abs(dy)) continue;
    const [ans] = transform.move([p], dx, dy);
    if (!inGrid(ans)) continue;
    const ds = decoys(ans, [[p[0] + dy, p[1] + dx], [p[0] - dx, p[1] + dy], [p[0] + dx, p[1] - dy], [ans[1], ans[0]], [p[0] + dy, p[1] - dx]]);
    if (!ds) continue;
    const m = dirs(dx, dy), start = fmt(p);
    return card(`${start} moves ${m}. Now at?`, say(`The point ${start} moves ${m}. Where is it now?`), fmt(ans), shuffle(rng, [fmt(ans), ...ds]),
      grid({ points: [{ x: p[0], y: p[1], label: 'A' }] }), 'Count the squares: right is more, left is less, up is more, down is less');
  }
}

/** Asymmetric outlines in a 3 × 3 box, so a flip and a turn are different shapes. */
const BASES: P[][] = [
  [[0, 0], [3, 0], [0, 2]], [[0, 0], [2, 0], [0, 3]], [[0, 0], [3, 0], [2, 2], [0, 1]], [[0, 0], [3, 0], [3, 1], [1, 2]],
  [[0, 0], [3, 0], [3, 1], [1, 3], [0, 2]], [[0, 0], [2, 1], [3, 3], [0, 3]],
];

const key = (pts: P[]) => pts.map(p => p.join(',')).sort().join(';');

/** d2: the shaded outline sits in one quadrant, at least a square from both axes; A–C are its reflection, the other-axis reflection and a third. */
function reflectShape(rng: Rng): Question {
  const axis: Axis = rng() < 0.5 ? 'x' : 'y', other = axis === 'x' ? 'y' : 'x';
  const o = [ri(rng, 1, 2), ri(rng, 1, 2)], flip = rng() < 0.5, [qx, qy] = [rng() < 0.5 ? 1 : -1, rng() < 0.5 ? 1 : -1];
  const shaded: P[] = pick(rng, BASES).map(([x, y]): P => [qx * ((flip ? 3 - x : x) + o[0]), qy * (y + o[1])]);
  const right = transform.reflect(shaded, axis), wrong1 = transform.reflect(shaded, other);
  // The third: a turn of half a circle, or the outline slid to the same place unflipped — never both, as they share a quadrant.
  const bx = shaded.map(p => p[0]), by = shaded.map(p => p[1]);
  const slid = transform.move(shaded, -(Math.min(...bx) + Math.max(...bx)), -(Math.min(...by) + Math.max(...by)));
  const third = rng() < 0.5 ? transform.half(shaded) : slid;
  // The letters follow the outlines' coordinates, not a shuffle: the repeat key lists a card's outlines without their letters (#1214), so two
  // cards with the same outlines must give them the same letters, or one key would stand for two different answers.
  const cands = [right, wrong1, third], letters = ['A', 'B', 'C'], order = [...cands].sort((a, b) => key(a).localeCompare(key(b)));
  const visual = grid({ shapes: [{ pts: shaded, shaded: true }, ...order.map((pts, i) => ({ label: letters[i], pts }))] });
  const prompt = `Which is the reflection in the ${axis}-axis?`;
  return card(prompt, `Which shape is the shaded one reflected in the ${axis}-axis?`, letters[order.indexOf(right)], letters, visual,
    axis === 'y' ? 'The y-axis is the up-and-down line: left and right swap' : 'The x-axis is the across line: up and down swap');
}

/** The wrong vertices for a d3 card: a reflection alone has the other axis, a half turn and x and y swapped; a move and a reflection add the steps in the wrong order. */
function vertexSlips(p: P, d: P | null, axis: Axis): P[] {
  const other = axis === 'x' ? 'y' : 'x', [first] = transform.reflect([p], axis);
  if (!d) return [transform.reflect([p], other)[0], transform.half([p])[0], [p[1], p[0]], p];
  const moved = transform.move([p], d[0], d[1]);
  return [transform.move([first], d[0], d[1])[0], transform.reflect(moved, other)[0], first, moved[0], transform.half(moved)[0]];
}

/** A d3 start vertex off both axes, the move (or none) and the axis; the move is never along only one axis. */
function vertexSpec(rng: Rng): { p: P; d: P | null; axis: Axis } | null {
  const p: P = [ri(rng, -4, 4), ri(rng, -4, 4)], axis: Axis = rng() < 0.5 ? 'x' : 'y';
  const d: P | null = rng() < 0.5 ? [ri(rng, -2, 2), ri(rng, -2, 2)] : null;
  return p[0] === 0 || p[1] === 0 || (d && (d[0] === 0 || d[1] === 0)) ? null : { p, d, axis };
}

/** d3: a vertex reflected in an axis, or moved and then reflected. */
function vertexCard(rng: Rng): Question {
  for (;;) {
    const spec = vertexSpec(rng);
    if (!spec) continue;
    const { p, d, axis } = spec;
    const moved = d ? transform.move([p], d[0], d[1])[0] : p, [ans] = transform.reflect([moved], axis);
    if (!inGrid(moved) || !inGrid(ans) || moved[axis === 'y' ? 0 : 1] === 0) continue;   // a point on its own mirror line does not move
    const ds = decoys(ans, vertexSlips(p, d, axis));
    if (!ds) continue;
    const start = fmt(p), steps = d ? dirs(d[0], d[1]) : '';
    const spoken = d ? `Move ${start} ${steps}, then reflect in the ${axis}-axis.` : `Reflect ${start} in the ${axis}-axis.`;
    return card(d ? `${start}: ${steps}, then reflect in ${axis}-axis.` : `Reflect ${start} in the ${axis}-axis.`, say(spoken), fmt(ans), shuffle(rng, [fmt(ans), ...ds]),
      grid({ points: [{ x: p[0], y: p[1], label: 'A' }] }), axis === 'y' ? 'Reflecting in the y-axis changes the sign of x' : 'Reflecting in the x-axis changes the sign of y');
  }
}

export const y6Transform: Generator = (d: Difficulty, rng: Rng): Question => (d === 1 ? pointMove : d === 2 ? reflectShape : vertexCard)(rng);
