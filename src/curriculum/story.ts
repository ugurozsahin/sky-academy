// "Story Order" (#975): a three-event story is shown or spoken, and the child slices the event pictures in the
// order they happen. One generator, registered for Reception (always shown) and Year 1 (shown at d1, then
// listen-and-build). The bank is hand-keyed: the order below is the only accepted answer. Every glyph is
// Emoji 12.0 or lower. Sentences stay on the card — a sentence does not fit a bubble label — so bubbles are emoji.
import type { Difficulty, Question, Rng } from './types';
import { pick, shuffle } from './util';

export type StoryEvent = readonly [sentence: string, emoji: string];
export type Story = readonly [StoryEvent, StoryEvent, StoryEvent];

export const STORIES: readonly Story[] = [
  [['The egg cracks.', '🥚'], ['A chick comes out.', '🐣'], ['It grows into a hen.', '🐔']],
  [['A seed is planted.', '🌱'], ['A flower grows.', '🌷'], ['We pick some flowers.', '💐']],
  [['The egg hatches.', '🥚'], ['A caterpillar eats leaves.', '🐛'], ['It becomes a butterfly.', '🦋']],
  [['Snow is on the ground.', '⛄'], ['The sun comes out.', '☀️'], ['The snow melts.', '💧']],
  [['The wheat is cut.', '🌾'], ['It is made into bread.', '🍞'], ['We eat a sandwich.', '🥪']],
  [['Dark clouds come.', '☁️'], ['Rain falls down.', '🌧️'], ['A rainbow shines.', '🌈']],
  [['We eat our tea.', '🍽️'], ['We brush our teeth.', '🦷'], ['We go to bed.', '🛏️']],
  [['We mix the batter.', '🥣'], ['We bake a cake.', '🎂'], ['We have a party.', '🎉']],
];

/** Decoys per difficulty. */
const DECOYS = [0, 1, 2] as const;

export function storyQ(rng: Rng, d: Difficulty, show: boolean): Question {
  const story = pick(rng, STORIES);
  const sequence = story.map(e => e[1]);
  const text = story.map(e => e[0]).join(' ');
  const pool = STORIES.flat().map(e => e[1]).filter(e => !sequence.includes(e));
  const decoys = shuffle(rng, [...new Set(pool)]).slice(0, DECOYS[d - 1]);
  return { prompt: 'Put the story in order', say: `Put the story in order: ${text}`, answer: sequence.join(''), sequence, options: shuffle(rng, [...sequence, ...decoys]),
    visual: show ? { type: 'sentence', text } : { type: 'word', text: '📖' }, hint: show ? 'Slice the pictures in the order they happen' : 'Listen, then slice the pictures in order', hintIsData: false,
    listen: show ? undefined : text, peek: !show };
}
