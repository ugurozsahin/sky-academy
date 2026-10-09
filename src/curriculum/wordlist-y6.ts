// y6-wordlist (#1236): words 51–100 of the Year 5–6 statutory list, exactly as English Appendix 1 p.23 prints them
// (`identity` … `yacht`; `immediate(ly)` and `sincere(ly)` are banked as the longer form). Same cards as y3-wordlist:
// `wordListQ`/`chunkQ` build them, only the bank differs. Words 1–50 are y5-wordlist's.
import type { Generator } from './types';
import { pick } from './util';
import { wordListQ } from './spelling-ks2';
import type { WordEntry } from './spelling-ks2';
import { WORDLIST_LADDER } from './wordlist-y3';

/** A single-form entry; a word of 10+ letters passes its chunks and two decoy chunks. */
const w = (word: string, s: string, chunks?: string[], decoys?: string[], printed = word): WordEntry =>
  ({ printed, forms: [{ w: word, s, chunks, decoys }] });

export const Y6_WORDLIST: WordEntry[] = [
  w('identity', 'Show your identity card at the door.'),
  w('immediately', 'Come here immediately, please.', ['im', 'me', 'di', 'ate', 'ly'], ['tly', 'ime'], 'immediate(ly)'),
  w('individual', 'Each individual got a small prize.', ['in', 'di', 'vid', 'u', 'al'], ['dule', 'de']),
  w('interfere', 'Please do not interfere with my game.'),
  w('interrupt', 'It is rude to interrupt when I talk.'),
  w('language', 'She speaks a second language at home.'),
  w('leisure', 'I read in my leisure time.'),
  w('lightning', 'We saw lightning over the hills.'),
  w('marvellous', 'What a marvellous painting you made!', ['mar', 'vel', 'lous'], ['lus', 'ous']),
  w('mischievous', 'The mischievous kitten hid my sock.', ['mis', 'chie', 'vous'], ['ious', 'chi']),
  w('muscle', 'Exercise makes each muscle stronger.'),
  w('necessary', 'Is a coat necessary in the rain?'),
  w('neighbour', 'Our neighbour feeds the cat for us.'),
  w('nuisance', 'The buzzing fly was a nuisance.'),
  w('occupy', 'A toy bear can occupy him for hours.'),
  w('occur', 'Rain can occur in any season.'),
  w('opportunity', 'This is a great opportunity to swim.', ['op', 'por', 'tu', 'ni', 'ty'], ['per', 'o']),
  w('parliament', 'The parliament meets in London.', ['par', 'lia', 'ment'], ['la', 'le']),
  w('persuade', 'Can you persuade Dad to bake a cake?'),
  w('physical', 'Running is good physical exercise.'),
  w('prejudice', 'We must not show prejudice to anyone.'),
  w('privilege', 'It is a privilege to meet the queen.'),
  w('profession', 'My aunt has a caring profession.', ['pro', 'fes', 'sion'], ['prof', 'fe']),
  w('programme', 'We watched a funny programme on TV.'),
  w('pronunciation', 'Her pronunciation of French is clear.', ['pro', 'nun', 'ci', 'a', 'tion'], ['noun', 'si']),
  w('queue', 'We stood in a long queue for ice cream.'),
  w('recognise', 'Did you recognise my old teacher?'),
  w('recommend', 'I recommend the soup at lunch.'),
  w('relevant', 'Only add facts that are relevant.'),
  w('restaurant', 'We ate pasta at the restaurant.', ['res', 'tau', 'rant'], ['rent', 'tor']),
  w('rhyme', 'Can you think of a word to rhyme with cat?'),
  w('rhythm', 'Clap along to the rhythm of the song.'),
  w('sacrifice', 'Heroes sometimes make a sacrifice.'),
  w('secretary', 'The secretary answered the phone.'),
  w('shoulder', 'The parrot sat on her shoulder.'),
  w('signature', 'Write your signature at the bottom.'),
  w('sincerely', 'She sincerely hopes you feel better.', undefined, undefined, 'sincere(ly)'),
  w('soldier', 'The soldier stood very still.'),
  w('stomach', 'My stomach rumbled before lunch.'),
  w('sufficient', 'One slice is sufficient for me.', ['suf', 'fi', 'ci', 'ent'], ['shen', 'su']),
  w('suggest', 'I suggest we go for a walk.'),
  w('symbol', 'A heart is a symbol of love.'),
  w('system', 'The bus system runs every ten minutes.'),
  w('temperature', 'The temperature dropped overnight.', ['tem', 'per', 'a', 'ture'], ['pra', 'tur']),
  w('thorough', 'Give the floor a thorough sweep.'),
  w('twelfth', 'December is the twelfth month.'),
  w('variety', 'The shop sells a variety of cheese.'),
  w('vegetable', 'Carrot is my favourite vegetable.'),
  w('vehicle', 'A bus is a large vehicle.'),
  w('yacht', 'The yacht sailed across the bay.'),
];

const longest = (x: WordEntry) => Math.max(...x.forms.map(v => v.w.length));
/** Banks 1–5 (index 0–4), cut exactly as `WORDLIST_BANKS` cuts the Year 3–4 list: longest form, ties in printed order. */
export const Y6_WORDLIST_BANKS: WordEntry[][] = (() => {
  const sorted = Y6_WORDLIST.map((x, i) => ({ x, i })).sort((a, b) => longest(a.x) - longest(b.x) || a.i - b.i).map(o => o.x);
  return [0, 1, 2, 3, 4].map(b => sorted.slice(b * 10, b * 10 + 10));
})();

export const y6Wordlist: Generator = (d, rng) =>
  wordListQ(rng, pick(rng, WORDLIST_LADDER[d].flatMap(b => Y6_WORDLIST_BANKS[b - 1])), d);
