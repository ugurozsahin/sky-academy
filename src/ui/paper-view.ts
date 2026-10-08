// Arithmetic practice results (#1233): the recap in the Dojo bonus-row look — every missed question with its right
// answer, every unreached one, and the paper's pace. Text only, always through `esc()`.
import { esc } from './dom';
import { paceLine, paperRecap, PAPER_SECS_PER_Q } from '../game/arithmetic-paper';
import type { DeckItem, SessionResult } from '../game/session';

const row = (ic: string, b: string, small: string) => `<div class="dojo-bonus"><span class="ic">${ic}</span><span><b>${esc(b)}</b>${small ? `<small>${esc(small)}</small>` : ''}</span></div>`;

/** The rows for a finished Arithmetic practice run; nothing for any other mode. */
export function paperRowsFor(r: SessionResult, deck?: DeckItem[]): string {
  if (r.mode !== 'paper' || !deck || r.incomplete) return '';
  const { missed, unreached } = paperRecap(deck, r.misses, r.attempts);
  const pace = paceLine(r.elapsedMs ?? 0, r.attempts) ?? `Paper pace: ${PAPER_SECS_PER_Q} s a question`;
  return [
    row('⏱️', pace, 'Arithmetic practice'),
    ...missed.map(m => row('🔁', `${m.prompt} Answer: ${m.answer}`, m.sliced ? `You sliced: ${m.sliced}` : 'Have another go at this one')),
    ...unreached.map(u => row('➡️', `${u.prompt} Answer: ${u.answer}`, 'Not reached')),
  ].join('');
}
