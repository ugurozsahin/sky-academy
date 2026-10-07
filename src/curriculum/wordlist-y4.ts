// y4-wordlist (#1157): words 51–100 of the Year 3–4 statutory list, exactly as English Appendix 1 p.16 prints
// them (`interest` … `woman/women`). Same cards as y3-wordlist: `wordListQ`/`chunkQ` build them, only the bank differs.
import type { Generator } from './types';
import { pick } from './util';
import { wordListQ } from './spelling-ks2';
import type { WordEntry, WordForm } from './spelling-ks2';
import { WORDLIST_LADDER } from './wordlist-y3';

const f = (w: string, s: string, chunks?: string[], decoys?: string[]): WordForm => ({ w, s, chunks, decoys });
const e = (printed: string, ...forms: WordForm[]): WordEntry => ({ printed, forms });

export const Y4_WORDLIST: WordEntry[] = [
  e('interest', f('interest', 'I have an interest in space rockets.')),
  e('island', f('island', 'We sailed to a small island.')),
  e('knowledge', f('knowledge', 'Books give us knowledge about the world.')),
  e('learn', f('learn', 'We learn new words every day.')),
  e('length', f('length', 'Measure the length of the desk.')),
  e('library', f('library', 'I borrowed a book from the library.')),
  e('material', f('material', 'Wool is a warm material.')),
  e('medicine', f('medicine', 'Take your medicine when you feel poorly.')),
  e('mention', f('mention', 'Please do not mention my birthday gift.')),
  e('minute', f('minute', 'I will be ready in one minute.')),
  e('natural', f('natural', 'A cave is a natural home for bats.')),
  e('naughty', f('naughty', 'The puppy was naughty and chewed a shoe.')),
  e('notice', f('notice', 'Did you notice the red kite?')),
  e('occasion(ally)', f('occasion', 'Your birthday is a special occasion.'),
    f('occasionally', 'We occasionally eat out on Fridays.', ['oc', 'ca', 'sion', 'al', 'ly'], ['tion', 'ley', 'el'])),
  e('often', f('often', 'We often walk to school.')),
  e('opposite', f('opposite', 'Hot is the opposite of cold.')),
  e('ordinary', f('ordinary', 'It was an ordinary day at school.')),
  e('particular', f('particular', 'Do you have a particular book in mind?', ['par', 'tic', 'u', 'lar'], ['ler', 'tik', 'per'])),
  e('peculiar', f('peculiar', 'The cheese had a peculiar smell.')),
  e('perhaps', f('perhaps', 'We will see, perhaps it will snow tomorrow.')),
  e('popular', f('popular', 'Pizza is a popular food.')),
  e('position', f('position', 'Stand in the first position in line.')),
  e('possess(ion)', f('possess', 'I possess a very old teddy bear.'),
    f('possession', 'My teddy is my best possession.', ['pos', 'ses', 'sion'], ['poz', 'sess', 'tion'])),
  e('possible', f('possible', 'Is it possible to jump that high?')),
  e('potatoes', f('potatoes', 'We had roast potatoes for tea.')),
  e('pressure', f('pressure', 'Feel the pressure of my hand.')),
  e('probably', f('probably', 'It will probably rain this afternoon.')),
  e('promise', f('promise', 'I promise to tidy my room.')),
  e('purpose', f('purpose', 'What is the purpose of this tool?')),
  e('quarter', f('quarter', 'I ate a quarter of the pie.')),
  e('question', f('question', 'May I ask you a question?')),
  e('recent', f('recent', 'The recent storm blew down a tree.')),
  e('regular', f('regular', 'We have a regular spelling test.')),
  e('reign', f('reign', 'The queen’s reign lasted many years.')),
  e('remember', f('remember', 'Please remember to bring your PE kit.')),
  e('sentence', f('sentence', 'Start each sentence with a capital letter.')),
  e('separate', f('separate', 'Put the red pens in a separate pot.')),
  e('special', f('special', 'Today is a special day for us.')),
  e('straight', f('straight', 'Draw a straight line with a ruler.')),
  e('strange', f('strange', 'I heard a strange noise last night.')),
  e('strength', f('strength', 'A strong man has great strength.')),
  e('suppose', f('suppose', 'I suppose we could go to the park.')),
  e('surprise', f('surprise', 'The party was a lovely surprise.')),
  e('therefore', f('therefore', 'It rained, therefore we stayed in.')),
  e('though/although', f('though', 'She smiled even though she was tired.'), f('although', 'We played out although it was cold.')),
  e('thought', f('thought', 'I thought I heard a mouse.')),
  e('through', f('through', 'The train went through the tunnel.')),
  e('various', f('various', 'The shop sells various kinds of cake.')),
  e('weight', f('weight', 'Check the weight of the parcel.')),
  e('woman/women', f('woman', 'The woman waved from the bus.'), f('women', 'Two women sat on the bench.')),
];

const longest = (x: WordEntry) => Math.max(...x.forms.map(v => v.w.length));
/** Banks 1–5 (index 0–4), cut exactly as `WORDLIST_BANKS` cuts the first fifty: longest form, ties in printed order. */
export const Y4_WORDLIST_BANKS: WordEntry[][] = (() => {
  const sorted = Y4_WORDLIST.map((x, i) => ({ x, i })).sort((a, b) => longest(a.x) - longest(b.x) || a.i - b.i).map(o => o.x);
  return [0, 1, 2, 3, 4].map(b => sorted.slice(b * 10, b * 10 + 10));
})();

export const y4Wordlist: Generator = (d, rng) =>
  wordListQ(rng, pick(rng, WORDLIST_LADDER[d].flatMap(b => Y4_WORDLIST_BANKS[b - 1])), d);
