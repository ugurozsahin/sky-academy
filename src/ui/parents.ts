import { TOPICS, YEARS } from '../curriculum';
import { load, STICKER_IDS } from '../storage';
import { sfx } from '../audio';
import { gateChallenge, checkGate, parentSummary, pct, type ParentSummary, type TopicStat } from '../game/parents';
import { $, esc, render } from './dom';

type Nav = { map: () => void };

const showPct = (x: number | null) => (x === null ? '—' : `${pct(x)}%`);
const bar = (frac: number) => `<span class="isl-bar"><i style="width:${Math.round(100 * Math.max(0, Math.min(1, frac)))}%"></i></span>`;

function topicRow(s: TopicStat): string {
  return `<li class="p-topic"><span class="ic">${s.icon}</span><span class="p-topic-t"><b>${esc(s.title)}</b><small>${s.hits}/${s.tries} right · ${'★'.repeat(s.stars)}${'☆'.repeat(3 - s.stars)}</small></span><span class="p-acc">${showPct(s.accuracy)}</span></li>`;
}

function dashHtml(sm: ParentSummary): string {
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

    <p class="p-note">Read-only summary from this device. Nothing is uploaded and there are no accounts. (Time-on-task isn't recorded yet.)</p>`;
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
    const sm = parentSummary(load(), TOPICS, YEARS, STICKER_IDS.length);
    render(`
    <section class="screen home parents dash">
      <div class="isl-head"><button class="icon-btn" id="back" aria-label="Back">←</button><div><b>Grown-ups dashboard</b><small>How ${esc(load().name || 'your ninja')} is getting on</small></div></div>
      <div class="parents-dash">${dashHtml(sm)}</div>
    </section>`, 'bg-sky');
    $('#back').addEventListener('click', () => { sfx.tap(); nav.map(); });
  };

  drawGate();
}
