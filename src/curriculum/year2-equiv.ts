// Year 2: the equivalence of 2/4 and 1/2 (#1001). `y2-fractions` only uses `sameFraction` to keep an equal
// fraction out of the decoys; here the equivalence is the answer. Same import direction as year2-topics.ts.
import type { Generator, Question, Rng } from './types';
import { ri, pick, numQ, wordQ } from './util';
import { sameFraction } from './year2/number';

const SAY: Record<string, string> = { '1/2': 'one half', '2/4': 'two quarters', '1/3': 'one third', '1/4': 'one quarter', '3/4': 'three quarters' };
/** The Year 2 fractions a decoy may come from; `sameFraction` removes whichever is worth the asked fraction. */
const YEAR2_SET = ['1/3', '1/4', '3/4'];

/** "`asked` is the same as" `answer`: exactly one of the four options is equal in value, by `sameFraction`. */
function fractionCard(rng: Rng, asked: '1/2' | '2/4', visual?: Question['visual']): Question {
  const [num, den] = asked.split('/').map(Number);
  const answer = asked === '1/2' ? '2/4' : '1/2';
  const ds = YEAR2_SET.filter(f => !sameFraction(f, num, den));
  const prompt = visual ? `${asked} is shaded. Which is the same?` : `Which is the same as ${asked}?`;
  const say = visual ? `${cap(SAY[asked])} is shaded. Which fraction is the same?` : `Which fraction is the same as ${SAY[asked]}?`;
  return wordQ(rng, prompt, answer, ds, { say, ...(visual ? { visual } : {}) });
}
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

function pictureCard(rng: Rng): Question {
  const asked = pick(rng, ['1/2', '2/4'] as const);
  const [shaded, parts] = asked.split('/').map(Number);
  return fractionCard(rng, asked, { type: 'fraction', parts, shaded, shape: pick(rng, ['circle', 'bar'] as const) });
}

/** "1/2 of 8 = 4. So 2/4 of 8 = ?" — the whole is a multiple of 4 (4–24), so every quarter is whole. */
function quantityCard(rng: Rng): Question {
  const whole = 4 * ri(rng, 1, 6), half = whole / 2;
  return numQ(rng, `1/2 of ${whole} = ${half}. So 2/4 of ${whole} = ?`, half, {
    min: 0, max: 24, distractors: [whole / 4, whole * 3 / 4, whole],
    say: `One half of ${whole} is ${half}. So what is two quarters of ${whole}?`,
  });
}

export const y2Equiv: Generator = (d, rng) =>
  d === 1 ? pictureCard(rng)
    : d === 2 ? (rng() < 0.5 ? pictureCard(rng) : fractionCard(rng, pick(rng, ['1/2', '2/4'] as const)))
      : (rng() < 0.4 ? quantityCard(rng) : rng() < 0.5 ? fractionCard(rng, pick(rng, ['1/2', '2/4'] as const)) : pictureCard(rng));
