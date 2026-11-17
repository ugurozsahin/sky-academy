// y4-context (#1131): what does one word mean in this sentence? NC Years 3–4 reading comprehension: "explaining the
// meaning of words in context". SENSES is the hand-curated sense table; BANK is hand-written, so every sense of every
// word is the keyed answer in at least one sentence and the word alone never gives it away. Each sense is a label of
// one or two words (R-LBL, #1046). The fourth entry of a row is the clue word the `why` quotes (#2318). The reviewer reads every sentence against every sense of its word (#666).
import type { Difficulty, Generator, Question } from './types';
import { pick, wordQ } from './util';

export const SENSES: [word: string, senses: string[]][] = [
  ['bright', ['shining', 'clever']],
  ['sharp', ['pointed', 'sour']],
  ['minute', ['tiny', '60 seconds']],
  ['bat', ['flying animal', 'cricket stick']],
  ['kind', ['caring', 'sort']],
  ['mean', ['unkind', 'intend']],
  ['pupil', ['child', 'eye part']],
  ['wave', ['sea swell', 'greeting']],
  ['right', ['correct', 'not left']],
  ['trip', ['journey', 'stumble']],
  ['grave', ['serious', 'tomb']],
  ['content', ['happy', 'things inside']],
  ['bank', ['river edge', 'money place']],
  ['bark', ['dog noise', 'tree skin']],
  ['rock', ['stone', 'sway', 'music']],
  ['light', ['not heavy', 'not dark', 'set alight']],
  ['fair', ['just', 'pale', 'funfair']],
  ['spring', ['season', 'coil', 'jump']],
  ['ring', ['phone call', 'jewellery', 'circle']],
  ['match', ['game', 'fire stick', 'go together']],
];

export type ContextRow = [sentence: string, word: string, sense: number, clue: string];
export const BANK: ContextRow[] = [
  ['The bright sun made me squint.', 'bright', 0, 'sun'],
  ['She is a bright girl who learns fast.', 'bright', 1, 'learns'],
  ['Mind the sharp end of the pencil.', 'sharp', 0, 'pencil'],
  ['The lemon juice had a sharp taste.', 'sharp', 1, 'taste'],
  ['A minute ant crawled over the leaf.', 'minute', 0, 'ant'],
  ['Wait one minute, please.', 'minute', 1, 'wait'],
  ['A bat flew out of the dark cave.', 'bat', 0, 'flew'],
  ['He hit the ball with his bat.', 'bat', 1, 'ball'],
  ['Our kind teacher always helps us.', 'kind', 0, 'teacher'],
  ['Which kind of pet do you want?', 'kind', 1, 'which'],
  ['It was mean to take her toy.', 'mean', 0, 'toy'],
  ['I did not mean to drop it.', 'mean', 1, 'drop'],
  ['Each pupil sat at a desk.', 'pupil', 0, 'desk'],
  ['The pupil of your eye gets small in sunshine.', 'pupil', 1, 'eye'],
  ['A big wave splashed over the pier.', 'wave', 0, 'splashed'],
  ['I will wave to Gran at the gate.', 'wave', 1, 'gran'],
  ['Your answer is right, well done!', 'right', 0, 'answer'],
  ['Turn right at the end of the road.', 'right', 1, 'turn'],
  ['We went on a school trip to the farm.', 'trip', 0, 'school'],
  ['Mind you do not trip on the step.', 'trip', 1, 'step'],
  ['The doctor had a grave look on her face.', 'grave', 0, 'look'],
  ['Flowers lay beside the old grave.', 'grave', 1, 'flowers'],
  ['The cat was content to nap in the sun.', 'content', 0, 'nap'],
  ['Check the content of your lunch box.', 'content', 1, 'lunch'],
  ['We sat on the bank of the river.', 'bank', 0, 'river'],
  ['Mum went to the bank to get some money.', 'bank', 1, 'money'],
  ['The dog gave a loud bark.', 'bark', 0, 'loud'],
  ['Moss grew on the bark of the oak.', 'bark', 1, 'moss'],
  ['He climbed onto a big grey rock.', 'rock', 0, 'grey'],
  ['Please rock the baby gently to sleep.', 'rock', 1, 'baby'],
  ['My dad loves rock and pop songs.', 'rock', 2, 'songs'],
  ['This bag is light, so I can carry it.', 'light', 0, 'carry'],
  ['The kitchen is light and sunny.', 'light', 1, 'sunny'],
  ['Dad will light the candle for us.', 'light', 2, 'candle'],
  ['Share the sweets in a fair way.', 'fair', 0, 'share'],
  ['Her fair hair shone in the sun.', 'fair', 1, 'hair'],
  ['We won a goldfish at the fair.', 'fair', 2, 'goldfish'],
  ['Lambs are born in spring.', 'spring', 0, 'lambs'],
  ['The bed has a metal spring inside.', 'spring', 1, 'bed'],
  ['Watch the frog spring over the log.', 'spring', 2, 'frog'],
  ['Please ring me when you get home.', 'ring', 0, 'me'],
  ['She wore a gold ring on her finger.', 'ring', 1, 'finger'],
  ['The children stood in a ring.', 'ring', 2, 'stood'],
  ['We won the football match.', 'match', 0, 'football'],
  ['Dad struck a match to start the fire.', 'match', 1, 'fire'],
  ['Her hat does not match her coat.', 'match', 2, 'coat'],
];

const sensesOf = (word: string): string[] => {
  const row = SENSES.find(s => s[0] === word);
  if (!row) throw new Error(`y4-context: "${word}" is not in SENSES`);
  return row[1];
};

/**
 * d2's one foreign bubble comes from here, never from another word's senses at large (review of #1612: a sense such
 * as "not dark" or "just" can fit "The bright sun made me squint."). Each is a concrete noun meaning that fits no
 * sentence in BANK; the test pins that the foreign bubble is one of these and is not one of the word's own senses.
 */
export const FOREIGN = ['dog noise', 'funfair', 'cricket stick', 'flying animal', 'tomb', 'eye part', 'sea swell'];

/** d1 and d2 use the two-sense words, d3 the three-sense words (all three bubbles are the word's own). */
export const y4Context: Generator = (d: Difficulty, rng): Question => {
  const [sentence, word, idx, clue] = pick(rng, BANK.filter(r => sensesOf(r[1]).length === (d === 3 ? 3 : 2)));
  const own = sensesOf(word);
  const options = d === 2 ? [...own, pick(rng, FOREIGN.filter(f => !own.includes(f)))] : own;
  return wordQ(rng, `What does "${word}" mean here?`, own[idx], options, {
    why: `"${clue}" tells you "${word}" means ${own[idx]} here.`,
    visual: { type: 'sentence', text: sentence },
    say: `${sentence} What does ${word} mean here?`,
    hint: 'Read the whole sentence', hintIsData: false,
  });
};
