import { AVATARS, avatarById, VILLAIN } from '../avatars';
import { YEARS, topicsFor, type Topic, type YearInfo } from '../curriculum';
import { load, save, STICKER_IDS, STICKER_COST } from '../storage';
import { sfx, say } from '../audio';
import { $, $$, render, stars } from './dom';

export type StartPlay = (o: { year: YearInfo; topic?: Topic; mode: 'mission' | 'endless' }) => void;
type Nav = { avatar: () => void; map: () => void; island: (year: YearInfo) => void; play: StartPlay; rewards: () => void };

const ISLAND_BLURB: Record<YearInfo['id'], string> = { reception: 'First steps · counting, sounds & letters', year1: 'Number bonds, adding, phonics & spelling', year2: 'Times tables, money, time & tricky words' };

function topbar(nav: Nav, rerender: () => void) {
  const d = load(); const av = avatarById(d.avatar);
  const html = `
    <header class="topbar">
      <button class="hero" id="change-av" aria-label="Change ninja" style="--glow:${av.glow}"><span class="portrait sm"><img src="${av.img}" alt="" style="--focus:${av.focus}"></span><span><b>${d.name || 'Ninja'}</b><small>${av.name} · ${av.element}</small></span></button>
      <div class="settings">
        <button class="coin-pill" id="rewards" aria-label="Rewards: ${d.coins} coins">🪙 <b>${d.coins}</b>${d.streak.days > 1 ? ` <span class="streak">🔥${d.streak.days}</span>` : ''}</button>
        <button class="icon-btn" id="snd" aria-label="Sound ${d.sound ? 'on' : 'off'}">${d.sound ? '🔊' : '🔇'}</button>
        <button class="icon-btn" id="spk" aria-label="Read aloud ${d.speech ? 'on' : 'off'}">${d.speech ? '🗣️' : '🤐'}</button>
      </div>
    </header>`;
  const bind = () => {
    $('#change-av').addEventListener('click', () => nav.avatar());
    $('#rewards').addEventListener('click', () => { sfx.tap(); nav.rewards(); });
    $('#snd').addEventListener('click', () => { save({ sound: !load().sound }); rerender(); });
    $('#spk').addEventListener('click', () => { const on = !load().speech; save({ speech: on }); if (on) say('Read aloud is on', true); rerender(); });
  };
  return { html, bind };
}

/** Sky Map: one decision — which island (year group). */
export function mapScreen(nav: Nav) {
  const d = load();
  const totalStars = (y: YearInfo) => topicsFor(y.id).reduce((s, t) => s + (d.progress[t.id]?.stars ?? 0), 0);
  const maxStars = (y: YearInfo) => topicsFor(y.id).length * 3;
  const tb = topbar(nav, () => mapScreen(nav));
  render(`
  <section class="screen home map">
    ${tb.html}
    <h2 class="section-title">Where will you train today?</h2>
    <div class="islands big">
      ${YEARS.map((y, i) => { const s = totalStars(y), m = maxStars(y); return `
        <button class="island i${i}${y.id === d.year ? ' sel' : ''}" data-year="${y.id}" aria-label="${y.title} island">
          <span class="isl-art"></span>
          <span class="isl-text"><b>${y.title}</b><small>${y.age} · ${ISLAND_BLURB[y.id]}</small>
          <span class="isl-bar"><i style="width:${m ? Math.round(100 * s / m) : 0}%"></i></span><span class="isl-stars">★ ${s}/${m}</span></span>
          <span class="isl-go">Go →</span>
        </button>`; }).join('')}
    </div>
    <footer class="foot">Sky Ninja Academy · aligned to EYFS & KS1 National Curriculum</footer>
  </section>`, 'bg-sky');
  tb.bind();
  $$('.island').forEach(b => b.addEventListener('click', () => { const y = YEARS.find(x => x.id === b.dataset.year)!; save({ year: y.id }); sfx.tap(); say(`${y.title} island`); nav.island(y); }));
}

/** Island: topics for one year group + its Sky Storm. */
export function islandScreen(nav: Nav, year: YearInfo, subjectInit: 'maths' | 'writing' = 'maths') {
  const d = load();
  let subject = subjectInit;
  const idx = YEARS.indexOf(year);
  const tb = topbar(nav, () => islandScreen(nav, year, subject));
  render(`
  <section class="screen home island-screen">
    ${tb.html}
    <div class="isl-head i${idx}">
      <button class="icon-btn" id="back" aria-label="Back to the sky map">←</button>
      <span class="isl-art"></span>
      <div><b>${year.title} Island</b><small>${year.age} · ${ISLAND_BLURB[year.id]}</small></div>
    </div>
    <div class="tabs" role="tablist">
      <button class="tab${subject === 'maths' ? ' on' : ''}" data-s="maths" role="tab">🔢 Maths</button>
      <button class="tab${subject === 'writing' ? ' on' : ''}" data-s="writing" role="tab">✍️ Writing</button>
    </div>
    <div class="topics" id="topics"></div>
    <button class="btn storm" id="endless"><span class="vport"><img src="${VILLAIN.img}" alt=""></span><span><b>Sky Storm</b><small>Endless battle vs Hammer Man · best ${d.endless[year.id] ?? 0}</small></span></button>
  </section>`, 'bg-sky');
  tb.bind();
  const drawTopics = () => {
    const list = topicsFor(year.id, subject);
    $('#topics').innerHTML = list.map(t => { const p = d.progress[t.id]; return `
      <button class="topic" data-id="${t.id}" title="${t.nc}">
        <span class="ic">${t.icon}</span><b>${t.title}</b>
        ${stars(p?.stars ?? 0)}${t.mode === 'tracing' ? '<small class="pill">tracing</small>' : ''}
      </button>`; }).join('');
    $$('.topic').forEach(b => b.addEventListener('click', () => { const t = list.find(x => x.id === b.dataset.id)!; sfx.tap(); nav.play({ year, topic: t, mode: 'mission' }); }));
  };
  drawTopics();
  $('#back').addEventListener('click', () => { sfx.tap(); nav.map(); });
  $$('.tab').forEach(b => b.addEventListener('click', () => { subject = b.dataset.s as 'maths' | 'writing'; $$('.tab').forEach(x => x.classList.toggle('on', x === b)); sfx.tap(); drawTopics(); }));
  $('#endless').addEventListener('click', () => { sfx.tap(); nav.play({ year, mode: 'endless' }); });
}

/** Rewards: coins, streak and the sticker album. */
export function rewardsScreen(nav: Nav) {
  const d = load();
  const tb = topbar(nav, () => rewardsScreen(nav));
  const cards = STICKER_IDS.map((id, i) => {
    const a = AVATARS.find(x => x.id === id); const img = a ? a.img : VILLAIN.img; const name = a ? a.name : VILLAIN.name; const sub = a ? a.element : 'Villain';
    const got = d.stickers.includes(id); const need = STICKER_COST[i];
    return `<div class="sticker${got ? ' got' : ''}" style="--glow:${a?.glow ?? '#ff3b5c'}"><span class="figure"><img src="${img}" alt=""></span><b>${got ? name : '???'}</b><small>${got ? sub : `🪙 ${need}`}</small></div>`;
  }).join('');
  const nextIdx = STICKER_COST.findIndex(c => d.coins < c);
  const next = nextIdx === -1 ? null : STICKER_COST[nextIdx];
  render(`
  <section class="screen home rewards">
    ${tb.html}
    <div class="isl-head"><button class="icon-btn" id="back" aria-label="Back">←</button><div><b>Ninja Rewards</b><small>Earn coins by answering — unlock every ninja sticker</small></div></div>
    <div class="reward-stats">
      <div><b>🪙 ${d.coins}</b><small>coins</small></div>
      <div><b>🔥 ${d.streak.days}</b><small>day streak</small></div>
      <div><b>${d.stickers.length}/${STICKER_IDS.length}</b><small>stickers</small></div>
    </div>
    ${next ? `<div class="next-sticker"><span>Next sticker at 🪙 ${next}</span><span class="isl-bar"><i style="width:${Math.min(100, Math.round(100 * d.coins / next))}%"></i></span></div>` : '<div class="next-sticker">Album complete — legendary!</div>'}
    <div class="album">${cards}</div>
  </section>`, 'bg-sky');
  tb.bind();
  $('#back').addEventListener('click', () => { sfx.tap(); nav.map(); });
}
