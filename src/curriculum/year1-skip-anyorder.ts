// "Slice every multiple of 5 / 10" (#920): the any-order form of Year 1's count-in-steps topic (#869/#918).
import type { Rng } from './types';
import { anyOrderQ } from './any-order';
import { ri, shuffle } from './util';

/** `count` distinct multiples of `step` in 1–100 (0 is excluded: Year 1 counts up from the first multiple). */
function pickMultiples(rng: Rng, step: number, count: number): number[] {
  const all: number[] = [];
  for (let n = step; n <= 100; n += step) all.push(n);
  return shuffle(rng, all).slice(0, count);
}

/**
 * Six distinct numbers in 1–100, 2–4 of them multiples of `step` (5 or 10). "Of 5": decoys are a target ± 1 or
 * ± 2, never a multiple. "Of 10": one decoy is a multiple of 5 that is not a multiple of 10 (35, say, the
 * tempting near miss), the rest a target ± 1.
 */
export function y1SkipAnyOrder(rng: Rng): ReturnType<typeof anyOrderQ> {
  const step = rng() < 0.5 ? 5 : 10;
  const targets = pickMultiples(rng, step, ri(rng, 2, 4));
  const used = new Set(targets);
  const decoys: number[] = [];
  const take = (n: number) => { if (n >= 1 && n <= 100 && n % step !== 0 && !used.has(n)) { used.add(n); decoys.push(n); return true; } return false; };
  if (step === 10) {
    const halves = pickMultiples(rng, 5, 20).filter(n => n % 10 !== 0);
    take(halves[0]);
  }
  const offsets = step === 5 ? [1, -1, 2, -2] : [1, -1];
  for (const t of shuffle(rng, targets)) for (const o of shuffle(rng, offsets)) { if (decoys.length < 6 - targets.length) take(t + o); }
  // Tail spare: every target sits at an edge or neighbours are used up, so top up with any non-multiple.
  for (let guard = 0; decoys.length < 6 - targets.length && guard < 200; guard++) take(ri(rng, 1, 100));
  const say = `Slice every multiple of ${step}`;
  return anyOrderQ(rng, say, targets.map(String), decoys.map(String), { say, hint: `Count in ${step}s: which numbers do you land on?`, hintIsData: false });
}
