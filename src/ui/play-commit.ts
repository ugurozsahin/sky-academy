// What a finished play-screen game writes (#1504): the payout, the certificate it earns and files. Moved out of
// playScreen with its comments; `ps` is a thunk because the session is built from `commitResult` itself.
import { topicById, type Topic } from '../curriculum';
import { missSlips, type SessionResult } from '../game/session';
import { recordAccuracy, recordBossWin, recordCert, recordEndless, recordGameEnd, recordTraining, saveKept, touchStreak } from '../storage';
import type { Avatar } from '../avatars';
import { certToStored, type CertInfo } from './certificate';
import { factsOf, lockedLines, speedCandidates } from './play-facts';
import { fixRoundPayout } from './play-results';
import type { PlaySession, ResultPayout } from './play-session';
import { recordMissionOutcome, recordSprintOutcome, type ResultCandidate } from './results';
import type { PlayOpts } from './play';

export interface CommitCtx { o: PlayOpts; d: { name: string }; av: Avatar; training: boolean; ps: () => PlaySession }

export function createCommit({ o, d, av, training, ps }: CommitCtx) {
  let lastCert: CertInfo | null = null;   // the one CertInfo actually filed (#410) — hooks read this, not a fresh certInfo() call
  /**
   * Every write a finished game makes (#484, mirroring #375/#441's `commitMatch` for Ninja Duel). This used to
   * run inside `showResults()`, which `onEnd` reaches only through the overlay's own scope-bound `later()` —
   * up to ~1.2 s after the game is actually decided, and both `#pause` and the arena stay live for the whole
   * wait. Quitting in that window (Pause → Islands, or the Android back button) runs `cleanup()` →
   * `scope.dispose()`, which cancels the pending call and, with it, every write below: no coins, no Daily
   * Dojo move, no Sensei accuracy, no certificate, no streak — in Mission, Training, Sprint, Boss and Endless,
   * the modes children play most. `createPlaySession`'s `onEnd` now calls this straight from `session.end()`,
   * synchronously, before the timer is even scheduled — the payout is handed to `showResults()` rather than
   * recomputed there, so the overlay can never pay the game a second time.
   */
  function commitResult(r: SessionResult): ResultPayout {
    if (o.practice) return fixRoundPayout(r); let newBest = false, topicBest = false, candidates: ResultCandidate[] = [];   // #930/#954: a fix round moves only "Fix 3 mistakes"
    // #522 review (silent-failure-hunter): a generator throw is not a genuine finished play of this topic/mode
    // — `recordTopic`'s `plays`/`best` and `recordSprint`/`recordEndless`'s "new best" are permanent per-topic/
    // per-year history, the same kind of record `duel.ts` withholds with its own `!r.incomplete` gate on
    // `recordDuel`. A phantom `plays` increment or an unearned best score would otherwise stick around forever
    // and skew `parents.ts`'s "topics tried" count and `sensei.ts`'s weakest-topic ranking.
    if (!r.incomplete) {
      if (o.mode === 'mission' && o.topic) ({ candidates, topicBest } = recordMissionOutcome(o.topic, r, !!o.legend, { name: d.name, avatar: av, year: o.year }));   // #933, #932
      else if (training) { if (r.won) recordTraining(o.year.id); }
      else if (o.mode === 'sprint') ({ newBest, candidates } = recordSprintOutcome(o.year, o.topic, r, !!o.title, !!o.seed?.startsWith('sprint:'), o.seed));   // #911/#912, #925
      else if (o.mode === 'boss') { if (r.won) recordBossWin(o.year.id); }
      else if (o.mode === 'endless') recordEndless(o.year.id, r.score);   // #1117: no catch-all writer — a new mode records nothing until it names its own
    }
    for (const [id, t] of Object.entries(ps().session.byTopic)) if (topicById(id)) recordAccuracy(id, t);   // Sensei learns from listed topics only (#1124)
    const bySubject = (s: Topic['subject']) =>
      Object.entries(ps().session.byTopic).reduce((n, [id, t]) => n + (topicById(id)?.subject === s ? t.hits : 0), 0);
    // #365: one write for the whole finished game — the dojo state and the coins it pays cannot land apart.
    const { dojo, fresh, prevSpeed, secured } = recordGameEnd({
      mode: r.mode, won: r.won, correct: r.correct, attempts: r.attempts, bestCombo: r.bestCombo,
      stars: r.stars, score: r.score, training, topicBest, ...factsOf(ps(), o, r),   // #1122
      mathsCorrect: bySubject('maths'), writingCorrect: bySubject('writing'), slips: missSlips(r.misses), topics: Object.keys(ps().session.byTopic),   // #938, #939
    }, r.coins);
    const dojoSaved = saveKept(); const streak = touchStreak();   // #518: read before this write overwrites the flag
    const cert = certInfo(r); lastCert = cert;
    // #205: filed when it is *earned*, not when the button works. `certSaved` (#470) is read the instant
    // after that write, per `isWriteFailing()`'s own contract of reflecting only the last attempt — a refusal
    // is not offered to the child as a keepsake the album does not actually hold. `cert` itself stays what
    // was earned regardless: the `certificate()` hook below still answers that, same as before #470.
    const certSaved = cert ? fileCertificate(cert) : false;
    return { newBest, dojo, fresh, streak, cert, certSaved, dojoSaved, candidates: [...candidates, ...lockedLines(secured), ...speedCandidates(ps(), o, r, prevSpeed)] };
  }
  /**
   * Keep the certificate this mission earned (#205), and report whether the write actually landed (#470).
   * It is filed the moment the results overlay is built, not from the 🎓 button: the bug #205 opened with is
   * a device where pressing that button does nothing at all, and the child who most needs the certificate
   * kept is the one it silently failed for.
   *
   * Routed through `certToStored()` (#544), the same helper `duel.ts` uses: every stored field, avatar
   * included, is narrowed from the one `CertInfo` (`c`) `certInfo()` already built and `drawCertificate()`
   * will later draw — never a second, independent read of the raw profile — so the album row and the printed
   * keepsake can never disagree about which ninja earned it or which day it was earned on.
   */
  function fileCertificate(c: CertInfo): boolean {
    recordCert(certToStored(c, { id: `${o.year.id}:${training ? 'sensei' : o.topic?.id ?? 'mission'}` }));
    // Both refusal paths (#470 review round 1): `isWriteFailing()` alone missed a write `save()` skipped
    // deliberately under `isReadOnlySave()`'s latch (#232) — the row was offered though the album never got it.
    return saveKept();
  }
  /** Certificate details for a won mission / Sensei session (null for the other modes and lost runs). `date`
   *  is fixed here, at the moment it is earned (#410), rather than left for `certificateText()` to default —
   *  the same object is filed by `fileCertificate()` now and drawn by the 🎓 button later, and both must read
   *  the same instant rather than two calls to `new Date()` a click apart. */
  const certInfo = (r: SessionResult): CertInfo | null =>
    r.won && o.mode === 'mission'
      ? {
          name: d.name, avatar: av, year: o.year.title, title: o.topic?.title ?? 'Sensei training',
          stars: r.stars, score: r.score, correct: r.correct, attempts: r.attempts, training, date: new Date(),
        }
      : null;
  return { commitResult, lastCert: () => lastCert };
}
