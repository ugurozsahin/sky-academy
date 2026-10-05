// y3-angles (#1075): right angles, turns, and horizontal, vertical, parallel and perpendicular lines (NC 3M29–31).
// d1 one angle "is this a right angle?" or a turn fact, d2 three lettered angles (right, less, greater),
// d3 three lettered lines or pairs of lines. Every answer comes from the drawn `parts` alone (`geoAnswer`), so
// the picture and the key cannot disagree; each wrong letter is a named misconception (see `angleCards`/`lineCards`).
import type { Difficulty, GeoPart, Generator, Question, Rng } from './types';
import { ri, pick, shuffle, q } from './util';

type Pt = [number, number];
type Seg = Extract<GeoPart, { kind: 'segment' }>;
export type GeoAsk = 'right' | 'less' | 'greater' | 'horizontal' | 'vertical' | 'parallel' | 'perpendicular';

const LETTERS = ['A', 'B', 'C'];
const CELLS = [17, 50, 83];
const HALF = 13;
const r2 = (n: number) => Math.round(n * 100) / 100;
const step5 = (rng: Rng, lo: number, hi: number) => 5 * ri(rng, lo / 5, hi / 5);
const from = (c: Pt, deg: number, r: number): Pt => [r2(c[0] + r * Math.cos(deg * Math.PI / 180)), r2(c[1] - r * Math.sin(deg * Math.PI / 180))];

/** A segment's direction in degrees, 0–180 (a line has no way round), read from its end points. */
export const segDir = (p: Seg) => ((Math.atan2(-(p.b[1] - p.a[1]), p.b[0] - p.a[0]) * 180 / Math.PI) % 180 + 180) % 180;
/** The gap between two directions, 0–90, ignoring which way round each line is drawn. */
const gap = (x: number, y: number) => { const d = Math.abs(x - y) % 180; return Math.min(d, 180 - d); };

/** The letters whose drawn part satisfies `ask`, read from the data only — the topic's own oracle (tests use it too). */
export function geoAnswer(parts: GeoPart[], ask: GeoAsk): string[] {
  if (ask === 'parallel' || ask === 'perpendicular') {
    const segs = parts.filter((p): p is Seg => p.kind === 'segment');
    const want = ask === 'parallel' ? 0 : 90;
    return segs.filter((s, i) => i % 2 === 0 && i + 1 < segs.length && Math.abs(gap(segDir(s), segDir(segs[i + 1])) - want) < 0.5).map(s => s.label ?? '');
  }
  const ok = (p: GeoPart) => p.kind === 'angle'
    ? (ask === 'right' ? p.deg === 90 : ask === 'less' ? p.deg < 90 : ask === 'greater' && p.deg > 90)
    : (ask === 'horizontal' ? gap(segDir(p), 0) < 0.5 : ask === 'vertical' && gap(segDir(p), 90) < 0.5);
  return parts.filter(ok).map(p => p.label ?? '');
}

const card = (prompt: string, parts: GeoPart[], ask: GeoAsk, rng: Rng): Question => ({
  ...q(prompt), answer: geoAnswer(parts, ask)[0] ?? (() => { throw new Error(`y3-angles: no part answers "${prompt}"`); })(), options: shuffle(rng, LETTERS.slice()),
  visual: { type: 'geometry', parts }, hint: 'Slice the right letter', hintIsData: false,
});

/** A first-ray direction (5° steps) that keeps the angle's bisector within 40° of straight up or down, so three labels in a row never meet. */
function dirFor(rng: Rng, deg: number, want: 'axis' | 'tilt' | 'any'): number {
  const ok: number[] = [];
  for (let d = 0; d < 360; d += 5) {
    const b = (d + deg / 2) % 360;
    if (Math.min(Math.abs(b - 90), Math.abs(b - 270)) <= 40) ok.push(d);
  }
  const sub = want === 'any' ? ok : ok.filter(d => (d % 90 === 0) === (want === 'axis'));
  return pick(rng, sub.length ? sub : ok);
}

/**
 * d2: one right, one acute (30–65), one obtuse (115–160), in 5° steps. The named slip: the right angle is mostly
 * tilted (so "square to the page" is not the cue) and the acute one often sits square to the page.
 */
function angleCards(rng: Rng, ask: 'right' | 'less' | 'greater'): Question {
  const kinds = shuffle(rng, [90, step5(rng, 30, 65), step5(rng, 115, 160)]);
  const parts: GeoPart[] = kinds.map((deg, i) => ({
    kind: 'angle', at: [CELLS[i], 38], deg, label: LETTERS[i],
    dir: dirFor(rng, deg, deg === 90 ? (rng() < 0.7 ? 'tilt' : 'any') : deg < 90 && rng() < 0.5 ? 'axis' : 'any'),
  }));
  const prompt = ask === 'right' ? 'Which angle is a right angle?' : `Which angle is ${ask} than a right angle?`;
  return card(prompt, parts, ask, rng);
}

const seg = (c: Pt, dir: number, extra: Partial<Seg> = {}): Seg => ({ kind: 'segment', a: from(c, dir + 180, HALF), b: from(c, dir, HALF), ...extra });
/** A pair of lines in cell `i`, `dirB` away from `dirA`; level pairs sit side by side, the rest cross at the cell's middle (or, for `skew`, sit apart). */
function pair(i: number, dirA: number, dirB: number, label: string, apartBy?: number): GeoPart[] {
  const c: Pt = [CELLS[i], 30], labelAt: Pt = [CELLS[i], 62];
  if (apartBy !== undefined) return [seg(from(c, dirA + 90, apartBy), dirA, { label, labelAt }), seg(from(c, dirA - 90, apartBy), dirB)];
  return [seg(c, dirA, { label, labelAt }), seg(c, dirB)];
}
const away = (rng: Rng, lo: number, hi: number) => step5(rng, lo, hi) * (rng() < 0.5 ? 1 : -1);

/**
 * d3. Each wrong letter is a named slip. Horizontal/vertical: a line slanted 15–30° off the true one, and the
 * other axis. Parallel: a perpendicular pair, and a pair 20–40° from parallel. Perpendicular: a parallel pair
 * and a cross 15–30° off square. The right pair is not always square to the page.
 */
function lineCards(rng: Rng, ask: 'horizontal' | 'vertical' | 'parallel' | 'perpendicular'): Question {
  const slots = shuffle(rng, [0, 1, 2]);
  let parts: GeoPart[];
  if (ask === 'horizontal' || ask === 'vertical') {
    const base = ask === 'horizontal' ? 0 : 90, other = 90 - base;
    const dirs = [base, base + away(rng, 15, 30), rng() < 0.5 ? other : base + away(rng, 40, 60)];
    parts = slots.map((s, k) => seg([CELLS[s], 32], dirs[k] + (rng() < 0.5 ? 180 : 0), { label: LETTERS[s] }));
  } else {
    const t = step5(rng, 0, 175);
    const kinds: [number, number, number?][] = ask === 'parallel'
      ? [[t, t, 9], [t, t + 90], [t, t + away(rng, 20, 40), 9]]
      : [[t, t + 90], [t, t, 9], [t, t + 90 + away(rng, 15, 30)]];
    parts = slots.flatMap((s, k) => pair(s, kinds[k][0], kinds[k][1], LETTERS[s], kinds[k][2] === undefined ? undefined : kinds[k][2]! / 2));
  }
  const prompt = ask === 'horizontal' || ask === 'vertical' ? `Which line is ${ask}?` : `Which pair of lines is ${ask}?`;
  return card(prompt, parts, ask, rng);
}

const TURNS: [string, number][] = [['a half-turn', 2], ['three-quarters of a turn', 3], ['a whole turn', 4]];

export const y3Angles: Generator = (d: Difficulty, rng: Rng): Question => {
  if (d === 1) {
    if (rng() < 0.4) {
      const [name, n] = pick(rng, TURNS);
      return { ...q(`How many right angles make ${name}?`), answer: String(n), options: shuffle(rng, ['1', '2', '3', '4']) };
    }
    const right = rng() < 0.5;
    const deg = right ? 90 : pick(rng, [step5(rng, 30, 65), step5(rng, 115, 160)]);
    const dir = right && rng() < 0.7 ? pick(rng, [20, 35, 50, 65, 125, 140, 205, 220, 305, 320]) : step5(rng, 0, 355);
    return {
      ...q('Is this a right angle?'), answer: right ? 'Yes' : 'No', options: shuffle(rng, ['Yes', 'No']), wide: true,
      visual: { type: 'geometry', parts: [{ kind: 'angle', at: [50, 38], dir, deg }] }, hint: 'Slice Yes or No', hintIsData: false,
    };
  }
  if (d === 2) return angleCards(rng, pick(rng, ['right', 'less', 'greater'] as const));
  return lineCards(rng, pick(rng, ['horizontal', 'vertical', 'parallel', 'perpendicular'] as const));
};
