// Year 2 statistics: read a simple table (#1021). A new module because year2/ is on the #714 ratchet; it reads
// the `y2Stats` survey bank and draws the `table` chart kind.
import type { Generator } from './types';
import { numQ, pick, ri, shuffle, wordQ } from './util';
import { SURVEYS } from './year2';
import { colourBubbles } from './colour-bubbles';

/**
 * Read a table of counts. d1 "How many chose 🐶?"; d2 adds "How many altogether?"; d3 adds "How many more" and
 * "Which did most children choose?". Counts are 1–20, each answer is worked out from the rows, and the prompt
 * and `say` never state a count. Ties are re-rolled at the same difficulty; the loop is bounded and ends
 * deterministically by raising one count.
 */
const y2StatsTableRaw: Generator = (d, rng) => {
  const survey = pick(rng, SURVEYS);
  const ask = d === 1 ? 'one' : pick(rng, d === 2 ? ['one', 'total'] : ['one', 'total', 'more', 'most']);
  const roll = () => survey.rows.map(() => ri(rng, 1, 20));
  let counts = roll();
  const [i, j] = shuffle(rng, [0, 1, 2]).slice(0, 2);
  const degenerate = () => ask === 'most'
    ? counts.filter(n => n === Math.max(...counts)).length > 1
    : ask === 'more' && counts[i] === counts[j];
  for (let tries = 0; tries < 20 && degenerate(); tries++) counts = roll();
  if (degenerate()) counts[ask === 'most' ? 0 : i] = Math.max(...counts) + 1;

  const rows = survey.rows.map(([icon, name], k) => ({ label: `${icon} ${name}`, n: counts[k] }));
  const visual = { type: 'chart' as const, kind: 'table' as const, rows, head: [survey.what[0].toUpperCase() + survey.what.slice(1), 'Children'] as [string, string] };

  // #2320: the wrong bubbles are the slips a child makes reading a table — another row's count, a row left out of the sum, the two counts added instead of subtracted.
  const sum = counts.reduce((a, b) => a + b, 0);
  if (ask === 'total') {
    return numQ(rng, 'How many children altogether?', sum, {
      distractors: counts.map(c => sum - c),
      visual, hint: 'Add up the table', hintIsData: false, say: 'Look at the table. How many children are there altogether?',
    });
  }
  if (ask === 'more') {
    const [hi, lo] = counts[i] > counts[j] ? [i, j] : [j, i];
    const [hiIcon, hiName] = survey.rows[hi], [loIcon, loName] = survey.rows[lo];
    return numQ(rng, `How many more ${hiIcon} than ${loIcon}?`, counts[hi] - counts[lo], {
      distractors: [counts[hi] + counts[lo], counts[hi], counts[lo]], max: counts[hi] + counts[lo],
      visual, say: `Look at the table. How many more children chose ${hiName} than ${loName}?`,
    });
  }
  if (ask === 'most') {
    const best = counts.indexOf(Math.max(...counts));
    return wordQ(rng, 'Which did most children choose?', survey.rows[best][1],
      survey.rows.filter((_, k) => k !== best).map(r => r[1]),
      { visual, say: 'Look at the table. Which one did most children choose?' });
  }
  const k = ri(rng, 0, survey.rows.length - 1);
  return numQ(rng, `How many chose ${survey.rows[k][0]}?`, counts[k], {
    distractors: counts.filter((_, m) => m !== k), min: 1, max: 21,
    visual, hint: 'Read the table', hintIsData: false, say: 'Look at the table. How many children chose this one?',
  });
};
export const y2StatsTable = colourBubbles(y2StatsTableRaw);   // #2301: the options are the colours
