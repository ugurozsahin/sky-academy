// y6-subjunctive (#1280): the subjunctive in formal writing (English Appendix 2, Year 6): If I were…, requires that every pupil be…,
// Were they to come…. Every card's prompt is the stem "In formal writing, which word fits?", never the hint alone: the stem is what makes
// the indicative form wrong, because it sets the register. A `were` sentence is always hypothetical (its main clause has would, could or
// might), so a real conditional ("If I was rude, I apologise") never appears. The indicative form is always one of the decoys.
import type { Difficulty, Generator, Question, Rng } from './types';
import { pick, shuffle, wordQ } from './util';

export type Kind = 'were' | 'mandative' | 'inversion';
/** `person` is the subject of a `were` row; `base` is the stored infinitive a `mandative` answer must equal. */
export interface Row { text: string; answer: string; decoys: [string, string, string]; kind: Kind; person?: 'I' | 'other'; base?: string }

export const STEM = 'In formal writing, which word fits?';

export const SUBJUNCTIVES: readonly Row[] = [
  { kind: 'were', person: 'I', text: 'If I _ taller, I could reach the shelf.', answer: 'were', decoys: ['was', 'am', 'be'] },
  { kind: 'were', person: 'I', text: 'If I _ you, I would say sorry.', answer: 'were', decoys: ['was', 'am', 'be'] },
  { kind: 'were', person: 'I', text: 'If I _ a bird, I would fly over the sea.', answer: 'were', decoys: ['was', 'am', 'be'] },
  { kind: 'were', person: 'I', text: 'If I _ rich, I might buy a boat.', answer: 'were', decoys: ['was', 'am', 'be'] },
  { kind: 'were', person: 'I', text: 'If I _ braver, I would climb the tower.', answer: 'were', decoys: ['was', 'am', 'be'] },
  { kind: 'were', person: 'I', text: 'If I _ in charge, I would change the rules.', answer: 'were', decoys: ['was', 'am', 'be'] },
  { kind: 'were', person: 'other', text: 'If she _ the captain, we would win more.', answer: 'were', decoys: ['was', 'is', 'be'] },
  { kind: 'were', person: 'other', text: 'If he _ here, he could help us.', answer: 'were', decoys: ['was', 'is', 'be'] },
  { kind: 'were', person: 'other', text: 'If it _ sunny, we might go to the beach.', answer: 'were', decoys: ['was', 'is', 'be'] },
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
