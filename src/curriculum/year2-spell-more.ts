// y2-spell-more (#1014): the rest of English Appendix 1, Year 2's spelling rules, pp.8–9 — a before l, o for /ʌ/,
// -ey, a after w and qu, or and ar after w, s for /ʒ/. The child hears the word, sees it in a gap sentence and
// slices the right spelling; every wrong bubble is an invented non-word that spells the sound the way it is heard.
//
// Left out as answers on purpose, because each has a common homophone or a real look-alike: ball (bawl), all (awl),
// key (quay), talk (torque in a non-rhotic accent), war (wore). Real look-alikes met while curating (wont for want,
// wonder for wander, worm for warm, worn for warn…) are in `REAL_LOOKALIKES`, so a decoy is never one of them.
import type { Generator } from './types';
import { pick } from './util';
import { spellRuleQ, type SpellRuleRow } from './spelling-rules';

/** d1: a before l. */
export const A_BEFORE_L: readonly SpellRuleRow[] = [
  ['walk', 'We ___ to school every day.', ['wawk', 'worlk', 'wock']],
  ['chalk', 'The teacher wrote with ___ on the board.', ['chawk', 'chork', 'chaulk']],
  ['small', 'An ant is very ___.', ['smawl', 'smorl', 'smaul']],
  ['fall', 'Leaves ___ from the trees in autumn.', ['fawl', 'forl', 'faul']],
];
/** d1: o for /ʌ/. */
export const O_FOR_UH: readonly SpellRuleRow[] = [
  ['mother', 'My ___ reads me a story at bedtime.', ['muther', 'mutha', 'mothur']],
  ['brother', 'My little ___ plays with me.', ['bruther', 'brutha', 'brothur']],
  ['nothing', 'There was ___ left in the box.', ['nuthing', 'nuthin', 'nothin']],
  ['month', 'July is the seventh ___ of the year.', ['munth', 'munnth', 'monthe']],
];
/** d2: -ey. */
export const EY: readonly SpellRuleRow[] = [
  ['donkey', 'The ___ carried the bags up the hill.', ['donkee', 'donky', 'donkie']],
  ['monkey', 'The ___ swung from branch to branch.', ['monkee', 'monky', 'monkie']],
  ['chimney', 'Smoke came out of the ___.', ['chimnee', 'chimny', 'chimnie']],
  ['valley', 'A river ran through the ___.', ['vallee', 'vally', 'vallie']],
];
/** d2: a after w and qu. */
export const A_AFTER_W: readonly SpellRuleRow[] = [
  ['want', 'I ___ a drink of water.', ['wunt', 'wawnt', 'wonnt']],
  ['watch', 'I like to ___ the birds in the garden.', ['wotch', 'wotche', 'wach']],
  ['wander', 'Do not ___ off in the park.', ['wondar', 'wonnder', 'wondur']],
  ['squash', 'Do not ___ the soft peach.', ['skwosh', 'squosh', 'skwash']],
];
/** d3: or after w, ar after w. */
export const W_OR_AR: readonly SpellRuleRow[] = [
  ['word', 'Can you read this ___?', ['wurd', 'werd', 'wirrd']],
  ['work', 'Dad goes to ___ on the bus.', ['wurk', 'werk', 'wirk']],
  ['world', 'The ___ is a big round planet.', ['wurld', 'werld', 'wirld']],
  ['warm', 'The sun made the sand ___.', ['wawm', 'woarm', 'waurm']],
  ['warn', 'The sign will ___ you about the ice.', ['wawn', 'woarn', 'waurn']],
  ['swarm', 'A ___ of bees flew past.', ['swawm', 'swoarm', 'swaurm']],
];
/** d3: s for /ʒ/. */
export const S_FOR_ZH: readonly SpellRuleRow[] = [
  ['treasure', 'The pirates buried the ___.', ['trezure', 'trezher', 'treazure']],
  ['measure', 'Use a ruler to ___ the pencil.', ['mezure', 'mezher', 'meazure']],
  ['pleasure', 'It was a ___ to meet you.', ['plejure', 'pleshure', 'pleazure']],
  ['television', 'We watched a film on the ___.', ['televijon', 'televizion', 'televigion']],
  ['usual', 'I woke up at the ___ time.', ['yoozhual', 'yuzual', 'youzual']],
];

/** Every bank with the difficulty it first appears at, for the rule-by-rule tests. */
export const BANKS = { A_BEFORE_L: 1, O_FOR_UH: 1, EY: 2, A_AFTER_W: 2, W_OR_AR: 3, S_FOR_ZH: 3 } as const;

/** d1: a before l and o for /ʌ/, 3 bubbles · d2: adds -ey and a after w/qu, 4 bubbles · d3: adds or/ar after w and s for /ʒ/. */
export const y2SpellMore: Generator = (d, rng) => {
  const rows = [...A_BEFORE_L, ...O_FOR_UH, ...(d >= 2 ? [...EY, ...A_AFTER_W] : []), ...(d >= 3 ? [...W_OR_AR, ...S_FOR_ZH] : [])];
  const row = pick(rng, rows);
  return spellRuleQ(rng, d === 1 ? [row[0], row[1], row[2].slice(0, 2)] : row, d === 1 ? 3 : 4);
};
