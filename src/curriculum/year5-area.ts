// y5-area (#1205): area and perimeter in standard units (5M36, 5M37). Shapes are drawn by the `symmetry` visual with
// `mirror: false`: `#` is a whole square, `h` a half square (#1062). d1 is a rectangle's area, on the grid or as sides.
// d2 is the perimeter of an L, T or U on the grid, or a rectangle's area or perimeter in metres. d3 estimates the area
// of a shape with half squares, or takes a corner cut from a rectangle. Every card offers the area/perimeter mix-up.
import type { Difficulty, Generator, Question, Rng } from './types';
import { ri } from './util';
import { fill, cells, rows, perimeter, rectilinear, opts, type Grid } from './gridshape';

const CM2 = 'Area = ? cm²', SAY_CM2 = 'What is the area in square centimetres?';
const vis = (grid: string[]) => ({ visual: { type: 'symmetry' as const, grid, mirror: false as const } });
const hint = 'Area counts the squares inside. Perimeter is the distance round the edge';

/** Decoys: the named slips, then for answers of 20 or more one decoy sharing the leading digit and one sharing the last (#1058). */
function card(rng: Rng, prompt: string, answer: number, bad: number[], extra: Partial<Question>, named = 1): Question {
  const ds = [...new Set(bad.filter(v => v >= 1 && v !== answer))];
  if (answer >= 20) {
    const lead = (v: number) => String(v)[0], last = (v: number) => v % 10;
    const take = (f: (v: number) => boolean, cands: number[]) => { const v = cands.find(c => c >= 1 && c !== answer && !ds.slice(0, 2).includes(c) && f(c)); return v; };
    const keep = ds.slice(0, named);
    const l = ds.slice(0, 3).some(v => lead(v) === lead(answer)) ? undefined : take(v => lead(v) === lead(answer), [answer + 1, answer - 1, answer + 2, answer - 2]);
    const t = ds.slice(0, 3).some(v => last(v) === last(answer)) ? undefined : (rng() < 0.5 && answer > 10 ? answer - 10 : answer + 10);
    const extras = [t, l].filter((v): v is number => v !== undefined).slice(0, 3 - named);
    ds.splice(0, ds.length, ...keep, ...extras, ...ds.slice(named));
  }
  return opts(rng, prompt, answer, ds, { hint, ...extra });
}

/** d1: a rectangle's area, from the grid or from its sides (2–12). */
function rectArea(rng: Rng): Question {
  if (rng() < 0.5) {
    const w = ri(rng, 2, 12), h = ri(rng, 2, 6), g = fill(w, h), a = w * h;
    return card(rng, `Each square is 1 cm². ${w} squares wide. ${CM2}`, a, [perimeter(g), w + h, 2 * (w + h) + 2], { say: `Each square is 1 square centimetre. The rectangle is ${w} squares wide. ${SAY_CM2}`, ...vis(rows(g)) });
  }
  const l = ri(rng, 3, 12), w = ri(rng, 2, l - 1), a = l * w;
  return card(rng, `${l} cm by ${w} cm. ${CM2}`, a, [2 * (l + w), l + w, a + l], { say: `A rectangle is ${l} centimetres by ${w} centimetres. ${SAY_CM2}` });
}

/** An L, T or U of 6 to 20 squares. */
function composite(rng: Rng): Grid {
  for (;;) { const g = rectilinear(rng); if (cells(g) >= 6 && cells(g) <= 20) return g; }
}

const boundingPerimeter = (g: Grid) => 2 * (g.length + g[0].length);

/** d2: a composite perimeter on the grid, or a rectangle in metres. */
function perimOrMetres(rng: Rng): Question {
  const r = rng();
  if (r < 0.6) {
    const g = composite(rng), a = cells(g), p = perimeter(g);
    return card(rng, 'Each side is 1 cm. Perimeter = ? cm', p, [a, boundingPerimeter(g), p / 2, p + 2], { say: 'Each side of a square is 1 centimetre. What is the perimeter in centimetres?', ...vis(rows(g)) });
  }
  const l = ri(rng, 4, 12), w = ri(rng, 3, l - 1), spokenBox = `A rectangle is ${l} metres by ${w} metres.`;
  if (r < 0.8) return card(rng, `${l} m by ${w} m. Area = ? m²`, l * w, [2 * (l + w), l + w, l * w + l], { say: `${spokenBox} What is the area in square metres?` });
  return card(rng, `${l} m by ${w} m. Perimeter = ? m`, 2 * (l + w), [l * w, l + w, 2 * l + w], { say: `${spokenBox} What is the perimeter in metres?` });
}

/** A rectangle with a rectangular notch, then an even number of its edge squares turned into half squares. */
function withHalves(rng: Rng): { rows: string[]; whole: number; half: number } {
  for (;;) {
    const g = rectilinear(rng), edge: [number, number][] = [];
    g.forEach((row, r) => row.forEach((on, c) => { if (on && [[-1, 0], [1, 0], [0, -1], [0, 1]].some(([dr, dc]) => !g[r + dr]?.[c + dc])) edge.push([r, c]); }));
    const k = ri(rng, 1, 3), half = new Set<number>();
    while (half.size < 2 * k) half.add(ri(rng, 0, edge.length - 1));
    const chosen = new Set([...half].map(i => `${edge[i][0]},${edge[i][1]}`));
    const out = g.map((row, r) => row.map((on, c) => (!on ? '.' : chosen.has(`${r},${c}`) ? 'h' : '#')).join(''));
    const whole = out.join('').split('#').length - 1;
    if (whole >= 4 && cells(g) <= 20) return { rows: out, whole, half: 2 * k };
  }
}

/** d3: estimate with half squares, or a rectangle with a corner cut off. */
function estimate(rng: Rng): Question {
  if (rng() < 0.6) {
    const s = withHalves(rng), a = s.whole + s.half / 2;
    return card(rng, `Count half squares as ½. Area is about ? cm²`, a, [s.whole + s.half, s.whole, s.whole + 1], { say: 'Count each half square as one half. About how many square centimetres is the area?', ...vis(s.rows) });
  }
  const l = ri(rng, 5, 12), w = ri(rng, 4, Math.min(l, 11)), cw = ri(rng, 1, 3), ch = ri(rng, 1, 3), a = l * w - cw * ch;
  const prompt = `${l} × ${w} cm rectangle, ${cw} × ${ch} cm corner cut off. ${CM2}`;
  return card(rng, prompt, a, [2 * (l + w), l * w, l * w + cw * ch], { say: `A ${l} by ${w} centimetre rectangle has a ${cw} by ${ch} centimetre corner cut off. ${SAY_CM2}` }, 2);
}

export const y5Area: Generator = (level: Difficulty, rng) => (level === 1 ? rectArea : level === 2 ? perimOrMetres : estimate)(rng);
