// Shared build-the-answer helper for KS2 written-response cards (#1060): the SATs arithmetic paper asks for
// a written answer, not a choice from four, so the child slices the answer's digits in order instead
// ("9,999 × 99 = 989,901" prints six digits). `buildQ` reads any answer string once, character by character:
// a digit is always a slot; `.` and `−` (U+2212, never an ASCII hyphen) are slots only when `steps` opts one
// in; every other character — a comma, a fraction bar, a mixed-number space, the letter `r` of " r " — is
// always fixed. `sequence` carries the sliced characters in order, a repeated digit repeating in it too, the
// same convention `spellQ` (`util.ts`) uses for a repeated letter.
import type { Rng, Question } from './types';
import { shuffle } from './util';

const MINUS = '−';
const DIGITS = '0123456789'.split('');
const MAX_SLOTS = 6;

export interface BuildSteps { point?: boolean; sign?: boolean }

export interface BuildOpts {
  prompt: string;
  say?: string;
  answer: string;
  /** Total bubbles launched, whatever the answer's length or repeats (#481's rule, applied to digits). */
  total: number;
  steps?: BuildSteps;
  /** Always an instruction ("Slice the digits in order"), never data — a build card's own digits are the
   *  card's content, so `hintIsData` is hardcoded `false` below rather than exposed as a third option. */
  hint?: string;
}

/** Walks `answer` once: every digit is a slot; `.`/`−` are slots only when `steps` opts them in. */
function slotsOf(answer: string, steps: BuildSteps): { template: string; sequence: string[] } {
  const sequence: string[] = [];
  let template = '';
  for (const c of answer) {
    const slot = (c >= '0' && c <= '9') || (c === '.' && !!steps.point) || (c === MINUS && !!steps.sign);
    template += slot ? '_' : c;
    if (slot) sequence.push(c);
  }
  return { template, sequence };
}

/**
 * Builds a `sequence`/`build` question from a written answer (#1059 renders `build.template` with the
 * prompt kept on the card). `total` fixes the launched bubble count: decoys are digits absent from the
 * answer entirely, so a decoy can never equal a value the child still has to slice, and the bubble count
 * never gives away how many digits repeat (#481's own defect, one channel over).
 */
export function buildQ(rng: Rng, opts: BuildOpts): Question {
  if (!Number.isInteger(opts.total) || opts.total < 0) throw new Error(`buildQ: total must be a non-negative integer, got ${opts.total}`);
  if (opts.total > 10) throw new Error(`buildQ: total ${opts.total} exceeds the generic loop's 10-option cap`);
  const steps = opts.steps ?? {};
  if (steps.point && !opts.answer.includes('.')) throw new Error(`buildQ: steps.point is set but "${opts.answer}" has no "." to step`);
  if (steps.sign && !opts.answer.includes(MINUS)) throw new Error(`buildQ: steps.sign is set but "${opts.answer}" has no "${MINUS}" to step`);
  const { template, sequence } = slotsOf(opts.answer, steps);
  if (sequence.length < 1) throw new Error(`buildQ: "${opts.answer}" has no digit to slice`);
  if (sequence.length > MAX_SLOTS) {
    throw new Error(`buildQ: "${opts.answer}" needs ${sequence.length} slots, more than the ${MAX_SLOTS}-slot cap`);
  }
  const uniq = [...new Set(sequence)];
  const need = opts.total - sequence.length;
  if (need < 1) throw new Error(`buildQ: total ${opts.total} leaves no decoy for "${opts.answer}"'s ${sequence.length} slots`);
  // Never fires: pool.length is 10 minus the answer's unique *digits*, and need is at most
  // 10 (the total cap above) minus sequence.length, which is at least that same unique-digit count —
  // so need <= pool.length always, whatever the answer. No test can reach a throw here (pr-test-analyzer,
  // #1060 review) — the invariant is enforced by the two caps above, not by this line.
  const pool = DIGITS.filter(d => !uniq.includes(d));
  const decoys = shuffle(rng, pool).slice(0, need);
  const base = {
    prompt: opts.prompt,
    say: opts.say,
    answer: opts.answer,
    sequence,
    build: { template },
    options: shuffle(rng, [...uniq, ...decoys]),
  };
  return opts.hint === undefined ? base : { ...base, hint: opts.hint, hintIsData: false };
}

export interface StepsOpts {
  prompt: string;
  say?: string;
  /** The first step's result, then the answer — two whole numbers that differ. */
  steps: readonly [number, number];
  /** One wrong value per step (a misconception from `mistakes.ts`), never equal to either step. */
  decoys: readonly [number, number];
  /** Pure oracle: recomputes both steps from the problem's own numbers; `stepsQ` throws if they disagree. */
  check: (steps: readonly [number, number]) => readonly [number, number];
  /** Formats a number as a bubble label (default `String`; pass `fmt` for money or decimals). */
  display?: (n: number) => string;
}

/**
 * Two-step "combo" card (#1067): slice the first step's result, then the answer. The prompt stays on the card
 * (`build.template` is `_ → _`, #1059), and the bubble count is always 4 (2 steps + 2 decoys, #481's rule).
 * A story topic opts in by setting `sequenceFrom` to its difficulty, so Duel skips those cards.
 */
export function stepsQ(rng: Rng, opts: StepsOpts): Question {
  const { steps, decoys } = opts;
  const show = opts.display ?? String;
  if (![...steps, ...decoys].every(Number.isInteger)) throw new Error('stepsQ: steps and decoys must be whole numbers');
  if (steps[0] === steps[1]) throw new Error(`stepsQ: the two steps must differ, both are ${steps[0]}`);
  const checked = opts.check(steps);
  if (checked[0] !== steps[0] || checked[1] !== steps[1]) {
    throw new Error(`stepsQ: steps ${steps.join(', ')} disagree with the check's ${checked.join(', ')}`);
  }
  const labels = steps.map(show);
  const wrong = decoys.map(show);
  if (new Set([...labels, ...wrong]).size !== 4) throw new Error(`stepsQ: steps and decoys must be four distinct labels, got ${[...labels, ...wrong].join(', ')}`);
  return {
    prompt: opts.prompt,
    say: opts.say,
    answer: `${labels[0]} → ${labels[1]}`,
    sequence: labels,
    build: { template: '_ → _' },
    options: shuffle(rng, [...labels, ...wrong]),
    hint: 'Slice the first step, then the answer',
    hintIsData: false,
  };
}
