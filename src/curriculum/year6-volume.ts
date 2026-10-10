// y6-volume (#1245): volume of cubes and cuboids in cm³ and m³, extending to mm³ and km³ (NC 6M40). Dimensions are given in
// text (the game draws no 3-D). d1 l × w × h with sides 2–10 cm, or a cube; d2 a missing height from the volume, or a room in m³;
// d3 compare two boxes (A or B, at least 10% apart) or a cube in mm³ or km³. The wrong-unit slip (the right number as cm²) is on
// every card with a volume answer, so it also shares the answer's digits (#1058).
import type { Difficulty, Generator, Question, Rng } from './types';
import { ri, pick, wordQ } from './util';
import { dec, fmt } from './ks2num';

interface Unit { sym: string; word: string }
const CM: Unit = { sym: 'cm', word: 'centimetres' }, M: Unit = { sym: 'm', word: 'metres' };
const MM: Unit = { sym: 'mm', word: 'millimetres' }, KM: Unit = { sym: 'km', word: 'kilometres' };
const HINT = 'Volume = length × width × height';

/** Commas from four digits (#1047). */
const g = (v: number) => fmt(dec(v, 0));
const cubic = (v: number, un: Unit) => `${g(v)} ${un.sym}³`;
const square = (v: number, un: Unit) => `${g(v)} ${un.sym}²`;
const cubicWord = (un: Unit) => `cubic ${un.word}`;

/** Answer plus up to three distinct named slips, topped up with answer ± step so the card always has four options. */
function card(rng: Rng, prompt: string, answer: string, named: string[], num: (v: number) => string, v: number, extra: Partial<Question>): Question {
  const ds = [...new Set(named.filter(s => s !== answer))].slice(0, 3);
  for (let s = 1; ds.length < 3; s++) for (const c of [v + s, v - s]) if (c > 0 && ds.length < 3 && num(c) !== answer && !ds.includes(num(c))) ds.push(num(c));
  return wordQ(rng, prompt, answer, ds, { hint: HINT, hintIsData: false, ...extra });
}

/** d1: a cuboid with sides 2–10 cm, or a cube (side 3 skipped, where n × 3 and n² are both 9). */
function basic(rng: Rng): Question {
  if (rng() < 0.3) {
    let n: number;
    do n = ri(rng, 2, 10); while (n === 3);
    const v = n ** 3, prompt = pick(rng, [`A cube has sides of ${n} cm. Volume?`, `Each edge of a cube is ${n} cm. Volume?`, `A cube is ${n} cm × ${n} cm × ${n} cm. Volume?`]);
    return card(rng, prompt, cubic(v, CM), [square(v, CM), cubic(n * 3, CM), cubic(n * n, CM)], x => cubic(x, CM), v, {
      say: `A cube has sides of ${n} centimetres. What is its volume in cubic centimetres?` });
  }
  const l = ri(rng, 2, 10), w = ri(rng, 2, 10), h = ri(rng, 2, 10), v = l * w * h;
  return card(rng, `A box is ${l} cm × ${w} cm × ${h} cm. Volume?`, cubic(v, CM), [square(v, CM), cubic(l * w, CM), cubic(l + w + h, CM)], x => cubic(x, CM), v, {
    say: `A box is ${l} centimetres by ${w} centimetres by ${h} centimetres. What is its volume in cubic centimetres?` });
}

/** d2: a missing height in cm, or the volume of a room or container with sides 2–12 m in m³. */
function missingOrMetres(rng: Rng): Question {
  if (rng() < 0.5) {
    let l: number, w: number;
    do { l = ri(rng, 2, 10); w = ri(rng, 2, 10); } while (l === w);
    const h = ri(rng, 2, 10), v = l * w * h;
    return card(rng, `Volume ${g(v)} cm³, base ${l} cm × ${w} cm. Height?`, `${h} cm`, [`${v / l} cm`, `${v / w} cm`, `${h} cm²`], x => `${x} cm`, h, {
      say: `A box has a volume of ${v} cubic centimetres and a base of ${l} centimetres by ${w} centimetres. What is its height?` });
  }
  const l = ri(rng, 2, 12), w = ri(rng, 2, 12), h = ri(rng, 2, 12), v = l * w * h;
  return card(rng, `A room is ${l} m × ${w} m × ${h} m. Volume?`, cubic(v, M), [square(v, M), cubic(l * w, M), cubic(l + w + h, M)], x => cubic(x, M), v, {
    say: `A room is ${l} metres by ${w} metres by ${h} metres. What is its volume in cubic metres?` });
}

/** d3: which of two boxes holds more (at least 10% apart), or a cube in mm³ or km³. */
function compareOrExtend(rng: Rng): Question {
  if (rng() < 0.5) {
    for (;;) {
      const a = [ri(rng, 2, 10), ri(rng, 2, 10), ri(rng, 2, 10)], b = [ri(rng, 2, 10), ri(rng, 2, 10), ri(rng, 2, 10)];
      const va = a[0] * a[1] * a[2], vb = b[0] * b[1] * b[2];
      if (Math.abs(va - vb) < 0.1 * Math.max(va, vb)) continue;
      const box = (d: number[]) => `${d[0]}×${d[1]}×${d[2]}`, spoken = (d: number[]) => `${d[0]} by ${d[1]} by ${d[2]}`;
      return wordQ(rng, `Which holds more: A ${box(a)} or B ${box(b)}?`, va > vb ? 'A' : 'B', [va > vb ? 'B' : 'A'], {
        say: `Box A is ${spoken(a)} centimetres and box B is ${spoken(b)} centimetres. Which holds more?`, hint: HINT, hintIsData: false });
    }
  }
  const un = pick(rng, [MM, KM]);
  let n: number;
  do n = ri(rng, 2, 12); while (n === 3);
  const v = n ** 3;
  return card(rng, `A cube with ${n} ${un.sym} sides. Volume in ${un.sym}³?`, cubic(v, un), [square(v, un), cubic(n * 3, un), cubic(n * n, un)], x => cubic(x, un), v, {
    say: `A cube has sides of ${n} ${un.word}. What is its volume in ${cubicWord(un)}?` });
}

export const y6Volume: Generator = (level: Difficulty, rng: Rng) => (level === 1 ? basic : level === 2 ? missingOrMetres : compareOrExtend)(rng);
