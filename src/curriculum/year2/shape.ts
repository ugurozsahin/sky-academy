// Year 2 shape, position, symmetry and repeating patterns. Split out of year2.ts (#1416); index.ts re-exports every name.
import { type Generator, type Rng } from '../types';
import { ri, pick, shuffle, numQ, wordQ, SHAPES_3D, name3dQ, balanceQ, DIRS, ARROWS, TURNS_ALL, turnEnd } from '../util';

/** Year 2: "identify and describe the properties of 3-D shapes, including the number of edges, vertices and faces". */
export const y2Shapes: Generator = (d, rng) => {
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
export const y2Balance: Generator = (d, rng) => {
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
export const y2Position: Generator = (d, rng) => {
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
export const y2Symmetry: Generator = (d, rng) => {
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
export const y2Patterns: Generator = (d, rng) => {
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
