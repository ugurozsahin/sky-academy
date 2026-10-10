// y6-area (#1244): area of parallelograms and triangles (NC 6M39). d1 a right-angled triangle, d2 a parallelogram or a
// triangle whose height lies inside it, d3 reasoning in text. Drawn with #1075's segment and angle parts: the height is a
// labelled segment and a 90° mark at its foot, so the drawing never contradicts its labels (every length is to one scale).
import type { Difficulty, GeoPart, Generator, Question, Rng } from './types';
import { ri, pick, wordQ } from './util';

/** Right-angled triples `[height, shift, slanted side]`: the slant of a parallelogram (or a triangle's left side) is a whole number of cm. */
const TRIPLES: [number, number, number][] = [[4, 3, 5], [3, 4, 5], [8, 6, 10], [6, 8, 10], [12, 5, 13], [5, 12, 13]];

const lead = (v: number) => String(v)[0];

/** Answer plus three named slips; for answers of 20 or more also a last-digit sharer and a leading-digit sharer (#1058). */
function areaCard(rng: Rng, prompt: string, answer: number, named: number[], extra: Partial<Question>): Question {
  const ok = (v: number) => Number.isInteger(v) && v >= 1 && v !== answer;
  const ds = [...new Set(named.filter(ok))].slice(0, 3);
  if (answer >= 20) {
    const tens = [answer + 10, answer - 10].filter(ok), tenIdx = rng() < 0.5 ? 0 : 1;
    if (!ds.some(v => v % 10 === answer % 10) && tens.length) ds.splice(Math.min(ds.length, 2), 1, tens[tenIdx % tens.length]);
    if (!ds.some(v => lead(v) === lead(answer))) {
      const near = [1, -1, 2, -2, 3, -3, 4, -4].map(s => answer + s).find(v => ok(v) && lead(v) === lead(answer) && !ds.includes(v) && v % 10 !== answer % 10);
      if (near !== undefined) ds.splice(Math.min(ds.length, 1), 1, near);
    }
  }
  for (let s = 2; ds.length < 3; s++) for (const v of [answer + s, answer - s]) if (ok(v) && !ds.includes(v) && ds.length < 3) ds.push(v);
  return wordQ(rng, prompt, String(answer), ds.slice(0, 3).map(String), { hint: 'A triangle is half of a rectangle on the same base and height', hintIsData: false, ...extra });
}

const cm = (v: number) => `${v} cm`;
const say = (s: string) => s.replace(/ cm²/g, ' square centimetres').replace(/ cm/g, ' centimetres');

/** The height's 90° mark at its foot `f` on the base: one ray along the base, one up the height. */
const foot = (f: [number, number]): GeoPart => ({ kind: 'angle', at: f, dir: 0, deg: 90, len: 8 });

const X0 = 24, YB = 55;
/** A label under the base, level with the middle of it. */
const baseSeg = (x1: number, x2: number, b: number): GeoPart => ({ kind: 'segment', a: [x1, YB], b: [x2, YB], label: cm(b), labelAt: [(x1 + x2) / 2, YB + 7] });

/** d1: a right-angled triangle with its base and height labelled, b × h even. */
function rightTriangle(rng: Rng): Question {
  let b: number, h: number;
  do { b = ri(rng, 4, 12); h = ri(rng, 3, 10); } while ((b * h) % 2 || b === h);
  const k = Math.min(68 / b, 40 / h), bx = X0 + b * k, ty = YB - h * k;
  const parts: GeoPart[] = [
    baseSeg(X0, bx, b),
    { kind: 'segment', a: [X0, YB], b: [X0, ty], label: cm(h), labelAt: [X0 - 10, (YB + ty) / 2] },
    { kind: 'segment', a: [bx, YB], b: [X0, ty] },
    foot([X0, YB]),
  ];
  return areaCard(rng, 'Triangle area = ? cm²', b * h / 2, [b * h, b + h, b * h / 2 + b], {
    visual: { type: 'geometry', parts }, say: say(`The triangle has a base of ${b} cm and a height of ${h} cm. What is its area in cm²?`),
  });
}

/** d2: a parallelogram (base, height, slanted side) or a triangle whose height lies inside it; b × h even. */
function slantedShape(rng: Rng): Question {
  const triangle = rng() < 0.5;
  for (;;) {
    const [h, s, l] = pick(rng, TRIPLES), b = triangle ? ri(rng, s + 6, 16) : ri(rng, s + 3, 13);
    if ((b * h) % 2) continue;
    const width = triangle ? b : b + s, k = Math.min(70 / width, 40 / h), yt = YB - h * k, fx = X0 + s * k;
    const slant: GeoPart = { kind: 'segment', a: [X0, YB], b: [fx, yt], label: cm(l), labelAt: [X0 + s * k / 2 - 11, (YB + yt) / 2] };
    const height: GeoPart = { kind: 'segment', a: [fx, YB], b: [fx, yt], label: cm(h), labelAt: [fx + 11, YB - 0.3 * h * k] };
    const parts: GeoPart[] = triangle ? [
      baseSeg(X0, X0 + b * k, b), slant, { kind: 'segment', a: [X0 + b * k, YB], b: [fx, yt] }, height, foot([fx, YB]),
    ] : [
      baseSeg(X0, X0 + b * k, b), slant, { kind: 'segment', a: [X0 + b * k, YB], b: [fx + b * k, yt] },
      { kind: 'segment', a: [fx, yt], b: [fx + b * k, yt] }, height, foot([fx, YB]),
    ];
    const name = triangle ? 'triangle' : 'parallelogram';
    return areaCard(rng, `${triangle ? 'Triangle' : 'Parallelogram'} area = ? cm²`, triangle ? b * h / 2 : b * h, triangle ? [b * h, b * l / 2, b + h] : [b * l, b * h / 2, b + h], {
      visual: { type: 'geometry', parts },
      say: say(`The ${name} has a base of ${b} cm, a height of ${h} cm and a slanted side of ${l} cm. What is its area in cm²?`),
    });
  }
}

/** d3: reasoning in text, every prompt at most 60 characters. */
function reasoning(rng: Rng): Question {
  const r = rng();
  if (r < 0.34) {
    const b = ri(rng, 4, 12), h = 2 * ri(rng, 2, 5), a = b * h / 2; // an even height, so the halved-not-doubled slip a / b is a whole number
    return areaCard(rng, `Triangle area ${a} cm², base ${b} cm. Height = ? cm`, h, [a / b, a - b, a + b], {
      say: say(`A triangle has an area of ${a} cm² and a base of ${b} cm. What is its height in cm?`) });
  }
  if (r < 0.67) {
    const b = ri(rng, 4, 14), h = ri(rng, 3, 12);
    if ((b * h) % 2) return reasoning(rng);
    return areaCard(rng, `Base ${b} cm, height ${h} cm: parallelogram − triangle = ? cm²`, b * h / 2, [b * h, b * h + b * h / 2, b + h], {
      say: say(`A parallelogram and a triangle have the same base of ${b} cm and the same height of ${h} cm. How much bigger is the parallelogram's area, in cm²?`) });
  }
  const b = ri(rng, 3, 12), h = ri(rng, 3, 10), a = b * h;
  return areaCard(rng, `Parallelogram area ${a} cm², height ${h} cm. Base = ? cm`, b, [a - h, a + h, b + h], {
    say: say(`A parallelogram has an area of ${a} cm² and a height of ${h} cm. What is its base in cm?`) });
}

export const y6Area: Generator = (level: Difficulty, rng) => (level === 1 ? rightTriangle : level === 2 ? slantedShape : reasoning)(rng);
