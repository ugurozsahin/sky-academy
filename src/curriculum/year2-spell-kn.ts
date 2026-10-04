// y2-spell-kn (#1009): the silent first letters of English Appendix 1, Year 2 — /n/ spelt kn (less often gn) and
// /r/ spelt wr at the beginning of words. The child hears the word, sees it in a gap sentence and slices the
// right spelling; every wrong bubble is an invented non-word.
//
// Left out on purpose, because the word has a common homophone and a card saying it would have two right
// answers: know/no, knew/new, knight/night, knot/not, knit/nit, knows/nose, gnaw/nor, write/right/rite,
// wrote/rote, wrap/rap, wring/ring. A decoy is never a real word either (`REAL_LOOKALIKES`, `GAP_WORDS`,
// `AVOID`, `HOMOPHONE_SETS`) — nock, nee, nome, wrung… are real, so they are not offered.
import type { Generator } from './types';
import { pick } from './util';
import { spellRuleQ, type SpellRuleRow } from './spelling-rules';

export const KN_BANK: readonly SpellRuleRow[] = [
  ['knee', 'I hurt my ___ when I fell.', ['kne', 'knea', 'gnee']],
  ['knock', 'Please ___ on the door.', ['knok', 'knoc', 'nok']],
  ['knife', 'Be careful with the sharp ___.', ['knif', 'nife', 'kniffe']],
  ['kneel', 'We ___ down to look at the ants.', ['kneal', 'kneil', 'nele']],
  ['knuckle', 'He bumped his ___ on the wall.', ['nuckle', 'knukle', 'knuckel']],
];
export const WR_BANK: readonly SpellRuleRow[] = [
  ['wrong', 'That answer is ___.', ['rong', 'wrog', 'wronge']],
  ['wrist', 'My watch goes on my ___.', ['rist', 'wrisst', 'wriste']],
  ['wren', 'A tiny ___ sang in the bush.', ['wern', 'rhen', 'wrenn']],
  ['wriggle', 'The worm began to ___ and squirm.', ['riggle', 'wrigle', 'wrigel']],
  ['wrinkle', 'There is a ___ in my sock.', ['rinkle', 'wrinkel', 'wrinckle']],
];
export const GN_BANK: readonly SpellRuleRow[] = [
  ['gnat', 'A tiny ___ buzzed past my ear.', ['gnatt', 'knat', 'gnaat']],
  ['gnome', 'The garden ___ wore a red hat.', ['gnom', 'gnoam', 'knome']],
];

/** d1: kn, 3 bubbles · d2: adds wr, 4 bubbles · d3: adds gn, 4 bubbles. */
export const y2SpellKn: Generator = (d, rng) =>
  spellRuleQ(rng, pick(rng, d === 1 ? KN_BANK : d === 2 ? [...KN_BANK, ...WR_BANK] : [...KN_BANK, ...WR_BANK, ...GN_BANK]), d === 1 ? 3 : 4);
