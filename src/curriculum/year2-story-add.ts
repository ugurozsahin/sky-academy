// y2-story-add (#994): short spoken story problems within 100, one step, adding or taking away, in one unit at most.
// The answer is the template's operation on the two numbers in the prompt, so a test can recompute it from the text.
import type { Difficulty, Generator, Question, Rng } from './types';
import { ri, pick, shuffle, numQ, wordQ, UNIT_WORD } from './util';

/** [unit, start, add, sub, question]. Each sentence holds one `#`, where its number (and unit) goes. */
export const BANK: [string, string, string, string, string][] = [
  ['', 'There are # children on a bus.', '# more get on.', '# get off.', 'How many now?'],
  ['', 'A farm has # hens.', '# more arrive.', '# are sold.', 'How many now?'],
  ['', 'A shop has # apples.', '# more arrive.', '# are sold.', 'How many now?'],
  ['', 'A park has # trees.', '# are planted.', '# are cut down.', 'How many now?'],
  ['', 'A box has # beads.', '# more go in.', '# come out.', 'How many now?'],
  ['', 'A class has # pencils.', '# more are bought.', '# are lost.', 'How many now?'],
  ['cm', 'A rope is # long.', '# is added.', '# is cut off.', 'How long now?'],
  ['m', 'A track is # long.', '# is added.', '# is closed.', 'How long now?'],
  ['ml', 'A jug has # of milk.', '# is added.', '# is drunk.', 'How much now?'],
  ['g', 'A bag has # of flour.', '# is added.', '# is used.', 'How much now?'],
  ['kg', 'A sack has # of rice.', '# is added.', '# is sold.', 'How much now?'],
  ['l', 'A tank has # of water.', '# is added.', '# is used.', 'How much now?'],
];
const COUNTS = BANK.filter(t => !t[0]), MEASURES = BANK.filter(t => t[0]);

/** d1: a 2-digit number and ones; d2: a 2-digit number and a multiple of 10; d3: two 2-digit numbers. */
function numbers(d: Difficulty, rng: Rng): { a: number; b: number; add: boolean; ans: number } {
  for (;;) {
    const a = ri(rng, d === 1 ? 11 : 20, 99), add = rng() < 0.5;
    const b = d === 1 ? ri(rng, 2, 9) : d === 2 ? 10 * ri(rng, 1, 5) : ri(rng, 11, 59);
    const ans = add ? a + b : a - b;
    if (ans >= 1 && ans <= 100) return { a, b, add, ans };
  }
}

export const y2StoryAdd: Generator = (d, rng): Question => {
  const { a, b, add, ans } = numbers(d, rng);
  const [unit, start, plus, minus, ask] = pick(rng, d === 3 && rng() < 0.5 ? MEASURES : COUNTS);
  const fill = (s: string, n: number, spoken: boolean) => s.replace('#', unit ? `${n} ${spoken ? UNIT_WORD[unit] : unit}` : String(n));
  const story = (spoken: boolean) => [fill(start, a, spoken), fill(add ? plus : minus, b, spoken),
    spoken ? ask.replace(/^How many now\?$/, 'How many are there now?') : ask].join(' ');
  // The other operation (the child added when the story takes away), then ±10 and ±1; ±2 and ±20 are spares.
  const pool = [add ? a - b : a + b, ans + 10, ans - 10, ans + 1, ans - 1, ans + 2, ans - 2, ans + 20, ans - 20];
  const ok = pool.filter((x, i) => x >= 0 && x <= 100 && x !== ans && pool.indexOf(x) === i);
  const keep = ok[0] === pool[0] ? [ok[0]] : []; // the other operation is the design's main distractor
  const ds = [...keep, ...shuffle(rng, ok.slice(keep.length, 5)), ...ok.slice(5)].slice(0, 3);
  if (!unit) return numQ(rng, story(false), ans, { min: 0, max: 100, distractors: ds, say: story(true) });
  return wordQ(rng, story(false), `${ans} ${unit}`, ds.map(x => `${x} ${unit}`), { say: story(true) });
};
