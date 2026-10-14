// Year 2: read a scale (#1005). A new module, not year2.ts or util.ts, which are on the #714 ratchet. The scale is
// the existing `numberline` visual: 6 ticks from 0 (the width limit of `.nline`). From d2 only the two ends are
// numbered (`ends`, #1004), so the child works out what one interval is worth before reading the `?`.
import type { Generator, Question, Rng } from './types';
import { pick, ri, shuffle, UNIT_WORD } from './util';

interface Instrument { prompt: string; unit: string; say: string }
const RULER: Instrument = { prompt: 'How long is the ribbon?', unit: 'cm', say: 'How long is the ribbon?' };
const SCALE: Instrument = { prompt: 'How heavy is the flour?', unit: 'g', say: 'How heavy is the flour?' };
const JUG: Instrument = { prompt: 'How much juice is in the jug?', unit: 'ml', say: 'How much juice is in the jug?' };
const THERMOMETER: Instrument = { prompt: 'How warm is the water?', unit: '°C', say: 'How warm is the water?' };

/** Three different values, each at least 0, from the answer's neighbours: one interval away, or one unit away. */
function decoys(rng: Rng, mark: number, step: number): number[] {
  const near = step > 1 ? [mark - step, mark + step, mark - 1, mark + 1] : [mark - 1, mark + 1, mark - 2, mark + 2];
  return shuffle(rng, [...new Set(near.filter(x => x >= 0 && x !== mark))]).slice(0, 3);
}

export const y2Scales: Generator = (d, rng): Question => {
  const inst = d === 1 ? RULER : d === 2 ? pick(rng, [SCALE, JUG]) : pick(rng, [RULER, SCALE, JUG, THERMOMETER]);
  const step = d === 1 ? pick(rng, [1, 2]) : d === 2 ? pick(rng, [5, 10]) : pick(rng, [2, 5, 10]);
  const to = step * 5, mark = step * ri(rng, 1, 4);
  const answer = `${mark} ${inst.unit}`;
  const unitWord = inst.unit === '°C' ? 'degrees Celsius' : UNIT_WORD[inst.unit];
  return {
    prompt: inst.prompt, answer,
    options: shuffle(rng, [answer, ...decoys(rng, mark, step).map(x => `${x} ${inst.unit}`)]),
    visual: { type: 'numberline', from: 0, to, step, mark, ...(d > 1 ? { ends: true } : {}) },
    say: `${inst.say} The scale goes from 0 to ${to} ${unitWord}.`,
    hint: 'Slice the number at the ?', hintIsData: false,
  };
};
