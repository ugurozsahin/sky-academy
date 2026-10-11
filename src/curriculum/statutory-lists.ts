// The statutory spelling lists (#1289), one word per entry as English Appendix 1 prints them: the entry's first form,
// which is what a card's `listWord` carries. Kept out of spelling-ks2.ts, which every bank imports (a cycle otherwise).
import { Y3_WORDLIST } from './wordlist-y3';
import { Y4_WORDLIST } from './wordlist-y4';
import { Y5_WORDLIST } from './year5-wordlist';
import { Y6_WORDLIST } from './wordlist-y6';
import type { WordEntry } from './spelling-ks2';

export interface StatutoryList { id: 'y34' | 'y56'; title: string; words: string[] }
const firsts = (...banks: WordEntry[][]) => banks.flat().map(x => x.forms[0].w);

export const STATUTORY_LISTS: StatutoryList[] = [
  { id: 'y34', title: 'Year 3–4', words: firsts(Y3_WORDLIST, Y4_WORDLIST) },
  { id: 'y56', title: 'Year 5–6', words: firsts(Y5_WORDLIST, Y6_WORDLIST) },
];
