// y3-sounds (#1111): English Appendix 1, Years 3–4 — the /ɪ/ sound spelt y (myth, gym) and the /ʌ/ sound spelt ou
// (young, touch), words "learnt as needed". The child hears the word, sees it in a gap sentence and slices the right
// spelling. Every decoy is hand-written: a non-word, never a real word or a homophone, and `country` gets no decoy that
// swaps ou for u (that spells a slur — #324/#418/#443). Real look-alikes met curating live in `REAL_LOOKALIKES` if added.
import type { Generator } from './types';
import { pick } from './util';
import { spellRuleQ, type SpellRuleRow } from './spelling-rules';

export const Y_BANK: readonly SpellRuleRow[] = [
  ['myth', 'I read a Greek ___ about a hero.', ['mith', 'mieth', 'mythe']],
  ['gym', 'We play ball games in the ___.', ['gim', 'jym', 'gimm']],
  ['Egypt', 'The river Nile runs through ___.', ['Egipt', 'Eejipt', 'Egypte']],
  ['pyramid', 'A big stone ___ stands in the desert.', ['piramid', 'pyramyd', 'pirramid']],
  ['mystery', 'Who took the cake? It is a ___!', ['mistery', 'mysterie', 'misterry']],
  ['symbol', 'A heart is a ___ for love.', ['simbol', 'symbal', 'cymbol']],
  ['lyric', 'I learnt every ___ of the song.', ['lirric', 'liric', 'lyrick']],
  ['crystal', 'The ___ sparkled in the sun.', ['cristal', 'crystel', 'chrystal']],
  ['system', 'The bus ___ is very good here.', ['sistem', 'systum', 'sistum']],
  ['typical', 'It was a ___ rainy day in April.', ['tipical', 'typicle', 'tipicle']],
];
export const OU_BANK: readonly SpellRuleRow[] = [
  ['young', 'A ___ lamb stood by its mother.', ['yung', 'yong', 'younge']],
  ['touch', 'Do not ___ the hot oven.', ['tuch', 'tutch', 'toutch']],
  ['double', 'I ate a ___ scoop of ice cream.', ['dubble', 'dubbel', 'doubel']],
  ['trouble', 'He got into ___ for being late.', ['trubble', 'trubel', 'troubel']],
  ['country', 'France is a ___ in Europe.', ['countrey', 'countree', 'countery']],
  ['cousin', 'My ___ came to stay for the weekend.', ['cousen', 'cousan', 'couzin']],
  ['couple', 'A ___ of birds sat on the fence.', ['cupple', 'coupel', 'cuple']],
  ['courage', 'It takes ___ to jump off the high board.', ['curage', 'courrage', 'couradge']],
  ['nourish', 'Healthy food will ___ your body.', ['nurish', 'nourrish', 'nourich']],
  ['southern', 'Spain is in ___ Europe.', ['suthern', 'sutherne', 'southen']],
];

// #2318: the rule or memory trick for the tricky part of each word, never the bare word.
export const SOUNDS_WHY: Record<string, string> = {
  myth: 'The i sound is spelt y: m-y-th.',
  gym: 'The i sound is spelt y: g-y-m.',
  Egypt: 'The i sound is spelt y: Eg-y-pt.',
  pyramid: 'The first i sound is spelt y: p-y-ramid.',
  mystery: 'The i sound is spelt y: m-y-stery.',
  symbol: 'The i sound is spelt y: s-y-mbol.',
  lyric: 'The i sound is spelt y: l-y-ric.',
  crystal: 'The i sound is spelt y: cr-y-stal.',
  system: 'The i sound is spelt y: s-y-stem.',
  typical: 'The i sound is spelt y: t-y-pical.',
  young: 'The u sound is spelt ou: y-ou-ng.',
  touch: 'The u sound is spelt ou: t-ou-ch.',
  double: 'The u sound is spelt ou: d-ou-ble.',
  trouble: 'The u sound is spelt ou: tr-ou-ble.',
  country: 'The u sound is spelt ou: c-ou-ntry.',
  cousin: 'The u sound is spelt ou: c-ou-sin.',
  couple: 'The u sound is spelt ou: c-ou-ple.',
  courage: 'The u sound is spelt ou: c-ou-rage.',
  nourish: 'The u sound is spelt ou: n-ou-rish.',
  southern: 'The u sound is spelt ou: s-ou-thern.',
};

/** d1: ou words, 2 bubbles · d2: y words, 3 bubbles · d3: both mixed, 4 bubbles. */
export const y3Sounds: Generator = (d, rng) => {
  const row = pick(rng, d === 1 ? OU_BANK : d === 2 ? Y_BANK : [...Y_BANK, ...OU_BANK]);
  return spellRuleQ(rng, row, d + 1, SOUNDS_WHY[row[0]]);
};
