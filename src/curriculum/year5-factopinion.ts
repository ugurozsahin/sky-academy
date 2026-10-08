// Year 5 reading: fact or opinion (#1178). A hand-written bank checked by closed clue-word lists (#1015's device):
// every opinion carries a marker, no fact does. Facts are checkable statements; comparisons use measurable words.
import type { Difficulty, Generator, Question, Rng } from './types';
import { pick, shuffle, wordQ } from './util';
import { anyOrderQ } from './any-order';

export const FACTS: readonly string[] = [
  'A spider has eight legs.', 'The Earth orbits the Sun.', 'Water boils at 100 degrees Celsius.', 'A week has seven days.',
  'Cows give us milk.', 'The Moon orbits the Earth.', 'Mars is a planet.', 'Penguins are birds.', 'Bees make honey.',
  'Whales are mammals.', 'Ice is frozen water.', 'London is the capital of England.', 'A triangle has three sides.',
  'Frogs begin life as tadpoles.', 'The Romans built roads in Britain.', 'Plants need water to grow.',
  'A football team has eleven players.', 'Bread is made from flour.', 'The Sun is a star.', 'Insects have six legs.',
  'Fish breathe through gills.', 'Wales is part of the United Kingdom.', 'Rain falls from clouds.', 'Wool comes from sheep.',
  'The Nile is longer than the Thames.', 'An elephant is heavier than a mouse.', 'Jupiter is bigger than Earth.',
  'Everest is taller than Snowdon.', 'The pyramids are older than Big Ben.', 'A cheetah runs faster than a tortoise.',
  'Russia is larger than France.', 'The Sun is hotter than the Moon.',
];

export const OPINIONS: readonly string[] = [
  'Pizza is the best food ever.', 'Football is the best sport.', 'Summer is the best season.', 'Dogs are the best pets.',
  'Maths is a boring subject.', 'Rainy days are boring.', 'Pasta is delicious.', 'Strawberries are delicious.',
  'Blue is my favourite colour.', 'Swimming is my favourite sport.', 'Homework is boring.', 'Chips are a delicious snack.',
  'Spiders are the scariest animals.', 'Monday is the worst day.', 'Cats are better than dogs.', 'Winter is too cold.',
  'Autumn leaves are beautiful.', 'You should eat more vegetables.', 'Fireworks are amazing.', 'Rugby is more exciting than golf.',
  'Sprouts are awful.', 'Wearing a hat is silly.', 'Spring flowers are lovely.', 'Tea is nicer than juice.',
  'Castles are amazing places.', 'Space is an exciting subject.', 'Everyone should learn to swim.', 'Rain is awful.',
  'Roller coasters are too scary.', 'The seaside is beautiful in winter.', 'Reading is better than watching TV.',
];

/** Closed clue-word lists: the oracle the unit test runs over the whole bank. */
export const OPINION_MARKERS: readonly string[] = ['best', 'worst', 'favourite', 'boring', 'amazing', 'beautiful', 'delicious',
  'scariest', 'should', 'better', 'nicer', 'too', 'lovely', 'awful', 'exciting', 'silly'];
export const OBVIOUS_MARKERS: readonly string[] = ['best', 'favourite', 'boring', 'delicious'];

export const wordsOf = (s: string): string[] => s.toLowerCase().match(/[a-z]+/g) ?? [];
export const hasMarker = (s: string, list: readonly string[] = OPINION_MARKERS): boolean => wordsOf(s).some(w => list.includes(w));
const isComparison = (s: string): boolean => wordsOf(s).includes('than');

const EASY_FACTS = FACTS.filter(f => !isComparison(f));
const EASY_OPINIONS = OPINIONS.filter(o => hasMarker(o, OBVIOUS_MARKERS));

const ask = (rng: Rng, text: string, answer: 'fact' | 'opinion'): Question =>
  wordQ(rng, 'Fact or opinion?', answer, ['fact', 'opinion'], {
    visual: { type: 'sentence', text }, say: `${text} Fact or opinion?`, hint: 'Could you check it?', hintIsData: false,
  });

/** d3: three lettered sentences; slice every opinion (two opinions, one fact) or every fact (two facts, one opinion). */
function anyOrderCard(rng: Rng): Question {
  const wantOpinion = rng() < 0.5;
  const wanted = shuffle(rng, wantOpinion ? OPINIONS : FACTS).slice(0, 2);
  const other = pick(rng, wantOpinion ? FACTS : OPINIONS);
  const lines = shuffle(rng, [{ s: wanted[0], t: true }, { s: wanted[1], t: true }, { s: other, t: false }])
    .map((l, i) => ({ ...l, letter: 'ABC'[i] }));
  const kind = wantOpinion ? 'opinion' : 'fact';
  const prompt = `Slice every ${kind}`;
  return anyOrderQ(rng, prompt, lines.filter(l => l.t).map(l => l.letter), lines.filter(l => !l.t).map(l => l.letter), {
    visual: { type: 'sentence', text: lines.map(l => `${l.letter}  ${l.s}`).join('\n') },
    say: `${lines.map(l => `${l.letter}. ${l.s}`).join(' ')} ${prompt}`, hint: 'Could you check it?', hintIsData: false,
  });
}

export const y5FactOpinion: Generator = (d: Difficulty, rng: Rng): Question => {
  if (d === 3) return anyOrderCard(rng);
  const isFact = rng() < 0.5;
  const text = isFact ? pick(rng, d === 1 ? EASY_FACTS : FACTS) : pick(rng, d === 1 ? EASY_OPINIONS : OPINIONS);
  return ask(rng, text, isFact ? 'fact' : 'opinion');
};
