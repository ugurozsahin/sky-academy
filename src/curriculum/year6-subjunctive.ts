// y6-subjunctive (#1280): the subjunctive in formal writing (English Appendix 2, Year 6): If I were…, requires that every pupil be…,
// Were they to come…. Every card's prompt is the stem "Which word fits in formal writing?" (the Grammar mix pool needs a prompt that starts with "Which"), never the hint alone: the stem is what makes
// the indicative form wrong, because it sets the register. A `were` sentence is always counterfactual: its if-clause is plainly untrue (a bird, a giant, ten years older) and its main
// clause has would, so the indicative ("If I am a bird, I would…") is not natural and a real conditional never appears. The indicative form is always one of the decoys.
import type { Difficulty, Generator, Question, Rng } from './types';
import { pick, shuffle, wordQ } from './util';

export type Kind = 'were' | 'mandative' | 'inversion';
/** `person` is the subject of a `were` row; `base` is the stored infinitive a `mandative` answer must equal. */
export interface Row { text: string; answer: string; decoys: [string, string, string]; kind: Kind; person?: 'I' | 'other'; base?: string }

export const STEM = 'Which word fits in formal writing?';

export const SUBJUNCTIVES: readonly Row[] = [
  { kind: 'were', person: 'I', text: 'If I _ you, I would say sorry.', answer: 'were', decoys: ['was', 'am', 'be'] },
  { kind: 'were', person: 'I', text: 'If I _ a bird, I would fly over the sea.', answer: 'were', decoys: ['was', 'am', 'be'] },
  { kind: 'were', person: 'I', text: 'If I _ a giant, I would step over the wall.', answer: 'were', decoys: ['was', 'am', 'be'] },
  { kind: 'were', person: 'I', text: 'If I _ ten years older, I would drive the bus.', answer: 'were', decoys: ['was', 'am', 'be'] },
  { kind: 'were', person: 'I', text: 'If I _ a fish, I would live in the sea.', answer: 'were', decoys: ['was', 'am', 'be'] },
  { kind: 'were', person: 'I', text: 'If I _ a cat, I would sleep all day.', answer: 'were', decoys: ['was', 'am', 'be'] },
  { kind: 'were', person: 'other', text: 'If she _ a bird, she would fly to the sea.', answer: 'were', decoys: ['was', 'is', 'be'] },
  { kind: 'were', person: 'other', text: 'If he _ a giant, he would step over the wall.', answer: 'were', decoys: ['was', 'is', 'be'] },
  { kind: 'were', person: 'other', text: 'If the moon _ made of cheese, we would eat it.', answer: 'were', decoys: ['was', 'is', 'be'] },
  { kind: 'were', person: 'other', text: 'If Zoë _ the class president, things would be much better.', answer: 'were', decoys: ['was', 'is', 'be'] },
  { kind: 'mandative', base: 'be', text: 'The school requires that every pupil _ honest.', answer: 'be', decoys: ['is', 'are', 'was'] },
  { kind: 'mandative', base: 'leave', text: 'We insist that he _ now.', answer: 'leave', decoys: ['leaves', 'left', 'leaving'] },
  { kind: 'mandative', base: 'wear', text: 'The headteacher insists that every child _ a coat.', answer: 'wear', decoys: ['wears', 'wore', 'wearing'] },
  { kind: 'mandative', base: 'close', text: 'I suggest that he _ the door.', answer: 'close', decoys: ['closes', 'closed', 'closing'] },
  { kind: 'mandative', base: 'repay', text: 'The judge ordered that the man _ the money.', answer: 'repay', decoys: ['repays', 'repaid', 'repaying'] },
  { kind: 'inversion', text: '_ they to come, we would be ready.', answer: 'Were', decoys: ['If', 'Was', 'Are'] },
  { kind: 'inversion', text: '_ she to ask, I would tell her.', answer: 'Were', decoys: ['If', 'Was', 'Is'] },
  { kind: 'inversion', text: '_ it to rain, the match would stop.', answer: 'Were', decoys: ['If', 'Was', 'Is'] },
];

const HINTS: Record<Kind, string> = {
  were: 'It is only imagined, not real',
  mandative: 'After insist, suggest or require, the plain verb follows',
  inversion: 'A formal way to start an imagined sentence',
};

/** The rows a difficulty may draw: d1 the I rows, d2 the other were rows and the mandatives, d3 every kind. */
export const rowsFor = (d: Difficulty): readonly Row[] =>
  d === 1 ? SUBJUNCTIVES.filter(r => r.person === 'I') : d === 2 ? SUBJUNCTIVES.filter(r => r.person === 'other' || r.kind === 'mandative') : SUBJUNCTIVES;

export const y6Subjunctive: Generator = (d: Difficulty, rng: Rng): Question => {
  const row = pick(rng, rowsFor(d));
  return wordQ(rng, STEM, row.answer, shuffle(rng, [...row.decoys]), {
    visual: { type: 'sentence', text: row.text }, say: `${STEM} ${row.text.replace('_', 'blank')}`, hint: HINTS[row.kind], hintIsData: false,
  });
};
