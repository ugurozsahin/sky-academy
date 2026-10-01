// y3-wordlist (#1102): the first 50 words of the Year 3–4 statutory list, exactly as English Appendix 1 p.16
// prints them (`accident(ally)` … `important`). The child hears a word and builds it letter by letter; a form of
// 10+ letters is built from short chunks. The ladder is the length of an entry's longest form, in five banks of 10.
import type { Difficulty, Generator } from './types';
import { pick } from './util';
import { wordListQ } from './spelling-ks2';
import type { WordEntry, WordForm } from './spelling-ks2';

const f = (w: string, s: string, chunks?: string[], decoys?: string[]): WordForm => ({ w, s, chunks, decoys });
const e = (printed: string, ...forms: WordForm[]): WordEntry => ({ printed, forms });

export const Y3_WORDLIST: WordEntry[] = [
  e('accident(ally)', f('accident', 'The car had a small accident on the road.'),
    f('accidentally', 'I accidentally dropped my cup on the floor.', ['ac', 'ci', 'dent', 'al', 'ly'], ['ley', 'ent', 'el'])),
  e('actual(ly)', f('actual', 'The actual size of the box was tiny.'), f('actually', 'I actually like cold peas for tea.')),
  e('address', f('address', 'Write your address at the top of the page.')),
  e('answer', f('answer', 'Can you answer the last question?')),
  e('appear', f('appear', 'Stars appear in the sky at night.')),
  e('arrive', f('arrive', 'We arrive at school at nine o’clock.')),
  e('believe', f('believe', 'I believe it will be sunny today.')),
  e('bicycle', f('bicycle', 'She rode her bicycle to the park.')),
  e('breath', f('breath', 'Take a deep breath before you swim.')),
  e('breathe', f('breathe', 'Fish breathe under the water.')),
  e('build', f('build', 'We can build a tall tower with blocks.')),
  e('busy/business', f('busy', 'Mum is busy in the kitchen.'), f('business', 'He runs a small business in town.')),
  e('calendar', f('calendar', 'Look at the calendar to see the date.')),
  e('caught', f('caught', 'The dog caught the ball in its mouth.')),
  e('centre', f('centre', 'Stand in the centre of the room.')),
  e('century', f('century', 'A century is one hundred years.')),
  e('certain', f('certain', 'I am certain I locked the door.')),
  e('circle', f('circle', 'Draw a circle with a round lid.')),
  e('complete', f('complete', 'Please complete your work before lunch.')),
  e('consider', f('consider', 'We should consider how others feel.')),
  e('continue', f('continue', 'Please continue reading from page two.')),
  e('decide', f('decide', 'It is hard to decide what to eat.')),
  e('describe', f('describe', 'Can you describe your toy to me?')),
  e('different', f('different', 'Every snowflake is different.')),
  e('difficult', f('difficult', 'The maths puzzle was very difficult.')),
  e('disappear', f('disappear', 'Watch the magician make the coin disappear.')),
  e('early', f('early', 'I woke up early on Saturday.')),
  e('earth', f('earth', 'Worms live in the earth under our feet.')),
  e('eight/eighth', f('eight', 'My little brother is eight years old.'), f('eighth', 'She came eighth in the race.')),
  e('enough', f('enough', 'Is there enough milk for everyone?')),
  e('exercise', f('exercise', 'We do exercise in the playground.')),
  e('experience', f('experience', 'Riding a horse was a new experience.', ['ex', 'per', 'i', 'ence'], ['ance', 'pur', 'ense'])),
  e('experiment', f('experiment', 'We did an experiment with ice.', ['ex', 'per', 'i', 'ment'], ['mant', 'pur', 'ecs'])),
  e('extreme', f('extreme', 'It was an extreme storm last night.')),
  e('famous', f('famous', 'The singer is famous all over the world.')),
  e('favourite', f('favourite', 'Blue is my favourite colour.')),
  e('February', f('February', 'My birthday is in February.')),
  e('forward(s)', f('forward', 'Take one step forward.'), f('forwards', 'The crab cannot walk forwards.')),
  e('fruit', f('fruit', 'An apple is a kind of fruit.')),
  e('grammar', f('grammar', 'We learn grammar in our English lessons.')),
  e('group', f('group', 'Our group sat on the carpet.')),
  e('guard', f('guard', 'A guard stood at the castle gate.')),
  e('guide', f('guide', 'A guide showed us round the museum.')),
  e('heard', f('heard', 'I heard a loud noise outside.')),
  e('heart', f('heart', 'Your heart beats faster when you run.')),
  e('height', f('height', 'We measured the height of the tree.')),
  e('history', f('history', 'In history we learn about the past.')),
  e('imagine', f('imagine', 'Can you imagine a pink elephant?')),
  e('increase', f('increase', 'Did the number of birds increase?')),
  e('important', f('important', 'It is important to wash your hands.')),
];

const longest = (x: WordEntry) => Math.max(...x.forms.map(v => v.w.length));
/** Banks 1–5 (index 0–4): the entries by length of longest form, ties in printed order, cut into tens. */
export const WORDLIST_BANKS: WordEntry[][] = (() => {
  const sorted = Y3_WORDLIST.map((x, i) => ({ x, i })).sort((a, b) => longest(a.x) - longest(b.x) || a.i - b.i).map(o => o.x);
  return [0, 1, 2, 3, 4].map(b => sorted.slice(b * 10, b * 10 + 10));
})();
/** Banks each difficulty draws from (1-based, as the issue numbers them). */
export const WORDLIST_LADDER: Record<Difficulty, number[]> = { 1: [1, 2], 2: [2, 3, 4], 3: [4, 5] };

export const y3Wordlist: Generator = (d, rng) =>
  wordListQ(rng, pick(rng, WORDLIST_LADDER[d].flatMap(b => WORDLIST_BANKS[b - 1])), d);

