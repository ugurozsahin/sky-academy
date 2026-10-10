// y5-anglefacts (#1210): angle facts and rectangles (NC 5M44, 5M45). d1 turns and right angles to degrees, in text. d2 a
// missing angle on a straight line (180°) or at a point (360°), drawn with the `geometry` angle part so each arc's sweep
// is its stated value. d3 rectangles in text: a missing width from the perimeter, the other half of a corner split by a
// diagonal, or the opposite side. Every angle is a multiple of 5°, so every option is too.
import type { Difficulty, GeoPart, Generator, Question, Rng } from './types';
import { ri, pick, shuffle, wordQ } from './util';
import { opts } from './gridshape';

const deg = (v: number) => `${v}°`;
const lead = (v: number) => String(v)[0];

/** Four options: the named slips first (the first is never displaced), then a last-digit sharer and a leading-digit sharer for answers of 20 or more (#1058), in 5–360. */
function degCard(rng: Rng, prompt: string, answer: number, named: number[], extra: Partial<Question>): Question {
  const ok = (v: number) => v >= 5 && v <= 360 && v % 5 === 0 && v !== answer;
  const ds = [...new Set(named.filter(ok))].slice(0, 3);
  if (answer >= 20) {
    const last = (v: number) => v % 10;
    const ten = [answer + 10, answer - 10].filter(ok);
    const share = [5, -5, 15, -15].map(s => answer + s).concat(ten).find(v => ok(v) && lead(v) === lead(answer) && !ds.includes(v));
    if (!ds.some(v => last(v) === last(answer)) && ten.length) { ds.splice(Math.min(ds.length, 2), 1, pick(rng, ten)); }
    if (!ds.some(v => lead(v) === lead(answer)) && share !== undefined && !ds.includes(share)) { ds.splice(Math.min(ds.length, 1), 1, share); }
  }
  for (let v = 45; ds.length < 3; v += 45) if (ok(v) && !ds.includes(v)) ds.push(v);
  return wordQ(rng, prompt, deg(answer), ds.slice(0, 3).map(deg), { hint: 'Think about the total: a straight line, a whole turn or a right angle', hintIsData: false, ...extra });
}

/** d1: turns and right angles to degrees. */
const TURNS: [string, string, number][] = [
  ['A quarter turn', 'a quarter turn', 90], ['A half turn', 'a half turn', 180], ['A three-quarter turn', 'a three-quarter turn', 270],
  ['A whole turn', 'a whole turn', 360], ['A straight line', 'a straight line', 180], ['2 right angles', 'two right angles', 180],
  ['3 right angles', 'three right angles', 270], ['4 right angles', 'four right angles', 360],
];
function turnCard(rng: Rng): Question {
  const [text, spoken, a] = pick(rng, TURNS);
  const say = spoken[0].toUpperCase() + spoken.slice(1);
  return degCard(rng, `${text} = ?°`, a, [90, 180, 270, 360, 45].filter(v => v !== a), { say: `${say} equals how many degrees?` });
}

/** d2: adjacent angles sharing one vertex, one labelled `?`. `total` is 180 (a line) or 360 (a point). */
function missingCard(rng: Rng): Question {
  const onLine = rng() < 0.5, total = onLine ? 180 : 360, n = onLine ? 2 : 3;
  const sizes: number[] = [];
  for (;;) {
    sizes.length = 0;
    let left = total;
    for (let i = 0; i < n - 1; i++) { const v = 5 * ri(rng, 6, Math.floor((left - 30) / 5)); sizes.push(v); left -= v; }
    sizes.push(left);
    if (left >= 30 && Math.min(...sizes) >= 30) break;
  }
  const order = shuffle(rng, sizes), unk = ri(rng, 0, n - 1), answer = order[unk];
  const known = order.filter((_, i) => i !== unk), sum = known.reduce((s, v) => s + v, 0);
  const parts: GeoPart[] = [];
  if (onLine) parts.push({ kind: 'segment', a: [8, 50], b: [92, 50] });
  let dir = onLine ? 0 : ri(rng, 0, 23) * 15;
  order.forEach((v, i) => { parts.push({ kind: 'angle', at: [50, onLine ? 50 : 38], dir, deg: v, label: i === unk ? '?' : deg(v), len: 15 }); dir += v; });
  const bad = onLine ? [360 - known[0], known[0], 90 - known[0]] : [Math.abs(180 - sum), sum, 360 - sum + 90];
  return degCard(rng, onLine ? 'Angles on a line. Missing angle = ?°' : 'Angles at a point. Missing angle = ?°', answer, bad, {
    visual: { type: 'geometry', parts },
    say: onLine ? 'Angles on a straight line add up to 180 degrees. What is the missing angle?' : 'Angles at a point add up to 360 degrees. What is the missing angle?',
    hint: onLine ? 'Angles on a straight line make a half turn' : 'Angles at a point make a whole turn', hintIsData: false,
  });
}

/** d3: rectangles in text, every prompt at most 60 characters. */
function rectCard(rng: Rng): Question {
  const r = rng();
  if (r < 0.34) {
    const l = ri(rng, 4, 15), w = ri(rng, 2, l - 1), p = 2 * (l + w);
    return opts(rng, `Rectangle: ${l} cm long, perimeter ${p} cm. Width = ? cm`, w, [p - l, l + w, l], {
      say: `A rectangle is ${l} centimetres long and its perimeter is ${p} centimetres. What is its width in centimetres?`, hint: 'Half the perimeter is a length plus a width', hintIsData: false });
  }
  if (r < 0.67) {
    const a = 5 * ri(rng, 4, 14);
    return degCard(rng, `Diagonal splits a rectangle's corner: ${a}° and ?°`, 90 - a, [90 + a, 180 - a, a], {
      say: `A diagonal splits the corner of a rectangle into two angles. One is ${a} degrees. What is the other, in degrees?`, hint: 'A rectangle corner is a right angle', hintIsData: false });
  }
  const s = ri(rng, 3, 15);
  return opts(rng, `Rectangle: one side ${s} cm. Opposite side = ? cm`, s, [2 * s, s + 2, s - 2], {
    say: `One side of a rectangle is ${s} centimetres. How long is the opposite side, in centimetres?`, hint: 'Opposite sides of a rectangle are equal', hintIsData: false });
}

export const y5AngleFacts: Generator = (level: Difficulty, rng) => (level === 1 ? turnCard : level === 2 ? missingCard : rectCard)(rng);
