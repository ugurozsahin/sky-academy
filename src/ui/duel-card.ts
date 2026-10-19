// The Ninja Duel's question card (#647, #649), split out of `duel-beats.ts`: what the strip shows under the round pill.
// It writes through the play screen's own writers (#16 review) — a `listen` question (Sound Hunt is in the pool) shows
// its words on a device that cannot be heard, and the hint line carries the data five of the pool's comparison topics
// keep nowhere else: without it "Which is fuller?" is two coloured bubbles and a guess. A duel has no peek timing, so
// a peek question reads through here rather than hiding its text.
import type { Question } from '../curriculum';
import { canHear, onVoiceStateChange } from '../audio';
import { hintText, promptHTML, promptMode } from './hud';
import { renderVisual } from './visuals';

export interface DuelCardEls { speak: HTMLElement; prompt: HTMLElement; vis: HTMLElement; hintEl: HTMLElement }

/**
 * `current` is the question on the card, or undefined when there is none to repaint (before the first round, or once
 * the match has ended). The card subscribes to the voice verdict, as `play-session.ts` does (#65): on a first-ever
 * launch the verdict is still optimistic during round 1, and an honest probe must re-render the card at once rather
 * than leave a Sound Hunt round on "Listen!" with no words (#649). `stop()` unsubscribes, on the screen's teardown.
 */
export function createDuelCard(els: DuelCardEls, current: () => Question | null | undefined) {
  let hintLine = '';   // what the card is showing under the prompt this round — pinned by the e2e against `#hint`
  const paint = (q: Question) => {
    const reveal = promptMode(q, canHear()) !== 'hear';
    els.speak.hidden = reveal;
    els.prompt.innerHTML = promptHTML(q, 0, reveal); els.vis.innerHTML = renderVisual(q.visual);
    hintLine = hintText(q, { reveal }); els.hintEl.textContent = hintLine;
  };
  const stop = onVoiceStateChange(() => { const q = current(); if (q) paint(q); });
  return { paint, stop, get hintLine() { return hintLine; } };
}
