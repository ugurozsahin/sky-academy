// y4-hundredths (#1143): count in hundredths, and where they come from. Every value is a whole number of hundredths
// (`h`, 0.97 is 97) and every decimal label is written through `fmt` to 2 places, so no float artefact reaches a bubble.
// d1 reads a hidden tick on a line stepping 0.01 inside one tenth; d2 counts up or down across a tenth or a whole;
// d3 mixes d2 with "0.3 ÷ 10 = ?" and "How many hundredths make 0.4?".
import type { Difficulty, Generator, Question, Rng } from './types';
import { ri, pick, shuffle, wordQ } from './util';
import { dec, fmt } from './ks2num';
import { ks2Say } from './ks2say';

const MAX = 200;
const lab = (h: number) => fmt(dec(h, 2), { fixedDp: 2 });
const lab1 = (t: number) => fmt(dec(t, 1), { fixedDp: 1 });

/** Misconception decoys for a decimal answer `h`, in hundredths: the tenths slip (answer ± 0.10) always, then `extra` (a count's own slip), then the place-value shift and a step either side. */
function decoys(rng: Rng, h: number, slip: number, extra: number[] = [], hidden: ReadonlySet<number> = new Set()): string[] {
  const ok = (v: number) => v >= 0 && v <= MAX && v !== h && !hidden.has(v);
  const out: number[] = [];
  const add = (v: number) => { if (ok(v) && !out.includes(v)) out.push(v); };
  [slip, ...extra].forEach(add);
  shuffle(rng, [h < 20 ? h * 10 : Math.floor(h / 10), h + 1, h - 1]).forEach(add);
  [h + 10, h - 10, h + 20, h + 30, h + 2, h - 2].forEach(add);
  return out.slice(0, 3).map(lab);
}

/** d1: six ticks in one tenth (0.02 to 0.07), one hidden. */
function line(rng: Rng): Question {
  const from = ri(rng, 0, 9) * 10 + ri(rng, 0, 4), idx = ri(rng, 0, 5), h = from + idx;
  const ticks = Array.from({ length: 6 }, (_, i) => from + i);
  const shown = new Set(ticks.filter(t => t !== h));
  return wordQ(rng, 'Which number is hidden?', lab(h), decoys(rng, h, h + 10, [], shown),
    { visual: { type: 'numberline', from: from / 100, to: (from + 5) / 100, mark: h / 100, step: 0.01, labels: ticks.map(lab) },
      say: 'Which number is hidden on the number line?', hint: 'The ticks go up in hundredths', hintIsData: false });
}

/** d2: three terms then "?", up or down in 0.01, the run crossing a tenth or a whole: "0.97, 0.98, 0.99, ?". */
function count(rng: Rng): Question {
  const up = rng() < 0.5, B = ri(rng, 2, 18) * 10;
  const h = up ? B + ri(rng, 0, 2) : B - ri(rng, 1, 3), s = up ? -1 : 1;
  const terms = [3, 2, 1].map(k => h + s * k);
  const last = terms[2];
  return wordQ(rng, `Count ${up ? 'up' : 'down'} in hundredths: ${terms.map(lab).join(', ')}, ?`, lab(h), decoys(rng, h, up ? h + 10 : h - 10, [last + s * -10], new Set(terms)),
    { say: `Count ${up ? 'up' : 'down'} in hundredths. ${ks2Say(terms.map(lab).join(', '))}, then what?`, hint: 'Each step is one hundredth', hintIsData: false });
}

/** d3: "0.3 ÷ 10 = ?" (answer 0.03). */
function divide(rng: Rng): Question {
  const t = ri(rng, 1, 9);
  return wordQ(rng, `${lab1(t)} ÷ 10 = ?`, lab(t), decoys(rng, t, t + 10),
    { say: `${ks2Say(lab1(t))} divided by ten equals what?`, hint: 'Divide a tenth by 10 to make hundredths', hintIsData: false });
}

/** d3: "How many hundredths make 0.4?" (answer 40). */
function howMany(rng: Rng): Question {
  const t = ri(rng, 1, 9), a = t * 10;
  const ds = [...new Set([t, t * 100, t > 1 ? a - 10 : a + 10].filter(v => v > 0 && v !== a))].slice(0, 3);
  return wordQ(rng, `How many hundredths make ${lab1(t)}?`, String(a), ds.map(String),
    { say: `How many hundredths make ${ks2Say(lab1(t))}?`, hint: 'One tenth is made of ten hundredths', hintIsData: false });
}

export const y4Hundredths: Generator = (level: Difficulty, rng) => {
  if (level === 1) return line(rng);
  if (level === 2 || rng() < 0.5) return count(rng);
  return pick(rng, [divide, howMany])(rng);
};
