import { ALL_AVATARS, MASTER, SENSEI_LINES } from '../avatars';
import { TOPICS } from '../curriculum';
import { masterProgress } from '../game/sensei';
import { load, save } from '../storage';
import { sfx, say } from '../audio';
import { $, $$, esc, render } from './dom';

/** A name with something in it. The trim is the point: a space-bar name used to sail through (#110). */
export const hasName = (name: string) => name.trim().length >= 1;

/**
 * Both halves of #110 in one place, so the rule can be tested without a browser: `Let's go!` needs an
 * avatar *and* a name. Everything downstream used to fall back to the literal "Ninja" when it got neither —
 * the home hero, the play HUD, the grown-ups dashboard, and the certificate the child is handed at the end.
 */
export const canStart = (avatar: string | null | undefined, name: string) => !!avatar && hasName(name);

/** Friendly, not an error: the tone of the sensei lines, never red text at a five-year-old (#110). */
const NAME_HINT = 'Pop your name in and we will cheer you on! ✍️';

export function avatarScreen(go: (s: 'home') => void) {
  const d = load();
  const master = masterProgress(TOPICS, d.progress);   // the 11th ninja unlocks when every topic has a star
  render(`
  <section class="screen avatar-screen">
    <header class="brand"><span class="kanji">忍</span><h1>Sky Ninja<br><span>Academy</span></h1><p class="tag">Choose your ninja</p></header>
    <label class="name-row"><span>Your name</span><input id="name" maxlength="14" autocomplete="off" aria-describedby="name-hint" placeholder="Ninja" value="${esc(d.name)}"></label>
    <p class="name-hint" id="name-hint" aria-live="polite">${hasName(d.name) ? '' : NAME_HINT}</p>
    <div class="avatar-grid" role="list">
      ${ALL_AVATARS.map(a => { const locked = a.id === MASTER.id && !master.unlocked && d.avatar !== MASTER.id; /* an earned Master is never taken away */ return `
        <button class="avatar-card${d.avatar === a.id ? ' sel' : ''}${locked ? ' locked' : ''}" data-id="${a.id}" style="--glow:${a.glow}" role="listitem" aria-label="${a.name}, ${a.element}${locked ? `, locked: ${master.done} of ${master.total} topics starred` : ''}" ${locked ? 'aria-disabled="true"' : ''}>
          <span class="figure"><img src="${a.img}" alt="" draggable="false">${locked ? '<span class="lock">🔒</span>' : ''}</span>
          <b>${a.name}</b><small>${locked ? `${master.done}/${master.total} topics ★` : a.element}</small>
        </button>`; }).join('')}
    </div>
    <button id="go" class="btn primary big" ${canStart(d.avatar, d.name) ? '' : 'disabled'}>Let's go! ⚔️</button>
  </section>`, 'bg-sky');
  // #110: the button follows both fields, so it cannot be reached with either one missing. `sel` is the
  // selection the screen actually shows, which is also what a returning player arrives with pre-set.
  const nameEl = $('#name') as HTMLInputElement, goBtn = $('#go') as HTMLButtonElement, hint = $('#name-hint');
  const sync = () => {
    goBtn.disabled = !canStart($('.avatar-card.sel')?.dataset.id, nameEl.value);
    hint.textContent = hasName(nameEl.value) ? '' : NAME_HINT;
  };
  nameEl.addEventListener('input', sync);
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
    sync();
    revealCard(b as HTMLElement);
  }));
  $('#go').addEventListener('click', () => { save({ name: ($('#name') as HTMLInputElement).value.trim() }); sfx.correct(); go('home'); });
}
