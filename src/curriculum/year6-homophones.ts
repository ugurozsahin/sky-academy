// y6-homophones (#1276): the Years 5–6 homophones and often-confused words (English Appendix 1 pp. 21–22). The card
// shows one sentence with a gap and the two spellings of the pair on the bubbles, so the sentence decides. Every row
// is hand-keyed: the partner is wrong in that slot. The spoken line says "blank", so neither word is ever read out.
// Left out on purpose: affect/effect and who's/whose, which the Years 3–4 topics own (#1112, #1171).
import type { Difficulty, Generator } from './types';
import { pick, shuffle, wordQ } from './util';

/** [sentence with one "_", answer, partner, tier]. d1 = the –ce/–se pairs, d2 = true homophones, d3 = near-homophones. */
export type Y6HomRow = [sentence: string, answer: string, partner: string, tier: 1 | 2 | 3];

const pair = (tier: 1 | 2 | 3, a: string, b: string, sa: string[], sb: string[]): Y6HomRow[] =>
  [...sa.map((s): Y6HomRow => [s, a, b, tier]), ...sb.map((s): Y6HomRow => [s, b, a, tier])];

export const Y6_HOMOPHONES: Y6HomRow[] = [
  ...pair(1, 'advice', 'advise', ['I need your _.', 'Mum gave me good _.'], ['Can you _ me?', 'I will _ you to wait.']),
  ...pair(1, 'device', 'devise', ['This _ can count steps.', 'My _ has a screen.'], ['We must _ a plan.', 'You should _ a clever trick.']),
  ...pair(1, 'licence', 'license', ['You need a _ to drive.', 'Dad showed his _ to the guard.'], ['The town can _ the market.', 'They will _ a new shop.']),
  ...pair(1, 'practice', 'practise', ['I did my _ before tea.', 'I need some _ at spelling.'], ['I must _ my spellings.', 'We can _ every day.']),
  ...pair(1, 'prophecy', 'prophesy', ['The old woman made a _ about the storm.', 'Her _ came true.'], ['They will _ a storm.', 'You can _ the weather.']),
  ...pair(2, 'aisle', 'isle', ['The bride walked down the _ of the church.'], ['Our boat sailed to a lovely _ in the sea.']),
  ...pair(2, 'aloud', 'allowed', ['Read your poem _ to the class.'], ['The rules say we are not _ to run.']),
  ...pair(2, 'altar', 'alter', ['The priest lit candles on the _.'], ['Mum will _ the dress to make it shorter.']),
  ...pair(2, 'bridal', 'bridle', ['The bride wore a _ gown at the wedding.'], ['The rider put a _ on the horse.']),
  ...pair(2, 'cereal', 'serial', ['I ate a bowl of _ for breakfast.'], ['The camera has a _ number on its base.']),
  ...pair(2, 'draft', 'draught', ['I wrote a first _ of my story.'], ['A cold _ blew under the door.']),
  ...pair(2, 'guessed', 'guest', ['She _ the answer to the riddle.'], ['Our _ stayed at the hotel for two nights.']),
  ...pair(2, 'heard', 'herd', ['We _ a loud noise in the night.'], ['A _ of cows crossed the field.']),
  ...pair(2, 'led', 'lead', ['Dad _ us along the path yesterday.'], ['I will _ the way tomorrow.', 'The old pipe was made of heavy grey _.']),
  ...pair(2, 'morning', 'mourning', ['I had toast for breakfast this _.'], ['They wore black to the funeral and were in _.']),
  ...pair(2, 'past', 'passed', ['Long ago, in the _, there were no cars.'], ['She _ her spelling test.']),
  ...pair(2, 'profit', 'prophet', ['The shop made a big _ this year.'], ['The ancient _ foretold a great flood.']),
  ...pair(2, 'stationary', 'stationery', ['The traffic light turned red and the car stayed _.'], ['I bought pens and paper at the _ shop.']),
  ...pair(2, 'steal', 'steel', ['The thief tried to _ the jewels.'], ['The bridge is made of strong _.']),
  ...pair(3, 'ascent', 'assent', ['The _ of the mountain took all day.'], ['The king gave his royal _ to the new law.']),
  ...pair(3, 'descent', 'dissent', ['The plane began its slow _ to the runway.'], ['The crowd showed its _ and began to protest.']),
  ...pair(3, 'compliment', 'complement', ['Thank you for the kind _.'], ['Angles can _ each other.']),
  ...pair(3, 'desert', 'dessert', ['The camel walked across the hot _.'], ['We had apple pie and cream for _.']),
  ...pair(3, 'farther', 'father', ['I can walk _ than my little sister.'], ['My _ and mother took us to the park.']),
  ...pair(3, 'precede', 'proceed', ['The number 7 will _ the number 8.'], ['Please _ to the gate when the bell rings.']),
  ...pair(3, 'principal', 'principle', ['The _ of the school welcomed the parents.'], ['Honesty is a good _ to live by.']),
  ...pair(3, 'wary', 'weary', ['Be _ when a stranger offers you sweets.'], ['The _ travellers fell asleep after the journey.']),
];

/** #2318: what each spelling means (or, for the -ce/-se pairs, which part of speech it is), so the why says which one the sentence needs. */
export const Y6_HOM_MEANING: Record<string, string> = {
  advice: 'is a noun: help you give', advise: 'is a verb: to give help', device: 'is a noun: a gadget', devise: 'is a verb: to plan or invent',
  licence: 'is a noun: a permit', license: 'is a verb: to permit', practice: 'is a noun: training', practise: 'is a verb: to train',
  prophecy: 'is a noun: a prediction', prophesy: 'is a verb: to predict',
  aisle: 'is a path between seats', isle: 'is an island', aloud: 'means out loud', allowed: 'means permitted',
  altar: 'is a holy table', alter: 'means change', bridal: 'is about a bride', bridle: 'is the head straps of a horse',
  cereal: 'is a breakfast grain', serial: 'means in a series', draft: 'is a first version', draught: 'is a current of air',
  guessed: 'means gave an answer without knowing', guest: 'is a visitor', heard: 'comes from hear', herd: 'is a group of animals',
  led: 'is the past of lead', lead: 'is a heavy metal, or to guide', morning: 'is the start of the day', mourning: 'is feeling sad after a death',
  past: 'is time gone by', passed: 'comes from pass', profit: 'is money gained', prophet: 'is a person who foretells',
  stationary: 'means not moving', stationery: 'is pens and paper', steal: 'means take what is not yours', steel: 'is a strong metal',
  ascent: 'is a climb up', assent: 'means agreement', descent: 'is a way down', dissent: 'means disagreement',
  compliment: 'is a kind remark', complement: 'means goes well with', desert: 'is a dry, sandy place', dessert: 'is a sweet course',
  farther: 'means more distance', father: 'is a dad', precede: 'means come before', proceed: 'means go on',
  principal: 'is the head of a school', principle: 'is a rule to live by', wary: 'means careful', weary: 'means tired',
};
export const y6HomWhy = (answer: string): string => {
  if (!(answer in Y6_HOM_MEANING)) throw new Error(`y6-homophones: no why for "${answer}"`);
  return `${answer[0].toUpperCase()}${answer.slice(1)} ${Y6_HOM_MEANING[answer]}.`;
};

/** Words too long to read on a bubble (R-LBL, #1046): the card names both as A and B and the bubbles are the letters. */
const LETTERED = ['compliment', 'complement'];

export const y6Homophones: Generator = (d: Difficulty, rng) => {
  // d3 is mostly its own near-homophones (70%), with the d1–d2 rows mixed in.
  const tier = d === 3 && rng() >= 0.7 ? (rng() < 0.5 ? 1 : 2) : d;
  const [sent, ans, partner] = pick(rng, Y6_HOMOPHONES.filter(r => r[3] === tier));
  const text = sent.replace('_', '___');
  if (LETTERED.includes(ans)) {
    const [a, b] = shuffle(rng, [ans, partner]);
    return wordQ(rng, `A: ${a}. B: ${b}. ${text}`, a === ans ? 'A' : 'B', [a === ans ? 'B' : 'A'], { visual: { type: 'sentence', text }, say: sent.replace('_', 'blank'), hint: 'Which spelling fits the sentence?', hintIsData: false, why: y6HomWhy(ans) });
  }
  return wordQ(rng, text, ans, [partner], { visual: { type: 'sentence', text }, say: sent.replace('_', 'blank'), hint: 'Which spelling fits the sentence?', hintIsData: false, why: y6HomWhy(ans) });
};
