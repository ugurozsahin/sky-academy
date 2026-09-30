// Year 1 topics: National Curriculum KS1, maths and English alike.
// #325 stage 4: the curriculum used to be split by subject (maths.ts/writing.ts); this file holds every
// Year 1 generator so a reviewer checking "is Year 1 right" reads one file. Generators shared with
// Reception/Year 2 live in util.ts.
import type { Generator, Topic, Difficulty } from './types';
import { LONGER, TALLER, HEAVIER, HOLDS } from './types';
import {
  ri, pick, shuffle, numQ, wordQ, q, numberWord, coinLabel, isNote, NOTES,
  SHAPES_2D, SHAPES_3D, sameShape,
  orderQ, lineQ, name3dQ, balanceQ, measureCompare, unitQ,
  DIRS, ARROWS, TURNS_ALL, turnEnd, DAYS,
  gapLetters, gapQ, spellQ, sentGen, type Sent, PUNCT_SENTS, LETTERS, CVC, DIGRAPHS, Y1_CEW,
  soundQ, PHASE3, PHASE5, SPLIT,
} from './util';

// ---------- Year 1 maths ----------
const y1Bonds: Generator = (d, rng) => {
  const total = d === 1 ? 10 : d === 2 ? pick(rng, [10, 12, 15]) : 20;
  const a = ri(rng, 0, total);
  const missingLeft = rng() < 0.4;
  const p = missingLeft ? `? + ${a} = ${total}` : `${a} + ? = ${total}`;
  return numQ(rng, p, total - a, { min: 0, max: 20, ...q(p), visual: total <= 10 ? { type: 'tenframe', n: a } : undefined });
};
const y1Add: Generator = (d, rng) => {
  const max = d === 1 ? 10 : d === 2 ? 15 : 20;
  const a = ri(rng, 0, max), b = ri(rng, 0, max - a);
  const p = `${a} + ${b} = ?`;
  return numQ(rng, p, a + b, { min: 0, max: 20, ...q(p) });
};
/**
 * #981: Year 1 must "solve one-step problems ... using concrete objects and pictorial representations"
 * (KS1 maths PoS) — `y1Add`/`y1Sub`/`y1Missing` above are all bare number sentences, so this is the first
 * problem-in-context topic in the game. Every number *written* in the story is 2 or more (no "1 ducks"); the
 * generator's own bounds (`a,b,left ≥ 2` with `b/left ≤ a − 2`) mean the *answer* is always achievable in
 * 2–20 in practice, never actually 0 or 1, though `numQ` is still given the full `min: 0` floor rather than a
 * tighter one that would need re-deriving per kind.
 */
export interface StoryFrame { emoji: string; noun: string; place: string; join: string; leave: string }
export const Y1_STORY_BANK: StoryFrame[] = [
  { emoji: '🦆', noun: 'ducks', place: 'on the pond', join: 'more swim over', leave: 'fly away' },
  { emoji: '🐦', noun: 'birds', place: 'in the tree', join: 'more land nearby', leave: 'fly away' },
  { emoji: '🐝', noun: 'bees', place: 'in the garden', join: 'more buzz in', leave: 'buzz off' },
  { emoji: '🐟', noun: 'fish', place: 'in the tank', join: 'more swim in', leave: 'swim away' },
  { emoji: '🐸', noun: 'frogs', place: 'by the pond', join: 'more hop in', leave: 'hop away' },
  { emoji: '🐑', noun: 'sheep', place: 'in the field', join: 'more wander in', leave: 'wander off' },
  { emoji: '🐜', noun: 'ants', place: 'by the nest', join: 'more march in', leave: 'march away' },
  { emoji: '🦋', noun: 'butterflies', place: 'in the meadow', join: 'more flutter in', leave: 'flutter away' },
];
const y1Story: Generator = (d, rng) => {
  const max = d === 1 ? 10 : 20;
  const bank = pick(rng, Y1_STORY_BANK);
  const kind = d === 3 ? ri(rng, 0, 2) : ri(rng, 0, 1); // 0 add, 1 take away, 2 missing part (d3 only)
  const n = d === 1 ? 2 : 3;
  if (kind === 2) {
    const a = ri(rng, 4, max), left = ri(rng, 2, a - 2), eaten = a - left;
    const p = `${a} ${bank.noun} ${bank.place}. ${left} are left. How many ${bank.leave}?`;
    // The picture has to carry the same "concrete objects" weight as the add/take-away forms below: crossing
    // out exactly the `eaten` group (review finding) leaves the stated `left` count showing normally, the
    // same cross-out `fiveFrames()` already draws for an ordinary take-away — a bare `n: a` with no `n2` (the
    // first version of this branch) drew a uniform group with nothing for the story's "are left" to point at.
    return numQ(rng, p, eaten, { min: 0, max: 20, n, say: p, visual: { type: 'objects', emoji: bank.emoji, n: a, n2: -eaten }, distractors: [a + left, a, eaten + 1, eaten - 1] });
  }
  if (kind === 1) {
    const a = ri(rng, 4, max), b = ri(rng, 2, a - 2), answer = a - b;
    const p = `${a} ${bank.noun} ${bank.place}. ${b} ${bank.leave}. How many now?`;
    return numQ(rng, p, answer, { min: 0, max: 20, n, say: p, visual: { type: 'objects', emoji: bank.emoji, n: a, n2: -b }, distractors: [a + b, a, answer + 1, answer - 1] });
  }
  const a = ri(rng, 2, max - 2), b = ri(rng, 2, max - a), answer = a + b;
  const p = `${a} ${bank.noun} ${bank.place}. ${b} ${bank.join}. How many now?`;
  return numQ(rng, p, answer, { min: 0, max: 20, n, say: p, visual: { type: 'objects', emoji: bank.emoji, n: a, n2: b }, distractors: [Math.abs(a - b), Math.max(a, b), answer + 1, answer - 1] });
};
const y1Sub: Generator = (d, rng) => {
  const max = d === 1 ? 10 : d === 2 ? 15 : 20;
  const a = ri(rng, 1, max), b = ri(rng, 0, a);
  const p = `${a} − ${b} = ?`;
  return numQ(rng, p, a - b, { min: 0, max: 20, ...q(p) });
};
const y1Missing: Generator = (d, rng) => {
  const max = d === 1 ? 10 : 20;
  const a = ri(rng, 1, max), b = ri(rng, 0, a);
  const kind = ri(rng, 0, 2);
  const p = kind === 0 ? `${b} + ? = ${a}` : kind === 1 ? `${a} − ? = ${b}` : `? − ${b} = ${a - b}`;
  const ans = kind === 0 ? a - b : kind === 1 ? a - b : a;
  return numQ(rng, p, ans, { min: 0, max: 20, ...q(p) });
};
const y1Skip: Generator = (d, rng) => {
  const step = d === 1 ? 2 : d === 2 ? pick(rng, [2, 5, 10]) : pick(rng, [2, 5, 10]);
  // The answer is the fourth term, so the start has to leave room for three more steps inside the `max: 100`
  // this question declares (#366). It did not: `step * 8` in tens started at 80, so "80, 90, 100, ?" answered
  // 110 — past Year 1's ceiling of 100 (`docs/CURRICULUM.md`: "count in 2s/5s/10s" to 100) and past the
  // declared `max`, which is the worse half: `numQ` filters the decoys against that range, so 111, 109 and 120
  // were all dropped and the card offered 0, 1, 100 and 110. The three-digit bubble was the only one it could
  // be, which teaches slicing the odd-looking one. `100 / step - 3` is the highest start that keeps the fourth
  // term at or under 100; it only binds on the tens, where d3 now stops at 70 instead of 80.
  const top = Math.min(d === 3 ? 8 : 4, Math.floor(100 / step) - 3);
  const start = step * ri(rng, 0, top);
  const seq = [start, start + step, start + step * 2];
  const p = `${seq.join(', ')}, ?`;
  const ans = start + step * 3;
  // The last two are tail spares, and only ever reached when the first three cannot all be used: at the top
  // of the range (`ans` = 100 in tens) `ans + 1` and `ans + step` are both filtered out, and `numQ`'s top-up
  // can then collide with `ans - 1` and hand the child a three-bubble card. Named decoys keep them near
  // misses rather than whatever `nearby()` scrapes together (#366).
  return numQ(rng, p, ans, { min: 0, max: 100, say: `Counting in ${step}s: ${seq.join(', ')}, what comes next?`, distractors: [ans + 1, ans - 1, ans + step, ans - step + 1, ans - 2] });
};
const y1MoreLess: Generator = (d, rng) => {
  const n = ri(rng, 1, d === 1 ? 30 : d === 2 ? 60 : 99);
  const more = rng() < 0.5;
  return numQ(rng, `One ${more ? 'more' : 'less'} than ${n}?`, more ? n + 1 : n - 1, { min: 0, max: 100 });
};
const y1Words: Generator = (d, rng) => {
  const n = ri(rng, d === 1 ? 1 : 10, d === 3 ? 20 : d === 2 ? 15 : 10);
  if (rng() < 0.5) return numQ(rng, numberWord(n), n, { min: 0, max: 20, say: `Which number is ${numberWord(n)}?`, visual: { type: 'word', text: numberWord(n) } });
  // At the top of the range (n = 20, only reachable at d3) both n+1 and n+2 fall outside [0,20], leaving only
  // two neighbours — a card with three bubbles instead of four (#462 rail). n±3 is there as a fourth
  // candidate so a boundary this tight never runs the pool short; unreachable in the middle of the range,
  // where the first four already give three or more.
  const ds = shuffle(rng, [n - 1, n + 1, n + 2, n - 2, n - 3, n + 3].filter(x => x >= 0 && x <= 20)).slice(0, 3).map(numberWord);
  return wordQ(rng, `${n}`, numberWord(n), ds, { say: `Which word says ${n}?`, hint: 'Slice the word', hintIsData: false });
};
const y1Half: Generator = (d, rng) => {
  const quarter = d >= 2 && rng() < 0.5;
  const n = quarter ? 4 * ri(rng, 1, d === 3 ? 5 : 3) : 2 * ri(rng, 1, d === 1 ? 5 : 10);
  const ans = quarter ? n / 4 : n / 2;
  return numQ(rng, `${quarter ? 'A quarter' : 'Half'} of ${n} = ?`, ans, { min: 0, max: 20, visual: { type: 'objects', emoji: '🍪', n }, say: `What is ${quarter ? 'a quarter' : 'half'} of ${n}?` });
};
/**
 * Year 1's addition stops at 20, so doubling stops at double 10 (#298 slice 5). d3 used to roll up to 12 and
 * answer 24, with `max: 24` letting the decoys out of range as well.
 *
 * Capping alone would have made d3 the same draw as d2 (both 1–10), so d3 keeps its stretch by taking the
 * *top half* of the same range — the doubles a child reaches for last — rather than a wider one.
 */
const y1Doubles: Generator = (d, rng) => {
  const n = d === 1 ? ri(rng, 1, 5) : d === 2 ? ri(rng, 1, 10) : ri(rng, 6, 10);
  const p = `Double ${n} = ?`;
  return numQ(rng, p, n * 2, { min: 0, max: 20, visual: d === 1 ? { type: 'tenframe', n, n2: n } : undefined, ...q(p) });
};
const COINS = [1, 2, 5, 10, 20, 50, 100, 200];
/**
 * The notes Year 1 recognises beside the coins — the programme of study says "coins **and notes**" (#298
 * slice 4). Held in pence like every other denomination, so `coinLabel` writes `£5`/`£10` from the same
 * source that writes `50p`, and `coinSVG` draws them from the same table. `NOTES` itself lives in `util.ts`
 * (#361), so this pool and `visuals.ts`'s rendering can't name the two notes differently.
 */
const MONEY: readonly number[] = [...COINS, ...NOTES];
/** Year 1's addition stops at 20, so d3 adds two coins drawn from these — the largest pair is 10p + 10p. */
const Y1_ADD_COINS = [1, 2, 5, 10];
/**
 * Year 1 money (#298 slice 4). The programme asks only to "recognise and know the value of different
 * denominations of coins and notes": combining coins to a total is Year 2's "find different combinations of
 * coins that equal the same amounts of money", and Year 1 addition stops at 20. So the topic recognises one
 * denomination (d1), compares two coins (d2), and adds two coins to at most 20p (d3) — it no longer totals
 * three coins to 60p.
 */
const y1Coins: Generator = (d, rng) => {
  if (d === 1) {
    const c = pick(rng, MONEY);
    const kind = isNote(c) ? 'note' : 'coin';
    return wordQ(rng, `Which ${kind} is this?`, coinLabel(c), shuffle(rng, MONEY.filter(x => x !== c)).slice(0, 3).map(coinLabel), { visual: { type: 'coins', coins: [c] }, say: `How much is this ${kind} worth?` });
  }
  if (d === 2) {
    // Compare two coins by value. Notes stay at d1: the owner's decision is "which is worth more?" between
    // two *coins*, and `£10` against `2p` compares nothing a child has to think about.
    const [a, b] = shuffle(rng, COINS).slice(0, 2);
    const more = rng() < 0.5;
    const want = more ? Math.max(a, b) : Math.min(a, b);
    return wordQ(rng, `Which is worth ${more ? 'more' : 'less'}?`, coinLabel(want), [coinLabel(want === a ? b : a)], {
      visual: { type: 'coins', coins: [a, b] },
      say: `${coinLabel(a)} or ${coinLabel(b)}. Which is worth ${more ? 'more' : 'less'}?`,
    });
  }
  const coins = [pick(rng, Y1_ADD_COINS), pick(rng, Y1_ADD_COINS)];
  return unitQ(rng, coins.reduce((s, c) => s + c, 0), coins, 20);
};
const y1Time: Generator = (d, rng) => {
  const h = ri(rng, 1, 12);
  const half = d >= 2 && rng() < 0.5;
  const ans = half ? `half past ${h}` : `${h} o'clock`;
  const others = shuffle(rng, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].filter(x => x !== h)).slice(0, 3).map(x => (half ? `half past ${x}` : `${x} o'clock`));
  if (d === 3 && rng() < 0.5) others[0] = half ? `${h} o'clock` : `half past ${h}`;
  return wordQ(rng, 'What time is it?', ans, others, { visual: { type: 'clock', h, m: half ? 30 : 0 } });
};
const y1Arrays: Generator = (d, rng) => {
  const rows = ri(rng, 2, d === 1 ? 2 : 3), cols = ri(rng, 2, d === 1 ? 5 : d === 3 ? 5 : 4);
  return numQ(rng, `${rows} rows of ${cols} = ?`, rows * cols, { min: 2, max: 20, visual: { type: 'array', rows, cols }, say: `${rows} rows of ${cols}. How many altogether?` });
};
const y1Order: Generator = (d, rng) => orderQ(rng, d === 1 ? 10 : 20, d === 3 ? 4 : 3);
const y1Line: Generator = (d, rng) => lineQ(rng, d === 1 ? 0 : ri(rng, 0, d === 2 ? 10 : 90), 1, 6);

/** Shapes (2-D) — properties and recognition. Tables live in util.ts (SHAPES_2D/SHAPES_3D). */
const y1Shapes: Generator = (d, rng) => {
  const [g, name, sides] = pick(rng, SHAPES_2D);
  if (d === 1 || (d === 2 && rng() < 0.5)) return wordQ(rng, `Which is a ${name}?`, g, shuffle(rng, SHAPES_2D.filter(x => !sameShape(x[1], name))).slice(0, 3).map(x => x[0]), { hint: 'Slice the shape', hintIsData: false });
  if (sides === 0) return y1Shapes(d, rng);
  return numQ(rng, `How many sides has a ${name}?`, sides, { min: 0, max: 8, visual: { type: 'word', text: g }, distractors: [sides + 1, sides - 1, sides + 2] });
};
/** Year 1: "recognise and name common 3-D shapes (cuboids including cubes, pyramids and spheres)" — names only. */
const Y1_SOLIDS = SHAPES_3D.filter(([, name]) => ['cube', 'cuboid', 'pyramid', 'sphere'].includes(name));
const y1Shapes3d: Generator = (d, rng) => name3dQ(rng, d === 3 ? SHAPES_3D : Y1_SOLIDS, d === 1 || rng() < 0.5);

const TURNS_Y1: [string, number][] = [['a quarter turn', 1], ['a half turn', 2], ['a whole turn', 4]];
const y1Position: Generator = (d, rng) => {
  const kind = d === 1 ? ri(rng, 0, 1) : ri(rng, 0, 2);
  if (kind === 0) {                                              // name the way an arrow points
    const [word, arrow] = pick(rng, DIRS);
    return wordQ(rng, `Which way does ${arrow} point?`, word, DIRS.map(x => x[0]).filter(w => w !== word), { say: 'Which way does the arrow point? Up, down, left or right?', hint: 'Slice the word', hintIsData: false });
  }
  if (kind === 1) {                                              // pick the arrow for a direction
    const [word, arrow] = pick(rng, DIRS);
    return wordQ(rng, `Which arrow points ${word}?`, arrow, ARROWS.filter(a => a !== arrow), { say: `Which arrow points ${word}?`, hint: 'Slice the arrow', hintIsData: false });
  }
  const [name, steps] = pick(rng, d === 3 ? TURNS_ALL : TURNS_Y1);   // where do you face after a turn?
  const cw = rng() < 0.5, start = ri(rng, 0, 3), end = turnEnd(start, steps, cw);
  return wordQ(rng, `Face ${DIRS[start][1]}, then ${name} ${cw ? 'clockwise' : 'anti-clockwise'}. Which way now?`, DIRS[end][1], ARROWS.filter(a => a !== DIRS[end][1]), {
    say: `You are facing ${DIRS[start][0]}. Make ${name} ${cw ? 'clockwise' : 'anti-clockwise'}. Which way are you facing now?`, hint: 'Slice the arrow', hintIsData: false,
  });
};

const y1Length: Generator = (d, rng) => rng() < 0.5
  ? measureCompare(rng, d, pick(rng, ['pencil', 'ribbon', 'snake', 'straw', 'scarf']), 'cm', LONGER, d === 1 ? 3 : 5, d === 1 ? 12 : 40)
  : measureCompare(rng, d, pick(rng, ['sunflower', 'tower', 'ladder', 'plant']), 'cm', TALLER, d === 1 ? 5 : 10, d === 1 ? 20 : 60);
const y1Mass: Generator = (d, rng) =>
  measureCompare(rng, d, pick(rng, ['bag', 'parcel', 'box', 'basket']), 'g', HEAVIER, d === 1 ? 5 : 20, d === 1 ? 30 : 100);
// d2–d3 used to roll 50–500 ml, which put three-digit numbers on a Year 1 card; Year 1's numbers stop at 100
// (#298 slice 5). Capped to match `y1Mass` beside it, which already stopped at 100.
const y1Capacity: Generator = (d, rng) =>
  measureCompare(rng, d, pick(rng, ['jug', 'cup', 'bottle', 'bucket']), 'ml', HOLDS, d === 1 ? 10 : 50, d === 1 ? 90 : 100);
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const y1Months: Generator = (d, rng) => {
  const kind = d === 1 ? ri(rng, 0, 1) : ri(rng, 0, 2);
  if (kind === 0) { const i = ri(rng, 0, 6), after = rng() < 0.5, ans = DAYS[(i + (after ? 1 : 6)) % 7]; return wordQ(rng, `Which day comes ${after ? 'after' : 'before'} ${DAYS[i]}?`, ans, shuffle(rng, DAYS.filter(x => x !== ans)).slice(0, 3), { say: `Which day comes ${after ? 'after' : 'before'} ${DAYS[i]}?` }); }
  if (kind === 1) { const [phrase, n] = pick(rng, [['days in a week', 7], ['months in a year', 12], ['seasons in a year', 4], ['days in a weekend', 2]] as [string, number][]); return numQ(rng, `How many ${phrase}?`, n, { min: 0, max: 20, say: `How many ${phrase}?`, distractors: [n + 1, n - 1, n + 2] }); }
  const i = ri(rng, 0, 11), after = rng() < 0.5, ans = MONTHS[(i + (after ? 1 : 11)) % 12];
  return wordQ(rng, `Which month comes ${after ? 'after' : 'before'} ${MONTHS[i]}?`, ans, shuffle(rng, MONTHS.filter(x => x !== ans)).slice(0, 3), { say: `Which month comes ${after ? 'after' : 'before'} ${MONTHS[i]}?` });
};
const y1Balance: Generator = (d, rng) => {
  if (d === 1) { const a = ri(rng, 1, 9), b = ri(rng, 1, 10 - a); return rng() < 0.5 ? balanceQ(rng, `${a} + ${b}`, '?', a + b, 20) : balanceQ(rng, '?', `${a} + ${b}`, a + b, 20); }
  const a = ri(rng, 1, 15), b = ri(rng, 1, 20 - a), total = a + b;
  const kind = d === 2 ? ri(rng, 0, 1) : ri(rng, 0, 3);
  if (kind === 0) { const c = ri(rng, 1, total - 1); return balanceQ(rng, `${a} + ${b}`, `${c} + ?`, total - c, 20, { distractors: [total, c] }); }
  if (kind === 1) { const c = ri(rng, 1, total - 1); return balanceQ(rng, `${a} + ${b}`, `? + ${c}`, total - c, 20, { distractors: [total, c] }); }
  if (kind === 2 && total < 20) { const c = ri(rng, 1, 20 - total); return balanceQ(rng, `${a} + ${b}`, `? − ${c}`, total + c, 20, { distractors: [total, total - c] }); }
  const big = ri(rng, 5, 20), small = ri(rng, 1, big - 1), c = ri(rng, 1, big - small);
  return balanceQ(rng, `${big} − ${small}`, `? + ${c}`, big - small - c, 20, { distractors: [big - small, big] });
};

// ---------- Year 1 writing ----------
const y1SoundHunt: Generator = (d, rng) => d === 1 ? soundQ(rng, PHASE3, PHASE3, 2) : d === 2 ? soundQ(rng, PHASE5, [...PHASE3, ...PHASE5], 3) : soundQ(rng, [...PHASE5, ...SPLIT], [...PHASE3, ...PHASE5, ...SPLIT], 3);
const DIGRAPH_WORDS: [string, string, string][] = [['ship', 'sh', '🚢'], ['fish', 'sh', '🐟'], ['chip', 'ch', '🍟'], ['chick', 'ch', '🐤'], ['moth', 'th', '🦋'], ['bath', 'th', '🛁'], ['ring', 'ng', '💍'], ['king', 'ng', '👑'], ['rain', 'ai', '🌧️'], ['boat', 'oa', '⛵'], ['moon', 'oo', '🌙'], ['tree', 'ee', '🌳'], ['oil', 'oi', '🛢️'], ['cow', 'ow', '🐮'], ['star', 'ar', '⭐'], ['fork', 'or', '🍴'], ['bee', 'ee', '🐝'], ['sheep', 'ee', '🐑'], ['snail', 'ai', '🐌'], ['goat', 'oa', '🐐'], ['shark', 'ar', '🦈'], ['whale', 'wh', '🐋']];
/** Exported for the `y1-digraphs` reachable-spelling fixture (#445). */
export { DIGRAPH_WORDS };
const y1Digraphs: Generator = (d, rng) => {
  const [w, dg, e] = pick(rng, DIGRAPH_WORDS);
  const idx = w.indexOf(dg);
  const shown = w.slice(0, idx) + '__' + w.slice(idx + 2);
  const ds = shuffle(rng, DIGRAPHS.filter(x => x !== dg)).slice(0, d === 1 ? 2 : 3);
  return wordQ(rng, shown, dg, ds, { visual: { type: 'word', text: shown, emoji: e }, say: `${w}. Which two letters are missing from ${w}?`, hint: 'Slice the missing sound', hintIsData: false });
};
/**
 * "Real or Alien?" (#982): decode a *printed* word rather than a grapheme heard aloud — the Phonics
 * Screening Check's other half. Both banks are hand-curated, never generated: a denylist check on a
 * generated string would not catch a genuine real word slipping into the alien bank. Phase tag `1`/`2`/`3`
 * matches this topic's own difficulty (phase 3 at d1, phase 4 adjacent consonants at d2, phase 5
 * alternatives at d3) — never generate a pseudo-word; every `ALIEN_FAKE` entry is checked against `AVOID`
 * and `GAP_WORDS` in `tests/unit/topic-y1-alien.test.ts`.
 */
const ALIEN_REAL: [string, Difficulty][] = [
  ['ship', 1], ['fish', 1], ['chip', 1], ['chin', 1], ['moth', 1], ['bath', 1], ['ring', 1], ['king', 1], ['rain', 1], ['boat', 1], ['moon', 1], ['tree', 1], ['coin', 1], ['star', 1], ['fork', 1],
  ['stop', 2], ['jump', 2], ['crab', 2], ['frog', 2], ['plan', 2], ['swim', 2], ['desk', 2], ['nest', 2], ['milk', 2], ['fast', 2], ['hand', 2], ['lamp', 2], ['gift', 2], ['drum', 2], ['clap', 2],
  ['day', 3], ['play', 3], ['say', 3], ['out', 3], ['cloud', 3], ['pie', 3], ['leaf', 3], ['beach', 3], ['boy', 3], ['toy', 3], ['girl', 3], ['blue', 3], ['cake', 3], ['bike', 3], ['home', 3],
];
/** Decodable pseudo-words. Never a real word, a slur or a sound-alike of one (`tests/unit/topic-y1-alien.test.ts`). */
const ALIEN_FAKE: [string, Difficulty][] = [
  ['chov', 1], ['helk', 1], ['shig', 1], ['zesp', 1], ['nolp', 1], ['zeeg', 1], ['zark', 1], ['toop', 1], ['nolt', 1], ['zelk', 1], ['yurk', 1], ['morv', 1], ['zelp', 1], ['zosk', 1], ['feeg', 1],
  ['stog', 2], ['flep', 2], ['crun', 2], ['drep', 2], ['plek', 2], ['zolp', 2], ['delk', 2], ['nelt', 2], ['mulf', 2], ['fost', 2], ['zelt', 2], ['zamp', 2], ['dulg', 2], ['zunt', 2], ['glap', 2],
  ['zof', 3], ['zout', 3], ['chig', 3], ['nolk', 3], ['zom', 3], ['mirt', 3], ['zirn', 3], ['vesk', 3], ['whep', 3], ['phik', 3], ['zesk', 3], ['noup', 3], ['zaup', 3], ['zebe', 3], ['dorv', 3],
];
/** Exported for `tests/unit/topic-y1-alien.test.ts` (#982), which walks both banks against `AVOID`/`GAP_WORDS`. */
export { ALIEN_REAL, ALIEN_FAKE };
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
const y1Alien: Generator = (d, rng) => {
  const reals = ALIEN_REAL.filter(([, p]) => p === d).map(([w]) => w);
  const fakes = ALIEN_FAKE.filter(([, p]) => p === d).map(([w]) => w);
  const n = d === 1 ? 3 : 4;
  if (d === 3 && rng() < 0.5) {
    const target = pick(rng, fakes);
    const decoys = shuffle(rng, reals).slice(0, n - 1);
    return wordQ(rng, 'Which one is the alien word? 👾', target, decoys, {
      say: `${cap(numberWord(decoys.length))} of these ${decoys.length === 1 ? 'is a real word' : 'are real words'}. Slice the alien word 👾!`,
      hint: 'Which one is not a real word?', hintIsData: false,
    });
  }
  const target = pick(rng, reals);
  const decoys = shuffle(rng, fakes).slice(0, n - 1);
  return wordQ(rng, 'Which one is the real word?', target, decoys, {
    say: `${cap(numberWord(decoys.length))} of these ${decoys.length === 1 ? 'is an alien word' : 'are alien words'}. Slice the real word!`,
    hint: 'Which one is a real word?', hintIsData: false,
  });
};
const y1Spelling: Generator = (d, rng) => {
  const w = pick(rng, Y1_CEW.filter(x => x.length >= (d === 1 ? 2 : 3) && x.length <= (d === 3 ? 6 : 4)));
  if (d === 3 && rng() < 0.5) return spellQ(rng, w, undefined, 3);
  const idx = ri(rng, 0, w.length - 1);
  return gapQ(rng, w, idx, gapLetters(w, idx), undefined, `Which letter is missing from the word ${w}?`);
};
const y1Plurals: Generator = (d, rng) => {
  const S: [string, string][] = [['cat', 's'], ['dog', 's'], ['book', 's'], ['hat', 's'], ['car', 's'], ['tree', 's'], ['fox', 'es'], ['box', 'es'], ['bus', 'es'], ['dish', 'es'], ['bench', 'es'], ['wish', 'es'], ['glass', 'es'], ['brush', 'es']];
  const [w, suf] = pick(rng, d === 1 ? S.filter(x => x[1] === 's') : S);
  return wordQ(rng, `one ${w}, two ${w}__`, suf, ['s', 'es', 'ies'], { visual: { type: 'word', text: `${w}_` }, say: `One ${w}, two ${w}${suf}. Which ending makes it more than one?`, hint: 'Add -s or -es', hintIsData: false });
};
const y1Suffix: Generator = (_d, rng) => {
  const W: [string, string, string][] = [['jump', 'ing', 'She is jump___ now.'], ['play', 'ed', 'Yesterday he play___.'], ['walk', 'ing', 'I am walk___ to school.'], ['look', 'ed', 'We look___ at the sky.'], ['fast', 'er', 'A car is fast___ than a bike.'], ['tall', 'est', 'The tall___ tree in the park.'], ['help', 'ing', 'Dad is help___ me.'], ['kick', 'ed', 'He kick___ the ball yesterday.'], ['kind', 'er', 'Be kind___ to your friends.'], ['small', 'est', 'The small___ mouse of all.']];
  const [, suf, sent] = pick(rng, W);
  return wordQ(rng, sent, suf, ['ing', 'ed', 'er', 'est'], { visual: { type: 'sentence', text: sent }, say: sent.replace('___', 'blank'), hint: 'Slice the ending', hintIsData: false });
};
const y1Punct: Generator = (d, rng) => {
  if (d === 1 || (d === 2 && rng() < 0.5)) {
    const [s, p] = pick(rng, PUNCT_SENTS);
    const words = s.split(' ');
    const lower = words[0].toLowerCase() + (words.length > 1 ? ' ' + words.slice(1).join(' ') : '') + p;
    const ans = words[0];
    const ds = shuffle(rng, [words[0].toLowerCase(), words[0].toUpperCase(), (words[1] ?? 'It')]).filter(x => x !== ans).slice(0, 2);
    return wordQ(rng, `_${lower.slice(words[0].length)}`, ans, ds, { visual: { type: 'sentence', text: lower }, say: `Which word starts the sentence: ${s}?`, hint: 'Sentences start with a capital letter', hintIsData: false });
  }
  const [s, p] = pick(rng, PUNCT_SENTS);
  return wordQ(rng, `${s}_`, p, ['.', '?', '!'], { visual: { type: 'sentence', text: `${s}_` }, say: `${s}. Full stop, question mark or exclamation mark?`, hint: 'Slice the missing punctuation', hintIsData: false });
};
const y1Days: Generator = (d, rng) => {
  const day = pick(rng, DAYS);
  if (d === 3) return spellQ(rng, day, '📅', 3);   // days keep their capital letter (Y1 grammar)
  const idx = ri(rng, 1, Math.min(4, day.length - 1));
  return gapQ(rng, day, idx, gapLetters(day, idx), '📅', `Which letter is missing from ${day}?`);
};
const Y1_SENTS: Sent[][] = [
  [['The frog can jump high.', '🐸'], ['My mum has a red car.', '🚗'], ['We like to play outside.', '⚽'], ['The little bird can sing.', '🐦'], ['I have two pet fish.', '🐟'], ['The ship sails on the sea.', '🚢'], ['Can you see the rainbow?', '🌈'], ['The king has a gold crown.', '👑'], ['We went to the park.', '🌳'], ['My friend has a kite.', '🪁']],
  [['The little dog ran very fast.', '🐶'], ['We had chips for our tea.', '🍟'], ['Can you find my blue sock?', '🧦'], ['The moon shines at night.', '🌙'], ['I love to read in bed.', '📖'], ['The sheep are in the field.', '🐑'], ['My dad made a big cake.', '🎂'], ['Is it raining today?', '🌧️'], ['The snail moved along slowly.', '🐌'], ['Look at that huge whale!', '🐋']],
  [['The cat and the dog play.', '🐱'], ['We ran and jumped in the park.', '🌳'], ['I like apples and pears.', '🍎'], ['Is it a bird or an aeroplane?', '✈️'], ['She sang and we all clapped.', '🎤'], ['The boat rocked and the fish jumped.', '⛵'], ['Put on your coat and hat.', '🧥'], ['What a lovely sunny day!', '☀️'], ['He fell but he was fine.', '🩹'], ['We can swim or hop today.', '🏊']],
];
const Y1_DECOYS = ['dog', 'cat', 'play', 'red', 'big', 'run', 'jump', 'fish', 'moon', 'park', 'cake', 'ship', 'hat', 'blue', 'fast', 'sing', 'apple', 'coat'];
const y1Sentence = sentGen(Y1_SENTS, Y1_DECOYS, [2, 2, 2], 1);       // Y1/Y2: sentence shown at d1 only, then listen & build
const y1Trace: Generator = (d, rng) => {
  if (d === 3) { const [w, e] = pick(rng, CVC); return { prompt: `Trace: ${w}`, say: `Trace the word ${w}`, answer: w, options: [w], visual: { type: 'word', text: w, emoji: e } }; }
  const l = pick(rng, LETTERS);
  const t = d === 2 && rng() < 0.5 ? l.toUpperCase() : l;
  return { prompt: `Trace the letter ${t}`, say: `Trace the letter ${l}`, answer: t, options: [t], visual: { type: 'word', text: t } };
};

export const YEAR1_TOPICS: Topic[] = [
  // Year 1 maths
  { id: 'y1-bonds', title: 'Number Bonds', icon: '🔗', subject: 'maths', year: 'year1', nc: 'Y1 A&S: bonds within 20', gen: y1Bonds },
  { id: 'y1-add', title: 'Adding to 20', icon: '➕', subject: 'maths', year: 'year1', nc: 'Y1 A&S: add within 20', gen: y1Add },
  { id: 'y1-story', title: 'Story Sums', icon: '🦆', subject: 'maths', year: 'year1', nc: 'Y1 A&S: one-step problems, objects and pictures', gen: y1Story },
  { id: 'y1-sub', title: 'Subtracting', icon: '➖', subject: 'maths', year: 'year1', nc: 'Y1 A&S: subtract within 20', gen: y1Sub },
  { id: 'y1-missing', title: 'Missing Number', icon: '❓', subject: 'maths', year: 'year1', nc: 'Y1 A&S: missing number problems', gen: y1Missing },
  { id: 'y1-doubles', title: 'Doubles', icon: '👯', subject: 'maths', year: 'year1', nc: 'Y1 A&S: doubles', gen: y1Doubles },
  { id: 'y1-skip', title: 'Count in 2s, 5s, 10s', icon: '🦘', subject: 'maths', year: 'year1', nc: 'Y1 NPV: count in multiples', gen: y1Skip },
  { id: 'y1-moreless', title: 'One More, One Less', icon: '🔼', subject: 'maths', year: 'year1', nc: 'Y1 NPV: one more/less to 100', gen: y1MoreLess },
  { id: 'y1-words', title: 'Number Words', icon: '🔤', subject: 'maths', year: 'year1', nc: 'Y1 NPV: numbers to 20 in words', gen: y1Words },
  { id: 'y1-half', title: 'Halves & Quarters', icon: '🍕', subject: 'maths', year: 'year1', nc: 'Y1 Fractions: half, quarter', gen: y1Half },
  { id: 'y1-arrays', title: 'Arrays', icon: '🟦', subject: 'maths', year: 'year1', nc: 'Y1 M&D: arrays, grouping', gen: y1Arrays },
  { id: 'y1-coins', title: 'Coins', icon: '💷', subject: 'maths', year: 'year1', nc: 'Y1 Measurement: coins & notes', gen: y1Coins },
  { id: 'y1-time', title: "O'clock & Half Past", icon: '🕐', subject: 'maths', year: 'year1', nc: 'Y1 Measurement: time', gen: y1Time },
  { id: 'y1-order', title: 'Order Up!', icon: '📶', subject: 'maths', year: 'year1', nc: 'Y1 NPV: order numbers to 20', sequenceFrom: 1, gen: y1Order },
  { id: 'y1-line', title: 'Number Line', icon: '📏', subject: 'maths', year: 'year1', nc: 'Y1 NPV: number line', gen: y1Line },
  { id: 'y1-shapes', title: '2-D Shapes', icon: '🔷', subject: 'maths', year: 'year1', nc: 'Y1 Geometry: 2-D shapes', gen: y1Shapes },
  { id: 'y1-shapes3d', title: '3-D Shapes', icon: '🧊', subject: 'maths', year: 'year1', nc: 'Y1 Geometry: name common 3-D shapes', gen: y1Shapes3d },
  { id: 'y1-position', title: 'Left, Right & Turns', icon: '🧭', subject: 'maths', year: 'year1', nc: 'Y1 Geometry: position, direction, turns', gen: y1Position },
  { id: 'y1-length', title: 'Long & Tall', icon: '📏', subject: 'maths', year: 'year1', nc: 'Y1 Measurement: length & height', gen: y1Length },
  { id: 'y1-mass', title: 'Heavy & Light', icon: '🏋️', subject: 'maths', year: 'year1', nc: 'Y1 Measurement: mass/weight', gen: y1Mass },
  { id: 'y1-capacity', title: 'Full & Empty', icon: '🥤', subject: 'maths', year: 'year1', nc: 'Y1 Measurement: capacity & volume', gen: y1Capacity },
  { id: 'y1-months', title: 'Days & Months', icon: '📅', subject: 'maths', year: 'year1', nc: 'Y1 Measurement: time (days, weeks, months)', gen: y1Months },
  { id: 'y1-balance', title: 'Balance the Scales', icon: '⚖️', subject: 'maths', year: 'year1', nc: 'Y1 A&S: equals sign, missing number', gen: y1Balance },
  // Year 1 writing
  { id: 'y1-digraphs', title: 'Sound Pairs', icon: '🔤', subject: 'writing', year: 'year1', nc: 'Y1 Spelling: digraphs', gen: y1Digraphs },
  { id: 'y1-alien', title: 'Real or Alien?', icon: '👾', subject: 'writing', year: 'year1', nc: 'Y1 Word Reading: decode words containing taught GPCs, including some pseudo-words', gen: y1Alien },
  { id: 'y1-soundhunt', title: 'Sound Hunt', icon: '👂', subject: 'writing', year: 'year1', nc: 'Y1 Word Reading: respond speedily to graphemes; phase 3 & 5 alternatives, split digraphs', gen: y1SoundHunt },
  { id: 'y1-spelling', title: 'Tricky Words', icon: '🧠', subject: 'writing', year: 'year1', nc: 'Y1 common exception words', sequenceFrom: 3, gen: y1Spelling },
  { id: 'y1-plurals', title: 'Plurals -s -es', icon: '🐈', subject: 'writing', year: 'year1', nc: 'Y1 Spelling: plurals', gen: y1Plurals },
  { id: 'y1-suffix', title: 'Endings -ing -ed -er', icon: '🏃', subject: 'writing', year: 'year1', nc: 'Y1 Spelling: suffixes', gen: y1Suffix },
  { id: 'y1-punct', title: 'Fix the Sentence', icon: '❗', subject: 'writing', year: 'year1', nc: 'Y1 Grammar: capitals, . ? !', gen: y1Punct },
  { id: 'y1-days', title: 'Days of the Week', icon: '📅', subject: 'writing', year: 'year1', nc: 'Y1 Spelling: days', sequenceFrom: 3, gen: y1Days },
  { id: 'y1-sentence', title: 'Story Sentences', icon: '📖', subject: 'writing', year: 'year1', nc: 'Y1 Writing: sequence words into sentences, and', sequenceFrom: 1, gen: y1Sentence },
  { id: 'y1-trace', title: 'Trace Letters', icon: '✍️', subject: 'writing', year: 'year1', nc: 'Y1 Handwriting', input: 'tracing', gen: y1Trace },
];
