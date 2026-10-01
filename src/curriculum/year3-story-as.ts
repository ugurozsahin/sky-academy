// y3-story-as (#1090): short spoken story problems within 1,000, one step (d1, d2) then two (d3), always in one
// unit. Every value on a card, intermediate or answer, is 100–999. Decoys come from `mistakes.ts` first (#1058);
// the wrong operation and, on d3, the first step's result (a child who stops early) swap in for them.
import type { Difficulty, Generator, Question, Rng } from './types';
import { ri, pick, wordQ, UNIT_WORD } from './util';
import { dec } from './ks2num';
import { decoysFor } from './mistakes';

/** [unit, start, add, sub, question]. Each sentence holds one `#`, where its number (and unit) goes. */
export const BANK: [string, string, string, string, string][] = [
  ['', 'A library has # books.', 'It gets # more.', 'It lends #.', 'How many now?'],
  ['', 'A school has # pupils.', '# more join.', '# leave.', 'How many now?'],
  ['', 'A farm has # hens.', '# more arrive.', '# are sold.', 'How many now?'],
  ['', 'A shop has # apples.', '# more arrive.', '# are sold.', 'How many now?'],
  ['', 'A park has # trees.', '# are planted.', '# are cut down.', 'How many now?'],
  ['', 'A box has # beads.', '# more go in.', '# come out.', 'How many now?'],
  ['cm', 'A rope is # long.', '# is added.', '# is cut.', 'How long now?'],
  ['m', 'A track is # long.', '# is added.', '# is closed.', 'How long now?'],
  ['ml', 'A jug has # of milk.', '# is added.', '# is drunk.', 'How much now?'],
  ['g', 'A bag has # of flour.', '# is added.', '# is used.', 'How much now?'],
];

interface Step { add: boolean; b: number }

/** A step needs an exchange when the units or tens column carries (add) or borrows (subtract). */
const exchange = (a: number, b: number, add: boolean) =>
  [1, 10].some(p => add ? Math.floor(a / p) % 10 + Math.floor(b / p) % 10 > 9 : Math.floor(a / p) % 10 < Math.floor(b / p) % 10);

/** d1: ones, tens or hundreds; d2 and d3: a 2- or 3-digit amount. */
const amount = (d: Difficulty, rng: Rng) => d === 1 ? [ri(rng, 1, 9), 10 * ri(rng, 1, 9), 100 * ri(rng, 1, 8)][ri(rng, 0, 2)] : ri(rng, 10, d === 2 ? 899 : 500);

function numbers(d: Difficulty, rng: Rng): { vals: number[]; steps: Step[] } {
  for (;;) {
    const steps: Step[] = Array.from({ length: d === 3 ? 2 : 1 }, () => ({ add: rng() < 0.5, b: amount(d, rng) }));
    const vals = [ri(rng, 100, 999)];
    const ok = steps.every(s => {
      const was = vals[vals.length - 1], v = was + (s.add ? s.b : -s.b);
      vals.push(v);
      return v >= 100 && v <= 999 && (d !== 2 || exchange(was, s.b, s.add));
    });
    if (ok) return { vals, steps };
  }
}

export const y3StoryAs: Generator = (d, rng): Question => {
  for (;;) {
    const { vals, steps } = numbers(d, rng);
    const [unit, start, add, sub, ask] = pick(rng, BANK);
    const fill = (s: string, n: number, spoken: boolean) => s.replace('#', unit ? `${n} ${spoken ? UNIT_WORD[unit] : unit}` : String(n));
    const story = (spoken: boolean) => [fill(start, vals[0], spoken), ...steps.map(s => fill(s.add ? add : sub, s.b, spoken)), spoken ? ask.replace(/^How many now\?$/, 'How many are there now?') : ask].join(' ');
    if (story(false).length > 68) continue; // three lines at 390 px (#1051)
    const label = (v: number) => unit ? `${v} ${unit}` : String(v);
    const answer = vals[vals.length - 1], from = vals[vals.length - 2], last = steps[steps.length - 1];
    const calc = { a: dec(from, 0), b: dec(last.b, 0), answer: dec(answer, 0) };
    const decoys = decoysFor(last.add ? 'add' : 'sub', calc, 3, rng, { min: 100, max: 999 }).map(x => x.v);
    // Each wanted decoy takes the place of one that leaves #1058's two guarantees (a decoy sharing the answer's
    // last digit, one sharing its first) standing, and never of one already placed.
    const want = [...(d === 3 ? [vals[1]] : []), ...steps.map((s, i) => vals[i] + (s.add ? -s.b : s.b))];
    const placed: number[] = [];
    const sound = (ds: number[]) => ds.some(v => v % 10 === answer % 10) && ds.some(v => Math.floor(v / 100) === Math.floor(answer / 100));
    for (const v of want) {
      if (v < 100 || v > 999 || v === answer || decoys.includes(v)) continue;
      const i = decoys.findIndex((x, k) => !placed.includes(x) && sound(decoys.map((y, j) => j === k ? v : y)));
      if (i >= 0) { decoys[i] = v; placed.push(v); }
    }
    if (d === 3 && !decoys.includes(vals[1])) continue;
    const card = wordQ(rng, story(false), label(answer), decoys.map(label), { say: story(true) });
    return d === 3 ? { ...card, slow: true } : card;
  }
};
