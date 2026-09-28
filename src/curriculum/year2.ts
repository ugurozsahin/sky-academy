// Year 2 topics: National Curriculum KS1, maths and English alike.
// #325 stage 4: the curriculum used to be split by subject (maths.ts/writing.ts); this file holds every
// Year 2 generator so a reviewer checking "is Year 2 right" reads one file. Generators shared with
// Reception/Year 1 live in util.ts.
import type { Difficulty, Generator, Question, Rng, Topic } from './types';
import {
  ri, pick, shuffle, numQ, wordQ, q, numberWord, coinLabel,
  SHAPES_3D,
  orderQ, lineQ, name3dQ, balanceQ, measureCompare, unitChoice, HOLDS, measureSum, unitQ,
  DIRS, ARROWS, TURNS_ALL, turnEnd,
  gapLetters, gapQ, spellQ, sentGen, type Sent,
  PUNCT_SENTS, Y1_CEW, Y2_CEW,
} from './util';

// ---------- Year 2 maths ----------
/**
 * Mark a question as taking several mental steps, so the bubbles fly one speed step slower (#297).
 *
 * The rule the code applies is **the d3 draws of `y2Add`, `y2Sub` and `y2Inverse` — all of them**, not only
 * the ones that cross a ten, which is how this was first written and is narrower than what ships: about
 * three in five d3 draws need no regrouping at all (59% `y2-add`, 58% `y2-sub` — a share fixed by the two
 * `ri(...)` ranges, so it can be re-derived without a seed: `45 + 44`, `78 − 62`, `99 − 34`). That is
 * #297's decision, not an oversight — a bubble speed that flickered question by question inside one stage
 * would read to a child as a glitch, so the whole of d3 eases. The sum stays as the year asks; only the
 * clock does.
 *
 * **It is opt-in per generator, not a property of Year 2 difficulty 3** — `tests/unit/curriculum.test.ts`
 * pins that ("no other topic sets slow"). `y2-length` d3 draws `50 cm − 29 cm`, two-digit and crossing a
 * ten, and flies at full speed. Set at d3 alone, which is why it is a flag on the question, not the topic.
 *
 * For one of the three it is a *stage* split rather than a difficulty one: `y2Inverse`'s `kind` never
 * reads `d`, and its d2 and d3 ranges coincide — 500/500 byte-identical prompts on the same seed (#311) —
 * so `70 − ? = 26` flies at speed 3 at stage 3 of a Year 2 mission and at speed 2 at stage 4. Harmless to
 * the child, stage 4 being the gentler one; giving `y2-inverse` a real d3 form is a curriculum change and
 * belongs in its own issue.
 */
const slowAtD3 = (d: Difficulty, question: Question): Question => d === 3 ? { ...question, slow: true } : question;

const y2PlaceValue: Generator = (d, rng) => {
  const n = ri(rng, 10, 99);
  const t = Math.floor(n / 10), o = n % 10;
  const kind = d === 1 ? 0 : ri(rng, 0, 2);
  if (kind === 0) return numQ(rng, `${n}: how many tens?`, t, { min: 0, max: 9, say: `In ${n}, how many tens?`, distractors: [o, t + 1, t - 1] });
  if (kind === 1) return numQ(rng, `${n}: how many ones?`, o, { min: 0, max: 9, say: `In ${n}, how many ones?`, distractors: [t, o + 1, o - 1] });
  return numQ(rng, `${t} tens and ${o} ones = ?`, n, { min: 10, max: 99, distractors: [t + o * 10, n + 10, n - 1] });
};
const y2Compare: Generator = (d, rng) => {
  const max = d === 1 ? 20 : 100;
  const a = ri(rng, 0, max), b = d === 3 && rng() < 0.2 ? a : ri(rng, 0, max);
  const ans = a < b ? '<' : a > b ? '>' : '=';
  return wordQ(rng, `${a} ? ${b}`, ans, ['<', '>', '='], { say: `${a} compared with ${b}. Less than, greater than, or equal?`, hint: 'Slice the correct sign', hintIsData: false });
};
const y2Add: Generator = (d, rng) => {
  let a: number, b: number;
  if (d === 1) { a = ri(rng, 10, 89); b = ri(rng, 1, 9); }          // 2-digit + ones
  else if (d === 2) { a = ri(rng, 10, 79); b = 10 * ri(rng, 1, 5); } // 2-digit + tens
  else { a = ri(rng, 10, 60); b = ri(rng, 10, 99 - a); }             // 2-digit + 2-digit
  if (a + b > 100) return y2Add(d, rng);
  const p = `${a} + ${b} = ?`;
  return slowAtD3(d, numQ(rng, p, a + b, { min: 0, max: 100, ...q(p) }));
};
const y2Sub: Generator = (d, rng) => {
  let a: number, b: number;
  if (d === 1) { a = ri(rng, 10, 99); b = ri(rng, 1, 9); }
  else if (d === 2) { a = ri(rng, 30, 99); b = 10 * ri(rng, 1, 2); }
  else { a = ri(rng, 30, 99); b = ri(rng, 10, a - 1); }
  const p = `${a} − ${b} = ?`;
  return slowAtD3(d, numQ(rng, p, a - b, { min: 0, max: 100, ...q(p) }));
};
const y2Three: Generator = (d, rng) => {
  const max = d === 1 ? 5 : 9;
  const a = ri(rng, 1, max), b = ri(rng, 1, max), c = ri(rng, 1, max);
  const p = `${a} + ${b} + ${c} = ?`;
  return numQ(rng, p, a + b + c, { min: 3, max: 27, ...q(p) });
};
const y2Tables: Generator = (d, rng) => {
  const table = d === 1 ? pick(rng, [2, 10]) : pick(rng, [2, 5, 10]);
  const n = ri(rng, 1, 12);
  const kind = d === 3 ? ri(rng, 0, 2) : d === 2 ? ri(rng, 0, 1) : 0;
  if (kind === 0) { const p = rng() < 0.5 ? `${n} × ${table} = ?` : `${table} × ${n} = ?`; return numQ(rng, p, n * table, { min: 0, max: 120, ...q(p), distractors: [n * table + table, n * table - table, n * table + 1] }); }
  if (kind === 1) { const p = `${n * table} ÷ ${table} = ?`; return numQ(rng, p, n, { min: 0, max: 12, ...q(p) }); }
  const p = `? × ${table} = ${n * table}`; return numQ(rng, p, n, { min: 0, max: 12, ...q(p) });
};
const y2OddEven: Generator = (d, rng) => {
  const n = ri(rng, 1, d === 1 ? 20 : 100);
  return wordQ(rng, `Is ${n} odd or even?`, n % 2 ? 'odd' : 'even', ['odd', 'even']);
};
const y2Inverse: Generator = (d, rng) => {
  const a = ri(rng, 10, d === 1 ? 30 : 99), b = ri(rng, 1, d === 1 ? 9 : Math.min(30, a - 1));
  const kind = ri(rng, 0, 2);
  const p = kind === 0 ? `? − ${b} = ${a - b}` : kind === 1 ? `${a - b} + ? = ${a}` : `${a} − ? = ${b}`;
  const ans = kind === 0 ? a : kind === 1 ? b : a - b;
  return slowAtD3(d, numQ(rng, p, ans, { min: 0, max: 100, ...q(p) }));
};
/** `a/b` written as text has the same value as num/den (cross-multiplied, so 2/4 and 1/2 are equal). */
const sameFraction = (text: string, num: number, den: number) => { const [a, b] = text.split('/').map(Number); return a * den === num * b; };
const y2Fractions: Generator = (d, rng) => {
  const fr = d === 1 ? pick(rng, [[1, 2], [1, 4]]) : d === 2 ? pick(rng, [[1, 2], [1, 3], [1, 4]]) : pick(rng, [[1, 3], [1, 4], [2, 4], [3, 4]]);
  const [num, den] = fr;
  if (rng() < 0.4) {
    const shaded = num, parts = den;
    // #296: a decoy is never worth the answer — 2/4 shaded is 1/2 too ("recognise the equivalence of 2/4 and
    // 1/2", Y2 programme of study), so the child who slices 1/2 was right. Compare by value, not by spelling.
    // `wordQ` keeps the first three, so the order is what reaches the card: `1/2` sits second so the natural
    // misconception is offered on the 1/4, 1/3 and 3/4 cards; for 1/2 and 2/4 it is filtered and the spare
    // decoy at the end takes its place.
    const ds = [`${den}/${num}`, '1/2', `${num}/${den + 1}`, `${den - num}/${den}`, `${num + 1}/${den}`].filter(x => !sameFraction(x, num, den));
    return wordQ(rng, 'What fraction is shaded?', `${num}/${den}`, ds, { visual: { type: 'fraction', parts, shaded }, say: 'What fraction of the shape is shaded?' });
  }
  const whole = den * ri(rng, 1, d === 3 ? 6 : 3);
  const ans = whole / den * num;
  return numQ(rng, `${num}/${den} of ${whole} = ?`, ans, { min: 0, max: 24, say: `What is ${num} ${den === 2 ? 'half' : den === 3 ? 'third' : 'quarter'}${num > 1 ? 's' : ''} of ${whole}?`, visual: { type: 'objects', emoji: '⭐', n: whole } });
};
const y2Money: Generator = (d, rng) => {
  if (d === 1) { const coins = Array.from({ length: 3 }, () => pick(rng, [2, 5, 10, 20, 50])); return unitQ(rng, coins.reduce((s, c) => s + c, 0), coins); }
  // £ and p recorded separately, never `£1.50` — decimal money is Year 4 (#298 slice 2). `coinLabel` is the
  // one source for the label, so the distractors are filtered as amounts before they are ever formatted.
  if (d === 2) { const coins = Array.from({ length: 2 }, () => pick(rng, [50, 100, 200])); const total = coins.reduce((s, c) => s + c, 0); const ds = [total + 50, total - 50, total + 100].filter(p => p > 0 && p !== total); return wordQ(rng, 'How much money?', coinLabel(total), ds.map(coinLabel), { visual: { type: 'coins', coins }, say: 'How much money altogether?' }); }
  const price = 5 * ri(rng, 1, 19);
  const change = 100 - price;
  // At exactly one price (50p), `price` as a decoy equals `change` (the answer) — wordQ's own de-dup then
  // drops it, one card in nineteen shipping three bubbles instead of four (#462 rail). `change + 15` is the
  // fourth candidate that takes its place: since `price` is always a multiple of 5, `change + k` (= 100 −
  // price + k) can only ever equal `price` when k is itself a multiple of 10 (an earlier `+10` draft missed
  // this — it collided with `price` at 55p too, silently saved only by wordQ's own dedup, with no margin
  // left). 15 is not a multiple of 10 and not ±5, so this candidate can never equal `price`, `change` or
  // either of the other two decoys, at any price in range.
  return wordQ(rng, `Change from £1 for ${price}p?`, `${change}p`, [`${change + 5}p`, `${change - 5}p`, `${price}p`, `${change + 15}p`], { say: `You pay with £1 for something costing ${price} pence. How much change?` });
};
/**
 * The clock phrase for `h:mm` on a 12-hour dial — `3 o'clock`, `quarter past 3`, `half past 3`, `quarter to 4`,
 * `20 past 3`, `10 to 4`. One source, because `y2-time` reads a clock face and `y2-duration` answers an end
 * time with the same words (#298 slice 3); two copies would be free to disagree about `quarter to`, which is
 * the only phrase that names the *next* hour.
 */
export const clockPhrase = (hh: number, mm: number): string =>
  mm === 0 ? `${hh} o'clock` : mm === 15 ? `quarter past ${hh}` : mm === 30 ? `half past ${hh}` : mm === 45 ? `quarter to ${hh % 12 + 1}` : mm < 30 ? `${mm} past ${hh}` : `${60 - mm} to ${hh % 12 + 1}`;

const y2Time: Generator = (d, rng) => {
  const h = ri(rng, 1, 12);
  const m = d === 1 ? pick(rng, [0, 15, 30, 45]) : d === 2 ? pick(rng, [0, 5, 10, 15, 30, 45]) : 5 * ri(rng, 0, 11);
  const ans = clockPhrase(h, m);
  const ds = new Set<string>();
  let guard = 0;
  while (ds.size < 3 && guard++ < 30) { const mm = 5 * ri(rng, 0, 11); const hh = rng() < 0.5 ? h : ri(rng, 1, 12); const l = clockPhrase(hh, mm); if (l !== ans) ds.add(l); }
  return wordQ(rng, 'What time is it?', ans, [...ds], { visual: { type: 'clock', h, m } });
};
const y2Words: Generator = (d, rng) => {
  const n = ri(rng, d === 1 ? 10 : 21, d === 1 ? 20 : d === 2 ? 60 : 100);
  if (rng() < 0.5) return numQ(rng, numberWord(n), n, { min: 0, max: 100, say: `Which number is ${numberWord(n)}?`, visual: { type: 'word', text: numberWord(n) }, distractors: [n + 10, n - 10, n + 1] });
  // At n = 100 (the top of the range, only reachable at d3) both n+10 and n+1 fall outside [0,100], leaving
  // only two neighbours — a card with three bubbles instead of four (#462 rail). n-2 is there as a fourth
  // candidate for that boundary; unreachable everywhere else in the range, where the first four already
  // give three or more.
  const ds = shuffle(rng, [n + 10, n - 10, n + 1, n - 1, n - 2].filter(x => x >= 0 && x <= 100)).slice(0, 3).map(numberWord);
  return wordQ(rng, `${n}`, numberWord(n), ds, { say: `Which words say ${n}?` });
};
const y2Skip: Generator = (d, rng) => {
  const step = d === 1 ? pick(rng, [2, 5, 10]) : pick(rng, [2, 3, 5, 10]);
  const back = d === 3 && rng() < 0.4;
  const start = back ? step * ri(rng, 5, 10) : step * ri(rng, 0, 6) + (step === 10 ? ri(rng, 0, 9) : 0);
  const s = back ? -step : step;
  const seq = [start, start + s, start + 2 * s];
  return numQ(rng, `${seq.join(', ')}, ?`, start + 3 * s, { min: 0, max: 120, say: `${seq.join(', ')}. What comes next?`, distractors: [start + 3 * s + 1, start + 3 * s - 1, start + 4 * s] });
};
const y2Order: Generator = (d, rng) => orderQ(rng, d === 1 ? 30 : 100, d === 1 ? 3 : 4);
const y2Line: Generator = (d, rng) => { const step = d === 1 ? 1 : d === 2 ? pick(rng, [2, 5, 10]) : pick(rng, [2, 3, 5, 10]); return lineQ(rng, step * ri(rng, 0, d === 1 ? 90 : 6), step, 6); };

/** Year 2: "identify and describe the properties of 3-D shapes, including the number of edges, vertices and faces". */
const y2Shapes: Generator = (d, rng) => {
  if (d === 1 || rng() < 0.4) return name3dQ(rng, SHAPES_3D, d === 1 || rng() < 0.5);
  const [g, , p] = pick(rng, SHAPES_3D);
  // Edges and vertices are the d2–d3 stretch and only the polyhedra carry them (util.ts); everything else
  // counts flat faces, which has one answer for all six. A number, not a phrase: "A cone has… 1 curved face"
  // was sliceable two ways.
  const counts: [string, number][] = [['flat faces', p.flat]];
  if (p.edges !== undefined && (d === 3 || rng() < 0.6)) counts.push(['edges', p.edges], ['vertices', p.vertices]);
  const [label, n] = pick(rng, d === 3 && counts.length > 1 ? counts.slice(1) : counts);
  return numQ(rng, `How many ${label} has a ${p.as}?`, n, { min: 0, max: 14, visual: { type: 'word', text: g }, say: `How many ${label} has a ${p.as}?` });
};

const y2Balance: Generator = (d, rng) => {
  if (d === 1) { const a = ri(rng, 1, 15), b = ri(rng, 1, 20 - a), c = ri(rng, 1, a + b - 1); return balanceQ(rng, `${a} + ${b}`, rng() < 0.5 ? `${c} + ?` : `? + ${c}`, a + b - c, 20, { distractors: [a + b, c] }); }
  const kind = d === 2 ? ri(rng, 0, 1) : ri(rng, 0, 3);
  if (kind === 0) { const a = ri(rng, 10, 80), b = ri(rng, 1, 9), c = 10 * ri(rng, 1, Math.floor((a + b) / 10)); return balanceQ(rng, `${a} + ${b}`, `${c} + ?`, a + b - c, 100, { distractors: [a + b, c] }); }
  if (kind === 1) { const a = ri(rng, 10, 80), b = 10 * ri(rng, 1, Math.floor((99 - a) / 10)), c = ri(rng, 1, 9); return balanceQ(rng, `${a} + ${b}`, `? + ${c}`, a + b - c, 100, { distractors: [a + b, a + b + c] }); }
  if (kind === 2) { const t = pick(rng, [2, 5, 10]), n = ri(rng, 2, 10), c = ri(rng, 1, t * n - 1); return balanceQ(rng, `${n} × ${t}`, rng() < 0.5 ? `${c} + ?` : `? + ${c}`, t * n - c, 100, { distractors: [t * n, c] }); }
  const a = ri(rng, 10, 70), b = ri(rng, 1, 20), c = ri(rng, 1, Math.max(1, 99 - a - b));
  return balanceQ(rng, `${a} + ${b}`, `? − ${c}`, a + b + c, 100, { distractors: [a + b, a + b - c] });
};

// ---------- Position & direction (#8 Phase 2) ----------
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const y2Position: Generator = (d, rng) => {
  const kind = d === 1 ? ri(rng, 0, 1) : ri(rng, 0, 2);
  if (kind === 0) {                                              // where do you face after a turn (all four turns, both directions)
    const [name, steps] = pick(rng, TURNS_ALL);
    const cw = rng() < 0.5, start = ri(rng, 0, 3), end = turnEnd(start, steps, cw);
    return wordQ(rng, `Face ${DIRS[start][1]}, then ${name} ${cw ? 'clockwise' : 'anti-clockwise'}. Which way now?`, DIRS[end][1], ARROWS.filter(a => a !== DIRS[end][1]), {
      say: `You are facing ${DIRS[start][0]}. Turn ${name} ${cw ? 'clockwise' : 'anti-clockwise'}. Which way are you facing now?`, hint: 'Slice the arrow', hintIsData: false,
    });
  }
  if (kind === 1) {                                              // rotation as right angles
    const [name, steps] = pick(rng, TURNS_ALL);
    if (rng() < 0.5) return numQ(rng, `${cap(name)} = how many right angles?`, steps, { min: 0, max: 8, say: `How many right angles are the same as ${name}?`, distractors: [steps + 1, steps - 1, steps + 2] });
    return wordQ(rng, `${steps} right angle${steps === 1 ? '' : 's'} = ?`, name, TURNS_ALL.filter(t => t[0] !== name).map(t => t[0]), { say: `Which turn is the same as ${steps} right angle${steps === 1 ? '' : 's'}?`, hint: 'Slice the turn', hintIsData: false });
  }
  const cw = rng() < 0.5, steps = pick(rng, [1, 2, 3]), start = ri(rng, 0, 3), end = turnEnd(start, steps, cw), name = TURNS_ALL[steps - 1][0];
  return wordQ(rng, `Face ${DIRS[start][1]}, turn ${cw ? 'clockwise' : 'anti-clockwise'} to face ${DIRS[end][1]}. Which turn?`, name, TURNS_ALL.filter(t => t[0] !== name).map(t => t[0]), {
    say: `You turn ${cw ? 'clockwise' : 'anti-clockwise'} from ${DIRS[start][0]} to ${DIRS[end][0]}. Which turn was it?`, hint: 'Slice the turn', hintIsData: false,
  });
};

// ---------- Symmetry & repeating patterns (#299 slice 4) ----------
/**
 * Half-pictures, three squares wide. A card's grid is a half beside its own reflection, so a symmetric
 * picture is symmetric **by construction** rather than by a table someone has to keep correct by hand:
 * there is no way to mistype a half into an asymmetric whole. `#` is a coloured square, `.` an empty one.
 * Each row's rightmost square sits against the fold, so most rows fill it — a row that instead leaves
 * the fold empty (like the butterfly's top) is a deliberate gap, not an accident (#391).
 */
const SYM_HALVES: readonly (readonly string[])[] = [
  ['..#', '.##', '###', '..#'],   // a tree on a trunk
  ['.##', '###', '.##', '..#'],   // a balloon on a string
  ['..#', '.##', '###', '.##'],   // a mountain
  ['..#', '.##', '.##', '###'],   // a fir
  ['.#.', '###', '###', '..#'],   // a butterfly
  ['###', '.##', '..#', '..#'],   // a funnel
];
/** A half row beside its own reflection: `..#` → `..##..`. */
const mirrorRow = (row: string) => row + [...row].reverse().join('');
const mirrored = (half: readonly string[]) => half.map(mirrorRow);
/**
 * Does every row read the same backwards? This is the property the card asks about, written independently of
 * how a grid was built, so a test can check the answer against the picture rather than against the recipe.
 */
export const isVertSymmetric = (grid: readonly string[]) => grid.every(r => r === [...r].reverse().join(''));
/**
 * Break the symmetry by toggling `n` squares in the **left half only**. Every toggled square's mirror partner
 * is in the untouched right half, so the result is always asymmetric — one flip is enough, and `n` only sets
 * how obvious it is (three at d1, one at d3).
 */
function breakSymmetry(rng: Rng, half: readonly string[], n: number): string[] {
  const grid = mirrored(half).map(r => [...r]);
  const cols = half[0].length;
  const spots = shuffle(rng, grid.flatMap((_, r) => Array.from({ length: cols }, (_, c) => [r, c] as [number, number]))).slice(0, n);
  for (const [r, c] of spots) grid[r][c] = grid[r][c] === '#' ? '.' : '#';
  return grid.map(r => r.join(''));
}
/** Capitals with, and without, a vertical line of symmetry — the mirror-card test itself, in letters. */
const SYM_LETTERS = ['A', 'H', 'I', 'M', 'O', 'T', 'U', 'V', 'W', 'X', 'Y'];
const ASYM_LETTERS = ['B', 'C', 'D', 'E', 'F', 'G', 'J', 'K', 'L', 'N', 'P', 'Q', 'R', 'S', 'Z'];
/** Year 2: "identify line symmetry in a vertical line" — on a drawn picture, and on capital letters. */
const y2Symmetry: Generator = (d, rng) => {
  if (d === 1 || rng() < 0.6) {
    const half = pick(rng, SYM_HALVES);
    const grid = rng() < 0.5 ? mirrored(half) : breakSymmetry(rng, half, d === 1 ? 3 : d === 2 ? 2 : 1);
    const yes = isVertSymmetric(grid);
    return wordQ(rng, 'Is the dotted line a line of symmetry?', yes ? 'yes' : 'no', [yes ? 'no' : 'yes'], {
      visual: { type: 'symmetry', grid }, wide: true,
      say: 'Look at the dotted line. Are the two halves the same? Say yes or no.',
      hint: 'Do both halves match?', hintIsData: false,
    });
  }
  return wordQ(rng, 'Which letter has a vertical line of symmetry?', pick(rng, SYM_LETTERS), shuffle(rng, ASYM_LETTERS).slice(0, 3), {
    say: 'Which letter looks the same folded down the middle?', hint: 'Fold it down the middle', hintIsData: false,
  });
};

/**
 * Repeating patterns: a unit of two or three objects repeated three times with one hidden.
 *
 * The gap never falls inside the first two repeats, so **two complete periods are always visible** and
 * exactly one object fits — the acceptance bar for this issue is one defensible answer with the voice off,
 * and a pattern showing only one period leaves "what comes next" genuinely open.
 */
/**
 * The objects a pattern is built from: **one silhouette each** (#299 review B4).
 *
 * The first pool here was eight coloured circles. Six of them differed by hue alone, and because the near
 * decoy is always another object from the same card, 54% of d1 cards put two of those six in front of the
 * child at once — 🔴/🟢, 🔵/🟣 and the rest of the standard confusions. To a colour-blind child the sequence
 * then reads as one repeated circle and the two bubbles are identical: not a hard card, a card with **no**
 * answer, which fails #299's own "exactly one defensible answer with the voice off" the same way a card that
 * answers itself does.
 *
 * So every object carries a different shape, and the name beside each glyph is what the rail in
 * `tests/unit/curriculum.test.ts` holds unique — colour is decoration here, never the thing being read.
 */
const PATTERN_OBJECTS: readonly (readonly [string, string])[] = [
  ['🔴', 'circle'], ['🟦', 'square'], ['🔺', 'triangle'], ['⭐', 'star'],
  ['❤️', 'heart'], ['🌙', 'crescent'], ['🔶', 'diamond'], ['🐟', 'fish'],
];
const PATTERN_GLYPHS = PATTERN_OBJECTS.map(([g]) => g);
/** Unit shapes as letters: which positions repeat, filled with objects at generation time. */
const UNITS_D1 = ['AB'], UNITS_LONGER = ['ABC', 'AAB', 'ABB'];
const y2Patterns: Generator = (d, rng) => {
  const shape = pick(rng, d === 1 ? UNITS_D1 : UNITS_LONGER);
  const letters = [...new Set([...shape])];
  const chosen = shuffle(rng, PATTERN_GLYPHS).slice(0, letters.length);
  const unit = [...shape].map(ch => chosen[letters.indexOf(ch)]);
  const seq = [...unit, ...unit, ...unit];
  // d1/d2 hide the last object ("what comes next?"); d3 may hide one inside the last repeat, which is harder
  // because the child has to read the pattern from both sides of the gap.
  const gap = d === 3 ? ri(rng, unit.length * 2, seq.length - 1) : seq.length - 1;
  const answer = seq[gap], last = gap === seq.length - 1;
  // The near decoys are the pattern's own other objects — the mistake worth catching — and the rest of the
  // pool fills up to three so an AB pattern still gets a full card.
  const decoys = [...chosen.filter(o => o !== answer), ...shuffle(rng, PATTERN_GLYPHS.filter(o => !chosen.includes(o)))];
  return wordQ(rng, last ? 'What comes next?' : 'Which one is missing?', answer, decoys, {
    visual: { type: 'strip', text: seq.map((o, i) => i === gap ? '_' : o).join(' ') },
    say: last ? 'Look at the pattern. What comes next?' : 'Look at the pattern. Which one is missing?',
    hint: last ? 'Slice what comes next' : 'Slice the missing one', hintIsData: false,
  });
};

// ---------- Measurement (#8, #298) ----------
// Year 2 measurement is compare and order, choose the sensible unit, and add or subtract within one unit
// (#298). The "1 metre = ? cm" conversions these three used to ask are Year 3/4 and needed three-digit
// numbers, so they are gone. Bringing the comparisons inside 100 took both moves, not one: a larger-unit
// draw (a 4 kg crate against a 17 kg sack) *and* smaller objects in the small unit, because a sack does not
// weigh 60 g. Every noun below is colour-neutral — `measureCompare` renders `${colour} ${noun}` and the
// colour is the answer, so a green orange or a purple lemon is a card this project will not show.
const y2Length: Generator = (d, rng) => {
  const kind = d === 1 ? ri(rng, 0, 1) : ri(rng, 0, 2);
  if (kind === 0) return rng() < 0.5
    ? measureCompare(rng, d, pick(rng, ['rope', 'ribbon', 'plank', 'path']), 'cm', ['longer', 'shorter', 'longest', 'shortest'], 10, 99)
    : measureCompare(rng, d, pick(rng, ['fence', 'wall', 'ladder', 'pipe']), 'm', ['longer', 'shorter', 'longest', 'shortest'], 2, 40);
  if (kind === 1) return unitChoice(rng, [['pencil', 'cm'], ['finger', 'cm'], ['book', 'cm'], ['door', 'm'], ['room', 'm'], ['garden', 'm'], ['playground', 'm']], 'cm', 'm', 'measure');
  return measureSum(rng, 'cm', ['How long altogether?', 'How long is left?']);
};
const y2Mass: Generator = (d, rng) => {
  const kind = d === 1 ? ri(rng, 0, 1) : ri(rng, 0, 2);
  if (kind === 0) return rng() < 0.5
    ? measureCompare(rng, d, pick(rng, ['spoon', 'sock', 'pebble', 'candle']), 'g', ['heavier', 'lighter', 'heaviest', 'lightest'], 20, 99)
    : measureCompare(rng, d, pick(rng, ['sack', 'crate', 'suitcase', 'barrel']), 'kg', ['heavier', 'lighter', 'heaviest', 'lightest'], 2, 20);
  if (kind === 1) return unitChoice(rng, [['feather', 'g'], ['apple', 'g'], ['coin', 'g'], ['cat', 'kg'], ['dog', 'kg'], ['bag of flour', 'kg']], 'g', 'kg', 'weigh');
  return measureSum(rng, 'g', ['How heavy altogether?', 'How much is left?']);
};
const y2Capacity: Generator = (d, rng) => {
  const kind = d === 1 ? ri(rng, 0, 1) : ri(rng, 0, 2);
  if (kind === 0) return rng() < 0.5
    ? measureCompare(rng, d, pick(rng, ['eggcup', 'lid', 'spoon', 'pot']), 'ml', HOLDS, 20, 99, 'holds')
    : measureCompare(rng, d, pick(rng, ['bucket', 'tank', 'barrel', 'watering can']), 'l', HOLDS, 2, 20, 'holds');
  if (kind === 1) return unitChoice(rng, [['teaspoon', 'ml'], ['cup', 'ml'], ['mug', 'ml'], ['bath', 'l'], ['bucket', 'l'], ['paddling pool', 'l']], 'ml', 'l', 'measure');
  return measureSum(rng, 'ml', ['How much altogether?', 'How much is left?']);
};
/** Minimum °C between an estimate's answer and each decoy, and between decoys (#296). */
export const TEMP_GAP = 10;
const TEMP_STEP = TEMP_GAP * 2;   // the ladder's rung: twice the floor — the rail below checks the floor and the resulting gaps, not this constant, so a regression to TEMP_GAP would still pass at exactly 10 °C apart
const y2Temp: Generator = (d, rng) => {
  if (d >= 2 && rng() < 0.4) {
    const [thing, t] = pick(rng, [['ice', 0], ['a cold morning', 5], ['a warm room', 20], ['a hot bath', 40], ['a summer day', 28], ['inside a fridge', 4]] as [string, number][]);
    // #296: an estimate has no exact answer, so a decoy 1 °C away is as true as the answer. Decoys sit on a
    // ladder of `TEMP_STEP` (20 °C) either side of it — none is defensible (a fridge at 24 °C, a summer day at
    // 8 °C) and none is close to another. The ladder is derived from `TEMP_GAP`, the floor the rail holds.
    const ds = shuffle(rng, [1, 2, 3, -1, -2, -3].map(k => t + k * TEMP_STEP).filter(x => x >= 0 && x <= 100)).slice(0, 3).map(x => `${x}°C`);
    return wordQ(rng, `Temperature of ${thing}?`, `${t}°C`, ds, { say: `About what temperature is ${thing}?` });
  }
  const warmer = rng() < 0.5;
  const [ca, cb] = shuffle(rng, ['the town', 'the hill', 'the beach', 'the park', 'the wood', 'the lake']).slice(0, 2);
  let a = ri(rng, 0, 35), b = a; while (b === a) b = ri(rng, 0, 35);
  const first = warmer ? a > b : a < b;
  // `hintIsData`, for the same reason as `measureCompare()`: the options are the two places, so the
  // temperatures live in this line and nowhere else on the card (#328).
  return wordQ(rng, `Which was ${warmer ? 'warmer' : 'colder'}?`, first ? ca : cb, [first ? cb : ca], { hint: `${ca}: ${a}°C · ${cb}: ${b}°C`, hintIsData: true, say: `${ca} was ${a} degrees. ${cb} was ${b} degrees. Which was ${warmer ? 'warmer' : 'colder'}?` });
};
// Y2 statistics (#8). Each survey is three categories the child picks out by emoji, so the chart can be read
// without reading the words — the labels carry the emoji and so does the prompt.
const SURVEYS: readonly { what: string; rows: readonly [string, string][] }[] = [
  { what: 'fruit', rows: [['🍎', 'apples'], ['🍌', 'bananas'], ['🍓', 'strawberries']] },
  { what: 'pet', rows: [['🐶', 'dogs'], ['🐱', 'cats'], ['🐰', 'rabbits']] },
  { what: 'way to school', rows: [['🚌', 'bus'], ['🚗', 'car'], ['🚲', 'bike']] },
  { what: 'colour', rows: [['🔴', 'red'], ['🔵', 'blue'], ['🟢', 'green']] },
  { what: 'playtime game', rows: [['⚽', 'football'], ['🪢', 'skipping'], ['🏃', 'tag']] },
];
/**
 * A pictogram's symbol is deliberately **not** one of the categories. Drawing every row with the first
 * category's emoji made the cats row four dogs, which is the one place a topic premised on "the chart can be
 * read without reading the words" worked against itself (#8 review). A neutral symbol keys as "1 ⭐ = 2" and
 * claims to be nothing.
 */
const PICTO_SYMBOL = '⭐';

/**
 * Reading categorical data: tally chart (d1), pictogram with a key (d2), block diagram (d3).
 * The visual carries the data and the prompt never repeats it — that is the skill being practised, so a
 * question whose `say` read the counts aloud would answer itself for a child listening.
 *
 * Degenerate data is prevented before the question is phrased, never recovered from afterwards: a tie makes
 * "which was most" two-answered and an equal pair makes "how many more" zero. Both are re-rolled **at the
 * difficulty asked for**. An earlier version recursed into `y2Stats(1, rng)` on a tie, which quietly served a
 * Legend-stage child the d1 tally chart in 5.3% of d3 draws, and terminated only because d1 happens to force
 * `ask = 'one'` — a guard twenty-five lines away from the recursion it was holding up (#8 review).
 */
const y2Stats: Generator = (d, rng) => {
  const survey = pick(rng, SURVEYS);
  const kind = d === 1 ? 'tally' : d === 2 ? 'pictogram' : 'block';
  // The pictogram key is the whole of its difficulty: counts must be whole multiples of it or the drawing
  // lies, so they are rolled in steps of the key. A tally or a block diagram has no key (#133) and counts in
  // ones — `step` is the roll unit and nothing else; it never reaches the visual of a chart without a key.
  const step = kind === 'pictogram' ? pick(rng, [2, 5]) : 1;
  const roll = () => survey.rows.map(() => ri(rng, 1, kind === 'block' ? 9 : 6) * step);
  const ask = d === 1 ? 'one' : pick(rng, d === 2 ? ['one', 'total'] : ['total', 'more', 'most']);

  let counts = roll();
  const [i, j] = shuffle(rng, [0, 1, 2]).slice(0, 2);
  // Bounded, and each re-roll keeps `kind`, `each` and `ask` exactly as generated.
  const degenerate = () => ask === 'most'
    ? counts.filter(n => n === Math.max(...counts)).length > 1
    : ask === 'more' && counts[i] === counts[j];
  for (let tries = 0; tries < 20 && degenerate(); tries++) counts = roll();
  // The terminator: a re-roll can be unlucky twenty times, so end it deterministically rather than loop on.
  if (degenerate()) counts[ask === 'most' ? 0 : i] = Math.max(...counts) + step;

  const rows = survey.rows.map(([icon, name], k) => ({ label: `${icon} ${name}`, n: counts[k] }));
  const visual: Question['visual'] = kind === 'pictogram'
    ? { type: 'chart', kind, rows, each: step, icon: PICTO_SYMBOL }
    : { type: 'chart', kind, rows };
  const chart = kind === 'tally' ? 'tally chart' : kind === 'pictogram' ? 'pictogram' : 'block diagram';

  if (ask === 'total') {
    const total = counts.reduce((a, b) => a + b, 0);
    return numQ(rng, `How many children altogether?`, total, {
      visual, hint: `Add up the ${chart}`, hintIsData: false, say: `Look at the ${chart}. How many children are there altogether?`,
    });
  }
  if (ask === 'more') {
    const [hi, lo] = counts[i] > counts[j] ? [i, j] : [j, i];   // never a negative answer, and never zero
    const [hiIcon, hiName] = survey.rows[hi], [loIcon, loName] = survey.rows[lo];
    return numQ(rng, `How many more ${hiIcon} than ${loIcon}?`, counts[hi] - counts[lo], {
      visual, say: `Look at the ${chart}. How many more children chose ${hiName} than ${loName}?`,
    });
  }
  if (ask === 'most') {
    const best = counts.indexOf(Math.max(...counts));
    return wordQ(rng, `Which did most children choose?`, survey.rows[best][1],
      survey.rows.filter((_, k) => k !== best).map(r => r[1]),
      { visual, say: `Look at the ${chart}. Which one did most children choose?` });
  }
  const k = ri(rng, 0, survey.rows.length - 1);
  const [icon] = survey.rows[k];
  return numQ(rng, `How many chose ${icon}?`, counts[k], {
    visual, hint: `Read the ${chart}`, hintIsData: false, say: `Look at the ${chart}. How many children chose this one?`,
  });
};

/**
 * Year 2 durations (#298 slice 3). Year 2 asks for two time facts — minutes in an hour, hours in a day — and
 * for one thing this topic never did: "compare and sequence intervals of time". Seconds in a minute, days in
 * a week, days in a fortnight, weeks in a year and the days in a named month are all Year 3 ("know the number
 * of seconds in a minute and the number of days in each month, year and leap year"), and the month-order draw
 * that took 35% of the cards is Year 1's, already covered by `y1-months`. All of that has left the topic.
 *
 * What replaces it, by stage: d1 the four facts below, d2 comparing intervals, d3 an end time.
 */
const DUR_FACTS: [string, number][] = [['minutes in an hour', 60], ['hours in a day', 24], ['minutes in half an hour', 30], ['minutes in a quarter of an hour', 15]];
/**
 * The intervals a comparison card draws from. Every phrase here is a **bubble label**, so each is kept as
 * short as `y2-time`'s longest (`quarter past 12`) — which is why `half an hour` appears and
 * `a quarter of an hour` does not. The values are distinct, so "the longest" of any subset is never a tie.
 */
const INTERVALS: [string, number][] = [['10 minutes', 10], ['15 minutes', 15], ['20 minutes', 20], ['half an hour', 30], ['40 minutes', 40], ['50 minutes', 50], ['1 hour', 60]];
/** Durations that land the end time back on Year 2's o'clock / quarter / half grid, so it has a clock phrase. */
const GRID_DURATIONS: [string, number][] = [['a quarter of an hour', 15], ['half an hour', 30], ['three quarters of an hour', 45], ['an hour', 60]];

/** Compare `n` intervals: which takes the longest, or the shortest. `n === 2` is the comparative form. */
function intervalCompare(rng: Rng, n: number): Question {
  const chosen = shuffle(rng, INTERVALS).slice(0, n);
  const big = rng() < 0.5;
  const target = chosen.reduce((best, cur) => (big ? cur[1] > best[1] : cur[1] < best[1]) ? cur : best);
  const ask = n === 2 ? (big ? 'Which takes longer?' : 'Which takes less time?') : (big ? 'Which takes the longest?' : 'Which takes the shortest?');
  // No hint: the bubbles *are* the durations, so a hint listing them again would only repeat the question —
  // and a hint is the one line a landscape phone can hide (#328). `optionsAreContent` tells `repeatKey`
  // (#451) that this generator's question lives in `options`, since no other field carries it.
  return wordQ(rng, ask, target[0], chosen.filter(c => c !== target).map(c => c[0]), { say: `${chosen.map(c => c[0]).join(', ')}. ${ask}`, optionsAreContent: true });
}

/**
 * "It starts at 3 o'clock and lasts half an hour. When does it end?" — a start on the quarter grid plus a
 * duration that keeps the end on it. The decoys are the mistakes the question is about: not adding at all,
 * adding a whole hour, and overshooting or undershooting by a quarter. They are taken in order until three
 * distinct ones are found, because the offsets collide for some durations (`45 + 15` and `60` are one time).
 */
function endTime(rng: Rng): Question {
  const h = ri(rng, 1, 12), m = pick(rng, [0, 15, 30, 45]);
  const [phrase, mins] = pick(rng, GRID_DURATIONS);
  const at = (t: number) => clockPhrase((Math.floor(t / 60) - 1) % 12 + 1, t % 60);
  const start = h * 60 + m;
  const ans = at(start + mins);
  const ds: string[] = [];
  for (const o of [0, mins + 15, mins - 15, 60, 30]) {
    if (o === mins) continue;
    const l = at(start + o);
    if (l !== ans && !ds.includes(l)) ds.push(l);
    if (ds.length === 3) break;
  }
  const said = `It starts at ${clockPhrase(h, m)} and lasts ${phrase}. When does it end?`;
  return wordQ(rng, said, ans, ds, { say: said });
}

const y2Duration: Generator = (d, rng) => {
  if (d === 1) {
    const [phrase, n] = pick(rng, DUR_FACTS);
    return numQ(rng, `How many ${phrase}?`, n, { min: 0, max: 100, say: `How many ${phrase}?`, distractors: [n + 1, n - 1, n === 60 ? 30 : n * 2] });
  }
  if (d === 2) return intervalCompare(rng, rng() < 0.5 ? 2 : 3);
  return endTime(rng);
};

// ---------- Year 2 writing ----------
const y2Spelling: Generator = (d, rng) => {
  const w = pick(rng, Y2_CEW.filter(x => x.length <= (d === 1 ? 5 : d === 2 ? 7 : 10)));
  if (d === 3 && rng() < 0.4) return spellQ(rng, w, undefined, 3);
  const idx = ri(rng, 0, w.length - 1);
  return gapQ(rng, w, idx, gapLetters(w, idx), undefined, `Which letter is missing from the word ${w}?`);
};
const CONTRACTIONS: [string, string][] = [['do not', "don't"], ['can not', "can't"], ['is not', "isn't"], ['I am', "I'm"], ['it is', "it's"], ['you are', "you're"], ['we will', "we'll"], ['did not', "didn't"], ['has not', "hasn't"], ['they are', "they're"], ['I will', "I'll"], ['could not', "couldn't"]];
const y2Contractions: Generator = (d, rng) => {
  const [long, short] = pick(rng, CONTRACTIONS);
  const ds = shuffle(rng, CONTRACTIONS.filter(c => c[1] !== short)).slice(0, d === 1 ? 2 : 3).map(c => c[1]);
  if (d === 3 && rng() < 0.5) return wordQ(rng, short, long, shuffle(rng, CONTRACTIONS.filter(c => c[0] !== long)).slice(0, 3).map(c => c[0]), { visual: { type: 'word', text: short }, say: `What does ${short} mean?` });
  return wordQ(rng, long, short, ds, { visual: { type: 'word', text: long }, say: `Which contraction means ${long}?`, hint: 'Slice the short form', hintIsData: false });
};
const SUFFIX2: [string, string, string][] = [['care', 'ful', 'Be care___ on the road.'], ['hope', 'less', 'The lost sock was hope___.'], ['kind', 'ness', 'Show kind___ to others.'], ['slow', 'ly', 'The snail moved slow___.'], ['enjoy', 'ment', 'We had lots of enjoy___.'], ['help', 'ful', 'A very help___ friend.'], ['quick', 'ly', 'She ran quick___.'], ['sad', 'ness', 'He felt great sad___.'], ['fear', 'less', 'The fear___ ninja jumped.'], ['pay', 'ment', 'Mum made the pay___.']];
const y2Suffix: Generator = (d, rng) => {
  const [, suf, sent] = pick(rng, SUFFIX2);
  return wordQ(rng, sent, suf, ['ful', 'less', 'ness', 'ly', 'ment'].filter(x => x !== suf).slice(0, d === 1 ? 2 : 3), { visual: { type: 'sentence', text: sent }, say: sent.replace('___', 'blank'), hint: 'Slice the ending', hintIsData: false });
};
/**
 * Endings that change the root (#299 slice 3, NC English Appendix 1 Year 2): `[root, ending, the new word,
 * rule, the two spellings a child actually writes instead]`. `y1-suffix` and `y2-suffix` are the no-change
 * case — `jump` + `ing`, `care` + `ful` — so **every entry here must change the root**, which is the one
 * thing this topic teaches and a rail holds it to.
 *
 * The two wrong spellings are the rule left unapplied (`hopeing`) and a rule applied that does not belong to
 * this word (`hopping` for `hope`, `happyier` for `happy`) — never a different ending: the card asks which
 * spelling is right, not which ending fits, and `y1-suffix` already asks the other question. Two is the whole
 * set of mistakes the rule admits, so these cards run on three bubbles rather than four.
 */
type SuffixRule = 'drop-e' | 'double' | 'y-to-i';
export const SUFFIX_ROOT: ReadonlyArray<readonly [string, string, string, SuffixRule, string, string]> = [
  // drop the e: hope → hoping
  ['hope', 'ing', 'hoping', 'drop-e', 'hopeing', 'hopping'], ['make', 'ing', 'making', 'drop-e', 'makeing', 'makking'],
  ['ride', 'ing', 'riding', 'drop-e', 'rideing', 'ridding'], ['smile', 'ed', 'smiled', 'drop-e', 'smileed', 'smilled'],
  ['bake', 'ed', 'baked', 'drop-e', 'bakeed', 'bakked'], ['close', 'ing', 'closing', 'drop-e', 'closeing', 'clossing'],
  ['wave', 'ed', 'waved', 'drop-e', 'waveed', 'wavved'], ['nice', 'er', 'nicer', 'drop-e', 'niceer', 'nicier'],
  ['late', 'er', 'later', 'drop-e', 'lateer', 'latter'],
  // double the last letter: hop → hopping
  ['hop', 'ing', 'hopping', 'double', 'hoping', 'hopeing'], ['run', 'ing', 'running', 'double', 'runing', 'runeing'],
  ['sit', 'ing', 'sitting', 'double', 'siting', 'siteing'], ['swim', 'ing', 'swimming', 'double', 'swiming', 'swimeing'],
  ['pat', 'ed', 'patted', 'double', 'pated', 'pateed'], ['stop', 'ed', 'stopped', 'double', 'stoped', 'stopeed'],
  ['big', 'er', 'bigger', 'double', 'biger', 'bigier'], ['sad', 'est', 'saddest', 'double', 'sadest', 'sadiest'],
  ['hot', 'est', 'hottest', 'double', 'hotest', 'hotiest'],
  // y becomes i: happy → happier
  ['happy', 'er', 'happier', 'y-to-i', 'happyer', 'happyier'], ['baby', 'es', 'babies', 'y-to-i', 'babyes', 'babys'],
  ['carry', 'ed', 'carried', 'y-to-i', 'carryed', 'carryied'], ['funny', 'est', 'funniest', 'y-to-i', 'funnyest', 'funnyiest'],
  ['cry', 'es', 'cries', 'y-to-i', 'cryes', 'crys'], ['try', 'ed', 'tried', 'y-to-i', 'tryed', 'tryied'],
  ['easy', 'er', 'easier', 'y-to-i', 'easyer', 'easyier'], ['silly', 'est', 'silliest', 'y-to-i', 'sillyest', 'sillyiest'],
  ['party', 'es', 'parties', 'y-to-i', 'partyes', 'partys'],
];
/** d1 is the rule you can see (an `e` disappears); d2 adds doubling; d3 adds `y → i`, which changes a letter inside the word. */
const SUFFIX_RULES: Record<number, SuffixRule[]> = { 1: ['drop-e'], 2: ['drop-e', 'double'], 3: ['drop-e', 'double', 'y-to-i'] };
const y2SuffixRoot: Generator = (d, rng) => {
  const rules = SUFFIX_RULES[d] ?? SUFFIX_RULES[3];
  const [root, suf, ans, , naive, misrule] = pick(rng, SUFFIX_ROOT.filter(e => rules.includes(e[3])));
  return wordQ(rng, `${root} + ${suf} = ?`, ans, [naive, misrule], {
    visual: { type: 'word', text: `${root} + ${suf}` },
    say: `Add ${suf} to ${root}. Which spelling is right?`, hint: 'The root word changes', hintIsData: false,
  });
};

/**
 * Word classes in a sentence (#299 slice 3, NC English Appendix 2 Year 2): `[sentence, noun, verb, adjective,
 * adverb]`. The three words **not** asked for are the card's distractors, so every option comes from the
 * child's own sentence and exactly one of them can be the class asked for.
 *
 * That only holds while no word in the bank belongs to two classes out of context — `play`, `run` and `smile`
 * are a noun and a verb both, and `fast` is an adjective and an adverb both — so the bank avoids them and a
 * rail holds every word to the one column it appears in. The sentences are deliberately four-content-word
 * sentences for the same reason: a word on the card that is not one of the four could be the honest answer.
 */
export const WORD_CLASSES: ReadonlyArray<readonly [string, string, string, string, string]> = [
  ['The happy kitten purred loudly.', 'kitten', 'purred', 'happy', 'loudly'],
  ['A tiny bird sang sweetly.', 'bird', 'sang', 'tiny', 'sweetly'],
  ['The brave ninja jumped quickly.', 'ninja', 'jumped', 'brave', 'quickly'],
  ['My little sister giggled quietly.', 'sister', 'giggled', 'little', 'quietly'],
  ['The old bus stopped suddenly.', 'bus', 'stopped', 'old', 'suddenly'],
  ['A hungry rabbit nibbled greedily.', 'rabbit', 'nibbled', 'hungry', 'greedily'],
  ['The red balloon floated slowly.', 'balloon', 'floated', 'red', 'slowly'],
  ['Our new teacher smiled warmly.', 'teacher', 'smiled', 'new', 'warmly'],
  ['The huge castle stood proudly.', 'castle', 'stood', 'huge', 'proudly'],
  ['The tired baby yawned sleepily.', 'baby', 'yawned', 'tired', 'sleepily'],
];
/** Column order in `WORD_CLASSES`, and the order the difficulties unlock them in. Exported for the rail. */
export const WORD_CLASS_NAMES = ['noun', 'verb', 'adjective', 'adverb'] as const;
const y2WordClass: Generator = (d, rng) => {
  const row = pick(rng, WORD_CLASSES);
  // Nouns and verbs first: Year 1 already names them (Appendix 2), while adjective and adverb are Year 2's own
  // vocabulary — and "which word is the adverb?" on a card whose adverb is the last word is the stretch.
  const k = ri(rng, 0, d === 1 ? 1 : d === 2 ? 2 : 3);
  const cls = WORD_CLASS_NAMES[k], answer = row[k + 1];
  return wordQ(rng, `Which word is the ${cls}?`, answer, row.slice(1).filter(w => w !== answer), {
    visual: { type: 'sentence', text: row[0] }, say: `${row[0]} Which word is the ${cls}?`, hint: `Slice the ${cls}`, hintIsData: false,
  });
};

/**
 * Sentence types (#299 slice 3, NC English Appendix 2 Year 2): `[sentence, type]`.
 *
 * The four forms are taught as a set, so the card shows one sentence and asks which it is. What keeps exactly
 * one answer defensible is the English KS1 convention the bank is built to: a **question** ends with `?`; an
 * **exclamation** is the `What …!` / `How …!` form and nothing else (`Look out!` is a command, however loudly
 * it is said); a **statement** and a **command** both end with a full stop, so those two can only be told
 * apart by reading — which is the point of the topic.
 *
 * That last pair is why no command here ends with `!`: it would be correct English and would still make the
 * card a punctuation-spotting exercise with two defensible answers.
 */
export const SENTENCE_TYPE_NAMES = ['statement', 'question', 'command', 'exclamation'] as const;
export type SentenceType = typeof SENTENCE_TYPE_NAMES[number];
export const SENTENCE_TYPES: ReadonlyArray<readonly [string, SentenceType]> = [
  ['The cat sat on the mat.', 'statement'],
  ['Ninjas train every day.', 'statement'],
  ['My bike is bright red.', 'statement'],
  ['We went to the park.', 'statement'],
  ['The sun is shining today.', 'statement'],
  ['Our school has a new roof.', 'statement'],
  ['Where is my hat?', 'question'],
  ['Can you swim?', 'question'],
  ['What is your name?', 'question'],
  ['Who took the last biscuit?', 'question'],
  ['Are we there yet?', 'question'],
  ['How old is your dog?', 'question'],
  ['Close the door.', 'command'],
  ['Wash your hands.', 'command'],
  ['Put on your coat.', 'command'],
  ['Line up quietly.', 'command'],
  ['Pass me the ball.', 'command'],
  ['Tidy your bedroom.', 'command'],
  ['What a lovely day it is!', 'exclamation'],
  ['How tall that tree is!', 'exclamation'],
  ['What a mess we made!', 'exclamation'],
  ['How quickly she ran!', 'exclamation'],
  ['What big ears you have!', 'exclamation'],
  ['How brave you are!', 'exclamation'],
];
/**
 * d1 is the pair a Year 1 child already meets (a sentence that tells you something, a sentence that asks);
 * d2 adds the command, which shares its full stop with the statement; d3 adds the exclamation.
 *
 * The bubbles are the types unlocked so far, not all four, so d1 is a two-way choice rather than a guess
 * between words the child has not been taught yet.
 */
const y2SentenceType: Generator = (d, rng) => {
  const allowed = SENTENCE_TYPE_NAMES.slice(0, d === 1 ? 2 : d === 2 ? 3 : 4);
  const [sent, type] = pick(rng, SENTENCE_TYPES.filter(e => allowed.includes(e[1])));
  return wordQ(rng, 'What kind of sentence is this?', type, allowed.filter(n => n !== type), {
    visual: { type: 'sentence', text: sent }, say: `${sent} What kind of sentence is this?`,
    hint: 'Does it tell, ask, order or exclaim?', hintIsData: false,
  });
};

/**
 * Present and past (#299 slice 3, NC English Appendix 2 Year 2): `TENSE_VERBS` is `[base, he/she present,
 * past, -ing]` and `TENSE_FRAMES` is `[frame with one gap, the column that fills it, the tense of the
 * finished sentence]`. Every frame takes every verb, so the two tables multiply out instead of being written
 * card by card.
 *
 * A frame carries its own tense — a time phrase (`Yesterday`) or the auxiliary (`is`/`was`) — which is what
 * makes exactly one of the four forms fit the gap at d3: `Yesterday he walking` and `Yesterday he walks` are
 * both wrong, and a child who writes either is making the mistake this topic is for. The past-progressive
 * frames carry no time phrase at all, so `was` against `is` is the only thing that answers them.
 */
export const TENSE_VERBS: ReadonlyArray<readonly [string, string, string, string]> = [
  ['walk', 'walks', 'walked', 'walking'], ['jump', 'jumps', 'jumped', 'jumping'],
  ['shout', 'shouts', 'shouted', 'shouting'], ['smile', 'smiles', 'smiled', 'smiling'],
  ['clap', 'claps', 'clapped', 'clapping'], ['skip', 'skips', 'skipped', 'skipping'],
  ['dance', 'dances', 'danced', 'dancing'], ['laugh', 'laughs', 'laughed', 'laughing'],
  ['drum', 'drums', 'drummed', 'drumming'], ['hide', 'hides', 'hid', 'hiding'],
  // Irregular pasts: the form a child cannot build with a rule, and the reason a bank beats a suffix.
  ['run', 'runs', 'ran', 'running'], ['sing', 'sings', 'sang', 'singing'],
  ['swim', 'swims', 'swam', 'swimming'], ['sit', 'sits', 'sat', 'sitting'],
  ['sleep', 'sleeps', 'slept', 'sleeping'], ['fly', 'flies', 'flew', 'flying'],
];
/** 1 = he/she present, 2 = past, 3 = the `-ing` form the progressive frames need. */
type TenseCol = 1 | 2 | 3;
export const TENSE_FRAMES: ReadonlyArray<readonly [string, TenseCol, 'present' | 'past']> = [
  ['Every day she ___ in the garden.', 1, 'present'],
  ['Every morning he ___ in the park.', 1, 'present'],
  ['Yesterday he ___ in the garden.', 2, 'past'],
  ['Last week she ___ in the park.', 2, 'past'],
  ['She is ___ in the garden now.', 3, 'present'],
  ['They are ___ in the park.', 3, 'present'],
  ['He was ___ in the garden.', 3, 'past'],
  ['We were ___ in the park.', 3, 'past'],
];
/**
 * d1 and d2 name the tense of a finished sentence — d1 on the simple forms, d2 with the progressive, where
 * the auxiliary rather than the verb ending carries the tense. d3 turns the same sentence round and asks the
 * child to produce the form the gap needs, with all four forms of that one verb on the bubbles.
 */
const y2Tense: Generator = (d, rng) => {
  const [frame, col, tense] = pick(rng, d === 1 ? TENSE_FRAMES.filter(f => f[1] !== 3) : TENSE_FRAMES);
  const v = pick(rng, TENSE_VERBS);
  if (d === 3) return wordQ(rng, frame, v[col], v.filter(w => w !== v[col]), {
    visual: { type: 'sentence', text: frame }, say: frame.replace('___', 'blank'),
    hint: 'Which form of the word fits?', hintIsData: false,
  });
  const sent = frame.replace('___', v[col]);
  return wordQ(rng, 'Present or past?', tense, [tense === 'past' ? 'present' : 'past'], {
    visual: { type: 'sentence', text: sent }, say: `${sent} Is this sentence in the present or the past?`,
    hint: 'Is it happening now, or has it happened already?', hintIsData: false,
  });
};

/**
 * Sound-alike words: [sentence with a gap, the options (answer first), answer]. Every option set is one of
 * `HOMOPHONE_SETS` — the Year 2 statutory pairs (NC English Appendix 1) plus `piece/peace` from Year 3–4 — and
 * a rail holds it there: `on/won`, `brown/brawn` and `wind/wined` were not homophones at all (#296).
 * Exported for that rail.
 */
export const HOMOPHONE_SETS: ReadonlyArray<readonly string[]> = [['to', 'too', 'two'], ['their', 'there', "they're"], ['see', 'sea'], ['sun', 'son'], ['one', 'won'], ['here', 'hear'], ['piece', 'peace'], ['bare', 'bear'], ['blue', 'blew'], ['night', 'knight'], ['be', 'bee'], ['quite', 'quiet']];
export const HOMOPHONES: ReadonlyArray<readonly [string, readonly string[], string]> = [['I want ___ go home.', ['to', 'too', 'two'], 'to'], ['I have ___ cats.', ['two', 'to', 'too'], 'two'], ['Me ___!', ['too', 'to', 'two'], 'too'], ['___ house is big.', ['Their', 'There', "They're"], 'Their'], ['Look over ___!', ['there', 'their', "they're"], 'there'], ['___ going out.', ["They're", 'Their', 'There'], "They're"], ['I can ___ the sea.', ['see', 'sea'], 'see'], ['The ___ shines.', ['sun', 'son'], 'sun'], ['It is ___ o\'clock.', ['one', 'won'], 'one'], ['We ___ the race!', ['won', 'one'], 'won'], ['The ___ ate the honey.', ['bear', 'bare'], 'bear'], ['The wind ___ my hat off.', ['blew', 'blue'], 'blew'], ['___ is a bird.', ['Here', 'Hear'], 'Here'], ['I can ___ you.', ['hear', 'here'], 'hear'], ['A ___ of bread.', ['piece', 'peace'], 'piece'], ['The ___ rode a horse.', ['knight', 'night'], 'knight'], ['A ___ makes honey.', ['bee', 'be'], 'bee'], ['Please be ___ in the library.', ['quiet', 'quite'], 'quiet']];
const y2Homophones: Generator = (_d, rng) => {
  const [sent, opts, ans] = pick(rng, HOMOPHONES);
  return wordQ(rng, sent, ans, opts.filter(o => o !== ans), { visual: { type: 'sentence', text: sent }, say: sent.replace('___', 'blank'), hint: 'Slice the right word', hintIsData: false });
};
const y2Punct: Generator = (d, rng) => {
  const k = d === 1 ? 0 : ri(rng, 0, 2);
  if (k === 0) { const [s, p] = pick(rng, PUNCT_SENTS); return wordQ(rng, `${s}_`, p, ['.', '?', '!'], { visual: { type: 'sentence', text: `${s}_` }, say: `${s}. Which punctuation mark ends this sentence?` }); }
  if (k === 1) {
    // #296: the gap never sits before "and" — English schools teach the list comma without one there.
    const L: [string, string][] = [['I like apples_ pears and plums.', ','], ['We saw lions, tigers_ bears and monkeys.', ','], ['Red, blue_ green and yellow.', ','], ['Bring a hat, coat_ scarf and gloves.', ',']];
    const [s, p] = pick(rng, L);
    return wordQ(rng, s, p, ['.', '?', ';'], { visual: { type: 'sentence', text: s }, say: 'Which mark separates the items in the list?', hint: 'Commas in a list', hintIsData: false });
  }
  const A: [string, string][] = [["The dog_s bone.", "'"], ["Sam_s hat is red.", "'"], ["My mum_s car.", "'"], ["The cat_s tail.", "'"]];
  const [s, p] = pick(rng, A);
  return wordQ(rng, s, p, [',', '.', '-'], { visual: { type: 'sentence', text: s }, say: 'Which mark shows something belongs to someone?', hint: 'Possessive apostrophe', hintIsData: false });
};
// Year 2 subordinates with `when`, `if`, `that` and `because`, and co-ordinates with `or`, `and`, `but`. No
// other subordinating conjunction belongs in this bank: d3 used to carry "Although it was cold, we went out",
// and *although* is Year 3 and beyond (#298 slice 5). Its replacement is the `that` sentence — the one Year 2
// subordinator the bank was missing. `tests/unit/curriculum.test.ts` fails if another one gets in.
const Y2_SENTS: Sent[][] = [
  [['The shiny red kite flew high.', '🪁'], ['Please shut the door quietly.', '🚪'], ['A tiny mouse hid under the chair.', '🐭'], ['The brave knight rode away.', '🏇'], ['Our class went to the museum.', '🏛️'], ['Do you like pizza or pasta?', '🍕'], ['The fluffy kitten chased a leaf.', '🐱'], ['Grandad grows tall yellow sunflowers.', '🌻'], ['What a wonderful surprise this is!', '🎁'], ['Wash your hands before lunch.', '🧼']],
  [['Sam was late because he overslept.', '⏰'], ['The old man walked slowly home.', '👴'], ['We stayed inside because it rained.', '🌧️'], ['She smiled when she saw the puppy.', '🐶'], ['The rocket zoomed into dark space.', '🚀'], ['Would you like some sweet honey?', '🍯'], ['He was tired but he kept running.', '🏃'], ['The children built a huge sandcastle.', '🏖️'], ['My sister plays the violin beautifully.', '🎻'], ['Bring an umbrella if it rains.', '☂️']],
  [['If it rains, we will stay inside.', '☂️'], ['You can play when you have finished.', '🎮'], ['The bird sang because it was happy.', '🐦'], ['We can walk or take the bus.', '🚌'], ['The dragon roared and the village shook.', '🐉'], ['I know that the snow is cold.', '🧣'], ['Please tidy your room before dinner.', '🧹'], ['The clever fox found a secret path.', '🦊'], ['Everybody cheered when our team scored.', '⚽'], ['After lunch we painted colourful pictures.', '🎨']],
];
const Y2_DECOYS = ['because', 'when', 'and', 'but', 'quickly', 'happy', 'tiny', 'huge', 'garden', 'school', 'dragon', 'river', 'shiny', 'after', 'before', 'yellow', 'kite', 'mouse'];
const y2Sentence = sentGen(Y2_SENTS, Y2_DECOYS, [2, 3, 3], 1);

const y2Trace: Generator = (d, rng) => {
  const w = pick(rng, d === 1 ? Y1_CEW.filter(x => x.length >= 2 && x.length <= 4) : Y2_CEW.filter(x => x.length <= (d === 2 ? 5 : 7)));
  return { prompt: `Trace: ${w}`, say: `Trace the word ${w}`, answer: w, options: [w], visual: { type: 'word', text: w } };
};

export const YEAR2_TOPICS: Topic[] = [
  // Year 2 maths
  { id: 'y2-pv', title: 'Tens & Ones', icon: '🔟', subject: 'maths', year: 'year2', nc: 'Y2 NPV: place value', gen: y2PlaceValue },
  { id: 'y2-compare', title: 'Compare < > =', icon: '⚖️', subject: 'maths', year: 'year2', nc: 'Y2 NPV: compare to 100', gen: y2Compare },
  { id: 'y2-skip', title: 'Count in 2s, 3s, 5s, 10s', icon: '🦘', subject: 'maths', year: 'year2', nc: 'Y2 NPV: count in steps', gen: y2Skip },
  { id: 'y2-add', title: 'Adding to 100', icon: '➕', subject: 'maths', year: 'year2', nc: 'Y2 A&S: 2-digit addition', gen: y2Add },
  { id: 'y2-sub', title: 'Subtracting', icon: '➖', subject: 'maths', year: 'year2', nc: 'Y2 A&S: 2-digit subtraction', gen: y2Sub },
  { id: 'y2-three', title: 'Three Numbers', icon: '🎯', subject: 'maths', year: 'year2', nc: 'Y2 A&S: add three 1-digit', gen: y2Three },
  { id: 'y2-inverse', title: 'Missing Number', icon: '❓', subject: 'maths', year: 'year2', nc: 'Y2 A&S: inverse, missing number', gen: y2Inverse },
  { id: 'y2-tables', title: '2, 5, 10 Times Tables', icon: '✖️', subject: 'maths', year: 'year2', nc: 'Y2 M&D: 2, 5, 10 tables ×÷', gen: y2Tables },
  { id: 'y2-oddeven', title: 'Odd or Even', icon: '🐾', subject: 'maths', year: 'year2', nc: 'Y2 M&D: odd and even', gen: y2OddEven },
  { id: 'y2-fractions', title: 'Fractions', icon: '🍕', subject: 'maths', year: 'year2', nc: 'Y2 Fractions: 1/3 1/4 2/4 3/4', gen: y2Fractions },
  { id: 'y2-money', title: 'Money £ and p', icon: '💷', subject: 'maths', year: 'year2', nc: 'Y2 Measurement: money, change', gen: y2Money },
  { id: 'y2-time', title: 'Telling Time', icon: '🕔', subject: 'maths', year: 'year2', nc: 'Y2 Measurement: time to 5 min', gen: y2Time },
  { id: 'y2-words', title: 'Number Words', icon: '🔤', subject: 'maths', year: 'year2', nc: 'Y2 NPV: numbers to 100 in words', gen: y2Words },
  { id: 'y2-order', title: 'Order Up!', icon: '📶', subject: 'maths', year: 'year2', nc: 'Y2 NPV: order numbers to 100', sequenceFrom: 1, gen: y2Order },
  { id: 'y2-line', title: 'Number Line', icon: '📏', subject: 'maths', year: 'year2', nc: 'Y2 NPV: number line, steps', gen: y2Line },
  { id: 'y2-shapes', title: '3-D Shapes', icon: '🎲', subject: 'maths', year: 'year2', nc: 'Y2 Geometry: 3-D shapes — faces, edges, vertices', gen: y2Shapes },
  { id: 'y2-symmetry', title: 'Mirror Lines', icon: '🦋', subject: 'maths', year: 'year2', nc: 'Y2 Geometry: line symmetry in a vertical line', gen: y2Symmetry },
  { id: 'y2-patterns', title: 'What Comes Next?', icon: '🔁', subject: 'maths', year: 'year2', nc: 'Y2 Geometry: order and arrange objects in patterns and sequences', gen: y2Patterns },
  { id: 'y2-position', title: 'Turns & Right Angles', icon: '🧭', subject: 'maths', year: 'year2', nc: 'Y2 Geometry: position, direction, rotation as right angles', gen: y2Position },
  { id: 'y2-length', title: 'Length: cm & m', icon: '📏', subject: 'maths', year: 'year2', nc: 'Y2 Measurement: length (cm/m)', gen: y2Length },
  { id: 'y2-mass', title: 'Mass: g & kg', icon: '🏋️', subject: 'maths', year: 'year2', nc: 'Y2 Measurement: mass (g/kg)', gen: y2Mass },
  { id: 'y2-capacity', title: 'Capacity: ml & l', icon: '🥤', subject: 'maths', year: 'year2', nc: 'Y2 Measurement: capacity (ml/l)', gen: y2Capacity },
  { id: 'y2-temp', title: 'Temperature', icon: '🌡️', subject: 'maths', year: 'year2', nc: 'Y2 Measurement: temperature (°C)', gen: y2Temp },
  { id: 'y2-duration', title: 'Time & Durations', icon: '⏳', subject: 'maths', year: 'year2', nc: 'Y2 Measurement: compare and sequence intervals of time', gen: y2Duration },
  { id: 'y2-balance', title: 'Balance the Scales', icon: '⚖️', subject: 'maths', year: 'year2', nc: 'Y2 A&S: equivalence, inverse, tables', gen: y2Balance },
  { id: 'y2-stats', title: 'Charts & Tallies', icon: '📊', subject: 'maths', year: 'year2', nc: 'Y2 Statistics: pictograms, tally charts, block diagrams', gen: y2Stats },
  // Year 2 writing
  { id: 'y2-spelling', title: 'Tricky Words', icon: '🧠', subject: 'writing', year: 'year2', nc: 'Y2 common exception words', sequenceFrom: 3, gen: y2Spelling },
  { id: 'y2-contractions', title: "Contractions don't", icon: '✂️', subject: 'writing', year: 'year2', nc: 'Y2 Spelling: contractions', gen: y2Contractions },
  { id: 'y2-suffix', title: 'Endings -ful -ly', icon: '🎀', subject: 'writing', year: 'year2', nc: 'Y2 Spelling: suffixes', gen: y2Suffix },
  { id: 'y2-suffix-root', title: 'Changing Endings', icon: '🔁', subject: 'writing', year: 'year2', nc: 'Y2 Spelling: suffixes that change the root (drop e, double, y→i)', gen: y2SuffixRoot },
  { id: 'y2-homophones', title: 'Sound-alike Words', icon: '👂', subject: 'writing', year: 'year2', nc: 'Y2 Spelling: homophones', gen: y2Homophones },
  { id: 'y2-wordclass', title: 'Word Detective', icon: '🔍', subject: 'writing', year: 'year2', nc: 'Y2 Grammar: nouns, verbs, adjectives, adverbs', gen: y2WordClass },
  { id: 'y2-sentencetype', title: 'Sentence Types', icon: '💬', subject: 'writing', year: 'year2', nc: 'Y2 Grammar: statements, questions, commands and exclamations', gen: y2SentenceType },
  { id: 'y2-tense', title: 'Then & Now', icon: '⏳', subject: 'writing', year: 'year2', nc: 'Y2 Grammar: present and past tense, including the progressive', gen: y2Tense },
  { id: 'y2-punct', title: 'Fix the Sentence', icon: '❗', subject: 'writing', year: 'year2', nc: 'Y2 Grammar: commas, apostrophes', gen: y2Punct },
  { id: 'y2-sentence', title: 'Story Sentences', icon: '📖', subject: 'writing', year: 'year2', nc: 'Y2 Writing: word order, conjunctions, noun phrases', sequenceFrom: 1, gen: y2Sentence },
  { id: 'y2-trace', title: 'Trace Words', icon: '✍️', subject: 'writing', year: 'year2', nc: 'Y2 Handwriting', input: 'tracing', gen: y2Trace },
];
