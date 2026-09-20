// Writing / English topics: EYFS Literacy ELGs, Y1–Y2 spelling (NC English Appendix 1), punctuation & grammar.
import type { Generator, Question, Rng, Topic } from './types';
import { ri, pick, shuffle, wordQ } from './util';

const LETTERS = 'abcdefghijklmnopqrstuvwxyz'.split('');
const VOWELS = ['a', 'e', 'i', 'o', 'u'];

// Phonics word bank: [word, emoji]. The first block is spellable with phase 2 letters alone, which is what
// Reception stage 1 draws from (#14) — it is listed first only for reading; nothing depends on the order.
//
// EVERY ENTRY MUST BE EXACTLY THREE LETTERS, and a rail in tests/unit/curriculum.test.ts holds it there.
// `rLetterSound` addresses the sounds by fixed index — 2 for the final sound, 1 for the medial — so a
// four-letter word here does not merely read oddly, it ships a WRONG ANSWER: `frog` at difficulty 2 asks
// "which sound does frog end with?", shows `fr_g` and marks `o` correct. Exported for that rail alone.
export const CVC: [string, string][] = [['cat', '🐱'], ['dog', '🐶'], ['sun', '☀️'], ['pig', '🐷'], ['cup', '☕'], ['pen', '🖊️'], ['egg', '🥚'], ['map', '🗺️'], ['mug', '🍺'], ['net', '🥅'], ['tap', '🚰'], ['pot', '🍲'], ['pin', '📌'], ['rug', '🧶'], ['nut', '🥜'], ['cap', '🧢'], ['rat', '🐀'], ['pan', '🍳'],
  ['bus', '🚌'], ['hat', '🎩'], ['bed', '🛏️'], ['fox', '🦊'], ['bag', '👜'], ['hen', '🐔'], ['box', '📦'], ['jam', '🍯'], ['bat', '🦇'], ['web', '🕸️'], ['cow', '🐮'], ['leg', '🦵'], ['bug', '🐛'], ['van', '🚐'], ['zip', '🤐'], ['log', '🪵']];
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

/**
 * Reception letter pools, in the Little Wandle / Letters and Sounds order (#14).
 *
 * Derived from the Sound Hunt banks above rather than written out again, and that is the point: `PHASE2` and
 * `PHASE2B` are the single home of the phase order, so a letter moved between phases moves for every
 * Reception topic at once. Sound Hunt already walked the order; `r-sounds`, `r-build`, `r-capitals` and
 * `r-trace` drew from the whole alphabet at every difficulty, so stage 1 could ask a phase-2 child for `jam`
 * or offer `z` as a decoy — a ramp orthogonal to the one the child is actually being taught on.
 *
 * `qu` is dropped: these pools answer "which letter", and `qu` is two. That also means the full pool is 25
 * letters, not 26 — there is no bare `q` sound in English, and `PHASE2B` is right not to list one.
 */
const singles = (ss: Sound[]) => ss.map(s => s[0]).filter(g => g.length === 1);
export const R_LETTERS_P2 = singles(PHASE2);                              // phase 2: the first fifteen
// Deduplicated at construction rather than only asserted in a test: a letter listed in two phases would skew
// every `pick` towards it, and this is where the nesting invariant already lives.
export const R_LETTERS_ALL = [...new Set([...R_LETTERS_P2, ...singles(PHASE2B)])];   // every single-letter sound
/**
 * The phase a Reception difficulty draws from. Deliberately nested (d1 ⊆ d2 = d3) rather than disjoint: a
 * child at stage 3 has not stopped knowing the phase-2 letters, and a pool that dropped them would make the
 * later stages *narrower*. The existing ramps — where the sound sits, how many decoys, upper case — are
 * unchanged and stack on top of this one.
 */
const rLetters = (d: 1 | 2 | 3) => (d === 1 ? R_LETTERS_P2 : R_LETTERS_ALL);
/** The CVC words spellable with the letters that difficulty has met. Answer and decoys both obey it. */
const rWords = (d: 1 | 2 | 3) => { const pool = rLetters(d); return CVC.filter(([w]) => [...w].every(c => pool.includes(c))); };
/**
 * #135: a word's middle letter is a genuine medial sound only when it is a vowel — `egg`'s middle is `g`, and
 * the question would show `e_g` against vowel decoys with `g` marked correct.
 */
export const medialIsGenuine = (w: string) => VOWELS.includes(w[1]);
/**
 * #135: a word's last letter is a genuine final sound unless it forms a digraph with the letter before it
 * (`cow` ends in `ow`, not `w` — `DIGRAPHS` already lists `ow` as one unit), or `LETTER_SOUNDS` itself
 * documents that letter's end-position sound as a blend distinct from the letter (`x`, in `PHASE2B`, is `ks`
 * at the end of `fox`/`box` — the only such entry). Mechanical, not a word list, so a future `CVC` addition
 * with the same shape is caught without touching this function.
 */
export const finalIsGenuine = (w: string) => {
  if (DIGRAPHS.includes(w.slice(-2))) return false;
  const entry = LETTER_SOUNDS.find(([g]) => g === w[w.length - 1]);
  return !entry || entry[2] !== 'end' || entry[1] === entry[0];
};

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

/**
 * The words a gap in a list word can spell, so that none of them is offered as a decoy (#296). Mostly everyday
 * words a KS1 child meets that are not on either exception-word list — the rhyme families the lists sit in
 * (`_old` is bold, fold and sold as well as cold, gold, hold, told) and the short words a single letter turns
 * one list word into (`p_t`, `_ull`, `h_s`). The last batch is wider than that: a decoy is a second right
 * answer whenever it spells *any* real word, not only one the child has been taught, so the sweep of all 489
 * drawable gaps (review of PR #303) put its remaining hits here too, KS1 vocabulary or not. Read by
 * `gapLetters` only.
 */
const EVERYDAY = ['I', 'it', 'in', 'if', 'is', 'as', 'at', 'an', 'am', 'on', 'or', 'ox', 'up', 'us', 'we', 'he', 'me', 'be', 'hi', 'my', 'by', 'oh', 'ah',
  'the', 'and', 'but', 'not', 'for', 'get', 'got', 'had', 'ham', 'hat', 'hay', 'him', 'hit', 'hop', 'hot', 'how', 'hug', 'hut', 'her', 'hen', 'hid', 'sad', 'sat', 'set', 'sit', 'sun', 'sum', 'saw', 'say', 'sea', 'see', 'sew', 'six', 'sky', 'shy', 'she', 'try', 'toy', 'top', 'tap', 'ten', 'tea', 'too', 'two', 'now', 'new', 'net', 'nut', 'nod', 'nap', 'gas', 'was', 'wax', 'win', 'wet', 'web', 'wig', 'why', 'way', 'wow', 'yes', 'yet', 'you', 'yak', 'zip', 'zoo',
  'bad', 'bag', 'bat', 'bed', 'bee', 'beg', 'bet', 'big', 'bin', 'bit', 'box', 'boy', 'bud', 'bug', 'bun', 'bus', 'bye', 'cab', 'can', 'cap', 'car', 'cat', 'cod', 'cog', 'cot', 'cow', 'cry', 'cub', 'cup', 'cut', 'dad', 'day', 'den', 'did', 'dig', 'dim', 'dip', 'dog', 'dot', 'dry', 'dug', 'ear', 'eat', 'egg', 'elf', 'end', 'eye', 'fan', 'far', 'fat', 'fed', 'fig', 'fin', 'fit', 'fix', 'fly', 'fog', 'fox', 'fun', 'fur', 'gap', 'god', 'gum', 'gun', 'gut', 'guy', 'gym',
  'jam', 'jar', 'jet', 'jog', 'joy', 'jug', 'key', 'kid', 'kit', 'lap', 'law', 'lay', 'led', 'leg', 'let', 'lid', 'lip', 'lit', 'log', 'low', 'mad', 'man', 'map', 'mat', 'may', 'men', 'met', 'mix', 'mop', 'mud', 'mug', 'mum', 'oil', 'old', 'one', 'our', 'out', 'owl', 'own', 'pad', 'pan', 'pat', 'paw', 'pay', 'pea', 'peg', 'pen', 'pet', 'pie', 'pig', 'pin', 'pit', 'pop', 'pot', 'pub', 'pup', 'put', 'rag', 'ran', 'rat', 'raw', 'red', 'rib', 'rid', 'rim', 'rip', 'rob', 'rod', 'rot', 'row', 'rub', 'rug', 'run', 'van', 'vet',
  'ace', 'add', 'age', 'ago', 'aid', 'aim', 'air', 'ant', 'ape', 'arm', 'art', 'ash', 'ask', 'ate', 'axe', 'ill', 'ink', 'inn', 'its', 'ice', 'odd', 'off', 'all',
  'bull', 'dull', 'full', 'gull', 'hull', 'pull', 'bold', 'fold', 'sold', 'bill', 'fill', 'hill', 'mill', 'pill', 'till', 'will', 'ball', 'call', 'fall', 'hall', 'tall', 'wall', 'bell', 'fell', 'sell', 'tell', 'well', 'yell', 'doll', 'poll', 'roll', 'toll', 'bush', 'hush', 'rush', 'push', 'posh', 'dish', 'fish', 'wish', 'cash', 'dash', 'rash', 'wash', 'bash', 'mash',
  'came', 'game', 'name', 'same', 'tame', 'home', 'dome', 'bone', 'cone', 'tone', 'zone', 'done', 'none', 'gone', 'live', 'give', 'dive', 'five', 'hive', 'hire', 'fire', 'wire', 'wore', 'more', 'sore', 'tore', 'bore', 'core', 'mere', 'here', 'sail', 'said', 'paid', 'maid', 'raid', 'laid', 'main', 'pain', 'rain', 'gain',
  'mouse', 'louse', 'horse', 'hoard', 'board', 'ward', 'word', 'cord', 'ford', 'bind', 'wind', 'mild', 'mind', 'kind', 'find', 'wild', 'child', 'most', 'post', 'host', 'cost', 'lost', 'both', 'moth', 'bath', 'path', 'past', 'fast', 'last', 'mast', 'vast', 'east', 'best', 'nest', 'rest', 'test', 'vest', 'west', 'pest', 'grass', 'glass', 'class', 'brass', 'pass', 'mass', 'bass', 'lass', 'plant', 'slant', 'grant', 'chant',
  'seat', 'meat', 'heat', 'beat', 'neat', 'peat', 'feat', 'great', 'greet', 'treat', 'steam', 'stead', 'steal', 'break', 'bread', 'breed', 'dear', 'hear', 'near', 'fear', 'gear', 'tear', 'wear', 'year', 'bear', 'pear', 'move', 'prove', 'grove', 'drove', 'stove', 'hour', 'sour', 'tour', 'four', 'pour', 'your', 'hole', 'pole', 'mole', 'role', 'sole', 'whole', 'poor', 'door', 'moor', 'floor', 'flour', 'penny', 'funny', 'sunny', 'bunny', 'money', 'honey', 'many', 'any', 'busy', 'easy', 'even', 'ever', 'oven', 'over', 'open', 'only', 'ugly', 'holy', 'tidy', 'lady', 'baby', 'body', 'copy', 'city', 'pity', 'duty', 'tiny',
  'talk', 'walk', 'chalk', 'stalk', 'told', 'hold', 'gold', 'golf', 'cold', 'colt', 'hurt', 'hurl', 'curl', 'girl', 'fool', 'tool', 'pool', 'cool', 'wool', 'half', 'calf', 'hail', 'pale', 'sale', 'tale', 'male', 'gale', 'kale', 'bake', 'cake', 'lake', 'make', 'rake', 'take', 'wake', 'like', 'bike', 'hike', 'pike', 'time', 'lime', 'mime', 'ride', 'hide', 'side', 'tide', 'wide', 'wipe', 'ripe', 'pipe', 'rope', 'hope', 'cope', 'nope', 'note', 'vote', 'tote', 'rote', 'cute', 'mute', 'tube', 'cube',
  'these', 'those', 'where', 'there', 'their', 'while', 'white', 'write', 'right', 'light', 'night', 'sight', 'tight', 'fight', 'might', 'could', 'would', 'should', 'mould', 'sugar', 'super', 'sure', 'pure', 'cure', 'lure', 'water', 'later', 'again', 'people', 'parent', 'father', 'rather', 'gather', 'lather', 'mother', 'other', 'bother', 'brother', 'after', 'often', 'every', 'eyes', 'weeks', 'clothes', 'cloth', 'children', 'climb', 'crime', 'prime', 'improve',
  // Added for review of PR #303: the list words' own neighbours (them/then, days/ways/pays, king, good …) and a wider batch.
  'them', 'then', 'days', 'ways', 'pays', 'king', 'good', 'fine', 'mine', 'must', 'held', 'hood', 'toad', 'list', 'war', 'comb', 'dove', 'bays', 'rays', 'lays', 'wag', 'lose', 'hare', 'hero', 'herd', 'tie', 'hip', 'ark', 'mint', 'mist', 'flood', 'fist', 'bury', 'halt', 'than', 'that', 'this', 'thin', 'they', 'tray', 'stay', 'play', 'pray', 'sway', 'away', 'jays', 'kind', 'find', 'bind', 'mind', 'wind', 'dust', 'just', 'rust', 'nest', 'vest', 'pest', 'hold', 'fold', 'bold', 'cold', 'gold', 'sold', 'told', 'hole', 'food', 'mood', 'wood', 'hoof', 'roof', 'boot', 'foot', 'root', 'hoot', 'loot', 'soot', 'toot', 'road', 'load', 'last', 'lost', 'mast', 'vast', 'fast', 'past', 'east', 'west', 'was', 'wax', 'way', 'warm', 'warn', 'ward', 'come', 'cone', 'code', 'cope', 'core', 'cove', 'cake', 'love', 'live', 'move', 'loud', 'the', 'tea', 'top', 'toy', 'tub', 'two', 'try', 'are', 'arm', 'art', 'ace', 'ale', 'ape', 'axe', 'ago', 'aim', 'air', 'his', 'has', 'hit', 'hid', 'him', 'hum', 'hut', 'hug', 'had', 'hat', 'ham', 'hay', 'hen', 'hey', 'hop', 'hot', 'how', 'you', 'yes', 'yet', 'yak', 'yam', 'one', 'ode', 'ore', 'owe', 'own', 'owl', 'once', 'only', 'open', 'oven', 'over', 'ask', 'ash', 'aunt', 'ant', 'and', 'any', 'put', 'pit', 'pat', 'pet', 'pot', 'pun', 'pup', 'pub', 'pug', 'push', 'posh', 'pull', 'pill', 'poll', 'pall', 'pale', 'pole', 'pile', 'full', 'fall', 'fell', 'fill', 'fuel', 'furl', 'fool', 'foal', 'foul', 'fowl', 'house', 'mouse', 'louse', 'horse', 'home', 'hose', 'hope', 'hour', 'sour', 'four', 'pour', 'tour', 'your', 'door', 'poor', 'moor', 'doors', 'floor', 'flour', 'fire', 'five', 'ford', 'fork', 'form', 'kilt', 'mild', 'mile', 'milk', 'mill', 'miss', 'wild', 'wile', 'will', 'wine', 'wing', 'wink', 'wipe', 'wire', 'wise', 'wish', 'with', 'child', 'chill', 'chips', 'chime', 'climb', 'class', 'clash', 'most', 'moss', 'moth', 'mode', 'mole', 'more', 'oily', 'holy', 'both', 'bath', 'bosh', 'bots', 'boss', 'old', 'odd', 'colt', 'cord', 'corn', 'cost', 'cosy', 'golf', 'goat', 'goal', 'gods', 'hoop', 'tolls', 'toll', 'tool', 'tone', 'every', 'event', 'ever', 'even', 'eve', 'great', 'greet', 'grate', 'grade', 'grape', 'break', 'bread', 'breed', 'beak', 'brake', 'steak', 'stack', 'stalk', 'steal', 'steam', 'steep', 'steer', 'stem', 'step', 'pretty', 'petty', 'party', 'beautiful', 'after', 'alter', 'fact', 'post', 'part', 'path', 'pats', 'bats', 'bash', 'bass', 'baths', 'hours', 'sore', 'soar', 'prove', 'improve', 'sure', 'sugar', 'eye', 'dye', 'bye', 'could', 'would', 'should', 'cloud', 'who', 'why', 'whom', 'whole', 'whale', 'while', 'white', 'many', 'mean', 'main', 'busy', 'bush', 'people', 'water', 'again', 'half', 'calf', 'hall', 'hate', 'have', 'money', 'monkey', 'honey', 'parents', 'parent', 'present', 'pardon', 'tin', 'toe', 'tip', 'tug', 'hog', 'lot', 'tow', 'ton', 'tot', 'hub', 'arc', 'lord', 'hind', 'lots', 'asp', 'cast', 'file', 'fort', 'mice', 'hone',
  // From a sweep of every residual candidate on the review head: the real words left (sand, world, speak, plait …).
  'skid', 'slid', 'sand', 'sags', 'ore', 'ale', 'awe', 'ware', 'herb', 'hers', 'gush', 'lush', 'mush', 'puss', 'lull', 'pulp', 'oar', 'doom', 'poop', 'fund', 'fond', 'mend', 'mink', 'weld', 'moat', 'cola', 'creak', 'sneak', 'speak', 'fact', 'lash', 'pant', 'claws', 'grams', 'grabs', 'grasp', 'pads', 'pals', 'pans', 'paws', 'pats', 'plait', 'plane', 'plank', 'plans', 'surf', 'ewe', 'world', 'wound', 'whose', 'mane', 'halo',
  // Second review of PR #303: the systematic hole was the list words' own plurals and `-er`/`-ed` forms
  // (`cla_s` offered `p` for claps, `fin_` offered `s` for fins), so this batch is the full sweep of all 489
  // drawable gaps rather than another guess at which families were missed.
  'claps', 'clams', 'clans', 'clasp', 'clays', 'clothed', 'fins', 'fink', 'grans', 'gross', 'groat', 'fatter', 'bather', 'hays', 'mays', 'saws', 'sans', 'sass', 'poos', 'pooh', 'theme', 'thee', 'eves', 'aye', 'tee', 'lest', 'mosh',
  'wafer', 'wager', 'wader', 'waver', 'wad', 'wan', 'wilt', 'wily', 'woo', 'wove', 'cater', 'eater', 'hater', 'patents', 'probe', 'prone', 'prose', 'freak', 'bream', 'bust', 'buss', 'buoy', 'bate', 'pate', 'rind', 'lobe', 'lone', 'lope', 'mini', 'mins', 'kink', 'kine', 'kins',
  'moot', 'mope', 'mote', 'rouse', 'douse', 'souse', 'holt', 'aster', 'clime', 'dour', 'bur', 'boor', 'cole', 'cote', 'coney', 'evert'];
/**
 * The words a spelling gap is checked against: both exception-word lists, the days, the CVC bank and the
 * everyday words above (#296). Exported for the rail that walks every word and index in both lists.
 */
export const GAP_WORDS: ReadonlySet<string> = new Set([...Y1_CEW, ...Y2_CEW, ...DAYS, ...CVC.map(([w]) => w), ...EVERYDAY].map(w => w.toLowerCase()));
/**
 * Decoys for a gap in `word` at `idx`: every letter that does *not* make another `GAP_WORDS` word (#296). The
 * common exception words sit in rhyme families — `_old` is cold, gold, hold and told, all four on the Year 2
 * list — so drawn from the whole alphabet a decoy is another right answer in 82 of the 144 Year 1 gaps and 119
 * of the 295 Year 2 gaps (counted against the set this file ships), and `gapQ` sets no `listen`, so without a
 * voice nothing on the card said which word was meant. Filtered, the card is unambiguous against the checked
 * set whatever the voice does — and the set is the limit: a real word none of the lists above carry can still
 * be spelt by a decoy, which is why the everyday list was swept against every one of the 489 drawable gaps
 * (second review of PR #303) and why the rail pins concrete gaps. What that sweep deliberately left reachable:
 * the US spellings `math`, `mold`, `molt` and `grays`, and words no KS1 child reads as an answer — `oath`,
 * `sire`, `whey`, `rut`, `cur`, `hag`, `hale`, `chile`.
 *
 * `AVOID` is the other filter: spellings no card may show a child, whatever the lists know.
 */
const AVOID: ReadonlySet<string> = new Set(['whore', 'piss', 'fart', 'ass', 'arse', 'shit', 'crap', 'cock', 'dick',
  // Second review of PR #303: `poo_` offered `f`. A slur, a crudity or an insult is filtered here rather than
  // added to the lists above, so that `GAP_WORDS` stays a list of words the game is happy to *show*.
  'poof', 'gays', 'lust', 'pus', 'tush', 'coke', 'yob']);
export function gapLetters(word: string, idx: number): string[] {
  const lower = word.toLowerCase();
  return LETTERS.filter(l => { const w = lower.slice(0, idx) + l + lower.slice(idx + 1); return l !== lower[idx] && !GAP_WORDS.has(w) && !AVOID.has(w); });
}

/** Spelling by slicing letters in order (sequence question). */
// `from` is the letter pool the decoys are drawn from (#14). It defaults to the whole alphabet, which is
// right for Year 1/2 spelling; Reception passes its phase pool, because a decoy the child has not been
// taught is the same fault as an answer they have not been taught.
function spellQ(rng: Rng, word: string, hintEmoji?: string, decoys = 3, from: string[] = LETTERS): ReturnType<Generator> {
  const letters = word.split('');
  const pool = from.filter(l => !letters.includes(l));
  const uniq = [...new Set(letters)];
  const ds = shuffle(rng, pool).slice(0, Math.max(1, Math.min(decoys, 10 - uniq.length)));
  return { prompt: hintEmoji ? `${hintEmoji}  Spell it!` : `Spell: ${word}`, say: `Spell the word ${word}`, answer: word, sequence: letters, options: shuffle(rng, [...uniq, ...ds]), visual: { type: 'word', text: word.replace(/./g, '_ ').trim(), emoji: hintEmoji }, hint: 'Slice the letters in order', listen: word };
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
    visual: show ? { type: 'sentence', text: sentence } : { type: 'word', text: emoji }, hint: show ? 'Slice the words in order' : 'Listen, then slice the words in order',
    listen: show ? undefined : sentence, peek: !show };
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
// Year 2 subordinates with `when`, `if`, `that` and `because`, and co-ordinates with `or`, `and`, `but`. No
// other subordinating conjunction belongs in this bank: d3 used to carry "Although it was cold, we went out",
// and *although* is Year 3 and beyond (#298 slice 5). Its replacement is the `that` sentence — the one Year 2
// subordinator the bank was missing. `tests/unit/curriculum.test.ts` fails if another one gets in.
const Y2_SENTS: Sent[][] = [
  [['The shiny red kite flew high.', '🪁'], ['Please shut the door quietly.', '🚪'], ['A tiny mouse hid under the chair.', '🐭'], ['The brave knight rode away.', '🏇'], ['Our class went to the museum.', '🏛️'], ['Do you like pizza or pasta?', '🍕'], ['The fluffy kitten chased a leaf.', '🐱'], ['Grandad grows tall yellow sunflowers.', '🌻'], ['What a wonderful surprise this is!', '🎁'], ['Wash your hands before lunch.', '🧼']],
  [['Sam was late because he overslept.', '⏰'], ['The old man walked slowly home.', '👴'], ['We stayed inside because it rained.', '🌧️'], ['She smiled when she saw the puppy.', '🐶'], ['The rocket zoomed into dark space.', '🚀'], ['Would you like some sweet honey?', '🍯'], ['He was tired but he kept running.', '🏃'], ['The children built a huge sandcastle.', '🏖️'], ['My sister plays the violin beautifully.', '🎻'], ['Bring an umbrella if it rains.', '☂️']],
  [['If it rains, we will stay inside.', '☂️'], ['You can play when you have finished.', '🎮'], ['The bird sang because it was happy.', '🐦'], ['We can walk or take the bus.', '🚌'], ['The dragon roared and the village shook.', '🐉'], ['I know that the snow is cold.', '🧣'], ['Please tidy your room before dinner.', '🧹'], ['The clever fox found a secret path.', '🦊'], ['Everybody cheered when our team scored.', '⚽'], ['After lunch we painted colourful pictures.', '🎨']],
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
// The word and the decoys both come from the difficulty's phase pool (#14). The middle-sound question keeps
// VOWELS as its decoys, which needs no filtering: all five vowels are phase 2 set 1–4 letters already.
const rLetterSound: Generator = (d, rng) => {
  // #135: filtering by role, not deleting from CVC — `egg` keeps its (correct) place at d1, it is only kept
  // out of the d3 draw whose gap it would answer wrong.
  if (d === 1) { const [w, e] = pick(rng, rWords(d)); return gapQ(rng, w, 0, rLetters(d), e, `${w}. Which sound does ${w} start with?`); }
  if (d === 2) { const [w, e] = pick(rng, rWords(d).filter(([w]) => finalIsGenuine(w))); return gapQ(rng, w, 2, rLetters(d), e, `${w}. Which sound does ${w} end with?`); }
  const [w, e] = pick(rng, rWords(d).filter(([w]) => medialIsGenuine(w)));
  return gapQ(rng, w, 1, VOWELS, e, `${w}. Which sound is in the middle of ${w}?`);
};
const rCapitals: Generator = (d, rng) => {
  const l = pick(rng, rLetters(d));
  const upper = rng() < 0.5;
  const shown = upper ? l.toUpperCase() : l;
  const ans = upper ? l : l.toUpperCase();
  const ds = shuffle(rng, rLetters(d).filter(x => x !== l)).slice(0, d === 1 ? 2 : 3).map(x => (upper ? x : x.toUpperCase()));
  return wordQ(rng, shown, ans, ds, { visual: { type: 'word', text: shown }, say: `Find the ${upper ? 'small' : 'capital'} letter that matches ${l}`, hint: upper ? 'Find the lower-case letter' : 'Find the capital letter' });
};
const rBuild: Generator = (d, rng) => {
  const [w, e] = pick(rng, rWords(d));
  return spellQ(rng, w, e, d === 1 ? 2 : d === 2 ? 3 : 4, rLetters(d));
};
// Tracing is letter *formation*, so difficulty 3 keeps the whole alphabet — a child learns to write `q` and
// the handwriting ELG covers all 26, whatever phase the sound belongs to. Stages 1 and 2 still follow the
// phase order, so the letters a child traces first are the ones they are being taught to read first.
const rTrace: Generator = (d, rng) => {
  const l = pick(rng, d === 3 ? LETTERS : rLetters(d));
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
  return gapQ(rng, w, idx, gapLetters(w, idx), undefined, `Which letter is missing from the word ${w}?`);
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
  if (d === 3) return spellQ(rng, day, '📅', 3);   // days keep their capital letter (Y1 grammar)
  const idx = ri(rng, 1, Math.min(4, day.length - 1));
  return gapQ(rng, day, idx, gapLetters(day, idx), '📅', `Which letter is missing from ${day}?`);
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
  return gapQ(rng, w, idx, gapLetters(w, idx), undefined, `Which letter is missing from the word ${w}?`);
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
/**
 * Endings that change the root (#299 slice 3, NC English Appendix 1 Year 2): `[root, ending, the new word,
 * rule, the two spellings a child actually writes instead]`. `y1-suffix` and `y2-suffix` are the no-change
 * case — `jump` + `ing`, `care` + `ful` — so **every entry here must change the root**, which is the one
 * thing this topic teaches and a rail holds it to.
 *
 * The two wrong spellings are the rule left unapplied (`hopeing`) and a rule applied that does not belong to
 * this word (`hopping` for `hope`, `happyier` for `happy`) — never a different ending: the card asks which
 * spelling is right, not which ending fits, and `y1-suffix` already asks the other question. Two is the whole
 * set of mistakes the rule admits, so these cards run on three bubbles rather than four.
 */
type SuffixRule = 'drop-e' | 'double' | 'y-to-i';
export const SUFFIX_ROOT: ReadonlyArray<readonly [string, string, string, SuffixRule, string, string]> = [
  // drop the e: hope → hoping
  ['hope', 'ing', 'hoping', 'drop-e', 'hopeing', 'hopping'], ['make', 'ing', 'making', 'drop-e', 'makeing', 'makking'],
  ['ride', 'ing', 'riding', 'drop-e', 'rideing', 'ridding'], ['smile', 'ed', 'smiled', 'drop-e', 'smileed', 'smilled'],
  ['bake', 'ed', 'baked', 'drop-e', 'bakeed', 'bakked'], ['close', 'ing', 'closing', 'drop-e', 'closeing', 'clossing'],
  ['wave', 'ed', 'waved', 'drop-e', 'waveed', 'wavved'], ['nice', 'er', 'nicer', 'drop-e', 'niceer', 'nicier'],
  ['late', 'er', 'later', 'drop-e', 'lateer', 'latter'],
  // double the last letter: hop → hopping
  ['hop', 'ing', 'hopping', 'double', 'hoping', 'hopeing'], ['run', 'ing', 'running', 'double', 'runing', 'runeing'],
  ['sit', 'ing', 'sitting', 'double', 'siting', 'siteing'], ['swim', 'ing', 'swimming', 'double', 'swiming', 'swimeing'],
  ['pat', 'ed', 'patted', 'double', 'pated', 'pateed'], ['stop', 'ed', 'stopped', 'double', 'stoped', 'stopeed'],
  ['big', 'er', 'bigger', 'double', 'biger', 'bigier'], ['sad', 'est', 'saddest', 'double', 'sadest', 'sadiest'],
  ['hot', 'est', 'hottest', 'double', 'hotest', 'hotiest'],
  // y becomes i: happy → happier
  ['happy', 'er', 'happier', 'y-to-i', 'happyer', 'happyier'], ['baby', 'es', 'babies', 'y-to-i', 'babyes', 'babys'],
  ['carry', 'ed', 'carried', 'y-to-i', 'carryed', 'carryied'], ['funny', 'est', 'funniest', 'y-to-i', 'funnyest', 'funnyiest'],
  ['cry', 'es', 'cries', 'y-to-i', 'cryes', 'crys'], ['try', 'ed', 'tried', 'y-to-i', 'tryed', 'tryied'],
  ['easy', 'er', 'easier', 'y-to-i', 'easyer', 'easyier'], ['silly', 'est', 'silliest', 'y-to-i', 'sillyest', 'sillyiest'],
  ['party', 'es', 'parties', 'y-to-i', 'partyes', 'partys'],
];
/** d1 is the rule you can see (an `e` disappears); d2 adds doubling; d3 adds `y → i`, which changes a letter inside the word. */
const SUFFIX_RULES: Record<number, SuffixRule[]> = { 1: ['drop-e'], 2: ['drop-e', 'double'], 3: ['drop-e', 'double', 'y-to-i'] };
const y2SuffixRoot: Generator = (d, rng) => {
  const rules = SUFFIX_RULES[d] ?? SUFFIX_RULES[3];
  const [root, suf, ans, , naive, misrule] = pick(rng, SUFFIX_ROOT.filter(e => rules.includes(e[3])));
  return wordQ(rng, `${root} + ${suf} = ?`, ans, [naive, misrule], {
    visual: { type: 'word', text: `${root} + ${suf}` },
    say: `Add ${suf} to ${root}. Which spelling is right?`, hint: 'The root word changes',
  });
};

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
const y2WordClass: Generator = (d, rng) => {
  const row = pick(rng, WORD_CLASSES);
  // Nouns and verbs first: Year 1 already names them (Appendix 2), while adjective and adverb are Year 2's own
  // vocabulary — and "which word is the adverb?" on a card whose adverb is the last word is the stretch.
  const k = ri(rng, 0, d === 1 ? 1 : d === 2 ? 2 : 3);
  const cls = WORD_CLASS_NAMES[k], answer = row[k + 1];
  return wordQ(rng, `Which word is the ${cls}?`, answer, row.slice(1).filter(w => w !== answer), {
    visual: { type: 'sentence', text: row[0] }, say: `${row[0]} Which word is the ${cls}?`, hint: `Slice the ${cls}`,
  });
};

/**
 * Sentence types (#299 slice 3, NC English Appendix 2 Year 2): `[sentence, type]`.
 *
 * The four forms are taught as a set, so the card shows one sentence and asks which it is. What keeps exactly
 * one answer defensible is the English KS1 convention the bank is built to: a **question** ends with `?`; an
 * **exclamation** is the `What …!` / `How …!` form and nothing else (`Look out!` is a command, however loudly
 * it is said); a **statement** and a **command** both end with a full stop, so those two can only be told
 * apart by reading — which is the point of the topic.
 *
 * That last pair is why no command here ends with `!`: it would be correct English and would still make the
 * card a punctuation-spotting exercise with two defensible answers.
 */
export const SENTENCE_TYPE_NAMES = ['statement', 'question', 'command', 'exclamation'] as const;
export type SentenceType = typeof SENTENCE_TYPE_NAMES[number];
export const SENTENCE_TYPES: ReadonlyArray<readonly [string, SentenceType]> = [
  ['The cat sat on the mat.', 'statement'],
  ['Ninjas train every day.', 'statement'],
  ['My bike is bright red.', 'statement'],
  ['We went to the park.', 'statement'],
  ['The sun is shining today.', 'statement'],
  ['Our school has a new roof.', 'statement'],
  ['Where is my hat?', 'question'],
  ['Can you swim?', 'question'],
  ['What is your name?', 'question'],
  ['Who took the last biscuit?', 'question'],
  ['Are we there yet?', 'question'],
  ['How old is your dog?', 'question'],
  ['Close the door.', 'command'],
  ['Wash your hands.', 'command'],
  ['Put on your coat.', 'command'],
  ['Line up quietly.', 'command'],
  ['Pass me the ball.', 'command'],
  ['Tidy your bedroom.', 'command'],
  ['What a lovely day it is!', 'exclamation'],
  ['How tall that tree is!', 'exclamation'],
  ['What a mess we made!', 'exclamation'],
  ['How quickly she ran!', 'exclamation'],
  ['What big ears you have!', 'exclamation'],
  ['How brave you are!', 'exclamation'],
];
/**
 * d1 is the pair a Year 1 child already meets (a sentence that tells you something, a sentence that asks);
 * d2 adds the command, which shares its full stop with the statement; d3 adds the exclamation.
 *
 * The bubbles are the types unlocked so far, not all four, so d1 is a two-way choice rather than a guess
 * between words the child has not been taught yet.
 */
const y2SentenceType: Generator = (d, rng) => {
  const allowed = SENTENCE_TYPE_NAMES.slice(0, d === 1 ? 2 : d === 2 ? 3 : 4);
  const [sent, type] = pick(rng, SENTENCE_TYPES.filter(e => allowed.includes(e[1])));
  return wordQ(rng, 'What kind of sentence is this?', type, allowed.filter(n => n !== type), {
    visual: { type: 'sentence', text: sent }, say: `${sent} What kind of sentence is this?`,
    hint: 'Does it tell, ask, order or exclaim?',
  });
};

/**
 * Present and past (#299 slice 3, NC English Appendix 2 Year 2): `TENSE_VERBS` is `[base, he/she present,
 * past, -ing]` and `TENSE_FRAMES` is `[frame with one gap, the column that fills it, the tense of the
 * finished sentence]`. Every frame takes every verb, so the two tables multiply out instead of being written
 * card by card.
 *
 * A frame carries its own tense — a time phrase (`Yesterday`) or the auxiliary (`is`/`was`) — which is what
 * makes exactly one of the four forms fit the gap at d3: `Yesterday he walking` and `Yesterday he walks` are
 * both wrong, and a child who writes either is making the mistake this topic is for. The past-progressive
 * frames carry no time phrase at all, so `was` against `is` is the only thing that answers them.
 */
export const TENSE_VERBS: ReadonlyArray<readonly [string, string, string, string]> = [
  ['walk', 'walks', 'walked', 'walking'], ['jump', 'jumps', 'jumped', 'jumping'],
  ['shout', 'shouts', 'shouted', 'shouting'], ['smile', 'smiles', 'smiled', 'smiling'],
  ['clap', 'claps', 'clapped', 'clapping'], ['skip', 'skips', 'skipped', 'skipping'],
  ['dance', 'dances', 'danced', 'dancing'], ['laugh', 'laughs', 'laughed', 'laughing'],
  ['drum', 'drums', 'drummed', 'drumming'], ['hide', 'hides', 'hid', 'hiding'],
  // Irregular pasts: the form a child cannot build with a rule, and the reason a bank beats a suffix.
  ['run', 'runs', 'ran', 'running'], ['sing', 'sings', 'sang', 'singing'],
  ['swim', 'swims', 'swam', 'swimming'], ['sit', 'sits', 'sat', 'sitting'],
  ['sleep', 'sleeps', 'slept', 'sleeping'], ['fly', 'flies', 'flew', 'flying'],
];
/** 1 = he/she present, 2 = past, 3 = the `-ing` form the progressive frames need. */
type TenseCol = 1 | 2 | 3;
export const TENSE_FRAMES: ReadonlyArray<readonly [string, TenseCol, 'present' | 'past']> = [
  ['Every day she ___ in the garden.', 1, 'present'],
  ['Every morning he ___ in the park.', 1, 'present'],
  ['Yesterday he ___ in the garden.', 2, 'past'],
  ['Last week she ___ in the park.', 2, 'past'],
  ['She is ___ in the garden now.', 3, 'present'],
  ['They are ___ in the park.', 3, 'present'],
  ['He was ___ in the garden.', 3, 'past'],
  ['We were ___ in the park.', 3, 'past'],
];
/**
 * d1 and d2 name the tense of a finished sentence — d1 on the simple forms, d2 with the progressive, where
 * the auxiliary rather than the verb ending carries the tense. d3 turns the same sentence round and asks the
 * child to produce the form the gap needs, with all four forms of that one verb on the bubbles.
 */
const y2Tense: Generator = (d, rng) => {
  const [frame, col, tense] = pick(rng, d === 1 ? TENSE_FRAMES.filter(f => f[1] !== 3) : TENSE_FRAMES);
  const v = pick(rng, TENSE_VERBS);
  if (d === 3) return wordQ(rng, frame, v[col], v.filter(w => w !== v[col]), {
    visual: { type: 'sentence', text: frame }, say: frame.replace('___', 'blank'),
    hint: 'Which form of the word fits?',
  });
  const sent = frame.replace('___', v[col]);
  return wordQ(rng, 'Present or past?', tense, [tense === 'past' ? 'present' : 'past'], {
    visual: { type: 'sentence', text: sent }, say: `${sent} Is this sentence in the present or the past?`,
    hint: 'Is it happening now, or has it happened already?',
  });
};

/**
 * Sound-alike words: [sentence with a gap, the options (answer first), answer]. Every option set is one of
 * `HOMOPHONE_SETS` — the Year 2 statutory pairs (NC English Appendix 1) plus `piece/peace` from Year 3–4 — and
 * a rail holds it there: `on/won`, `brown/brawn` and `wind/wined` were not homophones at all (#296).
 * Exported for that rail.
 */
export const HOMOPHONE_SETS: ReadonlyArray<readonly string[]> = [['to', 'too', 'two'], ['their', 'there', "they're"], ['see', 'sea'], ['sun', 'son'], ['one', 'won'], ['here', 'hear'], ['piece', 'peace'], ['bare', 'bear'], ['blue', 'blew'], ['night', 'knight'], ['be', 'bee'], ['quite', 'quiet']];
export const HOMOPHONES: ReadonlyArray<readonly [string, readonly string[], string]> = [['I want ___ go home.', ['to', 'too', 'two'], 'to'], ['I have ___ cats.', ['two', 'to', 'too'], 'two'], ['Me ___!', ['too', 'to', 'two'], 'too'], ['___ house is big.', ['Their', 'There', "They're"], 'Their'], ['Look over ___!', ['there', 'their', "they're"], 'there'], ['___ going out.', ["They're", 'Their', 'There'], "They're"], ['I can ___ the sea.', ['see', 'sea'], 'see'], ['The ___ shines.', ['sun', 'son'], 'sun'], ['It is ___ o\'clock.', ['one', 'won'], 'one'], ['We ___ the race!', ['won', 'one'], 'won'], ['The ___ ate the honey.', ['bear', 'bare'], 'bear'], ['The wind ___ my hat off.', ['blew', 'blue'], 'blew'], ['___ is a bird.', ['Here', 'Hear'], 'Here'], ['I can ___ you.', ['hear', 'here'], 'hear'], ['A ___ of bread.', ['piece', 'peace'], 'piece'], ['The ___ rode a horse.', ['knight', 'night'], 'knight'], ['A ___ makes honey.', ['bee', 'be'], 'bee'], ['Please be ___ in the library.', ['quiet', 'quite'], 'quiet']];
const y2Homophones: Generator = (_d, rng) => {
  const [sent, opts, ans] = pick(rng, HOMOPHONES);
  return wordQ(rng, sent, ans, opts.filter(o => o !== ans), { visual: { type: 'sentence', text: sent }, say: sent.replace('___', 'blank'), hint: 'Slice the right word' });
};
const y2Punct: Generator = (d, rng) => {
  const k = d === 1 ? 0 : ri(rng, 0, 2);
  if (k === 0) { const [s, p] = pick(rng, PUNCT_SENTS); return wordQ(rng, `${s}_`, p, ['.', '?', '!'], { visual: { type: 'sentence', text: `${s}_` }, say: `${s}. Which punctuation mark ends this sentence?` }); }
  if (k === 1) {
    // #296: the gap never sits before "and" — English schools teach the list comma without one there.
    const L: [string, string][] = [['I like apples_ pears and plums.', ','], ['We saw lions, tigers_ bears and monkeys.', ','], ['Red, blue_ green and yellow.', ','], ['Bring a hat, coat_ scarf and gloves.', ',']];
    const [s, p] = pick(rng, L);
    return wordQ(rng, s, p, ['.', '?', ';'], { visual: { type: 'sentence', text: s }, say: 'Which mark separates the items in the list?', hint: 'Commas in a list' });
  }
  const A: [string, string][] = [["The dog_s bone.", "'"], ["Sam_s hat is red.", "'"], ["My mum_s car.", "'"], ["The cat_s tail.", "'"]];
  const [s, p] = pick(rng, A);
  return wordQ(rng, s, p, [',', '.', '-'], { visual: { type: 'sentence', text: s }, say: 'Which mark shows something belongs to someone?', hint: 'Possessive apostrophe' });
};
const y2Trace: Generator = (d, rng) => {
  const w = pick(rng, d === 1 ? Y1_CEW.filter(x => x.length >= 2 && x.length <= 4) : Y2_CEW.filter(x => x.length <= (d === 2 ? 5 : 7)));
  return { prompt: `Trace: ${w}`, say: `Trace the word ${w}`, answer: w, options: [w], visual: { type: 'word', text: w } };
};

export const WRITING_TOPICS: Topic[] = [
  { id: 'r-sounds', title: 'Letter Sounds', icon: '🔊', subject: 'writing', year: 'reception', nc: 'ELG Writing: sounds to letters', gen: rLetterSound },
  { id: 'r-soundhunt', title: 'Sound Hunt', icon: '👂', subject: 'writing', year: 'reception', nc: 'ELG Word Reading: say a sound for each letter; phase 2–3 sounds by ear', gen: rSoundHunt },
  { id: 'r-capitals', title: 'Big & Small Letters', icon: '🅰️', subject: 'writing', year: 'reception', nc: 'ELG Word Reading: letters', gen: rCapitals },
  { id: 'r-build', title: 'Build a Word', icon: '🧱', subject: 'writing', year: 'reception', nc: 'ELG Writing: spell by sounds (CVC)', gen: rBuild },
  { id: 'r-sentence', title: 'Story Sentences', icon: '📖', subject: 'writing', year: 'reception', nc: 'ELG Writing: simple sentences', gen: rSentence },
  { id: 'r-trace', title: 'Trace Letters', icon: '✍️', subject: 'writing', year: 'reception', nc: 'ELG Writing: form letters', input: 'tracing', gen: rTrace },
  { id: 'y1-digraphs', title: 'Sound Pairs', icon: '🔤', subject: 'writing', year: 'year1', nc: 'Y1 Spelling: digraphs', gen: y1Digraphs },
  { id: 'y1-soundhunt', title: 'Sound Hunt', icon: '👂', subject: 'writing', year: 'year1', nc: 'Y1 Word Reading: respond speedily to graphemes; phase 3 & 5 alternatives, split digraphs', gen: y1SoundHunt },
  { id: 'y1-spelling', title: 'Tricky Words', icon: '🧠', subject: 'writing', year: 'year1', nc: 'Y1 common exception words', gen: y1Spelling },
  { id: 'y1-plurals', title: 'Plurals -s -es', icon: '🐈', subject: 'writing', year: 'year1', nc: 'Y1 Spelling: plurals', gen: y1Plurals },
  { id: 'y1-suffix', title: 'Endings -ing -ed -er', icon: '🏃', subject: 'writing', year: 'year1', nc: 'Y1 Spelling: suffixes', gen: y1Suffix },
  { id: 'y1-punct', title: 'Fix the Sentence', icon: '❗', subject: 'writing', year: 'year1', nc: 'Y1 Grammar: capitals, . ? !', gen: y1Punct },
  { id: 'y1-days', title: 'Days of the Week', icon: '📅', subject: 'writing', year: 'year1', nc: 'Y1 Spelling: days', gen: y1Days },
  { id: 'y1-sentence', title: 'Story Sentences', icon: '📖', subject: 'writing', year: 'year1', nc: 'Y1 Writing: sequence words into sentences, and', gen: y1Sentence },
  { id: 'y1-trace', title: 'Trace Letters', icon: '✍️', subject: 'writing', year: 'year1', nc: 'Y1 Handwriting', input: 'tracing', gen: y1Trace },
  { id: 'y2-spelling', title: 'Tricky Words', icon: '🧠', subject: 'writing', year: 'year2', nc: 'Y2 common exception words', gen: y2Spelling },
  { id: 'y2-contractions', title: "Contractions don't", icon: '✂️', subject: 'writing', year: 'year2', nc: 'Y2 Spelling: contractions', gen: y2Contractions },
  { id: 'y2-suffix', title: 'Endings -ful -ly', icon: '🎀', subject: 'writing', year: 'year2', nc: 'Y2 Spelling: suffixes', gen: y2Suffix },
  { id: 'y2-suffix-root', title: 'Changing Endings', icon: '🔁', subject: 'writing', year: 'year2', nc: 'Y2 Spelling: suffixes that change the root (drop e, double, y→i)', gen: y2SuffixRoot },
  { id: 'y2-homophones', title: 'Sound-alike Words', icon: '👂', subject: 'writing', year: 'year2', nc: 'Y2 Spelling: homophones', gen: y2Homophones },
  { id: 'y2-wordclass', title: 'Word Detective', icon: '🔍', subject: 'writing', year: 'year2', nc: 'Y2 Grammar: nouns, verbs, adjectives, adverbs', gen: y2WordClass },
  { id: 'y2-sentencetype', title: 'Sentence Types', icon: '💬', subject: 'writing', year: 'year2', nc: 'Y2 Grammar: statements, questions, commands and exclamations', gen: y2SentenceType },
  { id: 'y2-tense', title: 'Then & Now', icon: '⏳', subject: 'writing', year: 'year2', nc: 'Y2 Grammar: present and past tense, including the progressive', gen: y2Tense },
  { id: 'y2-punct', title: 'Fix the Sentence', icon: '❗', subject: 'writing', year: 'year2', nc: 'Y2 Grammar: commas, apostrophes', gen: y2Punct },
  { id: 'y2-sentence', title: 'Story Sentences', icon: '📖', subject: 'writing', year: 'year2', nc: 'Y2 Writing: word order, conjunctions, noun phrases', gen: y2Sentence },
  { id: 'y2-trace', title: 'Trace Words', icon: '✍️', subject: 'writing', year: 'year2', nc: 'Y2 Handwriting', input: 'tracing', gen: y2Trace },
];
