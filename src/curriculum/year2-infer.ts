// y2-infer (#1015): Year 2 reading — infer from what is said and done (NC English Y2 reading comprehension,
// statutory: "making inferences on the basis of what is being said and done"). One sentence, one question,
// one defensible answer. The answer is never named in the sentence; a clue word points to it.
// The oracle (tested over the whole bank): the sentence holds a clue word of its answer, holds no clue word of
// any other answer in its category, and no clue word belongs to two answers of one category. What a clue test
// cannot see is an answer that fits by common sense with no clue word — `notDecoys` is where the author
// records it, so that answer is never offered as a bubble (#666).
import type { Difficulty, Generator } from './types';
import { pick, shuffle, wordQ } from './util';

export type InferCategory = 'feeling' | 'weather' | 'place' | 'before';

/** Each category is a closed list of answers; each answer lists the clue words that point to it. */
export const CATEGORIES: Record<InferCategory, Record<string, string[]>> = {
  feeling: {
    happy: ['smiling', 'clapping', 'laughed', 'danced', 'grin', 'giggled'],
    sad: ['crying', 'tears', 'sobbed', 'sniffled'],
    cross: ['stamped', 'shouted', 'slammed', 'scowled', 'grumbled'],
    scared: ['trembling', 'hid', 'screamed', 'shivering'],
    tired: ['yawned', 'yawning', 'sleepy', 'drooping'],
  },
  weather: {
    sunny: ['sunscreen', 'sunglasses', 'melted', 'sunbathed'],
    rainy: ['umbrella', 'wellies', 'puddles', 'raincoat'],
    snowy: ['snowman', 'sledge', 'snowballs', 'snowflakes'],
    windy: ['kite', 'flapped', 'swayed', 'gusts'],
    foggy: ['mist', 'headlights', 'foghorn', 'hardly'],
  },
  place: {
    'at the beach': ['sandcastle', 'waves', 'sand', 'seagulls'],
    'at school': ['teacher', 'whiteboard', 'classroom', 'register'],
    'at the shops': ['trolley', 'shelves', 'checkout', 'till'],
    'in the park': ['bench', 'squirrels', 'flowerbeds', 'bandstand'],
    'at the farm': ['tractor', 'barn', 'pigs', 'lambs'],
  },
  before: {
    'fell over': ['plaster', 'grazed', 'bruise', 'scraped'],
    'won a race': ['medal', 'trophy', 'winner', 'podium'],
    'lost a tooth': ['gap', 'fairy', 'wobbly', 'tooth'],
    'broke a cup': ['pieces', 'dustpan', 'broom', 'china'],
    'got wet': ['towel', 'dripping', 'soaked', 'drenched'],
  },
};

export type InferItem = [sentence: string, question: string, category: InferCategory, answer: string, notDecoys?: string[]];

export const INFER_BANK: InferItem[] = [
  // feeling
  ['Mia was crying and hugging her teddy.', 'How did Mia feel?', 'feeling', 'sad'],
  ['Ben was smiling and clapping his hands.', 'How did Ben feel?', 'feeling', 'happy'],
  ['Zara stamped her foot and shouted loudly.', 'How did Zara feel?', 'feeling', 'cross'],
  ['Leo hid under the bed, trembling.', 'How did Leo feel?', 'feeling', 'scared'],
  ['Ava yawned and rubbed her eyes.', 'How did Ava feel?', 'feeling', 'tired'],
  ['Tom had tears running down his face.', 'How did Tom feel?', 'feeling', 'sad'],
  ['Ruby laughed and danced round the room.', 'How did Ruby feel?', 'feeling', 'happy'],
  ['Sam slammed the door and scowled.', 'How did Sam feel?', 'feeling', 'cross'],
  ['Ali screamed and ran from the spider.', 'How did Ali feel?', 'feeling', 'scared'],
  ['Nia was yawning and her eyes kept closing.', 'How did Nia feel?', 'feeling', 'tired'],
  // weather
  ['Sam took his umbrella and his wellies.', 'What is the weather like?', 'weather', 'rainy', ['windy']],
  ['Mum put on sunscreen and sunglasses.', 'What is the weather like?', 'weather', 'sunny'],
  ['The children built a snowman.', 'What is the weather like?', 'weather', 'snowy'],
  ['Dad switched on the headlights in the thick mist.', 'What is the weather like?', 'weather', 'foggy'],
  ['Mia\'s kite flew high in the sky.', 'What is the weather like?', 'weather', 'windy', ['sunny']],
  ['Tom jumped in the puddles in his raincoat.', 'What is the weather like?', 'weather', 'rainy'],
  ['The sledge slid down the white hill.', 'What is the weather like?', 'weather', 'snowy'],
  ['Dad wore sunglasses and the ice cream melted.', 'What is the weather like?', 'weather', 'sunny'],
  ['The washing flapped on the line and the trees swayed.', 'What is the weather like?', 'weather', 'windy'],
  ['Gran could hardly see the road ahead.', 'What is the weather like?', 'weather', 'foggy'],
  // place
  ['Zoe built a sandcastle and heard the waves.', 'Where is Zoe?', 'place', 'at the beach'],
  ['Lily dug in the sand next to the sea.', 'Where is Lily?', 'place', 'at the beach'],
  ['The teacher wrote on the whiteboard.', 'Where are the children?', 'place', 'at school'],
  ['Max hung his coat up in the classroom.', 'Where is Max?', 'place', 'at school'],
  ['Dad pushed the trolley past the shelves.', 'Where is Dad?', 'place', 'at the shops'],
  ['Mum paid at the checkout.', 'Where is Mum?', 'place', 'at the shops'],
  ['Sam sat on a bench watching the squirrels.', 'Where is Sam?', 'place', 'in the park'],
  ['Amy ran past the flowerbeds and the bandstand.', 'Where is Amy?', 'place', 'in the park'],
  ['Farmer Joe drove his tractor into the barn.', 'Where is Joe?', 'place', 'at the farm'],
  ['Tom fed the pigs and the lambs.', 'Where is Tom?', 'place', 'at the farm'],
  // before
  ['Mum put a plaster on Tom\'s knee.', 'What happened just before?', 'before', 'fell over'],
  ['Ruby had a big bruise on her knee.', 'What happened just before?', 'before', 'fell over'],
  ['Ali wore a gold medal round his neck.', 'What happened just before?', 'before', 'won a race'],
  ['Cara held up a shiny trophy at sports day.', 'What happened just before?', 'before', 'won a race'],
  ['Mia smiled and showed the gap in her teeth.', 'What happened just before?', 'before', 'lost a tooth'],
  ['The tooth fairy left a coin for Sam.', 'What happened just before?', 'before', 'lost a tooth'],
  ['Dad swept the pieces into the dustpan.', 'What happened just before?', 'before', 'broke a cup'],
  ['Mum got the broom to sweep up the china.', 'What happened just before?', 'before', 'broke a cup'],
  ['Leo\'s hair was dripping and he needed a towel.', 'What happened just before?', 'before', 'got wet'],
  ['Mia\'s clothes were soaked through.', 'What happened just before?', 'before', 'got wet'],
];

const LADDER: Record<Difficulty, InferCategory[]> = { 1: ['feeling'], 2: ['feeling', 'weather', 'place'], 3: ['feeling', 'weather', 'place', 'before'] };

/** The words of a sentence, lower-cased, without punctuation. */
export const wordsOf = (s: string): string[] => s.toLowerCase().replace(/[^a-z' ]/g, ' ').split(/\s+/).filter(Boolean);

/** Answers of the item's category whose clue word appears in the sentence. */
export const cluedAnswers = (sentence: string, category: InferCategory): string[] => {
  const ws = new Set(wordsOf(sentence));
  return Object.keys(CATEGORIES[category]).filter(a => CATEGORIES[category][a].some(c => ws.has(c)));
};

/** The answers a card may offer as bubbles besides its own: not a `notDecoys` entry, not clued by the sentence. */
export const decoyPool = ([s, , cat, answer, not = []]: InferItem): string[] => {
  const clued = cluedAnswers(s, cat);
  return Object.keys(CATEGORIES[cat]).filter(a => a !== answer && !not.includes(a) && !clued.includes(a));
};

/** d1: how someone feels, 3 bubbles · d2: adds weather and place, 4 · d3: adds what happened just before, 4. */
export const y2Infer: Generator = (d: Difficulty, rng) => {
  const item = pick(rng, INFER_BANK.filter(i => LADDER[d].includes(i[2])));
  const [s, question, , answer] = item;
  return wordQ(rng, question, answer, shuffle(rng, decoyPool(item)).slice(0, d === 1 ? 2 : 3), {
    visual: { type: 'sentence', text: s }, say: `${s} ${question}`, hint: 'Look for the clue', hintIsData: false,
  });
};
