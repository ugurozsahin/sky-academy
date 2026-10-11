// y6-hyphen (#1275): hyphens that change meaning (English Appendix 2 Y6 punctuation; Appendix 1 "Use of the hyphen"). d1 which word fits
// the gap (recover / re-cover) · d2 which solid word takes a hyphen (a prefix ending in a vowel before a root starting with one) ·
// d3 man-eating shark or man eating shark. ASCII hyphen-minus only. d2 never calls a solid spelling wrong: it asks which one the vowel rule hyphenates.
import type { Generator, Question } from './types';
import { pick, shuffle, wordQ } from './util';

/** [plain, hyphened, sentence needing plain, sentence needing hyphened]; each sentence holds one `_`. */
export const RE_PAIRS: readonly (readonly [string, string, string, string])[] = [
  ['recover', 're-cover', 'I hope Gran will _ from her cold soon.', 'The sofa is torn, so we will _ it with new cloth.'],
  ['resign', 're-sign', 'Dad will _ from his job today.', 'The pen leaked, so please _ the card.'],
  ['remark', 're-mark', 'She did not _ on the weather.', 'The teacher had to _ the wrong test.'],
  ['reserve', 're-serve', 'We _ a table for six at the cafe.', 'The player fell, so she had to _ the ball.'],
  ['resort', 're-sort', 'The family went to a seaside _ for the week.', 'The cards fell, so we must _ them by colour.'],
];

/** [prefix, root]; the first list takes a hyphen (vowel meets vowel), the second does not. Only words whose solid spelling is not the standard one (so not coordinate, cooperate, preorder). */
export const HYPHEN_ROOTS: readonly (readonly [string, string])[] = [
  ['re', 'enter'], ['co', 'own'], ['re', 'elect'], ['re', 'examine'], ['de', 'ice'],
];
export const SOLID_ROOTS: readonly (readonly [string, string])[] = [
  ['re', 'build'], ['re', 'play'], ['pre', 'view'], ['de', 'frost'], ['re', 'write'], ['re', 'tell'],
];

/** [hyphened, open, meaning only the hyphened phrase has, meaning the open phrase could have]. */
export const COMPOUNDS: readonly (readonly [string, string, string, string])[] = [
  ['a man-eating shark', 'a man eating shark', 'a shark that eats people', 'a man who is eating shark'],
  ['a little-used car', 'a little used car', 'a car that is rarely driven', 'a small car that has had an owner'],
  ['a small-animal vet', 'a small animal vet', 'a vet for little pets', 'a little vet who treats animals'],
  ['an old-car dealer', 'an old car dealer', 'someone who sells old cars', 'an elderly person who sells cars'],
];

const isVowel = (c: string): boolean => 'aeiou'.includes(c);
/** The d2 oracle, computed from the pair, not stored. */
export const needsHyphen = ([prefix, root]: readonly [string, string]): boolean => isVowel(prefix.at(-1)!) && isVowel(root[0]);
const solid = ([prefix, root]: readonly string[]): string => prefix + root;

function meaning(rng: () => number): Question {
  const [plain, hyphened, sPlain, sHyph] = pick(rng, RE_PAIRS);
  const hy = rng() < 0.5;
  const text = hy ? sHyph : sPlain;
  const prompt = `Which fits the gap, ${plain} or ${hyphened}?`;   // the pair is in the prompt, so repeat-avoidance sees it (the key ignores a sentence visual)
  return wordQ(rng, prompt, hy ? hyphened : plain, [hy ? plain : hyphened], {
    visual: { type: 'sentence', text }, say: `${text.replace('_', 'blank')} ${prompt}`,
    hint: 'A hyphen can give a word a different meaning.', hintIsData: false,
  });
}

function vowelRule(rng: () => number): Question {
  const yes = pick(rng, HYPHEN_ROOTS);
  const no = shuffle(rng, SOLID_ROOTS).slice(0, 2);
  return wordQ(rng, 'Which word takes a hyphen under the vowel rule?', solid(yes), no.map(solid), {
    hint: 'A prefix ending in a vowel, before a word starting with one.', hintIsData: false,
    say: 'Which word takes a hyphen under the vowel rule?',
  });
}

function compound(rng: () => number): Question {
  const [hyphened, open, mH, mO] = pick(rng, COMPOUNDS);
  const onlyHyphened = rng() < 0.5;
  const hyphenedIsA = rng() < 0.5;
  const [a, b] = hyphenedIsA ? [hyphened, open] : [open, hyphened];
  const letterOf = (isHyphened: boolean): string => (isHyphened === hyphenedIsA ? 'A' : 'B');
  const prompt = onlyHyphened ? `Which one can only mean ${mH}?` : `Which one could mean ${mO}?`;
  return wordQ(rng, prompt, letterOf(onlyHyphened), [letterOf(!onlyHyphened)], {
    visual: { type: 'sentence', text: `A: ${a} / B: ${b}` }, say: `${prompt} A: ${a}. B: ${b}.`, hint: 'The hyphen joins the words so they work as one.', hintIsData: false,
  });
}

/** d1: meaning pairs · d2: the vowel rule · d3: compound phrases. */
export const y6Hyphen: Generator = (d, rng) => d === 1 ? meaning(rng) : d === 2 ? vowelRule(rng) : compound(rng);
