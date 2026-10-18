// Ninja Duel settlement and results overlay (#1500): the finished match's writes (`commitOnce`/`commitMatch`),
// the overlay that shows them and the certificate a Player 1 win earns, moved out of `duelScreen` in
// `duel.ts` with their comments. The live bindings `window.__sna`'s `state()`, `certificate()` and
// `certWords()` read are the fields of `m`, written by `commitMatch` exactly as the `let`s were.
import { SENSEI, type Avatar } from '../avatars';
import type { Topic } from '../curriculum';
import { duelAccuracy, duelCoins, duelDojoEvent, duelEarnsCertificate, duelHeadline, duelStars, type DuelPlayer, type DuelResult, type DuelTally } from '../game/duel';
import { scaled } from '../game/speed';
import { saveKept, recordAccuracy, recordCert, recordDuel, recordGameEnd, touchStreak, type GameEndOutcome } from '../storage';
import { certToStored, deliverCertificate, drawCertificate, type CertInfo } from './certificate';
import { say, sfx } from '../audio';
import { $, esc } from './dom'; import { askGrownUp } from './grown-up-gate';   // #1943; one line: at its #714 cap
import { dojoRowsHTML } from './memory';
import { stickersHTML, type screenScope } from './screen';
import type { DuelScreenOpts } from './duel';

export interface ResultsDeps {
  o: DuelScreenOpts; topic: Topic; NAME: Record<DuelPlayer, string>; d: { name: string }; av: Avatar;
  overlay: HTMLElement; scope: ReturnType<typeof screenScope>; hold: (open: boolean, beats?: boolean) => void;
  cleanup: () => void; goHome: () => void; replay: () => void;
}
/** What the match has settled so far; every field reads as unearned until `commitMatch` writes it. */
export interface Settled {
  paid: number; dojoPaid: number; taught: DuelTally; cert: CertInfo | null; certSaved: boolean; dojoSaved: boolean;
  payout: GameEndOutcome | null; committed: boolean;
}
export function createDuelResults(deps: ResultsDeps) {
  const { o, topic, NAME, d, av, overlay, scope, hold, cleanup, goHome, replay } = deps; const { later, toast } = scope;
  const m: Settled = { paid: 0, dojoPaid: 0, taught: { hits: 0, tries: 0 }, cert: null, certSaved: false, dojoSaved: false, payout: null, committed: false };
  /**
   * What the finished match paid, or null until it is committed — the overlay draws from this (#375/#441).
   *
   * It is a binding rather than an argument threaded from one place because the match is now committed from
   * **whichever of three points is reached first** (see `commitOnce`), and only one of them is `onMatchEnd`.
   *
   * It carries only what the overlay cannot recompute without paying the match twice. `paid`, `dojoPaid`,
   * `taught` and `cert` stay separate bindings deliberately: `window.__sna`'s `state()`, `certificate()` and
   * `certWords()` hooks read them live, at whatever moment they are asked, not once at draw time.
   */
  /**
   * Commit the finished match exactly once, from whichever point reaches it first (#375/#441, round 1 B1).
   *
   * The three, in the order they can occur on a last round: the round being **won** (`onRoundWon`), its wave
   * **running out** undecided (`waveEnd`), and the match formally **ending** (`onMatchEnd`). The first two
   * are the fix for B1 — between them and `onMatchEnd` sit two scope-bound timers (`endWave`'s ~1 s and
   * `waveEnd`'s ~450 ms) totalling ~1.45 s in which `duel.ended` is still false, so both arenas run, `#pause`
   * is live, and `cleanup()` → `scope.dispose()` cancels whichever timer has not fired yet.
   *
   * A `commitMatch` throw is caught here, not left to propagate (#508): every caller gets `null` back rather
   * than an exception, `onMatchEnd`'s own `later()` included — the exact call `onRoundWon`'s/`waveEnd`'s own
   * pacing code funnels back into once the match ends, so a throw reaching it uncaught reopened the same hang.
   *
   * Calling it early is safe because `Duel.result()` is final once the last round is settled — its own doc
   * has why nothing afterwards can move a field it reads.
   */
  const commitOnce = (r: DuelResult): GameEndOutcome | null => {
    if (m.committed) return m.payout;
    m.committed = true;
    // The flag is set BEFORE commitMatch runs, not latched on its return (#375 round 2, note 3): a second
    // caller must see `committed` true even if this attempt is about to fail, or it would re-run the whole
    // sequence and double-pay. A throw is caught, not propagated (#508) — every caller gets `null` back.
    try { m.payout = commitMatch(r); }
    catch (e) { console.error('duel commit failed', r, e); toast("Couldn't save the match", 'bad'); }
    return m.payout;
  };
  /**
   * Every write a finished match produces, committed the moment the match is settled (#375/#441).
   *
   * These used to sit at the top of `showResults()`, which runs on a scope-bound timer ~1.3 s later — so the
   * save depended on a timer surviving, and leaving in that window lost the whole match. The overlay's job is
   * to *show* the payout, not to be the thing that causes it. Nothing about **what** a duel pays moves here:
   * the amounts, the dojo event, the accuracy unit and the certificate rule are all unchanged, only *when*
   * they are committed. The pacing before the overlay (`HOLD.won` + 300 ms) is deliberate and stays.
   *
   * This sits **under** #365's rule rather than beside it: `recordGameEnd()` is still the one write that pays
   * the coins and moves the dojo together, and this only decides the moment it is called.
   *
   * Reached only through `commitOnce`, which is what makes "once per match" true — `Duel.end()`'s own `ended`
   * guard is no longer the whole of it, now that two of the three callers run before the match has ended.
   */
  function commitMatch(r: DuelResult): GameEndOutcome {
    // #16 item 5: the match pays into the one shared save, so the coin row and any sticker it unlocked are on
    // the screen the children are already looking at. The Daily Dojo hears about the match here too — ten
    // questions answered correctly on this screen move the day's volume challenges exactly as they would in
    // any other mode — and its bonus rides the same single write (#365).
    m.paid = duelCoins(r);
    // Sensei's half: the rounds Player 1 answered on this topic — one try each, the unit a mission writes — for
    // the seat `DUEL_HANDOVER` keeps for the profile's own child (`duelAccuracy()` has why neither the score nor
    // the round count may be used, and why a swiped wave is still one try). A separate write from
    // the coins below, exactly as `play.ts` already records accuracy separately from its payout — there is no
    // coins/challenge pairing to break here, and the two-write question on a results screen is #365's, not this
    // slice's to widen into. `recordTopic()` is deliberately NOT called: a duel earns no stars and is no `play`
    // of the topic, so a duel-only topic keeps `plays: 0` and `accuracy()` reads null for it — the same way a
    // topic met only in Sensei training or Sky Storm already behaves.
    m.taught = duelAccuracy(r);
    recordAccuracy(topic.id, m.taught);
    // #365: one write for the whole finished game — the dojo state and the coins it pays cannot land apart.
    const { dojo, fresh } = recordGameEnd({ ...duelDojoEvent(r, topic.subject), topics: [topic.id] }, m.paid);
    m.dojoPaid = dojo.coins;
    m.dojoSaved = saveKept();   // #518: read before touchStreak() below overwrites the flag
    // #355 (owner decision, 2026-09-24): a finished duel marks the daily streak, the same as every other
    // finished game (`play.ts`, `memory.ts`) — ten real questions answered at the same coin rate is real
    // practice, whichever seat took the round. `touchStreak()` is idempotent within a day, so a rematch on
    // the same day costs nothing extra.
    touchStreak();
    m.cert = duelCert(r);
    // Reset with `cert`, not left to the caller (#470 review, type-design-analyzer): `certSaved` must never
    // outlive the `cert` it describes, and pinning that to `commitOnce`'s single-invocation guarantee alone
    // would make the invariant one refactor away from breaking silently.
    m.certSaved = false;
    // #205's rule, unchanged here: filed by the match, never from the 🎓 button, because the bug that issue
    // opened with is a device where pressing the button does nothing at all. #375 moves the filing a further
    // 1.3 s earlier — from the overlay being built to the match ending — which only strengthens that rule.
    //
    // Built **from** the drawn `CertInfo` rather than beside it (#16 review, B1): the field list was hand-copied,
    // so `duel: true` had two independent writers and deleting the one that reaches the printed certificate left
    // every test green while the album and the child's keepsake disagreed about what had been won. `certToStored`
    // is now the only writer, so the e2e's stored assertions cover the drawn object too.
    // Both refusal paths (#470 review round 1): `isWriteFailing()` alone missed a write `save()` skipped
    // deliberately under `isReadOnlySave()`'s latch (#232) — the row was offered though the album never got it.
    if (m.cert) { recordCert(certToStored(m.cert, { id: `${o.year.id}:duel:${topic.id}` })); m.certSaved = saveKept(); }   // #670: per topic, not per year
    // The last piece of item 5: the match itself, so it outlives this overlay. Filed for every finished match
    // — a loss and a draw are as much a thing that happened as a win, which is the one place this parts
    // company with the certificate above (that is an award; only a Player 1 win earns one, `duelEarnsCertificate`)
    // — EXCEPT an incomplete one (#444 review, PR #502 round 2, B1): a generator throw cut the match short, not
    // the children, and filing it would misrepresent a technical failure as a real result forever — the one
    // write `duelHistoryLine()` has no way to tell apart from a genuine finish. A rematch files a second row
    // rather than replacing this one; `fileDuel()` has why.
    if (!r.incomplete) recordDuel({ at: Date.now(), topic: topic.id, title: topic.title, year: o.year.title, winner: r.winner, scoreA: r.scoreA, scoreB: r.scoreB, rounds: r.rounds });
    // Returned rather than recomputed by the overlay: `recordGameEnd` IS the write, so a redraw that called
    // it again would pay the match a second time.
    return { dojo, fresh };
  }

  /** Draws what `commitMatch()` already wrote — this runs on a timer the child can outrun, and writes nothing. */
  function showResults(r: DuelResult, { dojo, fresh }: GameEndOutcome) {
    hold(true, false);   // terminal: the beats below (the jingle, the certificate toasts) must still run — see `hold`
    if (m.dojoSaved && (fresh.length || dojo.completed.length)) later(() => sfx.stage(), scaled(600));   // #138/#518: no jingle either, for a refused write
    // #444 review (PR #502 round 2), B1: an incomplete match has no winner worth announcing — `duelHeadline()`
    // would read a scoreline nobody decided as if the match had run its course. Everything already earned
    // (the coins/dojo/Sensei writes above) still shows; only the winner framing and the certificate are withheld.
    const headline = r.incomplete ? 'That question broke — here is what you earned so far!' : duelHeadline(r, NAME);
    say(headline);
    // Captured, not read back off `cert`: this handler is async and fires long after this frame, and it must
    // draw the certificate *this* match earned, so it binds the value the `if` tested. The `certificate()` hook
    // below deliberately does the opposite and reads the live binding — it is asked "what has been earned
    // now?" and answers null until the match is settled (#16 review, note 7; narrowed by #375 round 2, note 1:
    // "before the match ends" was the old boundary, and `cert` is now set at the last slice, not the overlay).
    //
    // Gated on `certSaved` too (#470): a write `commitMatch` already made and found refused is not offered as
    // a keepsake the album has. `cert` itself stays untouched by this — the window hooks below still answer
    // what was *earned* — this is only what the row promises to have *kept*. (An incomplete match already
    // earns no certificate — `duelEarnsCertificate` excludes it — so `cert`/`earned` are null there regardless.)
    const earned = m.certSaved ? m.cert : null;
    overlay.hidden = false;
    overlay.innerHTML = `
      <div class="modal results duel-end">
        <div class="scroll">
          <div class="hero-big sensei" style="--glow:${SENSEI.glow}"><img src="${SENSEI.img}" alt="${SENSEI.name}"><div class="speech">${esc(headline)}</div></div>
          <h2>${r.incomplete ? 'Match ended early' : r.winner === 'draw' ? 'A draw!' : `${esc(NAME[r.winner])} wins!`}</h2>
          <div class="statgrid duel-final"><div><b>${r.scoreA}</b><small>${NAME.a}</small></div><div><b>${r.rounds}</b><small>rounds</small></div><div><b>${r.scoreB}</b><small>${NAME.b}</small></div></div>
          <div class="coin-row"><span class="coin-gain">+${m.paid} 🪙</span></div>
          ${m.dojoSaved ? dojoRowsHTML(dojo) : ''}
          ${m.dojoSaved ? stickersHTML(fresh) : ''}
          ${earned ? '<div class="row"><button class="btn big cert" id="cert" aria-label="Save a certificate for this duel">🎓 Certificate</button></div><p class="cert-msg" id="cert-msg" role="status" hidden></p>' : ''}
        </div>
        <div class="row nav"><button class="btn primary big" id="again">Rematch ⚔️</button><button class="btn big" id="home">Islands</button></div>
      </div>`;
    $('#again').addEventListener('click', () => { sfx.tap(); cleanup(); replay(); });
    $('#home').addEventListener('click', () => { sfx.tap(); cleanup(); goHome(); });
    if (earned) wireCertificate(deps, earned);
  }
  /**
   * The certificate a finished match earned, or null (#16 item 5). **Only a Player 1 win earns one**: the two
   * children share one profile, Player 2 is the friend `DUEL_HANDOVER` sends to the top half, and a certificate
   * filed in this save saying a duel was won has to be about the child whose save it is. A draw and a Player 2
   * win earn nothing for the same reason #347 pays no win bonus — there is no second profile to award.
   *
   * `correct`/`attempts` are Player 1's own slices (`duelAccuracy()`), not the scoreline: the printed
   * "5/6 correct (83%)" then means the same thing it means on a mission certificate. `score` is `scoreA`, the
   * rounds this child actually took, which is what `fileCert()` breaks a stars tie on.
   */
  function duelCert(r: DuelResult): CertInfo | null {
    if (!duelEarnsCertificate(r)) return null;      // the predicate is in game/duel.ts so all three winners are unit-pinned
    const t = duelAccuracy(r);
    return {
      name: d.name, avatar: av, year: o.year.title, title: `Ninja Duel · ${topic.title}`,   // #670: names the topic, not just the mode
      stars: duelStars(t), score: r.scoreA, correct: t.hits, attempts: t.tries, duel: true, date: new Date(),
    };
  }
  return { m, commitOnce, showResults };
}

/** The 🎓 button's behaviour on the results overlay: draw, deliver and report inside the modal (#436). */
function wireCertificate(deps: ResultsDeps, earned: CertInfo) {
  const { d, overlay, scope } = deps;
  // #436: this outcome fires while `#overlay` is up, and the shared `#toast` sits BEHIND it (`grid-area: q`,
  // z-index 3, under the overlay's z-index 5) — a child who taps 🎓 never saw whether it worked. `certMsg`
  // reports inside the modal itself instead, next to the button that earned it, where nothing can cover it.
  //
  // Scoped to `overlay` (round-1 review, B2), not a bare `$`: `deliverCertificate`/`drawCertificate` carry
  // several real `await` points (fonts, canvas encode, the share sheet, a native filesystem round trip),
  // long enough for a child to Rematch/Islands/Quit mid-flight. That tears this screen down and builds a new
  // one with its own `#cert-msg` — a bare `$('#cert-msg')` would write the OLD match's outcome into the NEW
  // match's live element. Scoped to the closed-over `overlay`, a write after teardown lands on that overlay's
  // own now-detached copy instead, where nobody is looking.
  //
  // Revealed, THEN mutated (round-1 review note): `hidden` and `textContent` set in the same synchronous step
  // is the same unreliable live-region pattern this file's own `#toast` avoids by never using `hidden` at all
  // (visibility toggled by a class, mutation always into an element already in the layout). `#cert-msg` starts
  // `hidden` so nothing shows before a certificate exists to report on; the reveal goes out one task ahead of
  // the text so assistive tech sees the region exist before it changes.
  const certMsg = (text: string, bad = false) => {
    const el = $('#cert-msg', overlay);
    el.hidden = false; el.classList.toggle('bad', bad);
    requestAnimationFrame(() => { el.textContent = text; });
  };
  $('#cert', overlay).addEventListener('click', async () => {
    sfx.tap();
    const b = $('#cert', overlay) as HTMLButtonElement; b.disabled = true;
    // Cleared before this attempt starts (round-1 review, B3): the 'shown' route below never calls `certMsg`
    // (the full-screen view carries its own save hint), so a stale error from an earlier failed attempt would
    // otherwise still be sitting there, unread, once the child closes a screen that just worked fine.
    const msg = $('#cert-msg', overlay); msg.hidden = true; msg.textContent = '';
    try {
      const how = await deliverCertificate(await drawCertificate(earned), `sky-ninja-duel-${(d.name || 'ninja').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`, () => askGrownUp('share the certificate'));
      if (!scope.alive) return;   // torn down mid-delivery — see the comment on `certMsg` above
      if (how === 'shared') certMsg('Certificate shared!');
      else if (how === 'saved' || how === 'downloaded') certMsg('Certificate saved!');
      else if (how === 'declined') certMsg('No problem — you can save it next time!');
      // 'shown' opens the full-screen view with its own save hint — the reset above already cleared any
      // earlier message, so there is nothing left to show here.
    }
    catch (e) { console.error('certificate delivery failed', e); if (scope.alive) certMsg('Could not make the certificate', true); }
    b.disabled = false;
  });
}
