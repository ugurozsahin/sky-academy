// y3-dictation (#1114): Year 3–4 dictation (NC: write from memory simple sentences, dictated by the teacher, that
// include words and punctuation taught so far). The sentence is spoken only (`peek` shows it briefly with no
// voice); the child slices its words in order. Oracle: the sentence split on spaces, punctuation attached.
// At d3 one decoy is the last word with a different end mark, so the punctuation has to be right as well.
import type { Difficulty, Generator, Question } from './types';
import { pick, shuffle, sentenceQ } from './util';

/** [sentence, focus] — the focus is a Year 3–4 list word or Year 3 pattern word (Appendix 1) the sentence carries. */
export const Y3_DICTATION: [string, string][][] = [
  // d1: 4–5 words, ends in . or ?
  [['I heard a bird.', 'heard'], ['Do you believe it?', 'believe'], ['The earth is round.', 'earth'], ['I was busy today.', 'busy'],
    ['Mum sang so sadly.', 'sadly'], ['He is very young.', 'young'], ['Is that enough food?', 'enough'], ['We learn at school.', 'learn'],
    ['Can you remember me?', 'remember'], ['A myth is old.', 'myth'], ['I caught a fish.', 'caught'], ['We walked through mud.', 'through']],
  // d2: 5–6 words with an apostrophe or a comma in a list
  [['I didn\'t hear the answer.', 'answer'], ['Sam\'s bicycle is quite strange.', 'bicycle'], ['We eat fruit, bread, and jam.', 'fruit'],
    ['She didn\'t believe her eyes.', 'believe'], ['Mum\'s favourite colour is green.', 'favourite'], ['We can\'t build it today.', 'build'],
    ['It\'s a special day today.', 'special'], ['The library has maps, pens, glue.', 'library'], ['Grandad\'s island is quite far.', 'island'],
    ['Tom\'s heart beat very fast.', 'heart'], ['She didn\'t promise me anything.', 'promise'], ['The group has pens, paper, glue.', 'group']],
  // d3: 6–7 words, any KS1–Y3 punctuation
  [['Is this the right position, Mum?', 'position'], ['Why didn\'t you describe the strange bird?', 'describe'], ['I can\'t believe it\'s already late!', 'believe'],
    ['We often eat fruit, nuts, and bread.', 'often'], ['Sadly, the young fox ran away.', 'sadly'], ['Please bring your library book back.', 'library'],
    ['The earth goes around the sun.', 'earth'], ['Which special present did Sam\'s mum buy?', 'special'], ['We had a big surprise today, Mum!', 'surprise'],
    ['Can you answer the difficult question, please?', 'question'], ['The myth was about a brave knight.', 'myth'], ['It\'s probably going to rain today.', 'probably']],
];

const DECOYS = ['tree', 'blue', 'jump', 'happy', 'farm', 'window', 'cloud', 'table', 'garden', 'river', 'milk', 'night', 'horse', 'train', 'apple', 'sleep'];
const DECOY_COUNT: Record<Difficulty, number> = { 1: 2, 2: 3, 3: 2 };
const MARKS = ['.', '?', '!'];

export const y3Dictation: Generator = (d, rng): Question => {
  const [s] = pick(rng, Y3_DICTATION[d - 1]);
  const q = sentenceQ(rng, s, '🎧', DECOYS, DECOY_COUNT[d], false);
  if (d < 3) return q;
  const last = s.split(' ').pop()!;
  const end = last.slice(-1);
  const variant = last.slice(0, -1) + pick(rng, MARKS.filter(m => m !== end));
  return { ...q, options: shuffle(rng, [...q.options, variant]) };
};
