// Reception Story Time (#1020): ten very short stories read aloud, each asked about twice. Answers are emoji, so a
// pre-reader can play; a "how many" question answers with the digit 1-5. Every question is literal.
import { storyGen } from './story-bank';
import type { StoryItem } from './story-bank';

const CAT = 'A cat ate a fish. Then it had a nap.';
const DOG = 'The dog ran to the park. It saw two ducks.';
const APPLES = 'Mia has three apples. She likes them.';
const HAT = 'A boy put on a hat. Then he went out in the rain.';
const FROG = 'A frog hopped to the pond. It met three fish.';
const CAR = 'Dad has a car. It has four wheels.';
const BIRDS = 'Two birds sat on a wall. Then they sang.';
const PIG = 'The pig has a bath. Then it eats an apple.';
const GRAN = 'Gran has two cats. They like milk.';
const BALLS = 'A girl has four balls. She likes to kick them.';

/** A question answered by a picture: `word` is the word in the story the emoji stands for. */
const pic = (d: 1 | 2 | 3, story: string, question: string, answer: string, word: string, decoys: string[], evidence: string): StoryItem =>
  ({ story, question, answer, word, decoys, evidence, kind: 'literal', d });
/** A "how many" question (up to 5): the options are digits, and `word` is the number word the story uses. */
const many = (story: string, question: string, n: 1 | 2 | 3 | 4 | 5, word: string, evidence: string): StoryItem =>
  ({ story, question, answer: String(n), word, decoys: [n - 1, n + 1].filter(x => x >= 1 && x <= 5).map(String), evidence, kind: 'literal', d: 3 });

export const R_STORIES: StoryItem[] = [
  pic(1, CAT, 'Who ate the fish?', '🐱', 'cat', ['🐶', '🐰'], 'A cat ate a fish'),
  pic(2, CAT, 'What did the cat eat?', '🐟', 'fish', ['🍎', '🍞'], 'ate a fish'),
  pic(1, DOG, 'Who ran to the park?', '🐶', 'dog', ['🐱', '🐰'], 'The dog ran to the park'),
  many(DOG, 'How many ducks did the dog see?', 2, 'two', 'saw two ducks'),
  pic(2, APPLES, 'What does Mia have?', '🍎', 'apples', ['🍌', '🍪'], 'Mia has three apples'),
  many(APPLES, 'How many apples does Mia have?', 3, 'three', 'three apples'),
  pic(1, HAT, 'Who put on a hat?', '👦', 'boy', ['👧', '👵'], 'A boy put on a hat'),
  pic(2, HAT, 'What did the boy put on?', '🎩', 'hat', ['👟', '🧤'], 'put on a hat'),
  pic(1, FROG, 'Who hopped to the pond?', '🐸', 'frog', ['🐢', '🐰'], 'A frog hopped to the pond'),
  many(FROG, 'How many fish did the frog meet?', 3, 'three', 'met three fish'),
  pic(2, CAR, 'What does Dad have?', '🚗', 'car', ['🚲', '🚌'], 'Dad has a car'),
  many(CAR, 'How many wheels does the car have?', 4, 'four', 'four wheels'),
  pic(1, BIRDS, 'Who sat on the wall?', '🐦', 'birds', ['🐱', '🐸'], 'Two birds sat on a wall'),
  many(BIRDS, 'How many birds sat on the wall?', 2, 'two', 'Two birds sat on a wall'),
  pic(1, PIG, 'Who has a bath?', '🐷', 'pig', ['🐮', '🐴'], 'The pig has a bath'),
  pic(2, PIG, 'What does the pig eat?', '🍎', 'apple', ['🍌', '🍪'], 'it eats an apple'),
  pic(2, GRAN, 'What do the cats like?', '🥛', 'milk', ['🍎', '🍪'], 'They like milk'),
  many(GRAN, 'How many cats does Gran have?', 2, 'two', 'Gran has two cats'),
  pic(2, BALLS, 'What does the girl have?', '⚽', 'balls', ['🎩', '🚗'], 'A girl has four balls'),
  many(BALLS, 'How many balls does the girl have?', 4, 'four', 'four balls'),
];

export const rStoryTime = storyGen(R_STORIES);
