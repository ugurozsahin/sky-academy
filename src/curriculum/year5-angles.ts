// y5-angles (#1209): angles in degrees, and estimating acute, obtuse and reflex angles (NC 5M42). d1 names a drawn angle
// (acute, obtuse, reflex, or an exact right angle on 15 % of cards), d2 estimates one to the nearest 10°, d3 picks the
// acute, obtuse or reflex size from four stated angles with no drawing. Every size is a multiple of 5°, and away from
// 90°, 180° and 270° by at least 15° unless it is d1's exact right angle, so estimating is fair. The class and the
// estimate are computed from `deg`, the same number the picture is drawn from.
import type { Difficulty, GeoPart, Generator, Question, Rng } from './types';
import { ri, pick, wordQ } from './util';

export type AngleKind = 'Acute' | 'Obtuse' | 'Reflex' | 'Right';
const KINDS: AngleKind[] = ['Acute', 'Obtuse', 'Reflex', 'Right'];
const RANGE: Record<Exclude<AngleKind, 'Right'>, [number, number]> = { Acute: [20, 75], Obtuse: [105, 165], Reflex: [195, 340] };

/** The class of an angle read from its size alone — the topic's own oracle (tests use it too). */
export const angleKind = (deg: number): AngleKind => deg < 90 ? 'Acute' : deg === 90 ? 'Right' : deg < 180 ? 'Obtuse' : 'Reflex';
/** The estimate: the size to the nearest 10° (a 5 rounds up). */
export const estimate = (deg: number) => Math.round(deg / 10) * 10;

/** A multiple of 5° in the class's range, never within 15° of 270° (the reflex range crosses it). */
function sizeOf(rng: Rng, kind: Exclude<AngleKind, 'Right'>): number {
  for (;;) { const v = 5 * ri(rng, RANGE[kind][0] / 5, RANGE[kind][1] / 5); if (Math.abs(v - 270) >= 15) return v; }
}

/** A first-ray direction (a multiple of 15°) that keeps the angle's bisector within 45° of straight up or down, so the arc stays on the card. */
function dirFor(rng: Rng, deg: number): number {
  const ok: number[] = [];
  for (let d = 0; d < 360; d += 15) {
    const b = (d + deg / 2) % 360;
    if (Math.min(Math.abs(b - 90), Math.abs(b - 270)) <= 45) ok.push(d);
  }
  return pick(rng, ok);
}

const drawn = (rng: Rng, deg: number): { visual: { type: 'geometry'; parts: GeoPart[] } } =>
  ({ visual: { type: 'geometry', parts: [{ kind: 'angle', at: [50, 38], dir: dirFor(rng, deg), deg, len: pick(rng, [12, 14, 16]) }] } });

function kindCard(rng: Rng): Question {
  const r = rng();
  const kind: AngleKind = r < 0.15 ? 'Right' : r < 0.45 ? 'Reflex' : r < 0.725 ? 'Acute' : 'Obtuse';
  const deg = kind === 'Right' ? 90 : sizeOf(rng, kind);
  return wordQ(rng, 'What kind of angle is this?', angleKind(deg), KINDS.filter(k => k !== angleKind(deg)), {
    ...drawn(rng, deg), say: 'What kind of angle is this? Acute is small, obtuse is wide, reflex is more than a straight line.',
    hint: 'Acute is less than a right angle, obtuse is wider, reflex is wider than a straight line', hintIsData: false,
  });
}

/** Decoys in the fixed order: the wrong scale, the other side of the arms, then 60° and 120° away. A kept decoy is in 10–350 and 40° from the rest. */
function estimateCard(rng: Rng): Question {
  const deg = sizeOf(rng, pick(rng, ['Acute', 'Obtuse', 'Reflex', 'Reflex'] as const)), e = estimate(deg), kept = [e];
  for (const c of [180 - e, 360 - e, e + 60, e - 60, e + 120, e - 120]) {
    if (kept.length < 4 && c >= 10 && c <= 350 && kept.every(k => Math.abs(k - c) >= 40)) kept.push(c);
  }
  return wordQ(rng, 'About how many degrees?', `${e}°`, kept.slice(1).map(v => `${v}°`), {
    ...drawn(rng, deg), say: 'About how many degrees is this angle?', hint: 'Compare it with a right angle and a straight line', hintIsData: false,
  });
}

/** Four stated angles, one of the asked class and three of other classes, each 15° from 90, 180 and 270 and from each other. */
function statedCard(rng: Rng): Question {
  const want = pick(rng, ['Acute', 'Obtuse', 'Reflex'] as const), others = (['Acute', 'Obtuse', 'Reflex'] as const).filter(k => k !== want);
  const vals = [sizeOf(rng, want)];
  while (vals.length < 4) {
    const v = vals.length === 1 && rng() < 0.4 ? 90 : sizeOf(rng, pick(rng, others));
    if (vals.every(x => x !== v)) vals.push(v);
  }
  const label = want.toLowerCase();
  return wordQ(rng, `Which angle is ${label}?`, `${vals[0]}°`, vals.slice(1).map(v => `${v}°`), {
    say: `Which angle is ${label}? Acute is less than 90 degrees, obtuse is between 90 and 180, reflex is more than 180.`,
    hint: 'Reflex is wider than a straight line, obtuse is wider than a right angle', hintIsData: false,
  });
}

export const y5Angles: Generator = (d: Difficulty, rng: Rng): Question => {
  if (d === 1) return kindCard(rng);
  if (d === 2) return estimateCard(rng);
  return statedCard(rng);
};
