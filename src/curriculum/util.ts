import type { Compare, Difficulty, Generator, HintOpt, Question, Rng } from './types';

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
/** A cube *is* a cuboid, and a square *is* a rectangle (Y1 NC: "cuboids including cubes", "rectangles (including squares)"), so neither pair may be answer and decoy together (#299, #872) — sameShape() checks both. */
export const SAME_SOLID = new Set(['cube', 'cuboid']), SAME_FLAT = new Set(['square', 'rectangle']);
export function sameShape(a: string, b: string): boolean { return a === b || (SAME_SOLID.has(a) && SAME_SOLID.has(b)) || (SAME_FLAT.has(a) && SAME_FLAT.has(b)); }
export function symSay(s: string): string {
  return s.replace(/×/g, ' times ').replace(/÷/g, ' divided by ').replace(/\+/g, ' plus ').replace(/[−-]/g, ' minus ').replace(/=/g, ' equals ').replace(/\?/g, ' what').replace(/\s+/g, ' ').trim();
}

// ---------- Generators shared across two or more years (#325 stage 4) ----------
// The curriculum is split reception.ts/year1.ts/year2.ts by year; a helper used by more than one of them
// stays here rather than being duplicated or making one year file import from another.

/** A spoken form that reads the symbols aloud, for any numeric prompt. Year 1, Year 2. */
export const q = (prompt: string) => ({ prompt, say: symSay(prompt) });

/** Order Up: slice the numbers from smallest to biggest (sequence mode with numbers). Reception, Y1, Y2. */
export function orderQ(rng: Rng, max: number, count: number): Question {
  const set = new Set<number>(); let guard = 0;
  while (set.size < count && guard++ < 100) set.add(ri(rng, 0, max));
  const nums = [...set]; const sorted = nums.slice().sort((a, b) => a - b).map(String);
  const shown = shuffle(rng, sorted);
  return { prompt: 'Smallest to biggest!', say: `Slice the numbers from smallest to biggest: ${shown.join(', ')}`, answer: sorted.join(','), sequence: sorted, options: shown, visual: { type: 'word', text: shown.join('  ') }, hint: 'Slice the smallest number first', hintIsData: false };
}

/** Number line: one label is hidden. Year 1, Year 2. */
export function lineQ(rng: Rng, from: number, step: number, len: number): Question {
  const to = from + step * (len - 1);
  const idx = ri(rng, 1, len - 1); const mark = from + step * idx;
  return numQ(rng, 'Which number is hidden?', mark, { min: 0, max: 120, visual: { type: 'numberline', from, to, mark, step }, say: `Which number is hidden on the number line?`, distractors: [mark + step, mark - step, mark + 1] });
}

/**
 * Naming a 3-D shape, either direction: pick the glyph from the name, or the name from the glyph. Decoys
 * come from the whole table, excluding any name sameShape() groups with it (here, only the cube/cuboid pair).
 * Year 1, Year 2.
 */
export function name3dQ(rng: Rng, from: readonly (readonly [string, string, ...unknown[]])[], glyphIsAnswer: boolean): Question {
  const [g, name] = pick(rng, from);
  const decoys = SHAPES_3D.filter(x => !sameShape(x[1], name));
  const three = shuffle(rng, decoys).slice(0, 3);
  return glyphIsAnswer
    ? wordQ(rng, `Which is a ${name}?`, g, three.map(x => x[0]), { hint: 'Slice the 3-D shape', hintIsData: false })
    : wordQ(rng, 'What is this shape?', name, three.map(x => x[1]), { visual: { type: 'word', text: g }, say: 'What is this shape called?' });
}

/** Balance the Scales: both pans must weigh the same — find the number that makes them equal (= as balance). Reception, Y1, Y2. */
export function balanceQ(rng: Rng, left: string, right: string, answer: number, max: number, extra: { say?: string; distractors?: number[]; pans?: [string, string] } = {}): Question {
  const p = `${left} = ${right}`;
  const [pl, pr] = extra.pans ?? [left, right];
  return numQ(rng, p, answer, { min: 0, max, visual: { type: 'scales', left: pl, right: pr }, say: extra.say ?? `Balance the scales! ${symSay(p)}`, hint: 'Make both sides the same', hintIsData: false, distractors: extra.distractors });
}

// ---------- Measurement — shared Year 1 / Year 2 (#8, #298) ----------
const COLOURS = ['red', 'blue', 'green', 'yellow', 'purple'];
export const UNIT_WORD: Record<string, string> = { cm: 'centimetres', m: 'metres', g: 'grams', kg: 'kilograms', ml: 'millilitres', l: 'litres' };

function uniqVals(rng: Rng, n: number, lo: number, hi: number): number[] {
  const s = new Set<number>(); let guard = 0;
  while (s.size < n && guard++ < 200) s.add(ri(rng, lo, hi));
  return [...s];
}
/** Slice the coloured thing that is the biggest/smallest by a measured value (d1 = 2 things comparative, d2/3 = 3
 * things superlative). `compare` is the `Compare` (`types.ts`) whose verb and forms this card uses (#324 item 5). */
export function measureCompare(rng: Rng, d: Difficulty, noun: string, unit: string, compare: Compare, lo: number, hi: number): Question {
  const { verb, forms } = compare;
  const n = d === 1 ? 2 : 3;                                   // forms = [compBig, compSmall, superBig, superSmall]
  const cols = shuffle(rng, COLOURS).slice(0, n);
  const vals = uniqVals(rng, n, lo, hi);
  const big = rng() < 0.5;
  const idx = vals.indexOf(big ? Math.max(...vals) : Math.min(...vals));
  const adj = n === 2 ? (big ? forms[0] : forms[1]) : (big ? forms[2] : forms[3]);
  const spoken = cols.map((c, i) => `the ${c} ${noun} ${verb} ${vals[i]} ${UNIT_WORD[unit]}`).join(', ');
  return wordQ(rng, n === 2 ? `Which ${verb} ${adj}?` : `Which ${verb} the ${adj}?`, cols[idx], cols.filter((_, i) => i !== idx), {
    // The options are the colours, so this hint is the only place the sizes being compared appear — it is
    // data, not the instruction line `hint` usually carries, and the play screen must keep it on a short
    // screen (#328). `unitChoice` below deliberately does NOT set it: there the units are the bubbles.
    hint: cols.map((c, i) => `${c} ${noun}: ${vals[i]} ${unit}`).join(' · '), hintIsData: true,
    say: `${spoken}. Which one ${verb} ${n === 2 ? adj : 'the ' + adj}?`,
  });
}
/** "Best unit" question: measure a familiar object in the smaller or larger standard unit. */
export function unitChoice(rng: Rng, things: [string, string][], small: string, large: string, verb: string): Question {
  const [thing, unit] = pick(rng, things);
  return wordQ(rng, `Best unit for a ${thing}?`, unit, [unit === small ? large : small], {
    say: `Would you ${verb} a ${thing} in ${UNIT_WORD[small]} or ${UNIT_WORD[large]}?`, hint: `${UNIT_WORD[small]} (${small}) or ${UNIT_WORD[large]} (${large})?`, hintIsData: false,
  });
}

/**
 * Add or subtract two measures **in one unit**, every value inside Year 2's range of 100 (#298). Converting
 * between units is Year 3 non-statutory at the earliest, so the pair never crosses cm/m, g/kg or ml/l, and
 * the ranges keep the answer *and* its decoys ≤ 100: `a + b ≤ 90` and `a − b ≥ 20`, so `answer ± 10` lands
 * inside the range either way. The third decoy is the other operation — the mistake the question is about.
 *
 * Two invariants the bounds below carry, both pinned in `tests/unit/curriculum.test.ts` because neither is
 * visible in the ranges at a glance: `b ≥ 10`, without which the other-operation decoy collides with
 * `answer − 10` and `wordQ` silently dedupes the card down to three options; and `b ≤ 34`, above which
 * `ri(rng, b + 20, 90 - b)` inverts and hands back values below its own minimum.
 */
export function measureSum(rng: Rng, unit: string, verb: [string, string]): Question {
  const b = ri(rng, 10, 30), a = ri(rng, b + 20, 90 - b), add = rng() < 0.5;
  const ans = add ? a + b : a - b;
  const word = UNIT_WORD[unit];
  return wordQ(rng, `${a} ${unit} ${add ? '+' : '−'} ${b} ${unit} = ?`, `${ans} ${unit}`,
    [`${ans + 10} ${unit}`, `${ans - 10} ${unit}`, `${add ? a - b : a + b} ${unit}`],
    { say: `${a} ${word} ${add ? 'plus' : 'take away'} ${b} ${word}. ${add ? verb[0] : verb[1]}` });
}

/**
 * `max` caps the decoys at the year's range too — a `30p` bubble on a Year 1 card is the same overreach as a
 * `30p` answer. The first four decoys are the long-standing ones and are all `y2-money` ever uses; the rest
 * only come into play when the cap bites hard enough to leave fewer than three (a 20p total loses `+1`, `+5`
 * and `+10` at once). Year 1 (`y1-coins`), Year 2 (`y2-money`).
 *
 * Both guards below are unreachable through every caller today (#361) — `total` never exceeds `max` and the
 * pool always yields three survivors — so this is insurance against a future caller, not railed behaviour: a
 * card `max` can't actually satisfy is a wrong-range answer bubble, and one three decoys can't fill is the
 * one-bubble card #35's shape-table bug already showed this project.
 */
export function unitQ(rng: Rng, total: number, coins: number[], max = Infinity): Question {
  if (total > max) throw new Error(`unitQ: total ${total}p exceeds its own max ${max}p`);
  const pool = [total + 1, total - 1, total + 5, total + 10, total - 5, total + 2, total - 2];
  const ok = (x: number) => x > 0 && x !== total && x <= max;
  const first = pool.slice(0, 4).filter(ok);
  const ds = shuffle(rng, first.length >= 3 ? first : pool.filter(ok)).slice(0, 3);
  if (ds.length < 3) throw new Error(`unitQ: only ${ds.length} decoy(s) available for total ${total}p (max ${max}p)`);
  return wordQ(rng, 'How much money?', `${total}p`, ds.map(x => `${x}p`), { visual: { type: 'coins', coins }, say: 'How many pence altogether?' });
}

// ---------- Position & direction — shared Year 1 / Year 2 (#8 Phase 2) ----------
// Four compass directions in clockwise order, each with its arrow; a turn moves that many quarter-steps round the ring.
export const DIRS: [string, string][] = [['up', '⬆️'], ['right', '➡️'], ['down', '⬇️'], ['left', '⬅️']];
export const ARROWS = DIRS.map(d => d[1]);
export const TURNS_ALL: [string, number][] = [['a quarter turn', 1], ['a half turn', 2], ['a three-quarter turn', 3], ['a whole turn', 4]];
/** Direction faced after turning `steps` quarter-turns clockwise (or anti-clockwise) from `start` (indices into DIRS). */
export const turnEnd = (start: number, steps: number, clockwise: boolean): number => (((start + (clockwise ? steps : -steps)) % 4) + 4) % 4;

// ---------- Spelling & phonics — shared across years (writing topics, #14/#296/#324/#418/#443/#445) ----------
export const LETTERS = 'abcdefghijklmnopqrstuvwxyz'.split('');
export const VOWELS = ['a', 'e', 'i', 'o', 'u'];

// Phonics word bank: [word, emoji]. The first block is spellable with phase 2 letters alone, which is what
// Reception stage 1 draws from (#14) — it is listed first only for reading; nothing depends on the order.
//
// EVERY ENTRY MUST BE EXACTLY THREE LETTERS, and a rail in tests/unit/curriculum.test.ts holds it there.
// `rLetterSound` addresses the sounds by fixed index — 2 for the final sound, 1 for the medial — so a
// four-letter word here does not merely read oddly, it ships a WRONG ANSWER: `frog` at difficulty 2 asks
// "which sound does frog end with?", shows `fr_g` and marks `o` correct. Exported for that rail alone.
// Also used by Year 1's `y1-trace` (d3).
export const CVC: [string, string][] = [['cat', '🐱'], ['dog', '🐶'], ['sun', '☀️'], ['pig', '🐷'], ['cup', '☕'], ['pen', '🖊️'], ['egg', '🥚'], ['map', '🗺️'], ['mug', '🍺'], ['net', '🥅'], ['tap', '🚰'], ['pot', '🍲'], ['pin', '📌'], ['rug', '🧶'], ['nut', '🥜'], ['cap', '🧢'], ['rat', '🐀'], ['pan', '🍳'],
  ['bus', '🚌'], ['hat', '🎩'], ['bed', '🛏️'], ['fox', '🦊'], ['bag', '👜'], ['hen', '🐔'], ['box', '📦'], ['jam', '🍯'], ['bat', '🦇'], ['web', '🕸️'], ['cow', '🐮'], ['leg', '🦵'], ['bug', '🐛'], ['van', '🚐'], ['zip', '🤐'], ['log', '🪵']];
/** Digraphs Reception's `finalIsGenuine` checks a word's last two letters against, and Year 1's `y1-digraphs` gaps. */
export const DIGRAPHS = ['sh', 'ch', 'th', 'ng', 'ai', 'oa', 'oo', 'ee', 'oi', 'ow', 'ar', 'or', 'wh', 'qu', 'ck'];

/**
 * Sound Hunt bank: [grapheme, phoneme family, where the sound sits in the words, keyword words].
 * Phase 2/3 (Reception) and phase 5 (Year 1) follow the Letters and Sounds / Little Wandle order.
 * The phoneme family keeps sound-alike graphemes (c/k, ai/ay/a-e, ee/ea …) out of each other's bubbles: by ear they are the same sound.
 */
export type Sound = [string, string, 'start' | 'middle' | 'end', string[]];
export const PHASE2: Sound[] = [
  ['s', 's', 'start', ['sun', 'sock', 'sad', 'sit']], ['a', 'a', 'start', ['apple', 'ant', 'add', 'axe']], ['t', 't', 'start', ['tap', 'tin', 'top', 'ten']], ['p', 'p', 'start', ['pan', 'pig', 'pen', 'pot']],
  ['i', 'i', 'start', ['ink', 'insect', 'igloo', 'it']], ['n', 'n', 'start', ['net', 'nap', 'nut', 'nod']], ['m', 'm', 'start', ['man', 'map', 'mud', 'mop']], ['d', 'd', 'start', ['dog', 'dig', 'dad', 'duck']],
  ['g', 'g', 'start', ['goat', 'gap', 'get', 'gum']], ['o', 'o', 'start', ['on', 'orange', 'octopus', 'off']], ['c', 'k', 'start', ['cat', 'cup', 'cot', 'can']], ['k', 'k', 'start', ['kit', 'kick', 'kid', 'king']],
  ['e', 'e', 'start', ['egg', 'elbow', 'end', 'elephant']], ['u', 'u', 'start', ['up', 'umbrella', 'under', 'us']], ['r', 'r', 'start', ['rat', 'run', 'red', 'rug']],
];
export const PHASE2B: Sound[] = [   // the remaining single-letter sounds (phase 2 set 5, phase 3 letters)
  ['h', 'h', 'start', ['hat', 'hen', 'hop', 'hug']], ['b', 'b', 'start', ['bat', 'bed', 'bus', 'big']], ['f', 'f', 'start', ['fan', 'fox', 'fin', 'fun']], ['l', 'l', 'start', ['leg', 'lip', 'log', 'lot']],
  ['j', 'j', 'start', ['jam', 'jet', 'jug', 'jog']], ['v', 'v', 'start', ['van', 'vet', 'vest', 'visit']], ['w', 'w', 'start', ['wet', 'web', 'win', 'wig']], ['x', 'ks', 'end', ['fox', 'box', 'six', 'mix']],
  ['y', 'y', 'start', ['yes', 'yak', 'yum', 'yell']], ['z', 'z', 'start', ['zip', 'zebra', 'zoo', 'zoom']], ['qu', 'kw', 'start', ['queen', 'quick', 'quilt', 'quiz']],
];
export const PHASE3: Sound[] = [
  ['ch', 'ch', 'start', ['chip', 'chop', 'chin', 'chick']], ['sh', 'sh', 'start', ['ship', 'shop', 'shell', 'shut']], ['th', 'th', 'start', ['thin', 'thick', 'think', 'thumb']], ['ng', 'ng', 'end', ['ring', 'king', 'song', 'long']],
  ['ai', 'ai', 'middle', ['rain', 'tail', 'paint', 'snail']], ['ee', 'ee', 'middle', ['feet', 'sheep', 'green', 'keep']], ['igh', 'igh', 'middle', ['night', 'light', 'fight', 'tight']], ['oa', 'oa', 'middle', ['boat', 'goat', 'coat', 'road']],
  ['oo', 'oo', 'middle', ['moon', 'spoon', 'food', 'boot']], ['ar', 'ar', 'middle', ['park', 'farm', 'card', 'dark']], ['or', 'or', 'middle', ['fork', 'corn', 'storm', 'sort']], ['ur', 'ur', 'middle', ['burn', 'turn', 'hurt', 'curl']],
  ['ow', 'ow', 'end', ['cow', 'how', 'now', 'wow']], ['oi', 'oi', 'middle', ['coin', 'boil', 'join', 'soil']], ['ear', 'ear', 'end', ['near', 'dear', 'fear', 'hear']], ['air', 'air', 'end', ['hair', 'fair', 'chair', 'pair']], ['er', 'ur', 'end', ['hammer', 'ladder', 'letter', 'dinner']],
];
export const PHASE5: Sound[] = [
  ['ay', 'ai', 'end', ['day', 'play', 'say', 'tray']], ['ou', 'ow', 'middle', ['out', 'cloud', 'shout', 'loud']], ['ie', 'igh', 'end', ['pie', 'tie', 'lie', 'die']], ['ea', 'ee', 'middle', ['leaf', 'beach', 'meat', 'seat']],
  ['oy', 'oi', 'end', ['boy', 'toy', 'joy', 'enjoy']], ['ir', 'ur', 'middle', ['girl', 'bird', 'shirt', 'dirt']], ['ue', 'oo', 'end', ['blue', 'glue', 'clue', 'true']], ['aw', 'or', 'end', ['saw', 'paw', 'claw', 'draw']],
  ['wh', 'w', 'start', ['when', 'whale', 'wheel', 'whisk']], ['ph', 'f', 'start', ['phone', 'photo', 'phonics', 'phrase']], ['ew', 'oo', 'end', ['new', 'chew', 'few', 'grew']], ['oe', 'oa', 'end', ['toe', 'hoe', 'tiptoe', 'doe']], ['au', 'or', 'start', ['autumn', 'August', 'author', 'auburn']],
];
export const SPLIT: Sound[] = [   // split digraphs (phase 5)
  ['a-e', 'ai', 'middle', ['cake', 'make', 'lake', 'gate']], ['i-e', 'igh', 'middle', ['bike', 'kite', 'time', 'line']], ['o-e', 'oa', 'middle', ['bone', 'home', 'nose', 'rope']], ['u-e', 'oo', 'middle', ['cube', 'tube', 'June', 'flute']],
];
/** Sound Hunt: three keyword words are spoken (never shown); slice the grapheme for the sound they share. Reception, Year 1. */
export function soundQ(rng: Rng, pool: Sound[], distractPool: Sound[], decoys: number): Question {
  const [g, ph, pos, words] = pick(rng, pool);
  const ws = shuffle(rng, words).slice(0, 3);
  const ds = shuffle(rng, distractPool.filter(s => s[1] !== ph)).slice(0, decoys).map(s => s[0]);
  const where = pos === 'start' ? 'start with' : pos === 'end' ? 'end with' : 'have in the middle';
  return wordQ(rng, '🔊 Listen!', g, ds, { say: `Listen: ${ws.join(', ')}. Which sound do they ${where}?`, listen: ws.join(' · '), hint: `Slice the sound at the ${pos}`, hintIsData: false });
}

export const Y1_CEW = ['the', 'a', 'do', 'to', 'today', 'of', 'said', 'says', 'are', 'were', 'was', 'is', 'his', 'has', 'you', 'your', 'they', 'be', 'he', 'me', 'she', 'we', 'no', 'go', 'so', 'by', 'my', 'here', 'there', 'where', 'love', 'come', 'some', 'one', 'once', 'ask', 'friend', 'school', 'put', 'push', 'pull', 'full', 'house', 'our'];
export const Y2_CEW = ['door', 'floor', 'poor', 'because', 'find', 'kind', 'mind', 'behind', 'child', 'children', 'wild', 'climb', 'most', 'only', 'both', 'old', 'cold', 'gold', 'hold', 'told', 'every', 'everybody', 'even', 'great', 'break', 'steak', 'pretty', 'beautiful', 'after', 'fast', 'last', 'past', 'father', 'class', 'grass', 'pass', 'plant', 'path', 'bath', 'hour', 'move', 'prove', 'improve', 'sure', 'sugar', 'eye', 'could', 'should', 'would', 'who', 'whole', 'any', 'many', 'clothes', 'busy', 'people', 'water', 'again', 'half', 'money', 'parents'];
/** Days of the week. Year 1's `y1-days`/`y1-months` and part of the shared `GAP_WORDS` set below. */
export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/**
 * The words a gap in a list word can spell, so that none of them is offered as a decoy (#296). Mostly everyday
 * words a KS1 child meets that are not on either exception-word list — the rhyme families the lists sit in
 * (`_old` is bold, fold and sold as well as cold, gold, hold, told) and the short words a single letter turns
 * one list word into (`p_t`, `_ull`, `h_s`). The last batch is wider than that: a decoy is a second right
 * answer whenever it spells *any* real word, not only one the child has been taught, so the sweep of every
 * drawable gap (review of PR #303) put its remaining hits here too, KS1 vocabulary or not. Exported and
 * asserted duplicate-free below (#646); read by `gapLetters` otherwise.
 */
export const EVERYDAY: readonly string[] = ['I', 'it', 'in', 'if', 'is', 'as', 'at', 'an', 'am', 'on', 'or', 'ox', 'up', 'us', 'we', 'he', 'me', 'be', 'hi', 'my', 'by', 'oh', 'ah',
  'the', 'and', 'but', 'not', 'for', 'get', 'got', 'had', 'ham', 'hat', 'hay', 'him', 'hit', 'hop', 'hot', 'how', 'hug', 'hut', 'her', 'hen', 'hid', 'sad', 'sat', 'set', 'sit', 'sun', 'sum', 'saw', 'say', 'sea', 'see', 'sew', 'six', 'sky', 'shy', 'she', 'try', 'toy', 'top', 'tap', 'ten', 'tea', 'too', 'two', 'now', 'new', 'net', 'nut', 'nod', 'nap', 'gas', 'was', 'wax', 'win', 'wet', 'web', 'wig', 'why', 'way', 'wow', 'yes', 'yet', 'you', 'yak', 'zip', 'zoo',
  'bad', 'bag', 'bat', 'bed', 'bee', 'beg', 'bet', 'big', 'bin', 'bit', 'box', 'boy', 'bud', 'bug', 'bun', 'bus', 'bye', 'cab', 'can', 'cap', 'car', 'cat', 'cod', 'cog', 'cot', 'cow', 'cry', 'cub', 'cup', 'cut', 'dad', 'day', 'den', 'did', 'dig', 'dim', 'dip', 'dog', 'dot', 'dry', 'dug', 'ear', 'eat', 'egg', 'elf', 'end', 'eye', 'fan', 'far', 'fat', 'fed', 'fig', 'fin', 'fit', 'fix', 'fly', 'fog', 'fox', 'fun', 'fur', 'gap', 'god', 'gum', 'gun', 'gut', 'guy', 'gym',
  'jam', 'jar', 'jet', 'jog', 'joy', 'jug', 'key', 'kid', 'kit', 'lap', 'law', 'lay', 'led', 'leg', 'let', 'lid', 'lip', 'lit', 'log', 'low', 'mad', 'man', 'map', 'mat', 'may', 'men', 'met', 'mix', 'mop', 'mud', 'mug', 'mum', 'oil', 'old', 'one', 'our', 'out', 'owl', 'own', 'pad', 'pan', 'pat', 'paw', 'pay', 'pea', 'peg', 'pen', 'pet', 'pie', 'pig', 'pin', 'pit', 'pop', 'pot', 'pub', 'pup', 'put', 'rag', 'ran', 'rat', 'raw', 'red', 'rib', 'rid', 'rim', 'rip', 'rob', 'rod', 'rot', 'row', 'rub', 'rug', 'run', 'van', 'vet',
  'ace', 'add', 'age', 'ago', 'aid', 'aim', 'air', 'ant', 'ape', 'arm', 'art', 'ash', 'ask', 'ate', 'axe', 'ill', 'ink', 'inn', 'its', 'ice', 'odd', 'off', 'all',
  'bull', 'dull', 'full', 'gull', 'hull', 'pull', 'bold', 'fold', 'sold', 'bill', 'fill', 'hill', 'mill', 'pill', 'till', 'will', 'ball', 'call', 'fall', 'hall', 'tall', 'wall', 'bell', 'fell', 'sell', 'tell', 'well', 'yell', 'doll', 'poll', 'roll', 'toll', 'bush', 'hush', 'rush', 'push', 'posh', 'dish', 'fish', 'wish', 'cash', 'dash', 'rash', 'wash', 'bash', 'mash',
  'came', 'game', 'name', 'same', 'tame', 'home', 'dome', 'bone', 'cone', 'tone', 'zone', 'done', 'none', 'gone', 'live', 'give', 'dive', 'five', 'hive', 'hire', 'fire', 'wire', 'wore', 'more', 'sore', 'tore', 'bore', 'core', 'mere', 'here', 'sail', 'said', 'paid', 'maid', 'raid', 'laid', 'main', 'pain', 'rain', 'gain',
  'mouse', 'louse', 'horse', 'hoard', 'board', 'ward', 'word', 'cord', 'ford', 'bind', 'wind', 'mild', 'mind', 'kind', 'find', 'wild', 'child', 'most', 'post', 'host', 'cost', 'lost', 'both', 'moth', 'bath', 'path', 'past', 'fast', 'last', 'mast', 'vast', 'east', 'best', 'nest', 'rest', 'test', 'vest', 'west', 'pest', 'grass', 'glass', 'class', 'brass', 'pass', 'mass', 'bass', 'lass', 'plant', 'slant', 'grant', 'chant',
  'seat', 'meat', 'heat', 'beat', 'neat', 'peat', 'feat', 'great', 'greet', 'treat', 'steam', 'stead', 'steal', 'break', 'bread', 'breed', 'dear', 'hear', 'near', 'fear', 'gear', 'tear', 'wear', 'year', 'bear', 'pear', 'move', 'prove', 'grove', 'drove', 'stove', 'hour', 'sour', 'tour', 'four', 'pour', 'your', 'hole', 'pole', 'mole', 'role', 'sole', 'whole', 'poor', 'door', 'moor', 'floor', 'flour', 'penny', 'funny', 'sunny', 'bunny', 'money', 'honey', 'many', 'any', 'busy', 'easy', 'even', 'ever', 'oven', 'over', 'open', 'only', 'ugly', 'holy', 'tidy', 'lady', 'baby', 'body', 'copy', 'city', 'pity', 'duty', 'tiny',
  'talk', 'walk', 'chalk', 'stalk', 'told', 'hold', 'gold', 'golf', 'cold', 'colt', 'hurt', 'hurl', 'curl', 'girl', 'fool', 'tool', 'pool', 'cool', 'wool', 'half', 'calf', 'hail', 'pale', 'sale', 'tale', 'male', 'gale', 'kale', 'bake', 'cake', 'lake', 'make', 'rake', 'take', 'wake', 'like', 'bike', 'hike', 'pike', 'time', 'lime', 'mime', 'ride', 'hide', 'side', 'tide', 'wide', 'wipe', 'ripe', 'pipe', 'rope', 'hope', 'cope', 'nope', 'note', 'vote', 'tote', 'rote', 'cute', 'mute', 'tube', 'cube',
  'these', 'those', 'where', 'there', 'their', 'while', 'white', 'write', 'right', 'light', 'night', 'sight', 'tight', 'fight', 'might', 'could', 'would', 'should', 'mould', 'sugar', 'super', 'sure', 'pure', 'cure', 'lure', 'water', 'later', 'again', 'people', 'parent', 'father', 'rather', 'gather', 'lather', 'mother', 'other', 'bother', 'brother', 'after', 'often', 'every', 'eyes', 'weeks', 'clothes', 'cloth', 'children', 'climb', 'crime', 'prime', 'improve',
  // Added for review of PR #303: the list words' own neighbours (them/then, days/ways/pays, king, good …) and a wider batch.
  'them', 'then', 'days', 'ways', 'pays', 'king', 'good', 'fine', 'mine', 'must', 'held', 'hood', 'toad', 'list', 'war', 'comb', 'dove', 'bays', 'rays', 'lays', 'wag', 'lose', 'hare', 'hero', 'herd', 'tie', 'hip', 'ark', 'mint', 'mist', 'flood', 'fist', 'bury', 'halt', 'than', 'that', 'this', 'thin', 'they', 'tray', 'stay', 'play', 'pray', 'sway', 'away', 'jays', 'dust', 'just', 'rust', 'food', 'mood', 'wood', 'hoof', 'roof', 'boot', 'foot', 'root', 'hoot', 'loot', 'soot', 'toot', 'road', 'load', 'warm', 'warn', 'come', 'code', 'cove', 'love', 'loud', 'tub', 'are', 'ale', 'his', 'has', 'hum', 'hey', 'yam', 'ode', 'ore', 'owe', 'once', 'aunt', 'pun', 'pug', 'pall', 'pile', 'fuel', 'furl', 'foal', 'foul', 'fowl', 'house', 'hose', 'doors', 'fork', 'form', 'kilt', 'mile', 'milk', 'miss', 'wile', 'wine', 'wing', 'wink', 'wise', 'with', 'chill', 'chips', 'chime', 'clash', 'moss', 'mode', 'oily', 'bosh', 'bots', 'boss', 'corn', 'cosy', 'goat', 'goal', 'gods', 'hoop', 'tolls', 'event', 'eve', 'grate', 'grade', 'grape', 'beak', 'brake', 'steak', 'stack', 'steep', 'steer', 'stem', 'step', 'pretty', 'petty', 'party', 'beautiful', 'alter', 'fact', 'part', 'pats', 'bats', 'baths', 'hours', 'soar', 'dye', 'cloud', 'who', 'whom', 'whale', 'mean', 'hate', 'have', 'monkey', 'parents', 'present', 'pardon', 'tin', 'toe', 'tip', 'tug', 'hog', 'lot', 'tow', 'ton', 'tot', 'hub', 'arc', 'lord', 'hind', 'lots', 'asp', 'cast', 'file', 'fort', 'mice', 'hone',
  // From a sweep of every residual candidate on the review head: the real words left (sand, world, speak, plait …).
  // `puss` and `poop` were in this batch until the review of #324: both are crudities, so they belong in
  // `AVOID` below, not here. They were blocking their stems already, but as words rather than as spellings.
  'skid', 'slid', 'sand', 'sags', 'awe', 'ware', 'herb', 'hers', 'gush', 'lush', 'mush', 'lull', 'pulp', 'oar', 'doom', 'fund', 'fond', 'mend', 'mink', 'weld', 'moat', 'cola', 'creak', 'sneak', 'speak', 'lash', 'pant', 'claws', 'grams', 'grabs', 'grasp', 'pads', 'pals', 'pans', 'paws', 'plait', 'plane', 'plank', 'plans', 'surf', 'ewe', 'world', 'wound', 'whose', 'mane', 'halo',
  // Second review of PR #303: the systematic hole was the list words' own plurals and `-er`/`-ed` forms
  // (`cla_s` offered `p` for claps, `fin_` offered `s` for fins), so this batch is the full sweep of every
  // drawable gap rather than another guess at which families were missed.
  'claps', 'clams', 'clans', 'clasp', 'clays', 'clothed', 'fins', 'fink', 'grans', 'gross', 'groat', 'fatter', 'bather', 'hays', 'mays', 'saws', 'sans', 'sass', 'theme', 'thee', 'eves', 'aye', 'tee', 'lest', 'mosh',
  'wafer', 'wager', 'wader', 'waver', 'wad', 'wan', 'wilt', 'wily', 'woo', 'wove', 'cater', 'eater', 'hater', 'patents', 'probe', 'prone', 'prose', 'freak', 'bream', 'bust', 'buss', 'buoy', 'bate', 'pate', 'rind', 'lobe', 'lone', 'lope', 'mini', 'mins', 'kink', 'kine', 'kins',
  'moot', 'mope', 'mote', 'rouse', 'douse', 'souse', 'holt', 'aster', 'clime', 'dour', 'bur', 'boor', 'cole', 'cote', 'coney', 'evert'];
/**
 * The words a spelling gap is checked against: both exception-word lists, the days, the CVC bank and the
 * everyday words above (#296). Exported for the rail that walks every word and index in both lists.
 */
export const GAP_WORDS: ReadonlySet<string> = new Set([...Y1_CEW, ...Y2_CEW, ...DAYS, ...CVC.map(([w]) => w), ...EVERYDAY].map(w => w.toLowerCase()));
/**
 * **Reachable and deliberately left** (#418 asks for this stated rather than assumed, the way the comment
 * above `gapLetters` records `hag`, `cur` and `rut`). These are spellings a gap card can show and that two
 * sweeps have now considered and kept:
 *
 *   `pee`, `wee` — ordinary Reception vocabulary; blocking them is the filter reaching past its subject.
 *   `bog`, `nog`, `sus` — ordinary words a KS1 child reads as the marsh, the drink and the adjective.
 *   `pis`, `hoor`, `ho`, `hos`, `pish`, `ars` — non-words, and none an exact homophone of an `AVOID` member,
 *   which is the line `hore` and `cok` are on the other side of. `ho` in particular cannot be closed without
 *   a rule that reads oddly for Reception (`do`, `to`, `no`, `go`, `so`, `he` all reach it).
 *   `fux` — the fifth sweep's other find (#443), on `f_x`. A leetspeak rendering of a swear word rather than
 *   a spelling; `hore` and `cok`'s exact-homophone rule does not reach it, because nothing in `AVOID` is
 *   spelt `fux`.
 *   `les` — the fifth sweep's third find, on `le_`. An ordinary name, the way `ho` is an ordinary word.
 *
 * The point of writing them down is that the next sweep reads which were decided instead of re-finding them
 * by eye. Not the whole residue — only what a sweep has found and judged; #643 is the oracle that measures it.
 */
export const AVOID: ReadonlySet<string> = new Set(['whore', 'piss', 'fart', 'ass', 'arse', 'shit', 'crap', 'cock', 'dick',
  // Second review of PR #303: `poo_` offered `f`. A slur, a crudity or an insult is filtered here rather than
  // added to the lists above, so that `GAP_WORDS` stays a list of words the game is happy to *show*.
  'poof', 'gays', 'lust', 'pus', 'tush', 'coke', 'yob',
  // #324 item 1: that round closed `f` on `poo_` and checked no other letter on the same stem, so `poon` — a
  // sexual slur — was still on a Year 2 child's bubbles two rounds after a review had gone hunting for it.
  // `poos`/`pooh` move here from `EVERYDAY` under the rule above; they were blocked, but as words rather than
  // as spellings a card may not show.
  'poon', 'poot', 'pood', 'poos', 'pooh', 'paps', 'pud',
  // Review of #324: `poop` and `puss` were still in `EVERYDAY`, so the two stems the audit had just closed were
  // each one curriculum prune away from reopening. Moved here so `poo_` is uniform and `pu__`/`p_ss` are pinned.
  'poop', 'puss',
  // #418: `r-sounds` passed its letter pool to `gapQ` raw, so Reception — ages 4 and 5 — was the one island
  // no `AVOID` entry reached. `cu_` offered `m`, `ja_` offered `p`. Filtering moved into `gapQ` in the same
  // change; these are the spellings that sweep found and that a card must not show whichever generator built
  // it. `poo` and `pap` are the `poo_`/`paps` standards one letter shorter — #324 closed those and this stem
  // was reachable the whole time.
  'cum', 'jap', 'vag', 'poo', 'bum', 'pap',
  // #419: `p_ove` offered `o` on a Year 2 card two reviews after a sweep reported the family clean, and
  // `h_re` offered `o` on a Year 1 one. `hore` is not a dictionary word and is here anyway, which is the
  // rule `pud` and `paps` already follow: what is blocked is the spelling a card can **show**, not an entry
  // in a dictionary — and it is an exact homophone of this set's first member.
  'poove', 'hore',
  // #416: `poo_` (from `poor`) still offered `v`, spelling `poov` — the clipped form of the slur `poove`
  // above. Found by driving the real generator 300,000 times rather than re-reading the stem: `poove` had
  // already been closed by #419, but `poov` sits on the same stem one letter short, the same way `poon`
  // sat one letter past `poof` in #324 item 1.
  'poov',
  // Review of #418: four more, found by driving the registry rather than by re-reading the list — which is
  // the whole lesson. `cun` is on `cu_`, the same three letters as the `cum` above it: the stem was audited
  // and the audit stopped one letter short, exactly as #324 did on `poo_`. `cok`/`coc` follow the `hore`
  // rule — an exact homophone of a member of this set (`cock`), blocked for what a card would show.
  'nig', 'pak', 'hun', 'cun', 'cok', 'coc',
  // #443: `le_` offered `z` on a Reception card, and the fifth sweep is what found it — the fourth
  // (#418/#419) had already closed `cu_` and `ja_` without reaching this stem. A slur, by the same rule
  // `poon` and `hore` are here under.
  'lez']);
export function gapLetters(word: string, idx: number): string[] {
  const lower = word.toLowerCase();
  return LETTERS.filter(l => { const w = lower.slice(0, idx) + l + lower.slice(idx + 1); return l !== lower[idx] && !GAP_WORDS.has(w) && !AVOID.has(w); });
}

/**
 * The letters a gap card may really offer: the pool, less the answer, less any letter that would spell an
 * `AVOID` word in this gap (#418).
 *
 * **Here rather than at the call sites.** `gapLetters` filters `AVOID` too, but only three of the six `gapQ`
 * call sites go through it: `rLetterSound` passes `rLetters(d)` and `VOWELS` raw, so every rail #296, #303 and
 * #324 built was blind to Reception's cards and `cu_` offered `m`. Filtering where the card is built covers
 * all six and every future one, and makes the unscoped sentence above `AVOID` true instead of narrowing it.
 * **Pool depth is a constraint on exactly one frame.** `gapQ` needs 3. The start- and end-sound cards pass 13
 * to 23 letters and the `gapLetters` sites 15, but the middle-sound card passes `VOWELS` — **5** — so it has
 * 4 after the answer is removed and 3 once one is blocked. `hen` is there now: `h_n` loses `u` to `hun`, and
 * has no spare. An earlier version of this comment said the thinnest pool was 15, which was false of the one
 * card it mattered for (review of #418). `gapQ` throws below 3 rather than quietly shipping a 3-option card,
 * and `tests/unit/curriculum.test.ts` measures the floor at index 1 as well as 0 and 2.
 *
 * `idx` outside the word is a caller bug, not a card: the filter would test a spelling no card can show, so
 * it throws rather than silently passing the pool through. A pool entry longer than one character is the
 * same class of bug — it would compose a spelling one character longer than the card shows and consult
 * `AVOID` about something no card can produce — so that throws too, rather than passing unfiltered (#445).
 *
 * Deduped (#445): every live pool is distinct today, so this changes nothing a card shows, but `gapQ`'s
 * `decoys.length < 3` floor counts entries **before** `wordQ` dedupes its own final three, so a pool with a
 * repeat would otherwise pass a floor that no longer describes what actually reaches the card.
 */
export const gapDecoys = (word: string, idx: number, pool: string[]): string[] => {
  const lower = word.toLowerCase();
  if (idx < 0 || idx >= lower.length) throw new RangeError(`gap index ${idx} is outside "${word}"`);
  if (pool.some(l => l.length !== 1)) throw new RangeError(`gapDecoys pool for "${word}" has a non-single-character entry`);
  const ans = lower[idx];
  return [...new Set(pool.filter(l => l.toLowerCase() !== ans
    && !AVOID.has(lower.slice(0, idx) + l.toLowerCase() + lower.slice(idx + 1))))];
};

/** Missing-letter question: show word with a gap, options are letters. Reception, Year 1, Year 2. */
export function gapQ(rng: Rng, word: string, idx: number, distractPool: string[], emoji?: string, say?: string): Question {
  const ans = word[idx];
  const shown = word.slice(0, idx) + '_' + word.slice(idx + 1);
  const decoys = gapDecoys(word, idx, distractPool);
  // A card with two decoys takes the child's guess from 1-in-4 to 1-in-3 and says nothing. The middle-sound
  // frame has no spare (see `gapDecoys`), so this is one blocked letter away rather than hypothetical.
  if (decoys.length < 3) throw new RangeError(`"${word}" gap ${idx} leaves only ${decoys.length} decoys`);
  const ds = shuffle(rng, decoys).slice(0, 3);
  return wordQ(rng, shown, ans, ds, { visual: { type: 'word', text: shown, emoji }, say: say ?? `Which letter is missing from ${word}?`, hint: 'Slice the missing letter', hintIsData: false });
}

/** Spelling by slicing letters in order (sequence question). Reception, Year 1, Year 2. */
// `from` is the letter pool the decoys are drawn from (#14). It defaults to the whole alphabet, which is
// right for Year 1/2 spelling; Reception passes its phase pool, because a decoy the child has not been
// taught is the same fault as an answer they have not been taught.
export function spellQ(rng: Rng, word: string, hintEmoji?: string, decoys = 3, from: string[] = LETTERS): Question {
  const letters = word.split('');
  const pool = from.filter(l => !letters.includes(l));
  const uniq = [...new Set(letters)];
  // A repeated letter shrinks `uniq` below `letters.length`, and that used to shrink the total tile count
  // with it: "egg" (e, g, g — two unique letters) dealt two fewer tiles than a same-length word with none
  // repeated, so the tile count alone gave the answer away every time it was drawn (#481 — the same shape
  // as #369 one channel over: there it was bubble size, here it is bubble count). Topping the decoy count
  // up by the letters lost to repetition keeps the total (word length + decoys) the same for every word at
  // a difficulty, whatever it repeats.
  const repeated = letters.length - uniq.length;
  const need = Math.max(1, Math.min(decoys + repeated, 10 - uniq.length));
  const ds = shuffle(rng, pool).slice(0, need);
  return { prompt: hintEmoji ? `${hintEmoji}  Spell it!` : `Spell: ${word}`, say: `Spell the word ${word}`, answer: word, sequence: letters, options: shuffle(rng, [...uniq, ...ds]), visual: { type: 'word', text: word.replace(/./g, '_ ').trim(), emoji: hintEmoji }, hint: 'Slice the letters in order', hintIsData: false, listen: word };
}

/**
 * Story Sentences: slice the words in order to build a sentence (sequence question with word bubbles).
 * `show` = the sentence is printed on the card (reading + word order); otherwise only spoken (listen, remember, build).
 * Reception, Year 1, Year 2.
 */
export function sentenceQ(rng: Rng, sentence: string, emoji: string, decoyPool: string[], decoys: number, show: boolean): Question {
  const words = sentence.split(' ');
  const bare = (w: string) => w.toLowerCase().replace(/[.!?,]/g, '');
  const used = new Set(words.map(bare));
  const ds = shuffle(rng, decoyPool.filter(w => !used.has(bare(w)))).slice(0, Math.min(decoys, 10 - words.length));
  return { prompt: 'Build the sentence', say: `Build the sentence: ${sentence}`, answer: sentence, sequence: words, options: shuffle(rng, [...words, ...ds]), wide: true,
    visual: show ? { type: 'sentence', text: sentence } : { type: 'word', text: emoji }, hint: show ? 'Slice the words in order' : 'Listen, then slice the words in order', hintIsData: false,
    listen: show ? undefined : sentence, peek: !show };
}
export type Sent = [string, string];   // [sentence, picture]
export const sentGen = (banks: Sent[][], decoyPool: string[], decoys: [number, number, number], showUntil: number): Generator => (d, rng) => {
  const [s, e] = pick(rng, banks[d - 1]);
  return sentenceQ(rng, s, e, decoyPool, decoys[d - 1], d <= showUntil);
};

/** Fix the Sentence's punctuation bank — Year 1's capital-letter/full-stop-question-mark-exclamation cards and Year 2's. */
export const PUNCT_SENTS: [string, string][] = [['I like apples', '.'], ['Where is my hat', '?'], ['What a great day', '!'], ['The dog ran home', '.'], ['Can you jump high', '?'], ['We went to the park', '.'], ['Is it raining', '?'], ['Look at that', '!'], ['My cat is black', '.'], ['How old are you', '?'], ['Stop', '!'], ['Do you like pizza', '?']];
