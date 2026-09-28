// #1032: which islands appear on the map before every year has its own art. Pure apart from the one guarded
// read below — no import from src/storage.ts, which imports the curriculum barrel this file feeds.
export const SHOWN_YEARS_KEY = 'sna:years';

/** A test/preview escape hatch, the same device-key shape `src/storage.ts`'s `threeSetting()` reads (#714):
 *  read at call time, never cached, and a missing or throwing store reads as no preview rather than a crash. */
export function previewAllYears(): boolean {
  try {
    return localStorage.getItem(SHOWN_YEARS_KEY) === 'all';
  } catch {
    return false;
  }
}

/**
 * The map-visibility gate (owner, 2026-09-28): a KS2 year needs at least 12 maths and 6 writing topics before
 * it appears; EYFS/KS1 keeps today's minimum, 6 and 3, so a real EYFS/KS1 island never depends on this test
 * ever tightening. `ks2` is the caller's own `isKs2(year.id)` — not a `YearId` here — because no KS2 `YearId`
 * exists yet (#1050+ adds the first) and this stays exercisable by both branches without one.
 */
export function meetsShowGate(ks2: boolean, maths: number, writing: number): boolean {
  return ks2 ? maths >= 12 && writing >= 6 : maths >= 6 && writing >= 3;
}
