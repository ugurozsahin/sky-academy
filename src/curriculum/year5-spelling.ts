// Year 5 spelling strand (#1177). Each slot below is a future PR's own ticket. Keep this file ≤300 lines: a generator that
// would push it past that moves to its own `year5-<slug>.ts` and this file keeps only its row/import.
import { y5Wordlist } from './year5-wordlist';
import { y5Cious } from './year5-cious';
import { y5Ant } from './year5-ant';
import { y5Able } from './year5-able';
import { y5Fer } from './year5-fer';
import { y5Silent } from './year5-silent';
import type { Topic } from './types';

export const Y5_SPELLING: Topic[] = [
  { id: 'y5-wordlist', title: 'Year 5–6 Word List (1–50)', icon: '📝', subject: 'writing', year: 'year5', nc: 'Y5–6 statutory word list, words 1–50', sequenceFrom: 1, strand: 'spelling', gen: y5Wordlist },

  { id: 'y5-cious', title: 'Endings: -cious, -tious, -cial, -tial', icon: '📝', subject: 'writing', year: 'year5', nc: 'Y5–6 spelling: endings which sound like /ʃəs/ and /ʃəl/', strand: 'spelling', gen: y5Cious },

  { id: 'y5-ant', title: 'Endings: -ant, -ance, -ent, -ence', icon: '✏️', subject: 'writing', year: 'year5', nc: 'Y5–6 spelling: words ending in -ant/-ent, -ance/-ence and -ancy/-ency', strand: 'spelling', gen: y5Ant },

  { id: 'y5-able', title: 'Endings: -able, -ible, -ably, -ibly', icon: '✏️', subject: 'writing', year: 'year5', nc: 'Y5–6 spelling: words ending in -able/-ible and -ably/-ibly', strand: 'spelling', gen: y5Able },

  { id: 'y5-fer', title: 'Adding endings to -fer words', icon: '✏️', subject: 'writing', year: 'year5', nc: 'Y5–6 spelling: adding suffixes beginning with vowel letters to words ending in -fer', strand: 'spelling', gen: y5Fer },

  { id: 'y5-silent', title: 'Silent Letters', icon: '🤫', subject: 'writing', year: 'year5', nc: 'Y5–6 spelling: words with silent letters (doubt, island, solemn)', sequenceFrom: 3, strand: 'spelling', gen: y5Silent },
];
