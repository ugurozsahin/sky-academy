// Ninja Duel screen (#16 items 2–4): two players on one device. The screen is split into two arenas, one per
// player, each fed the SAME question's bubbles. Where the split falls is `src/style.css`'s, not this file's
// (#388): sideways it is left and right with the question in a bar across the top, and the stacked portrait
// layout is only the fallback — so the DOM order below stays Player 2, card, Player 1 for both. The pure
// `Duel` scorer (src/game/duel.ts) owns the rules — first correct slice wins the round, a wrong slice costs
// nothing, best of DUEL_ROUNDS — and this file only wires two `Arena`s, the strip, the match-end overlay and
// the `window.__sna` hooks the e2e drives it through. A finished match pays coins into the one shared save
// (item 5's coins and stickers), tells the Daily Dojo what the device answered and teaches Sensei what Player 1
// found hard on this topic and files a certificate when Player 1 wins; a duel history is still deferred.
import { avatarById, SENSEI } from '../avatars';
import { topicsFor, type Question, type YearInfo } from '../curriculum';
import { Arena, type Bubble } from '../game/arena';
import { Duel, duelAccuracy, duelCoins, duelDojoEvent, duelEarnsCertificate, duelHeadline, duelPool, duelStars, seededRng, spokenQuestion, type DuelPlayer, type DuelResult, type DuelTally } from '../game/duel';
import { gameSpeed, scaled, setGameSpeed } from '../game/speed';
import { addCoins, load, recordAccuracy, recordCert, recordDojo } from '../storage';
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
const PLAYERS = ['a', 'b'] as const;
const NAME: Record<DuelPlayer, string> = { a: 'Player 1', b: 'Player 2' };
/** Outcome holds (ms, unscaled): the winning bubble stays lit this long before the next round. */
const HOLD = { won: 1000, draw: 900 } as const;

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
  const toastEl = $('#toast');
  let waveId = 0; let holdOpen = false;
  /** What the card is showing under the prompt this round — pinned by the e2e against `#hint` (#16 review). */
  let hintLine = '';
  /** Coins the finished match paid into the save; 0 until the match ends (#16 item 5). */
  let paid = 0;
  /** Daily Dojo bonus the finished match earned on top of `paid`; 0 until the match ends (#16 item 5). */
  let dojoPaid = 0;
  /** What the finished match taught Sensei about this topic — rounds answered, not slices; 0/0 until it ends. */
  let taught: DuelTally = { hits: 0, tries: 0 };
  /** The certificate a Player 1 win earned, or null — the other two outcomes earn none (#16 item 5). */
  let cert: CertInfo | null = null;
  const waveDone: Record<DuelPlayer, boolean> = { a: true, b: true };
  const arenas = {} as Record<DuelPlayer, Arena>;

  const duel = new Duel({ topic, difficulty }, {
    onQuestion(q, info) {
      $('#round').textContent = `Round ${info.round} of ${info.total}`;
      // #65 through the play screen's own writers (#16 review): a `listen` question (Sound Hunt is in the pool)
      // shows its words on a device that cannot be heard, and the hint line carries the data five of the pool's
      // comparison topics keep nowhere else — without it "Which is fuller?" is two coloured bubbles and a guess.
      // A duel has no peek timing, so a peek question reads through here rather than hiding its text.
      // The verdict on the last round does not belong over this one's question. `waveEnd()` calls `onRoundDraw`
      // and then `advance()` in the SAME synchronous task, so on a drawn round the toast text is set and the card
      // is rewritten before the browser paints: "Nobody sliced it — no point" then fades in on top of the next
      // question and sits there for a full second, and the two are never on screen together. (The won path does
      // not overlap — `onRoundWon` defers through `endWave` — but clearing here is right for it too.) Draws are
      // common at Reception and Year 1 speeds, and this only became visible when the toast moved onto the card.
      toastEl.classList.remove('show');
      const reveal = promptMode(q, canHear()) !== 'hear';
      speak.hidden = reveal;
      prompt.innerHTML = promptHTML(q, 0, reveal); $('#vis').innerHTML = renderVisual(q.visual);
      hintLine = hintText(q, { reveal }); hintEl.textContent = hintLine;
      const myWave = ++waveId; waveDone.a = waveDone.b = false;
      const speed = o.year.speeds[0] ?? 2;
      const opts = waveOptsFor(q, { labels: q.options, speed }, 0);
      // #44: the first wave waits for Fredoka (cached after that); #138: a spawn that waited must still be this wave's.
      fontReady().then(() => {
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
      });
    },
    onRoundWon(player, q) {
      sfx.correct(); haptic('slice');
      $(`#score-${player}`).textContent = String(player === 'a' ? duel.scoreA : duel.scoreB);
      toast(`${NAME[player]} takes the round!`, 'good', scaled(HOLD.won));
      const a = arenas[player]; a.floatText(a.W / 2, a.H * 0.35, '+1', av.glow);
      for (const p of PLAYERS) arenas[p].reveal({ good: q.answer });
      endWave(scaled(HOLD.won));
    },
    onRoundMiss(player) { sfx.wrong(); toast(`Not quite, ${NAME[player]}!`, 'bad', 900); },
    onRoundDraw() { sfx.miss(); toast('Nobody sliced it — no point', 'bad', scaled(HOLD.draw)); },
    onMatchEnd: r => later(() => showResults(r), scaled(HOLD.won) + scaled(300)),
  });

  /** Freeze the wave while the winning answer is lit, then clear both arenas — each arena's onWaveEnd follows. */
  const endWave = (ms: number) => { const id = waveId; later(() => { if (waveId === id) for (const p of PLAYERS) arenas[p].clearWave('#ffffff'); }, ms); };
  /** One arena's wave finished; the round moves on once both have. */
  const waveEnd = (p: DuelPlayer) => {
    waveDone[p] = true;
    if (!waveDone.a || !waveDone.b) return;
    later(() => duel.waveEnd(), scaled(duel.roundDecided ? 450 : 650));
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
  const hold = (open: boolean) => { holdOpen = open; syncPaused(); };

  function showResults(r: DuelResult) {
    hold(true);
    // #16 item 5: the match pays into the one shared save before the overlay is built, so the coin row and
    // any sticker it unlocked are on the screen the children are already looking at. The Daily Dojo hears
    // about the match here too — ten questions answered correctly on this screen move the day's volume
    // challenges exactly as they would in any other mode — and its bonus rides the same single addCoins().
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
    recordAccuracy(topic.id, taught.hits, taught.tries);
    const dojo = recordDojo(duelDojoEvent(r, topic.subject));
    dojoPaid = dojo.coins;
    const fresh = addCoins(paid + dojoPaid);
    cert = duelCert(r);
    // #205's rule, unchanged here: filed the moment the overlay is built, never from the 🎓 button, because the
    // bug that issue opened with is a device where pressing the button does nothing at all.
    //
    // Built **from** the drawn `CertInfo` rather than beside it (#16 review, B1): the field list was hand-copied,
    // so `duel: true` had two independent writers and deleting the one that reaches the printed certificate left
    // every test green while the album and the child's keepsake disagreed about what had been won. `certToStored`
    // is now the only writer, so the e2e's stored assertions cover the drawn object too.
    if (cert) recordCert(certToStored(cert, { id: `${o.year.id}:duel` }));
    if (fresh.length || dojo.completed.length) later(() => sfx.stage(), scaled(600));   // #138: the unlock jingle after the headline, not over it
    const headline = duelHeadline(r); say(headline);
    overlay.hidden = false;
    overlay.innerHTML = `
      <div class="modal results duel-end">
        <div class="hero-big sensei" style="--glow:${SENSEI.glow}"><img src="${SENSEI.img}" alt="${SENSEI.name}"><div class="speech">${esc(headline)}</div></div>
        <h2>${r.winner === 'draw' ? 'A draw!' : `${esc(NAME[r.winner])} wins!`}</h2>
        <div class="statgrid duel-final"><div><b>${r.scoreA}</b><small>${NAME.a}</small></div><div><b>${r.rounds}</b><small>rounds</small></div><div><b>${r.scoreB}</b><small>${NAME.b}</small></div></div>
        <div class="coin-row"><span class="coin-gain">+${paid} 🪙</span></div>
        ${dojoRowsHTML(dojo)}
        ${stickersHTML(fresh)}
        ${cert ? '<div class="row"><button class="btn big cert" id="cert" aria-label="Save a certificate for this duel">🎓 Certificate</button></div>' : ''}
        <div class="row"><button class="btn primary big" id="again">Rematch ⚔️</button><button class="btn big" id="home">Islands</button></div>
      </div>`;
    $('#again').addEventListener('click', () => { sfx.tap(); cleanup(); replay(); });
    $('#home').addEventListener('click', () => { sfx.tap(); cleanup(); goHome(); });
    // Captured, not read back off `cert`: this handler is async and fires long after this frame, and it must
    // draw the certificate *this* match earned, so it binds the value the `if` tested. The `certificate()` hook
    // below deliberately does the opposite and reads the live binding — it is asked "what has been earned
    // now?" and has to answer null before the match ends (#16 review, note 7).
    const earned = cert;
    if (earned) $('#cert').addEventListener('click', async () => {
      sfx.tap(); const b = $('#cert') as HTMLButtonElement; b.disabled = true;
      try {
        const how = await deliverCertificate(await drawCertificate(earned), `sky-ninja-duel-${(d.name || 'ninja').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`);
        if (how === 'shared') toast('Certificate shared!', 'good');
        else if (how === 'saved' || how === 'downloaded') toast('Certificate saved!', 'good');
        else if (how === 'declined') toast('No problem — you can save it next time!', 'good');
        // 'shown' opens the full-screen view with its own save hint, so no toast
      }
      catch { toast('Could not make the certificate', 'bad'); }
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

  /** A bubble a player can still slice — the one predicate `bubbles()` and `wrong()` share. */
  const inFlight = (b: Bubble) => b.launched && !b.dead && !b.hit && !b.fade;
  const target = (p: DuelPlayer, wrong: boolean): string | undefined => {
    const q: Question | null = duel.current; if (!q) return undefined;
    if (!wrong) return q.answer;
    return arenas[p].bubbles.find(x => inFlight(x) && x.label !== q.answer)?.label;
  };
  const hooks: DuelHooks = {
    duel, arenas,
    answer: p => { const t = target(p, false); return t !== undefined && arenas[p].hitLabel(t); },
    wrong: p => { const t = target(p, true); return t !== undefined && arenas[p].hitLabel(t); },
    bubbles: p => arenas[p].bubbles.filter(inFlight).map(b => ({ label: b.label, x: b.x, y: b.y, r: b.r, vy: b.vy })),
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
    timing: () => ({ speed: gameSpeed(), hold: { won: scaled(HOLD.won), draw: scaled(HOLD.draw) } }),
  };
  window.__sna = hooks;
  duel.start();
  return cleanup;
}
