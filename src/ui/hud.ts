// The play screen's HUD writers, split out of play.ts (#36). The lives row, the sprint timer, the boss
// health bar and the per-question outcome reveal used to be closures inside the one long playScreen()
// function. They are now pure string builders (livesHTML, outcomeHintHTML — unit-tested) plus a thin
// createHud() that writes them onto the elements the play screen already owns. No game logic, no session:
// play.ts keeps all the wiring, exactly as the overlays split (#99) did.
import type { Question } from '../curriculum';
import { $, esc, fillAnswer } from './dom';

/** The lives row: `total` hearts, the first `n` lit and the rest dimmed. */
export const livesHTML = (n: number, total: number): string =>
  Array.from({ length: total }, (_, i) => `<span class="${i < n ? 'on' : 'off'}">❤️</span>`).join('');

/** The outcome hint under the question card: a tick for a right answer, else the answer named. */
export const outcomeHintHTML = (kind: 'correct' | 'wrong' | 'miss', answer: string): string =>
  kind === 'correct'
    ? `<b class="ok">✓ ${esc(answer)}</b> — that's right!`
    : `${kind === 'wrong' ? '✗ Not this time.' : 'It flew away!'} The answer is <b class="ok">${esc(answer)}</b>`;

export interface HudEls { lives: HTMLElement; qcard: HTMLElement; prompt: HTMLElement; hint: HTMLElement }

/**
 * HUD writers bound to the play screen's elements. `speech()` is read fresh on every reveal so the
 * read-aloud toggle takes effect at once (Sound Hunt with read-aloud off keeps its listen words).
 */
export function createHud(els: HudEls, lives: number, speech: () => boolean) {
  return {
    drawLives(n: number) { if (els.lives) els.lives.innerHTML = livesHTML(n, lives); },
    drawTimer(s: number) { const t = $('#timer'); if (!t) return; t.textContent = `⏱ ${s}`; t.classList.toggle('hurry', s <= 10); },
    drawHp(hp: number, max: number) { const h = $('#hp'); if (h) { h.style.width = `${Math.round(100 * hp / max)}%`; h.classList.toggle('low', hp <= 3); } },
    showOutcome(kind: 'correct' | 'wrong' | 'miss', q: Question) {
      els.qcard.classList.remove('good', 'bad'); els.qcard.classList.add(kind === 'correct' ? 'good' : 'bad');
      if (!q.sequence && !(q.listen && !speech())) els.prompt.innerHTML = fillAnswer(q.prompt, q.answer);   // Sound Hunt with read-aloud off keeps its listen words
      els.hint.innerHTML = outcomeHintHTML(kind, q.answer);
    },
  };
}
