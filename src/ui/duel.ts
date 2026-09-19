// Ninja Duel screen (#16 items 2–4): two players on one device. The screen is split into two arenas, one per
// player, each fed the SAME question's bubbles; the shared question sits in a strip between them. The pure
// `Duel` scorer (src/game/duel.ts) owns the rules — first correct slice wins the round, a wrong slice costs
// nothing, best of DUEL_ROUNDS — and this file only wires two `Arena`s, the strip, the match-end overlay and
// the `window.__sna` hooks the e2e drives it through. No reward economy yet (item 5, deferred on the issue).
import { avatarById, SENSEI } from '../avatars';
import { topicsFor, type Question, type YearInfo } from '../curriculum';
import { Arena } from '../game/arena';
import { Duel, duelHeadline, duelPool, type DuelPlayer, type DuelResult } from '../game/duel';
import { gameSpeed, scaled, setGameSpeed } from '../game/speed';
import { load } from '../storage';
import { haptic, say, sfx } from '../audio';
import { $, esc, render } from './dom';
import { screenScope } from './screen';
import { pauseHTML } from './overlays';
import { waveOptsFor } from './play-session';
import { renderVisual } from './visuals';
import { fontReady } from './font';
import type { DuelHooks } from './hooks';

export interface DuelOpts { year: YearInfo }
const PLAYERS: DuelPlayer[] = ['a', 'b'];
const NAME: Record<DuelPlayer, string> = { a: 'Player 1', b: 'Player 2' };
/** Outcome holds (ms, unscaled): the winning bubble stays lit this long before the next round. */
const HOLD = { won: 1000, draw: 900 };

export function duelScreen(o: DuelOpts, goHome: () => void, replay: () => void) {
  const d = load(); const av = avatarById(d.avatar);
  const pool = duelPool(topicsFor(o.year.id), o.year.diffs[0] ?? 1);
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
  const overlay = $('#overlay'); const prompt = $('#prompt');
  let waveId = 0; let holdOpen = false;
  const waveDone: Record<DuelPlayer, boolean> = { a: true, b: true };
  const arenas = {} as Record<DuelPlayer, Arena>;

  const duel = new Duel({ topic, difficulty: o.year.diffs[0] ?? 1 }, {
    onQuestion(q, info) {
      $('#round').textContent = `Round ${info.round} of ${info.total}`;
      prompt.innerHTML = esc(q.prompt); $('#vis').innerHTML = renderVisual(q.visual);
      const myWave = ++waveId; waveDone.a = waveDone.b = false;
      const speed = o.year.speeds[0] ?? 2;
      const opts = waveOptsFor(q, { labels: q.options, speed }, 0);
      // #44: the first wave waits for Fredoka (cached after that); #138: a spawn that waited must still be this wave's.
      fontReady().then(() => {
        if (waveId !== myWave || !scope.alive) return;
        say(q.say ?? q.prompt);
        for (const p of PLAYERS) { arenas[p].topInset = 8; arenas[p].spawnWave(opts); }
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
    const headline = duelHeadline(r); say(headline);
    overlay.hidden = false;
    overlay.innerHTML = `
      <div class="modal results duel-end">
        <div class="hero-big sensei" style="--glow:${SENSEI.glow}"><img src="${SENSEI.img}" alt="${SENSEI.name}"><div class="speech">${esc(headline)}</div></div>
        <h2>${r.winner === 'draw' ? 'A draw!' : `${esc(NAME[r.winner])} wins!`}</h2>
        <div class="statgrid duel-final"><div><b>${r.scoreA}</b><small>${NAME.a}</small></div><div><b>${r.rounds}</b><small>rounds</small></div><div><b>${r.scoreB}</b><small>${NAME.b}</small></div></div>
        <div class="row"><button class="btn primary big" id="again">Rematch ⚔️</button><button class="btn big" id="home">Islands</button></div>
      </div>`;
    $('#again').addEventListener('click', () => { sfx.tap(); cleanup(); replay(); });
    $('#home').addEventListener('click', () => { sfx.tap(); cleanup(); goHome(); });
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
    return arenas[p].bubbles.find(x => x.launched && !x.dead && !x.hit && x.label !== q.answer)?.label;
  };
  const hooks: DuelHooks = {
    duel, arenas,
    answer: p => { const t = target(p, false); return t !== undefined && arenas[p].hitLabel(t); },
    wrong: p => { const t = target(p, true); return t !== undefined && arenas[p].hitLabel(t); },
    bubbles: p => arenas[p].bubbles.filter(b => b.launched && !b.dead && !b.hit && !b.fade).map(b => ({ label: b.label, x: b.x, y: b.y, r: b.r, vy: b.vy })),
    state: () => ({
      mode: 'duel', round: duel.round, rounds: duel.rounds, scoreA: duel.scoreA, scoreB: duel.scoreB,
      decided: duel.roundDecided, ended: duel.ended, prompt: duel.current?.prompt, answer: duel.current?.answer, topic: topic.id,
    }),
    setSpeed: k => { setGameSpeed(k); },
    timing: () => ({ speed: gameSpeed(), hold: { won: scaled(HOLD.won), draw: scaled(HOLD.draw) } }),
  };
  window.__sna = hooks;
  duel.start();
  return cleanup;
}
