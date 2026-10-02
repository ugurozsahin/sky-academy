// y3-speech (#1110): inverted commas for direct speech (English Appendix 2, Year 3). The card shows two or three
// versions of one sentence, labelled A–C, which differ only in where the “ and ” go; the bubbles carry the letters.
// The commas and end marks are correct and identical in every version, so no Year 4 punctuation error is ever the
// right answer (#1167 owns that).
import type { Generator, Question } from './types';
import { pick, shuffle, wordQ } from './util';

/** [the spoken words with their own end mark, the reporting clause]. */
export type SpeechRow = readonly [string, string];

/** Speech first: `“Come here,” said Mum.` The spoken words end in `,`, `?` or `!`, never `.`. */
export const SPEECH_FIRST: readonly SpeechRow[] = [
  ['Come here,', 'said Mum.'], ['Look at me!', 'cried Tom.'], ['Where is my hat?', 'asked Dad.'],
  ['Time for tea,', 'said Gran.'], ['I can swim,', 'said Mia.'], ['Be quiet!', 'whispered Ben.'],
  ['Can I play?', 'asked Sam.'], ['We won!', 'shouted Zoe.'], ['The sun is hot,', 'said Dad.'],
  ['I like your hat,', 'said Nan.'], ['Wait for me!', 'called Max.'], ['What is that?', 'asked Mum.'],
  ['Sit down,', 'said Mrs Lee.'], ['Let us go out,', 'said Tom.'],
];

/** Reporting clause first: `Tom said, “Look at the owl.”` The spoken words end in `.`, `?` or `!`. */
export const REPORTING_FIRST: readonly SpeechRow[] = [
  ['Look at the owl.', 'Tom said,'], ['I am hungry.', 'Mia said,'], ['Can you help me?', 'Dad asked,'],
  ['It is my turn!', 'Ben shouted,'], ['We can go now.', 'Mum said,'], ['Come and see!', 'Zoe called,'],
  ['The bus is here.', 'Dad said,'], ['Where is the cat?', 'Sam asked,'], ['I love this song.', 'Nan said,'],
  ['Time for bed.', 'Mum said,'], ['Watch me jump!', 'Max cried,'], ['I can see a bird.', 'Mia said,'],
];

const OPEN = '“', CLOSE = '”';
const MISPLACEMENTS = ['no-close', 'reporting', 'whole', 'late-open'] as const;
export type Misplacement = typeof MISPLACEMENTS[number];

/** The words of a card with the part each belongs to, in reading order. */
function words(row: SpeechRow, reportingFirst: boolean): { w: string; spoken: boolean }[] {
  const tag = (s: string, spoken: boolean) => s.split(' ').map(w => ({ w, spoken }));
  return reportingFirst ? [...tag(row[1], false), ...tag(row[0], true)] : [...tag(row[0], true), ...tag(row[1], false)];
}

/** One version of the sentence: the marks go before word `open` and after word `close` (`close` −1 = none). Pure text, same words. */
function render(ws: { w: string }[], open: number, close: number): string {
  return ws.map((x, i) => `${i === open ? OPEN : ''}${x.w}${i === close ? CLOSE : ''}`).join(' ');
}

/** The right version, or one of the four misplacements, built by rule from the same words. */
export function version(row: SpeechRow, reportingFirst: boolean, how: 'right' | Misplacement): string {
  const ws = words(row, reportingFirst);
  const first = ws.findIndex(x => x.spoken), last = ws.length - 1 - [...ws].reverse().findIndex(x => x.spoken);
  const rFirst = ws.findIndex(x => !x.spoken), rLast = ws.length - 1 - [...ws].reverse().findIndex(x => !x.spoken);
  switch (how) {
    case 'right': return render(ws, first, last);
    case 'no-close': return render(ws, first, -1);
    case 'reporting': return render(ws, rFirst, rLast);
    case 'whole': return render(ws, 0, ws.length - 1);
    case 'late-open': return render(ws, first + 1, last);
  }
}

const LABELS = ['A', 'B', 'C'];

export const y3Speech: Generator = (d, rng): Question => {
  const reportingFirst = d === 3 && rng() < 0.5;
  const row = pick(rng, reportingFirst ? REPORTING_FIRST : SPEECH_FIRST);
  const wrong = d === 1 ? [pick(rng, ['no-close', 'whole'] as const)] : shuffle(rng, [...MISPLACEMENTS]).slice(0, 2);
  const versions = shuffle(rng, ['right' as const, ...wrong]).map(h => ({ h, text: version(row, reportingFirst, h) }));
  const labels = LABELS.slice(0, versions.length);
  const answer = labels[versions.findIndex(v => v.h === 'right')];
  const prompt = 'Which has the inverted commas in the right place?';
  return wordQ(rng, prompt, answer, labels.filter(l => l !== answer), {
    visual: { type: 'sentence', text: versions.map((v, i) => `${labels[i]}  ${v.text}`).join('\n') }, say: prompt,
  });
};
