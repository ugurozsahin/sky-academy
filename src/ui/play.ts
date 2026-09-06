import { AVATARS, avatarById, cheerLine, praiseLine, SENSEI, SENSEI_LINES, senseiLine, VILLAIN } from '../avatars';
import { STAGE_NAMES, topicsFor, type Question, type Topic, type YearInfo } from '../curriculum';
import { Arena } from '../game/arena';
import { Session, type Mode, type SessionResult } from '../game/session';
import { Tracer } from '../game/tracing';
import { addCoins, load, recordAccuracy, recordBossWin, recordDojo, recordEndless, recordSprint, recordTopic, recordTraining, save, touchStreak } from '../storage';
import { haptic, say, sfx, sliceFx } from '../audio';
import { $, esc, fillAnswer, render, stars } from './dom';
import { renderVisual } from './visuals';
import { dojoRowsHTML } from './memory';
import { drawCertificate, deliverCertificate, type CertInfo } from './certificate';

const BOMB = '💣';
export interface PlayOpts { year: YearInfo; topic?: Topic; mode: Mode; pool?: Topic[] }   // pool + mission = Sensei training over the weakest topics

export function playScreen(o: PlayOpts, goHome: () => void, replay: () => void) {
  const d = load(); const av = avatarById(d.avatar);
  const tracing = o.topic?.mode === 'tracing';
  const sprint = o.mode === 'sprint'; const boss = o.mode === 'boss'; const training = o.mode === 'mission' && !!o.pool;
  const villainMode = o.mode === 'endless' || boss;     // Hammer Man on screen, TNT bubbles in the mix
  const title = o.mode === 'endless' ? 'Sky Storm' : sprint ? 'Ninja Sprint' : boss ? 'Boss Battle' : training ? 'Sensei Training' : o.topic!.title;
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
      ${villainMode ? `<div class="villain${boss ? ' boss' : ''}" id="villain">${boss ? '<div class="hp" role="progressbar" aria-label="Hammer Man health"><i id="hp"></i></div>' : ''}<img src="${VILLAIN.img}" alt="Hammer Man"><span class="bubble" id="taunt" hidden></span></div>` : ''}
    </div>
    ${!tracing && !d.tutorialSeen ? `<div class="tutorial" id="tutorial" hidden aria-hidden="true"><div class="tut-sensei"><img src="${SENSEI.img}" alt=""></div><div class="tut-bubble">3</div><div class="tut-hand">☝️</div><div class="tut-text">Slice the bubble!</div></div>` : ''}
    <div class="overlay" id="overlay" hidden></div>
  </section>`, 'bg-play');

  const els = { lives: $('#lives'), score: $('#score'), stage: $('#stage'), prompt: $('#prompt'), vis: $('#vis'), hint: $('#hint'), toast: $('#toast'), overlay: $('#overlay'), qcard: $('#qcard') };
  let lastOutcome: 'correct' | 'wrong' | 'miss' | 'none' = 'none';
  let arena: Arena | null = null; let tracer: Tracer | null = null; let timers: number[] = []; let alive = true; let lastResult: SessionResult | null = null;
  const later = (fn: () => void, ms: number) => { const t = window.setTimeout(() => { if (alive) fn(); }, ms); timers.push(t); };
  const toast = (text: string, cls = '', ms = 1300) => { els.toast.textContent = text; els.toast.className = `toast show ${cls}`; later(() => els.toast.classList.remove('show'), ms); };
  // Outcome beat: after a slice the wave freezes and the result is shown (✓ on the sliced bubble, or ✗ next to the glowing
  // right answer; the card fills in the answer) for `hold` ms, then a short gap before the next question. Sprint stays brisk.
  const HOLD = sprint ? { correct: 350, wrong: 1000, miss: 800 } : { correct: 1000, wrong: 1800, miss: 1500 };
  let waveId = 0; let revealUntil = 0;
  // Mission progress (#55): stage name + one segment per question (green = right, red = slip, pulsing = current) + a small "3/6".
  let segStage = 0; let segs: ('good' | 'bad' | '')[] = [];
  function drawStage(stage: number, index: number, total: number) {
    if (o.mode !== 'mission') { els.stage.textContent = `Q${session.questionsAsked}`; return; }
    if (stage !== segStage) { segStage = stage; segs = Array.from({ length: total }, () => ''); }
    const name = STAGE_NAMES[stage - 1] ?? `Stage ${stage}`;
    els.stage.innerHTML = `<span class="sname">${esc(name)}</span><span class="segs" role="progressbar" aria-label="${esc(name)}: question ${index + 1} of ${total}" aria-valuenow="${index + 1}" aria-valuemin="1" aria-valuemax="${total}">${segs.map((k, i) => `<i class="${k}${i === index ? ' cur' : ''}"></i>`).join('')}</span><small class="q" aria-hidden="true">${index + 1}/${total}</small>`;
  }
  const markSeg = (k: 'good' | 'bad') => { if (o.mode === 'mission') { segs[session.index] = k; drawStage(session.stage, session.index, session.perStage); } };
  const endWave = (hold: number) => { const id = waveId; revealUntil = performance.now() + hold; later(() => { if (waveId === id) arena?.clearWave('#ffffff'); }, hold); };
  function showOutcome(kind: 'correct' | 'wrong' | 'miss', q: Question) {
    els.qcard.classList.remove('good', 'bad'); els.qcard.classList.add(kind === 'correct' ? 'good' : 'bad');
    if (!q.sequence && !(q.listen && !load().speech)) els.prompt.innerHTML = fillAnswer(q.prompt, q.answer);   // Sound Hunt with read-aloud off keeps its listen words
    els.hint.innerHTML = kind === 'correct' ? `<b class="ok">✓ ${esc(q.answer)}</b> — that's right!` : `${kind === 'wrong' ? '✗ Not this time.' : 'It flew away!'} The answer is <b class="ok">${esc(q.answer)}</b>`;
  }

  const session = new Session({ mode: o.mode, year: o.year, topic: o.topic, pool: o.pool ?? (o.mode !== 'mission' ? topicsFor(o.year.id).filter(t => t.mode !== 'tracing') : undefined) }, {
    onQuestion(q, info) {
      // If a miss is still being shown (the answer fell and the session moved on at once), let the child see it before the next question.
      const wait = Math.max(0, revealUntil - performance.now()); if (wait > 0) { later(() => show(), wait + 450); return; } show();
      function show() {
      drawStage(info.stage, info.index, info.total);
      if (training && session.currentTopic) $('.ttl').textContent = `${session.currentTopic.icon} ${session.currentTopic.title}`;   // Sensei: name the topic of each question
      els.prompt.innerHTML = q.listen && !load().speech ? esc(q.listen) : promptHTML(q, session.seqIndex); els.vis.innerHTML = renderVisual(q.visual); els.hint.textContent = q.hint ?? (tracing ? 'Trace over the dotted letters' : 'Tap or slice the answer');
      lastOutcome = 'none'; waveId++; els.qcard.classList.remove('good', 'bad');
      if (tracing) { say(q.say ?? q.prompt); startTrace(q); return; }
      const labels = villainMode && session.questionsAsked > 3 && session.questionsAsked % 3 === 0 && !q.sequence ? [...info.labels, BOMB] : info.labels;
      const spawn = () => { say(q.say ?? q.prompt); requestAnimationFrame(() => { arena!.topInset = els.qcard.getBoundingClientRect().bottom + 6; arena!.spawnWave({ labels, speed: info.speed, wide: !!q.wide || info.labels.some(l => l.length > 3), ordered: q.sequence?.slice(session.seqIndex) }); }); };
      const demo = showTutorial();                // first ever play: animated hand first, bubbles a moment later
      if (demo) later(spawn, demo); else spawn();
      }
    },
    onCorrect(q, points, combo) {
      lastOutcome = 'correct'; sfx.correct(); els.score.textContent = String(session.score); markSeg('good');
      const c = cheerLine(av); toast(combo >= 3 ? `${c} Combo ×${combo}` : c, 'good', HOLD.correct + 300);
      if (arena) { arena.reveal({ good: q.sequence ? q.sequence[q.sequence.length - 1] : q.answer }); arena.floatText(arena.W / 2, arena.topInset + 40, `+${points}`, av.glow); showOutcome('correct', q); endWave(HOLD.correct); }
      else later(() => session.advance(), 900);
    },
    onWrong(q, hit) {
      lastOutcome = 'wrong'; sfx.wrong(); haptic('wrong'); markSeg('bad');
      toast('Not quite!', 'bad', HOLD.wrong); showTaunt();
      if (arena) { arena.reveal({ good: q.sequence ? q.sequence[session.seqIndex] : q.answer, bad: hit }); showOutcome('wrong', q); endWave(HOLD.wrong); }
      else later(() => session.advance(), 1200);
    },
    onMiss(q) {
      lastOutcome = 'miss'; sfx.miss(); toast('Missed!', 'bad', HOLD.miss); showTaunt(); markSeg('bad');
      if (arena) { arena.reveal({ good: q.sequence ? q.sequence[session.seqIndex] : q.answer }); showOutcome('miss', q); endWave(HOLD.miss); }
    },
    onProgress(label, done, total) { sfx.slice(); if (done < total) arena?.rush(session.current!.sequence![done]);   // the next word is earned: bring it up now instead of making the child wait for its batch
       els.prompt.innerHTML = promptHTML(session.current!, done); if (arena) arena.floatText(arena.W / 2, arena.topInset + 40, label, av.glow); if (done < total) say(label, false); },
    onLives(n) { drawLives(n); if (n < prevLives) { sfx.life(); haptic('life'); } prevLives = n; },
    onStageClear(stage, st, acc) { sfx.stage(); haptic('stage'); showStageClear(stage, st, acc); },
    onTime(s) { drawTimer(s); if (s <= 3 && s > 0) sfx.tap(); },
    onBoss(hp, max, kind) {
      drawHp(hp, max);
      const v = $('#villain'); if (!v) return;
      v.classList.remove('hit', 'heal'); void v.offsetWidth; v.classList.add(kind);
      if (kind === 'hit') { sfx.life(); if (hp > 0) toast(hp <= 3 ? 'Hammer Man is wobbling!' : 'Hit!', 'good'); }
      else showTaunt();
    },
    onEnd(r) { later(() => showResults(r), lastOutcome === 'none' || r.mode === 'sprint' ? 0 : Math.max(900, revealUntil - performance.now() + 300)); },
  });
  let prevLives = o.year.lives;
  const drawLives = (n: number) => { if (els.lives) els.lives.innerHTML = Array.from({ length: o.year.lives }, (_, i) => `<span class="${i < n ? 'on' : 'off'}">❤️</span>`).join(''); };
  const drawTimer = (s: number) => { const t = $('#timer'); if (!t) return; t.textContent = `⏱ ${s}`; t.classList.toggle('hurry', s <= 10); };
  const drawHp = (hp: number, max: number) => { const h = $('#hp'); if (h) { h.style.width = `${Math.round(100 * hp / max)}%`; h.classList.toggle('low', hp <= 3); } };
  drawLives(o.year.lives); drawTimer(session.secondsLeft); drawHp(session.bossHp, session.bossMax);
  // Sprint clock: real elapsed time, frozen while the pause overlay (or a result) has the arena paused.
  let ticker = 0; let lastTick = 0;
  if (sprint) ticker = window.setInterval(() => { const now = performance.now(); const dt = lastTick ? now - lastTick : 0; lastTick = now; if (!arena?.paused && !session.ended) session.tick(dt); }, 100);

  if (!tracing) {
    arena = new Arena($('#arena') as HTMLCanvasElement, {
      onHit(b, viaSwipe) {
        if (!load().tutorialSeen) { save({ tutorialSeen: true }); hideTutorial(); }
        if (b.label === BOMB) { if (!session.waiting && !session.ended) { sfx.life(); toast('TNT! Hammer Man got you', 'bad'); showTaunt(); arena!.burst(b.x, b.y, '#ff3b1a', 30); session.bomb(); } return; }
        const r = session.hit(b.label); if (r === 'ignored') return; if (viaSwipe) { (sliceFx[av.fx] ?? sfx.slice)(); haptic('slice'); }
      },
      onFall(b) { if (b.label !== BOMB) session.fall(b.label); },
      onWaveEnd() {   // let the outcome finish showing (the reveal may still be on screen), then a breath before the next question
        const gap = lastOutcome === 'correct' ? 450 : lastOutcome === 'none' ? 0 : 650;
        later(() => session.waveEnd(), Math.max(0, revealUntil - performance.now()) + gap);
      },
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
    $('#tcheck').onclick = () => {
      const r = tracer!.result(); if (r.pass) { sfx.correct(); session.hit(q.answer); return; }
      const missing = r.glyphs.filter(g => g < 0.55).length;   // name the letter the child skipped
      toast(r.outside > 0.45 ? 'Stay on the dotted lines' : q.answer.length > 1 && missing ? `Trace the "${[...q.answer][r.weakest]}" too — every letter!` : `Keep tracing — cover the whole ${q.answer.length > 1 ? 'word' : 'letter'}`, 'bad');
    };
  }
  /** First-play demo: show the animated hand over the arena; returns how long to hold the first wave (ms). */
  function showTutorial(): number {
    const t = $('#tutorial'); if (!t || !t.hidden) return 0;
    if (load().tutorialSeen || session.questionsAsked > 1) return 0;   // only ever before the very first wave
    t.hidden = false; say(SENSEI_LINES.tutorial);
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
    if (o.mode === 'mission' && o.topic) recordTopic(o.topic.id, r.stars, r.score);
    else if (training) { if (r.won) recordTraining(o.year.id); }
    else if (o.mode === 'sprint') newBest = recordSprint(o.year.id, r.score);
    else if (o.mode === 'boss') { if (r.won) recordBossWin(o.year.id); }
    else recordEndless(o.year.id, r.score);
    for (const [id, t] of Object.entries(session.byTopic)) recordAccuracy(id, t.hits, t.tries);   // every mode teaches Sensei what is hard
    const bySubject = (s: Topic['subject']) => Object.entries(session.byTopic).reduce((n, [id, t]) => n + (topicsFor(o.year.id).find(x => x.id === id)?.subject === s ? t.hits : 0), 0);
    const dojo = recordDojo({ mode: r.mode, won: r.won, correct: r.correct, attempts: r.attempts, bestCombo: r.bestCombo, stars: r.stars, score: r.score, training, mathsCorrect: bySubject('maths'), writingCorrect: bySubject('writing') });
    const fresh = addCoins(r.coins + dojo.coins); const streak = touchStreak();
    const stickerHTML = fresh.map(id => { const a = AVATARS.find(x => x.id === id); return `<div class="unlock" style="--glow:${a?.glow ?? '#ff3b5c'}"><span class="figure"><img src="${a ? a.img : VILLAIN.img}" alt=""></span><b>New sticker!</b><small>${a ? a.name : VILLAIN.name}</small></div>`; }).join('');
    if (fresh.length || dojo.completed.length) later(() => sfx.stage(), 600);
    const medal = r.mode === 'endless' ? (r.score >= 300 ? '🥇' : r.score >= 150 ? '🥈' : '🥉') : r.mode === 'sprint' ? (r.stars === 3 ? '🥇' : r.stars === 2 ? '🥈' : r.stars === 1 ? '🥉' : '💪') : r.won ? (r.stars === 3 ? '🥇' : r.stars === 2 ? '🥈' : '🥉') : '💪';
    const headline = training ? senseiLine(r.won, d.name) : r.mode === 'sprint' && newBest ? `New best, ${d.name || 'Ninja'}!` : r.mode === 'boss' && r.won ? `K.O.! You beat Hammer Man, ${d.name || 'Ninja'}!` : r.won ? praiseLine(av, d.name) : `Hammer Man got away this time, ${d.name || 'Ninja'}!`;
    const speaker = training ? SENSEI : av;   // Sensei closes a training session; the child's own ninja closes everything else
    say(headline);
    const cert = certInfo(r); lastResult = r;
    els.overlay.hidden = false; els.overlay.innerHTML = `
      <div class="modal results">
        ${r.mode === 'boss' && r.won ? `<div class="ko" aria-hidden="true"><img src="${VILLAIN.img}" alt=""><b>K.O.</b></div>` : ''}
        <div class="hero-big ${r.won ? '' : 'sad'}${training ? ' sensei' : ''}" style="--glow:${speaker.glow}"><img src="${speaker.img}" alt="${speaker.name}"><div class="speech">${esc(headline)}</div></div>
        <div class="medal">${medal}</div>
        <h2>${r.mode === 'endless' ? 'Storm over!' : r.mode === 'sprint' ? "Time's up!" : r.mode === 'boss' ? (r.won ? 'Knock-out!' : 'Hammer Man wins this round') : r.won ? (training ? 'Training complete!' : 'Mission complete!') : 'Out of lives'}</h2>
        ${r.mode !== 'endless' ? `<div class="big-stars">${stars(r.stars)}</div>` : ''}
        <div class="statgrid"><div><b>${r.score}</b><small>score</small></div><div><b>${r.correct}/${r.attempts}</b><small>correct</small></div><div><b>×${r.bestCombo}</b><small>best combo</small></div></div>
        <div class="coin-row"><span class="coin-gain">+${r.coins} 🪙</span>${newBest ? '<span class="best-pill">🏆 New best!</span>' : ''}${streak > 1 ? `<span class="streak-pill">🔥 ${streak}-day streak</span>` : ''}</div>
        ${dojoRowsHTML(dojo)}
        ${stickerHTML}
        <div class="row"><button class="btn primary big" id="again">Play again</button><button class="btn big" id="home">Islands</button></div>
        ${cert ? '<div class="row"><button class="btn big cert" id="cert" aria-label="Save a certificate for this mission">🎓 Certificate</button></div>' : ''}
      </div>`;
    $('#again').addEventListener('click', () => { sfx.tap(); cleanup(); replay(); });
    $('#home').addEventListener('click', () => { sfx.tap(); cleanup(); goHome(); });
    if (cert) $('#cert').addEventListener('click', async () => {
      sfx.tap(); const b = $('#cert') as HTMLButtonElement; b.disabled = true;
      try {
        const how = await deliverCertificate(await drawCertificate(cert), `sky-ninja-certificate-${(d.name || 'ninja').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`);
        if (how === 'shared') toast('Certificate shared!', 'good');
        else if (how === 'saved' || how === 'downloaded') toast('Certificate saved!', 'good');
        else if (how === 'declined') toast('No problem — you can save it next time!', 'good');
        // 'shown' opens the full-screen view with its own save hint, so no toast
      }
      catch { toast('Could not make the certificate', 'bad'); }
      b.disabled = false;
    });
  }
  /** Certificate details for a won mission / Sensei session (null for the other modes and lost runs). */
  const certInfo = (r: SessionResult): CertInfo | null => (r.won && o.mode === 'mission' ? { name: d.name, avatar: av, year: o.year.title, title: o.topic?.title ?? 'Sensei training', stars: r.stars, score: r.score, correct: r.correct, attempts: r.attempts, training } : null);
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
    bubbles: () => arena?.bubbles.filter(b => b.launched && !b.dead && !b.hit && !b.fade).map(b => ({ label: b.label, x: b.x, y: b.y, r: b.r, vy: b.vy })) ?? [],
    state: () => ({ stage: session.stage, index: session.index, score: session.score, lives: session.lives, ended: session.ended, waiting: session.waiting, prompt: session.current?.prompt, answer: session.current?.answer, timeLeft: session.timeLeft, bossHp: session.bossHp }),
    certificate: async () => { const c = lastResult && certInfo(lastResult); return c ? (await drawCertificate(c)).toDataURL('image/png') : null; },   // PNG data URL of the certificate for the finished mission
  };
  session.start();
}

function promptHTML(q: Question, done: number) {
  if (!q.sequence) return esc(q.prompt);
  const letters = q.sequence.map((l, i) => `<span class="${i < done ? 'got' : 'todo'}">${i < done ? esc(l) : '_'}</span>`).join('');
  return `<span class="seq">${letters}</span>`;
}
