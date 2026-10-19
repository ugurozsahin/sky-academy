// Year 4 Retrieving Information (#1130): ten short non-fiction passages, each asked about by what / where / how many, then a paraphrased question.
import { storyGen } from './story-bank';
import type { StoryItem } from './story-bank';

const ROMANS = 'The Romans came to Britain nearly two thousand years ago. They built straight roads and warm baths.';
const VOLCANO = 'A volcano is a mountain with a hole at the top. Hot lava and ash burst out when it erupts. Many stand around the Pacific Ocean.';
const WATER = 'The sun heats the sea and the water rises as vapour. High up it cools and forms clouds. Then rain falls.';
const TEETH = 'Children have twenty baby teeth. Sharp teeth at the front bite food. Flat teeth at the back chew it.';
const MAGNET = 'A magnet pulls iron and steel towards it. It does not pull wood or plastic. Every magnet has two poles.';
const PLANETS = 'Earth is the third planet from the sun. Mars is red and is next after Earth. Jupiter is the biggest planet.';
const BATS = 'Bats sleep in the day, hanging upside down. At night they fly out to hunt insects. Bats find food by listening to echoes.';
const FROG = 'A frog starts life as an egg in a pond. The egg hatches into a tadpole. The tadpole grows legs and becomes a frog.';
const CAMEL = 'Camels live in hot deserts. A camel stores fat in its hump. Camels can go for many days without a drink.';
const THAMES = 'The River Thames flows through London. It runs into the North Sea. Boats carry people and goods along it.';

// All literal: every answer is stated in the passage, and d3 asks it in other words (#666: no prediction questions).
const lit = (d: 1 | 2 | 3, story: string, question: string, answer: string, decoys: string[], evidence: string): StoryItem =>
  ({ story, question, answer, decoys, evidence, kind: 'literal', d });

export const Y4_NONFICTION: StoryItem[] = [
  lit(1, ROMANS, 'Who built straight roads?', 'Romans', ['Vikings', 'Saxons'], 'The Romans came to Britain nearly two thousand years ago. They built straight roads'),
  lit(2, ROMANS, 'How many thousand years ago did the Romans come?', 'two', ['five', 'ten'], 'nearly two thousand years ago'),
  lit(3, ROMANS, 'What did the Romans build to wash in?', 'baths', ['wells', 'ponds'], 'warm baths'),
  lit(1, VOLCANO, 'What bursts out of a volcano with the ash?', 'lava', ['water', 'wind'], 'Hot lava and ash burst out'),
  lit(2, VOLCANO, 'Which ocean has many volcanoes around it?', 'Pacific', ['Atlantic', 'Indian'], 'around the Pacific Ocean'),
  lit(3, VOLCANO, 'On which part of a volcano is the hole?', 'top', ['base', 'side'], 'hole at the top'),
  lit(1, WATER, 'What heats the sea?', 'sun', ['moon', 'wind'], 'The sun heats the sea'),
  lit(2, WATER, 'What does the vapour form when it cools?', 'clouds', ['dust', 'sand'], 'forms clouds'),
  lit(3, WATER, 'What comes down after the clouds form?', 'rain', ['leaves', 'stars'], 'Then rain falls'),
  lit(1, TEETH, 'Which teeth bite food?', 'sharp', ['flat', 'small'], 'Sharp teeth at the front bite food'),
  lit(2, TEETH, 'How many baby teeth do children have?', 'twenty', ['ten', 'thirty'], 'twenty baby teeth'),
  lit(3, TEETH, 'Which teeth do the chewing?', 'flat', ['sharp', 'loose'], 'Flat teeth at the back chew it'),
  lit(1, MAGNET, 'What does a magnet pull?', 'iron', ['glass', 'paper'], 'pulls iron and steel'),
  lit(2, MAGNET, 'How many poles has every magnet?', 'two', ['one', 'four'], 'two poles'),
  lit(3, MAGNET, 'Which of these does a magnet not pull?', 'wood', ['iron', 'steel'], 'does not pull wood or plastic'),
  lit(1, PLANETS, 'Which planet is the biggest?', 'Jupiter', ['Mars', 'Earth'], 'Jupiter is the biggest planet'),
  lit(2, PLANETS, 'Which planet is third from the sun?', 'Earth', ['Mars', 'Jupiter'], 'Earth is the third planet'),
  lit(3, PLANETS, 'What colour is Mars?', 'red', ['blue', 'green'], 'Mars is red'),
  lit(1, BATS, 'What do bats hunt?', 'insects', ['fish', 'mice'], 'hunt insects'),
  lit(2, BATS, 'When do bats fly out to hunt?', 'night', ['dawn', 'noon'], 'At night they fly out'),
  lit(3, BATS, 'When do bats rest?', 'day', ['night', 'dusk'], 'Bats sleep in the day'),
  lit(1, FROG, 'What does an egg hatch into?', 'tadpole', ['chick', 'newt'], 'hatches into a tadpole'),
  lit(2, FROG, 'Where does a frog start life?', 'pond', ['river', 'field'], 'egg in a pond'),
  lit(3, FROG, 'What does the tadpole grow?', 'legs', ['wings', 'fins'], 'grows legs'),
  lit(1, CAMEL, 'What does a camel store in its hump?', 'fat', ['water', 'sand'], 'stores fat in its hump'),
  lit(2, CAMEL, 'Where do camels live?', 'deserts', ['forests', 'jungles'], 'live in hot deserts'),
  lit(3, CAMEL, 'What can camels go without for many days?', 'drink', ['sleep', 'air'], 'without a drink'),
  lit(1, THAMES, 'Which river flows through London?', 'Thames', ['Severn', 'Trent'], 'The River Thames flows through London'),
  lit(2, THAMES, 'Which sea does the Thames run into?', 'North', ['Irish', 'Black'], 'into the North Sea'),
  lit(3, THAMES, 'Who do boats carry along the river?', 'people', ['pirates', 'knights'], 'Boats carry people'),
];

export const y4Retrieve = storyGen(Y4_NONFICTION);
