// Ninja Duel screen (#16 items 2–4): two players on one device. The screen is split into two arenas, one per
// player, each fed the SAME question's bubbles. Where the split falls is `src/style.css`'s, not this file's
// (#388): sideways it is left and right with the question in a bar across the top, and the stacked portrait
// layout is only the fallback — so the DOM order below stays Player 2, card, Player 1 for both. The pure
// `Duel` scorer (src/game/duel.ts) owns the rules — first correct slice wins the round, a wrong slice costs
// nothing, best of DUEL_ROUNDS — and this file only wires two `Arena`s, the strip, the match-end overlay and
// the `window.__sna` hooks the e2e drives it through. A finished match pays coins into the one shared save
// (item 5's coins and stickers), marks the daily streak (#355), tells the Daily Dojo what the device answered
// and teaches Sensei what Player 1 found hard on this topic, files a certificate when Player 1 wins, and
// records the match itself in the duel history the rewards screen lists.
import { avatarById, SENSEI } from '../avatars';
import { topicsFor, type Question, type YearInfo } from '../curriculum';
import { Arena, hittable } from '../game/arena';
import { Duel, DUEL_PLAYERS, duelAccuracy, duelCoins, duelDojoEvent, duelEarnsCertificate, duelHeadline, duelHistoryLine, duelPool, duelStars, seededRng, spokenQuestion, type DuelPlayer, type DuelResult, type DuelTally } from '../game/duel';
import { gameSpeed, scaled, setGameSpeed } from '../game/speed';
import { isReadOnlySave, isWriteFailing, load, recordAccuracy, recordCert, recordDuel, recordGameEnd, touchStreak, type GameEndOutcome, type StoredDuel } from '../storage';
import { certToStored, certWords, deliverCertificate, drawCertificate, type CertInfo } from './certificate';
import { canHear, haptic, say, sfx } from '../audio';
import { $, esc, render } from './dom';
import { hintText, promptHTML, promptMode } from './hud';
import { screenScope, stickersHTML } from './screen';
import { dojoRowsHTML } from './memory';
import { pauseHTML } from './overlays';
import { waveOptsFor } from './play-session';
import { renderVisual } from './visuals';
import { fontReady } from './font';
import type { DuelHooks } from './hooks';

export interface DuelScreenOpts { year: YearInfo }
const PLAYERS = DUEL_PLAYERS;
const NAME: Record<DuelPlayer, string> = { a: 'Player 1', b: 'Player 2' };
/** Outcome holds (ms, unscaled): the winning bubble stays lit this long before the next round. `miss` is the
 *  wrong-slice toast, which holds nothing back — the round keeps running — but is scaled with the other two so
 *  `setGameSpeed` stretches every verdict on this screen rather than all but one (PR #428 review, note 3). */
const HOLD = { won: 1000, draw: 900, miss: 900 } as const;
/**
 * The longest line this screen can put in the `#toast`, and the call site that raises it. Exported because the
 * layout rail in `tests/e2e/duel.spec.ts` measures what a *wrapped* verdict costs the arenas — the toast sits
 * in the question bar's own `grid-area: q` (`src/style.css`), so growing that row is the one way the placement
 * can still take height off both children, and the rail must probe the real worst case rather than a copy of it
 * that drifts the moment a longer line is added here (PR #428 review, B2). `tests/unit/guardrails.test.ts`
 * holds it to being the genuine longest across every `toast(` in this file.
 *
 * The certificate outcome ('Certificate saved!' etc.) used to be the longest candidate and raised this same
 * constant, but it never belonged to this class: it fires while the results overlay is up, and `#toast` sits
 * BEHIND that overlay (`#436`) — the child never saw it. It now reports through `#cert-msg`, inside the overlay
 * itself, so `#toast`'s only remaining raisers are the three round verdicts below, and this constant is the
 * longest of THOSE — the draw line, which now raises it directly rather than repeating its text.
 */
export const DUEL_TOAST_LONGEST = 'Nobody sliced it — no point';

export function duelScreen(o: DuelScreenOpts, goHome: () => void, replay: () => void) {
  const d = load(); const av = avatarById(d.avatar);
  const difficulty = o.year.diffs[0] ?? 1;          // the year's gentlest stage, for the pool AND the match
  const pool = duelPool(topicsFor(o.year.id), difficulty);
  if (!pool.length) throw new Error(`Ninja Duel: ${o.year.id} has no bubble topic to duel on`);   // before anything is built to leak
  const topic = pool[Math.floor(Math.random() * pool.length)];
  render(`
  <section class="screen play duel-screen" style="--glow:${av.glow}">
    <div class="duel-half b" id="half-b">
      <canvas class="duel-arena" id="arena-b" aria-label="Player 2 arena"></canvas>
      <div class="duel-tag"><b>${NAME.b}</b><span class="duel-score" id="score-b">0</span></div>
    </div>
    <div class="duel-strip" id="strip">
      <button class="icon-btn" id="pause" aria-label="Pause">⏸</button>
      <div class="duel-q" id="qcard">
        <span class="pill" id="round"></span>
        <div class="prompt" id="prompt"></div>
        <div class="vis-wrap" id="vis"></div>
        <div class="hint" id="hint"></div>
        <div class="duel-rotate">Sideways is better: one arena each, side by side 🔄</div>
      </div>
      <button class="icon-btn" id="speak" aria-label="Read the question aloud">🔊</button>
    </div>
    <div class="duel-half a" id="half-a">
      <canvas class="duel-arena" id="arena-a" aria-label="Player 1 arena"></canvas>
      <div class="duel-tag"><b>${NAME.a}</b><span class="duel-score" id="score-a">0</span></div>
    </div>
    <div class="toast" id="toast" aria-live="polite"></div>
    <div class="overlay" id="overlay" hidden></div>
  </section>`, 'bg-play');

  const scope = screenScope(); const { later, toast } = scope;
  const overlay = $('#overlay'); const prompt = $('#prompt'); const hintEl = $('#hint'); const speak = $('#speak');
  let waveId = 0; let holdOpen = false;
  /** What the card is showing under the prompt this round — pinned by the e2e against `#hint` (#16 review). */
  let hintLine = '';
  // The four below are written by `commitMatch`, so they carry their values from the moment the match is
  // SETTLED — which on a last round is up to ~1.45 s before `duel.ended` flips (#375 round 2, note 1). They
  // used to say "0 until the match ends"; that was true when the only writer ran inside the overlay, and it
  // is not true now. `window.__sna`'s `state()`, `certificate()` and `certWords()` read all four live, so an
  // e2e asking "what has been earned now?" between the last slice and `ended` gets the real answer, not null.
  /** Coins the finished match paid into the save; 0 until it is settled (#16 item 5). */
  let paid = 0;
  /** Daily Dojo bonus the finished match earned on top of `paid`; 0 until it is settled (#16 item 5). */
  let dojoPaid = 0;
  /** What the finished match taught Sensei about this topic — rounds answered, not slices; 0/0 until settled. */
  let taught: DuelTally = { hits: 0, tries: 0 };
  /** The certificate a Player 1 win earned, or null — the other two outcomes earn none (#16 item 5). */
  let cert: CertInfo | null = null;
  /** Whether `cert`'s write actually reached the store (#470) — `isWriteFailing()` read the instant after the
   *  attempt, per `save()`'s own contract that it reflects only the last write. `cert` itself stays set
   *  either way: it is what the match earned, which `window.__sna`'s `certificate()`/`certWords()` hooks
   *  answer about regardless of storage, same as before #470. Only the 🎓 row — which promises a keepsake
   *  kept in the album — reads this too, so a refused write is never offered as one. */
  let certSaved = false;
  let dojoSaved = false;   // same shape as certSaved, for recordGameEnd()'s write instead (#518)
  const waveDone: Record<DuelPlayer, boolean> = { a: true, b: true };
  const arenas = {} as Record<DuelPlayer, Arena>;

  const duel = new Duel({ topic, difficulty }, {
    onQuestion(q, info) {
      $('#round').textContent = `Round ${info.round} of ${info.total}`;
      // #65 through the play screen's own writers (#16 review): a `listen` question (Sound Hunt is in the pool)
      // shows its words on a device that cannot be heard, and the hint line carries the data five of the pool's
      // comparison topics keep nowhere else — without it "Which is fuller?" is two coloured bubbles and a guess.
      // A duel has no peek timing, so a peek question reads through here rather than hiding its text.
      // A BACKSTOP, not the mechanism: no verdict should still be up by the time its question is replaced. What
      // keeps the drawn round's verdict off the next question is `settleDraw()` in `waveEnd` below, which
      // announces it and advances a hold later. Clearing here was tried as the whole fix and was worse than the
      // bug — `onRoundDraw` and `onQuestion` share a synchronous task on the draw path, so the class was added
      // and removed before the browser painted a frame and the verdict was never shown AT ALL: two children got
      // `sfx.miss()` and nothing to read, on the outcome that most needs explaining (#425 review). Routed
      // through `clearToast()` rather than the element directly (#478): a direct `classList.remove` here left
      // an earlier `toast()` call's own hide timer still armed, and it fired into whatever the NEXT question's
      // verdict was showing by the time it did — the same silent retraction this backstop exists to prevent,
      // one question later.
      scope.clearToast();
      const reveal = promptMode(q, canHear()) !== 'hear';
      speak.hidden = reveal;
      prompt.innerHTML = promptHTML(q, 0, reveal); $('#vis').innerHTML = renderVisual(q.visual);
      hintLine = hintText(q, { reveal }); hintEl.textContent = hintLine;
      const myWave = ++waveId; waveDone.a = waveDone.b = false;
      const speed = o.year.speeds[0] ?? 2;
      const opts = waveOptsFor(q, { labels: q.options, speed }, 0);
      // #44: the first wave waits for Fredoka (cached after that); #138: a spawn that waited must still be this wave's.
      // Through `later(..., 0)` and not straight out of the promise (PR #474 review, B2). `waveId`/`alive`
      // are the only guards a raw continuation has, and neither reads the hold — so a pause pressed inside
      // this gate, up to the 1200ms cap on a cold font cache, let `say()` speak a question behind the overlay
      // and `spawnWave` land with `launchAt` already past. That is #301 word for word, in the one place the
      // fix did not reach. A 0ms beat defers rather than drops: frozen at 0 remaining, re-armed at 0 on
      // resume, so the wave goes up the moment the child comes back instead of never.
      fontReady().then(() => later(() => {
        if (waveId !== myWave || !scope.alive) return;
        // Round 1 carries the hand-over line in the same utterance. On a rematch it would be spoken in the very
        // task that `hush()` cancelled the old screen's voice in — the cancel-then-speak drop audio.ts documents —
        // so it goes out on the next task instead (PR #295 review).
        const line = spokenQuestion(q, info.round);
        if (info.round === 1) later(() => say(line), 0); else say(line);
        // #389: one draw and one clock origin for the whole round, so both halves pose the identical wave.
        // Each arena spawned from `Math.random` and its own `performance.now()`, so the answer took a
        // different slot in the launch queue on each side — at speed 1 a batch apart is over four seconds of
        // head start, and the match was decided by whose shuffle dealt it early rather than by who was
        // quicker. `topInset` is set for both above the draw because the plan is only shared while the
        // geometry is (`layoutWave` reads W, H and topInset); the rail in `guardrails.test.ts` holds that.
        //
        // Identical, not mirrored: both children see the answer in the same place at the same moment, which
        // is the fair reading of "the same question" — a mirror about the divider would make the two halves
        // look symmetrical while giving the left-handed and right-handed reach a different problem.
        const seed = (Math.random() * 0x100000000) >>> 0, at = performance.now();
        for (const p of PLAYERS) { arenas[p].topInset = 8; arenas[p].spawnWave(opts, { rng: seededRng(seed), now: at }); }
      }, scaled(0)));   // scaled(0) is 0 — a "next task", on the same clock every other beat here uses (#138)
    },
    onRoundWon(player, q) {
      sfx.correct(); haptic('slice');
      $(`#score-${player}`).textContent = String(player === 'a' ? duel.scoreA : duel.scoreB);
      toast(`${NAME[player]} takes the round!`, 'good', scaled(HOLD.won));
      const a = arenas[player]; a.floatText(a.W / 2, a.H * 0.35, '+1', av.glow);
      for (const p of PLAYERS) arenas[p].reveal({ good: q.answer });
      // #375 round 1, B1: winning the LAST round settles the match here, ~1.45 s before `onMatchEnd` can fire
      // — `endWave` below and the `waveEnd` timer after it are both scope-bound, and `duel.ended` stays false
      // for the whole chain, so `#pause` is live and `dispose()` cancels whichever has not run. Commit now.
      if (duel.onLastRound) commitOnce(duel.result());
      endWave(scaled(HOLD.won));
    },
    onRoundMiss(player) { sfx.wrong(); toast(`Not quite, ${NAME[player]}!`, 'bad', scaled(HOLD.miss)); },
    onRoundDraw() { sfx.miss(); toast(DUEL_TOAST_LONGEST, 'bad', scaled(HOLD.draw)); },
    // #375/#441: the match is **committed here, synchronously**, and only the overlay waits on the timer.
    // `later()` is scope-bound, so the ~1.3 s of pacing below is a window in which `cleanup()` — Pause →
    // Islands, or Android's hardware back — calls `scope.dispose()` and cancels the pending callback. When
    // every write lived inside it, a finished ten-round match paid the child nothing: no coins, no dojo move,
    // no accuracy, no certificate and no history row, with nothing to tell it from a match never played.
    onMatchEnd: r => { const p = commitOnce(r); if (p) later(() => showResults(r, p), scaled(HOLD.won) + scaled(300)); else hold(true, false); },
  });

  /** Freeze the wave while the winning answer is lit, then clear both arenas — each arena's onWaveEnd follows. */
  const endWave = (ms: number) => { const id = waveId; later(() => { if (waveId === id) for (const p of PLAYERS) arenas[p].clearWave('#ffffff'); }, ms); };
  /** One arena's wave finished; the round moves on once both have. */
  const waveEnd = (p: DuelPlayer) => {
    waveDone[p] = true;
    if (!waveDone.a || !waveDone.b) return;
    // The draw half of B1: a last round nobody sliced is settled the moment both waves run out, and a draw
    // scores nothing, so the result is already final — but `duel.waveEnd()` below, which is what would
    // register the draw and end the match, is a scope-bound timer a quit can still cancel. Commit before that.
    //
    // **What makes it final here is `Arena`'s own contract** (#375 round 2, note 6): `onWaveEnd` fires only at
    // `live === 0` (`arena.ts`), and every hit path requires `!b.dead`, so once BOTH arenas have reported
    // there is no bubble either child could still slice and no route left to `duel.hit()`. If that ever
    // changes — a wave that ends with bubbles still catchable — this commit stops being safe, silently.
    //
    // Settle the draw FIRST, so `result()` sees it (#379): `settleDraw()` is what tallies a 0/1 try for a seat
    // that never touched a bubble this round, and `result()`'s snapshot is frozen the instant it is taken — a
    // commit ahead of this line would permanently drop that seat's try from the match this pays. Both calls
    // stay synchronous, ahead of the scope-bound `later()` below, so which of the two runs first costs nothing;
    // it also lets the draw's verdict go up on the question it is about, before `onQuestion` replaces it —
    // `onRoundDraw` and `onQuestion` share a task, so clearing the toast on the next question instead added and
    // removed the class before a frame painted and the verdict was never shown at all (#425 review). `HOLD.draw
    // + 100` so advancing does not ride on two equal timers firing in the order they happened to be queued.
    const drew = duel.settleDraw();
    if (duel.onLastRound) commitOnce(duel.result());
    later(() => duel.waveEnd(), scaled(drew ? HOLD.draw + 100 : 450));
  };
  for (const p of PLAYERS) {
    arenas[p] = new Arena($(`#arena-${p}`) as HTMLCanvasElement, {
      onHit(b, viaSwipe) {
        const r = duel.hit(p, b.label);
        if (r !== 'ignored' && viaSwipe) { sfx.slice(); haptic('slice'); }
      },
      onFall() { /* no lives in a duel: a fallen bubble is just a bubble nobody sliced */ },
      onWaveEnd: () => waveEnd(p),
    }, { trailColor: av.glow, fx: av.fx, onSwish: () => sfx.swish(), onThrow: () => sfx.whoosh(), onLand: () => sfx.slice() });
  }
  const syncPaused = () => { for (const p of PLAYERS) arenas[p].paused = holdOpen || duel.ended; };
  // The arena's pause AND the screen's beats (#301): `syncPaused()` alone left `endWave`'s `clearWave`, the
  // `duel.waveEnd()` that follows it and the results cue running behind the pause overlay, so a pause inside
  // the outcome hold advanced the round and spawned the next wave out of sight.
  //
  // `beats` is false for a hold that NEVER LIFTS (PR #474 review, B1). Freezing beats is right for the pause
  // overlay, which reopens; it is exactly wrong for the results overlay, which does not — a beat armed after
  // that hold would sit in the set unarmed until `dispose()` threw it away, in silence. That cost this screen
  // the sticker jingle below and left every results toast pinned over the modal for the life of the screen.
  // The results hold still pauses both arenas (`syncPaused()` reads `duel.ended` too); it just leaves the
  // overlay's own presentation timers alone, which is what `main` did before #301 and is the only behaviour
  // the game is over for.
  const hold = (open: boolean, beats = true) => { if (open === holdOpen) return; holdOpen = open; if (beats) scope.holdTimers(open); syncPaused(); };

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
  let payout: GameEndOutcome | null = null;
  /** Whether `commitMatch` has been entered — see `commitOnce`, which sets it before the call, not after. */
  let committed = false;
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
    if (committed) return payout;
    committed = true;
    // The flag is set BEFORE commitMatch runs, not latched on its return (#375 round 2, note 3): a second
    // caller must see `committed` true even if this attempt is about to fail, or it would re-run the whole
    // sequence and double-pay. A throw is caught, not propagated (#508) — every caller gets `null` back.
    try { payout = commitMatch(r); }
    catch (e) { console.error('duel commit failed', r, e); toast("Couldn't save the match", 'bad'); }
    return payout;
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
    paid = duelCoins(r);
    // Sensei's half: the rounds Player 1 answered on this topic — one try each, the unit a mission writes — for
    // the seat `DUEL_HANDOVER` keeps for the profile's own child (`duelAccuracy()` has why neither the score nor
    // the round count may be used, and why a swiped wave is still one try). A separate write from
    // the coins below, exactly as `play.ts` already records accuracy separately from its payout — there is no
    // coins/challenge pairing to break here, and the two-write question on a results screen is #365's, not this
    // slice's to widen into. `recordTopic()` is deliberately NOT called: a duel earns no stars and is no `play`
    // of the topic, so a duel-only topic keeps `plays: 0` and `accuracy()` reads null for it — the same way a
    // topic met only in Sensei training or Sky Storm already behaves.
    taught = duelAccuracy(r);
    recordAccuracy(topic.id, taught);
    // #365: one write for the whole finished game — the dojo state and the coins it pays cannot land apart.
    const { dojo, fresh } = recordGameEnd(duelDojoEvent(r, topic.subject), paid);
    dojoPaid = dojo.coins;
    dojoSaved = !isWriteFailing() && !isReadOnlySave();   // #518: read before touchStreak() below overwrites the flag
    // #355 (owner decision, 2026-09-24): a finished duel marks the daily streak, the same as every other
    // finished game (`play.ts`, `memory.ts`) — ten real questions answered at the same coin rate is real
    // practice, whichever seat took the round. `touchStreak()` is idempotent within a day, so a rematch on
    // the same day costs nothing extra.
    touchStreak();
    cert = duelCert(r);
    // Reset with `cert`, not left to the caller (#470 review, type-design-analyzer): `certSaved` must never
    // outlive the `cert` it describes, and pinning that to `commitOnce`'s single-invocation guarantee alone
    // would make the invariant one refactor away from breaking silently.
    certSaved = false;
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
    if (cert) { recordCert(certToStored(cert, { id: `${o.year.id}:duel` })); certSaved = !isWriteFailing() && !isReadOnlySave(); }
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
    if (dojoSaved && (fresh.length || dojo.completed.length)) later(() => sfx.stage(), scaled(600));   // #138/#518: no jingle either, for a refused write
    // #444 review (PR #502 round 2), B1: an incomplete match has no winner worth announcing — `duelHeadline()`
    // would read a scoreline nobody decided as if the match had run its course. Everything already earned
    // (the coins/dojo/Sensei writes above) still shows; only the winner framing and the certificate are withheld.
    const headline = r.incomplete ? 'That question broke — here is what you earned so far!' : duelHeadline(r);
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
    const earned = certSaved ? cert : null;
    overlay.hidden = false;
    overlay.innerHTML = `
      <div class="modal results duel-end">
        <div class="scroll">
          <div class="hero-big sensei" style="--glow:${SENSEI.glow}"><img src="${SENSEI.img}" alt="${SENSEI.name}"><div class="speech">${esc(headline)}</div></div>
          <h2>${r.incomplete ? 'Match ended early' : r.winner === 'draw' ? 'A draw!' : `${esc(NAME[r.winner])} wins!`}</h2>
          <div class="statgrid duel-final"><div><b>${r.scoreA}</b><small>${NAME.a}</small></div><div><b>${r.rounds}</b><small>rounds</small></div><div><b>${r.scoreB}</b><small>${NAME.b}</small></div></div>
          <div class="coin-row"><span class="coin-gain">+${paid} 🪙</span></div>
          ${dojoSaved ? dojoRowsHTML(dojo) : ''}
          ${dojoSaved ? stickersHTML(fresh) : ''}
          ${earned ? '<div class="row"><button class="btn big cert" id="cert" aria-label="Save a certificate for this duel">🎓 Certificate</button></div><p class="cert-msg" id="cert-msg" role="status" hidden></p>' : ''}
        </div>
        <div class="row nav"><button class="btn primary big" id="again">Rematch ⚔️</button><button class="btn big" id="home">Islands</button></div>
      </div>`;
    $('#again').addEventListener('click', () => { sfx.tap(); cleanup(); replay(); });
    $('#home').addEventListener('click', () => { sfx.tap(); cleanup(); goHome(); });
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
    if (earned) $('#cert', overlay).addEventListener('click', async () => {
      sfx.tap();
      const b = $('#cert', overlay) as HTMLButtonElement; b.disabled = true;
      // Cleared before this attempt starts (round-1 review, B3): the 'shown' route below never calls `certMsg`
      // (the full-screen view carries its own save hint), so a stale error from an earlier failed attempt would
      // otherwise still be sitting there, unread, once the child closes a screen that just worked fine.
      const msg = $('#cert-msg', overlay); msg.hidden = true; msg.textContent = '';
      try {
        const how = await deliverCertificate(await drawCertificate(earned), `sky-ninja-duel-${(d.name || 'ninja').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`);
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
      name: d.name, avatar: av, year: o.year.title, title: 'Ninja Duel',
      stars: duelStars(t), score: r.scoreA, correct: t.hits, attempts: t.tries, duel: true, date: new Date(),
    };
  }
  function showPause() {
    hold(true); overlay.hidden = false; overlay.innerHTML = pauseHTML();
    $('#resume').addEventListener('click', () => { overlay.hidden = true; hold(false); });
    $('#quit').addEventListener('click', () => { cleanup(); goHome(); });
  }
  const repeat = () => { const q = duel.current; if (q) say(q.say ?? q.prompt, true); };
  $('#pause').addEventListener('click', () => { sfx.tap(); showPause(); });
  $('#speak').addEventListener('click', repeat);
  $('#qcard').addEventListener('click', e => { if ((e.target as HTMLElement).closest('button')) return; repeat(); });
  // #73: a route change tears the arenas down — two rAF loops leaked across screens would be twice the incident.
  function cleanup() { for (const p of PLAYERS) arenas[p].destroy(); scope.dispose(); }

  const target = (p: DuelPlayer, wrong: boolean): string | undefined => {
    const q: Question | null = duel.current; if (!q) return undefined;
    if (!wrong) return q.answer;
    return arenas[p].bubbles.find(x => hittable(x) && x.label !== q.answer)?.label;
  };
  const hooks: DuelHooks = {
    duel, arenas,
    answer: p => { const t = target(p, false); return t !== undefined && arenas[p].hitLabel(t); },
    wrong: p => { const t = target(p, true); return t !== undefined && arenas[p].hitLabel(t); },
    bubbles: p => arenas[p].bubbles.filter(hittable).map(b => ({ label: b.label, x: b.x, y: b.y, r: b.r, vy: b.vy, lines: b.lines, labelState: b.labelState })),
    state: () => ({
      mode: 'duel', round: duel.round, rounds: duel.rounds, scoreA: duel.scoreA, scoreB: duel.scoreB,
      decided: duel.roundDecided, ended: duel.ended, prompt: duel.current?.prompt, answer: duel.current?.answer, topic: topic.id,
      hint: hintLine, coins: paid, dojoCoins: dojoPaid, taught,
    }),
    certificate: async () => cert ? (await drawCertificate(cert)).toDataURL('image/png') : null,
    // The words that go on the drawn certificate. A byte count cannot tell one ninja's signature from another,
    // which is how a wrong `avatar` survived round 1's rails (#397 round 2, B1).
    certWords: () => cert ? certWords(cert) : null,
    setSpeed: k => { setGameSpeed(k); },
    timing: () => ({ speed: gameSpeed(), hold: { won: scaled(HOLD.won), draw: scaled(HOLD.draw), miss: scaled(HOLD.miss) } }),
  };
  window.__sna = hooks;
  duel.start();
  return cleanup;
}

/**
 * "Recent duels" on the rewards screen (#16, the last piece of item 5): a row per finished match, most recent
 * first, or an empty-state hint. Pure and unit-tested without a DOM, exactly as `certAlbumHTML` is, and it
 * deliberately **reuses that album's markup** — `cert-list`, `cert-row`, `cert-info` — rather than inventing a
 * second list. Two lists a few pixels apart in different classes would be a new look on a screen whose look is
 * settled; this is the same row with the scoreline where the stars sit, and no View button, because a duel has
 * nothing to redraw.
 *
 * **Every borrowed class carries a `duel-` twin**: `cert-list duel-list`, `cert-row duel-row`, and the
 * empty state is `duel-empty` alone. The rules come from the album; the *names* have to stay tellable apart.
 * Reusing the name looked right — same box, same shape of words — and it silently broke the certificate
 * album's own e2e, which asserts `.cert-empty` has count 0 to mean "a certificate is listed". One class
 * cannot mean both "no certificates" and "no duels" on a screen that shows both lists at once.
 *
 * The date carries no year. A certificate is a keepsake, so its row says "14 Sep 2026"; twenty duels from the
 * last fortnight all say the same year, and the row has a scoreline to fit alongside it on a 320px phone.
 */
export function duelHistoryHTML(duels: StoredDuel[]): string {
  if (!duels.length) return '<p class="duel-empty">Hand the device to a friend and play a Ninja Duel — every match you finish shows up here.</p>';
  const rows = duels.map(m => {
    const day = new Date(m.at);
    const date = Number.isNaN(day.getTime()) ? '' : day.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    const sub = `${esc(m.year)}${date ? ` · ${date}` : ''}`;
    const ava = '<span class="cert-ava duel-ava" aria-hidden="true">⚔️</span>';
    const info = `<div class="cert-info"><b>${esc(m.title)}</b><small>${sub}</small></div>`;
    return `<div class="cert-row duel-row">${ava}${info}<span class="duel-line">${esc(duelHistoryLine(m))}</span></div>`;
  }).join('');
  return `<div class="cert-list duel-list">${rows}</div>`;
}
