import { AVATARS, avatarById, SENSEI, VILLAIN } from '../avatars';
import { GRAMMAR_MIN, grammarPool } from '../game/sprint-pools';
import { mtcDeck } from '../game/mtc';
import { TRICKY, trickyDeck } from '../game/tricky-facts';
import { leastSecure } from '../fact-record';
import { beltFor, totalStarsOf } from '../game/belts';
import { isKs2, listedTopics, shownYears, topicsFor, type Topic, type YearId, type YearInfo } from '../curriculum';
import { islandArt } from './island-placeholder';
import { islandsHTML, mapLayout } from './map-layout';
import { ACHIEVEMENTS, certificates, coinBalance, dojoToday, duelHistory, load, safeRecord, save, STICKER_IDS, STICKER_COST, type TopicProgress } from '../storage';
import type { Ks2Fact } from '../save-records';
import { certAlbumHTML, showStoredCertificate } from './certificate';
import { sfx, say } from '../audio';
import { needsSchoolYear } from '../school-year';
import { SPRINT_SECONDS } from '../game/session';
import { MODES } from '../game/modes';
import { senseiTopics, poolWeights } from '../game/sensei';
import { carriedStreak, dailyChallenges, multiplier, SET_BONUS, type Challenge, type DojoState } from '../game/dojo';
import { hasMemoryDecks } from '../game/memory';
import { duelHistoryHTML } from './duel';
import { chooserEligible, chooserTopics, duelChooserTopics, openChooser, trophyBadge, trophyCount } from './chooser';
import { $, $$, capDigits, render } from './dom';
import { groupTopics, topicsHTML } from './topic-groups';
import type { PlayOpts } from './play';

export type StartPlay = (o: PlayOpts) => void;
export type Nav = {
  avatar: () => void; map: () => void; island: (year: YearInfo) => void; play: StartPlay;
  memory: (year: YearInfo) => void; duel: (year: YearInfo, topic?: string) => void; rewards: () => void; shop: () => void; parents: () => void;
  pickYear: (year: YearInfo) => void;   // #1055: the school-year tap on a new child's map (a mission after "Let's go!", else the island)
  profiles: () => void;   // #20 slice 2: "Who is playing?"
  up: () => void;
};

function topbar(nav: Nav, rerender: () => void) {
  const d = load(); const av = avatarById(d.avatar);
  const html = `
    <header class="topbar">
      <button class="hero" id="change-av" aria-label="Change ninja" style="--glow:${av.glow}"><span class="portrait sm"><img src="${av.img}" alt="" style="--focus:${av.focus}"></span><span><b>${d.name || 'Ninja'}</b><small>${av.name} · ${av.element}</small></span></button>
      <div class="settings">
        <button class="coin-pill" id="rewards" aria-label="Rewards: ${coinBalance()} coins">🪙 <b>${capDigits(coinBalance())}</b>${d.streak.days > 1 ? ` <span class="streak">🔥${d.streak.days}</span>` : ''}</button>
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

/** #909: Sky Storm, Mixed Sprint and Boss Battle lean on topics this child has met and found hard. */
function playMixed(nav: Nav, year: YearInfo, mode: 'endless' | 'sprint' | 'boss' | 'relaxed', pool: Topic[], progress: Record<string, TopicProgress>) {
  nav.play({ year, mode, pool, weights: poolWeights(pool, progress) });
}
/** #910/#937: Sprint and Relaxed practice open a chooser first — "🎲 Mixed" or one topic from the open subject. */
function chooseThenPlay(nav: Nav, year: YearInfo, subject: 'maths' | 'writing', mode: 'sprint' | 'relaxed', pool: Topic[], progress: Record<string, TopicProgress>) {
  openChooser($('#island-overlay'), chooserTopics(year.id, subject), topic => {
    sfx.tap();
    topic ? nav.play({ year, mode, topic }) : playMixed(nav, year, mode, pool, progress);
  }, { mixed: true, badge: trophyBadge(year, progress) });
}
/** #894: a Daily Dojo row read aloud, for a pre-reader who cannot read the challenge title on the card. */
export function dojoRowLine(c: Challenge, progress: number): string {
  return progress >= c.goal ? `${c.title}. Done!` : `${c.title}. ${progress} of ${c.goal} done.`;
}
/** Daily Dojo card: today's three challenges, progress bars, bonus coins and the streak multiplier.
 *  Takes today's state and challenges rather than reading them itself (#894 silent-failure-hunter review):
 *  `mapScreen` needs the same two values again to bind the tap-to-speak handler, and a second `dojoToday()`
 *  call — a fresh `new Date()` — could in principle land on the other side of midnight from the first. */
function dojoCard(s: DojoState, cs: Challenge[]) {
  const carried = carriedStreak(s, s.date); const mult = multiplier(carried);
  const items = cs.map(c => { const p = Math.min(c.goal, s.progress[c.id] ?? 0); const done = s.done.includes(c.id); return `
    <li class="dojo-item${done ? ' done' : ''}" data-id="${c.id}"><span class="ic">${c.icon}</span><span class="txt"><b>${c.title}</b><span class="isl-bar"><i style="width:${Math.round(100 * p / c.goal)}%"></i></span></span><span class="prog">${done ? `✓ +${Math.floor(c.bonus * mult)} 🪙` : `${p}/${c.goal}`}</span></li>`; }).join('');
  return `
    <div class="dojo${s.setDone ? ' complete' : ''}" id="dojo" aria-label="Daily Dojo challenges">
      <div class="dojo-head"><b>🏯 Daily Dojo</b><small>${s.setDone ? `All done today · streak ${s.streak.days} day${s.streak.days === 1 ? '' : 's'}` : `Three challenges · bonus coins`}</small>${mult > 1 ? `<span class="pill mult">×${mult} streak</span>` : ''}</div>
      <ul class="dojo-list">${items}</ul>
      <small class="dojo-foot">${s.setDone ? 'Come back tomorrow for three new challenges' : `Finish all three → +${Math.floor(SET_BONUS * mult)} 🪙 bonus`}</small>
    </div>`;
}

let yearAsked = false;   // #1055: spoken once per page load, not on every redraw
/** Sky Map: one decision — which island (year group). */
export function mapScreen(nav: Nav) {
  const d = load();
  // #95: a hand-edited or corrupted "Restore" paste can carry `progress` as anything — importSave() only
  // checks the version — so this reads it the same tolerant way storage.ts's own achievement calculations do,
  // rather than indexing `d.progress` directly and throwing on the map screen the moment it is not an object.
  const progress = safeRecord<TopicProgress>(d.progress);
  const totalStars = (y: YearInfo) => topicsFor(y.id).reduce((s, t) => s + (progress[t.id]?.stars ?? 0), 0);
  const maxStars = (y: YearInfo) => topicsFor(y.id).length * 3;
  const shown = shownYears();
  const layout = mapLayout(shown.length);
  const ask = needsSchoolYear(d);   // #1055: first run only
  const tb = topbar(nav, () => mapScreen(nav));
  const dojoState = dojoToday(); const dojoChallenges = dailyChallenges(dojoState.date);
  // #1048: the four compact pixel values below belong to map-layout.ts's own compact size — they are
  // written here, not there, only because the #399 rail credits a custom property as declared where a
  // browser actually reads it, a literal style="…" attribute.
  render(`
  <section class="screen home map">
    ${tb.html}
    <h2 class="section-title">${ask ? 'Tap your school year' : 'Where will you train today?'}</h2>
    <div class="islands big" style="--cols:${layout.cols}${layout.compact ? ';--isl-h:88px;--isl-pad:118px;--art-w:96px;--art-h:62px' : ''}">
      ${islandsHTML(shown, y => ({ s: totalStars(y), m: maxStars(y) }), d.year, layout.compact)}
    </div>
    ${dojoCard(dojoState, dojoChallenges)}
    <footer class="foot"><span>Sky Ninja Academy · aligned to EYFS${shown.some(y => isKs2(y.id)) ? ', KS1 & KS2' : ' & KS1'} National Curriculum</span>
      <div class="foot-links">
        <button class="foot-link" id="grownups" aria-label="For grown-ups">👤 For grown-ups</button>
        <button class="foot-link" id="who" aria-label="Who is playing?">👥 Who is playing?</button>
      </div></footer>
  </section>`, 'bg-sky');
  tb.bind();
  if (ask && !yearAsked) { yearAsked = true; say('Tap your school year'); }
  $$('.island').forEach(b => b.addEventListener('click', () => {
    const y = shown.find(x => x.id === b.dataset.year)!;
    save(ask ? { year: y.id, ks2: { ...load().ks2, schoolYear: y.id } } : { year: y.id }); sfx.tap(); say(`${y.title} island`); ask ? nav.pickYear(y) : nav.island(y);
  }));
  // #894: a Daily Dojo row has no action of its own, so tapping it just reads it aloud, for a pre-reader.
  $$('.dojo-item').forEach(li => li.addEventListener('click', () => {
    const c = dojoChallenges.find(x => x.id === li.dataset.id); if (!c) return;
    say(dojoRowLine(c, Math.min(c.goal, dojoState.progress[c.id] ?? 0)), true);
  }));
  $('#grownups').addEventListener('click', () => { sfx.tap(); nav.parents(); });
  // #20 slice 2: with one profile the launch picker never shows, so this is the only way a second child is ever
  // added — it has to be on the sky map and not behind the grown-ups gate (the owner's decision: "adding one is
  // open to the child"). It sat on the topbar until #380 review round 5, B1: that row was full to the pixel, a
  // fourth `.icon-btn` hung 8px off a 390px iPhone and gave every topbar screen horizontal scroll, and the
  // 44px touch floor (`design-language` §4) says the space cannot come out of the buttons. Here it is beside
  // the other whole-device control instead, on the one screen every other screen comes back to.
  $('#who').addEventListener('click', () => { sfx.tap(); nav.profiles(); });
}

/** Tables Check practice (#1118): Year 4 only, through the menu's `years` filter. */
const mtcRow = (nav: Nav, year: YearInfo): MenuRow => ({ id: 'mtc', mod: 'sprint', vport: '<span class="vport emoji">✖️</span>', title: MODES.mtc.title,
  blurb: '25 questions · 6 seconds each', years: ['year4'], go: () => nav.play({ year, mode: 'mtc', deck: mtcDeck(Math.random) }) });
/** #1120: the same run, answered by typing on the number pad as the real check does. */
const mtcPadRow = (nav: Nav, year: YearInfo): MenuRow => ({
  ...mtcRow(nav, year), id: 'mtcpad', title: 'Tables Check on the number pad', blurb: 'type each answer · 6 seconds each',
  go: () => nav.play({ year, mode: 'mtc', input: 'keypad', deck: mtcDeck(Math.random) }),
});

/** Tricky Facts (#1124): Sensei's pick of the child's least secure × facts — KS2 islands only, and only while some fact is insecure. */
const trickyRow = (nav: Nav, year: YearInfo, facts: Record<string, Ks2Fact>): MenuRow[] => {
  const n = leastSecure(facts).length;
  return n ? [{
    id: 'tricky', mod: 'train', title: 'Tricky Facts', blurb: `Sensei's pick: ${n} ${n === 1 ? 'fact' : 'facts'}`, years: ['year3', 'year4'],
    vport: `<span class="vport"><img src="${SENSEI.img}" alt="${SENSEI.name}"></span>`,
    go: () => nav.play({ year, mode: 'sprint', topic: TRICKY, deck: trickyDeck(facts, Math.random) }),
  }] : [];
};

/** Grammar mix (#1234): a 60-second Sprint over the KS2 grammar topics up to this island; Years 5–6 only (the pool is empty elsewhere), once the pool is big enough. */
const grammarRow = (nav: Nav, year: YearInfo): MenuRow[] => {
  const pool = grammarPool(year.id);
  return pool.length < GRAMMAR_MIN ? [] : [{ id: 'grammar', mod: 'sprint', vport: '<span class="vport emoji">✏️</span>', title: 'Grammar mix',
    blurb: '60 seconds of grammar and punctuation', go: () => nav.play({ year, mode: 'sprint', pool, title: 'Grammar mix' }) }];
};

/** One island-menu row. `years` (#1117) limits it to those islands; no row has it yet, so every row shows everywhere. */
export interface MenuRow { id: string; mod: string; vport: string; title: string; blurb: string; go: () => void; years?: YearId[] }
export const menuFor = <T extends { years?: YearId[] }>(rows: T[], year: YearId): T[] => rows.filter(r => !r.years || r.years.includes(year));

/** #932: the Legend run menu row — only with a 3★ topic in hand; opens #910's chooser on exactly those topics, no Mixed. */
function legendRow(nav: Nav, year: YearInfo, progress: Record<string, TopicProgress>) {
  const list = topicsFor(year.id).filter(t => chooserEligible(t) && (progress[t.id]?.stars ?? 0) >= 3);
  const crowned = (t: Topic) => !!progress[t.id]?.crown;
  const pick = (t: Topic | null) => { if (t) { sfx.tap(); nav.play({ year, mode: 'mission', topic: t, legend: true }); } };
  return list.length ? [{ id: 'legend', mod: '', vport: '<span class="vport emoji">👑</span>', title: 'Legend run',
    blurb: `Hardest questions on your 3★ topics · 👑 ${list.filter(crowned).length}`,
    go: () => openChooser($('#island-overlay'), list, pick, { mixed: false, badge: t => crowned(t) ? ' 👑' : '' }) }] : [];
}

/** Island: topics for one year group + its Sky Storm. */
export function islandScreen(nav: Nav, year: YearInfo, subjectInit: 'maths' | 'writing' = 'maths') {
  const d = load();
  let subject = subjectInit;
  const tb = topbar(nav, () => islandScreen(nav, year, subject));
  const progress = safeRecord<TopicProgress>(d.progress);   // #95: same tolerance as mapScreen's totalStars
  const weakest = senseiTopics(topicsFor(year.id), progress, new Date());
  // #95: the four per-year best/count fields have the same hazard as `progress` — a hand-edited or corrupted
  // "Restore" paste can carry any of them as anything, and `d.training[year.id]` throws the moment `d.training`
  // itself is not an object, which `importSave()`'s version-only check does not rule out.
  const training = safeRecord<number>(d.training), endless = safeRecord<number>(d.endless);
  const sprint = safeRecord<number>(d.sprint), boss = safeRecord<number>(d.boss), memory = safeRecord<number>(d.memory);
  // #908: Sky Storm, Ninja Sprint and Boss Battle draw only from the open tab's topics — read at tap time via
  // `subject` so a tab switch is honoured without rebuilding the menu.
  const subjectPool = () => topicsFor(year.id, subject).filter(chooserEligible);
  // The island menu in one table (#26): a mode button is one entry. The battle modes take their title from MODES;
  // Sensei-training, Memory-Match and the Legend run (#932) are separate flows, so they live here too.
  const menu = menuFor<MenuRow>([   // #1117: a row with `years` shows only on those islands
    { id: 'train', mod: 'train', vport: `<span class="vport"><img src="${SENSEI.img}" alt="${SENSEI.name}"></span>`,
      title: 'Train with Sensei', blurb: `Your trickiest topics: ${weakest.map(t => t.icon).join(' ')} · sessions ${training[year.id] ?? 0}`,
      go: () => { say(`Sensei says: let's train ${weakest.map(t => t.title).join(', ')}`); nav.play({ year, mode: 'mission', pool: weakest }); } },
    { id: 'endless', mod: '', vport: `<span class="vport"><img src="${VILLAIN.img}" alt=""></span>`,
      title: MODES.endless.title, blurb: `Endless battle vs Hammer Man · best ${endless[year.id] ?? 0}`,
      go: () => playMixed(nav, year, 'endless', subjectPool(), progress) }, ...legendRow(nav, year, progress), mtcRow(nav, year), mtcPadRow(nav, year), ...grammarRow(nav, year),
    // #910: a chooser first — "🎲 Mixed" (today's Sprint, unchanged) or one topic from the open subject.
    { id: 'sprint', mod: 'sprint', vport: `<span class="vport emoji">⏱️</span>`,
      title: MODES.sprint.title, blurb: `${SPRINT_SECONDS} seconds, no lives · best ${sprint[year.id] ?? 0}`,
      go: () => chooseThenPlay(nav, year, subject, 'sprint', subjectPool(), progress) }, ...trickyRow(nav, year, d.ks2.facts),
    { id: 'relaxed', mod: 'relaxed', vport: `<span class="vport emoji">🌱</span>`, title: MODES.relaxed.title, blurb: 'No lives, no clock',   // #937
      go: () => chooseThenPlay(nav, year, subject, 'relaxed', subjectPool(), progress) },
    { id: 'boss', mod: 'boss', vport: `<span class="vport"><img src="${VILLAIN.img}" alt=""></span>`,
      title: MODES.boss.title, blurb: `Knock out Hammer Man · KOs ${boss[year.id] ?? 0}`,
      go: () => playMixed(nav, year, 'boss', subjectPool(), progress) },
    // #1049: Memory Match used to fall back to Reception's decks for a year with none of its own — hidden
    // instead, since `pickTheme` now throws rather than hand a KS2 child a Reception board.
    ...(hasMemoryDecks(year.id) ? [{ id: 'memory', mod: 'memory', vport: `<span class="vport emoji">🃏</span>`,
      title: 'Memory Match', blurb: `Calm card pairs, no slicing · boards ${memory[year.id] ?? 0}`,
      go: () => nav.memory(year) }] : []),
    { id: 'duel', mod: 'duel', vport: `<span class="vport emoji">⚔️</span>`,
      title: 'Ninja Duel', blurb: 'Two players · first slice wins',
      go: () => openChooser($('#island-overlay'), duelChooserTopics(year, subject), topic => { sfx.tap(); topic ? nav.duel(year, topic.id) : nav.duel(year); }, { mixed: true, mixedLabel: 'Random' }) },   // the hand-over line is spoken with round 1's question (src/game/duel.ts)
  ], year.id);
  render(`
  <section class="screen home island-screen">
    ${tb.html}
    <div class="isl-head">
      <button class="icon-btn" id="back" aria-label="Back to the sky map">←</button>
      <span class="isl-art" style="background-image:url(&quot;${islandArt(year)}&quot;)"></span>
      <div><b>${year.title} Island</b><small>${year.age} · ${year.blurb}${trophyCount(year, progress)}</small></div>
    </div>
    <div class="tabs" role="tablist">
      <button class="tab${subject === 'maths' ? ' on' : ''}" data-s="maths" role="tab">🔢 Maths</button>
      <button class="tab${subject === 'writing' ? ' on' : ''}" data-s="writing" role="tab">✍️ Writing</button>
    </div>
    <div class="topics" id="topics"></div>
    <div class="mode-grid">
      ${menu.map(m =>
        `<button class="btn mode-btn${m.mod ? ` ${m.mod}` : ''}" id="${m.id}">${m.vport}<span><b>${m.title}</b><small>${m.blurb}</small></span></button>`
      ).join('\n      ')}
    </div>
    <div class="overlay" id="island-overlay" hidden></div>
  </section>`, 'bg-sky');
  tb.bind();
  const drawTopics = () => {
    const list = topicsFor(year.id, subject);
    $('#topics').innerHTML = topicsHTML(groupTopics(list), progress);
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

/** #894: a locked sticker shows only "???" and a small-print hint, so tapping it reads how it is earned aloud. */
export function lockedStickerLine(cost: number | undefined, achievementTitle: string | undefined): string {
  return cost != null ? `This sticker costs ${cost} coins.` : (achievementTitle ?? '');
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
    return `<div class="sticker${got ? ' got' : ''}" data-id="${id}" style="--glow:${a?.glow ?? '#ff3b5c'}"><span class="figure"><img src="${img}" alt=""></span><b>${got ? name : '???'}</b><small>${got ? sub : hint}</small>${prog ? `<span class="isl-bar"><i style="width:${Math.min(100, Math.round(100 * prog.done / prog.goal))}%"></i></span><small class="prog">${prog.done}/${prog.goal}</small>` : ''}</div>`;
  }).join('');
  const nextCoinIdx = STICKER_COST.findIndex(c => d.coins < c);
  const nextCoin = nextCoinIdx === -1 ? null : STICKER_COST[nextCoinIdx];
  const banner = d.stickers.length === STICKER_IDS.length ? 'Album complete — legendary!'
    : nextCoin ? `<span>Next sticker at 🪙 ${nextCoin}</span><span class="isl-bar"><i style="width:${Math.min(100, Math.round(100 * d.coins / nextCoin))}%"></i></span>`
    : 'The rest of the album is earned by playing, not by coins — see each sticker below';
  const certs = certificates();
  const duels = duelHistory();
  // #16's last piece, listed under the certificates because it is the other thing on this screen a child
  // earned by playing rather than bought. The subtitle is hoisted out of the markup below to keep the
  // long-line budget in `guardrails.test.ts` falling (#36) — it only ever ratchets down.
  const duelsSub = duels.length === 0 ? 'Play a Ninja Duel with a friend'
    : duels.length === 1 ? 'your last match' : `your last ${duels.length} matches`;
  render(`
  <section class="screen home rewards">
    ${tb.html}
    <div class="isl-head"><button class="icon-btn" id="back" aria-label="Back">←</button><div><b>Ninja Rewards</b><small>🥋 ${beltFor(totalStarsOf(load().progress, listedTopics())).name} belt · Earn coins for a fast start — the rest of the album comes from playing</small></div></div>
    <button class="btn primary shop-btn" id="shop">🛍️ Ninja Shop <small>spend 🪙 ${capDigits(coinBalance())}</small></button>
    <div class="reward-stats">
      <div><b>🪙 ${capDigits(d.coins)}</b><small>coins earned</small></div>
      <div><b>🔥 ${d.streak.days}</b><small>day streak</small></div>
      <div><b>${d.stickers.length}/${STICKER_IDS.length}</b><small>stickers</small></div>
    </div>
    <div class="next-sticker">${banner}</div>
    <div class="album">${cards}</div>
    <div class="rewards-cols">
      <div class="rewards-col">
        <div class="isl-head"><span class="icon-btn" aria-hidden="true">🎓</span><div><b>My certificates</b><small>${certs.length ? `${certs.length} earned` : 'Win a mission to earn one'}</small></div></div>
        ${certAlbumHTML(certs)}
      </div>
      <div class="rewards-col">
        <div class="isl-head"><span class="icon-btn" aria-hidden="true">⚔️</span><div><b>Recent duels</b><small>${duelsSub}</small></div></div>
        ${duelHistoryHTML(duels)}
      </div>
    </div>
  </section>`, 'bg-sky');
  tb.bind();
  $('#back').addEventListener('click', () => { sfx.tap(); nav.map(); });
  $('#shop').addEventListener('click', () => { sfx.tap(); nav.shop(); });
  // #894: a locked sticker's goal is printed in small text a pre-reader cannot read — a tap reads it aloud.
  $$('.sticker:not(.got)').forEach(el => el.addEventListener('click', () => {
    const i = STICKER_IDS.indexOf(el.dataset.id!);
    const ach = ACHIEVEMENTS.find(x => x.id === el.dataset.id);
    say(lockedStickerLine(i >= 0 && i < STICKER_COST.length ? STICKER_COST[i] : undefined, ach?.title), true);
  }));
  $$('.cert-open').forEach(b => b.addEventListener('click', async () => {
    sfx.tap(); const btn = b as HTMLButtonElement; const c = certs.find(x => x.id === btn.dataset.id);
    if (!c) return;
    btn.disabled = true;
    try { await showStoredCertificate(c); } finally { btn.disabled = false; }
  }));
}
