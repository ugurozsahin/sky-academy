// y3-charts table form (#1115): d3 only, one card in three. Reads a table of counts (the `table` chart kind) and
// asks a one- or two-step "how many more / fewer" question. Counts are 10–99 and never tie within a table, and
// every answer is worked out from the rows. The prompt and `say` never state a count.
import type { Question, Rng } from './types';
import { ri, pick, shuffle, numQ } from './util';
import { ks2Say } from './ks2say';
import { decoys } from './year3-charts';

/** Plain single words; the table's head names what they are. */
const BANKS: readonly { head: string; words: readonly string[] }[] = [
  { head: 'Club', words: ['Rugby', 'Chess', 'Drama', 'Tennis', 'Art', 'Choir'] },
  { head: 'Pet', words: ['Dog', 'Cat', 'Fish', 'Rabbit', 'Mouse', 'Bird'] },
  { head: 'Fruit', words: ['Apple', 'Pear', 'Plum', 'Grape', 'Mango', 'Lemon'] },
];

export function tableCard(rng: Rng): Question {
  const bank = pick(rng, BANKS);
  const words = shuffle(rng, [...bank.words]).slice(0, ri(rng, 4, 5));
  const counts: number[] = [];
  while (counts.length < words.length) { const v = ri(rng, 10, 99); if (!counts.includes(v)) counts.push(v); }
  const rows = words.map((label, k) => ({ label, n: counts[k] }));
  const visual: Question['visual'] = { type: 'chart', kind: 'table', rows, head: [bank.head, 'Children'] };
  const [a, b, c] = shuffle(rng, words.map((_, k) => k));
  const [hi, lo] = counts[a] > counts[b] ? [a, b] : [b, a];
  const finish = (prompt: string, spoken: string, answer: number, named: number[]) =>
    numQ(rng, prompt, answer, { min: 0, max: 1000, distractors: decoys(answer, named, 3), visual, say: ks2Say(`Look at the table. ${spoken}`), slow: true });
  const ask = pick(rng, ['more', 'fewer', 'together', 'top2'] as const);
  if (ask === 'more' || ask === 'fewer') {
    const [x, y] = ask === 'more' ? [hi, lo] : [lo, hi], answer = counts[hi] - counts[lo];
    return finish(`How many ${ask} chose ${words[x]} than ${words[y]}?`, `How many ${ask} children chose ${words[x]} than ${words[y]}?`,
      answer, [counts[hi] + counts[lo], counts[hi], counts[lo]]);
  }
  if (ask === 'together') {
    // The smallest of the three rows is taken away, so the answer is positive.
    const [small, ...pair] = [a, b, c].sort((m, n) => counts[m] - counts[n]);
    const answer = counts[pair[0]] + counts[pair[1]] - counts[small];
    return finish(`How many more chose ${words[pair[0]]} and ${words[pair[1]]} together than ${words[small]}?`,
      `How many more children chose ${words[pair[0]]} and ${words[pair[1]]} together than ${words[small]}?`,
      answer, [counts[pair[0]] + counts[pair[1]], counts[small], answer + 10, answer - 10]);
  }
  const [t1, t2] = [...counts].sort((m, n) => n - m);
  const answer = t1 + t2;
  return finish('How many children chose the two most popular?', 'How many children chose the two most popular ones?', answer, [t1, answer + 10, answer - 10]);
}
