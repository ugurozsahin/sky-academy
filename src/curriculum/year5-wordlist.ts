// y5-wordlist (#1217): words 1–50 of the Year 5–6 statutory list, exactly as English Appendix 1 p.23 prints them
// (`accommodate` … `hindrance`). Same cards as y3-wordlist: `wordListQ`/`chunkQ` build them, only the bank differs.
import type { Generator } from './types';
import { pick } from './util';
import { wordListQ } from './spelling-ks2';
import type { WordEntry, WordForm } from './spelling-ks2';
import { WORDLIST_LADDER } from './wordlist-y3';

const f = (w: string, s: string, chunks?: string[], decoys?: string[]): WordForm => ({ w, s, chunks, decoys });
const e = (printed: string, ...forms: WordForm[]): WordEntry => ({ printed, forms });
/** A single-form entry; a word of 10+ letters passes its chunks and two decoy chunks. */
const w = (word: string, s: string, chunks?: string[], decoys?: string[]) => e(word, f(word, s, chunks, decoys));

export const Y5_WORDLIST: WordEntry[] = [
  w('accommodate', 'The hotel can accommodate forty guests.', ['ac', 'com', 'mo', 'date'], ['ak', 'dat']),
  w('accompany', 'May I accompany you to the park?'),
  w('according', 'We chose a path according to the map.'),
  w('achieve', 'Work hard and you can achieve your goal.'),
  w('aggressive', 'The goose was aggressive towards us.', ['ag', 'gres', 'sive'], ['gre', 'siv']),
  w('amateur', 'My uncle is an amateur chef.'),
  w('ancient', 'We saw an ancient castle on the hill.'),
  w('apparent', 'It was apparent that the milk had gone off.'),
  w('appreciate', 'I appreciate your help with my bag.', ['ap', 'pre', 'ci', 'ate'], ['pri', 'cee']),
  w('attached', 'The label is attached to the box.'),
  w('available', 'Is a seat available on the bus?'),
  w('average', 'The average height of the class is 140 cm.'),
  w('awkward', 'The box was an awkward shape to carry.'),
  w('bargain', 'The coat was a bargain at half price.'),
  w('bruise', 'I have a bruise on my knee.'),
  w('category', 'Sort the books into each category.'),
  w('cemetery', 'The cemetery is behind the old church.'),
  w('committee', 'The school committee meets on Monday.'),
  w('communicate', 'Bees communicate by dancing.', ['com', 'mu', 'ni', 'cate'], ['ko', 'kate']),
  w('community', 'Our community holds a fair each summer.'),
  w('competition', 'She won first prize in the competition.', ['com', 'pe', 'ti', 'tion'], ['pi', 'shon']),
  w('conscience', 'My conscience told me to say sorry.', ['con', 'sci', 'ence'], ['si', 'ents']),
  w('conscious', 'The patient was conscious after the operation.'),
  w('controversy', 'The new rule caused a controversy.', ['con', 'tro', 'ver', 'sy'], ['cy', 'vur']),
  w('convenience', 'A shop nearby is a great convenience.', ['con', 'ven', 'i', 'ence'], ['ance', 'vin']),
  w('correspond', 'Pen friends correspond by letter.', ['cor', 'res', 'pond'], ['co', 'pon']),
  w('criticise', 'It is unkind to criticise a friend’s drawing.'),
  w('curiosity', 'Her curiosity led the cat into the shed.'),
  w('definite', 'Is that a definite yes?'),
  w('desperate', 'The lost dog was desperate for food.'),
  w('determined', 'She was determined to finish the race.', ['de', 'ter', 'min', 'ed'], ['mind', 'mine']),
  w('develop', 'Seeds develop into strong plants.'),
  w('dictionary', 'Look up the word in a dictionary.', ['dic', 'tion', 'ary'], ['ery', 'shon']),
  w('disastrous', 'The storm was disastrous for the farm.', ['dis', 'as', 'tr', 'ous'], ['ter', 'tor']),
  w('embarrass', 'Please do not embarrass me in front of friends.'),
  w('environment', 'We must look after our environment.', ['en', 'vi', 'ron', 'ment'], ['ro', 'mant']),
  w('equip', 'We equip the boat with life jackets.'),
  w('especially', 'I love fruit, especially strawberries.', ['es', 'pe', 'cial', 'ly'], ['ex', 'shal']),
  w('exaggerate', 'Do not exaggerate how big the fish was.', ['ex', 'ag', 'ger', 'ate'], ['a', 'gur']),
  w('excellent', 'You did an excellent job on the poster.'),
  w('existence', 'The existence of dinosaurs is proven by fossils.'),
  w('explanation', 'Give me an explanation for the mess.', ['ex', 'pla', 'na', 'tion'], ['plai', 'shon']),
  w('familiar', 'That tune sounds familiar to me.'),
  w('foreign', 'She speaks a foreign language at home.'),
  w('forty', 'There are forty pages in my book.'),
  w('frequently', 'We frequently visit our gran.', ['fre', 'qu', 'ent', 'ly'], ['ant', 'free']),
  w('government', 'The government makes new laws.', ['gov', 'ern', 'ment'], ['er', 'guv']),
  w('guarantee', 'The shop will guarantee the toy for a year.'),
  w('harass', 'Bullies harass other children.'),
  w('hindrance', 'Snow is a hindrance to drivers.'),
];

const longest = (x: WordEntry) => Math.max(...x.forms.map(v => v.w.length));
/** Banks A–E (index 0–4), cut exactly as `WORDLIST_BANKS` cuts the Year 3–4 list: longest form, ties in printed order. */
export const Y5_WORDLIST_BANKS: WordEntry[][] = (() => {
  const sorted = Y5_WORDLIST.map((x, i) => ({ x, i })).sort((a, b) => longest(a.x) - longest(b.x) || a.i - b.i).map(o => o.x);
  return [0, 1, 2, 3, 4].map(b => sorted.slice(b * 10, b * 10 + 10));
})();

export const y5Wordlist: Generator = (d, rng) =>
  wordListQ(rng, pick(rng, WORDLIST_LADDER[d].flatMap(b => Y5_WORDLIST_BANKS[b - 1])), d);
