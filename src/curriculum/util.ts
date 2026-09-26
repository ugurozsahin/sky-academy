import type { HintOpt, Question, Rng } from './types';

export const ri = (rng: Rng, min: number, max: number) => min + Math.floor(rng() * (max - min + 1));
export const pick = <T>(rng: Rng, arr: readonly T[]): T => arr[Math.floor(rng() * arr.length)];
export function shuffle<T>(rng: Rng, arr: readonly T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/**
 * Numeric distractors near the answer, within [min,max], never equal to answer or to `exclude` (#462: a
 * caller topping up an existing decoy set has to tell `nearby` what it already has, or a collision just
 * gets dropped downstream with no second attempt — silently shipping a card short a bubble).
 */
export function nearby(rng: Rng, answer: number, count: number, min: number, max: number, exclude: ReadonlySet<number> = EMPTY_SET): number[] {
  const set = new Set<number>();
  let guard = 0;
  while (set.size < count && guard++ < 200) {
    const spread = Math.max(2, Math.min(10, Math.ceil(Math.abs(answer) * 0.3) + 2));
    const v = answer + ri(rng, -spread, spread);
    if (v !== answer && v >= min && v <= max && !exclude.has(v)) set.add(v);
  }
  // fallback fill if range is tiny
  for (let v = min; set.size < count && v <= max; v++) if (v !== answer && !exclude.has(v)) set.add(v);
  return [...set];
}
// Frozen (review agent finding): a plain `Set` shared across every no-`exclude` call would let a future edit
// mutate the "empty" default for the rest of the session with nothing to catch it.
const EMPTY_SET: ReadonlySet<number> = Object.freeze(new Set<number>());

/**
 * Build a numeric multiple-choice question. `opts` mixes `numQ`'s own range/decoy controls with any other
 * `Question` field (`hint`, `hintIsData`, `visual`, `say`…) — forwarded the same way `wordQ`'s `extra` is
 * (#468 item 4): a hand-written field list here silently drops a new field a caller sets, with no compile
 * error and no failing test, which is exactly the trap `wordQ` does not have.
 */
export function numQ(rng: Rng, prompt: string, answer: number, opts: { min?: number; max?: number; n?: number; distractors?: number[] } & Partial<Omit<Question, 'prompt' | 'answer' | 'options' | 'hint' | 'hintIsData'>> & HintOpt = {}): Question {
  const n = opts.n ?? 3;
  const min = opts.min ?? 0, max = opts.max ?? Math.max(20, answer + 10);
  let ds = opts.distractors ? [...new Set(opts.distractors.filter(d => d !== answer && d >= min && d <= max))] : [];
  // #462: `nearby` used to be asked for exactly the decoys `ds` was short of without being told which ones
  // `ds` already held, so a collision got dropped downstream with no second attempt — silently shipping a
  // card one bubble short. Passing `ds` as its exclusion set means every value it returns is already new.
  if (ds.length < n) ds = ds.concat(nearby(rng, answer, n - ds.length, min, max, new Set(ds)));
  const options = shuffle(rng, [String(answer), ...ds.slice(0, n).map(String)]);
  // `Omit<Question, 'prompt' | 'answer' | 'options'>` in the signature only blocks those three keys when a
  // caller writes them into an object literal — TypeScript's excess-property check does not reach a spread
  // (`...q(p)`, several call sites in maths.ts), so a `prompt`/`answer`/`options` arriving that way is typed
  // clean and would otherwise override the values this function just computed. Stripped explicitly rather
  // than trusted to the type (silent-failure-hunter, reviewing #468 item 4).
  const { min: _min, max: _max, n: _n, distractors: _distractors, prompt: _prompt, answer: _answer, options: _options, ...extra } = opts as typeof opts & { prompt?: unknown; answer?: unknown; options?: unknown };
  return { prompt, answer: String(answer), options, ...extra };
}

/**
 * Whether an option set reads as "words" and should draw the bigger bubble (#369, #482): the longest label
 * decides — one character short of "op" but as long as "cat" tips it wide. The single rule `wordQ` below and
 * `waveOptsFor` (`src/ui/play-session.ts`) both call, so a card is never wide by one rule and narrow by the
 * other depending on which of the two computed `q.wide` for it (#482: before this, `wordQ` used `> 2` and
 * `waveOptsFor`'s own fallback used `> 3` — the same three-character label read differently depending on
 * which generator wrote the card).
 */
export const wideFor = (options: readonly string[]): boolean => options.some(o => o.length > 2);

/**
 * Build a word/symbol multiple-choice question.
 *
 * `wide` is read off the **whole option set**, never the answer alone (#369): `bubbleRadius` draws a wide
 * wave 1.25x bigger, so deriving it from the answer made the correct bubble systematically the larger one
 * wherever a card's options differ in length — on a two-option card (`yes`/`no`, `50p`/`1p`) size alone gave
 * the answer away. Width is a property of the card, which is what `Question['wide']` has always claimed
 * ("options are words → bigger bubbles"); `waveOptsFor` in `src/ui/play-session.ts` reads the same way,
 * through the shared `wideFor` above.
 */
export function wordQ(rng: Rng, prompt: string, answer: string, distractors: string[], extra: Partial<Omit<Question, 'hint' | 'hintIsData'>> & HintOpt = {}): Question {
  const withoutAnswer = distractors.filter(d => d !== answer);
  const ds = [...new Set(withoutAnswer)].slice(0, 3);
  // #515: a duplicate among the caller's own candidates can drop the deduped set below 3 with nothing else
  // catching it — the card then ships short a bubble and no signal anywhere. Warn only when the caller had
  // at least 3 candidates left *after* the answer is removed, so a generator that deliberately hands wordQ
  // the whole small universe of options including the answer itself (e.g. the three sentence-punctuation
  // marks in writing.ts, where only 2 ever remain once the answer is filtered) never trips this — that is
  // by design, not a collision, and #379's recordAccuracy clamp makes the same "well-formed input never
  // warns" guarantee.
  if (ds.length < 3 && withoutAnswer.length >= 3)
    console.warn(`wordQ("${prompt}"): ${withoutAnswer.length} distractor candidates collapsed to ${ds.length} unique after de-duplication — the card ships ${ds.length + 1} option${ds.length === 0 ? '' : 's'}.`);
  return { prompt, answer, options: shuffle(rng, [answer, ...ds]), wide: wideFor([answer, ...ds]), ...extra };
}

export const NUM_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
export function numberWord(n: number): string {
  if (n <= 20) return NUM_WORDS[n];
  if (n === 100) return 'one hundred';
  const t = Math.floor(n / 10), o = n % 10;
  return o ? `${TENS[t]}-${NUM_WORDS[o]}` : TENS[t];
}

/**
 * Money label: pence under £1 stay as `50p`, whole pounds show as `£2`, and a mixed amount records the pounds
 * and the pence separately — `£1 and 50p` (one source for the shops, coins and cards).
 *
 * The separate recording is KS1's (#298 slice 2): Year 3 guidance says pupils "record £ and p separately. The
 * decimal recording of money is introduced formally in year 4." So no label this writes carries a decimal
 * point, which is what the rail in `tests/unit/curriculum.test.ts` holds it to.
 */
export const coinLabel = (p: number) => {
  if (p < 100) return `${p}p`;
  const pounds = Math.floor(p / 100), pence = p % 100;
  return pence === 0 ? `£${pounds}` : `£${pounds} and ${pence}p`;
};

export const OBJECTS = ['🍎', '⭐', '🐟', '🎈', '🍪', '🦋', '🐸', '🚗', '🌼', '🧁'];

/**
 * The two banknotes Year 1 recognises beside its coins (#298 slice 4, #361) — one source, so a "coin" or
 * "note" label (`maths.ts`'s `y1Coins`) and a note's rendering (`visuals.ts`'s `coinSVG`/`NOTE_INK`) read the
 * same pool instead of each keeping its own `>= 500` copy that could silently drift apart.
 */
export const NOTES = [500, 1000] as const;
export function isNote(p: number): p is (typeof NOTES)[number] {
  return (NOTES as readonly number[]).includes(p);
}

// Canonical shape tables — one source for the maths shape topics (maths.ts) and Memory Match (game/memory.ts),
// which used to keep their own copies at different arities (#35). The first four 2-D shapes are the
// Reception-easy set (circle/square/triangle/rectangle) so Memory's `SHAPES_2D.slice(0, 4)` still holds.
/** 2-D shapes: glyph, name, number of sides (circle = 0). */
export const SHAPES_2D: readonly [string, string, number][] = [['▲', 'triangle', 3], ['■', 'square', 4], ['▬', 'rectangle', 4], ['●', 'circle', 0], ['⬟', 'pentagon', 5], ['⬢', 'hexagon', 6]];
/**
 * A 3-D shape's countable properties (#299 slice 2).
 *
 * `as` is the name the counts hold for, which is not always the name a child slices: "pyramid" on its own
 * has no fixed face count (a triangle-based one has 4, not 5), so a property card says "square-based
 * pyramid" while a naming card keeps the Year 1 NC's plain "pyramid".
 *
 * `flat` is flat faces, which every shape here can state without argument — a sphere has none, a cone one.
 * The old table carried a prose fact instead ("1 flat face", "1 curved face") and asked "A cone has…",
 * where a child could defensibly slice either: a cone has one flat face *and* one curved one. Counting
 * flat faces has exactly one answer for all six.
 *
 * `edges` and `vertices` are the Year 2 addition, and are carried by the polyhedra only. Whether a sphere,
 * cylinder or cone has edges or vertices at all is a matter of KS1 convention rather than a fact a card can
 * mark right or wrong, so the curved shapes carry neither and are never asked for them. The pair is
 * unrepresentable half-filled (#373): a shape carries both `edges` and `vertices`, or neither.
 */
export type Shape3DProps = { readonly as: string; readonly flat: number } & ({ readonly edges: number; readonly vertices: number } | { readonly edges?: never; readonly vertices?: never });
/** 3-D shapes: glyph, name, properties. One source for maths.ts and Memory Match (#35). */
export const SHAPES_3D: readonly [string, string, Shape3DProps][] = [
  ['🎲', 'cube', { as: 'cube', flat: 6, edges: 12, vertices: 8 }],
  ['⚽', 'sphere', { as: 'sphere', flat: 0 }],
  ['🥫', 'cylinder', { as: 'cylinder', flat: 2 }],
  ['🍦', 'cone', { as: 'cone', flat: 1 }],
  ['🔺', 'pyramid', { as: 'square-based pyramid', flat: 5, edges: 8, vertices: 5 }],
  ['🧱', 'cuboid', { as: 'cuboid', flat: 6, edges: 12, vertices: 8 }],
];
/** A cube *is* a cuboid ("cuboids including cubes", Y1 NC), so the two never share a naming card (#299). */
export const SAME_SOLID = new Set(['cube', 'cuboid']);
export function symSay(s: string): string {
  return s.replace(/×/g, ' times ').replace(/÷/g, ' divided by ').replace(/\+/g, ' plus ').replace(/[−-]/g, ' minus ').replace(/=/g, ' equals ').replace(/\?/g, ' what').replace(/\s+/g, ' ').trim();
}
