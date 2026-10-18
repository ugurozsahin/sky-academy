// The Ninja Duel's round beats (#1499), split out of `duelScreen`: the `Duel`'s callbacks (the question beat, the
// round verdicts, the match end) and the wave beat beside them — `endWave`, `waveEnd`, `syncPaused` and `hold`.
// This is wiring, not rules (`Duel`, src/game/duel.ts, owns those): every timing, element id and class is the one
// `duelScreen` had inline. What stays on the screen is what pays and shows the match — `commitOnce`/`commitMatch`,
// the results overlay and the `window.__sna` hooks — handed in as `commitOnce` and `showResults`. The `Duel` is
// built from `callbacks` and then given back through `bind()`, because the callbacks read it (its scores, its
// `ended`) and it cannot exist before they do.
import type { Avatar } from '../avatars';
import type { YearInfo } from '../curriculum';
import type { Arena } from '../game/arena';
import { DUEL_PLAYERS, seededRng, spokenQuestion, type Duel, type DuelEvents, type DuelPlayer, type DuelResult } from '../game/duel';
import { scaled } from '../game/speed';
import type { GameEndOutcome } from '../storage';
import { canHear, haptic, say, sfx } from '../audio';
import { $ } from './dom';
import { fontReady } from './font';
import { hintText, promptHTML, promptMode } from './hud';
import { waveOptsFor } from './play-session';
import type { ScreenScope } from './screen';
import { renderVisual } from './visuals';

const PLAYERS = DUEL_PLAYERS;
/** Outcome holds (ms, unscaled): the winning bubble stays lit this long before the next round. `miss` is the
 *  wrong-slice toast, which holds nothing back — the round keeps running — but is scaled with the other two so
 *  `setGameSpeed` stretches every verdict on this screen rather than all but one (PR #428 review, note 3). */
export const HOLD = { won: 1000, draw: 900, miss: 900 } as const;
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

/** What the beats need from the screen around them. The arenas are filled in by the screen after the beats exist. */
export interface DuelBeatDeps {
  o: { year: YearInfo };
  av: Avatar;
  NAME: Record<DuelPlayer, string>;
  scope: ScreenScope;
  arenas: Record<DuelPlayer, Arena>;
  /** Commit the finished match exactly once (`duelScreen`'s, #375/#441); null when the commit failed. */
  commitOnce: (r: DuelResult) => GameEndOutcome | null;
  showResults: (r: DuelResult, payout: GameEndOutcome) => void;
}

export function createDuelBeats(d: DuelBeatDeps) {
  const { o, av, NAME, scope, arenas, commitOnce, showResults } = d;
  const { later, toast } = scope;
  const prompt = $('#prompt'); const hintEl = $('#hint'); const speak = $('#speak');
  let waveId = 0; let holdOpen = false;   // holdOpen mirrors the Pause overlay (and the results hold)
  /** What the card is showing under the prompt this round — pinned by the e2e against `#hint` (#16 review). */
  let hintLine = '';
  const waveDone: Record<DuelPlayer, boolean> = { a: true, b: true };
  let duel!: Duel; let bound = false;   // the `Duel` constructor fires no event; `start()` does, after `bind()`
  const callbacks: DuelEvents = {
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
      const opts = waveOptsFor(q, { labels: q.options, speed });
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
        // different launch slot on each side — a four-option duel wave is one batch (#400), worst case 1.26 s
        // at speed 1 — and the match was decided by whose shuffle dealt it early, not by who was quicker.
        // `topInset` is set for both above the draw because the plan is only shared while the geometry is
        // (`layoutWave` reads W, H and topInset); the rail in `guardrails.test.ts` holds that.
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
  };
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
  return {
    callbacks,
    /** Hand over the `Duel` built from `callbacks`. */
    bind(built: Duel) { if (bound) throw new Error('createDuelBeats: bind() called twice'); bound = true; duel = built; },
    waveEnd, hold,
    get hintLine() { return hintLine; },
  };
}
