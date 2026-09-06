import { AVATARS, avatarById, cheerLine, praiseLine, VILLAIN } from '../avatars';
import { STAGE_NAMES, topicsFor, type Question, type Topic, type YearInfo } from '../curriculum';
import { Arena } from '../game/arena';
import { Session, type Mode, type SessionResult } from '../game/session';
import { Tracer } from '../game/tracing';
import { addCoins, load, recordEndless, recordSprint, recordTopic, save, touchStreak } from '../storage';
import { say, sfx, sliceFx } from '../audio';
import { $, esc, render, stars } from './dom';
import { renderVisual } from './visuals';

const BOMB = '💣';
export interface PlayOpts { year: YearInfo; topic?: Topic; mode: Mode }

export function playScreen(o: PlayOpts, goHome: () => void, replay: () => void) {
  const d = load(); const av = avatarById(d.avatar);
  const tracing = o.topic?.mode === 'tracing';
  const sprint = o.mode === 'sprint';
  const title = o.mode === 'endless' ? 'Sky Storm' : sprint ? 'Ninja Sprint' : o.topic!.title;
  render(`
  <section class="screen play ${tracing ? 'tracing' : ''}" style="--glow:${av.glow}">
    ${tracing ? '' : '<canvas id="arena" aria-label="Game arena"></canvas>'}
    <div class="hud">
      <div class="hud-top">
        <button class="icon-btn" id="pause" aria-label="Pause">⏸</button>
        ${sprint ? '<div class="timer" id="timer" aria-live="polite" aria-label="Time left"></div>' : '<div class="lives" id="lives" aria-live="polite"></div>'}
        <div class="score"><small>SCORE</small><b id="score">0</b></div>
      </div>
      <div class="qcard" id="qcard">
        <div class="qhead"><span class="pill" id="stage"></span><span class="ttl">${esc(title)}</span><button class="icon-btn speak" id="speak" aria-label="Read the question aloud" title="Tap the card to hear it again">🔊</button></div>
        <div class="prompt" id="prompt"></div>
        <div class="vis-wrap" id="vis"></div>
        <div class="hint" id="hint"></div>
      </div>
      ${tracing ? '<div class="trace-wrap"><canvas id="trace"></canvas><div class="trace-btns"><button class="btn" id="tclear">Clear</button><button class="btn primary" id="tcheck">Check ✓</button></div></div>' : ''}
      <div class="toast" id="toast" aria-live="polite"></div>
      ${o.mode === 'endless' ? `<div class="villain" id="villain"><img src="${VILLAIN.img}" alt="Hammer Man"><span class="bubble" id="taunt" hidden></span></div>` : ''}
    </div>
    ${!tracing && !d.tutorialSeen ? '<div class="tutorial" id="tutorial" hidden aria-hidden="true"><div class="tut-bubble">3</div><div class="tut-hand">☝️</div><div class="tut-text">Slice the bubble!</div></div>' : ''}
    <div class="overlay" id="overlay" hidden></div>
  </section>`, 'bg-play');

  const els = { lives: $('#lives'), score: $('#score'), stage: $('#stage'), prompt: $('#prompt'), vis: $('#vis'), hint: $('#hint'), toast: $('#toast'), overlay: $('#overlay'), qcard: $('#qcard') };
  let lastOutcome: 'correct' | 'wrong' | 'miss' | 'none' = 'none';
  let arena: Arena | null = null; let tracer: Tracer | null = null; let timers: number[] = []; let alive = true;
  const later = (fn: () => void, ms: number) => { const t = window.setTimeout(() => { if (alive) fn(); }, ms); timers.push(t); };
  const toast = (text: string, cls = '') => { els.toast.textContent = text; els.toast.className = `toast show ${cls}`; later(() => els.toast.classList.remove('show'), 1300); };

  const session = new Session({ mode: o.mode, year: o.year, topic: o.topic, pool: o.mode !== 'mission' ? topicsFor(o.year.id).filter(t => t.mode !== 'tracing') : undefined }, {
    onQuestion(q, info) {
      els.stage.textContent = o.mode !== 'mission' ? `Q${session.questionsAsked}` : `${STAGE_NAMES[info.stage - 1] ?? 'Stage ' + info.stage} · ${info.index + 1}/${info.total}`;
      els.prompt.innerHTML = promptHTML(q, session.seqIndex); els.vis.innerHTML = renderVisual(q.visual); els.hint.textContent = q.hint ?? (tracing ? 'Trace over the dotted letters' : 'Tap or slice the answer');
      lastOutcome = 'none';
      if (tracing) { say(q.say ?? q.prompt); startTrace(q); return; }
      const labels = o.mode === 'endless' && session.questionsAsked > 3 && session.questionsAsked % 3 === 0 && !q.sequence ? [...info.labels, BOMB] : info.labels;
      const spawn = () => { say(q.say ?? q.prompt); requestAnimationFrame(() => { arena!.topInset = els.qcard.getBoundingClientRect().bottom + 6; arena!.spawnWave({ labels, speed: info.speed, wide: !!q.wide || info.labels.some(l => l.length > 3) }); }); };
      const demo = showTutorial();                // first ever play: animated hand first, bubbles a moment later
      if (demo) later(spawn, demo); else spawn();
    },
    onCorrect(_q, points, combo) {
      lastOutcome = 'correct'; sfx.correct(); els.score.textContent = String(session.score);
      const c = cheerLine(av); toast(combo >= 3 ? `${c} Combo ×${combo}` : c, 'good');
      if (arena) { arena.floatText(arena.W / 2, arena.topInset + 40, `+${points}`, av.glow); later(() => arena?.clearWave('#ffffff'), 150); }
      else later(() => session.advance(), 900);
    },
    onWrong(q, _hit) {
      lastOutcome = 'wrong'; sfx.wrong();
      toast(`Not quite — it was ${q.sequence ? q.answer : q.answer}`, 'bad'); showTaunt();
      if (arena) { arena.flash(q.sequence ? q.sequence[session.seqIndex] : q.answer); later(() => arena?.clearWave(), 700); }
      else later(() => session.advance(), 1200);
    },
    onMiss(q) { lastOutcome = 'miss'; sfx.miss(); toast(`Missed! The answer was ${q.answer}`, 'bad'); showTaunt(); },
    onProgress(label, done, total) { sfx.slice(); els.prompt.innerHTML = promptHTML(session.current!, done); if (arena) arena.floatText(arena.W / 2, arena.topInset + 40, label, av.glow); if (done < total) say(label, false); },
    onLives(n) { drawLives(n); if (n < prevLives) sfx.life(); prevLives = n; },
    onStageClear(stage, st, acc) { sfx.stage(); showStageClear(stage, st, acc); },
    onTime(s) { drawTimer(s); if (s <= 3 && s > 0) sfx.tap(); },
    onEnd(r) { later(() => showResults(r), lastOutcome === 'none' || r.mode === 'sprint' ? 0 : 900); },
  });
  let prevLives = o.year.lives;
  const drawLives = (n: number) => { if (els.lives) els.lives.innerHTML = Array.from({ length: o.year.lives }, (_, i) => `<span class="${i < n ? 'on' : 'off'}">❤️</span>`).join(''); };
  const drawTimer = (s: number) => { const t = $('#timer'); if (!t) return; t.textContent = `⏱ ${s}`; t.classList.toggle('hurry', s <= 10); };
  drawLives(o.year.lives); drawTimer(session.secondsLeft);
  // Sprint clock: real elapsed time, frozen while the pause overlay (or a result) has the arena paused.
  let ticker = 0; let lastTick = 0;
  if (sprint) ticker = window.setInterval(() => { const now = performance.now(); const dt = lastTick ? now - lastTick : 0; lastTick = now; if (!arena?.paused && !session.ended) session.tick(dt); }, 100);

  if (!tracing) {
    arena = new Arena($('#arena') as HTMLCanvasElement, {
      onHit(b, viaSwipe) {
        if (!load().tutorialSeen) { save({ tutorialSeen: true }); hideTutorial(); }
        if (b.label === BOMB) { if (!session.waiting && !session.ended) { sfx.life(); toast('TNT! Hammer Man got you', 'bad'); showTaunt(); arena!.burst(b.x, b.y, '#ff3b1a', 30); session.bomb(); } return; }
        const r = session.hit(b.label); if (r === 'ignored') return; if (viaSwipe) (sliceFx[av.fx] ?? sfx.slice)();
      },
      onFall(b) { if (b.label !== BOMB) session.fall(b.label); },
      onWaveEnd() { const delay = lastOutcome === 'correct' ? 650 : lastOutcome === 'wrong' ? 1300 : lastOutcome === 'miss' ? 1100 : 0; later(() => session.waveEnd(), delay); },
    }, { trailColor: av.glow, fx: av.fx, onSwish: () => sfx.swish() });
  }

  function startTrace(q: Question) {
    tracer?.destroy();
    const c = $('#trace') as HTMLCanvasElement;
    tracer = new Tracer(c, q.answer, r => {
      if (r.pass) { sfx.correct(); session.hit(q.answer); }
      else if (tracer!.strokes >= 1 && r.outside > 0.6) toast('Stay on the dotted lines', 'bad');
    }, av.glow);
    $('#tclear').onclick = () => { sfx.tap(); tracer?.clear(); };
    $('#tcheck').onclick = () => { const r = tracer!.result(); if (r.pass) { sfx.correct(); session.hit(q.answer); } else { toast(r.coverage < 0.6 ? 'Keep tracing — cover the whole letter' : 'Stay on the dotted lines', 'bad'); } };
  }
  /** First-play demo: show the animated hand over the arena; returns how long to hold the first wave (ms). */
  function showTutorial(): number {
    const t = $('#tutorial'); if (!t || !t.hidden) return 0;
    if (load().tutorialSeen || session.questionsAsked > 1) return 0;   // only ever before the very first wave
    t.hidden = false; say('Slice the bubble with your finger!');
    later(hideTutorial, 9000);                    // never block play for long, even if the child just watches
    return 1800;
  }
  function hideTutorial() { const t = $('#tutorial'); if (t) t.hidden = true; }
  /** Repeat the prompt aloud (tap the question card, or the 🔊 button). */
  function repeatPrompt() {
    const q = session.current; if (!q) return;
    say(q.say ?? q.prompt, true);
    els.qcard.classList.remove('pulse'); void els.qcard.offsetWidth; els.qcard.classList.add('pulse');
  }
  function showTaunt() { const t = $('#taunt'); if (!t) return; t.textContent = VILLAIN.taunt[Math.floor(Math.random() * VILLAIN.taunt.length)]; t.hidden = false; later(() => (t.hidden = true), 1400); }

  function showStageClear(stage: number, st: number, acc: number) {
    arena && (arena.paused = true);
    const line = praiseLine(av, d.name); say(line);
    els.overlay.hidden = false; els.overlay.innerHTML = `
      <div class="modal celebrate">
        <div class="confetti">${Array.from({ length: 24 }, (_, i) => `<i style="--i:${i};--x:${(i * 37) % 100};--d:${1.8 + (i % 5) * 0.35}s;--c:${['#ff5f6d', '#ffd54f', '#66e07d', '#40c4ff', '#b388ff'][i % 5]}"></i>`).join('')}</div>
        <div class="hero-big" style="--glow:${av.glow}"><img src="${av.img}" alt="${av.name}"><div class="speech">${esc(line)}</div></div>
        <h2>Stage ${stage} clear!</h2><span class="pill">${STAGE_NAMES[stage - 1] ?? ''}${stage < session.stages ? ` → next: ${STAGE_NAMES[stage] ?? ''}` : ' · mission done'}</span>
        <div class="big-stars">${stars(st)}</div>
        <p>${Math.round(acc * 100)}% correct · score ${session.score}</p>
        <button class="btn primary big" id="next">${stage >= session.stages ? 'Finish mission 🏁' : 'Next stage →'}</button>
      </div>`;
    $('#next').addEventListener('click', () => { sfx.tap(); els.overlay.hidden = true; arena && (arena.paused = false); session.nextStage(); });
  }
  function showResults(r: SessionResult) {
    arena && (arena.paused = true);
    let newBest = false;
    if (o.mode === 'mission' && o.topic) recordTopic(o.topic.id, r.stars, r.score); else if (o.mode === 'sprint') newBest = recordSprint(o.year.id, r.score); else recordEndless(o.year.id, r.score);
    const fresh = addCoins(r.coins); const streak = touchStreak();
    const stickerHTML = fresh.map(id => { const a = AVATARS.find(x => x.id === id); return `<div class="unlock" style="--glow:${a?.glow ?? '#ff3b5c'}"><span class="figure"><img src="${a ? a.img : VILLAIN.img}" alt=""></span><b>New sticker!</b><small>${a ? a.name : VILLAIN.name}</small></div>`; }).join('');
    if (fresh.length) later(() => sfx.stage(), 600);
    const medal = r.mode === 'endless' ? (r.score >= 300 ? '🥇' : r.score >= 150 ? '🥈' : '🥉') : r.mode === 'sprint' ? (r.stars === 3 ? '🥇' : r.stars === 2 ? '🥈' : r.stars === 1 ? '🥉' : '💪') : r.won ? (r.stars === 3 ? '🥇' : r.stars === 2 ? '🥈' : '🥉') : '💪';
    const headline = r.mode === 'sprint' && newBest ? `New best, ${d.name || 'Ninja'}!` : r.won ? praiseLine(av, d.name) : `Hammer Man got away this time, ${d.name || 'Ninja'}!`;
    say(headline);
    els.overlay.hidden = false; els.overlay.innerHTML = `
      <div class="modal results">
        <div class="hero-big ${r.won ? '' : 'sad'}" style="--glow:${av.glow}"><img src="${av.img}" alt="${av.name}"><div class="speech">${esc(headline)}</div></div>
        <div class="medal">${medal}</div>
        <h2>${r.mode === 'endless' ? 'Storm over!' : r.mode === 'sprint' ? "Time's up!" : r.won ? 'Mission complete!' : 'Out of lives'}</h2>
        ${r.mode !== 'endless' ? `<div class="big-stars">${stars(r.stars)}</div>` : ''}
        <div class="statgrid"><div><b>${r.score}</b><small>score</small></div><div><b>${r.correct}/${r.attempts}</b><small>correct</small></div><div><b>×${r.bestCombo}</b><small>best combo</small></div></div>
        <div class="coin-row"><span class="coin-gain">+${r.coins} 🪙</span>${newBest ? '<span class="best-pill">🏆 New best!</span>' : ''}${streak > 1 ? `<span class="streak-pill">🔥 ${streak}-day streak</span>` : ''}</div>
        ${stickerHTML}
        <div class="row"><button class="btn primary big" id="again">Play again</button><button class="btn big" id="home">Islands</button></div>
      </div>`;
    $('#again').addEventListener('click', () => { sfx.tap(); cleanup(); replay(); });
    $('#home').addEventListener('click', () => { sfx.tap(); cleanup(); goHome(); });
  }
  function showPause() {
    arena && (arena.paused = true);
    els.overlay.hidden = false; els.overlay.innerHTML = `<div class="modal"><h2>Paused</h2><div class="row"><button class="btn primary big" id="resume">Resume</button><button class="btn big" id="quit">Quit</button></div></div>`;
    $('#resume').addEventListener('click', () => { els.overlay.hidden = true; arena && (arena.paused = false); });
    $('#quit').addEventListener('click', () => { cleanup(); goHome(); });
  }
  $('#pause').addEventListener('click', () => { sfx.tap(); showPause(); });
  $('#speak').addEventListener('click', repeatPrompt);
  els.qcard.addEventListener('click', e => { if ((e.target as HTMLElement).closest('button')) return; repeatPrompt(); });
  function cleanup() { alive = false; timers.forEach(clearTimeout); clearInterval(ticker); arena?.destroy(); tracer?.destroy(); try { speechSynthesis.cancel(); } catch { /* ignore */ } delete (window as any).__sna; }

  // Test / accessibility hooks
  (window as any).__sna = {
    session, arena, get tracer() { return tracer; },
    answer: () => { const q = session.current; if (!q) return false; if (tracing) { tracer?.autoTrace(); return true; } const label = q.sequence ? q.sequence[session.seqIndex] : q.answer; return arena!.hitLabel(label); },
    wrong: () => { const q = session.current; if (!q || !arena) return false; const target = q.sequence ? q.sequence[session.seqIndex] : q.answer; const b = arena.bubbles.find(x => x.launched && !x.dead && x.label !== target && x.label !== BOMB); return b ? arena.hitLabel(b.label) : false; },
    bubbles: () => arena?.bubbles.filter(b => b.launched && !b.dead).map(b => ({ label: b.label, x: b.x, y: b.y, r: b.r, vy: b.vy })) ?? [],
    state: () => ({ stage: session.stage, index: session.index, score: session.score, lives: session.lives, ended: session.ended, waiting: session.waiting, prompt: session.current?.prompt, answer: session.current?.answer, timeLeft: session.timeLeft }),
  };
  session.start();
}

function promptHTML(q: Question, done: number) {
  if (!q.sequence) return esc(q.prompt);
  const letters = q.sequence.map((l, i) => `<span class="${i < done ? 'got' : 'todo'}">${i < done ? esc(l) : '_'}</span>`).join('');
  return `<span class="seq">${letters}</span>`;
}
