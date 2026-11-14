// y4-ous (#1160): the suffix -ous of English Appendix 1, Years 3–4. The child hears the word in a gap sentence and
// slices the right spelling from four. Every decoy is hand-curated and is a non-word; the first one is the typical
// mistake for the word's rule. "humourous" is a non-word in the Appendix 1 sense (the rule changes
// -our to -or before -ous), so it is a valid decoy — do not "fix" it.
//
// Left out on purpose: every word and decoy longer than 9 letters (courageous, outrageous, tremendous, mountainous… fail
// R-LBL, #1046: a 10-letter label draws at 12.6px). Keep-the-e is therefore shown with "gorgeous" alone.
import type { Generator } from './types';
import { pick, shuffle, wordQ } from './util';

export type OusRule = 'root' | 'noroot' | 'y-i' | 'our-or' | 'keep-e' | 'i-e';
/** One bank row: the word, its rule, a sentence with `___` where it goes, and three non-word decoys (the first is the rule's typical mistake). */
export type OusRow = readonly [word: string, rule: OusRule, sentence: string, decoys: readonly [string, string, string]];

export const OUS_BANK: readonly OusRow[] = [
  ['poisonous', 'root', 'Do not eat that berry, it is ___ and could make you ill.', ['poisonus', 'poisenous', 'poisonos']],
  ['dangerous', 'root', 'It is ___ to run across a busy road.', ['dangerus', 'dangarous', 'dangeros']],
  ['famous', 'root', 'The singer was ___ and everyone knew her songs.', ['famus', 'fameous', 'faimous']],
  ['nervous', 'root', 'Mia felt ___ before she sang on the stage.', ['nervus', 'nerveous', 'nervos']],
  ['joyous', 'root', 'The ___ crowd cheered and danced in the street.', ['joyus', 'joyeous', 'joious']],
  ['enormous', 'noroot', 'The elephant was ___, as big as a house.', ['enormus', 'enormos', 'enormouss']],
  ['jealous', 'noroot', 'Sam felt ___ when his friend won the new bike.', ['jealus', 'jelous', 'jealeous']],
  ['generous', 'noroot', 'Gran was ___ and gave everyone a bigger slice of cake.', ['generus', 'generos', 'genarous']],
  ['various', 'y-i', 'The shop sold ___ kinds of apples: red, green and yellow.', ['varyous', 'varius', 'varous']],
  ['humorous', 'our-or', 'The clown told a ___ joke and we all laughed.', ['humourous', 'humorus', 'humoros']],
  ['vigorous', 'our-or', 'After a ___ run, Ben was out of breath.', ['vigourous', 'vigorus', 'vigoros']],
  ['gorgeous', 'keep-e', 'The princess wore a ___ gown covered in jewels.', ['gorgous', 'gorgeus', 'gorgious']],
  ['serious', 'i-e', 'Dad had a ___ face and did not smile.', ['serius', 'serios', 'seerious']],
  ['obvious', 'i-e', 'It was ___ that the cat had taken the fish.', ['obvius', 'obveous', 'obvios']],
  ['curious', 'i-e', 'The ___ kitten wanted to look inside every box.', ['curous', 'curius', 'curiuos']],
  ['hideous', 'i-e', 'The monster in the story was ugly and ___.', ['hidious', 'hidous', 'hideus']],
];

const D1: readonly OusRule[] = ['root', 'noroot'];
const D2: readonly OusRule[] = [...D1, 'y-i', 'our-or'];

const cap = (w: string) => w[0].toUpperCase() + w.slice(1);
/** #2318: the two root rows whose root loses its e before -ous (fame, nerve), so "just add -ous" would teach the wrong rule. */
const DROP_E: Record<string, string> = { famous: 'Fame', nervous: 'Nerve' };
/** #2318: the spelling rule applied to this word, never the bare answer. */
export const ousWhy = (word: string, rule: OusRule): string => {
  const stem = word.slice(0, -3);
  switch (rule) {
    case 'root': return word in DROP_E ? `${DROP_E[word]} loses its e: ${word}.` : `${cap(stem)} + ous: just add -ous.`;
    case 'noroot': return `${cap(word)} has no root word: it just ends -ous.`;
    case 'y-i': return 'The y in vary changes to i: various.';
    case 'our-or': return `${cap(word)}: -our becomes -or before -ous.`;
    case 'keep-e': return `${cap(word)} keeps its e before -ous.`;
    case 'i-e': return `${cap(word)} has ${word[word.length - 4]} before -ous.`;
  }
};

/** d1: root + -ous and no-obvious-root words · d2: adds y → i and -our → -or · d3: adds keep-the-e and the i/e words. */
export const y4Ous: Generator = (d, rng) => {
  const rules = d === 1 ? D1 : d === 2 ? D2 : null;
  const rows = rules ? OUS_BANK.filter(r => rules.includes(r[1])) : OUS_BANK;
  const [word, rule, sentence, decoys] = pick(rng, rows);
  return wordQ(rng, 'Which spelling is right?', word, shuffle(rng, [...decoys]), {
    why: ousWhy(word, rule),
    visual: { type: 'sentence', text: sentence },
    say: `${word}. ${sentence.replace('___', word)}`,
    hint: 'Slice the right spelling', hintIsData: false, wide: true,
  });
};
