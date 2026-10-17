// y6-ough (#1274): the two Years 5–6 spelling patterns with no topic yet (English Appendix 1, p. 20): the letter-string
// ough, which spells seven sounds, and ei after c (receive, ceiling) with its three exceptions. Spelling cards show a
// sentence with a gap; every misspelling is a hand-curated non-word. d3 also asks which word rhymes with an ough word.
// Left out on purpose: thorough, borough and cough are never a rhyme target or a rhyme decoy, because their sound
// changes between accents (Appendix 1 pronunciations are Received Pronunciation).
import type { Difficulty, Generator } from './types';
import { pick, shuffle, wordQ } from './util';

export type OughGroup = 'ought' | 'rough' | 'cough' | 'though' | 'through' | 'thorough' | 'plough';
/** [word, sound group, sentence with one "_", three misspellings]. */
export type OughRow = [word: string, group: OughGroup, sentence: string, wrong: [string, string, string]];
/** [word, sentence with one "_", misspellings (the first is the ie swap), exception?]. */
export type EiRow = [word: string, sentence: string, wrong: [string, string, string], exception?: true];

export const OUGH: OughRow[] = [
  ['ought', 'ought', 'You _ to say thank you.', ['ougt', 'ourt', 'oght']],
  ['bought', 'ought', 'Mum _ some apples at the shop.', ['bort', 'bougt', 'bouht']],
  ['thought', 'ought', 'I _ of a clever plan.', ['thort', 'thougt', 'thaught']],
  ['nought', 'ought', 'A zero is also called _.', ['nort', 'nougt', 'nouht']],
  ['brought', 'ought', 'She _ her book to school.', ['brort', 'brougt', 'braught']],
  ['fought', 'ought', 'The knights _ bravely at the gate.', ['fougt', 'fawt', 'faught']],
  ['rough', 'rough', 'The sea was _ and stormy.', ['rouf', 'rugh', 'rouff']],
  ['tough', 'rough', 'The steak was very _ to chew.', ['touf', 'tugh', 'touff']],
  ['enough', 'rough', 'Is there _ milk for everyone?', ['enuff', 'enouf', 'enugh']],
  ['cough', 'cough', 'I have a bad _ and a sore throat.', ['coff', 'couf', 'cof']],
  ['though', 'though', 'It was fun, _ it was cold.', ['thow', 'thoug', 'thogh']],
  ['although', 'though', '_ it rained, we played outside.', ['althow', 'althoug', 'allthough']],
  ['dough', 'though', 'Dad rolled out the _ for the bread.', ['dow', 'doug', 'dogh']],
  ['through', 'through', 'The train went _ the tunnel.', ['throu', 'throo', 'thruogh']],
  ['thorough', 'thorough', 'The vet gave the dog a _ check.', ['thorow', 'thurough', 'thorogh']],
  ['borough', 'thorough', 'Our _ has a new library.', ['borow', 'burrough', 'borogh']],
  ['plough', 'plough', 'The farmer pulled a _ across the field.', ['plou', 'ploug', 'plogh']],
  ['bough', 'plough', 'A robin sat on the oak _.', ['bou', 'boug', 'bogh']],
];

export const EI_C: EiRow[] = [
  ['deceive', 'The fox tried to _ the hen.', ['decieve', 'deceve', 'deseive']],
  ['conceive', 'Can you _ of a world without sound?', ['concieve', 'conceve', 'conseive']],
  ['receive', 'I hope to _ a card from Gran.', ['recieve', 'receve', 'reseive']],
  ['perceive', 'Cats can _ the smallest movement.', ['percieve', 'perceve', 'perseive']],
  ['ceiling', 'A spider sat on the _.', ['cieling', 'cealing', 'seiling']],
  ['protein', 'Eggs and beans are full of _.', ['protien', 'proteen', 'protine'], true],
  ['caffeine', 'Tea has a little _ in it.', ['caffiene', 'cafeine', 'caffeen'], true],
  ['seize', 'The goalkeeper dived to _ the ball.', ['sieze', 'seeze', 'seaze'], true],
];

/** The sound groups a rhyme card may use: sounds that hold across accents (Appendix 1 p. 25), so never cough, thorough or borough. */
const RHYME = OUGH.filter(r => r[1] !== 'cough' && r[1] !== 'thorough');
const RHYME_TARGET_GROUPS: OughGroup[] = ['ought', 'rough', 'though', 'plough'];
const D1_GROUPS: OughGroup[] = ['ought', 'rough', 'through'];

const gapQ = (rng: Parameters<Generator>[1], sent: string, answer: string, decoys: string[], prompt?: string) => {
  const text = sent.replace('_', '___');
  return wordQ(rng, prompt ?? text, answer, decoys, {
    visual: { type: 'sentence', text }, say: `${sent.replace('_', 'blank')} Which spelling is right?`,
    hint: 'Which spelling fits the sentence?', hintIsData: false,
  });
};

const rhymeQ: Generator = (_d, rng) => {
  const group = pick(rng, RHYME_TARGET_GROUPS);
  const target = pick(rng, RHYME.filter(r => r[1] === group));
  const right = pick(rng, RHYME.filter(r => r[1] === group && r !== target));
  const others = shuffle(rng, RHYME.filter(r => r[1] !== group)).slice(0, 3);
  return wordQ(rng, `Which word rhymes with ${target[0]}?`, right[0], others.map(r => r[0]), {
    say: `Which word rhymes with ${target[0]}?`, hint: 'Say each word. Which one ends with the same sound?', hintIsData: false,
  });
};

export const y6Ough: Generator = (d: Difficulty, rng) => {
  if (d === 3) {
    if (rng() < 0.5) return rhymeQ(d, rng);
    const [w, s, wrong] = pick(rng, EI_C.filter(r => r[3]));
    return gapQ(rng, s, w, wrong, 'Which is spelt correctly?');
  }
  // d2 mixes the five ei-after-c words in with every ough group; the ie swap is always one of an ei card's decoys.
  if (d === 2 && rng() < 0.3) {
    const [w, s, wrong] = pick(rng, EI_C.filter(r => !r[3]));
    return gapQ(rng, s, w, [wrong[0], ...shuffle(rng, wrong.slice(1))]);
  }
  const [w, , s, wrong] = pick(rng, OUGH.filter(r => d === 2 || D1_GROUPS.includes(r[1])));
  return gapQ(rng, s, w, shuffle(rng, wrong).slice(0, d === 1 ? 2 : 3));
};
