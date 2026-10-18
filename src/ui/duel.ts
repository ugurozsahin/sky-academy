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
import { avatarById, type Avatar } from '../avatars';
import { topicsFor, type YearInfo } from '../curriculum';
import { Arena } from '../game/arena';
import { Duel, DUEL_PLAYERS, duelHistoryLine, duelPool, type DuelPlayer } from '../game/duel';
import { load, type StoredDuel } from '../storage';
import { haptic, hush, say, sfx } from '../audio';
import { $, esc, render } from './dom';
import { pushBackGuard, screenScope } from './screen';
import { pauseHTML } from './overlays';
import { createDuelBeats, DUEL_TOAST_LONGEST } from './duel-beats';
import { createDuelHooks } from './duel-hooks';
import { createDuelResults } from './duel-results';
import { duelTopic } from '../game/duel-topic'; import { calmReduced } from '../device-settings';

export { DUEL_TOAST_LONGEST };   // moved to duel-beats.ts with the toasts it measures (#1499); importers unchanged

export interface DuelScreenOpts { year: YearInfo; topic?: string; labels?: 'players' | 'teams' }   // #958: 'teams' names the seats Team A / Team B
const PLAYERS = DUEL_PLAYERS;
const NAMES: Record<'players' | 'teams', Record<DuelPlayer, string>> = { players: { a: 'Player 1', b: 'Player 2' }, teams: { a: 'Team A', b: 'Team B' } };

/** One `Arena` per seat, on that seat's canvas. A duel has no lives: a fallen bubble is just a bubble nobody sliced. */
function mountArenas(arenas: Record<DuelPlayer, Arena>, av: Avatar, duel: Duel, waveEnd: (p: DuelPlayer) => void): void {
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
}

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

  const scope = screenScope(); const { onBack, onHidden } = scope; onBack(pauseIfLive); scope.onKeys({ pause: pauseIfLive, repeat: () => overlay.hidden && (repeat(), true) }); onHidden(() => { hush(); pauseIfLive(); }); pushBackGuard();   // #885, #886, #887, #902
  const overlay = $('#overlay');
  let paused = false;   // #886: mirrors the Pause overlay, for state()
  const arenas = {} as Record<DuelPlayer, Arena>;

  const beats = createDuelBeats({ o, av, NAME, scope, arenas, commitOnce: r => results.commitOnce(r), showResults: (r, p) => results.showResults(r, p) });
  const duel = new Duel({ topic, difficulty }, beats.callbacks); beats.bind(duel);
  const { waveEnd, hold } = beats;

  mountArenas(arenas, av, duel, waveEnd);
  // The settlement and the results overlay (#1500) sit in duel-results.ts; they need the beats' `hold`, and the beats
  // need their `commitOnce`/`showResults` (thunks above), so they are created here, after both sides exist.
  const results = createDuelResults({ o, topic, NAME, d, av, overlay, scope, hold, cleanup, goHome, replay });
  const { m } = results;

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

  window.__sna = createDuelHooks({ duel, arenas, topic, beats, m, paused: () => paused });   // #1500: the test hooks live in duel-hooks.ts
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
