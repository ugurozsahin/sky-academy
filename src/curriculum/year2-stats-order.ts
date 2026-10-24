// Year 2 statistics: sort the categories of a chart by quantity (#1006). A new module because year2/ is on the
// #714 ratchet; it reads the `y2Stats` survey bank and draws the same three chart kinds.
import type { Generator, Question } from './types';
import { pick, ri, shuffle } from './util';
import { SURVEYS } from './year2';

/** Same neutral pictogram symbol as `y2Stats`: it claims to be none of the categories. */
const PICTO_SYMBOL = '⭐';

/**
 * Read a chart, then slice its categories from most to least: tally (d1), pictogram with a key of 2 or 5 (d2),
 * block diagram (d3). The prompt and `say` never state a count. Counts are re-rolled until all three differ,
 * at the difficulty asked for; the loop is bounded and ends deterministically by spacing the counts out.
 */
export const y2StatsOrder: Generator = (d, rng) => {
  const survey = pick(rng, SURVEYS);
  const kind = d === 1 ? 'tally' : d === 2 ? 'pictogram' : 'block';
  const step = kind === 'pictogram' ? pick(rng, [2, 5]) : 1;
  // A tally reads 5 to 10 (#2281): below five there is no five-bar gate, so it is Reception counting.
  const lo = kind === 'tally' ? 5 : 1;
  const roll = () => survey.rows.map(() => ri(rng, lo, kind === 'block' ? 9 : kind === 'tally' ? 10 : 6) * step);
  const tied = (c: number[]) => new Set(c).size < c.length;

  let counts = roll();
  for (let tries = 0; tries < 20 && tied(counts); tries++) counts = roll();
  if (tied(counts)) counts = survey.rows.map((_, k) => (k + lo) * step);   // the terminator: distinct by construction

  const rows = survey.rows.map(([icon, name], k) => ({ label: `${icon} ${name}`, n: counts[k] }));
  const visual: Question['visual'] = kind === 'pictogram'
    ? { type: 'chart', kind, rows, each: step, icon: PICTO_SYMBOL }
    : { type: 'chart', kind, rows };
  const chart = kind === 'tally' ? 'tally chart' : kind === 'pictogram' ? 'pictogram' : 'block diagram';

  const sorted = survey.rows.map(([, name], k) => ({ name, n: counts[k] })).sort((a, b) => b.n - a.n).map(r => r.name);
  return {
    prompt: 'Most to least!',
    say: `Look at the ${chart}. Slice from the most to the least.`,
    answer: sorted.join(','), sequence: sorted, options: shuffle(rng, sorted), visual,
    hint: 'Slice the biggest number first', hintIsData: false,
  };
};
