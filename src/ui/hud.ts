// The play screen's HUD writers, split out of play.ts (#36). The lives row, the sprint timer, the boss
// health bar, the mission stage pill and the per-question outcome reveal used to be closures inside the one
// long playScreen() function. They are now pure string builders (livesHTML, stageHTML, outcomeHintHTML —
// all unit-tested) plus a thin createHud() that writes them onto the elements the play screen already owns,
// and the `Outcome` union both files name. No game logic, no session:
// play.ts keeps all the wiring, exactly as the overlays split (#99) did.
import type { Question } from '../curriculum';
import { $, esc, fillAnswer } from './dom';

/** The lives row: `total` hearts, the first `n` lit and the rest dimmed. */
export const livesHTML = (n: number, total: number): string =>
  Array.from({ length: total }, (_, i) => `<span class="${i < n ? 'on' : 'off'}">❤️</span>`).join('');

/** How a question ended, as the HUD and the play screen both name it (#36: one union, not four copies). */
export type Outcome = 'correct' | 'wrong' | 'miss';

/**
 * The mission stage pill: the stage's name, one segment per question in the stage (green = right,
 * red = slip, `cur` = the one being asked) and a small "3/6" for the grown-ups (#55).
 *
 * `segs` is the stage's running record and is as long as the stage; `index` is the question being asked.
 * A segment past the end of `segs` renders empty, so a short array cannot throw here.
 */
export function stageHTML(name: string, segs: readonly ('good' | 'bad' | '')[], index: number, total: number): string {
  const label = `${esc(name)}: question ${index + 1} of ${total}`;
  const bar = segs.map((k, i) => `<i class="${k}${i === index ? ' cur' : ''}"></i>`).join('');
  return `<span class="sname">${esc(name)}</span>`
    + `<span class="segs" role="progressbar" aria-label="${label}"`
    + ` aria-valuenow="${index + 1}" aria-valuemin="1" aria-valuemax="${total}">${bar}</span>`
    + `<small class="q" aria-hidden="true">${index + 1}/${total}</small>`;
}

/** The outcome hint under the question card: a tick for a right answer, else the answer named. */
export const outcomeHintHTML = (kind: Outcome, answer: string): string =>
  kind === 'correct'
    ? `<b class="ok">✓ ${esc(answer)}</b> — that's right!`
    : `${kind === 'wrong' ? '✗ Not this time.' : 'It flew away!'} The answer is <b class="ok">${esc(answer)}</b>`;

export interface HudEls { lives: HTMLElement; qcard: HTMLElement; prompt: HTMLElement; hint: HTMLElement }

/**
 * How a question's prompt is presented on this device (#65) — the one place the listen/peek/audible decision
 * is spelled out, so the card, the outcome reveal and the progress cue cannot disagree about it.
 *   `hear` — read aloud; the card shows the ordinary prompt.
 *   `read` — the `listen` text stays on the card (Sound Hunt's keywords, the word to spell).
 *   `peek` — the `listen` text is shown for a moment, then hidden before the bubbles launch (Story Sentences d2+).
 */
export type PromptMode = 'hear' | 'read' | 'peek';
export function promptMode(q: Pick<Question, 'listen' | 'peek'>, audible: boolean): PromptMode {
  if (!q.listen || audible) return 'hear';
  return q.peek ? 'peek' : 'read';
}

/**
 * HUD writers bound to the play screen's elements. `audible()` — read-aloud on AND the device can be heard
 * (#65) — is read fresh on every reveal so the toggle and the voice verdict take effect at once (Sound Hunt
 * without a voice keeps its listen words).
 */
export function createHud(els: HudEls, lives: number, audible: () => boolean) {
  return {
    drawLives(n: number) { if (els.lives) els.lives.innerHTML = livesHTML(n, lives); },
    drawTimer(s: number) { const t = $('#timer'); if (!t) return; t.textContent = `⏱ ${s}`; t.classList.toggle('hurry', s <= 10); },
    drawHp(hp: number, max: number) { const h = $('#hp'); if (h) { h.style.width = `${Math.round(100 * hp / max)}%`; h.classList.toggle('low', hp <= 3); } },
    showOutcome(kind: Outcome, q: Question) {
      els.qcard.classList.remove('good', 'bad'); els.qcard.classList.add(kind === 'correct' ? 'good' : 'bad');
      if (!q.sequence && promptMode(q, audible()) === 'hear') els.prompt.innerHTML = fillAnswer(q.prompt, q.answer);   // a `read` card keeps its listen words
      els.hint.innerHTML = outcomeHintHTML(kind, q.answer);
    },
  };
}

/** The writers `createHud` hands back — play.ts builds them, play-session.ts writes through them (#36). */
export type Hud = ReturnType<typeof createHud>;
