// Shared question model for every subject. Generators are pure: (difficulty, rng) => Question.
export type Rng = () => number; // [0,1)

/** One category of a chart visual: its label (emoji + name) and the count it stands for. */
export interface ChartRow { label: string; n: number }

export type Visual =
  | { type: 'objects'; emoji: string; n: number; n2?: number; emoji2?: string } // groups of objects
  | { type: 'tenframe'; n: number; n2?: number }         // ten-frame with n filled (n2 = second colour)
  | { type: 'dots'; n: number }                          // subitising dots (random arrangement)
  | { type: 'array'; rows: number; cols: number }        // multiplication array
  | { type: 'coins'; coins: number[] }                   // pence values, 100 = £1, 200 = £2, 500/1000 = £5/£10 notes
  | { type: 'clock'; h: number; m: number }
  | { type: 'fraction'; parts: number; shaded: number; shape?: 'circle' | 'bar'; stack?: { parts: number; shaded: number }[] }
  // mark = hidden number shown as ?; labels = one printed text per tick ("3/4", "0.3"); marks = letters A-D on the tick whose value is `at`
  | { type: 'numberline'; from: number; to: number; mark?: number; step?: number; labels?: string[]; marks?: { label: string; at: number }[] }
  | { type: 'scales'; left: string; right: string }     // balance scales: text/emoji on each pan ("3 + 4" / "? + 2")
  // Categorical data (Y2 statistics): one row per category, `n` = the count it stands for. `kind` picks the
  // chart. Two variants, not three (#133): a tally and a block diagram share their whole contract, and only
  // the pictogram has a key — `each` (one symbol = `each` of the thing, so the drawing shows n / each symbols)
  // and the `icon` it draws — so both are required where they mean something and absent where they do not.
  | { type: 'chart'; kind: 'tally' | 'block'; rows: ChartRow[] }
  | { type: 'chart'; kind: 'pictogram'; rows: ChartRow[]; each: number; icon: string }
  // Line symmetry in a vertical line (Y2 Geometry, #299 slice 4). `grid` is one string per row, `#` for a
  // coloured square and `.` for an empty one; the drawing puts a dashed mirror line down the middle, so the
  // child compares the two halves rather than being told which side to look at. A picture, not a shape name:
  // the whole question is whether the left half and the right half match.
  // `mirror: false` omits the fold line (area, perimeter, nets); `h` is a half square, `A`–`D` a lettered
  // empty square (at most 7 columns) — #1062.
  | { type: 'symmetry'; grid: string[]; mirror?: false }
  | { type: 'word'; text: string; emoji?: string }       // big word / letter card (writing)
  | { type: 'sentence'; text: string }                   // sentence with a blank "_" (writing — English text)
  // a repeating-pattern glyph strip with a blank "_" (y2-patterns): not language, so the drawing keeps it on
  // one line instead of word-wrapping it mid-pattern — its own variant, not a flag on `sentence`, because
  // every other `sentence` producer writes real English and nothing here should have to opt out (#391).
  | { type: 'strip'; text: string };

interface QuestionCore {
  prompt: string;         // shown on the question card ("7 + 5 = ?")
  say?: string;           // spoken form (Web Speech), defaults to prompt
  answer: string;         // correct option OR, for 'sequence', the letters joined
  options: string[];      // bubble labels (shuffled, includes answer / all sequence letters)
  /**
   * `options` is a decoy pool on most topics — re-drawn per draw, so `repeatKey` (`src/game/session.ts`) must
   * ignore it or repeat-avoidance switches off. `intervalCompare` (#451) is the one generator whose *bubbles*
   * are the question: it sets no `hint`, `listen` or `visual`, so without this the key reduces to
   * `(prompt, answer)` and 18 of 22 `y2-duration` d2 cards share a key. Set by the generator, read by
   * `repeatKey` as an opt-in — folding `options` into the key unconditionally is the defect #412 fixed, not a
   * remedy for it.
   */
  optionsAreContent?: boolean;
  sequence?: string[];    // slice these in order (spelling); options = sequence letters + decoys
  /**
   * A sequence whose slices are an answer's digits, not a spelling (#1059): `build` implies `sequence`, and
   * `template`'s `_` count must equal `sequence.length` — every other character (`.`, `,`, `/`, `−`, ` r `,
   * spaces) prints as itself between the slots. `answer` is `template` with the slots filled by `sequence`,
   * in order ("3.75" from template `_.__` and sequence `['3','7','5']`). Unlike a spelling sequence, the
   * prompt itself is kept on the card (`promptHTML`, `src/ui/hud.ts`) — a build card has no other way to
   * show the child what sum they are answering.
   *
   * Not a `SequenceOpt`-style required-sibling union alongside `sequence` (`HintOpt`'s pattern, tried and
   * reverted here): `Omit`/`Pick` do not distribute over a union's members — `numQ`/`wordQ`'s
   * `Partial<Omit<Question, …>>` opts-forwarding (this file's callers in `curriculum/util.ts`) reads a
   * union's property through `T[K]`, which flattens `{ sequence: string[]; build: {…} } | { sequence?:
   * string[]; build?: undefined }` into independently-optional `sequence`/`build` fields anyway — the exact
   * correlation a union was meant to keep. Closing that would mean reworking every generator's
   * options-forwarding, not this ticket's mechanism. The invariant stays runtime-only, checked for every
   * topic in `tests/unit/curriculum.test.ts` — including `build` set with no `sequence`, asserted outside
   * the `if (q.sequence)` gate so that mistake cannot hide inside it.
   */
  build?: { template: string };
  /**
   * "Slice Them All" (#869/#918): legal only alongside `sequence`, which then holds the card's *targets*
   * rather than an ordered spelling — the card is correct once every target is sliced, in any order, and
   * `options` holds the targets plus decoys. `Session.hit()`/`fall()`/`labelsFor()` (`src/game/session.ts`)
   * read this flag to switch from position-in-sequence to set-membership. `y2-oddeven` (#926) is the first
   * generator to set it; #920, #927 and #928 are further topic children of the same engine.
   */
  anyOrder?: true;
  visual?: Visual;
  wide?: boolean;         // options are words → bigger bubbles
  listen?: string;        // spoken-only question: shown on the card instead of `prompt` when read-aloud is off
  peek?: boolean;         // no-voice sequence: show `listen` briefly, then hide it before the bubbles launch (#65)
  peekHint?: string;      // the hint once a no-voice peek hides (default 'Slice the words in order'), for a letter or chunk build (#1102)
  slow?: boolean;         // several mental steps: one speed step slower, like a sequence — in every mode but Sky Storm. Opt-in per generator (`slowAtD3`), not year-wide (#297)
  noSayAnswer?: boolean;  // #893/#982: this card's answer must never be spoken as the wrong/miss correction line (a pseudo-word)
}

/**
 * `hint` requires `hintIsData` alongside it, not two independent optionals (#707, closing the same pattern
 * `Theme.hintIsData` in `src/game/memory.ts` already holds `Theme` to): the moment a generator sets `hint` it
 * must also say whether that text is the values the card is answered from (`true`) or an instruction line
 * ("Slice the shape", `false`) — a required sibling that `tsc` enforces on any hint-carrying literal, rather
 * than an easy-to-forget optional that silently reads as `false`. Two generators set it `true` today,
 * `measureCompare()` and `y2Temp`'s comparison branch (seven topics between them); every other hint-writing
 * topic is chrome and states `false`.
 *
 * The implication runs one way only: `hintIsData` with no `hint` stays legal (`src/ui/play-session.ts`'s
 * `!!q.hint && !!q.hintIsData` reads a flag alone as no opinion, and `tests/unit/play-session.test.ts` holds
 * that fallback to a real case, not a mistake to close off) — only a hint-carrying literal with no stated
 * `hintIsData` is the gap this closes.
 *
 * It exists because a short screen reclaims `.hint` (`@media (max-height: 640px)`), which is a fair trade
 * for an instruction and takes a measure card's only readable content away — #328, and #65's rule that
 * every card stays usable without read-aloud. `src/ui/play-session.ts` marks the element `own` from this,
 * so only these cards keep the line on a phone held sideways.
 */
export type HintOpt = { hint: string; hintIsData: boolean } | { hint?: undefined; hintIsData?: boolean };

export type Question = QuestionCore & HintOpt;

export type Difficulty = 1 | 2 | 3;
export type Generator = (d: Difficulty, rng: Rng) => Question;

// One string source of truth for every year group. Adding a year (Y3–Y6) means one
// new YearId member + one YEARS entry — no unions or per-year assets to retype elsewhere.
export type YearId = 'reception' | 'year1' | 'year2' | 'year3' | 'year4';

export interface Topic {
  id: string;             // "y1-bonds"
  title: string;          // "Number Bonds"
  icon: string;           // emoji
  subject: 'maths' | 'writing';
  year: YearId;
  nc: string;             // curriculum reference (short)
  input?: 'bubbles' | 'tracing' | 'keypad';   // how the child answers (default bubbles); named apart from Session.Mode (#45)
  drill?: true;           // a narrow practice topic (#915): offered by the Sprint chooser only, never counted, mixed or duelled
  sequenceFrom?: Difficulty;   // draws a `Question.sequence` from this difficulty up — the truth `duelPool()` reads (#562)
  gen: Generator;
}

export interface YearInfo {
  id: YearId;
  title: string;
  short: string;
  age: string;
  blurb: string;          // island subtitle (topics at a glance)
  art?: string;           // island illustration: an SVG data URI used as the .isl-art background; a year with
                           // none draws `islandArt()`'s code-drawn placeholder instead (#1032)
  tint: string;           // island border tint (rgba hex)
  maxAnswer: number;      // largest sensible numeric answer for this year (curriculum range guard)
  minAnswer?: number;     // lowest sensible numeric answer for this year (curriculum range guard); absent means 0
  perStage: number;       // questions per stage
  lives: number;
  gentle: boolean;        // missed bubbles don't cost a life
  speeds: number[];       // bubble speed per stage (0 gentle-float … 3 fast); length = number of stages
  diffs: Difficulty[];    // generator difficulty per stage
  sprintStars: { threeStar: number; twoStar: number };   // Ninja Sprint correct-answer thresholds for this year (#700)
}
export const STAGE_NAMES = ['Apprentice', 'Warrior', 'Master', 'Grandmaster', 'Legend'];

/**
 * A comparison's verb and its four forms, bundled so a call site cannot pair one topic's verb with another's
 * forms (#324 item 5) — `measureCompare` (`util.ts`) used to take them as two separate arguments, and
 * `measureCompare(..., ['heavier', 'lighter', 'heaviest', 'lightest'], ..., 'holds')` compiled and shipped
 * "Which holds heavier?" with every rail green.
 */
export type Compare = { readonly verb: string; readonly forms: readonly [string, string, string, string] };
export const LONGER: Compare = { verb: 'is', forms: ['longer', 'shorter', 'longest', 'shortest'] };
export const TALLER: Compare = { verb: 'is', forms: ['taller', 'shorter', 'tallest', 'shortest'] };
export const HEAVIER: Compare = { verb: 'is', forms: ['heavier', 'lighter', 'heaviest', 'lightest'] };
// `holds`: a jug *holds* 300 ml (#296 — "fuller" is relative to the container, so a jug's 300 ml may be
// less full than a cup's 200 ml; the NC vocabulary for the container is "holds more / holds less").
export const HOLDS: Compare = { verb: 'holds', forms: ['more', 'less', 'most', 'least'] };

// Island illustrations (code-drawn SVGs, no external assets). Kept beside the year they belong to
// so a new year ships its own art without editing style.css.
const ART_RECEPTION = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 70'%3E%3Cpath d='M18 34h84l-14 26H36z' fill='%235a3a2a'/%3E%3Cpath d='M30 42l18 12 12-8 16 10 14-14' stroke='%233d2618' stroke-width='3' fill='none'/%3E%3Cellipse cx='60' cy='34' rx='44' ry='9' fill='%2366c25a'/%3E%3Cellipse cx='60' cy='31' rx='40' ry='6' fill='%238fe07a'/%3E%3Crect x='52' y='12' width='16' height='20' rx='2' fill='%23ff6a3d'/%3E%3Cpath d='M46 12h28l-3 4H49z' fill='%23c92e12'/%3E%3Ccircle cx='60' cy='22' r='3' fill='%23ffe9a8'/%3E%3Ccircle cx='24' cy='28' r='5' fill='%23ffd54f'/%3E%3Ccircle cx='96' cy='27' r='4' fill='%23ff7ac6'/%3E%3C/svg%3E";
const ART_YEAR1 = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 70'%3E%3Cpath d='M16 36h88l-16 28H34z' fill='%234a3a5a'/%3E%3Cpath d='M28 44l20 12 14-9 14 11 16-15' stroke='%23302040' stroke-width='3' fill='none'/%3E%3Cellipse cx='60' cy='36' rx='46' ry='9' fill='%2359b0b8'/%3E%3Cellipse cx='60' cy='33' rx='42' ry='6' fill='%237fe0d8'/%3E%3Cpath d='M40 32l20-22 20 22z' fill='%23b8c4e6'/%3E%3Cpath d='M52 32l8-10 8 10z' fill='%23e8eeff'/%3E%3Crect x='82' y='18' width='4' height='14' fill='%23ffb020'/%3E%3Ccircle cx='84' cy='16' r='4' fill='%23ffe07a'/%3E%3C/svg%3E";
const ART_YEAR2 = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 70'%3E%3Cpath d='M14 38h92l-18 28H32z' fill='%233a2a4a'/%3E%3Cpath d='M26 46l22 12 14-9 14 11 18-15' stroke='%23261a34' stroke-width='3' fill='none'/%3E%3Cellipse cx='60' cy='38' rx='48' ry='9' fill='%237a5ad6'/%3E%3Cellipse cx='60' cy='35' rx='44' ry='6' fill='%23a98cff'/%3E%3Cpath d='M44 34V14h32v20' fill='%232a1f4a'/%3E%3Cpath d='M38 14h44l-4-6H42z' fill='%23ff3b5c'/%3E%3Cpath d='M48 34V20h8v14zM64 34V20h8v14z' fill='%23ffe07a'/%3E%3Ccircle cx='24' cy='30' r='4' fill='%233ec9ff'/%3E%3Ccircle cx='98' cy='28' r='5' fill='%23ffd54f'/%3E%3C/svg%3E";

export const YEARS: YearInfo[] = [
  { id: 'reception', title: 'Reception', short: 'R', age: 'Ages 4–5', blurb: 'First steps · counting, sounds & letters', art: ART_RECEPTION, tint: '#66c25a55', maxAnswer: 30, perStage: 5, lives: 4, gentle: true, speeds: [0, 0, 0, 1, 1], diffs: [1, 1, 2, 2, 3], sprintStars: { threeStar: 8, twoStar: 4 } },
  { id: 'year1', title: 'Year 1', short: 'Y1', age: 'Ages 5–6', blurb: 'Number bonds, adding, phonics & spelling', art: ART_YEAR1, tint: '#59b0b855', maxAnswer: 120, perStage: 6, lives: 3, gentle: false, speeds: [1, 2, 2, 3, 3], diffs: [1, 2, 2, 3, 3], sprintStars: { threeStar: 12, twoStar: 6 } },
  { id: 'year2', title: 'Year 2', short: 'Y2', age: 'Ages 6–7', blurb: 'Times tables, money, time & tricky words', art: ART_YEAR2, tint: '#7a5ad655', maxAnswer: 130, perStage: 7, lives: 3, gentle: false, speeds: [1, 2, 3, 3, 3], diffs: [1, 2, 2, 3, 3], sprintStars: { threeStar: 12, twoStar: 6 } },
  // #1050: no `art` yet (#1032's placeholder draws instead) — a KS2 island stays hidden by `meetsShowGate`
  // until it has 12 maths + 6 writing topics, so this row exists with no map presence today.
  { id: 'year3', title: 'Year 3', short: 'Y3', age: 'Ages 7–8', blurb: 'Hundreds, 3, 4 & 8 tables, fractions & Roman numerals', tint: '#ffb02055', maxAnswer: 2000, perStage: 7, lives: 3, gentle: false, speeds: [1, 2, 3, 3, 3], diffs: [1, 2, 2, 3, 3], sprintStars: { threeStar: 12, twoStar: 6 } },
  { id: 'year4', title: 'Year 4', short: 'Y4', age: 'Ages 8–9', blurb: 'Tables to 12 × 12, decimals, area & coordinates', tint: '#3ec9ff55', maxAnswer: 20000, minAnswer: -50, perStage: 7, lives: 3, gentle: false, speeds: [1, 2, 3, 3, 3], diffs: [1, 2, 2, 3, 3], sprintStars: { threeStar: 12, twoStar: 6 } },
];
