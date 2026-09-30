// Year 2 words: spelling, contractions, suffixes, homophones, tracing. Split out of year2.ts (#1416); index.ts re-exports every name.
import { type Generator } from '../types';
import { ri, pick, shuffle, wordQ, gapLetters, gapQ, spellQ, Y1_CEW, Y2_CEW } from '../util';

// ---------- Year 2 writing ----------
export const y2Spelling: Generator = (d, rng) => {
  const w = pick(rng, Y2_CEW.filter(x => x.length <= (d === 1 ? 5 : d === 2 ? 7 : 10)));
  if (d === 3 && rng() < 0.4) return spellQ(rng, w, undefined, 3);
  const idx = ri(rng, 0, w.length - 1);
  return gapQ(rng, w, idx, gapLetters(w, idx), undefined, `Which letter is missing from the word ${w}?`);
};
const CONTRACTIONS: [string, string][] = [['do not', "don't"], ['cannot', "can't"], ['is not', "isn't"], ['I am', "I'm"], ['it is', "it's"], ['you are', "you're"], ['we will', "we'll"], ['did not', "didn't"], ['has not', "hasn't"], ['they are', "they're"], ['I will', "I'll"], ['could not', "couldn't"]];
export const y2Contractions: Generator = (d, rng) => {
  const [long, short] = pick(rng, CONTRACTIONS);
  const ds = shuffle(rng, CONTRACTIONS.filter(c => c[1] !== short)).slice(0, d === 1 ? 2 : 3).map(c => c[1]);
  if (d === 3 && rng() < 0.5) return wordQ(rng, short, long, shuffle(rng, CONTRACTIONS.filter(c => c[0] !== long)).slice(0, 3).map(c => c[0]), { visual: { type: 'word', text: short }, say: `What does ${short} mean?` });
  return wordQ(rng, long, short, ds, { visual: { type: 'word', text: long }, say: `Which contraction means ${long}?`, hint: 'Slice the short form', hintIsData: false });
};
const SUFFIX2: [string, string, string][] = [['care', 'ful', 'Be care___ on the road.'], ['hope', 'less', 'The lost sock was hope___.'], ['kind', 'ness', 'Show kind___ to others.'], ['slow', 'ly', 'The snail moved slow___.'], ['enjoy', 'ment', 'We had lots of enjoy___.'], ['help', 'ful', 'A very help___ friend.'], ['quick', 'ly', 'She ran quick___.'], ['sad', 'ness', 'He felt great sad___.'], ['fear', 'less', 'The fear___ ninja jumped.'], ['pay', 'ment', 'Mum made the pay___.']];
export const y2Suffix: Generator = (d, rng) => {
  const [, suf, sent] = pick(rng, SUFFIX2);
  return wordQ(rng, sent, suf, ['ful', 'less', 'ness', 'ly', 'ment'].filter(x => x !== suf).slice(0, d === 1 ? 2 : 3), { visual: { type: 'sentence', text: sent }, say: sent.replace('___', 'blank'), hint: 'Slice the ending', hintIsData: false });
};
/**
 * Endings that change the root (#299 slice 3, NC English Appendix 1 Year 2): `[root, ending, the new word,
 * rule, the two spellings a child actually writes instead]`. `y1-suffix` and `y2-suffix` are the no-change
 * case — `jump` + `ing`, `care` + `ful` — so **every entry here must change the root**, which is the one
 * thing this topic teaches and a rail holds it to.
 *
 * The two wrong spellings are the rule left unapplied (`hopeing`) and a rule applied that does not belong to
 * this word (`hopping` for `hope`, `happyier` for `happy`) — never a different ending: the card asks which
 * spelling is right, not which ending fits, and `y1-suffix` already asks the other question. Two is the whole
 * set of mistakes the rule admits, so these cards run on three bubbles rather than four.
 */
type SuffixRule = 'drop-e' | 'double' | 'y-to-i';
export const SUFFIX_ROOT: ReadonlyArray<readonly [string, string, string, SuffixRule, string, string]> = [
  // drop the e: hope → hoping
  ['hope', 'ing', 'hoping', 'drop-e', 'hopeing', 'hopping'], ['make', 'ing', 'making', 'drop-e', 'makeing', 'makking'],
  ['ride', 'ing', 'riding', 'drop-e', 'rideing', 'ridding'], ['smile', 'ed', 'smiled', 'drop-e', 'smileed', 'smilled'],
  ['bake', 'ed', 'baked', 'drop-e', 'bakeed', 'bakked'], ['close', 'ing', 'closing', 'drop-e', 'closeing', 'clossing'],
  ['wave', 'ed', 'waved', 'drop-e', 'waveed', 'wavved'], ['nice', 'er', 'nicer', 'drop-e', 'niceer', 'nicier'],
  ['late', 'er', 'later', 'drop-e', 'lateer', 'latter'],
  // double the last letter: hop → hopping
  ['hop', 'ing', 'hopping', 'double', 'hoping', 'hopeing'], ['run', 'ing', 'running', 'double', 'runing', 'runeing'],
  ['sit', 'ing', 'sitting', 'double', 'siting', 'siteing'], ['swim', 'ing', 'swimming', 'double', 'swiming', 'swimeing'],
  ['pat', 'ed', 'patted', 'double', 'pated', 'pateed'], ['stop', 'ed', 'stopped', 'double', 'stoped', 'stopeed'],
  ['big', 'er', 'bigger', 'double', 'biger', 'bigier'], ['sad', 'est', 'saddest', 'double', 'sadest', 'sadiest'],
  ['hot', 'est', 'hottest', 'double', 'hotest', 'hotiest'],
  // y becomes i: happy → happier
  ['happy', 'er', 'happier', 'y-to-i', 'happyer', 'happyier'], ['baby', 'es', 'babies', 'y-to-i', 'babyes', 'babys'],
  ['carry', 'ed', 'carried', 'y-to-i', 'carryed', 'carryied'], ['funny', 'est', 'funniest', 'y-to-i', 'funnyest', 'funnyiest'],
  ['cry', 'es', 'cries', 'y-to-i', 'cryes', 'crys'], ['try', 'ed', 'tried', 'y-to-i', 'tryed', 'tryied'],
  ['easy', 'er', 'easier', 'y-to-i', 'easyer', 'easyier'], ['silly', 'est', 'silliest', 'y-to-i', 'sillyest', 'sillyiest'],
  ['party', 'es', 'parties', 'y-to-i', 'partyes', 'partys'],
];
/** d1 is the rule you can see (an `e` disappears); d2 adds doubling; d3 adds `y → i`, which changes a letter inside the word. */
const SUFFIX_RULES: Record<number, SuffixRule[]> = { 1: ['drop-e'], 2: ['drop-e', 'double'], 3: ['drop-e', 'double', 'y-to-i'] };
export const y2SuffixRoot: Generator = (d, rng) => {
  const rules = SUFFIX_RULES[d] ?? SUFFIX_RULES[3];
  const [root, suf, ans, , naive, misrule] = pick(rng, SUFFIX_ROOT.filter(e => rules.includes(e[3])));
  return wordQ(rng, `${root} + ${suf} = ?`, ans, [naive, misrule], {
    visual: { type: 'word', text: `${root} + ${suf}` },
    say: `Add ${suf} to ${root}. Which spelling is right?`, hint: 'The root word changes', hintIsData: false,
  });
};
/**
 * Sound-alike words: [sentence with a gap, the options (answer first), answer]. Every option set is one of
 * `HOMOPHONE_SETS` — the Year 2 statutory pairs (NC English Appendix 1) plus `piece/peace` from Year 3–4 — and
 * a rail holds it there: `on/won`, `brown/brawn` and `wind/wined` were not homophones at all (#296).
 * Exported for that rail.
 */
export const HOMOPHONE_SETS: ReadonlyArray<readonly string[]> = [['to', 'too', 'two'], ['their', 'there', "they're"], ['see', 'sea'], ['sun', 'son'], ['one', 'won'], ['here', 'hear'], ['piece', 'peace'], ['bare', 'bear'], ['blue', 'blew'], ['night', 'knight'], ['be', 'bee'], ['quite', 'quiet']];
export const HOMOPHONES: ReadonlyArray<readonly [string, readonly string[], string]> = [['I want ___ go home.', ['to', 'too', 'two'], 'to'], ['I have ___ cats.', ['two', 'to', 'too'], 'two'], ['Me ___!', ['too', 'to', 'two'], 'too'], ['___ house is big.', ['Their', 'There', "They're"], 'Their'], ['Look over ___!', ['there', 'their', "they're"], 'there'], ['___ going out.', ["They're", 'Their', 'There'], "They're"], ['I can ___ the sea.', ['see', 'sea'], 'see'], ['The ___ shines.', ['sun', 'son'], 'sun'], ['It is ___ o\'clock.', ['one', 'won'], 'one'], ['We ___ the race!', ['won', 'one'], 'won'], ['The ___ ate the honey.', ['bear', 'bare'], 'bear'], ['The wind ___ my hat off.', ['blew', 'blue'], 'blew'], ['___ is a bird.', ['Here', 'Hear'], 'Here'], ['I can ___ you.', ['hear', 'here'], 'hear'], ['A ___ of bread.', ['piece', 'peace'], 'piece'], ['The ___ rode a horse.', ['knight', 'night'], 'knight'], ['A ___ makes honey.', ['bee', 'be'], 'bee'], ['Please be ___ in the library.', ['quiet', 'quite'], 'quiet']];
export const y2Homophones: Generator = (_d, rng) => {
  const [sent, opts, ans] = pick(rng, HOMOPHONES);
  return wordQ(rng, sent, ans, opts.filter(o => o !== ans), { visual: { type: 'sentence', text: sent }, say: sent.replace('___', 'blank'), hint: 'Slice the right word', hintIsData: false });
};
export const y2Trace: Generator = (d, rng) => {
  const w = pick(rng, d === 1 ? Y1_CEW.filter(x => x.length >= 2 && x.length <= 4) : Y2_CEW.filter(x => x.length <= (d === 2 ? 5 : 7)));
  return { prompt: `Trace: ${w}`, say: `Trace the word ${w}`, answer: w, options: [w], visual: { type: 'word', text: w } };
};
