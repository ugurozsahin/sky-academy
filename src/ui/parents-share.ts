// The grown-ups "Share a progress summary" section (#942): plain text out through the share sheet, the clipboard
// or a selected box. Its own module because parents.ts is at its #714 ratchet cap. Nothing is sent by the game.
import { plugin } from '../native';
import { sfx } from '../audio';
import { progressText, summaryRoute, type ParentSummary } from '../game/parents';
import { deliverCertificate, type CapShare } from './certificate';
import { ALREADY_GATED } from './grown-up-gate';
import { drawProgressReport } from './report';
import { avatarById } from '../avatars';
import { $ } from './dom';

export const shareHTML = () => `<h3 class="p-h">Share a progress summary</h3>
    <p class="p-note">A short note for the reading record, an email or a school app. Nothing is sent until you send it.</p>
    <div class="row"><button class="btn" id="share-progress">Share a progress summary</button> <button class="btn" id="share-picture">Progress picture</button></div>
    <textarea class="p-code" id="share-text" rows="6" readonly aria-label="Progress summary" hidden></textarea>
    <p class="p-move-msg" id="share-msg" role="status" hidden></p>`;

/** Wire the button: the text is built at the tap, from the summary the dashboard already holds. */
export function bindShare(sm: ParentSummary, name: string, avatarId = '') {
  const box = $<HTMLTextAreaElement>('#share-text'), msg = $('#share-msg');
  const say = (text: string) => { msg.textContent = text; msg.hidden = false; };
  const byHand = (text: string) => { box.value = text; box.hidden = false; box.select(); say('Select the text above and copy it by hand — this browser will not do it for us.'); };
  const btn = $<HTMLButtonElement>('#share-progress');
  btn.addEventListener('click', async () => {
    if (btn.disabled) return;
    btn.disabled = true;   // a second tap while the sheet is open makes navigator.share reject with InvalidStateError
    sfx.tap();
    const text = progressText(sm, name), cap = plugin<CapShare>('Share');
    const route = summaryRoute({ webShare: typeof navigator.share === 'function', capacitorShare: !!cap, clipboard: !!navigator.clipboard?.writeText });
    try {
      if (route === 'share') { await navigator.share({ text }); say('Shared.'); }
      else if (route === 'capacitor') { await cap!.share({ text, dialogTitle: 'Share progress summary' }); say('Shared.'); }
      else if (route === 'copy') { await navigator.clipboard.writeText(text); say('Copied. Paste it where you like.'); }
      else byHand(text);
    } catch (e) {
      if ((e as { name?: string })?.name === 'AbortError') return;   // a cancelled share sheet is not an error
      console.warn('progress summary: share failed', e);
      byHand(text);
    } finally { btn.disabled = false; }
  });
  const pic = $<HTMLButtonElement>('#share-picture');   // #943: the picture is drawn at the tap and filed nowhere
  pic.addEventListener('click', async () => {
    if (pic.disabled) return;
    pic.disabled = true; sfx.tap();
    try {
      const now = new Date(), day = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const out = await deliverCertificate(await drawProgressReport({ sm, name, avatar: avatarById(avatarId), date: now }), `sky-ninja-progress-${day}.png`, ALREADY_GATED);   // the dashboard is already behind the grown-ups gate (#1943)
      if (out !== 'shown') say(out === 'declined' ? 'Not saved.' : out === 'downloaded' ? 'Saved to your downloads.' : 'Done.');
    } catch (e) { console.warn('progress picture failed', e); say('Could not make the picture. Please try again.'); }
    finally { pic.disabled = false; }
  });
}
