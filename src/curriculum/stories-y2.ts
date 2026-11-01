// Year 2 Story Time (#1019): ten short stories read aloud; d1 asks who / what, d2 where / when / why, d3 a simple inference.
import { storyGen } from './story-bank';
import type { StoryItem } from './story-bank';

const FOX = 'Fred the fox was hungry, so he crept out at night. He found a plum under a bush, and an owl and a mouse watched. He licked his lips.';
const BUS = 'It was Monday, so Asha went to school on the bus. Her friend Kai saved her a seat while Mum and Sam waved. They sang songs all the way.';
const STORM = 'Dark clouds filled the sky. Leo heard a loud rumble and ran inside. He sat by the window and watched the rain with Dad and Sam.';
const CAKE = 'Nan and Omar baked a cake for Dad. They put on a candle and sang with Mum and Kai. Dad blew it out and made a wish.';
const ZOO = 'Priya wore her thick coat and scarf to the zoo with her class. She saw a tall giraffe eating leaves. Omar and Leo were ill and stayed home.';
const BALL = 'Jess lost her ball in the long grass. Her puppy sniffed and sniffed until he found it. Jess gave him a big hug, and Mum and Kai clapped.';
const SEED = 'Ben planted a seed in a pot. Every day he gave it water and put it by the window. After two weeks, a green shoot popped up for Mum and Sam to see.';
const WAKE = "Mum's alarm rang and the sun came up. Sam yawned, rubbed his eyes and got out of bed. Then he ate his breakfast with Dad.";
const ICE = 'Tara dropped her ice cream on the floor. Her lip wobbled and a tear ran down her cheek. Mum hugged her and Dad bought her a new one.';
const MOON = 'The moon was out and the stars were twinkling. Gran pulled the curtains and tucked Mia in. Dad kissed her, Gran read a story and Mia soon fell asleep.';

const lit = (d: 1 | 2, story: string, question: string, answer: string, decoys: string[], evidence: string): StoryItem =>
  ({ story, question, answer, decoys, evidence, kind: 'literal', d });
// Inferences are d3 only: d1 and d2 stay literal, so the ladder runs from what is said to what it means.
const inf = (story: string, question: string, answer: string, decoys: string[], evidence: string): StoryItem =>
  ({ story, question, answer, decoys, evidence, kind: 'inference', d: 3 });

export const Y2_STORIES: StoryItem[] = [
  lit(1, FOX, 'Who crept out at night?', 'Fred', ['owl', 'mouse'], 'Fred the fox was hungry, so he crept out at night'),
  lit(1, FOX, 'What did Fred find?', 'plum', ['nut', 'bone'], 'He found a plum'),
  lit(2, FOX, 'Why did Fred creep out?', 'hungry', ['tired', 'cold'], 'was hungry, so he crept out'),
  lit(2, FOX, 'Where was the plum?', 'bush', ['tree', 'pond'], 'under a bush'),
  inf(FOX, 'How does Fred feel at the end?', 'happy', ['sad', 'scared'], 'He licked his lips'),
  lit(1, BUS, 'Who saved a seat?', 'Kai', ['Asha', 'Mum', 'Sam'], 'Her friend Kai saved her a seat'),
  lit(1, BUS, 'What did they do all the way?', 'sang', ['ran', 'slept'], 'They sang songs all the way'),
  lit(2, BUS, 'When did Asha go to school?', 'Monday', ['Friday', 'Sunday'], 'It was Monday'),
  lit(2, BUS, 'How did Asha get to school?', 'bus', ['car', 'train'], 'on the bus'),
  inf(BUS, 'How do Asha and Kai feel?', 'happy', ['cross', 'scared'], 'They sang songs all the way'),
  lit(1, STORM, 'Who ran inside?', 'Leo', ['Sam', 'Dad'], 'Leo heard a loud rumble and ran inside'),
  lit(1, STORM, 'What did Leo watch?', 'rain', ['birds', 'cars'], 'watched the rain'),
  lit(2, STORM, 'Where did Leo sit?', 'window', ['stairs', 'garden'], 'sat by the window'),
  inf(STORM, 'What was the weather like?', 'stormy', ['sunny', 'snowy'], 'Dark clouds filled the sky. Leo heard a loud rumble'),
  lit(1, CAKE, 'Who baked the cake with Omar?', 'Nan', ['Mum', 'Kai'], 'Nan and Omar baked a cake'),
  lit(1, CAKE, 'What did Dad make?', 'wish', ['joke', 'mess'], 'made a wish'),
  lit(2, CAKE, 'Who was the cake for?', 'Dad', ['Nan', 'Mum'], 'cake for Dad'),
  inf(CAKE, 'What is the special day?', 'birthday', ['Monday', 'summer'], 'They put on a candle and sang with Mum and Kai. Dad blew it out and made a wish'),
  lit(1, ZOO, 'Who wore a thick coat?', 'Priya', ['Omar', 'Leo'], 'Priya wore her thick coat'),
  lit(1, ZOO, 'What was eating leaves?', 'giraffe', ['zebra', 'monkey'], 'a tall giraffe eating leaves'),
  lit(2, ZOO, 'Where did Priya go?', 'zoo', ['farm', 'beach'], 'to the zoo'),
  lit(2, ZOO, 'Who went with Priya?', 'class', ['Omar', 'Leo'], 'with her class'),
  inf(ZOO, 'What was the weather like?', 'cold', ['hot', 'warm'], 'thick coat and scarf'),
  lit(1, BALL, 'Who lost the ball?', 'Jess', ['Kai', 'Mum'], 'Jess lost her ball'),
  lit(1, BALL, 'What found the ball?', 'puppy', ['cat', 'duck'], 'Her puppy sniffed and sniffed until he found it'),
  lit(2, BALL, 'Where did Jess lose her ball?', 'grass', ['pond', 'road'], 'in the long grass'),
  lit(2, BALL, 'What did Jess give the puppy?', 'hug', ['bone', 'bath'], 'gave him a big hug'),
  inf(BALL, 'How does Jess feel at the end?', 'pleased', ['upset', 'scared'], 'Jess gave him a big hug'),
  lit(1, SEED, 'Who planted the seed?', 'Ben', ['Mum', 'Sam'], 'Ben planted a seed'),
  lit(1, SEED, 'What did Ben give the seed?', 'water', ['milk', 'juice'], 'gave it water'),
  lit(2, SEED, 'Where did Ben put the seed?', 'window', ['shed', 'cave'], 'put it by the window'),
  lit(2, SEED, 'How many weeks did Ben wait?', 'two', ['one', 'six'], 'After two weeks'),
  inf(SEED, 'What did the seed become?', 'plant', ['stone', 'toy'], 'a green shoot popped up'),
  lit(1, WAKE, 'Who got out of bed?', 'Sam', ['Mum', 'Dad'], 'Sam yawned, rubbed his eyes and got out of bed'),
  lit(1, WAKE, 'What did Sam rub?', 'eyes', ['hands', 'ears'], 'rubbed his eyes'),
  lit(2, WAKE, 'What rang?', 'alarm', ['phone', 'bell'], 'alarm rang'),
  lit(2, WAKE, 'What came up?', 'sun', ['moon', 'star'], 'the sun came up'),
  inf(WAKE, 'What time of day is it?', 'morning', ['night', 'evening'], "Mum's alarm rang and the sun came up"),
  inf(WAKE, 'How does Sam feel?', 'sleepy', ['angry', 'scared'], 'yawned, rubbed his eyes'),
  lit(1, ICE, 'Who dropped the ice cream?', 'Tara', ['Dad', 'Mum'], 'Tara dropped her ice cream'),
  lit(1, ICE, 'Who bought a new one?', 'Dad', ['Tara', 'Mum'], 'Dad bought her a new one'),
  lit(2, ICE, 'Where did the ice cream fall?', 'floor', ['sink', 'hill'], 'on the floor'),
  lit(2, ICE, 'What ran down her cheek?', 'tear', ['rain', 'milk'], 'a tear ran down her cheek'),
  inf(ICE, 'How did Tara feel at first?', 'sad', ['happy', 'proud'], 'Her lip wobbled and a tear ran down her cheek'),
  lit(1, MOON, 'Who tucked Mia in?', 'Gran', ['Dad', 'Mia'], 'Gran pulled the curtains and tucked Mia in'),
  lit(1, MOON, 'What were twinkling?', 'stars', ['lamps', 'boats'], 'the stars were twinkling'),
  lit(2, MOON, 'What did Gran read?', 'story', ['letter', 'menu'], 'Gran read a story'),
  lit(2, MOON, 'Who fell asleep?', 'Mia', ['Gran', 'Dad'], 'Mia soon fell asleep'),
  inf(MOON, 'What time of day is it?', 'night', ['noon', 'morning'], 'The moon was out and the stars were twinkling'),
];

export const y2StoryTime = storyGen(Y2_STORIES);
