// The grown-ups "Challenge a friend" section (#1294): the last Sprint's code with a Copy button, and a box to play a friend's.
// Its own module because parents.ts is at its #714 ratchet cap. Nothing is shown to a child and nothing is sent over a network.
import { sfx } from '../audio';
import { enterCode, lastChallenge } from '../game/challenge-run';
import { YEARS } from '../curriculum';
import { $, esc } from './dom';
import type { StartPlay } from './home';

export const challengeHTML = () => {
  const k = lastChallenge();
  return `<h3 class="p-h">Challenge a friend</h3>
    <p class="p-note">${k ? `Your last ${esc(k.title)} Sprint has a code. A friend's grown-up types it on their device to play the same questions.` : 'Play a single-topic Sprint and its code will appear here.'} The code holds no name, and nothing is sent anywhere.</p>
    ${k ? `<textarea class="p-code" id="challenge-code" rows="1" readonly aria-label="Challenge code">${esc(k.code)}</textarea>
    <div class="row"><button class="btn" id="challenge-copy">Copy</button></div>` : ''}
    <input class="gate-input" id="challenge-in" type="text" maxlength="9" autocomplete="off" autocapitalize="characters" aria-label="A friend's challenge code">
    <div class="row"><button class="btn" id="challenge-play">Play this challenge</button></div>
    <p class="p-move-msg" id="challenge-msg" role="status" hidden></p>`;
};

export function bindChallenge(play: StartPlay) {
  const msg = $('#challenge-msg'), say = (text: string) => { msg.textContent = text; msg.hidden = false; };
  const box = document.querySelector<HTMLTextAreaElement>('#challenge-code');
  box?.addEventListener('focus', () => box.select());
  document.querySelector('#challenge-copy')?.addEventListener('click', () => {
    sfx.tap(); box!.select();
    let written: Promise<void> | undefined;
    try { written = navigator.clipboard?.writeText(box!.value); } catch { /* fall through to by hand */ }
    const byHand = () => say('Select the code above and copy it by hand — this browser will not do it for us.');
    if (!written) { byHand(); return; }
    written.then(() => say('Copied. Share it with your friend.')).catch(byHand);
  });
  $('#challenge-play').addEventListener('click', () => {
    sfx.tap(); const r = enterCode(($('#challenge-in') as HTMLInputElement).value);
    if ('error' in r) { say(r.error); return; }
    play({ year: YEARS.find(y => y.id === r.topic.year)!, mode: 'sprint', topic: r.topic, seed: r.seed });
  });
}
