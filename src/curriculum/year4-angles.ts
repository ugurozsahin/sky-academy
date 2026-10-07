// y4-angles (#1153): name an angle as acute, right or obtuse, and compare and order angles by size (NC 4M35).
// d1 one angle "acute, right or obtuse?", d2 three lettered angles and one of obtuse / acute / largest, d3 order three
// angles smallest to largest (a letter sequence). Every answer is computed from the drawn `deg` values (`angleClass`,
// `orderOf`), so the picture and the key cannot disagree. Nothing lies within 15° of a right angle except 90°; arm
// length varies on its own, and half the d3 cards draw the smallest angle with the longest arms (the "long arms =
// big angle" slip).
import type { Difficulty, GeoPart, Generator, Question, Rng } from './types';
import { ri, pick, shuffle, q } from './util';

type Angle = Extract<GeoPart, { kind: 'angle' }>;
export type AngleClass = 'Acute' | 'Right' | 'Obtuse' | 'Straight';
export type AngleAsk = 'obtuse' | 'acute' | 'largest';

const LETTERS = ['A', 'B', 'C'];
const CELLS = [17, 50, 83];
const step5 = (rng: Rng, lo: number, hi: number) => 5 * ri(rng, lo / 5, hi / 5);
const ACUTE = (rng: Rng) => step5(rng, 20, 70);
const OBTUSE = (rng: Rng) => step5(rng, 110, 170);

/** The class of an angle read from its size alone — the topic's own oracle (tests use it too). */
export const angleClass = (deg: number): AngleClass => deg < 90 ? 'Acute' : deg === 90 ? 'Right' : deg < 180 ? 'Obtuse' : 'Straight';
/** The letters of the angles in `parts`, smallest to largest. */
export const orderOf = (parts: GeoPart[]): string[] =>
  parts.filter((p): p is Angle => p.kind === 'angle').sort((a, b) => a.deg - b.deg).map(p => p.label ?? '');
/** The letters whose drawn angle satisfies `ask`, read from the data only. */
export function angleAnswer(parts: GeoPart[], ask: AngleAsk): string[] {
  const angles = parts.filter((p): p is Angle => p.kind === 'angle');
  const top = Math.max(...angles.map(a => a.deg));
  return angles.filter(a => ask === 'largest' ? a.deg === top : angleClass(a.deg) === (ask === 'obtuse' ? 'Obtuse' : 'Acute')).map(a => a.label ?? '');
}

/** A first-ray direction (a multiple of 15°) that keeps the angle's bisector within 45° of straight up or down, so labels and neighbours never meet. */
function dirFor(rng: Rng, deg: number): number {
  const ok: number[] = [];
  for (let d = 0; d < 360; d += 15) {
    const b = (d + deg / 2) % 360;
    if (Math.min(Math.abs(b - 90), Math.abs(b - 270)) <= 45) ok.push(d);
  }
  return pick(rng, ok);
}

/** Three different arm lengths from 10–16 (62–100 % of the default 16). */
const armSet = (rng: Rng) => shuffle(rng, [10, 12, 14, 16]).slice(0, 3);

function draw(rng: Rng, degs: number[], armLens: number[]): GeoPart[] {
  return degs.map((deg, i): Angle => ({ kind: 'angle', at: [CELLS[i], 38], dir: dirFor(rng, deg), deg, label: LETTERS[i], len: armLens[i] }));
}

/** Three sizes at least 20° apart from `pool`, none repeated; `ok` says whether the triple suits the question. */
function triple(pool: () => number, ok: (d: number[]) => boolean): number[] {
  for (let i = 0; i < 500; i++) {
    const d = [pool(), pool(), pool()];
    const sorted = d.slice().sort((a, b) => a - b);
    if (sorted[1] - sorted[0] >= 20 && sorted[2] - sorted[1] >= 20 && ok(d)) return d;
  }
  throw new Error('y4-angles: no triple of angles fits');
}
const any = (rng: Rng) => rng() < 0.4 ? ACUTE(rng) : rng() < 0.2 ? 90 : OBTUSE(rng);

const NAMES: AngleClass[] = ['Acute', 'Right', 'Obtuse'];

export const y4Angles: Generator = (d: Difficulty, rng: Rng): Question => {
  if (d === 1) {
    const want = pick(rng, NAMES);
    const deg = want === 'Acute' ? ACUTE(rng) : want === 'Right' ? 90 : OBTUSE(rng);
    return {
      ...q('Is this angle acute, right or obtuse?'), answer: angleClass(deg), options: shuffle(rng, NAMES.slice()), wide: true,
      visual: { type: 'geometry', parts: [{ kind: 'angle', at: [50, 38], dir: dirFor(rng, deg), deg, len: pick(rng, [10, 12, 14, 16]) }] },
      hint: 'Slice the right word', hintIsData: false,
    };
  }
  if (d === 2) {
    const ask = pick(rng, ['obtuse', 'acute', 'largest'] as const);
    const count = (degs: number[], c: AngleClass) => degs.filter(x => angleClass(x) === c).length;
    const degs = triple(() => any(rng), x => ask === 'largest' || count(x, ask === 'obtuse' ? 'Obtuse' : 'Acute') === 1);
    const parts = draw(rng, degs, armSet(rng));
    const prompt = ask === 'largest' ? 'Which is the largest angle?' : `Which angle is ${ask}?`;
    return {
      ...q(prompt), answer: angleAnswer(parts, ask)[0], options: shuffle(rng, LETTERS.slice()),
      visual: { type: 'geometry', parts }, hint: 'Slice the right letter', hintIsData: false,
    };
  }
  const degs = triple(() => rng() < 0.12 ? 180 : any(rng), () => true);
  const trap = rng() < 0.5, smallest = degs.indexOf(Math.min(...degs));
  let armLens: number[];
  do armLens = armSet(rng);
  while (trap ? armLens[smallest] !== Math.max(...armLens) : armLens[smallest] === Math.max(...armLens));
  const parts = draw(rng, degs, armLens);
  const order = orderOf(parts);
  return {
    prompt: 'Smallest angle to largest!', say: 'Slice the angles from the smallest to the largest', answer: order.join(','), sequence: order,
    options: shuffle(rng, LETTERS.slice()), visual: { type: 'geometry', parts }, hint: 'Slice the smallest angle first', hintIsData: false,
  };
};
