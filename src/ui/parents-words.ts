// The grown-ups "Spelling word lists" section (#1289): how many words on each statutory list the child spells
// securely, and the words not secure yet, with a button to copy them. Its own module: parents.ts is at its cap.
import { sfx } from '../audio';
import type { WordListRow } from '../game/parents';
import { $$, esc } from './dom';

const line = (r: WordListRow) => `${r.title} words: ${r.secure} of ${r.total} secure · ${r.notSecure.length} not yet secure · ${r.total - r.tried} not tried yet`;

/** The section's markup, or nothing when no list has a tried word. */
export function wordsHTML(rows: readonly WordListRow[]): string {
  if (!rows.length) return '';
  return `<h3 class="p-h">Spelling word lists</h3>${rows.map((r, i) => `<p class="p-empty">${esc(line(r))}</p>`
    + (r.notSecure.length ? `<p class="p-empty" id="words-${i}">${esc(r.notSecure.join(', '))}</p><div class="row"><button class="btn" data-words="${i}">Copy these words</button></div>` : '')).join('')}
    <p class="p-move-msg" id="words-msg" role="status" hidden></p>`;
}

/** Each button copies its list's words, or selects them to copy by hand when the clipboard refuses. */
export function bindWords() {
  $$<HTMLButtonElement>('[data-words]').forEach(btn => btn.addEventListener('click', () => {
    sfx.tap();
    const box = document.getElementById(`words-${btn.dataset.words}`)!, msg = document.getElementById('words-msg')!;
    const say = (t: string) => { msg.textContent = t; msg.hidden = false; };
    const byHand = () => { window.getSelection()?.selectAllChildren(box); say('Select the words above and copy them by hand — this browser will not do it for us.'); };
    let written: Promise<void> | undefined;
    try { written = navigator.clipboard?.writeText(box.textContent ?? ''); } catch { /* a synchronous refusal: select by hand */ }
    if (!written) { byHand(); return; }
    written.then(() => say('Copied. Paste the words where you like.')).catch(byHand);
  }));
}
