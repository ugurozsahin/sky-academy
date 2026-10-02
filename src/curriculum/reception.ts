// Reception topics: EYFS Early Learning Goals (Number, Numerical Patterns, Literacy, Word Reading).
// #325 stage 4: the curriculum used to be split by subject (maths.ts/writing.ts); this file holds every
// Reception generator, maths and writing alike, so a reviewer checking "is Reception right" reads one file.
// Generators shared with Year 1/Year 2 live in util.ts (#325 stage 4).
import type { Generator, Rng, Topic } from './types';
import { rInitial } from './reception-initial';
import {
  ri, pick, shuffle, numQ, wordQ, OBJECTS,
  orderQ, balanceQ,
  gapQ, spellQ, soundQ, sentGen, type Sent,
  PHASE2, PHASE2B, PHASE3, VOWELS, LETTERS, CVC, DIGRAPHS,
} from './util';

// ---------- Reception maths ----------
const rCount: Generator = (d, rng) => {
  const max = d === 1 ? 5 : d === 2 ? 8 : 10;
  const n = ri(rng, 1, max);
  const emoji = pick(rng, OBJECTS);
  return numQ(rng, 'How many?', n, { min: 1, max, visual: { type: 'objects', emoji, n }, say: 'How many can you count?' });
};
const rSubitise: Generator = (d, rng) => {
  const n = ri(rng, 1, d === 1 ? 4 : d === 2 ? 5 : 6);
  return numQ(rng, 'How many dots?', n, { min: 1, max: 6, visual: { type: 'dots', n } });
};
const rOneMore: Generator = (d, rng) => {
  const n = ri(rng, d === 1 ? 1 : 0, d === 3 ? 19 : 9);
  const more = rng() < 0.5;
  const ans = more ? n + 1 : n - 1;
  if (ans < 0) return rOneMore(d, rng);
  return numQ(rng, `One ${more ? 'more' : 'less'} than ${n}?`, ans, { min: 0, max: 20, visual: d < 3 ? { type: 'tenframe', n } : undefined });
};
const rBonds: Generator = (d, rng) => {
  const total = d === 1 ? 5 : d === 2 ? pick(rng, [5, 6, 7, 8]) : 10;
  const a = ri(rng, 0, total);
  return numQ(rng, `${a} + ? = ${total}`, total - a, { min: 0, max: 10, visual: { type: 'tenframe', n: a }, say: `${a} and how many more make ${total}?` });
};
const rAdd: Generator = (d, rng) => {
  const max = d === 1 ? 5 : d === 2 ? 8 : 10;
  const a = ri(rng, 1, max - 1), b = ri(rng, 1, max - a);
  const e1 = pick(rng, OBJECTS);
  return numQ(rng, `${a} + ${b} = ?`, a + b, { min: 0, max: 10, visual: { type: 'objects', emoji: e1, n: a, n2: b, emoji2: e1 }, say: `${a} plus ${b}?` });
};
const rSub: Generator = (d, rng) => {
  const max = d === 1 ? 5 : d === 2 ? 8 : 10;
  const a = ri(rng, 2, max), b = ri(rng, 1, a);
  return numQ(rng, `${a} − ${b} = ?`, a - b, { min: 0, max: 10, visual: { type: 'objects', emoji: pick(rng, OBJECTS), n: a, n2: -b }, say: `${a} take away ${b}?` });
};
const rCompare: Generator = (d, rng) => {
  const max = d === 1 ? 5 : 10;
  // d3 (#891): the ELG asks for "greater than, less than OR THE SAME AS" — one card in three at d3 draws
  // equal groups, answered "=", so "the same" is actually practised rather than merely possible. "=" rides
  // every d3 card (not only the equal ones), so its presence never gives the answer away on its own.
  if (d === 3 && rng() < 1 / 3) {
    const a = ri(rng, 1, max);
    const near = a === max ? a - 1 : a + 1;
    const wantMore = rng() < 0.5;
    return wordQ(rng, `Which is ${wantMore ? 'more' : 'fewer'}?`, '=', [String(a), String(near)], {
      visual: { type: 'objects', emoji: '🍎', n: a, emoji2: '🍌', n2: a },
      say: `Which number is ${wantMore ? 'more' : 'fewer'}, ${a} or ${a}, or are they the same?`,
    });
  }
  let a = ri(rng, 1, max), b = ri(rng, 1, max);
  while (b === a) b = ri(rng, 1, max);
  const wantMore = rng() < 0.5;
  const ans = wantMore ? Math.max(a, b) : Math.min(a, b);
  const other = wantMore ? Math.min(a, b) : Math.max(a, b);
  const say = `Which number is ${wantMore ? 'more' : 'fewer'}, ${a} or ${b}${d === 3 ? ', or are they the same' : ''}?`;
  const visual = { type: 'objects' as const, emoji: '🍎', n: a, emoji2: '🍌', n2: b };
  return d === 3
    ? wordQ(rng, `Which is ${wantMore ? 'more' : 'fewer'}?`, String(ans), [String(other), '='], { visual, say })
    : numQ(rng, `Which is ${wantMore ? 'more' : 'fewer'}?`, ans, { distractors: [other], n: 1, visual, say });
};
const rCountOn: Generator = (d, rng) => {
  const start = ri(rng, 1, d === 3 ? 25 : d === 2 ? 15 : 8);
  return numQ(rng, `${start}, ${start + 1}, ${start + 2}, ?`, start + 3, { min: 0, max: 30, say: `What comes next? ${start}, ${start + 1}, ${start + 2}…` });
};
/**
 * Reception doubles (#299 slice 1). One ELG sentence covers this topic and the two below it: "explore and
 * represent patterns within numbers up to 10, including evens and odds, double facts and how quantities can
 * be distributed equally".
 *
 * "Within numbers up to 10" is the ceiling, so the largest double is 5 + 5 — this is *not* `y1-doubles`
 * (which goes to double 10 = 20) at a smaller range but the same fact family a year earlier. **There are
 * only five facts in the whole topic**, which is what shapes the ladder: d1 cannot be 1–3, because three
 * cards is below the suite's variety floor, so it is 1–4 and d2 adds the fifth. d3 cannot stretch by
 * widening either: it takes the top half of the same range, the shape #298 slice 5 settled on for
 * `y1-doubles`, and adds the inverse form ("double what makes 8?"), the halving half of the same ELG
 * sentence — which is also what keeps d3 varied where four doubles alone would not.
 *
 * The ten-frame carries both halves in two colours (`n2`), so the double is visible as a pattern rather
 * than a sum to work out; the inverse form drops it, because a frame already split into 4 + 4 answers
 * "double what makes 8?" before the child has thought about it.
 */
const rDoubles: Generator = (d, rng) => {
  const n = d === 1 ? ri(rng, 1, 4) : d === 2 ? ri(rng, 1, 5) : ri(rng, 2, 5);
  if (d === 3 && rng() < 0.5) return numQ(rng, `Double ? = ${n * 2}`, n, { min: 0, max: 10, say: `Double what makes ${n * 2}?` });
  return numQ(rng, `Double ${n} = ?`, n * 2, { min: 0, max: 10, visual: { type: 'tenframe', n, n2: n }, say: `What is double ${n}?` });
};
/**
 * Reception sharing (#299 slice 1) — "how quantities can be distributed equally", between two.
 *
 * Between *two* throughout, which is what the ELG's own examples and the issue ask for; sharing between
 * three or four is Year 2 division (`y2-tables`). So the difficulty ladder is the size of the quantity
 * alone: 2–6 to introduce, the 4/6/8/10 the issue names at the expectation, and the three largest as the
 * stretch. Totals are always even, because "equally between two" has no answer otherwise — the odd case is
 * `r-oddeven` below, where it is the whole question rather than an unanswerable card.
 *
 * The five-frame `objects` visual shows the quantity to be shared, not the shared-out result: a child works
 * the sharing out, and the total stays on the card as the most tempting wrong answer.
 */
const rShare: Generator = (d, rng) => {
  const total = d === 1 ? pick(rng, [2, 4, 6]) : d === 2 ? pick(rng, [4, 6, 8, 10]) : pick(rng, [6, 8, 10]);
  const emoji = pick(rng, OBJECTS);
  return numQ(rng, `Share ${total} between 2 — how many each?`, total / 2, { min: 0, max: 10, distractors: [total], visual: { type: 'objects', emoji, n: total }, say: `Share ${total} equally between two. How many does each one get?` });
};
/**
 * Reception odds and evens (#299 slice 1) — "evens and odds", by pairing rather than by the ×2 rule.
 *
 * A Reception child meets odd and even as "can everyone find a partner?", so d1–d2 ask exactly that and
 * answer `✅`/`❌` (#898 — a pre-reader cannot read `yes`/`no`); only d3 puts the words `odd`/`even` on the
 * bubbles, which is the vocabulary Year 2's `y2-oddeven` then assumes. Numbers stay ≤ 10 (≤ 6 at d1) per the
 * ELG's "within numbers up to 10".
 *
 * No new visual, per the slice: the `objects` five-frames show the quantity and the `hint` carries the
 * pairing ("put them in twos"). A frame that drew the pairs would answer the question in the picture.
 */
const rOddEven: Generator = (d, rng) => {
  const n = ri(rng, 1, d === 1 ? 6 : 10);
  const even = n % 2 === 0;
  const visual = { type: 'objects', emoji: pick(rng, OBJECTS), n } as const;
  if (d === 3) return wordQ(rng, `${n} — odd or even?`, even ? 'even' : 'odd', ['odd', 'even'], { visual, hint: 'Put them in twos', hintIsData: false, say: `Is ${n} odd or even?` });
  return wordQ(rng, 'Can they all find a partner?', even ? '✅' : '❌', ['✅', '❌'], { visual, hint: 'Put them in twos', hintIsData: false, say: `There are ${n}. Can they all find a partner?` });
};
const rOrder: Generator = (d, rng) => orderQ(rng, d === 1 ? 5 : 10, 3);
const rBalance: Generator = (d, rng) => {
  const emoji = pick(rng, OBJECTS);
  if (d < 3) {
    const n = ri(rng, 1, d === 1 ? 5 : 10);
    return balanceQ(rng, `${n}`, '?', n, 10, { pans: [emoji.repeat(n), '?'], say: `Count the objects. How many make the scales balance?` });
  }
  const a = ri(rng, 3, 10), b = ri(rng, 1, a - 1);
  return balanceQ(rng, `${a}`, `${b} + ?`, a - b, 10, { pans: [emoji.repeat(a), `${emoji.repeat(b)} + ?`], say: `${a} on the left, ${b} on the right. How many more make it balance?`, distractors: [a, b] });
};

// ---------- Reception writing ----------
/**
 * Reception letter pools, in the Little Wandle / Letters and Sounds order (#14).
 *
 * Derived from the Sound Hunt banks in `util.ts` rather than written out again, and that is the point: `PHASE2`
 * and `PHASE2B` are the single home of the phase order, so a letter moved between phases moves for every
 * Reception topic at once. Sound Hunt already walked the order; `r-sounds`, `r-build`, `r-capitals` and
 * `r-trace` drew from the whole alphabet at every difficulty, so stage 1 could ask a phase-2 child for `jam`
 * or offer `z` as a decoy — a ramp orthogonal to the one the child is actually being taught on.
 *
 * `qu` is dropped: these pools answer "which letter", and `qu` is two. That also means the full pool is 25
 * letters, not 26 — there is no bare `q` sound in English, and `PHASE2B` is right not to list one.
 */
const singles = (ss: typeof PHASE2) => ss.map(s => s[0]).filter(g => g.length === 1);
export const R_LETTERS_P2 = singles(PHASE2);                              // phase 2: the first fifteen
// Deduplicated at construction rather than only asserted in a test: a letter listed in two phases would skew
// every `pick` towards it, and this is where the nesting invariant already lives.
export const R_LETTERS_ALL = [...new Set([...R_LETTERS_P2, ...singles(PHASE2B)])];   // every single-letter sound
/**
 * The phase a Reception difficulty draws from. Deliberately nested (d1 ⊆ d2 = d3) rather than disjoint: a
 * child at stage 3 has not stopped knowing the phase-2 letters, and a pool that dropped them would make the
 * later stages *narrower*. The existing ramps — where the sound sits, how many decoys, upper case — are
 * unchanged and stack on top of this one.
 */
const rLetters = (d: 1 | 2 | 3) => (d === 1 ? R_LETTERS_P2 : R_LETTERS_ALL);
/** The CVC words spellable with the letters that difficulty has met. Answer and decoys both obey it. */
const rWords = (d: 1 | 2 | 3) => { const pool = rLetters(d); return CVC.filter(([w]) => [...w].every(c => pool.includes(c))); };
/**
 * #135: a word's middle letter is a genuine medial sound only when it is a vowel — `egg`'s middle is `g`, and
 * the question would show `e_g` against vowel decoys with `g` marked correct.
 */
export const medialIsGenuine = (w: string) => VOWELS.includes(w[1]);
/**
 * #135: a word's last letter is a genuine final sound unless it forms a digraph with the letter before it
 * (`cow` ends in `ow`, not `w` — `DIGRAPHS` already lists `ow` as one unit), or `PHASE2`/`PHASE2B` itself
 * documents that letter's end-position sound as a blend distinct from the letter (`x`, in phase 2B, is `ks`
 * at the end of `fox`/`box` — the only such entry). Mechanical, not a word list, so a future `CVC` addition
 * with the same shape is caught without touching this function.
 */
export const finalIsGenuine = (w: string) => {
  if (DIGRAPHS.includes(w.slice(-2))) return false;
  const entry = [...PHASE2, ...PHASE2B].find(([g]) => g === w[w.length - 1]);
  return !entry || entry[2] !== 'end' || entry[1] === entry[0];
};

const rSoundHunt: Generator = (d, rng) => d === 1 ? soundQ(rng, PHASE2, PHASE2, 2) : d === 2 ? soundQ(rng, [...PHASE2, ...PHASE2B], [...PHASE2, ...PHASE2B], 3) : soundQ(rng, PHASE3, PHASE3, 3);

// ---------- Reception (writing): letter sounds, capitals, spelling, tracing ----------
// The word and the decoys both come from the difficulty's phase pool (#14). The middle-sound question keeps
// VOWELS as its decoys, which needs no filtering: all five vowels are phase 2 set 1–4 letters already.
const rLetterSound: Generator = (d, rng) => {
  // #135: filtering by role, not deleting from CVC — `egg` keeps its (correct) place at d1, it is only kept
  // out of the d3 draw whose gap it would answer wrong.
  if (d === 1) { const [w, e] = pick(rng, rWords(d)); return gapQ(rng, w, 0, rLetters(d), e, `${w}. Which sound does ${w} start with?`); }
  if (d === 2) { const [w, e] = pick(rng, rWords(d).filter(([w]) => finalIsGenuine(w))); return gapQ(rng, w, 2, rLetters(d), e, `${w}. Which sound does ${w} end with?`); }
  const [w, e] = pick(rng, rWords(d).filter(([w]) => medialIsGenuine(w)));
  return gapQ(rng, w, 1, VOWELS, e, `${w}. Which sound is in the middle of ${w}?`);
};
const rCapitals: Generator = (d, rng) => {
  const l = pick(rng, rLetters(d));
  const upper = rng() < 0.5;
  const shown = upper ? l.toUpperCase() : l;
  const ans = upper ? l : l.toUpperCase();
  const ds = shuffle(rng, rLetters(d).filter(x => x !== l)).slice(0, d === 1 ? 2 : 3).map(x => (upper ? x : x.toUpperCase()));
  return wordQ(rng, shown, ans, ds, { visual: { type: 'word', text: shown }, say: `Find the ${upper ? 'small' : 'capital'} letter that matches ${l}`, hint: upper ? 'Find the lower-case letter' : 'Find the capital letter', hintIsData: false });
};
/**
 * Reception tricky words (#968) — the phase 2/3 exception words *Letters and Sounds* lists as read on sight
 * rather than sounded out. Spoken, never printed (`listen`/`peek: true`, the Story Sentences no-voice path):
 * the ELG asks for reading aloud, not spelling, so the word never sits on the card for the whole wave — no
 * `visual` either, which would print it regardless of `peek` (`renderVisual` is not gated by `promptMode`).
 *
 * The decoy pool is the difficulty's own phase pool; at d2–d3 at least one decoy shares a letter with the
 * answer (he/she/the, me/we/be), so the first sound alone cannot answer. `I` needs no special case: it shares
 * no letter with any other bank word, so it falls out of the general "no shared-letter partner" fallback below.
 */
export const R_TRICKY_P2 = ['the', 'to', 'I', 'no', 'go'];
export const R_TRICKY_P3 = ['he', 'she', 'we', 'me', 'be', 'was', 'my', 'you', 'her', 'they', 'all', 'are'];
const rTrickyPool = (d: 1 | 2 | 3) => (d === 1 ? R_TRICKY_P2 : d === 2 ? R_TRICKY_P3 : [...R_TRICKY_P2, ...R_TRICKY_P3]);
const shareLetter = (a: string, b: string) => [...a.toLowerCase()].some(c => b.toLowerCase().includes(c));
const rTrickyDecoys = (rng: Rng, pool: string[], w: string, d: 1 | 2 | 3): string[] => {
  const rest = pool.filter(x => x !== w);
  const count = d === 1 ? 2 : 3;
  const shared = d === 1 ? [] : shuffle(rng, rest.filter(x => shareLetter(x, w)));
  // A word with no shared-letter partner in its own pool (only "I", today) falls back to an unconstrained
  // draw rather than shipping `undefined` as a decoy — belt-and-braces alongside the pool invariant the test
  // file checks directly, so a future bank edit that breaks it degrades quietly instead of drawing a broken
  // bubble.
  if (shared.length === 0) return shuffle(rng, rest).slice(0, count);
  const others = shuffle(rng, rest.filter(x => x !== shared[0])).slice(0, count - 1);
  return shuffle(rng, [shared[0], ...others]);
};
const rTricky: Generator = (d, rng) => {
  const pool = rTrickyPool(d);
  const w = pick(rng, pool);
  const ds = rTrickyDecoys(rng, pool, w, d);
  return wordQ(rng, 'Find the word you hear', w, ds, { say: `Find the word: ${w}`, listen: w, peek: true });
};
const rBuild: Generator = (d, rng) => {
  const [w, e] = pick(rng, rWords(d));
  return spellQ(rng, w, e, d === 1 ? 2 : d === 2 ? 3 : 4, rLetters(d));
};
/**
 * #967: the ELG Word Reading goal itself — sound-blend a *written* word — so unlike every other Reception
 * writing topic here, the word is never spoken. `say` carries only the instruction; the word lives solely in
 * the `word` visual, so the 🔊 repeat (which speaks `q.say ?? q.prompt`, `play.ts:168`) never says it aloud.
 * d1/d2 decoys are drawn from any other word in the phase pool; d3 additionally forces one decoy to share
 * `w`'s first letter, so the first sound alone cannot answer — retried when the drawn word has no
 * same-first-letter sibling to draw that decoy from (`rat`/`sun`/`map`… each the only word for their letter).
 */
const rRead: Generator = (d, rng) => {
  const pool = rWords(d);
  const [w, e] = pick(rng, pool);
  const rest = pool.filter(([ow]) => ow !== w);
  let decoyWords: [string, string][];
  if (d === 3) {
    const sameFirst = rest.filter(([ow]) => ow[0] === w[0]);
    if (sameFirst.length === 0) return rRead(d, rng);
    const other = shuffle(rng, rest.filter(([ow]) => ow[0] !== w[0])).slice(0, 2);
    decoyWords = shuffle(rng, [pick(rng, sameFirst), ...other]);
  } else {
    const candidates = d === 1 ? rest.filter(([ow]) => ow[0] !== w[0]) : rest;
    decoyWords = shuffle(rng, candidates).slice(0, d === 1 ? 2 : 3);
  }
  return wordQ(rng, 'Read it!', e, decoyWords.map(([, em]) => em), { visual: { type: 'word', text: w }, say: 'Read the word. Slice its picture.' });
};
// Tracing is letter *formation*, so difficulty 3 keeps the whole alphabet — a child learns to write `q` and
// the handwriting ELG covers all 26, whatever phase the sound belongs to. Stages 1 and 2 still follow the
// phase order, so the letters a child traces first are the ones they are being taught to read first.
const rTrace: Generator = (d, rng) => {
  const l = pick(rng, d === 3 ? LETTERS : rLetters(d));
  const upper = d === 3 ? rng() < 0.5 : d === 2 ? rng() < 0.25 : false;
  const t = upper ? l.toUpperCase() : l;
  return { prompt: `Trace the letter ${t}`, say: `Trace the letter ${l}`, answer: t, options: [t], visual: { type: 'word', text: t } };
};

export const R_SENTS: Sent[][] = [
  [['I can run.', '🏃'], ['I can hop.', '🐰'], ['I like jam.', '🍯'], ['The cat sat.', '🐱'], ['The dog ran.', '🐶'], ['I see mum.', '👩'], ['We can jump.', '🤸'], ['It is hot.', '☀️'], ['The sun is up.', '🌅'], ['I am six.', '🎂']],
  [['I like my hat.', '🎩'], ['The pig is pink.', '🐷'], ['Dad has a van.', '🚐'], ['The fox can run.', '🦊'], ['We go to bed.', '🛏️'], ['Mum has a cup.', '🥤'], ['The bus is red.', '🚌'], ['I can see it.', '👀'], ['The hen has an egg.', '🐔'], ['My bag is big.', '👜']],
  [['The cat sat on a mat.', '🐱'], ['I can see a red bus.', '🚌'], ['The dog is in the sun.', '🐶'], ['We had jam on toast.', '🍞'], ['The fish can swim fast.', '🐟'], ['I put my hat on.', '🎩'], ['A frog sat on the log.', '🐸'], ['My cat is on the bed.', '🛏️'], ['Can you see the moon?', '🌙'], ['The big pig is in mud.', '🐷']],
];
const R_DECOYS = ['dog', 'cat', 'sun', 'hat', 'pig', 'run', 'big', 'red', 'mum', 'bed', 'jam', 'bus', 'hop', 'cup', 'fox', 'egg'];
const rSentence = sentGen(R_SENTS, R_DECOYS, [1, 1, 2], 3);          // Reception always reads the sentence

export const RECEPTION_TOPICS: Topic[] = [
  // Reception maths — EYFS Early Learning Goals: Number, Numerical Patterns
  { id: 'r-count', title: 'Count It', icon: '🍎', subject: 'maths', year: 'reception', nc: 'ELG Number: count objects to 10', gen: rCount },
  { id: 'r-subitise', title: 'Quick Dots', icon: '🎲', subject: 'maths', year: 'reception', nc: 'ELG Number: subitise to 5', gen: rSubitise },
  { id: 'r-compare', title: 'More or Fewer', icon: '⚖️', subject: 'maths', year: 'reception', nc: 'ELG Patterns: compare quantities', gen: rCompare },
  { id: 'r-onemore', title: 'One More, One Less', icon: '➕', subject: 'maths', year: 'reception', nc: 'ELG Number: composition to 10', gen: rOneMore },
  { id: 'r-bonds', title: 'Number Bonds', icon: '🔗', subject: 'maths', year: 'reception', nc: 'ELG Number: bonds to 5 and 10', gen: rBonds },
  { id: 'r-add', title: 'Adding', icon: '🧮', subject: 'maths', year: 'reception', nc: 'ELG Number: composition, addition to 10', gen: rAdd },
  { id: 'r-sub', title: 'Taking Away', icon: '✂️', subject: 'maths', year: 'reception', nc: 'ELG Number: subtraction facts', gen: rSub },
  { id: 'r-counton', title: 'What Comes Next?', icon: '🔢', subject: 'maths', year: 'reception', nc: 'ELG Patterns: count beyond 20', gen: rCountOn },
  { id: 'r-order', title: 'Order Up!', icon: '📶', subject: 'maths', year: 'reception', nc: 'ELG Patterns: compare and order to 10', sequenceFrom: 1, gen: rOrder },
  { id: 'r-balance', title: 'Balance the Scales', icon: '⚖️', subject: 'maths', year: 'reception', nc: 'ELG Number: composition, equal amounts', gen: rBalance },
  { id: 'r-doubles', title: 'Doubles', icon: '👯', subject: 'maths', year: 'reception', nc: 'ELG Patterns: double facts within 10', gen: rDoubles },
  { id: 'r-share', title: 'Share It Out', icon: '🤝', subject: 'maths', year: 'reception', nc: 'ELG Patterns: distribute equally between two', gen: rShare },
  { id: 'r-oddeven', title: 'Partners', icon: '🐾', subject: 'maths', year: 'reception', nc: 'ELG Patterns: evens and odds', gen: rOddEven },
  // Reception writing
  { id: 'r-sounds', title: 'Letter Sounds', icon: '🔊', subject: 'writing', year: 'reception', nc: 'ELG Writing: sounds to letters', gen: rLetterSound },
  { id: 'r-soundhunt', title: 'Sound Hunt', icon: '👂', subject: 'writing', year: 'reception', nc: 'ELG Word Reading: say a sound for each letter; phase 2–3 sounds by ear', gen: rSoundHunt },
  { id: 'r-capitals', title: 'Big & Small Letters', icon: '🅰️', subject: 'writing', year: 'reception', nc: 'ELG Word Reading: letters', gen: rCapitals },
  { id: 'r-tricky', title: 'Tricky Words', icon: '🧠', subject: 'writing', year: 'reception', nc: 'ELG Word Reading: common exception words', gen: rTricky },
  { id: 'r-build', title: 'Build a Word', icon: '🧱', subject: 'writing', year: 'reception', nc: 'ELG Writing: spell by sounds (CVC)', sequenceFrom: 1, gen: rBuild },
  { id: 'r-read', title: 'Read It!', icon: '📗', subject: 'writing', year: 'reception', nc: 'ELG Word Reading: read words by sound-blending', gen: rRead },
  { id: 'r-sentence', title: 'Story Sentences', icon: '📖', subject: 'writing', year: 'reception', nc: 'ELG Writing: simple sentences', sequenceFrom: 1, gen: rSentence },
  { id: 'r-trace', title: 'Trace Letters', icon: '✍️', subject: 'writing', year: 'reception', nc: 'ELG Writing: form letters', input: 'tracing', gen: rTrace },
  { id: 'r-initial', title: 'Starts Like', icon: '🔔', subject: 'writing', year: 'reception', nc: 'ELG Word Reading: words with the same initial sound (Development Matters)', sequenceFrom: 3, gen: rInitial },
];
