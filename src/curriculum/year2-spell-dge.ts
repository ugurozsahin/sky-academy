// y2-spell-dge (#1011): the /dʒ/ sound of English Appendix 1, Year 2 — badge, cage, giant. The child hears the word,
// sees it in a gap sentence and slices the right spelling; every wrong bubble is an invented non-word, and the
// end-of-word cards always carry the -j spelling the guidance says is never used there.
//
// Real look-alikes met while curating (`REAL_LOOKALIKES`): `doge` (dodge) and `cadge` (cage). "ledge" is left out
// as `lege` is too close to `leg`; a decoy is never a real word (`GAP_WORDS`, `AVOID`, `HOMOPHONE_SETS`) either.
import type { Generator } from './types';
import { pick } from './util';
import { spellRuleQ, type SpellRuleRow } from './spelling-rules';

export const DGE_BANK: readonly SpellRuleRow[] = [
  ['badge', 'She pinned a gold ___ on her coat.', ['bage', 'badj', 'badg']],
  ['edge', 'Do not stand on the ___ of the cliff.', ['ege', 'ej', 'edg']],
  ['bridge', 'We crossed the ___ over the river.', ['brige', 'bridj', 'bridg']],
  ['fudge', 'Gran made some sweet ___ for tea.', ['fuje', 'fudj', 'fudg']],
  ['hedge', 'A bird sang in the ___.', ['hege', 'hedj', 'hedg']],
  ['dodge', 'Try to ___ the ball when it comes.', ['dodje', 'dodj', 'dodg']],
];
export const GE_BANK: readonly SpellRuleRow[] = [
  ['age', 'What is your ___ now?', ['aje', 'adge', 'aj']],
  ['huge', 'An elephant is a ___ animal.', ['huje', 'hudge', 'huj']],
  ['cage', 'The bird sat in its ___.', ['caje', 'caj', 'cadg']],
  ['change', 'I have a coin to ___ for a bus fare.', ['chanje', 'chandge', 'chanj']],
  ['charge', 'Plug in the tablet to ___ it.', ['charje', 'chardge', 'charj']],
  ['stage', 'The class sang on the ___.', ['staje', 'stadge', 'staj']],
];
export const G_BANK: readonly SpellRuleRow[] = [
  ['gem', 'The ring had a red ___ in it.', ['jem', 'jeme', 'gemm']],
  ['giant', 'The ___ in the story was very tall.', ['jiant', 'jyant', 'giyant']],
  ['magic', 'The wizard did a ___ trick.', ['majic', 'majyc', 'magyc']],
  ['giraffe', 'A ___ has a very long neck.', ['jiraffe', 'jyraffe', 'giraff']],
  ['energy', 'Running uses a lot of ___.', ['enerjy', 'enerjee', 'enerdgy']],
];

/** d1: -dge · d2: adds -ge · d3: adds g before e, i and y; 3 bubbles at every stage. */
export const y2SpellDge: Generator = (d, rng) =>
  spellRuleQ(rng, pick(rng, d === 1 ? DGE_BANK : d === 2 ? [...DGE_BANK, ...GE_BANK] : [...DGE_BANK, ...GE_BANK, ...G_BANK]), 3);
