// The grown-ups "Today's Daily Sprint" row (#925): the one-line result with a Copy button, only once one was played today.
// Its own module because parents.ts is at its #714 ratchet cap. Nothing is shown to a child and nothing is persisted.
import { sfx } from '../audio';
import { dailyLineFor } from '../game/daily-line';
import { activeProfile, today } from '../storage';
import { $, esc } from './dom';

const todaysLine = () => dailyLineFor(activeProfile(), today(new Date()));

export const dailyHTML = (line = todaysLine()) => line ? `<h3 class="p-h">Today's Daily Sprint</h3>
    <p class="p-note">A one-line result with no name in it, to paste into a family chat. Nothing is sent until you send it.</p>
    <textarea class="p-code" id="daily-text" rows="2" readonly aria-label="Today's Daily Sprint result">${esc(line)}</textarea>
    <div class="row"><button class="btn" id="daily-copy">Copy</button></div>
    <p class="p-move-msg" id="daily-msg" role="status" hidden></p>` : '';

export function bindDaily() {
  const box = document.querySelector<HTMLTextAreaElement>('#daily-text'); if (!box) return;
  const msg = $('#daily-msg');
  const say = (text: string) => { msg.textContent = text; msg.hidden = false; };
  const byHand = () => { box.select(); say('Select the text above and copy it by hand — this browser will not do it for us.'); };
  $('#daily-copy').addEventListener('click', () => {
    sfx.tap(); box.select();
    const written = navigator.clipboard?.writeText(box.value);
    if (!written) { byHand(); return; }
    written.then(() => say('Copied. Paste it where you like.')).catch(byHand);
  });
}
