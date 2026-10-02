// Year 2 word classes (#299 slice 3, #927). Split out of year2/sentences.ts: the single-word cards and the
// "Slice Them All" form share one module, so the bank rail below is the only place either is kept honest.
import type { Generator, Rng } from './types';
import { ri, pick, wordQ } from './util';
import { anyOrderQ } from './any-order';

/**
 * Word classes in a sentence (#299 slice 3, NC English Appendix 2 Year 2): `[sentence, noun, verb, adjective,
 * adverb]`. The three words **not** asked for are the card's distractors, so every option comes from the
 * child's own sentence and exactly one of them can be the class asked for.
 *
 * That only holds while no word in the bank belongs to two classes out of context — `play`, `run` and `smile`
 * are a noun and a verb both, and `fast` is an adjective and an adverb both — so the bank avoids them and a
 * rail holds every word to the one column it appears in. The sentences are deliberately four-content-word
 * sentences for the same reason: a word on the card that is not one of the four could be the honest answer.
 */
export const WORD_CLASSES: ReadonlyArray<readonly [string, string, string, string, string]> = [
  ['The happy kitten purred loudly.', 'kitten', 'purred', 'happy', 'loudly'],
  ['A tiny bird sang sweetly.', 'bird', 'sang', 'tiny', 'sweetly'],
  ['The brave ninja jumped quickly.', 'ninja', 'jumped', 'brave', 'quickly'],
  ['My little sister giggled quietly.', 'sister', 'giggled', 'little', 'quietly'],
  ['The old bus stopped suddenly.', 'bus', 'stopped', 'old', 'suddenly'],
  ['A hungry rabbit nibbled greedily.', 'rabbit', 'nibbled', 'hungry', 'greedily'],
  ['The red balloon floated slowly.', 'balloon', 'floated', 'red', 'slowly'],
  ['Our new teacher smiled warmly.', 'teacher', 'smiled', 'new', 'warmly'],
  ['The huge castle stood proudly.', 'castle', 'stood', 'huge', 'proudly'],
  ['The tired baby yawned sleepily.', 'baby', 'yawned', 'tired', 'sleepily'],
];
/** Column order in `WORD_CLASSES`, and the order the difficulties unlock them in. Exported for the rail. */
export const WORD_CLASS_NAMES = ['noun', 'verb', 'adjective', 'adverb'] as const;

/**
 * The "Slice every noun / verb" bank (#927): `[sentence, nouns, verbs, other content words]`, keyed word by
 * word. Each sentence has at least two nouns and two verbs and 4–6 content words; the "other" column holds
 * the adjectives, which are only ever decoys. Function words ("the", "and", "his", "onto"…) are not keyed, so
 * they are never bubbles. No proper nouns (a capital would give the answer away) and no word that reads as a
 * noun and a verb — `fly`, `log`, `paint`, `duck`, `bag` — so a word's class is the same wherever it appears.
 */
export const WORD_CLASS_SETS: ReadonlyArray<readonly [string, readonly string[], readonly string[], readonly string[]]> = [
  ['The girl kicked the ball and chased the dog.', ['girl', 'ball', 'dog'], ['kicked', 'chased'], []],
  ['The old farmer fed the hens and milked the cow.', ['farmer', 'hens', 'cow'], ['fed', 'milked'], ['old']],
  ['The clever fox crept past the barn and hid.', ['fox', 'barn'], ['crept', 'hid'], ['clever']],
  ['The baby clapped and giggled at the clown.', ['baby', 'clown'], ['clapped', 'giggled'], []],
  ['The chef baked a cake and iced the buns.', ['chef', 'cake', 'buns'], ['baked', 'iced'], []],
  ['The pirate dug a hole and buried the treasure.', ['pirate', 'hole', 'treasure'], ['dug', 'buried'], []],
  ['A tiny frog jumped onto the stone and caught a worm.', ['frog', 'stone', 'worm'], ['jumped', 'caught'], ['tiny']],
  ['The teacher read a story and the children listened.', ['teacher', 'story', 'children'], ['read', 'listened'], []],
  ['The brave knight lifted his sword and climbed the tower.', ['knight', 'sword', 'tower'], ['lifted', 'climbed'], ['brave']],
  ['The driver washed the van and polished the mirrors.', ['driver', 'van', 'mirrors'], ['washed', 'polished'], []],
  ['The swans swam across the lake and honked.', ['swans', 'lake'], ['swam', 'honked'], []],
  ['The baker opened the tin and stirred the soup.', ['baker', 'tin', 'soup'], ['opened', 'stirred'], []],
  ['The astronaut packed a suitcase and boarded the rocket.', ['astronaut', 'suitcase', 'rocket'], ['packed', 'boarded'], []],
  ['The dragon roared and the villagers hid.', ['dragon', 'villagers'], ['roared', 'hid'], []],
];

/** "Slice every noun/verb": targets are the sentence's words of the class asked, decoys its other content words. */
function y2WordClassAnyOrder(d: number, rng: Rng): ReturnType<typeof anyOrderQ> {
  const [sent, nouns, verbs, others] = pick(rng, WORD_CLASS_SETS);
  const cls = d === 2 || rng() < 0.5 ? 'noun' : 'verb';
  const targets = cls === 'noun' ? nouns : verbs, decoys = [...(cls === 'noun' ? verbs : nouns), ...others];
  return anyOrderQ(rng, `Slice every ${cls}`, [...targets], decoys, {
    visual: { type: 'sentence', text: sent }, say: `${sent} Slice every ${cls}.`, hint: `Which words are ${cls}s?`, hintIsData: false,
  });
}
/**
 * One word class per sentence at d1 (nouns and verbs). From d2 about one card in three is the any-order form
 * above — every noun at d2, every noun or every verb at d3 (#927).
 */
export const y2WordClass: Generator = (d, rng) => {
  if (d >= 2 && rng() < 1 / 3) return y2WordClassAnyOrder(d, rng);
  const row = pick(rng, WORD_CLASSES);
  // Nouns and verbs first: Year 1 already names them (Appendix 2), while adjective and adverb are Year 2's own
  // vocabulary — and "which word is the adverb?" on a card whose adverb is the last word is the stretch.
  const k = ri(rng, 0, d === 1 ? 1 : d === 2 ? 2 : 3);
  const cls = WORD_CLASS_NAMES[k], answer = row[k + 1];
  return wordQ(rng, `Which word is the ${cls}?`, answer, row.slice(1).filter(w => w !== answer), {
    visual: { type: 'sentence', text: row[0] }, say: `${row[0]} Which word is the ${cls}?`, hint: `Slice the ${cls}`, hintIsData: false,
  });
};
