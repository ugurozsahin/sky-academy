// y4-proofread (#1170): English Appendix, Years 3–4, "proofread for spelling errors". The card shows a sentence with
// one invented misspelling; the child slices it among words from the same sentence. Hand-curated: every row is
// [correct sentence, target word, misspelling, another statutory-list word in the sentence ('' at d1)].
// Every misspelling is a non-word of a typical error type (dropped or swapped letters, a doubled or single
// consonant, a phonetic spelling). `say` speaks the correct sentence, so the child never hears the wrong word.
import type { Difficulty, Generator, Question, Rng } from './types';
import { pick, shuffle, wordQ } from './util';

export type ProofreadRow = readonly [sentence: string, target: string, misspelling: string, listWord: string];

/** d1: Year 2 common exception words, sentences of at most six words. */
export const D1_BANK: readonly ProofreadRow[] = [
  ['I can climb the tall tree.', 'climb', 'clim', ''], ['The old man had a dog.', 'old', 'ould', ''],
  ['Please be kind to others.', 'kind', 'kinde', ''], ['We find the lost cat.', 'find', 'fynd', ''],
  ['Mum was very busy today.', 'busy', 'bizzy', ''], ['The people cheered loudly.', 'people', 'peeple', ''],
  ['We drink cold water.', 'water', 'watter', ''], ['Dad took the children home.', 'children', 'childrin', ''],
  ['I could see a bird.', 'could', 'coud', ''], ['They were pretty flowers.', 'pretty', 'prety', ''],
  ['I eat an apple every day.', 'every', 'evry', ''], ['Be sure this story is true.', 'sure', 'shure', ''],
  ['Gran has a lot of money.', 'money', 'muney', ''], ['Please hold the rope.', 'hold', 'hoald', ''],
  ['The garden looks beautiful today.', 'beautiful', 'beutiful', ''], ['The bath was too hot.', 'bath', 'barth', ''],
  ['We stayed in because it rained.', 'because', 'becuase', ''], ['The sugar is in the jar.', 'sugar', 'shugar', ''],
  ['The boys both ran home.', 'both', 'bothe', ''], ['My parents are kind.', 'parents', 'parrents', ''],
  ['Walk along the path.', 'path', 'parth', ''], ['Cut the grass today.', 'grass', 'grarss', ''],
  ['Eat your whole apple.', 'whole', 'whoel', ''], ['We are great friends.', 'great', 'grait', ''],
];

/** d2: Year 3–4 statutory list words, each with a second list word in the sentence. */
export const D2_BANK: readonly ProofreadRow[] = [
  ['I believe the answer is correct.', 'believe', 'beleive', 'answer'],
  ['We had a surprise party at the library.', 'surprise', 'suprise', 'library'],
  ['February is a short month, I thought.', 'February', 'Febuary', 'thought'],
  ['My favourite fruit is a juicy plum.', 'favourite', 'favourit', 'fruit'],
  ['The famous knight had great strength.', 'famous', 'famus', 'strength'],
  ['Please remember the potatoes today.', 'remember', 'rember', 'potatoes'],
  ['We heard the strange noise through the wall.', 'strange', 'strainge', 'heard'],
  ['She said it was important and special.', 'important', 'importent', 'special'],
  ['Measure your height in a minute.', 'height', 'hieght', 'minute'],
  ['There are eight children in the group.', 'eight', 'eigth', 'group'],
  ['The library had a popular history book.', 'popular', 'populer', 'history'],
  ['We probably have a regular test.', 'regular', 'reguler', 'probably'],
  ['Perhaps we can describe the different pets.', 'Perhaps', 'Perhapps', 'describe'],
  ['The rabbit will disappear in a minute.', 'disappear', 'dissapear', 'minute'],
  ['We sat in a circle around the earth model.', 'circle', 'sircle', 'earth'],
  ['He caught the bicycle before it fell.', 'caught', 'cought', 'bicycle'],
  ['Please decide on a different answer.', 'decide', 'deside', 'answer'],
  ['The sentence was difficult for me.', 'difficult', 'dificult', 'sentence'],
  ['We do exercise at the centre of town.', 'exercise', 'exersise', 'centre'],
  ['Please promise not to be naughty.', 'promise', 'promiss', 'naughty'],
  ['It was a natural place to build a house.', 'natural', 'nachural', 'build'],
  ['I must address the envelope this minute.', 'address', 'adress', 'minute'],
  ['The sun will appear early today.', 'appear', 'apear', 'early'],
  ['We continue to consider the question.', 'consider', 'concider', 'continue'],
  ['Grandma will arrive in the early evening.', 'arrive', 'arive', 'early'],
  ['Their guard stood in the extreme cold.', 'guard', 'gaurd', 'extreme'],
];

/** d3: list words and the Year 4 rule words (-ous, -tion, -sure, -ture), longer sentences, every decoy five letters or more. */
export const D3_BANK: readonly ProofreadRow[] = [
  ['The famous explorer found treasure on the island.', 'treasure', 'tresure', 'island'],
  ['A serious problem happened during our famous adventure.', 'adventure', 'advencher', 'famous'],
  ['Every curious creature enjoys exploring the island.', 'creature', 'creacher', 'island'],
  ['The teacher asked a difficult question yesterday.', 'question', 'quesion', 'difficult'],
  ['I measure the length of every wooden bridge.', 'measure', 'mesure', 'length'],
  ['Grandma took a lovely picture of the famous building.', 'picture', 'picher', 'famous'],
  ['The station announcer repeated the important message.', 'station', 'staition', 'important'],
  ['The position of the famous castle protects the village.', 'position', 'possition', 'famous'],
  ['An enormous elephant walked slowly through the jungle.', 'enormous', 'enormus', 'through'],
  ['The pleasure of every famous story lasts forever.', 'pleasure', 'plesure', 'famous'],
  ['Eight different animals appeared around the circle.', 'different', 'diffrent', 'circle'],
  ['Perhaps the library opens during the holidays.', 'library', 'libary', 'Perhaps'],
  ['Several people breathe heavily during exercise.', 'breathe', 'brethe', 'exercise'],
];

const MAX_LETTERS = 9;
const bare = (w: string) => w.replace(/[.,?!;:]/g, '');

function card(rng: Rng, [sentence, target, wrong, listWord]: ProofreadRow, d: Difficulty): Question {
  const tokens = sentence.split(' ');
  const words = tokens.map(bare);
  const at = words.indexOf(target);
  const shown = tokens.map((t, i) => (i === at ? t.replace(target, wrong) : t)).join(' ');
  const minLen = d === 3 ? 5 : 3;
  const pool = [...new Set(words.filter((w, i) => i !== at && w.length >= minLen && w.length <= MAX_LETTERS))];
  const bubbles = d === 1 ? 3 : d === 2 ? 4 : 5;
  // d2–d3: one decoy is another list word, and one is at least as long as the misspelling, so neither "the long
  // word" nor "the odd one out by length" finds the answer.
  const chosen: string[] = [];
  if (d > 1 && pool.includes(listWord)) chosen.push(listWord);
  const longer = shuffle(rng, pool.filter(w => w.length >= wrong.length && !chosen.includes(w)));
  if (d > 1 && longer.length) chosen.push(longer[0]);
  for (const w of shuffle(rng, pool)) if (chosen.length < bubbles - 1 && !chosen.includes(w)) chosen.push(w);
  const q = wordQ(rng, 'Which word is spelt wrong?', wrong, chosen.slice(0, 3),
    { hint: 'Read each word slowly, letter by letter', hintIsData: false, wide: true });
  q.options = shuffle(rng, [wrong, ...chosen.slice(0, bubbles - 1)]); // wordQ stops at four options; d3 shows five
  q.visual = { type: 'sentence', text: shown };
  q.say = `${sentence} Which word is spelt wrong?`;
  return q;
}

export const y4Proofread: Generator = (d: Difficulty, rng) => card(rng, pick(rng, d === 1 ? D1_BANK : d === 2 ? D2_BANK : D3_BANK), d);
