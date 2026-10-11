// y6-subjectobject (#1283): find the subject or the object of a sentence (English Appendix 2, Year 6 terminology).
// d1 the subject of a statement · d2 the object of a statement or pronoun sentence (she/him, not he/her) · d3 the subject of
// a question (the object may come first) or a passive (the by-phrase noun is the decoy). Every option is the sentence's own word.
import type { Difficulty, Generator } from './types';
import { pick, wordQ } from './util';

export type Kind = 'statement' | 'pronoun' | 'question' | 'passive';
/** [sentence, subject, verb, object (null on a passive), kind]. Each word is one whole word, once, in the sentence. */
export type SubjObjRow = [sentence: string, subject: string, verb: string, object: string | null, kind: Kind];

export const SUBJ_OBJ: SubjObjRow[] = [
  ['The dog chased the cat.', 'dog', 'chased', 'cat', 'statement'],
  ['Mia kicked the ball.', 'Mia', 'kicked', 'ball', 'statement'],
  ['Our teacher read a story.', 'teacher', 'read', 'story', 'statement'],
  ['Tom painted the fence.', 'Tom', 'painted', 'fence', 'statement'],
  ['The farmer fed the horses.', 'farmer', 'fed', 'horses', 'statement'],
  ['A bird built a nest.', 'bird', 'built', 'nest', 'statement'],
  ['Grandad baked a cake.', 'Grandad', 'baked', 'cake', 'statement'],
  ['The girl opened the window.', 'girl', 'opened', 'window', 'statement'],
  ['She thanked him.', 'She', 'thanked', 'him', 'pronoun'],
  ['They helped us.', 'They', 'helped', 'us', 'pronoun'],
  ['He called her.', 'He', 'called', 'her', 'pronoun'],
  ['We followed them.', 'We', 'followed', 'them', 'pronoun'],
  ['Will the children study the animals?', 'children', 'study', 'animals', 'question'],
  ['Which book did Sam choose?', 'Sam', 'choose', 'book', 'question'],
  ['Did the dog bury the bone?', 'dog', 'bury', 'bone', 'question'],
  ['Can Mia reach the shelf?', 'Mia', 'reach', 'shelf', 'question'],
  ['What did Ravi draw?', 'Ravi', 'draw', 'What', 'question'],
  ['Does Dad like the song?', 'Dad', 'like', 'song', 'question'],
  ['The key was found by Ali.', 'key', 'found', null, 'passive'],
  ['The window was broken by Sam.', 'window', 'broken', null, 'passive'],
  ['The cake was eaten by the twins.', 'cake', 'eaten', null, 'passive'],
  ['The letter was written by Gran.', 'letter', 'written', null, 'passive'],
  ['The race was won by Zara.', 'race', 'won', null, 'passive'],
];

/** The noun after "by" on a passive row: the misconception decoy for the subject. */
export const byNoun = (sentence: string): string => sentence.replace(/\.$/, '').split(' ').slice(-1)[0];

const hintFor = (role: 'subject' | 'object') => role === 'subject'
  ? 'The subject is the do-er, the word that goes with the verb' : 'The object is what the verb acts upon';

function card(rng: () => number, row: SubjObjRow, role: 'subject' | 'object') {
  const [sentence, subject, verb, object, kind] = row;
  const answer = role === 'subject' ? subject : object!;
  const swapped = role === 'subject' ? (kind === 'passive' ? byNoun(sentence) : object!) : subject;
  const stem = `Which word is the ${role}?`;
  return wordQ(rng, stem, answer, [swapped, verb], {
    visual: { type: 'sentence', text: sentence }, say: `${stem} ${sentence}`, hint: hintFor(role), hintIsData: false,
  });
}

const rows = (kinds: Kind[]) => SUBJ_OBJ.filter(r => kinds.includes(r[4]));

export const y6SubjectObject: Generator = (d: Difficulty, rng) =>
  d === 1 ? card(rng, pick(rng, rows(['statement'])), 'subject')
    : d === 2 ? card(rng, pick(rng, rows(['statement', 'pronoun'])), 'object')
      : card(rng, pick(rng, rows(['question', 'passive'])), 'subject');
