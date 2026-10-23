// Year 6 reading: simile, metaphor or personification? (#1241). One sentence on the card, exactly one device in it. The bubbles are the
// letters S, M and P with the key in the prompt, because "personification" is too long for a bubble (R-LBL, #1046).
import type { Difficulty, Generator, Question, Rng } from './types';
import { pick, wordQ } from './util';

export type Device = 'simile' | 'metaphor' | 'personification';
export const LETTER: Record<Device, string> = { simile: 'S', metaphor: 'M', personification: 'P' };
export interface Item { text: string; device: Device; hard?: boolean }

/** Human actions only a person does: a personification holds one, a simile or a metaphor never does. */
export const HUMAN_ACTIONS: readonly string[] = [
  'whispered', 'danced', 'sang', 'smiled', 'wept', 'crept', 'sighed', 'grumbled', 'winked', 'marched', 'yawned', 'waved', 'frowned',
  'laughed', 'knocked', 'complained', 'shouted', 'cried', 'argued', 'hugged', 'giggled', 'tiptoed',
];
/** The verbs a d3 metaphor may rely on instead of a linking verb. */
export const METAPHOR_VERBS: readonly string[] = ['cut', 'boiled', 'exploded', 'bubbled', 'burned', 'froze', 'melted', 'swallowed'];

export const BANK: readonly Item[] = [
  // similes: ` like ` or ` as … as `
  { text: 'The snow was as white as a sheet.', device: 'simile' },
  { text: 'Her hands were as cold as ice.', device: 'simile' },
  { text: 'He ran like the wind.', device: 'simile' },
  { text: 'The baby slept like a log.', device: 'simile' },
  { text: 'The moon was like a silver coin.', device: 'simile' },
  { text: 'The cat’s eyes shone like lamps.', device: 'simile' },
  { text: 'My bag is as heavy as a rock.', device: 'simile' },
  { text: 'The lake lay still like a mirror.', device: 'simile' },
  { text: 'The soup was as hot as lava.', device: 'simile' },
  { text: 'He was as quiet as a mouse.', device: 'simile' },
  { text: 'The road twisted like a snake.', device: 'simile' },
  { text: 'The clouds looked like cotton wool.', device: 'simile' },
  { text: 'The crowd moved like a river.', device: 'simile', hard: true },
  { text: 'Time passed like sand in a glass.', device: 'simile', hard: true },
  { text: 'Her voice was like warm honey.', device: 'simile', hard: true },
  { text: 'The thunder rumbled like a giant’s tummy.', device: 'simile', hard: true },
  { text: 'Hope glowed like a candle in the dark.', device: 'simile', hard: true },
  // metaphors: no ` like ` or ` as `; one thing IS another (or a closed METAPHOR_VERBS verb at d3)
  { text: 'The classroom was a zoo.', device: 'metaphor' },
  { text: 'The sun is a golden coin.', device: 'metaphor' },
  { text: 'His heart is a stone.', device: 'metaphor' },
  { text: 'The lake was a mirror.', device: 'metaphor' },
  { text: 'The stars are tiny diamonds.', device: 'metaphor' },
  { text: 'Her room was a jungle.', device: 'metaphor' },
  { text: 'The road is a grey ribbon.', device: 'metaphor' },
  { text: 'The clouds were fluffy pillows.', device: 'metaphor' },
  { text: 'The moon is a silver boat.', device: 'metaphor' },
  { text: 'Words are weapons.', device: 'metaphor' },
  { text: 'The snow was a thick white blanket.', device: 'metaphor' },
  { text: 'My brother is a bear in the morning.', device: 'metaphor' },
  { text: 'Her words cut deep.', device: 'metaphor', hard: true },
  { text: 'His temper boiled over.', device: 'metaphor', hard: true },
  { text: 'Anger exploded inside him.', device: 'metaphor', hard: true },
  { text: 'Excitement bubbled inside me.', device: 'metaphor', hard: true },
  { text: 'The test was a mountain to climb.', device: 'metaphor', hard: true },
  // personifications: a non-human thing does a human action; no ` like ` or ` as `
  { text: 'The wind whispered through the trees.', device: 'personification' },
  { text: 'The sun smiled down on the beach.', device: 'personification' },
  { text: 'The flowers danced in the breeze.', device: 'personification' },
  { text: 'The old house sighed in the storm.', device: 'personification' },
  { text: 'The moon winked at the sleepy town.', device: 'personification' },
  { text: 'The fridge grumbled all night.', device: 'personification' },
  { text: 'The stars winked in the dark sky.', device: 'personification' },
  { text: 'The clouds marched across the sky.', device: 'personification' },
  { text: 'The river sang a quiet song.', device: 'personification' },
  { text: 'The tree waved its branches.', device: 'personification' },
  { text: 'The thunder grumbled in the distance.', device: 'personification' },
  { text: 'The engine yawned and then stopped.', device: 'personification' },
  { text: 'Time crept by.', device: 'personification', hard: true },
  { text: 'Winter crept into the village.', device: 'personification', hard: true },
  { text: 'Fear whispered in my ear.', device: 'personification', hard: true },
  { text: 'Hope danced in her eyes.', device: 'personification', hard: true },
  { text: 'Opportunity knocked at the door.', device: 'personification', hard: true },
];

const DEVICES: readonly Device[] = ['simile', 'metaphor', 'personification'];
const KEY = 'S simile, M metaphor or P personification?';
const KEY_D1 = 'S simile or M metaphor?';

export const y6Figurative: Generator = (d: Difficulty, rng: Rng): Question => {
  const devices = d === 1 ? DEVICES.slice(0, 2) : DEVICES;
  const pool = BANK.filter(i => devices.includes(i.device) && (d === 3 ? i.hard : !i.hard));
  const item = pick(rng, pool);
  const letters = devices.map(v => LETTER[v]);
  const ask = d === 1 ? 'Is this a simile or a metaphor?' : 'Is this a simile, a metaphor or personification?';
  const prompt = d === 1 ? KEY_D1 : KEY, wrong = letters.filter(l => l !== LETTER[item.device]);
  const extra = { visual: { type: 'sentence', text: item.text } as const, say: `${item.text} ${ask}` };
  // Only difficulty 1 keeps the like/as test: with three devices it would hand over the simile (#2274).
  return d === 1
    ? wordQ(rng, prompt, LETTER[item.device], wrong, { ...extra, hint: 'Is there a like or an as?', hintIsData: false })
    : wordQ(rng, prompt, LETTER[item.device], wrong, extra);
};
