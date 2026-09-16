import { TOPICS, YEARS } from '../curriculum';
import { exportSave, importSave, load, reset, save, STICKER_IDS, type SaveData } from '../storage';
import { sfx, voiceState } from '../audio';
import { gateChallenge, checkGate, parentSummary, pct, type ParentSummary, type TopicStat } from '../game/parents';
import { $, esc, render } from './dom';

type Nav = { map: () => void; avatar: () => void };
/** The word a grown-up must type to confirm "Start again" — deliberately not a single tap a child could land on. */
const RESET_WORD = 'RESET';

const showPct = (x: number | null) => (x === null ? '—' : `${pct(x)}%`);
const bar = (frac: number) => `<span class="isl-bar"><i style="width:${Math.round(100 * Math.max(0, Math.min(1, frac)))}%"></i></span>`;

function topicRow(s: TopicStat): string {
  return `<li class="p-topic"><span class="ic">${s.icon}</span><span class="p-topic-t"><b>${esc(s.title)}</b><small>${s.hits}/${s.tries} right · ${'★'.repeat(s.stars)}${'☆'.repeat(3 - s.stars)}</small></span><span class="p-acc">${showPct(s.accuracy)}</span></li>`;
}

function dashHtml(sm: ParentSummary, noVoice = false): string {
  const modeRows = sm.modes.map(m => `
    <tr><th scope="row">${esc(m.title)}</th><td>${m.endless}</td><td>${m.sprint}</td><td>${m.boss}</td><td>${m.memory}</td><td>${m.training}</td></tr>`).join('');
  const yearCards = sm.years.map(y => `
    <div class="p-year">
      <div class="p-year-head"><b>${esc(y.title)}</b><small>${y.topicsTried}/${y.topicsTotal} topics tried</small></div>
      <div class="p-year-row"><span>★ ${y.stars}/${y.maxStars}</span>${bar(y.maxStars ? y.stars / y.maxStars : 0)}</div>
      <div class="p-year-row"><span>Accuracy ${showPct(y.accuracy)}</span>${bar(y.accuracy ?? 0)}</div>
    </div>`).join('');
  const weak = sm.weakest.length
    ? `<ul class="p-topics">${sm.weakest.map(topicRow).join('')}</ul>`
    : `<p class="p-empty">Not enough play yet to spot tricky topics — keep going!</p>`;
  const strong = sm.strongest.length
    ? `<ul class="p-topics">${sm.strongest.map(topicRow).join('')}</ul>`
    : '';
  return `
    <div class="p-stats">
      <div><b>${sm.totalAnswered}</b><small>questions answered</small></div>
      <div><b>${showPct(sm.overallAccuracy)}</b><small>overall accuracy</small></div>
      <div><b>★ ${sm.starsEarned}/${sm.starsMax}</b><small>stars earned</small></div>
      <div><b>${sm.topicsTried}/${sm.topicsTotal}</b><small>topics tried</small></div>
    </div>
    <div class="p-extra"><span>🔥 ${sm.streakDays}-day streak</span><span>🪙 ${sm.coins} coins</span><span>🏷️ ${sm.stickers}/${sm.stickersTotal} stickers</span></div>
    ${noVoice ? '<p class="p-note voice-note">This device has no speaking voice installed, so the game is showing the words instead. On Android: Settings → Accessibility → Text-to-speech.</p>' : ''}

    <h3 class="p-h">By island</h3>
    <div class="p-years">${yearCards}</div>

    <h3 class="p-h">Where to help ${sm.weakest.length ? '(trickiest topics)' : ''}</h3>
    ${weak}

    ${strong ? `<h3 class="p-h">Going well</h3>${strong}` : ''}

    <h3 class="p-h">Game modes — personal bests</h3>
    <div class="p-table-wrap"><table class="p-table">
      <thead><tr><th scope="col">Island</th><th scope="col" title="Sky Storm best score">Storm</th><th scope="col" title="Ninja Sprint best score">Sprint</th><th scope="col" title="Boss Battle knock-outs">Boss</th><th scope="col" title="Memory Match boards">Cards</th><th scope="col" title="Sensei training sessions">Sensei</th></tr></thead>
      <tbody>${modeRows}</tbody>
    </table></div>

    <h3 class="p-h">Move to another device</h3>
    <div class="p-move">
      <p class="p-move-say">Reinstalling the app clears everything saved on this device. Copy this code first, then paste it into <b>Restore</b> on the other device (or on this one after reinstalling).</p>
      <textarea class="p-code" id="save-code" rows="3" readonly aria-label="Your save code"></textarea>
      <button class="btn" id="copy-code">Copy the code</button>
      <textarea class="p-code" id="restore-code" rows="3" placeholder="Paste a code here to restore" aria-label="Paste a save code to restore"></textarea>
      <button class="btn" id="restore-go">Restore</button>
      <p class="p-move-msg" id="move-msg" role="status" hidden></p>
    </div>

    <p class="p-note">Everything above is read from this device, and the code never leaves it — nothing is uploaded and there are no accounts. (Time-on-task isn't recorded yet.)</p>

    <div class="p-reset">
      <p class="p-reset-say">Handing the tablet to a different child, or want a fresh start? This clears everything on this device.</p>
      <button class="btn bad" id="start-again">Start again</button>
    </div>`;
}

/** The confirmation modal: a deliberate typed word, not a single tap, before anything is cleared. */
function resetConfirmHTML(): string {
  return `
      <div class="modal reset-modal">
        <h2>Start again?</h2>
        <p>This clears everything on this device: progress, stars, coins, stickers, streak, name and ninja. It cannot be undone once you leave this screen.</p>
        <label class="reset-label" for="reset-word">Type ${RESET_WORD} to confirm</label>
        <input id="reset-word" class="gate-input reset-input" type="text" autocomplete="off" autocapitalize="characters" aria-label="Type ${RESET_WORD} to confirm">
        <div class="reset-actions">
          <button class="btn" id="reset-cancel">Cancel</button>
          <button class="btn bad" id="reset-go" disabled>Start again</button>
        </div>
      </div>`;
}

/** Shown for as long as the grown-up stays on this screen after resetting — the one chance to undo. */
function resetDoneHTML(): string {
  return `
      <div class="modal reset-modal">
        <h2>All cleared</h2>
        <p>This device is back to a fresh start. You can undo this until you leave this screen — after that it is gone.</p>
        <div class="reset-actions">
          <button class="btn" id="reset-undo">Undo</button>
          <button class="btn primary" id="reset-continue">Continue</button>
        </div>
      </div>`;
}

/**
 * "Move to another device" (#64): show the save code, copy it, and restore one.
 *
 * Restoring replaces everything on the device, so it takes two taps — the first only warns. `redraw` re-runs
 * the dashboard once a restore lands, because every number on the screen came from the save that was just
 * replaced. The clipboard write can be refused (an insecure origin, a browser that withholds it), and that is
 * not a failure worth a scary message: the text is selected instead so the grown-up can copy it by hand.
 */
function wireMove(redraw: () => void) {
  const code = $<HTMLTextAreaElement>('#save-code');
  const paste = $<HTMLTextAreaElement>('#restore-code');
  const msg = $('#move-msg');
  code.value = exportSave();

  const say = (text: string, bad = false) => {
    msg.textContent = text;
    msg.classList.toggle('bad', bad);
    msg.hidden = false;
  };

  const byHand = 'Select the code above and copy it by hand — this browser will not do it for us.';
  $('#copy-code').addEventListener('click', () => {
    sfx.tap();
    code.select();
    const written = navigator.clipboard?.writeText(code.value);
    if (!written) { say(byHand); return; }
    written.then(() => say('Copied. Paste it into Restore on the other device.')).catch(() => say(byHand));
  });

  let armed = false;
  $('#restore-go').addEventListener('click', () => {
    sfx.tap();
    if (!paste.value.trim()) { armed = false; say('Paste a code into the box above first.', true); return; }
    if (!armed) { armed = true; say('This replaces all the progress on this device. Tap Restore again to go ahead.', true); return; }
    armed = false;
    if (!importSave(paste.value.trim())) { say('That code is not a Sky Ninja Academy save.', true); return; }
    sfx.correct();
    redraw();
    // `msg` belongs to the dashboard that redraw() just threw away, so the confirmation goes on the new one.
    const fresh = $('#move-msg');
    fresh.textContent = 'Restored — the progress below came from that code.';
    fresh.classList.remove('bad');
    fresh.hidden = false;
  });
}

/** For grown-ups: a quick maths gate, then a read-only progress dashboard. */
export function parentsScreen(nav: Nav) {
  let gate = gateChallenge(Math.random);

  const drawGate = (wrong = false) => {
    render(`
    <section class="screen home parents">
      <div class="isl-head"><button class="icon-btn" id="back" aria-label="Back">←</button><div><b>For grown-ups</b><small>A quick check to keep this out of little hands</small></div></div>
      <div class="gate">
        <p class="gate-q">What is <b id="gate-q">${esc(gate.prompt)}</b>?</p>
        <input id="gate-input" class="gate-input" type="number" inputmode="numeric" autocomplete="off" aria-label="Answer" value="">
        <button class="btn" id="gate-go">Enter</button>
        <p class="gate-msg" id="gate-msg"${wrong ? '' : ' hidden'}>Not quite — this bit is for a grown-up.</p>
      </div>
    </section>`, 'bg-sky');
    $('#back').addEventListener('click', () => { sfx.tap(); nav.map(); });
    const input = $<HTMLInputElement>('#gate-input');
    const submit = () => {
      if (checkGate(input.value, gate.answer)) { sfx.correct(); drawDash(); }
      else { sfx.wrong(); gate = gateChallenge(Math.random); drawGate(true); }
    };
    $('#gate-go').addEventListener('click', submit);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
    input.focus();
  };

  const drawDash = () => {
    // Once a reset has happened, leaving this screen — by "Continue" or the back arrow alike — must land on
    // onboarding, never on the map with an empty profile (#115). "Undo" is the only way out of that state.
    let wasReset = false;
    let snapshot: SaveData | null = null;

    const sm = parentSummary(load(), TOPICS, YEARS, STICKER_IDS.length);
    render(`
    <section class="screen home parents dash">
      <div class="isl-head"><button class="icon-btn" id="back" aria-label="Back">←</button><div><b>Grown-ups dashboard</b><small>How ${esc(load().name || 'your ninja')} is getting on</small></div></div>
      <div class="parents-dash">${dashHtml(sm, voiceState() === 'no')}</div>
      <div class="overlay" id="reset-overlay" hidden></div>
    </section>`, 'bg-sky');
    $('#back').addEventListener('click', () => { sfx.tap(); if (wasReset) nav.avatar(); else nav.map(); });
    wireMove(() => drawDash());

    const overlay = $('#reset-overlay');
    const closeOverlay = () => { overlay.hidden = true; overlay.innerHTML = ''; };

    $('#start-again').addEventListener('click', () => {
      sfx.tap();
      overlay.hidden = false;
      overlay.innerHTML = resetConfirmHTML();
      const input = $<HTMLInputElement>('#reset-word');
      const go = $<HTMLButtonElement>('#reset-go');
      const update = () => { go.disabled = input.value.trim() !== RESET_WORD; };
      input.addEventListener('input', update);
      input.addEventListener('keydown', e => { if (e.key === 'Enter' && !go.disabled) go.click(); });
      $('#reset-cancel').addEventListener('click', () => { sfx.tap(); closeOverlay(); });
      go.addEventListener('click', () => {
        sfx.tap();
        snapshot = load();       // kept in memory only — the "Undo" affordance below is what can bring it back
        reset();
        wasReset = true;
        overlay.innerHTML = resetDoneHTML();
        $('#reset-undo').addEventListener('click', () => {
          sfx.tap();
          if (snapshot) save(snapshot);   // save() replaces every key, so this restores the snapshot exactly
          closeOverlay();
          drawDash();
        });
        $('#reset-continue').addEventListener('click', () => { sfx.tap(); nav.avatar(); });
      });
      input.focus();
    });
  };

  drawGate();
}
