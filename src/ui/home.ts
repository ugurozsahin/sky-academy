import { AVATARS, avatarById, SENSEI, VILLAIN } from '../avatars';
import { YEARS, topicsFor, type Topic, type YearInfo } from '../curriculum';
import { ACHIEVEMENTS, certificates, coinBalance, dojoToday, load, safeRecord, save, STICKER_IDS, STICKER_COST, type TopicProgress } from '../storage';
import { certAlbumHTML, showStoredCertificate } from './certificate';
import { sfx, say } from '../audio';
import { SPRINT_SECONDS, type Mode } from '../game/session';
import { MODES } from '../game/modes';
import { weakestTopics } from '../game/sensei';
import { carriedStreak, dailyChallenges, multiplier, SET_BONUS } from '../game/dojo';
import { $, $$, render, stars } from './dom';

export type StartPlay = (o: { year: YearInfo; topic?: Topic; mode: Mode; pool?: Topic[] }) => void;
export type Nav = {
  avatar: () => void; map: () => void; island: (year: YearInfo) => void; play: StartPlay;
  memory: (year: YearInfo) => void; duel: (year: YearInfo) => void; rewards: () => void; shop: () => void; parents: () => void; up: () => void;
};

function topbar(nav: Nav, rerender: () => void) {
  const d = load(); const av = avatarById(d.avatar);
  const html = `
    <header class="topbar">
      <button class="hero" id="change-av" aria-label="Change ninja" style="--glow:${av.glow}"><span class="portrait sm"><img src="${av.img}" alt="" style="--focus:${av.focus}"></span><span><b>${d.name || 'Ninja'}</b><small>${av.name} · ${av.element}</small></span></button>
      <div class="settings">
        <button class="coin-pill" id="rewards" aria-label="Rewards: ${coinBalance()} coins">🪙 <b>${coinBalance()}</b>${d.streak.days > 1 ? ` <span class="streak">🔥${d.streak.days}</span>` : ''}</button>
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

/** Daily Dojo card: today's three challenges, progress bars, bonus coins and the streak multiplier. */
function dojoCard() {
  const s = dojoToday(); const cs = dailyChallenges(s.date); const carried = carriedStreak(s, s.date); const mult = multiplier(carried);
  const items = cs.map(c => { const p = Math.min(c.goal, s.progress[c.id] ?? 0); const done = s.done.includes(c.id); return `
    <li class="dojo-item${done ? ' done' : ''}"><span class="ic">${c.icon}</span><span class="txt"><b>${c.title}</b><span class="isl-bar"><i style="width:${Math.round(100 * p / c.goal)}%"></i></span></span><span class="prog">${done ? `✓ +${Math.floor(c.bonus * mult)} 🪙` : `${p}/${c.goal}`}</span></li>`; }).join('');
  return `
    <div class="dojo${s.setDone ? ' complete' : ''}" id="dojo" aria-label="Daily Dojo challenges">
      <div class="dojo-head"><b>🏯 Daily Dojo</b><small>${s.setDone ? `All done today · streak ${s.streak.days} day${s.streak.days === 1 ? '' : 's'}` : `Three challenges · bonus coins`}</small>${mult > 1 ? `<span class="pill mult">×${mult} streak</span>` : ''}</div>
      <ul class="dojo-list">${items}</ul>
      <small class="dojo-foot">${s.setDone ? 'Come back tomorrow for three new challenges' : `Finish all three → +${Math.floor(SET_BONUS * mult)} 🪙 bonus`}</small>
    </div>`;
}

/** Sky Map: one decision — which island (year group). */
export function mapScreen(nav: Nav) {
  const d = load();
  // #95: a hand-edited or corrupted "Restore" paste can carry `progress` as anything — importSave() only
  // checks the version — so this reads it the same tolerant way storage.ts's own achievement calculations do,
  // rather than indexing `d.progress` directly and throwing on the map screen the moment it is not an object.
  const progress = safeRecord<TopicProgress>(d.progress);
  const totalStars = (y: YearInfo) => topicsFor(y.id).reduce((s, t) => s + (progress[t.id]?.stars ?? 0), 0);
  const maxStars = (y: YearInfo) => topicsFor(y.id).length * 3;
  const tb = topbar(nav, () => mapScreen(nav));
  render(`
  <section class="screen home map">
    ${tb.html}
    <h2 class="section-title">Where will you train today?</h2>
    <div class="islands big" style="--cols:${YEARS.length}">
      ${YEARS.map((y, i) => { const s = totalStars(y), m = maxStars(y); return `
        <button class="island${y.id === d.year ? ' sel' : ''}" data-year="${y.id}" style="--tint:${y.tint}" aria-label="${y.title} island">
          <span class="isl-art" style="background-image:url(&quot;${y.art}&quot;);animation-delay:${(-1.3 * i).toFixed(1)}s"></span>
          <span class="isl-text"><b>${y.title}</b><small>${y.age} · ${y.blurb}</small>
          <span class="isl-bar"><i style="width:${m ? Math.round(100 * s / m) : 0}%"></i></span><span class="isl-stars">★ ${s}/${m}</span></span>
          <span class="isl-go">Go →</span>
        </button>`; }).join('')}
    </div>
    ${dojoCard()}
    <footer class="foot"><span>Sky Ninja Academy · aligned to EYFS & KS1 National Curriculum</span><button class="foot-link" id="grownups" aria-label="For grown-ups">👤 For grown-ups</button></footer>
  </section>`, 'bg-sky');
  tb.bind();
  $$('.island').forEach(b => b.addEventListener('click', () => {
    const y = YEARS.find(x => x.id === b.dataset.year)!;
    save({ year: y.id }); sfx.tap(); say(`${y.title} island`); nav.island(y);
  }));
  $('#grownups').addEventListener('click', () => { sfx.tap(); nav.parents(); });
}

/** Island: topics for one year group + its Sky Storm. */
export function islandScreen(nav: Nav, year: YearInfo, subjectInit: 'maths' | 'writing' = 'maths') {
  const d = load();
  let subject = subjectInit;
  const tb = topbar(nav, () => islandScreen(nav, year, subject));
  const progress = safeRecord<TopicProgress>(d.progress);   // #95: same tolerance as mapScreen's totalStars
  const weakest = weakestTopics(topicsFor(year.id), progress);
  // #95: the four per-year best/count fields have the same hazard as `progress` — a hand-edited or corrupted
  // "Restore" paste can carry any of them as anything, and `d.training[year.id]` throws the moment `d.training`
  // itself is not an object, which `importSave()`'s version-only check does not rule out.
  const training = safeRecord<number>(d.training), endless = safeRecord<number>(d.endless);
  const sprint = safeRecord<number>(d.sprint), boss = safeRecord<number>(d.boss), memory = safeRecord<number>(d.memory);
  // The island menu in one table (#26): adding a mode button is one entry, not a new <button> line plus a new
  // click handler. The three battle modes take their title from MODES; Sensei-training and Memory-Match are
  // separate flows (not a Session.Mode), so they live here too rather than being forced into MODES.
  const menu: { id: string; mod: string; vport: string; title: string; blurb: string; go: () => void }[] = [
    { id: 'train', mod: 'train', vport: `<span class="vport"><img src="${SENSEI.img}" alt="${SENSEI.name}"></span>`,
      title: 'Train with Sensei', blurb: `Your trickiest topics: ${weakest.map(t => t.icon).join(' ')} · sessions ${training[year.id] ?? 0}`,
      go: () => { say(`Sensei says: let's train ${weakest.map(t => t.title).join(', ')}`); nav.play({ year, mode: 'mission', pool: weakest }); } },
    { id: 'endless', mod: '', vport: `<span class="vport"><img src="${VILLAIN.img}" alt=""></span>`,
      title: MODES.endless.title, blurb: `Endless battle vs Hammer Man · best ${endless[year.id] ?? 0}`,
      go: () => nav.play({ year, mode: 'endless' }) },
    { id: 'sprint', mod: 'sprint', vport: `<span class="vport emoji">⏱️</span>`,
      title: MODES.sprint.title, blurb: `${SPRINT_SECONDS} seconds, no lives · best ${sprint[year.id] ?? 0}`,
      go: () => nav.play({ year, mode: 'sprint' }) },
    { id: 'boss', mod: 'boss', vport: `<span class="vport"><img src="${VILLAIN.img}" alt=""></span>`,
      title: MODES.boss.title, blurb: `Knock out Hammer Man · KOs ${boss[year.id] ?? 0}`,
      go: () => nav.play({ year, mode: 'boss' }) },
    { id: 'memory', mod: 'memory', vport: `<span class="vport emoji">🃏</span>`,
      title: 'Memory Match', blurb: `Calm card pairs, no slicing · boards ${memory[year.id] ?? 0}`,
      go: () => nav.memory(year) },
    { id: 'duel', mod: 'duel', vport: `<span class="vport emoji">⚔️</span>`,
      title: 'Ninja Duel', blurb: 'Two players · first slice wins',
      go: () => { say('Ninja Duel! Hand the top half to a friend'); nav.duel(year); } },
  ];
  render(`
  <section class="screen home island-screen">
    ${tb.html}
    <div class="isl-head">
      <button class="icon-btn" id="back" aria-label="Back to the sky map">←</button>
      <span class="isl-art" style="background-image:url(&quot;${year.art}&quot;)"></span>
      <div><b>${year.title} Island</b><small>${year.age} · ${year.blurb}</small></div>
    </div>
    <div class="tabs" role="tablist">
      <button class="tab${subject === 'maths' ? ' on' : ''}" data-s="maths" role="tab">🔢 Maths</button>
      <button class="tab${subject === 'writing' ? ' on' : ''}" data-s="writing" role="tab">✍️ Writing</button>
    </div>
    <div class="topics" id="topics"></div>
    ${menu.map(m =>
      `<button class="btn mode-btn${m.mod ? ` ${m.mod}` : ''}" id="${m.id}">${m.vport}<span><b>${m.title}</b><small>${m.blurb}</small></span></button>`
    ).join('\n    ')}
  </section>`, 'bg-sky');
  tb.bind();
  const drawTopics = () => {
    const list = topicsFor(year.id, subject);
    $('#topics').innerHTML = list.map(t => { const p = progress[t.id]; return `
      <button class="topic" data-id="${t.id}" data-subject="${t.subject}" title="${t.nc}">
        <span class="ic">${t.icon}</span><b>${t.title}</b>
        ${stars(p?.stars ?? 0)}${t.input === 'tracing' ? '<small class="pill">tracing</small>' : ''}
      </button>`; }).join('');
    $$('.topic').forEach(b => b.addEventListener('click', () => { const t = list.find(x => x.id === b.dataset.id)!; sfx.tap(); nav.play({ year, topic: t, mode: 'mission' }); }));
  };
  drawTopics();
  $('#back').addEventListener('click', () => { sfx.tap(); nav.map(); });
  $$('.tab').forEach(b => b.addEventListener('click', () => {
    subject = b.dataset.s as 'maths' | 'writing';
    $$('.tab').forEach(x => x.classList.toggle('on', x === b)); sfx.tap(); drawTopics();
  }));
  menu.forEach(m => $(`#${m.id}`).addEventListener('click', () => { sfx.tap(); m.go(); }));
}

/** Rewards: coins, streak and the sticker album. */
export function rewardsScreen(nav: Nav) {
  const d = load();
  const tb = topbar(nav, () => rewardsScreen(nav));
  const cards = STICKER_IDS.map((id, i) => {
    const a = AVATARS.find(x => x.id === id); const img = a ? a.img : VILLAIN.img; const name = a ? a.name : VILLAIN.name; const sub = a ? a.element : 'Villain';
    const got = d.stickers.includes(id);
    const ach = ACHIEVEMENTS.find(x => x.id === id);
    const prog = !got && ach ? ach.progress(d) : null;
    const hint = i < STICKER_COST.length ? `🪙 ${STICKER_COST[i]}` : (ach?.title ?? '');
    return `<div class="sticker${got ? ' got' : ''}" style="--glow:${a?.glow ?? '#ff3b5c'}"><span class="figure"><img src="${img}" alt=""></span><b>${got ? name : '???'}</b><small>${got ? sub : hint}</small>${prog ? `<span class="isl-bar"><i style="width:${Math.min(100, Math.round(100 * prog.done / prog.goal))}%"></i></span><small class="prog">${prog.done}/${prog.goal}</small>` : ''}</div>`;
  }).join('');
  const nextCoinIdx = STICKER_COST.findIndex(c => d.coins < c);
  const nextCoin = nextCoinIdx === -1 ? null : STICKER_COST[nextCoinIdx];
  const banner = d.stickers.length === STICKER_IDS.length ? 'Album complete — legendary!'
    : nextCoin ? `<span>Next sticker at 🪙 ${nextCoin}</span><span class="isl-bar"><i style="width:${Math.min(100, Math.round(100 * d.coins / nextCoin))}%"></i></span>`
    : 'The rest of the album is earned by playing, not by coins — see each sticker below';
  const certs = certificates();
  render(`
  <section class="screen home rewards">
    ${tb.html}
    <div class="isl-head"><button class="icon-btn" id="back" aria-label="Back">←</button><div><b>Ninja Rewards</b><small>Earn coins for a fast start — the rest of the album comes from playing</small></div></div>
    <button class="btn primary shop-btn" id="shop">🛍️ Ninja Shop <small>spend 🪙 ${coinBalance()}</small></button>
    <div class="reward-stats">
      <div><b>🪙 ${d.coins}</b><small>coins earned</small></div>
      <div><b>🔥 ${d.streak.days}</b><small>day streak</small></div>
      <div><b>${d.stickers.length}/${STICKER_IDS.length}</b><small>stickers</small></div>
    </div>
    <div class="next-sticker">${banner}</div>
    <div class="album">${cards}</div>
    <div class="isl-head"><span class="icon-btn" aria-hidden="true">🎓</span><div><b>My certificates</b><small>${certs.length ? `${certs.length} earned` : 'Win a mission to earn one'}</small></div></div>
    ${certAlbumHTML(certs)}
  </section>`, 'bg-sky');
  tb.bind();
  $('#back').addEventListener('click', () => { sfx.tap(); nav.map(); });
  $('#shop').addEventListener('click', () => { sfx.tap(); nav.shop(); });
  $$('.cert-open').forEach(b => b.addEventListener('click', async () => {
    sfx.tap(); const btn = b as HTMLButtonElement; const c = certs.find(x => x.id === btn.dataset.id);
    if (!c) return;
    btn.disabled = true;
    try { await showStoredCertificate(c); } finally { btn.disabled = false; }
  }));
}
