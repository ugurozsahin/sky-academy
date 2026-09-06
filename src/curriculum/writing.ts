// Writing / English topics: EYFS Literacy ELGs, Y1–Y2 spelling (NC English Appendix 1), punctuation & grammar.
import type { Generator, Question, Rng, Topic } from './types';
import { ri, pick, shuffle, wordQ } from './util';

const LETTERS = 'abcdefghijklmnopqrstuvwxyz'.split('');
const VOWELS = ['a', 'e', 'i', 'o', 'u'];

// Phonics word bank: [word, emoji]
const CVC: [string, string][] = [['cat', '🐱'], ['dog', '🐶'], ['sun', '☀️'], ['bus', '🚌'], ['hat', '🎩'], ['pig', '🐷'], ['cup', '☕'], ['bed', '🛏️'], ['fox', '🦊'], ['bag', '👜'], ['pen', '🖊️'], ['egg', '🥚'], ['hen', '🐔'], ['box', '📦'], ['jam', '🍯'], ['map', '🗺️'], ['bat', '🦇'], ['web', '🕸️'], ['cow', '🐮'], ['leg', '🦵'], ['bug', '🐛'], ['van', '🚐'], ['mug', '🍺'], ['net', '🥅'], ['zip', '🤐'], ['log', '🪵']];
const DIGRAPH_WORDS: [string, string, string][] = [['ship', 'sh', '🚢'], ['fish', 'sh', '🐟'], ['chip', 'ch', '🍟'], ['chick', 'ch', '🐤'], ['moth', 'th', '🦋'], ['bath', 'th', '🛁'], ['ring', 'ng', '💍'], ['king', 'ng', '👑'], ['rain', 'ai', '🌧️'], ['boat', 'oa', '⛵'], ['moon', 'oo', '🌙'], ['tree', 'ee', '🌳'], ['coin', 'oi', '🪙'], ['cow', 'ow', '🐮'], ['star', 'ar', '⭐'], ['fork', 'or', '🍴'], ['bee', 'ee', '🐝'], ['sheep', 'ee', '🐑'], ['snail', 'ai', '🐌'], ['goat', 'oa', '🐐'], ['shark', 'ar', '🦈'], ['whale', 'wh', '🐋']];
const DIGRAPHS = ['sh', 'ch', 'th', 'ng', 'ai', 'oa', 'oo', 'ee', 'oi', 'ow', 'ar', 'or', 'wh', 'qu', 'ck'];

/**
 * Sound Hunt bank: [grapheme, phoneme family, where the sound sits in the words, keyword words].
 * Phase 2/3 (Reception) and phase 5 (Year 1) follow the Letters and Sounds / Little Wandle order.
 * The phoneme family keeps sound-alike graphemes (c/k, ai/ay/a-e, ee/ea …) out of each other's bubbles: by ear they are the same sound.
 */
export type Sound = [string, string, 'start' | 'middle' | 'end', string[]];
export const PHASE2: Sound[] = [
  ['s', 's', 'start', ['sun', 'sock', 'sad', 'sit']], ['a', 'a', 'start', ['apple', 'ant', 'add', 'axe']], ['t', 't', 'start', ['tap', 'tin', 'top', 'ten']], ['p', 'p', 'start', ['pan', 'pig', 'pen', 'pot']],
  ['i', 'i', 'start', ['ink', 'insect', 'igloo', 'it']], ['n', 'n', 'start', ['net', 'nap', 'nut', 'nod']], ['m', 'm', 'start', ['man', 'map', 'mud', 'mop']], ['d', 'd', 'start', ['dog', 'dig', 'dad', 'duck']],
  ['g', 'g', 'start', ['goat', 'gap', 'get', 'gum']], ['o', 'o', 'start', ['on', 'orange', 'octopus', 'off']], ['c', 'k', 'start', ['cat', 'cup', 'cot', 'can']], ['k', 'k', 'start', ['kit', 'kick', 'kid', 'king']],
  ['e', 'e', 'start', ['egg', 'elbow', 'end', 'elephant']], ['u', 'u', 'start', ['up', 'umbrella', 'under', 'us']], ['r', 'r', 'start', ['rat', 'run', 'red', 'rug']],
];
export const PHASE2B: Sound[] = [   // the remaining single-letter sounds (phase 2 set 5, phase 3 letters)
  ['h', 'h', 'start', ['hat', 'hen', 'hop', 'hug']], ['b', 'b', 'start', ['bat', 'bed', 'bus', 'big']], ['f', 'f', 'start', ['fan', 'fox', 'fin', 'fun']], ['l', 'l', 'start', ['leg', 'lip', 'log', 'lot']],
  ['j', 'j', 'start', ['jam', 'jet', 'jug', 'jog']], ['v', 'v', 'start', ['van', 'vet', 'vest', 'visit']], ['w', 'w', 'start', ['wet', 'web', 'win', 'wig']], ['x', 'ks', 'end', ['fox', 'box', 'six', 'mix']],
  ['y', 'y', 'start', ['yes', 'yak', 'yum', 'yell']], ['z', 'z', 'start', ['zip', 'zebra', 'zoo', 'zoom']], ['qu', 'kw', 'start', ['queen', 'quick', 'quilt', 'quiz']],
];
export const PHASE3: Sound[] = [
  ['ch', 'ch', 'start', ['chip', 'chop', 'chin', 'chick']], ['sh', 'sh', 'start', ['ship', 'shop', 'shell', 'shut']], ['th', 'th', 'start', ['thin', 'thick', 'think', 'thumb']], ['ng', 'ng', 'end', ['ring', 'king', 'song', 'long']],
  ['ai', 'ai', 'middle', ['rain', 'tail', 'paint', 'snail']], ['ee', 'ee', 'middle', ['feet', 'sheep', 'green', 'keep']], ['igh', 'igh', 'middle', ['night', 'light', 'fight', 'tight']], ['oa', 'oa', 'middle', ['boat', 'goat', 'coat', 'road']],
  ['oo', 'oo', 'middle', ['moon', 'spoon', 'food', 'boot']], ['ar', 'ar', 'middle', ['park', 'farm', 'card', 'dark']], ['or', 'or', 'middle', ['fork', 'corn', 'storm', 'sort']], ['ur', 'ur', 'middle', ['burn', 'turn', 'hurt', 'curl']],
  ['ow', 'ow', 'end', ['cow', 'how', 'now', 'wow']], ['oi', 'oi', 'middle', ['coin', 'boil', 'join', 'soil']], ['ear', 'ear', 'end', ['near', 'dear', 'fear', 'hear']], ['air', 'air', 'end', ['hair', 'fair', 'chair', 'pair']], ['er', 'ur', 'end', ['hammer', 'ladder', 'letter', 'dinner']],
];
export const PHASE5: Sound[] = [
  ['ay', 'ai', 'end', ['day', 'play', 'say', 'tray']], ['ou', 'ow', 'middle', ['out', 'cloud', 'shout', 'loud']], ['ie', 'igh', 'end', ['pie', 'tie', 'lie', 'die']], ['ea', 'ee', 'middle', ['leaf', 'beach', 'meat', 'seat']],
  ['oy', 'oi', 'end', ['boy', 'toy', 'joy', 'enjoy']], ['ir', 'ur', 'middle', ['girl', 'bird', 'shirt', 'dirt']], ['ue', 'oo', 'end', ['blue', 'glue', 'clue', 'true']], ['aw', 'or', 'end', ['saw', 'paw', 'claw', 'draw']],
  ['wh', 'w', 'start', ['when', 'whale', 'wheel', 'whisk']], ['ph', 'f', 'start', ['phone', 'photo', 'phonics', 'phrase']], ['ew', 'oo', 'end', ['new', 'chew', 'few', 'grew']], ['oe', 'oa', 'end', ['toe', 'hoe', 'tiptoe', 'doe']], ['au', 'or', 'start', ['autumn', 'August', 'author', 'auburn']],
];
export const SPLIT: Sound[] = [   // split digraphs (phase 5)
  ['a-e', 'ai', 'middle', ['cake', 'make', 'lake', 'gate']], ['i-e', 'igh', 'middle', ['bike', 'kite', 'time', 'line']], ['o-e', 'oa', 'middle', ['bone', 'home', 'nose', 'rope']], ['u-e', 'oo', 'middle', ['cube', 'tube', 'June', 'flute']],
];
const LETTER_SOUNDS = [...PHASE2, ...PHASE2B];
/** Sound Hunt: three keyword words are spoken (never shown); slice the grapheme for the sound they share. */
function soundQ(rng: Rng, pool: Sound[], distractPool: Sound[], decoys: number): Question {
  const [g, ph, pos, words] = pick(rng, pool);
  const ws = shuffle(rng, words).slice(0, 3);
  const ds = shuffle(rng, distractPool.filter(s => s[1] !== ph)).slice(0, decoys).map(s => s[0]);
  const where = pos === 'start' ? 'start with' : pos === 'end' ? 'end with' : 'have in the middle';
  return wordQ(rng, '🔊 Listen!', g, ds, { say: `Listen: ${ws.join(', ')}. Which sound do they ${where}?`, listen: ws.join(' · '), hint: `Slice the sound at the ${pos}` });
}
const rSoundHunt: Generator = (d, rng) => d === 1 ? soundQ(rng, PHASE2, PHASE2, 2) : d === 2 ? soundQ(rng, LETTER_SOUNDS, LETTER_SOUNDS, 3) : soundQ(rng, PHASE3, PHASE3, 3);
const y1SoundHunt: Generator = (d, rng) => d === 1 ? soundQ(rng, PHASE3, PHASE3, 2) : d === 2 ? soundQ(rng, PHASE5, [...PHASE3, ...PHASE5], 3) : soundQ(rng, [...PHASE5, ...SPLIT], [...PHASE3, ...PHASE5, ...SPLIT], 3);

export const Y1_CEW = ['the', 'a', 'do', 'to', 'today', 'of', 'said', 'says', 'are', 'were', 'was', 'is', 'his', 'has', 'you', 'your', 'they', 'be', 'he', 'me', 'she', 'we', 'no', 'go', 'so', 'by', 'my', 'here', 'there', 'where', 'love', 'come', 'some', 'one', 'once', 'ask', 'friend', 'school', 'put', 'push', 'pull', 'full', 'house', 'our'];
export const Y2_CEW = ['door', 'floor', 'poor', 'because', 'find', 'kind', 'mind', 'behind', 'child', 'children', 'wild', 'climb', 'most', 'only', 'both', 'old', 'cold', 'gold', 'hold', 'told', 'every', 'everybody', 'even', 'great', 'break', 'steak', 'pretty', 'beautiful', 'after', 'fast', 'last', 'past', 'father', 'class', 'grass', 'pass', 'plant', 'path', 'bath', 'hour', 'move', 'prove', 'improve', 'sure', 'sugar', 'eye', 'could', 'should', 'would', 'who', 'whole', 'any', 'many', 'clothes', 'busy', 'people', 'water', 'again', 'half', 'money', 'parents'];
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/** Spelling by slicing letters in order (sequence question). */
function spellQ(rng: Rng, word: string, hintEmoji?: string, decoys = 3): ReturnType<Generator> {
  const letters = word.split('');
  const pool = LETTERS.filter(l => !letters.includes(l));
  const uniq = [...new Set(letters)];
  const ds = shuffle(rng, pool).slice(0, Math.max(1, Math.min(decoys, 10 - uniq.length)));
  return { prompt: hintEmoji ? `${hintEmoji}  Spell it!` : `Spell: ${word}`, say: `Spell the word ${word}`, answer: word, sequence: letters, options: shuffle(rng, [...uniq, ...ds]), visual: { type: 'word', text: word.replace(/./g, '_ ').trim(), emoji: hintEmoji }, hint: 'Slice the letters in order' };
}

/**
 * Story Sentences: slice the words in order to build a sentence (sequence question with word bubbles).
 * `show` = the sentence is printed on the card (reading + word order); otherwise only spoken (listen, remember, build).
 */
function sentenceQ(rng: Rng, sentence: string, emoji: string, decoyPool: string[], decoys: number, show: boolean): ReturnType<Generator> {
  const words = sentence.split(' ');
  const bare = (w: string) => w.toLowerCase().replace(/[.!?,]/g, '');
  const used = new Set(words.map(bare));
  const ds = shuffle(rng, decoyPool.filter(w => !used.has(bare(w)))).slice(0, Math.min(decoys, 10 - words.length));
  return { prompt: 'Build the sentence', say: `Build the sentence: ${sentence}`, answer: sentence, sequence: words, options: shuffle(rng, [...words, ...ds]), wide: true,
    visual: show ? { type: 'sentence', text: sentence } : { type: 'word', text: emoji }, hint: show ? 'Slice the words in order' : 'Listen, then slice the words in order' };
}
type Sent = [string, string];   // [sentence, picture]
const R_SENTS: Sent[][] = [
  [['I can run.', '🏃'], ['I can hop.', '🐰'], ['I like jam.', '🍯'], ['The cat sat.', '🐱'], ['The dog ran.', '🐶'], ['I see mum.', '👩'], ['We can jump.', '🤸'], ['It is hot.', '☀️'], ['The sun is up.', '🌅'], ['I am six.', '🎂']],
  [['I like my hat.', '🎩'], ['The pig is pink.', '🐷'], ['Dad has a van.', '🚐'], ['The fox can run.', '🦊'], ['We go to bed.', '🛏️'], ['Mum has a cup.', '☕'], ['The bus is red.', '🚌'], ['I can see it.', '👀'], ['The hen has an egg.', '🐔'], ['My bag is big.', '👜']],
  [['The cat sat on a mat.', '🐱'], ['I can see a red bus.', '🚌'], ['The dog is in the sun.', '🐶'], ['We had jam on toast.', '🍞'], ['The fish can swim fast.', '🐟'], ['I put my hat on.', '🎩'], ['A frog sat on the log.', '🐸'], ['My cat is on the bed.', '🛏️'], ['Can you see the moon?', '🌙'], ['The big pig is in mud.', '🐷']],
];
const Y1_SENTS: Sent[][] = [
  [['The frog can jump high.', '🐸'], ['My mum has a red car.', '🚗'], ['We like to play outside.', '⚽'], ['The little bird can sing.', '🐦'], ['I have two pet fish.', '🐟'], ['The ship sails on the sea.', '🚢'], ['Can you see the rainbow?', '🌈'], ['The king has a gold crown.', '👑'], ['We went to the park.', '🌳'], ['My friend has a kite.', '🪁']],
  [['The little dog ran very fast.', '🐶'], ['We had chips for our tea.', '🍟'], ['Can you find my blue sock?', '🧦'], ['The moon shines at night.', '🌙'], ['I love to read in bed.', '📖'], ['The sheep are in the field.', '🐑'], ['My dad made a big cake.', '🎂'], ['Is it raining today?', '🌧️'], ['The snail moved along slowly.', '🐌'], ['Look at that huge whale!', '🐋']],
  [['The cat and the dog play.', '🐱'], ['We ran and jumped in the park.', '🌳'], ['I like apples and pears.', '🍎'], ['Is it a bird or an aeroplane?', '✈️'], ['She sang and we all clapped.', '🎤'], ['The boat rocked and the fish jumped.', '⛵'], ['Put on your coat and hat.', '🧥'], ['What a lovely sunny day!', '☀️'], ['He fell but he was fine.', '🩹'], ['We can swim or hop today.', '🏊']],
];
const Y2_SENTS: Sent[][] = [
  [['The shiny red kite flew high.', '🪁'], ['Please shut the door quietly.', '🚪'], ['A tiny mouse hid under the chair.', '🐭'], ['The brave knight rode away.', '🏇'], ['Our class went to the museum.', '🏛️'], ['Do you like pizza or pasta?', '🍕'], ['The fluffy kitten chased a leaf.', '🐱'], ['Grandad grows tall yellow sunflowers.', '🌻'], ['What a wonderful surprise this is!', '🎁'], ['Wash your hands before lunch.', '🧼']],
  [['Sam was late because he overslept.', '⏰'], ['The old man walked slowly home.', '👴'], ['We stayed inside because it rained.', '🌧️'], ['She smiled when she saw the puppy.', '🐶'], ['The rocket zoomed into dark space.', '🚀'], ['Would you like some sweet honey?', '🍯'], ['He was tired but he kept running.', '🏃'], ['The children built a huge sandcastle.', '🏖️'], ['My sister plays the violin beautifully.', '🎻'], ['Bring an umbrella if it rains.', '☂️']],
  [['If it rains, we will stay inside.', '☂️'], ['You can play when you have finished.', '🎮'], ['The bird sang because it was happy.', '🐦'], ['We can walk or take the bus.', '🚌'], ['The dragon roared and the village shook.', '🐉'], ['Although it was cold, we went out.', '🧣'], ['Please tidy your room before dinner.', '🧹'], ['The clever fox found a secret path.', '🦊'], ['Everybody cheered when our team scored.', '⚽'], ['After lunch we painted colourful pictures.', '🎨']],
];
const R_DECOYS = ['dog', 'cat', 'sun', 'hat', 'pig', 'run', 'big', 'red', 'mum', 'bed', 'jam', 'bus', 'hop', 'cup', 'fox', 'egg'];
const Y1_DECOYS = ['dog', 'cat', 'play', 'red', 'big', 'run', 'jump', 'fish', 'moon', 'park', 'cake', 'ship', 'hat', 'blue', 'fast', 'sing', 'apple', 'coat'];
const Y2_DECOYS = ['because', 'when', 'and', 'but', 'quickly', 'happy', 'tiny', 'huge', 'garden', 'school', 'dragon', 'river', 'shiny', 'after', 'before', 'yellow', 'kite', 'mouse'];
const sentGen = (banks: Sent[][], decoyPool: string[], decoys: [number, number, number], showUntil: number): Generator => (d, rng) => {
  const [s, e] = pick(rng, banks[d - 1]);
  return sentenceQ(rng, s, e, decoyPool, decoys[d - 1], d <= showUntil);
};
const rSentence = sentGen(R_SENTS, R_DECOYS, [1, 1, 2], 3);          // Reception always reads the sentence
const y1Sentence = sentGen(Y1_SENTS, Y1_DECOYS, [2, 2, 2], 1);       // Y1/Y2: sentence shown at d1 only, then listen & build
const y2Sentence = sentGen(Y2_SENTS, Y2_DECOYS, [2, 3, 3], 1);

/** Missing-letter question: show word with a gap, options are letters. */
function gapQ(rng: Rng, word: string, idx: number, distractPool: string[], emoji?: string, say?: string) {
  const ans = word[idx];
  const shown = word.slice(0, idx) + '_' + word.slice(idx + 1);
  const ds = shuffle(rng, distractPool.filter(l => l !== ans)).slice(0, 3);
  return wordQ(rng, shown, ans, ds, { visual: { type: 'word', text: shown, emoji }, say: say ?? `Which letter is missing from ${word}?`, hint: 'Slice the missing letter' });
}

// ---------- Reception ----------
const rLetterSound: Generator = (d, rng) => {
  const [w, e] = pick(rng, CVC);
  if (d === 1) return gapQ(rng, w, 0, LETTERS, e, `${w}. Which sound does ${w} start with?`);
  if (d === 2) return gapQ(rng, w, 2, LETTERS, e, `${w}. Which sound does ${w} end with?`);
  return gapQ(rng, w, 1, VOWELS, e, `${w}. Which sound is in the middle of ${w}?`);
};
const rCapitals: Generator = (d, rng) => {
  const l = pick(rng, LETTERS);
  const upper = rng() < 0.5;
  const shown = upper ? l.toUpperCase() : l;
  const ans = upper ? l : l.toUpperCase();
  const ds = shuffle(rng, LETTERS.filter(x => x !== l)).slice(0, d === 1 ? 2 : 3).map(x => (upper ? x : x.toUpperCase()));
  return wordQ(rng, shown, ans, ds, { visual: { type: 'word', text: shown }, say: `Find the ${upper ? 'small' : 'capital'} letter that matches ${l}`, hint: upper ? 'Find the lowercase letter' : 'Find the capital letter' });
};
const rBuild: Generator = (d, rng) => {
  const [w, e] = pick(rng, CVC);
  return spellQ(rng, w, e, d === 1 ? 2 : d === 2 ? 3 : 4);
};
const rTrace: Generator = (d, rng) => {
  const l = pick(rng, LETTERS);
  const upper = d === 3 ? rng() < 0.5 : d === 2 ? rng() < 0.25 : false;
  const t = upper ? l.toUpperCase() : l;
  return { prompt: `Trace the letter ${t}`, say: `Trace the letter ${l}`, answer: t, options: [t], visual: { type: 'word', text: t } };
};

// ---------- Year 1 ----------
const y1Digraphs: Generator = (d, rng) => {
  const [w, dg, e] = pick(rng, DIGRAPH_WORDS);
  const idx = w.indexOf(dg);
  const shown = w.slice(0, idx) + '__' + w.slice(idx + 2);
  const ds = shuffle(rng, DIGRAPHS.filter(x => x !== dg)).slice(0, d === 1 ? 2 : 3);
  return wordQ(rng, shown, dg, ds, { visual: { type: 'word', text: shown, emoji: e }, say: `${w}. Which two letters are missing from ${w}?`, hint: 'Slice the missing sound' });
};
const y1Spelling: Generator = (d, rng) => {
  const w = pick(rng, Y1_CEW.filter(x => x.length >= (d === 1 ? 2 : 3) && x.length <= (d === 3 ? 6 : 4)));
  if (d === 3 && rng() < 0.5) return spellQ(rng, w, undefined, 3);
  const idx = ri(rng, 0, w.length - 1);
  return gapQ(rng, w, idx, LETTERS, undefined, `Which letter is missing from the word ${w}?`);
};
const y1Plurals: Generator = (d, rng) => {
  const S: [string, string][] = [['cat', 's'], ['dog', 's'], ['book', 's'], ['hat', 's'], ['car', 's'], ['tree', 's'], ['fox', 'es'], ['box', 'es'], ['bus', 'es'], ['dish', 'es'], ['bench', 'es'], ['wish', 'es'], ['glass', 'es'], ['brush', 'es']];
  const [w, suf] = pick(rng, d === 1 ? S.filter(x => x[1] === 's') : S);
  return wordQ(rng, `one ${w}, two ${w}__`, suf, ['s', 'es', 'ies'], { visual: { type: 'word', text: `${w}_` }, say: `One ${w}, two ${w}${suf}. Which ending makes it more than one?`, hint: 'Add -s or -es' });
};
const y1Suffix: Generator = (d, rng) => {
  const W: [string, string, string][] = [['jump', 'ing', 'She is jump___ now.'], ['play', 'ed', 'Yesterday he play___.'], ['walk', 'ing', 'I am walk___ to school.'], ['look', 'ed', 'We look___ at the sky.'], ['fast', 'er', 'A car is fast___ than a bike.'], ['tall', 'est', 'The tall___ tree in the park.'], ['help', 'ing', 'Dad is help___ me.'], ['kick', 'ed', 'He kick___ the ball yesterday.'], ['kind', 'er', 'Be kind___ to your friends.'], ['small', 'est', 'The small___ mouse of all.']];
  const [, suf, sent] = pick(rng, W);
  return wordQ(rng, sent, suf, ['ing', 'ed', 'er', 'est'], { visual: { type: 'sentence', text: sent }, say: sent.replace('___', 'blank'), hint: 'Slice the ending' });
};
const PUNCT_SENTS: [string, string][] = [['I like apples', '.'], ['Where is my hat', '?'], ['What a great day', '!'], ['The dog ran home', '.'], ['Can you jump high', '?'], ['We went to the park', '.'], ['Is it raining', '?'], ['Look at that', '!'], ['My cat is black', '.'], ['How old are you', '?'], ['Stop', '!'], ['Do you like pizza', '?']];
const y1Punct: Generator = (d, rng) => {
  if (d === 1 || (d === 2 && rng() < 0.5)) {
    const [s, p] = pick(rng, PUNCT_SENTS);
    const words = s.split(' ');
    const lower = words[0].toLowerCase() + (words.length > 1 ? ' ' + words.slice(1).join(' ') : '') + p;
    const ans = words[0];
    const ds = shuffle(rng, [words[0].toLowerCase(), words[0].toUpperCase(), (words[1] ?? 'It')]).filter(x => x !== ans).slice(0, 2);
    return wordQ(rng, `_${lower.slice(words[0].length)}`, ans, ds, { visual: { type: 'sentence', text: lower }, say: `Which word starts the sentence: ${s}?`, hint: 'Sentences start with a capital letter' });
  }
  const [s, p] = pick(rng, PUNCT_SENTS);
  return wordQ(rng, `${s}_`, p, ['.', '?', '!'], { visual: { type: 'sentence', text: `${s}_` }, say: `${s}. Full stop, question mark or exclamation mark?`, hint: 'Slice the missing punctuation' });
};
const y1Days: Generator = (d, rng) => {
  const day = pick(rng, DAYS);
  if (d === 3) return spellQ(rng, day.toLowerCase(), '📅', 3);
  const idx = ri(rng, 1, Math.min(4, day.length - 1));
  return gapQ(rng, day, idx, LETTERS, '📅', `Which letter is missing from ${day}?`);
};
const y1Trace: Generator = (d, rng) => {
  if (d === 3) { const [w, e] = pick(rng, CVC); return { prompt: `Trace: ${w}`, say: `Trace the word ${w}`, answer: w, options: [w], visual: { type: 'word', text: w, emoji: e } }; }
  const l = pick(rng, LETTERS);
  const t = d === 2 && rng() < 0.5 ? l.toUpperCase() : l;
  return { prompt: `Trace the letter ${t}`, say: `Trace the letter ${l}`, answer: t, options: [t], visual: { type: 'word', text: t } };
};

// ---------- Year 2 ----------
const y2Spelling: Generator = (d, rng) => {
  const w = pick(rng, Y2_CEW.filter(x => x.length <= (d === 1 ? 5 : d === 2 ? 7 : 10)));
  if (d === 3 && rng() < 0.4) return spellQ(rng, w, undefined, 3);
  const idx = ri(rng, 0, w.length - 1);
  return gapQ(rng, w, idx, LETTERS, undefined, `Which letter is missing from the word ${w}?`);
};
const CONTRACTIONS: [string, string][] = [['do not', "don't"], ['can not', "can't"], ['is not', "isn't"], ['I am', "I'm"], ['it is', "it's"], ['you are', "you're"], ['we will', "we'll"], ['did not', "didn't"], ['has not', "hasn't"], ['they are', "they're"], ['I will', "I'll"], ['could not', "couldn't"]];
const y2Contractions: Generator = (d, rng) => {
  const [long, short] = pick(rng, CONTRACTIONS);
  const ds = shuffle(rng, CONTRACTIONS.filter(c => c[1] !== short)).slice(0, d === 1 ? 2 : 3).map(c => c[1]);
  if (d === 3 && rng() < 0.5) return wordQ(rng, short, long, shuffle(rng, CONTRACTIONS.filter(c => c[0] !== long)).slice(0, 3).map(c => c[0]), { visual: { type: 'word', text: short }, say: `What does ${short} mean?` });
  return wordQ(rng, long, short, ds, { visual: { type: 'word', text: long }, say: `Which contraction means ${long}?`, hint: 'Slice the short form' });
};
const SUFFIX2: [string, string, string][] = [['care', 'ful', 'Be care___ on the road.'], ['hope', 'less', 'The lost sock was hope___.'], ['kind', 'ness', 'Show kind___ to others.'], ['slow', 'ly', 'The snail moved slow___.'], ['enjoy', 'ment', 'We had lots of enjoy___.'], ['help', 'ful', 'A very help___ friend.'], ['quick', 'ly', 'She ran quick___.'], ['sad', 'ness', 'He felt great sad___.'], ['fear', 'less', 'The fear___ ninja jumped.'], ['pay', 'ment', 'Mum made the pay___.']];
const y2Suffix: Generator = (d, rng) => {
  const [, suf, sent] = pick(rng, SUFFIX2);
  return wordQ(rng, sent, suf, ['ful', 'less', 'ness', 'ly', 'ment'].filter(x => x !== suf).slice(0, d === 1 ? 2 : 3), { visual: { type: 'sentence', text: sent }, say: sent.replace('___', 'blank'), hint: 'Slice the ending' });
};
const HOMOPHONES: [string, string[], string][] = [['I want ___ go home.', ['to', 'too', 'two'], 'to'], ['I have ___ cats.', ['two', 'to', 'too'], 'two'], ['Me ___!', ['too', 'to', 'two'], 'too'], ['___ house is big.', ['Their', 'There', "They're"], 'Their'], ['Look over ___!', ['there', 'their', "they're"], 'there'], ['___ going out.', ["They're", 'Their', 'There'], "They're"], ['I can ___ the sea.', ['see', 'sea'], 'see'], ['The ___ shines.', ['sun', 'son'], 'sun'], ['It is ___ o\'clock.', ['one', 'won'], 'one'], ['We ___ the race!', ['won', 'one'], 'won'], ['Turn ___ the light.', ['on', 'won'], 'on'], ['The bear has ___ fur.', ['brown', 'brawn'], 'brown'], ['___ is a bird.', ['Here', 'Hear'], 'Here'], ['I can ___ you.', ['hear', 'here'], 'hear'], ['A ___ of bread.', ['piece', 'peace'], 'piece'], ['The ___ blew hard.', ['wind', 'wined'], 'wind']];
const y2Homophones: Generator = (_d, rng) => {
  const [sent, opts, ans] = pick(rng, HOMOPHONES);
  return wordQ(rng, sent, ans, opts.filter(o => o !== ans), { visual: { type: 'sentence', text: sent }, say: sent.replace('___', 'blank'), hint: 'Slice the right word' });
};
const y2Punct: Generator = (d, rng) => {
  const k = d === 1 ? 0 : ri(rng, 0, 2);
  if (k === 0) { const [s, p] = pick(rng, PUNCT_SENTS); return wordQ(rng, `${s}_`, p, ['.', '?', '!'], { visual: { type: 'sentence', text: `${s}_` }, say: `${s}. Which punctuation mark ends this sentence?` }); }
  if (k === 1) {
    const L: [string, string][] = [['I like apples, pears_ and plums.', ','], ['We saw lions, tigers_ bears and monkeys.', ','], ['Red, blue_ green and yellow.', ','], ['Bring a hat, coat_ scarf and gloves.', ',']];
    const [s, p] = pick(rng, L);
    return wordQ(rng, s, p, ['.', '?', ';'], { visual: { type: 'sentence', text: s }, say: 'Which mark separates the items in the list?', hint: 'Commas in a list' });
  }
  const A: [string, string][] = [["The dog_s bone.", "'"], ["Sam_s hat is red.", "'"], ["My mum_s car.", "'"], ["The cat_s tail.", "'"]];
  const [s, p] = pick(rng, A);
  return wordQ(rng, s, p, [',', '.', '-'], { visual: { type: 'sentence', text: s }, say: 'Which mark shows something belongs to someone?', hint: 'Possessive apostrophe' });
};
const y2Trace: Generator = (d, rng) => {
  const w = pick(rng, d === 1 ? Y1_CEW.filter(x => x.length <= 4) : Y2_CEW.filter(x => x.length <= (d === 2 ? 5 : 7)));
  return { prompt: `Trace: ${w}`, say: `Trace the word ${w}`, answer: w, options: [w], visual: { type: 'word', text: w } };
};

export const WRITING_TOPICS: Topic[] = [
  { id: 'r-sounds', title: 'Letter Sounds', icon: '🔊', subject: 'writing', year: 'reception', nc: 'ELG Writing: sounds to letters', gen: rLetterSound },
  { id: 'r-soundhunt', title: 'Sound Hunt', icon: '👂', subject: 'writing', year: 'reception', nc: 'ELG Word Reading: say a sound for each letter; phase 2–3 sounds by ear', gen: rSoundHunt },
  { id: 'r-capitals', title: 'Big & Small Letters', icon: '🅰️', subject: 'writing', year: 'reception', nc: 'ELG Word Reading: letters', gen: rCapitals },
  { id: 'r-build', title: 'Build a Word', icon: '🧱', subject: 'writing', year: 'reception', nc: 'ELG Writing: spell by sounds (CVC)', gen: rBuild },
  { id: 'r-sentence', title: 'Story Sentences', icon: '📖', subject: 'writing', year: 'reception', nc: 'ELG Writing: simple sentences', gen: rSentence },
  { id: 'r-trace', title: 'Trace Letters', icon: '✍️', subject: 'writing', year: 'reception', nc: 'ELG Writing: form letters', mode: 'tracing', gen: rTrace },
  { id: 'y1-digraphs', title: 'Sound Pairs', icon: '🔤', subject: 'writing', year: 'year1', nc: 'Y1 Spelling: digraphs', gen: y1Digraphs },
  { id: 'y1-soundhunt', title: 'Sound Hunt', icon: '👂', subject: 'writing', year: 'year1', nc: 'Y1 Word Reading: respond speedily to graphemes; phase 3 & 5 alternatives, split digraphs', gen: y1SoundHunt },
  { id: 'y1-spelling', title: 'Tricky Words', icon: '🧠', subject: 'writing', year: 'year1', nc: 'Y1 common exception words', gen: y1Spelling },
  { id: 'y1-plurals', title: 'Plurals -s -es', icon: '🐈', subject: 'writing', year: 'year1', nc: 'Y1 Spelling: plurals', gen: y1Plurals },
  { id: 'y1-suffix', title: 'Endings -ing -ed -er', icon: '🏃', subject: 'writing', year: 'year1', nc: 'Y1 Spelling: suffixes', gen: y1Suffix },
  { id: 'y1-punct', title: 'Fix the Sentence', icon: '❗', subject: 'writing', year: 'year1', nc: 'Y1 Grammar: capitals, . ? !', gen: y1Punct },
  { id: 'y1-days', title: 'Days of the Week', icon: '📅', subject: 'writing', year: 'year1', nc: 'Y1 Spelling: days', gen: y1Days },
  { id: 'y1-sentence', title: 'Story Sentences', icon: '📖', subject: 'writing', year: 'year1', nc: 'Y1 Writing: sequence words into sentences, and', gen: y1Sentence },
  { id: 'y1-trace', title: 'Trace Letters', icon: '✍️', subject: 'writing', year: 'year1', nc: 'Y1 Handwriting', mode: 'tracing', gen: y1Trace },
  { id: 'y2-spelling', title: 'Tricky Words', icon: '🧠', subject: 'writing', year: 'year2', nc: 'Y2 common exception words', gen: y2Spelling },
  { id: 'y2-contractions', title: "Contractions don't", icon: '✂️', subject: 'writing', year: 'year2', nc: 'Y2 Spelling: contractions', gen: y2Contractions },
  { id: 'y2-suffix', title: 'Endings -ful -ly', icon: '🎀', subject: 'writing', year: 'year2', nc: 'Y2 Spelling: suffixes', gen: y2Suffix },
  { id: 'y2-homophones', title: 'Sound-alike Words', icon: '👂', subject: 'writing', year: 'year2', nc: 'Y2 Spelling: homophones', gen: y2Homophones },
  { id: 'y2-punct', title: 'Fix the Sentence', icon: '❗', subject: 'writing', year: 'year2', nc: 'Y2 Grammar: commas, apostrophes', gen: y2Punct },
  { id: 'y2-sentence', title: 'Story Sentences', icon: '📖', subject: 'writing', year: 'year2', nc: 'Y2 Writing: word order, conjunctions, noun phrases', gen: y2Sentence },
  { id: 'y2-trace', title: 'Trace Words', icon: '✍️', subject: 'writing', year: 'year2', nc: 'Y2 Handwriting', mode: 'tracing', gen: y2Trace },
];
