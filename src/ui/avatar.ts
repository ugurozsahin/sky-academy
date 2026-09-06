import { ALL_AVATARS, MASTER, SENSEI_LINES } from '../avatars';
import { TOPICS } from '../curriculum';
import { masterProgress } from '../game/sensei';
import { load, save } from '../storage';
import { sfx, say } from '../audio';
import { $, $$, esc, render } from './dom';

export function avatarScreen(go: (s: 'home') => void) {
  const d = load();
  const master = masterProgress(TOPICS, d.progress);   // the 11th ninja unlocks when every topic has a star
  render(`
  <section class="screen avatar-screen">
    <header class="brand"><span class="kanji">忍</span><h1>Sky Ninja<br><span>Academy</span></h1><p class="tag">Choose your ninja</p></header>
    <div class="avatar-grid" role="list">
      ${ALL_AVATARS.map(a => { const locked = a.id === MASTER.id && !master.unlocked && d.avatar !== MASTER.id; /* an earned Master is never taken away */ return `
        <button class="avatar-card${d.avatar === a.id ? ' sel' : ''}${locked ? ' locked' : ''}" data-id="${a.id}" style="--glow:${a.glow}" role="listitem" aria-label="${a.name}, ${a.element}${locked ? `, locked: ${master.done} of ${master.total} topics starred` : ''}" ${locked ? 'aria-disabled="true"' : ''}>
          <span class="figure"><img src="${a.img}" alt="" draggable="false">${locked ? '<span class="lock">🔒</span>' : ''}</span>
          <b>${a.name}</b><small>${locked ? `${master.done}/${master.total} topics ★` : a.element}</small>
        </button>`; }).join('')}
    </div>
    <label class="name-row"><span>Your name</span><input id="name" maxlength="14" autocomplete="off" placeholder="Ninja" value="${esc(d.name)}"></label>
    <button id="go" class="btn primary big" ${d.avatar ? '' : 'disabled'}>Let's go! ⚔️</button>
  </section>`, 'bg-sky');
  // if a tapped card sits under the sticky Let's go! button (last row: Bolt/Master), scroll it clear so it is never half-hidden — #51
  const revealCard = (b: HTMLElement) => {
    const go = $('#go') as HTMLElement | null;
    if (go && b.getBoundingClientRect().bottom > go.getBoundingClientRect().top) b.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };
  $$('.avatar-card').forEach(b => b.addEventListener('click', () => {
    if (b.classList.contains('locked')) { sfx.wrong(); say(SENSEI_LINES.locked); b.classList.remove('shake'); void b.offsetWidth; b.classList.add('shake'); revealCard(b as HTMLElement); return; }
    $$('.avatar-card').forEach(x => x.classList.remove('sel')); b.classList.add('sel');
    const a = ALL_AVATARS.find(x => x.id === b.dataset.id)!;
    save({ avatar: a.id }); sfx.tap(); say(`${a.name}, the ${a.element}!`);
    ($('#go') as HTMLButtonElement).disabled = false;
    revealCard(b as HTMLElement);
  }));
  $('#go').addEventListener('click', () => { save({ name: ($('#name') as HTMLInputElement).value.trim() }); sfx.correct(); go('home'); });
}
