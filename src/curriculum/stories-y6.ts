// Year 6 Story Time: inference (#1240). Ten short fiction passages; d1 asks the feeling, d2 the reason, d3 the word that proves it.
// The oracle is a closed clue list (#1015): the evidence holds a clue of the answer and the whole story holds no clue of any decoy.
import { storyGen } from './story-bank';
import type { StoryItem } from './story-bank';

/** Every label the bank can show at d1 and d2, with the words in a passage that would support it. No clue word sits under two labels. */
export const INFER_CLUES: Record<string, string[]> = {
  nervous: ['shook', 'gulped'],
  tired: ['yawned', 'drooped'],
  jealous: ['envied', 'wished'],
  relieved: ['sighed', 'relaxed'],
  proud: ['beamed', 'boasted'],
  angry: ['stormed', 'slammed', 'clenched'],
  sad: ['sobbed', 'tears'],
  excited: ['bounced', 'squealed'],
  scared: ['froze', 'cowered'],
  lonely: ['alone', 'nobody'],
  'the cold': ['shivered', 'frost', 'scarf'],
  hunger: ['rumbled', 'stomach', 'hungry'],
  'a surprise': ['wrapped', 'ribbon'],
  'to hide': ['tiptoed', 'hid', 'sneaked'],
  'to help': ['offered', 'carried'],
  fear: ['thunder', 'storm'],
  'a lost pet': ['dog', 'lead'],
  'broken model': ['broken'],
};

const STAGE = 'Her hands shook as she walked onto the stage. She gulped and stared at the crowd. Then she began to sing.';
const SOFA = 'Leo yawned again and his head drooped. The film had only just started. Soon his eyes closed.';
const RACE = 'Ana crossed the line first and beamed at her mum. She held the shiny trophy high above her head.';
const COLD = 'Ben shivered and pulled his scarf up to his nose. Frost covered the grass. He hurried back indoors.';
const GIFT = 'Priya wrapped the box in paper and tied a ribbon. Then she kept it behind her back. Gran was coming for tea.';
const DOG = 'Sam sobbed into his sleeve. Tears dripped onto the floor as he looked at the empty lead. His dog had not come home.';
const DOOR = 'Jo stormed into her room and slammed the door. She clenched her fists and said nothing. Her little brother had broken her model.';
const BAGS = 'Old Mr Ray struggled with his heavy shopping bags. Kim offered to help and carried them to his door. He sighed and thanked her.';
const NIGHT = 'Tom froze at the window as thunder cracked. He cowered under the blanket and held his teddy tight.';
const DRESS = 'Eva watched Zara twirl in her new party dress. She envied her and wished she had one too. Eva looked down at her old shoes.';

const it = (d: 1 | 2 | 3, story: string, question: string, answer: string, decoys: string[], evidence: string): StoryItem =>
  ({ story, question, answer, decoys, evidence, kind: 'inference', d });

export const Y6_INFERENCE: StoryItem[] = [
  it(1, STAGE, 'How did she feel before she sang?', 'nervous', ['proud', 'tired'], 'hands shook'),
  it(3, STAGE, 'Which word shows she was nervous?', 'shook', ['stage', 'sing'], 'hands shook'),
  it(1, SOFA, 'How did Leo feel?', 'tired', ['excited', 'angry'], 'yawned again and his head drooped'),
  it(3, SOFA, 'Which word shows Leo was tired?', 'yawned', ['film', 'started'], 'Leo yawned again'),
  it(1, RACE, 'How did Ana feel?', 'proud', ['sad', 'scared'], 'beamed at her mum'),
  it(3, RACE, 'Which word shows Ana was proud?', 'beamed', ['line', 'mum'], 'beamed at her mum'),
  it(2, COLD, 'Why did Ben hurry indoors?', 'the cold', ['hunger', 'a surprise'], 'Ben shivered and pulled his scarf up to his nose'),
  it(3, COLD, 'Which word shows Ben was cold?', 'shivered', ['hurried', 'indoors'], 'Ben shivered'),
  it(2, GIFT, 'Why did Priya keep the box behind her back?', 'a surprise', ['the cold', 'hunger'], 'wrapped the box in paper and tied a ribbon'),
  it(1, DOG, 'How did Sam feel?', 'sad', ['excited', 'proud'], 'Sam sobbed into his sleeve'),
  it(2, DOG, 'Why was Sam upset?', 'a lost pet', ['the cold', 'hunger'], 'His dog had not come home'),
  it(3, DOG, 'Which word shows Sam was sad?', 'sobbed', ['sleeve', 'home'], 'Sam sobbed'),
  it(1, DOOR, 'How did Jo feel?', 'angry', ['relieved', 'lonely'], 'stormed into her room and slammed the door'),
  it(2, DOOR, 'Why was Jo upset?', 'broken model', ['hunger', 'the cold'], 'had broken her model'),
  it(3, DOOR, 'Which word shows Jo was angry?', 'slammed', ['room', 'brother'], 'slammed the door'),
  it(1, BAGS, 'How did Mr Ray feel once the bags were carried?', 'relieved', ['angry', 'scared'], 'He sighed and thanked her'),
  it(2, BAGS, 'Why did Kim carry the bags?', 'to help', ['to hide', 'hunger'], 'Kim offered to help and carried them'),
  it(1, NIGHT, 'How did Tom feel?', 'scared', ['proud', 'jealous'], 'Tom froze at the window'),
  it(2, NIGHT, 'Why did Tom hide under the blanket?', 'fear', ['a surprise', 'hunger'], 'froze at the window as thunder cracked'),
  it(3, NIGHT, 'Which word shows Tom was scared?', 'froze', ['window', 'Tom'], 'Tom froze'),
  it(1, DRESS, 'How did Eva feel about the dress?', 'jealous', ['nervous', 'tired'], 'She envied her and wished she had one too'),
  it(3, DRESS, 'Which word shows Eva was jealous?', 'envied', ['twirl', 'party'], 'She envied her'),
];

/** Labels that fit an item by common sense with no clue word in the text: never a decoy of that item. Keyed by question. */
export const NOT_DECOYS: Record<string, string[]> = {
  'Why did Priya keep the box behind her back?': ['to hide'],
  'Why did Tom hide under the blanket?': ['the cold'],
  'Why did Ben hurry indoors?': ['fear'],
};

export const y6Inference = storyGen(Y6_INFERENCE);
