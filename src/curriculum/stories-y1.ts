// Year 1 Story Time (#1018): ten short stories read aloud, each asked about by who / what / where, then by a simple inference.
import { storyGen } from './story-bank';
import { colourBubbles } from './colour-bubbles';
import type { StoryItem } from './story-bank';

const HAT = 'Tom has a red hat. He lost it in the park. Dad and Mum looked, then Mum found it by the tree.';
const RAIN = 'Sam took his umbrella and wellies. He splashed in the puddles while Mum and Ben stayed dry. Sam had so much fun.';
const PETS = 'Mia has a cat and a dog. The cat is black. The dog likes to run.';
const SHOP = 'Ben went to the shop with Dad while Mum and Gran stayed home. They got milk, eggs and a loaf. Ben carried the eggs.';
const SNOW = 'Lily put on her coat, hat and gloves. Then she ran out to play in the snow. Mum and Tom watched.';
const BED = 'Jack is in bed. He is yawning and his eyes are closing. Dad waves and Mum turns off the light.';
const APPLES = 'Zoe has three red apples. She gives one to Ali while Mum watches. Now Zoe has two.';
const DUCK = 'A little duck sat on the pond. It saw a big fish and a frog. The duck quacked and swam away.';
const CAKE = 'Dan and Gran made a cake. They put it in the oven. Soon Mum and Dad came in, sniffing the sweet smell.';
const PUP = 'Ravi has a pup. The pup ran in the mud while Zoe and Sam played. Now Ravi fills the bath.';

const lit = (d: 1 | 2 | 3, story: string, question: string, answer: string, decoys: string[], evidence: string): StoryItem =>
  ({ story, question, answer, decoys, evidence, kind: 'literal', d });
// Inferences are d3 only: d1 and d2 stay literal, so the ladder runs from what is said to what it means.
const inf = (story: string, question: string, answer: string, decoys: string[], evidence: string): StoryItem =>
  ({ story, question, answer, decoys, evidence, kind: 'inference', d: 3 });

export const Y1_STORIES: StoryItem[] = [
  lit(1, HAT, 'Who lost the hat?', 'Tom', ['Mum', 'Dad'], 'Tom has a red hat. He lost it'),
  lit(1, HAT, 'Who found the hat?', 'Mum', ['Tom', 'Dad'], 'Mum found it'),
  lit(2, HAT, 'Where did Tom lose the hat?', 'park', ['shop', 'house'], 'lost it in the park'),
  lit(2, HAT, 'What colour is the hat?', 'red', ['blue', 'green'], 'red hat'),
  inf(HAT, 'How does Tom feel at the end?', 'happy', ['sad', 'cross'], 'Mum found it by the tree'),
  lit(1, RAIN, 'Who had fun?', 'Sam', ['Mum', 'Ben'], 'Sam had so much fun'),
  lit(2, RAIN, 'What did Sam splash in?', 'puddles', ['sand', 'grass'], 'splashed in the puddles'),
  inf(RAIN, 'What is the weather like?', 'rainy', ['sunny', 'hot'], 'umbrella and wellies'),
  lit(1, PETS, 'Which pet likes to run?', 'dog', ['cat', 'fish'], 'The dog likes to run'),
  lit(2, PETS, 'What colour is the cat?', 'black', ['white', 'brown'], 'The cat is black'),
  lit(1, SHOP, 'Who went to the shop with Ben?', 'Dad', ['Mum', 'Gran'], 'with Dad'),
  lit(2, SHOP, 'Where did Ben go?', 'shop', ['park', 'farm'], 'went to the shop'),
  lit(2, SHOP, 'What did Ben carry?', 'eggs', ['milk', 'loaf'], 'Ben carried the eggs'),
  lit(1, SNOW, 'Who ran out to play?', 'Lily', ['Mum', 'Tom'], 'Lily put on her coat, hat and gloves. Then she ran out'),
  inf(SNOW, 'What is the weather like?', 'cold', ['hot', 'warm'], 'coat, hat and gloves'),
  lit(1, BED, 'Who turns off the light?', 'Mum', ['Jack', 'Dad'], 'Mum turns off the light'),
  lit(2, BED, 'Where is Jack?', 'bed', ['car', 'bath'], 'Jack is in bed'),
  inf(BED, 'How does Jack feel?', 'sleepy', ['hungry', 'cross'], 'yawning and his eyes are closing'),
  lit(1, APPLES, 'Who gives an apple to Ali?', 'Zoe', ['Ali', 'Mum'], 'She gives one to Ali'),
  lit(2, APPLES, 'How many apples does Zoe have now?', 'two', ['one', 'three'], 'Now Zoe has two'),
  lit(2, APPLES, 'What colour are the apples?', 'red', ['blue', 'pink'], 'three red apples'),
  lit(1, DUCK, 'Who sat on the pond?', 'duck', ['frog', 'fish'], 'A little duck sat on the pond'),
  lit(2, DUCK, 'What did the duck see?', 'fish', ['boat', 'log'], 'saw a big fish'),
  inf(DUCK, 'How does the duck feel?', 'scared', ['happy', 'proud'], 'The duck quacked and swam away'),
  lit(1, CAKE, 'Who made a cake with Dan?', 'Gran', ['Mum', 'Dad'], 'Dan and Gran made a cake'),
  lit(2, CAKE, 'What did they make?', 'cake', ['pie', 'bread'], 'made a cake'),
  lit(2, CAKE, 'Where did they put the cake?', 'oven', ['fridge', 'box'], 'in the oven'),
  lit(1, PUP, 'Who has a pup?', 'Ravi', ['Zoe', 'Sam'], 'Ravi has a pup'),
  inf(PUP, 'How is the pup now?', 'muddy', ['sleepy', 'hungry'], 'The pup ran in the mud'),
];

export const y1StoryTime = colourBubbles(storyGen(Y1_STORIES));
