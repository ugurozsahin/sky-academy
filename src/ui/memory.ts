// Memory Match screen: a calm, non-slice card-flip mode. Cards are DOM buttons (no canvas).
import { AVATARS, avatarById, cheerLine, praiseLine, VILLAIN } from '../avatars';
import type { YearInfo } from '../curriculum';
import { Memory, pickTheme, type Face } from '../game/memory';
import { addCoins, load, recordDojo, recordMemory, touchStreak } from '../storage';
import { say, sfx } from '../audio';
import { $, $$, esc, render, stars } from './dom';
import { coinSVG } from './visuals';
import type { DojoOutcome } from '../game/dojo';

/** Results rows for Daily Dojo challenges finished by this game (shared by the play and memory screens). */
export function dojoRowsHTML(d: DojoOutcome): string {
  const rows = d.completed.map(c => `<div class="dojo-bonus"><span class="ic">${c.icon}</span><span><b>Dojo challenge done!</b><small>${esc(c.title)}</small></span><span class="gain">+${Math.floor(c.bonus * d.multiplier)} 🪙</span></div>`);
  if (d.setDone) rows.push(`<div class="dojo-bonus set"><span class="ic">🏯</span><span><b>Daily Dojo complete!</b><small>All three challenges · ${d.state.streak.days}-day dojo streak</small></span><span class="gain">+${d.coins - d.completed.reduce((n, c) => n + Math.floor(c.bonus * d.multiplier), 0)} 🪙</span></div>`);
  return rows.join('');
}

export interface MemoryOpts { year: YearInfo; theme?: string }

export function memoryScreen(o: MemoryOpts, goHome: () => void, replay: () => void) {
  const d = load(); const av = avatarById(d.avatar);
  const theme = pickTheme(o.year.id, Math.random, o.theme);
  const game = new Memory(theme.pairs(Math.random));
  const cols = 4;                                  // 8 / 12 / 16 cards → 2 / 3 / 4 rows
  render(`
  <section class="screen memory" style="--glow:${av.glow}">
    <div class="hud-top">
      <button class="icon-btn" id="back" aria-label="Back to the island">←</button>
      <div class="mstat" id="pairs" aria-live="polite">🃏 <b>0</b>/${game.pairs.length}</div>
      <div class="mstat" id="moves">👆 <b>0</b></div>
      <div class="score"><small>SCORE</small><b id="score">0</b></div>
    </div>
    <div class="qcard mem-head" id="qcard">
      <div class="qhead"><span class="pill">Memory Match</span><span class="ttl">${esc(o.year.title)} · ${esc(theme.title)}</span><button class="icon-btn speak" id="speak" aria-label="Hear the instructions">🔊</button></div>
      <div class="hint">${esc(theme.hint)}</div>
    </div>
    <div class="toast" id="toast" aria-live="polite"></div>
    <div class="cards" id="cards" style="--cols:${cols}" role="grid" aria-label="Memory cards">
      ${game.cards.map((c, i) => `<button class="card" data-i="${i}" aria-label="Card ${i + 1}"><span class="inner"><span class="back">?</span><span class="front">${faceHTML(c.face)}</span></span></button>`).join('')}
    </div>
    <div class="overlay" id="overlay" hidden></div>
  </section>`, 'bg-play');

  let alive = true; let timers: number[] = []; let lock = false;
  const later = (fn: () => void, ms: number) => { const t = window.setTimeout(() => { if (alive) fn(); }, ms); timers.push(t); };
  const toastEl = $('#toast');
  const toast = (text: string, cls = '') => { toastEl.textContent = text; toastEl.className = `toast show ${cls}`; later(() => toastEl.classList.remove('show'), 1200); };
  const cardEls = $$<HTMLButtonElement>('.card');
  const draw = () => {
    game.cards.forEach((c, i) => { const el = cardEls[i]; el.classList.toggle('up', c.up || c.matched); el.classList.toggle('matched', c.matched); el.disabled = c.matched; });
    $('#pairs b').textContent = String(game.matched); $('#moves b').textContent = String(game.moves); $('#score').textContent = String(game.score);
  };
  const intro = () => say(`${theme.title}. ${theme.hint}. Tap a card to turn it over.`);

  function flip(i: number): boolean {
    if (lock) return false;
    const r = game.flip(i); if (r === 'ignored') return false;
    sfx.tap(); say(game.cards[i].face.say, false); draw();
    if (r === 'match') { sfx.correct(); toast(`${cheerLine(av)} A pair!`, 'good'); cardEls[i].classList.add('pop'); cardEls[game.cards.findIndex((c, k) => k !== i && c.pair === game.cards[i].pair && c.matched)]?.classList.add('pop'); if (game.done) later(finish, 900); }
    else if (r === 'miss') { lock = true; later(() => { game.hide(); lock = false; draw(); }, 900); toast('Not a pair — try again', 'bad'); }
    return true;
  }
  cardEls.forEach((el, i) => el.addEventListener('click', () => flip(i)));

  function finish() {
    const boards = recordMemory(o.year.id);
    const dojo = recordDojo({ mode: 'memory', won: true, correct: game.pairs.length, attempts: game.moves, bestCombo: 0, stars: game.stars, score: game.score });
    const fresh = addCoins(game.coins + dojo.coins); const streak = touchStreak();
    const stickerHTML = fresh.map(id => { const a = AVATARS.find(x => x.id === id); return `<div class="unlock" style="--glow:${a?.glow ?? '#ff3b5c'}"><span class="figure"><img src="${a ? a.img : VILLAIN.img}" alt=""></span><b>New sticker!</b><small>${a ? a.name : VILLAIN.name}</small></div>`; }).join('');
    if (fresh.length) later(() => sfx.stage(), 600);
    sfx.stage();
    const headline = praiseLine(av, d.name); say(headline);
    const medal = game.stars === 3 ? '🥇' : game.stars === 2 ? '🥈' : '🥉';
    const ov = $('#overlay'); ov.hidden = false; ov.innerHTML = `
      <div class="modal results">
        <div class="hero-big" style="--glow:${av.glow}"><img src="${av.img}" alt="${av.name}"><div class="speech">${esc(headline)}</div></div>
        <div class="medal">${medal}</div>
        <h2>All pairs found!</h2>
        <div class="big-stars">${stars(game.stars)}</div>
        <div class="statgrid"><div><b>${game.score}</b><small>score</small></div><div><b>${game.moves}</b><small>turns</small></div><div><b>${boards}</b><small>boards</small></div></div>
        <div class="coin-row"><span class="coin-gain">+${game.coins} 🪙</span>${streak > 1 ? `<span class="streak-pill">🔥 ${streak}-day streak</span>` : ''}</div>
        ${dojoRowsHTML(dojo)}
        ${stickerHTML}
        <div class="row"><button class="btn primary big" id="again">Play again</button><button class="btn big" id="home">Islands</button></div>
      </div>`;
    $('#again').addEventListener('click', () => { sfx.tap(); cleanup(); replay(); });
    $('#home').addEventListener('click', () => { sfx.tap(); cleanup(); goHome(); });
  }
  function cleanup() { alive = false; timers.forEach(clearTimeout); try { speechSynthesis.cancel(); } catch { /* ignore */ } delete (window as any).__sna; }
  $('#back').addEventListener('click', () => { sfx.tap(); cleanup(); goHome(); });
  $('#speak').addEventListener('click', intro);
  $('#qcard').addEventListener('click', e => { if ((e.target as HTMLElement).closest('button')) return; intro(); });

  // Test / accessibility hooks (same contract shape as the play screen where it makes sense)
  (window as any).__sna = {
    memory: game, theme: theme.id,
    cards: () => game.cards.map(c => ({ pair: c.pair, text: c.face.text, up: c.up, matched: c.matched })),
    flip,
    state: () => ({ mode: 'memory', moves: game.moves, matched: game.matched, pairs: game.pairs.length, score: game.score, ended: game.done, waiting: lock }),
  };
  draw(); intro();
}

function faceHTML(f: Face): string {
  if (f.coin) return coinSVG(f.coin);
  const len = Array.from(f.text).length;
  const cls = f.small ? 'txt small' : len > 3 ? 'txt objs' : len === 1 && !/\d/.test(f.text) ? 'txt glyph' : 'txt';
  return `<span class="${cls}">${esc(f.text)}</span>`;
}
