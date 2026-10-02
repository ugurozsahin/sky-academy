// y3-suffix (#1104): the suffix -ly and its exceptions, and -ation (NC English Appendix 1, Years 3–4, p.12–13).
// The card names the root and the suffix, the child slices the right spelling from the rule applied and two
// rule-based misspellings. Every decoy is a non-word — never a real word that sounds the same.
import type { Generator } from './types';
import { pick, wordQ } from './util';

export type SuffixRule = 'plain' | 'y-to-i' | 'le' | 'ic' | 'listed' | 'ation';
/** [root, suffix, answer, rule, decoy1, decoy2, sentence with a gap for d3]. */
export type SuffixRow = readonly [string, 'ly' | 'ation', string, SuffixRule, string, string, string];

export const SUFFIX_BANK: ReadonlyArray<SuffixRow> = [
  ['sad', 'ly', 'sadly', 'plain', 'sadely', 'sadlly', 'He sighed ___ and went home.'],
  ['usual', 'ly', 'usually', 'plain', 'usualy', 'usualley', 'I ___ walk to school.'],
  ['final', 'ly', 'finally', 'plain', 'finaly', 'finallly', '___ the bus came.'],
  ['quiet', 'ly', 'quietly', 'plain', 'quietley', 'quietlly', 'She closed the door ___.'],
  ['slow', 'ly', 'slowly', 'plain', 'slowley', 'sloly', 'The snail crept ___ along.'],
  ['kind', 'ly', 'kindly', 'plain', 'kindley', 'kindlly', 'He ___ shared his lunch.'],
  ['brave', 'ly', 'bravely', 'plain', 'bravly', 'braveley', 'The knight fought ___.'],
  ['careful', 'ly', 'carefully', 'plain', 'carefuly', 'carefulley', 'Carry the eggs ___.'],
  ['nice', 'ly', 'nicely', 'plain', 'nicly', 'niceley', 'The twins played ___ together.'],
  ['happy', 'ly', 'happily', 'y-to-i', 'happyly', 'happilly', 'She smiled ___ at the baby.'],
  ['angry', 'ly', 'angrily', 'y-to-i', 'angryly', 'angrilly', 'He shouted ___ at the door.'],
  ['lucky', 'ly', 'luckily', 'y-to-i', 'luckyly', 'luckilly', '___ it did not rain.'],
  ['easy', 'ly', 'easily', 'y-to-i', 'easyly', 'easilly', 'She lifted the box ___.'],
  ['noisy', 'ly', 'noisily', 'y-to-i', 'noisyly', 'noisilly', 'The geese honked ___.'],
  ['thirsty', 'ly', 'thirstily', 'y-to-i', 'thirstyly', 'thirstilly', 'The puppy drank ___.'],
  ['greedy', 'ly', 'greedily', 'y-to-i', 'greedyly', 'greedilly', 'He gobbled his cake ___.'],
  ['busy', 'ly', 'busily', 'y-to-i', 'busyly', 'busilly', 'The bees worked ___.'],
  ['gentle', 'ly', 'gently', 'le', 'gentlely', 'gentley', 'Stroke the cat ___.'],
  ['simple', 'ly', 'simply', 'le', 'simplely', 'simpley', 'Say it ___ and clearly.'],
  ['humble', 'ly', 'humbly', 'le', 'humblely', 'humbley', 'He ___ thanked the crowd.'],
  ['noble', 'ly', 'nobly', 'le', 'noblely', 'nobley', 'The soldier ___ stood guard.'],
  ['terrible', 'ly', 'terribly', 'le', 'terriblely', 'terribley', 'I am ___ sorry.'],
  ['possible', 'ly', 'possibly', 'le', 'possiblely', 'possibley', 'Could you ___ help me?'],
  ['basic', 'ly', 'basically', 'ic', 'basicly', 'basickly', 'It is ___ a big box.'],
  ['comic', 'ly', 'comically', 'ic', 'comicly', 'comickly', 'The clown fell over ___.'],
  ['magic', 'ly', 'magically', 'ic', 'magicly', 'magickly', 'The rabbit ___ appeared.'],
  ['tragic', 'ly', 'tragically', 'ic', 'tragicly', 'tragickly', 'The story ended ___.'],
  ['frantic', 'ly', 'frantically', 'ic', 'franticly', 'frantickly', 'She searched ___ for her keys.'],
  ['true', 'ly', 'truly', 'listed', 'truely', 'trully', 'I am ___ sorry.'],
  ['due', 'ly', 'duly', 'listed', 'duely', 'dualy', 'The form was ___ signed.'],
  ['whole', 'ly', 'wholly', 'listed', 'wholely', 'wholey', 'I ___ agree with you.'],
  ['adore', 'ation', 'adoration', 'ation', 'adoreation', 'adorration', 'The fans looked at her with ___.'],
  ['sense', 'ation', 'sensation', 'ation', 'senseation', 'sennsation', 'The snow gave a tingling ___.'],
  ['invite', 'ation', 'invitation', 'ation', 'inviteation', 'invittation', 'She wrote an ___ to the party.'],
  ['relax', 'ation', 'relaxation', 'ation', 'relaxxation', 'relaxeation', 'Yoga helps with ___.'],
  ['quote', 'ation', 'quotation', 'ation', 'quoteation', 'quottation', 'Read the ___ out loud.'],
];

/** d1 is the plain -ly you add straight on; d2 the four exceptions and -ation; d3 mixes every rule, in a sentence. */
export const y3Suffix: Generator = (d, rng) => {
  const rows = d === 3 ? SUFFIX_BANK : SUFFIX_BANK.filter(r => (r[3] === 'plain') === (d === 1));
  const [root, suf, ans, , naive, misrule, sentence] = pick(rng, rows);
  const sum = `${root} + ${suf}`;
  return wordQ(rng, d === 3 ? `${sum}: ${sentence}` : `${sum} = ?`, ans, [naive, misrule], {
    visual: d === 3 ? { type: 'sentence', text: sentence } : { type: 'word', text: sum },
    say: `Add ${suf} to ${root}. Which spelling is right?`, hint: 'Check the end of the root word', hintIsData: false,
  });
};
