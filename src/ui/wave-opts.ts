import type { Question, YearId } from '../curriculum';
import type { WaveOpts } from '../game/arena';
import { wideFor } from '../curriculum/util';   // #482: the same wide-vs-narrow rule wordQ uses, not a second one
import { BUBBLE_SCALE } from '../game/bubbles';

/**
 * The spawn options for one question's wave, shared between this screen and `tests/unit/sim.test.ts`'s
 * scenarios (#126). Before this, every scenario hand-wrote its own copy of this shape — matched by prose
 * ("the same text as the screen's") rather than by the compiler — and had already drifted: the `wide`
 * derivation below had no test coverage at all, and a hardcoded `wide: true` stayed accidentally correct only
 * because the one scenario using it happens to ask a question where `q.wide` is also true. `labels` is
 * `info.labels` before any villain-mode TNT bubble is mixed in — `onQuestion` below does that itself, since
 * it is specific to the real screen and no scenario exercises it here.
 * `gentle` (#700) — the year's `gentle` flag — is passed separately rather than read off a `year` this
 * function otherwise has no reason to take: it only ever affects a non-sequence question's single
 * `gentleTarget`, so a scenario that does not care about it can go on calling this with three arguments.
 * `remaining` (#919) defaults to the whole sequence: omitted means "nothing sliced yet", not "nothing left". */
export function waveOptsFor(q: Question, info: { labels: string[]; speed: number }, remaining?: readonly string[], gentle?: boolean, timing?: WaveOpts['timing'], capWords?: boolean, yearId?: YearId): WaveOpts {
  const labels = capWords && capApplies(q, info.labels) ? capWordBubbles(info.labels, q.answer) : info.labels;
  return {
    labels, speed: info.speed, wide: !!q.wide || wideFor(labels), colours: q.colours,
    ordered: q.sequence ? [...(remaining ?? q.sequence)] : undefined, gentleTarget: gentle && !q.sequence ? q.answer : undefined, timing, scale: yearId && BUBBLE_SCALE[yearId],
  };
}

/** Most word bubbles one wave carries in Reception to Year 2 (#2315): three words is what a child of five to seven reads before they fall. */
export const MAX_WORD_BUBBLES_KS1 = 3;
/** Years the cap above applies to. */
export const WORD_CAP_YEARS: ReadonlySet<YearId> = new Set<YearId>(['reception', 'year1', 'year2']);

/** A word set: every label is letters only (with an apostrophe, hyphen or space) and one is longer than two. `100`, `10p`, `£1.50`, `3:30` and `12 cm` are numbers, money, time and measures, not words. */
export const isWordSet = (labels: readonly string[]): boolean => wideFor(labels) && labels.every(l => /^[\p{L}'’\- ]+$/u.test(l));

/** The one policy both the bubble cap and the hint-once rule read (#2315): a plain word question, never a sequence, and never one whose options ARE the question (`optionsAreContent`: dropping one could leave the prompt pointing at a bubble that is gone). */
export const capApplies = (q: Question, labels: readonly string[]): boolean => !q.sequence && !q.optionsAreContent && isWordSet(labels);

/** The wave's labels with a word set trimmed to three, the answer always kept, the survivors in their shuffled order. Number, money, time and measure sets are untouched. */
export function capWordBubbles(labels: string[], answer: string): string[] {
  if (labels.length <= MAX_WORD_BUBBLES_KS1 || !isWordSet(labels)) return labels;
  let drop = labels.length - MAX_WORD_BUBBLES_KS1;
  const out: string[] = [];
  for (let i = labels.length - 1; i >= 0; i--) { if (drop > 0 && labels[i] !== answer) { drop--; continue; } out.unshift(labels[i]); }
  return out;
}

/**
 * The hint line for a question (#2315): a fixed instruction (not the card's own data) is shown on the first wave of a
 * Reception to Year 2 word game and returns '' after, since it never changes. `state.shownHint` remembers the line and the question that showed it.
 */
export function hintOnce(year: YearId, q: Question, line: string, state: { shownHint: { line: string; q: Question } | null }): string {
  if (!WORD_CAP_YEARS.has(year) || (!!q.hint && !!q.hintIsData) || !capApplies(q, q.options)) return line;
  if (state.shownHint?.q === q) return line;   // a re-render of the question that earned the line (voice change, respawn) keeps it
  if (state.shownHint?.line === line) return '';
  state.shownHint = { line, q }; return line;
}
