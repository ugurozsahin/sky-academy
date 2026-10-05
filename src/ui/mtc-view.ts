// Tables Check practice results (#1118): the score line and one row per missed fact, in the Dojo bonus-row look.
import { esc } from './dom';
import { MTC_SIZE, mtcScore } from '../game/mtc';
import type { DeckItem, SessionResult } from '../game/session';

/** "22 out of 25", then "7 × 8 = 56" for each fact missed. Practice, never "official" — and no pass or fail word. */
export function mtcRowsHTML(score: number, missed: readonly { prompt: string; answer: string }[]): string {
  const row = (ic: string, b: string, small: string) => `<div class="dojo-bonus"><span class="ic">${ic}</span><span><b>${esc(b)}</b>${small ? `<small>${esc(small)}</small>` : ''}</span></div>`;
  return [row('✖️', `${score} out of 25`, 'Tables Check practice'), ...missed.map(m => row('🔁', `${m.prompt} = ${m.answer}`, 'Have another go at this one'))].join('');
}

/** The rows for a finished run: only a complete Tables Check practice run has any. */
export const mtcRowsFor = (r: SessionResult, deck?: DeckItem[]): string => {
  if (r.mode !== 'mtc' || !deck || r.incomplete) return '';
  const { score, missed } = mtcScore(deck, r.misses);
  return mtcRowsHTML(score, missed);
};

/** The statgrid's correct/attempts: Tables Check counts the 25 check cards only, practice left out. */
export const mtcTally = (r: SessionResult, deck?: DeckItem[]) =>
  r.mode === 'mtc' && deck && !r.incomplete ? { correct: mtcScore(deck, r.misses).score, attempts: MTC_SIZE } : { correct: r.correct, attempts: r.attempts };
