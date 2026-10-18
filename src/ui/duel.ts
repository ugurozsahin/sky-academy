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
import { avatarById } from '../avatars';
import { topicsFor, type Question, type YearInfo } from '../curriculum';
import { Arena, hittable } from '../game/arena';
import { Duel, DUEL_PLAYERS, duelHistoryLine, duelPool, seededRng, spokenQuestion, type DuelPlayer } from '../game/duel';
import { gameSpeed, scaled, setGameSpeed } from '../game/speed';
import { load, type StoredDuel } from '../storage';
import { certWords, drawCertificate } from './certificate';
import { canHear, haptic, hush, say, sfx } from '../audio';
import { $, esc, render } from './dom';
import { hintText, promptHTML, promptMode } from './hud';
import { pushBackGuard, screenScope, stickersHTML } from './screen';
import { dojoRowsHTML } from './memory';
import { pauseHTML } from './overlays';
import { createDuelResults } from './duel-results';
import { waveOptsFor } from './play-session';
import { renderVisual } from './visuals';
import { duelTopic } from '../game/duel-topic'; import { fontReady } from './font'; import { calmReduced } from '../device-settings';
import type { DuelHooks } from './hooks';

export interface DuelScreenOpts { year: YearInfo; topic?: string; labels?: 'players' | 'teams' }   // #958: 'teams' names the seats Team A / Team B
const PLAYERS = DUEL_PLAYERS;
const NAMES: Record<'players' | 'teams', Record<DuelPlayer, string>> = { players: { a: 'Player 1', b: 'Player 2' }, teams: { a: 'Team A', b: 'Team B' } };
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
  const d = load(); const av = avatarById(d.avatar); const NAME = NAMES[o.labels ?? 'players'];
  const difficulty = o.year.diffs[0] ?? 1;          // the year's gentlest stage, for the pool AND the match
  const pool = duelPool(topicsFor(o.year.id), difficulty);
  if (!pool.length) throw new Error(`Ninja Duel: ${o.year.id} has no bubble topic to duel on`);   // before anything is built to leak
  const topic = duelTopic(pool, o.topic, Math.random);
  render(`
  <section class="screen play duel-screen" style="--glow:${av.glow}">
    <div class="duel-half b" id="half-b">
      <canvas class="duel-arena" id="arena-b" aria-label="${NAME.b} arena"></canvas>
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
      <canvas class="duel-arena" id="arena-a" aria-label="${NAME.a} arena"></canvas>
      <div class="duel-tag"><b>${NAME.a}</b><span class="duel-score" id="score-a">0</span></div>
    </div>
    <div class="toast" id="toast" aria-live="polite"></div>
    <div class="overlay" id="overlay" hidden></div>
  </section>`, 'bg-play');

  const scope = screenScope(); const { later, toast, onBack, onHidden } = scope; onBack(pauseIfLive); scope.onKeys({ pause: pauseIfLive, repeat: () => overlay.hidden && (repeat(), true) }); onHidden(() => { hush(); pauseIfLive(); }); pushBackGuard();   // #885, #886, #887, #902
  const overlay = $('#overlay'); const prompt = $('#prompt'); const hintEl = $('#hint'); const speak = $('#speak');
  let waveId = 0; let holdOpen = false; let paused = false;   // #886: mirrors the Pause overlay, for state()
  /** What the card is showing under the prompt this round — pinned by the e2e against `#hint` (#16 review). */
  let hintLine = '';
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
    }, { trailColor: av.glow, fx: av.fx, reducedMotion: calmReduced(), onSwish: () => sfx.swish(), onThrow: () => sfx.whoosh(), onLand: () => sfx.slice() });
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
  const { m, commitOnce, showResults } = createDuelResults({ o, topic, NAME, d, av, overlay, scope, hold, cleanup, goHome, replay });

  function showPause() {
    hold(true); overlay.hidden = false; overlay.innerHTML = pauseHTML(); paused = true;
    $('#resume').addEventListener('click', () => { overlay.hidden = true; hold(false); paused = false; pushBackGuard(); });   // #887: re-arm, already consumed by the press that opened this
    $('#quit').addEventListener('click', () => { cleanup(); goHome(); });
  }
  function pauseIfLive(): boolean { if (!overlay.hidden || duel.ended) return false; showPause(); return true; }   // #885, #884's shape
  const repeat = () => { const q = duel.current; if (q) say(q.say ?? q.prompt, true); };
  $('#pause').addEventListener('click', () => { sfx.tap(); showPause(); });
  $('#speak').addEventListener('click', repeat); $('#qcard').addEventListener('click', e => { if ((e.target as HTMLElement).closest('button')) return; repeat(); });
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
      hint: hintLine, coins: m.paid, dojoCoins: m.dojoPaid, taught: m.taught, paused,
    }),
    certificate: async () => m.cert ? (await drawCertificate(m.cert)).toDataURL('image/png') : null,
    // The words that go on the drawn certificate. A byte count cannot tell one ninja's signature from another,
    // which is how a wrong `avatar` survived round 1's rails (#397 round 2, B1).
    certWords: () => m.cert ? certWords(m.cert) : null,
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
