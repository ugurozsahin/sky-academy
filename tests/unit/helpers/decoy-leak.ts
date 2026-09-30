// The KS2 distractor rule's own measuring tape (#1058): over many draws, how often does a card's answer
// have a last printed digit or a leading digit that no other option shares? Every KS2 number topic's own
// test file calls this once per difficulty that draws in-scope cards (whole-number answers of 20 or more,
// and every money or decimal answer — everything else is out of scope and not counted).
import type { Difficulty, Generator, Rng } from '../../../src/curriculum/types';

function mulberry32(seed: number): Rng {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

function digitsOf(label: string): { lead: string; last: string } {
  const digits = label.replace(/[^0-9]/g, '');
  return { lead: digits[0] ?? '', last: digits[digits.length - 1] ?? '' };
}

/** Whole-number answers of 20 or more, or any money/decimal answer (`.`, `£` or a trailing `p`). */
export function inLeakScope(label: string): boolean {
  if (label.includes('.') || label.includes('£') || /p$/.test(label)) return true;
  const digits = label.replace(/[^0-9]/g, '');
  return digits !== '' && Number(digits) >= 20;
}

export interface LeakShares { units: number; leading: number; counted: number }

/**
 * `skipLeading`: an estimate card (a number-line mark, an estimated angle) has no decoy that can share its
 * leading digit by design, so its topic passes this to assert only the last-printed-digit share.
 */
export function leakShares(gen: Generator, d: Difficulty, draws = 2000, opts: { skipLeading?: boolean } = {}): LeakShares {
  const rng = mulberry32(1000 + d * 37);
  let counted = 0, unitsLeak = 0, leadingLeak = 0;
  for (let i = 0; i < draws; i++) {
    const q = gen(d, rng);
    if (!inLeakScope(q.answer)) continue;
    counted++;
    const { lead, last } = digitsOf(q.answer);
    const decoys = q.options.filter(o => o !== q.answer);
    if (!decoys.some(o => digitsOf(o).last === last)) unitsLeak++;
    if (!opts.skipLeading && !decoys.some(o => digitsOf(o).lead === lead)) leadingLeak++;
  }
  return { units: counted ? unitsLeak / counted : 0, leading: counted ? leadingLeak / counted : 0, counted };
}
