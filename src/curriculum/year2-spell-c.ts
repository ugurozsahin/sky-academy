// y2-spell-c (#1012): the /s/ sound spelt c before e, i and y, from English Appendix 1, Year 2 — race, city, fancy. The
// child hears the word, sees it in a gap sentence and slices the spelling with the right letter; every wrong
// bubble is an invented non-word that spells the /s/ with s, ss or sc instead.
//
// Left out on purpose: cell, cent, cite, ceiling and cellar each sound exactly like a real word (sell, sent, site,
// sealing, seller), and rice and dance have decoys that are real words (rise, danse). A card with two right
// answers is no card, so only words without a homophone are banked.
import type { Generator } from './types';
import { pick } from './util';
import { spellRuleQ, type SpellRuleRow } from './spelling-rules';

export const CE_BANK: readonly SpellRuleRow[] = [
  ['race', 'We ran a ___ at sports day.', ['rase', 'raice', 'rasce']],
  ['ice', 'The pond is covered in ___.', ['ise', 'iss', 'isce']],
  ['face', 'She drew a smile on his ___.', ['fase', 'faice', 'fasce']],
  ['place', 'Find a quiet ___ to sit down.', ['plase', 'plaise', 'plasce']],
  ['space', 'The rocket flew into ___.', ['spase', 'spaise', 'spasce']],
];
export const CI_BANK: readonly SpellRuleRow[] = [
  ['city', 'London is a big ___.', ['sity', 'ssity', 'scity']],
  ['circle', 'Draw a ___ with your compass.', ['sircle', 'ssircle', 'scircle']],
  ['pencil', 'I wrote my name with a ___.', ['pensil', 'penssil', 'penscil']],
  ['cinema', 'We watched a film at the ___.', ['sinema', 'ssinema', 'scinema']],
];
export const CY_BANK: readonly SpellRuleRow[] = [
  ['fancy', 'She wore a ___ dress to the party.', ['fansy', 'fanssy', 'fanscy']],
  ['icy', 'The path was slippery and ___.', ['isy', 'issy', 'iscy']],
  ['cycle', 'Dad likes to ___ to work.', ['sycle', 'ssycle', 'scycle']],
  ['spicy', 'The curry was hot and ___.', ['spisy', 'spicey', 'spiscy']],
];

/** d1: c before e, 3 bubbles · d2: adds c before i, 4 bubbles · d3: adds c before y, 4 bubbles. */
export const y2SpellC: Generator = (d, rng) =>
  spellRuleQ(rng, pick(rng, d === 1 ? CE_BANK : d === 2 ? [...CE_BANK, ...CI_BANK] : [...CE_BANK, ...CI_BANK, ...CY_BANK]), d === 1 ? 3 : 4);
