import type { Generator } from './types';
import { pick, shuffle, wordQ, PUNCT_SENTS } from './util';

// #980: each sentence is correct except one word shown in lower case — a name, a place, a day or "i" — and that word
// is the answer. Never the first word, so this form stays apart from the first-word capital card.
export const PUNCT_NAMES: [sentence: string, answer: string][] = [
  ['On Saturday ben went to the park.', 'ben'], ['Sam and i like cake.', 'i'], ['We went to leeds on the train.', 'leeds'],
  ['My friend mia has a red kite.', 'mia'], ['The big bus goes to london today.', 'london'], ['Can i have some milk please?', 'i'],
  ['We swim at the pool on monday.', 'monday'], ['Today zak will play with the ball.', 'zak'], ['Grandad and i walk to the shop.', 'i'],
  ['My cat sleeps on the sofa on sunday.', 'sunday'], ['Is amy coming to the party?', 'amy'], ['We have a picnic in the park on friday.', 'friday'],
  ['Our school is near the river in bath.', 'bath'], ['Look what i found in the garden!', 'i'], ['The dog and lily ran up the hill.', 'lily'],
  ['We go to the library on tuesday.', 'tuesday'], ['Last week tom made a big sandcastle.', 'tom'], ['Can you see where i hid the toy?', 'i'],
  ['The ducks swam across the pond to ruby.', 'ruby'], ['My uncle lives in a small house in york.', 'york'], ['On wednesday we paint a picture of the sun.', 'wednesday'],
  ['Our friend max has a new red bike.', 'max'], ['We think noah can run very fast.', 'noah'], ['We sing a song every thursday morning.', 'thursday'],
];
export const y1Punct: Generator = (d, rng) => {
  const u = d === 1 ? 0 : rng();   // d1 first-word capital; d2 thirds: capital / names-and-I / end mark; d3 halves: names-and-I / end mark
  if (d >= 2 && (d === 2 ? u >= 1 / 3 && u < 2 / 3 : u < 0.5)) {
    const [sent, ans] = pick(rng, PUNCT_NAMES);
    const others = [...new Set(sent.slice(0, -1).split(' ').slice(1).filter(w => w !== ans && w === w.toLowerCase()))];
    return wordQ(rng, 'Which word needs a capital letter?', ans, shuffle(rng, others).slice(0, d), { visual: { type: 'sentence', text: sent }, say: `${sent} Which word needs a capital letter?`, hint: 'Names and I need a capital letter', hintIsData: false });
  }
  if (d === 1 || (d === 2 && u < 1 / 3)) {
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
