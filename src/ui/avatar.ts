import { ALL_AVATARS, avatarById, MASTER, SENSEI_LINES, welcomeLine } from '../avatars';
import { TOPICS } from '../curriculum';
import { masterProgress } from '../game/sensei';
import { cleanName, load, NAME_MAX, safeRecord, save, type TopicProgress } from '../storage';
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

/**
 * First-run wizard progress (#67 acceptance: "progress is obvious to a child"). The dots are decorative
 * (`aria-hidden`); the step count lives once, in the `aria-label`, so a screen reader says it plainly instead
 * of counting spans.
 */
export function wizardProgress(step: number, total: number) {
  const dots = Array.from({ length: total }, (_, i) =>
    `<span class="dot${i + 1 === step ? ' active' : ''}" aria-hidden="true"></span>`).join('');
  return `<p class="wizard-progress" aria-label="Step ${step} of ${total}">${dots}</p>`;
}

/**
 * First-run wizard, step 1 (#67): the ninja pick, on its own screen so it fits one viewport without
 * competing with the name field for space. Continue needs only an avatar — the name is step 2's job.
 */
export function chooseNinjaScreen(go: () => void) {
  const d = load();
  const master = masterProgress(TOPICS, safeRecord<TopicProgress>(d.progress));   // #95: tolerant of a hand-edited/corrupted save; the 11th ninja unlocks when every topic has a star
  render(`
  <section class="screen avatar-screen choose-ninja-screen">
    <header class="brand"><span class="kanji">忍</span><h1>Sky Ninja<br><span>Academy</span></h1><p class="tag">Choose your ninja</p></header>
    ${wizardProgress(1, 3)}
    <div class="avatar-grid" role="list">
      ${ALL_AVATARS.map(a => { const locked = a.id === MASTER.id && !master.unlocked && d.avatar !== MASTER.id; /* an earned Master is never taken away */ return `
        <button class="avatar-card${d.avatar === a.id ? ' sel' : ''}${locked ? ' locked' : ''}" data-id="${a.id}" style="--glow:${a.glow}" role="listitem" aria-label="${a.name}, ${a.element}${locked ? `, locked: ${master.done} of ${master.total} topics starred` : ''}" ${locked ? 'aria-disabled="true"' : ''}>
          <span class="figure"><img src="${a.img}" alt="" draggable="false">${locked ? '<span class="lock">🔒</span>' : ''}</span>
          <b>${a.name}</b><small>${locked ? `${master.done}/${master.total} topics ★` : a.element}</small>
        </button>`; }).join('')}
    </div>
    <button id="next" class="btn primary big" ${d.avatar ? '' : 'disabled'}>Continue ➡️</button>
  </section>`, 'bg-sky');
  const nextBtn = $('#next') as HTMLButtonElement;
  // if a tapped card sits under the sticky Continue button (last row: Bolt/Master), scroll it clear so it is never half-hidden — #51
  const revealCard = (b: HTMLElement) => {
    const next = $('#next') as HTMLElement | null;
    if (next && b.getBoundingClientRect().bottom > next.getBoundingClientRect().top) b.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };
  $$('.avatar-card').forEach(b => b.addEventListener('click', () => {
    if (b.classList.contains('locked')) { sfx.wrong(); say(SENSEI_LINES.locked); b.classList.remove('shake'); void b.offsetWidth; b.classList.add('shake'); revealCard(b as HTMLElement); return; }
    $$('.avatar-card').forEach(x => x.classList.remove('sel')); b.classList.add('sel');
    const a = ALL_AVATARS.find(x => x.id === b.dataset.id)!;
    save({ avatar: a.id }); sfx.tap(); say(`${a.name}, the ${a.element}!`);
    nextBtn.disabled = false;
    revealCard(b as HTMLElement);
  }));
  $('#next').addEventListener('click', () => go());
}

/**
 * First-run wizard, step 2 (#67): the name field, alone on its own screen — nothing else on it to bury it
 * under or to scroll past, which is the stronger version of the #110 fix now that the two are split. The
 * chosen ninja from step 1 is shown alongside it so the choice still reads as one flow.
 */
export function nameScreen(go: () => void) {
  const d = load();
  const avatar = avatarById(d.avatar);
  render(`
  <section class="screen avatar-screen name-screen">
    <header class="brand"><span class="kanji">忍</span><h1>Sky Ninja<br><span>Academy</span></h1><p class="tag" id="name-heading" tabindex="-1">What's your name?</p></header>
    ${wizardProgress(2, 3)}
    <div class="name-preview" style="--glow:${avatar.glow}"><span class="figure"><img src="${avatar.img}" alt=""></span><b>${esc(avatar.name)}</b></div>
    <label class="name-row"><span>Your name</span><input id="name" maxlength="${NAME_MAX}" autocomplete="off" aria-describedby="name-hint" placeholder="Ninja" value="${esc(d.name)}"></label>
    <p class="name-hint" id="name-hint" aria-live="polite">${hasName(d.name) ? '' : NAME_HINT}</p>
    <button id="go" class="btn primary big" ${canStart(d.avatar, d.name) ? '' : 'disabled'}>Let's go! ⚔️</button>
  </section>`, 'bg-sky');
  // #110: the button follows both fields, so it cannot be reached with either one missing — the avatar is
  // already fixed by the time this screen renders, so only the name re-checks live.
  const nameEl = $('#name') as HTMLInputElement, goBtn = $('#go') as HTMLButtonElement, hint = $('#name-hint');
  const sync = () => {
    goBtn.disabled = !canStart(d.avatar, nameEl.value);
    hint.textContent = hasName(nameEl.value) ? '' : NAME_HINT;
  };
  nameEl.addEventListener('input', sync);
  ($('#name-heading') as HTMLElement).focus();   // focus moves to the new step (#67 a11y)
  // #424: `maxlength` is a browser courtesy a paste or an autofill walks past — `cleanName` is the bound
  // that actually reaches the store, the same one `renameProfile` and Restore apply.
  $('#go').addEventListener('click', () => { save({ name: cleanName(nameEl.value) }); sfx.correct(); go(); });
}

/**
 * Returning-player re-entry (#67): change ninja only, never asks for the name again — a returning child is
 * not marched through it a second time. `#change-av` on the home screen (`src/ui/home.ts`) calls this once
 * the first-run wizard is complete; `chooseNinjaScreen` above stays the unchanged first-run step.
 *
 * Deliberately a near-duplicate of the grid markup in `chooseNinjaScreen` rather than a shared helper: the
 * guard rail in `tests/unit/guardrails.test.ts` (#110) holds that screen's markup byte-for-byte, and this
 * screen never renders a name field at all — indirecting the grid through a shared function would move that
 * text without changing what either rail guarantees, which is exactly the kind of drift the rail exists to
 * catch. A dozen duplicated lines is the safer trade.
 */
export function changeAvatarScreen(go: () => void) {
  const d = load();
  const master = masterProgress(TOPICS, safeRecord<TopicProgress>(d.progress));
  render(`
  <section class="screen avatar-screen change-avatar">
    <header class="brand"><span class="kanji">忍</span><h1>Sky Ninja<br><span>Academy</span></h1><p class="tag">Choose your ninja</p></header>
    <div class="avatar-grid" role="list">
      ${ALL_AVATARS.map(a => { const locked = a.id === MASTER.id && !master.unlocked && d.avatar !== MASTER.id; return `
        <button class="avatar-card${d.avatar === a.id ? ' sel' : ''}${locked ? ' locked' : ''}" data-id="${a.id}" style="--glow:${a.glow}" role="listitem" aria-label="${a.name}, ${a.element}${locked ? `, locked: ${master.done} of ${master.total} topics starred` : ''}" ${locked ? 'aria-disabled="true"' : ''}>
          <span class="figure"><img src="${a.img}" alt="" draggable="false">${locked ? '<span class="lock">🔒</span>' : ''}</span>
          <b>${a.name}</b><small>${locked ? `${master.done}/${master.total} topics ★` : a.element}</small>
        </button>`; }).join('')}
    </div>
    <button id="change-save" class="btn primary big">Done ✅</button>
  </section>`, 'bg-sky');
  $$('.avatar-card').forEach(b => b.addEventListener('click', () => {
    if (b.classList.contains('locked')) { sfx.wrong(); say(SENSEI_LINES.locked); b.classList.remove('shake'); void b.offsetWidth; b.classList.add('shake'); return; }
    $$('.avatar-card').forEach(x => x.classList.remove('sel')); b.classList.add('sel');
    const a = ALL_AVATARS.find(x => x.id === b.dataset.id)!;
    save({ avatar: a.id }); sfx.tap(); say(`${a.name}, the ${a.element}!`);
  }));
  $('#change-save').addEventListener('click', () => { sfx.correct(); go(); });
}

/**
 * The wizard's introduction step (#67): Sensei greets the child by name and says what to do, once, before the
 * sky map — first-run only, and never shown again once `finish()` has run (`main.ts` sets `onboarded`).
 * Skippable: both buttons call the same `finish`, so tapping past the words loses nothing. Read aloud follows
 * the existing `say()`/speech-toggle behaviour, and the words are on screen either way — #65's no-speech
 * fallback needs nothing extra here.
 */
export function introScreen(finish: () => void) {
  const d = load();
  const avatar = avatarById(d.avatar);
  const line = welcomeLine(d.name);
  render(`
  <section class="screen avatar-screen intro-screen">
    <div class="intro-card" style="--glow:${avatar.glow}">
      ${wizardProgress(3, 3)}
      <span class="figure"><img src="${avatar.img}" alt=""></span>
      <h1 id="intro-heading" tabindex="-1">Hello, ${esc(d.name || 'Ninja')}!</h1>
      <p class="intro-text">${esc(line)}</p>
      <div class="intro-actions">
        <button id="intro-skip" class="btn big">Skip</button>
        <button id="intro-go" class="btn primary big">Let's go! ⚔️</button>
      </div>
    </div>
  </section>`, 'bg-sky');
  ($('#intro-heading') as HTMLElement).focus();
  say(line);
  $('#intro-skip').addEventListener('click', () => { sfx.tap(); finish(); });
  $('#intro-go').addEventListener('click', () => { sfx.correct(); finish(); });
}
