// y3-perfect (#1109): present perfect or simple past. Every frame carries exactly one time marker and only that
// marker decides the tense (#666: a frame with no marker has two right answers). d3 adds frames whose auxiliary
// is already printed, so the bubbles are the bare participle, the past and the base form.
import type { Generator, Question } from './types';
import { pick, wordQ } from './util';

/** [base, past, participle] — short forms only, so `has eaten` fits a bubble (R-LBL, #1046). */
export const VERBS = {
  go: ['go', 'went', 'gone'], eat: ['eat', 'ate', 'eaten'], see: ['see', 'saw', 'seen'], do: ['do', 'did', 'done'],
  lose: ['lose', 'lost', 'lost'], find: ['find', 'found', 'found'], win: ['win', 'won', 'won'],
  make: ['make', 'made', 'made'], wear: ['wear', 'wore', 'worn'],
} as const;
export type VerbKey = keyof typeof VERBS;

export const PAST_MARKERS = ['yesterday', 'last week', 'last night', 'ago', 'in 2020', 'when I was five'] as const;
export const PERFECT_MARKERS = ['already', 'yet', 'since', 'ever', 'never', 'so far'] as const;

/** s = he/she/it (`has`), p = I/you/we/they (`have`). */
export type Marker = typeof PAST_MARKERS[number] | typeof PERFECT_MARKERS[number];
export type Person = 's' | 'p';
/** [sentence with one `___`, verb, subject person, the time marker, gap kind: f = whole verb form, a = bare participle after a printed auxiliary]. */
export type PerfectRow = readonly [string, VerbKey, Person, Marker, 'f' | 'a'];

export const PERFECT_D1: readonly PerfectRow[] = [
  ['Tom ___ to the park yesterday.', 'go', 's', 'yesterday', 'f'], ['We ___ a film last week.', 'see', 'p', 'last week', 'f'],
  ['She ___ her lunch already.', 'eat', 's', 'already', 'f'], ['I ___ my homework already.', 'do', 'p', 'already', 'f'],
  ['Mum ___ a cake last week.', 'make', 's', 'last week', 'f'], ['They ___ the game last week.', 'win', 'p', 'last week', 'f'],
  ['He ___ his keys yesterday.', 'lose', 's', 'yesterday', 'f'], ['We ___ the cat already.', 'find', 'p', 'already', 'f'],
  ['The dog ___ my shoe last night.', 'eat', 's', 'last night', 'f'], ['She ___ her book already.', 'lose', 's', 'already', 'f'],
  ['We ___ to bed last night.', 'go', 'p', 'last night', 'f'], ['He ___ the dishes already.', 'do', 's', 'already', 'f'],
];

export const PERFECT_D2: readonly PerfectRow[] = [
  ['Gran ___ to Spain two years ago.', 'go', 's', 'ago', 'f'], ['I ___ a gold medal in 2020.', 'win', 'p', 'in 2020', 'f'],
  ['I ___ a whale when I was five.', 'see', 'p', 'when I was five', 'f'], ['She ___ no sweets since Monday.', 'eat', 's', 'since', 'f'],
  ['We ___ ten shells so far.', 'find', 'p', 'so far', 'f'], ['He ___ two games so far.', 'win', 's', 'so far', 'f'],
  ['Dad ___ his phone two days ago.', 'lose', 's', 'ago', 'f'], ['They ___ a mess last night.', 'make', 'p', 'last night', 'f'],
  ['My cat ___ nothing since lunch.', 'eat', 's', 'since', 'f'], ['We ___ no work since Monday.', 'do', 'p', 'since', 'f'],
  ['They ___ a new home in 2020.', 'find', 'p', 'in 2020', 'f'], ['Tess ___ the match in 2020.', 'win', 's', 'in 2020', 'f'],
  ['I ___ the same coat since winter.', 'wear', 'p', 'since', 'f'], ['He ___ a red hat last week.', 'wear', 's', 'last week', 'f'],
];

/** d3: printed-auxiliary questions and negatives; every verb here has a past that differs from its participle. */
export const PERFECT_D3_AUX: readonly PerfectRow[] = [
  ['Have you ever ___ a whale?', 'see', 'p', 'ever', 'a'], ['She hasn\'t ___ her lunch yet.', 'eat', 's', 'yet', 'a'],
  ['We have never ___ a rainbow.', 'see', 'p', 'never', 'a'], ['Has he ___ his homework yet?', 'do', 's', 'yet', 'a'],
  ['Have they ___ the cake yet?', 'eat', 'p', 'yet', 'a'], ['He hasn\'t ___ to school since Monday.', 'go', 's', 'since', 'a'],
  ['Has she ever ___ a lion?', 'see', 's', 'ever', 'a'], ['We haven\'t ___ the dishes yet.', 'do', 'p', 'yet', 'a'],
];

const auxOf = (p: Person) => (p === 's' ? 'has' : 'have');

/** The answer an oracle derives from a row: past for a past marker, `has`/`have` + participle for a perfect one. */
export function perfectAnswer([, verb, person, marker, kind]: PerfectRow): string {
  const [, past, part] = VERBS[verb];
  if (kind === 'a') return part;
  if ((PAST_MARKERS as readonly string[]).includes(marker)) return past;
  if ((PERFECT_MARKERS as readonly string[]).includes(marker)) return `${auxOf(person)} ${part}`;
  throw new Error(`y3-perfect: unknown time marker "${marker}"`);
}

export const y3Perfect: Generator = (d, rng): Question => {
  const aux = d === 3 && rng() < 0.5;
  const row = pick(rng, aux ? PERFECT_D3_AUX : d === 1 ? PERFECT_D1 : PERFECT_D2);
  const [sentence, verb, person, , kind] = row;
  const [base, past, part] = VERBS[verb];
  const answer = perfectAnswer(row);
  const ds = kind === 'a' ? [past, base] : (() => {
    const right = `${auxOf(person)} ${part}`, wrong = `${auxOf(person === 's' ? 'p' : 's')} ${part}`;
    const other = answer === past ? right : past;
    return d === 1 ? [other] : [other, wrong];
  })();
  return wordQ(rng, `Which form of "${base}"?`, answer, ds, {
    visual: { type: 'sentence', text: sentence }, say: sentence.replace('___', 'blank'),
    hint: 'Look for the time word', hintIsData: false,
  });
};
