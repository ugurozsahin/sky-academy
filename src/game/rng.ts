// Split out of duel.ts (#879) to pay for that file's #714 ratchet cap — no importer changes, since
// duel.ts re-exports this from its own path.

/**
 * A tiny deterministic rng (mulberry32) — a constant would spin a generator that draws until distinct, which
 * `duelPool()` (`duel.ts`) uses this to sample against. Exported since #389: the duel screen seeds one of
 * these per arena from a single round seed, so both halves lay out the identical wave instead of each
 * shuffling for itself. **One generator per call, never one shared between them** — it is stateful, and a
 * shared instance deals the second half the first's leftovers.
 */
export function seededRng(seed: number) {
  return () => { seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
