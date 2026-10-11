// y6-passive (#1279): active and passive (English Appendix 2, Year 6). d1 tells an active sentence from a passive one,
// d2 builds the passive verb in the right tense, d3 asks who did it (or says the sentence does not tell) and takes
// the glossary's passive-looking actives. Naming subject and object is #1283's.
import type { Difficulty, Generator, Question } from './types';
import { pick, wordQ } from './util';

/** [active sentence, passive sentence, active verb, passive verb, tense, agent, patient, -ing form, agentless passive or ''] */
export type PassiveRow = [active: string, passive: string, activeVerb: string, passiveVerb: string, tense: 'past' | 'present', agent: string, patient: string, ing: string, agentless: string];

export const PASSIVES: PassiveRow[] = [
  ['The dog chased the cat.', 'The cat was chased by the dog.', 'chased', 'was chased', 'past', 'the dog', 'the cat', 'chasing', ''],
  ['I broke the window in the greenhouse.', 'The window in the greenhouse was broken by me.', 'broke', 'was broken', 'past', 'me', 'the window', 'breaking', 'The window in the greenhouse was broken.'],
  ['The cook burnt the toast.', 'The toast was burnt by the cook.', 'burnt', 'was burnt', 'past', 'the cook', 'the toast', 'burning', ''],
  ['The storm damaged the roof.', 'The roof was damaged by the storm.', 'damaged', 'was damaged', 'past', 'the storm', 'the roof', 'damaging', 'The roof was damaged.'],
  ['The girl painted the picture.', 'The picture was painted by the girl.', 'painted', 'was painted', 'past', 'the girl', 'the picture', 'painting', 'The picture was painted.'],
  ['A thief stole the bike.', 'The bike was stolen by a thief.', 'stole', 'was stolen', 'past', 'a thief', 'the bike', 'stealing', 'The bike was stolen.'],
  ['The teacher opened the box.', 'The box was opened by the teacher.', 'opened', 'was opened', 'past', 'the teacher', 'the box', 'opening', ''],
  ['The chef cooked the soup.', 'The soup was cooked by the chef.', 'cooked', 'was cooked', 'past', 'the chef', 'the soup', 'cooking', ''],
  ['Mum washed the car.', 'The car was washed by Mum.', 'washed', 'was washed', 'past', 'Mum', 'the car', 'washing', ''],
  ['The boy kicked the ball.', 'The ball was kicked by the boy.', 'kicked', 'was kicked', 'past', 'the boy', 'the ball', 'kicking', ''],
  ['The pupil wrote the poem.', 'The poem was written by the pupil.', 'wrote', 'was written', 'past', 'the pupil', 'the poem', 'writing', 'The poem was written.'],
  ['The bird ate the seed.', 'The seed was eaten by the bird.', 'ate', 'was eaten', 'past', 'the bird', 'the seed', 'eating', ''],
  ['The captain chose the team.', 'The team was chosen by the captain.', 'chose', 'was chosen', 'past', 'the captain', 'the team', 'choosing', 'The team was chosen.'],
  ['The artist drew the map.', 'The map was drawn by the artist.', 'drew', 'was drawn', 'past', 'the artist', 'the map', 'drawing', 'The map was drawn.'],
  ['The farmer feeds the hen.', 'The hen is fed by the farmer.', 'feeds', 'is fed', 'present', 'the farmer', 'the hen', 'feeding', ''],
  ['The baker bakes the bread.', 'The bread is baked by the baker.', 'bakes', 'is baked', 'present', 'the baker', 'the bread', 'baking', ''],
  ['The cleaner sweeps the floor.', 'The floor is swept by the cleaner.', 'sweeps', 'is swept', 'present', 'the cleaner', 'the floor', 'sweeping', ''],
  ['The nurse helps the child.', 'The child is helped by the nurse.', 'helps', 'is helped', 'present', 'the nurse', 'the child', 'helping', 'The child is helped.'],
  ['The driver parks the bus.', 'The bus is parked by the driver.', 'parks', 'is parked', 'present', 'the driver', 'the bus', 'parking', ''],
];

/** Active sentences that carry a passive meaning or look passive: the glossary's two, then four more. No be/get + participle in any. */
export const NOT_PASSIVE: string[] = [
  'He received a warning.', 'We had an accident.', 'The tree suffered damage in the storm.',
  'The class got a surprise.', 'Dad had a fall on the ice.', 'The team took a heavy defeat.',
];

const NOT_TOLD = 'not told';
const swapTense = (v: string): string => (v.startsWith('was ') ? v.replace('was ', 'is ') : v.replace('is ', 'was '));

/** The d2 decoys, built from the row: the active verb, be + -ing in the same tense, the same passive in the other tense. */
export const passiveDecoys = (r: PassiveRow): string[] => [r[2], `${r[3].split(' ')[0]} ${r[7]}`, swapTense(r[3])];

const voiceCard = (rng: Parameters<Generator>[1], sentence: string, voice: 'active' | 'passive'): Question =>
  wordQ(rng, 'Slice active or passive', voice, [voice === 'active' ? 'passive' : 'active'], {
    visual: { type: 'sentence', text: sentence }, say: `Is this sentence active or passive? ${sentence}`, hint: 'The doer comes first in an active sentence', hintIsData: false, wide: true,
  });

export const y6Passive: Generator = (d: Difficulty, rng) => {
  if (d === 1) {
    const passive = rng() < 0.5;
    if (passive) return voiceCard(rng, pick(rng, PASSIVES)[1], 'passive');
    return voiceCard(rng, rng() < 0.5 ? pick(rng, PASSIVES)[0] : pick(rng, NOT_PASSIVE), 'active');
  }
  if (d === 2) {
    const row = pick(rng, PASSIVES);
    const stem = row[1].replace(row[3], '___');
    return wordQ(rng, 'Slice the passive verb', row[3], passiveDecoys(row), {
      visual: { type: 'sentence', text: `${row[0]}\n${stem}` }, say: `Make it passive. ${row[0]} ${stem.replace('___', 'blank')} Slice the passive verb.`, hint: 'Slice the passive verb', hintIsData: false, wide: true,
    });
  }
  if (rng() < 0.5) {
    const roll = rng();
    return roll < 0.5 ? voiceCard(rng, pick(rng, NOT_PASSIVE), 'active') : voiceCard(rng, pick(rng, PASSIVES)[1], 'passive');
  }
  const row = pick(rng, PASSIVES);
  const agentless = row[8] !== '' && rng() < 0.5;
  const sentence = agentless ? row[8] : row[1];
  const answer = agentless ? NOT_TOLD : row[5];
  return wordQ(rng, 'Slice who did it', answer, [row[5], row[6], NOT_TOLD].filter(o => o !== answer), {
    visual: { type: 'sentence', text: sentence }, say: `Who did it? ${sentence}`, hint: 'Look for by', hintIsData: false, wide: true,
  });
};
