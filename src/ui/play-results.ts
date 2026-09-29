// The play screen's results overlay, split out of play.ts (#896, mirroring #36's split of the Session
// callbacks into play-session.ts): the DOM build, the certificate button and the closing speech, wired to
// the screen instance through one deps object rather than living in playScreen()'s own closure.
import { praiseLine, senseiLine, SENSEI, type Avatar } from '../avatars';
import type { SessionResult } from '../game/session';
import { scaled } from '../game/speed';   // #32: test-only time compression
import { say, sfx } from '../audio';
import { $ } from './dom';
import { resultsHTML } from './overlays';
import { resultHeading, resultHeadline, resultMedal, resultPillsHTML, resultsLines, type ResultCandidate } from './results';
import { dojoRowsHTML } from './memory';
import { stickersHTML } from './screen';
import { deliverCertificate, drawCertificate } from './certificate';
import type { ResultPayout } from './play-session';

/** Everything the results overlay needs from the screen around it. Function-valued where the screen owns the state. */
export interface ResultsScreenDeps {
  training: boolean;
  av: Avatar; name: string;                 // the child's avatar and name (`d.name`)
  els: { overlay: HTMLElement };
  hold: (open: boolean, beats?: boolean) => void;   // #65: the one writer of arena.paused is play-session's syncPaused()
  later: (fn: () => void, ms: number) => void;      // alive-guarded timer (#35)
  toast: (text: string, cls?: string, ms?: number) => void;
  replay: () => void; goHome: () => void; cleanup: () => void;
}

/**
 * The results overlay (every mode). `candidates` are the belt/island/trophy/new-best/rest announcements
 * #896 makes room for — nothing supplies one yet (each is its own later ticket: #933, #951, #912, #952,
 * #940, #897), so today it is always `[]` and the overlay renders exactly as it did before this split.
 */
export function createResultsScreen(deps: ResultsScreenDeps) {
  const { training, av, name, els, hold, later, toast, replay, goHome, cleanup } = deps;
  return function showResults(r: SessionResult, payout: ResultPayout, candidates: ResultCandidate[] = []) {
    // Terminal, and `beats: false` because of it (PR #474 review, B1): the game is over — syncPaused() also
    // reads session.ended, so nothing here can undo the pause — and the beats below (the sticker jingle, the
    // certificate toasts' own auto-hide) belong to this overlay rather than to the held game, so they still run.
    hold(true, false);
    const { newBest, dojo, fresh, streak, cert, certSaved, dojoSaved } = payout;
    const stickerHTML = dojoSaved ? stickersHTML(fresh) : '';   // #518: no keepsake for a refused write, same shape as certSaved
    if (dojoSaved && (fresh.length || dojo.completed.length)) later(() => sfx.stage(), scaled(600));   // #138
    const medal = resultMedal(r);
    // #522: a generator throw ends the session through the same `won: false` path as a genuine loss, but it
    // is not one — `r.incomplete` withholds the win/loss framing (never a certificate either: `certInfo`
    // already requires `r.won`, which an incomplete session never has) and says plainly what happened instead,
    // mirroring `duel.ts`'s identical `r.incomplete` handling for an aborted match.
    const headline = resultHeadline(r, { training, newBest, name, senseiLine: () => senseiLine(r.won, name), praiseLine: () => praiseLine(av, name) });
    const heading = r.incomplete ? 'Session ended early' : resultHeading(r.mode, { won: r.won, training });   // from the mode table (mission distinguishes a Sensei-training win)
    const speaker = training ? SENSEI : av;   // Sensei closes a training session; the child's own ninja closes everything else
    say(headline);
    const lines = resultsLines(candidates);   // #896: belt > island > trophy > best > rest, at most two
    for (const l of lines) say(l.text, false, { queue: true });   // queued so a candidate never cuts the headline off
    // `certSaved` (#470) is read the instant after `fileCertificate`'s own write, inside `commitResult()` —
    // per `isWriteFailing()`'s own contract of reflecting only the last attempt — a refusal is not offered to
    // the child as a keepsake the album does not actually hold. `cert` itself stays what was earned regardless:
    // the `certificate()` hook below still answers that, same as before #470.
    const earned = certSaved ? cert : null;
    els.overlay.hidden = false;
    els.overlay.innerHTML = resultsHTML({
      mode: r.mode, won: r.won, training, incomplete: r.incomplete, glow: speaker.glow, img: speaker.img, name: speaker.name,
      headline, medal, heading, starCount: r.stars, score: r.score, correct: r.correct, attempts: r.attempts,
      bestCombo: r.bestCombo, coins: r.coins, newBest, streak, dojoRows: dojoSaved ? dojoRowsHTML(dojo) : '', stickerHTML, cert: !!earned,
      resultLines: resultPillsHTML(lines),
    });
    $('#again').addEventListener('click', () => { sfx.tap(); cleanup(); replay(); });
    $('#home').addEventListener('click', () => { sfx.tap(); cleanup(); goHome(); });
    if (earned) $('#cert').addEventListener('click', async () => {
      sfx.tap(); const b = $('#cert') as HTMLButtonElement; b.disabled = true;
      try {
        const how = await deliverCertificate(await drawCertificate(earned), `sky-ninja-certificate-${(name || 'ninja').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`);
        if (how === 'shared') toast('Certificate shared!', 'good');
        else if (how === 'saved' || how === 'downloaded') toast('Certificate saved!', 'good');
        else if (how === 'declined') toast('No problem — you can save it next time!', 'good');
        // 'shown' opens the full-screen view with its own save hint, so no toast
      }
      catch (e) { console.error('certificate delivery failed', e); toast('Could not make the certificate', 'bad'); }
      b.disabled = false;
    });
  };
}
