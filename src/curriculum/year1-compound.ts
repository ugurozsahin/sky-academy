import type { Generator } from './types';
import { pick, wordQ } from './util';

// #978: compound words (English Appendix 1, Year 1). Oracle: the answer is exactly first + second. Every decoy is
// hand-written (never built by code, #642/#324) as [parts reversed, a letter dropped at the join, a part misspelt].
export const Y1_COMPOUNDS: [string, string, string, [string, string, string]][] = [
  ['foot', 'ball', '⚽', ['ballfoot', 'footall', 'fotball']], ['bed', 'room', '🛏️', ['roombed', 'bedoom', 'bedrom']],
  ['rain', 'bow', '🌈', ['bowrain', 'rainow', 'ranbow']], ['cup', 'cake', '🧁', ['cakecup', 'cupake', 'cupcke']],
  ['sun', 'flower', '🌻', ['flowersun', 'sunlower', 'sunflowr']], ['bee', 'hive', '🐝', ['hivebee', 'beeive', 'behive']],
  ['door', 'bell', '🔔', ['belldoor', 'doorell', 'dorbell']], ['star', 'fish', '⭐', ['fishstar', 'starish', 'stafish']],
  ['rain', 'coat', '🧥', ['coatrain', 'rainoat', 'rancoat']], ['sail', 'boat', '⛵', ['boatsail', 'sailoat', 'salboat']],
  ['moon', 'light', '🌙', ['lightmoon', 'moonight', 'monlight']], ['key', 'hole', '🔑', ['holekey', 'keyole', 'keyhol']],
  ['gold', 'fish', '🐟', ['fishgold', 'goldish', 'golfish']], ['birth', 'day', '🎂', ['daybirth', 'birthay', 'birthdy']],
];
export const y1Compound: Generator = (d, rng) => {
  const [a, b, e, decoys] = pick(rng, Y1_COMPOUNDS);
  const word = a + b;
  return wordQ(rng, `${a} + ${b} = ?`, word, d === 1 ? decoys.slice(0, 2) : decoys, {
    visual: d === 3 ? undefined : { type: 'word', text: `${a} + ${b}`, emoji: e },
    say: `${a[0].toUpperCase()}${a.slice(1)} and ${b}. Which is the word ${word}, spelt right?`, hint: 'Join the two words', hintIsData: false,
  });
};
