import { AVATARS } from '../avatars';
import { load, save } from '../storage';
import { sfx, say } from '../audio';
import { $, $$, esc, render } from './dom';

export function avatarScreen(go: (s: 'home') => void) {
  const d = load();
  render(`
  <section class="screen avatar-screen">
    <header class="brand"><span class="kanji">忍</span><h1>Sky Ninja<br><span>Academy</span></h1><p class="tag">Choose your ninja</p></header>
    <div class="avatar-grid" role="list">
      ${AVATARS.map(a => `
        <button class="avatar-card${d.avatar === a.id ? ' sel' : ''}" data-id="${a.id}" style="--glow:${a.glow}" role="listitem" aria-label="${a.name}, ${a.element}">
          <span class="figure"><img src="${a.img}" alt="" draggable="false"></span>
          <b>${a.name}</b><small>${a.element}</small>
        </button>`).join('')}
    </div>
    <label class="name-row"><span>Your name</span><input id="name" maxlength="14" autocomplete="off" placeholder="Ninja" value="${esc(d.name)}"></label>
    <button id="go" class="btn primary big" ${d.avatar ? '' : 'disabled'}>Let's go! ⚔️</button>
  </section>`, 'bg-sky');
  $$('.avatar-card').forEach(b => b.addEventListener('click', () => {
    $$('.avatar-card').forEach(x => x.classList.remove('sel')); b.classList.add('sel');
    const a = AVATARS.find(x => x.id === b.dataset.id)!;
    save({ avatar: a.id }); sfx.tap(); say(`${a.name}, the ${a.element}!`);
    ($('#go') as HTMLButtonElement).disabled = false;
  }));
  $('#go').addEventListener('click', () => { save({ name: ($('#name') as HTMLInputElement).value.trim() }); sfx.correct(); go('home'); });
}
