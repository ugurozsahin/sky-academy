import { avatarById } from '../avatars';
import { addProfile, MAX_PROFILES, profileCards, setActiveProfile, type ProfileId } from '../storage';
import { sfx, say } from '../audio';
import { $, $$, esc, render } from './dom';

/**
 * "Who is playing?" — the profile picker (#20 slice 2). Siblings share one device, and slice 1 gave each of
 * them their own save; this is the screen that lets a child reach theirs.
 *
 * **It is deliberately built out of the ninja-choice screen's classes** (`.avatar-screen`, `.avatar-grid`,
 * `.avatar-card`, `.name-hint`) rather than a new set of its own: the owner's decision was "a picker of big
 * avatar cards", which is the shape those classes already are, and reusing them is `design-language` §5. The
 * only new rule is the `+` face of the "New ninja" card, which has no portrait to show.
 *
 * Reached two ways: at launch when the device holds two or more profiles (`main.ts`), and from the 👥 button
 * on the sky map's topbar — which is the *only* route while there is just one profile, and so the only way a
 * second child ever gets added. Renaming and deleting are slice 3's, behind the grown-ups gate.
 */

/** A child with no name yet — a slot added but not onboarded — is still a card they can tap. */
const cardName = (name: string) => (name.trim() ? name : 'New ninja');

/** What the hint line says when the store refuses. Two sentences, not one: only one of them is the family's
 *  doing (#335 item 2), and a child cannot act on the other. */
const FULL_HINT = `Four ninjas is the most one device can hold. 🥷`;
const STORE_HINT = `This browser will not let the game save, so a new ninja cannot be added. 😕`;
const SWITCH_HINT = `This browser will not let the game save, so it cannot swap ninja. 😕`;

/**
 * Render the picker. `go` is called with the chosen profile once the store has actually accepted the switch —
 * never before, so a refused write leaves the child on the screen with a reason rather than in a sibling's
 * game. `onNew` is called after a profile has been added and made active, for the caller to run onboarding.
 */
export function profilesScreen(go: (id: ProfileId) => void, onNew: () => void) {
  const cards = profileCards();
  const room = cards.length < MAX_PROFILES;
  render(`
  <section class="screen avatar-screen profile-screen">
    <header class="brand"><span class="kanji">忍</span><h1>Sky Ninja<br><span>Academy</span></h1><p class="tag" id="who-heading" tabindex="-1">Who is playing?</p></header>
    <div class="avatar-grid" role="list">
      ${cards.map(c => { const a = avatarById(c.avatar); return `
        <button class="avatar-card" data-profile="${c.id}" style="--glow:${a.glow}" role="listitem" aria-label="Play as ${esc(cardName(c.name))}">
          <span class="figure"><img src="${a.img}" alt="" draggable="false"></span>
          <b>${esc(cardName(c.name))}</b><small>${c.onboarded ? a.name : 'Not started yet'}</small>
        </button>`; }).join('')}
      ${room ? `
        <button class="avatar-card new-ninja" id="new-ninja" role="listitem" aria-label="Add a new ninja">
          <span class="figure"><span class="plus" aria-hidden="true">＋</span></span>
          <b>New ninja</b><small>Add a player</small>
        </button>` : ''}
    </div>
    <p class="name-hint" id="who-hint" aria-live="polite"></p>
  </section>`, 'bg-sky');
  ($('#who-heading') as HTMLElement).focus();   // the launch screen announces itself, as the wizard steps do (#67 a11y)
  say('Who is playing?');
  const hint = $('#who-hint');
  $$('.avatar-card[data-profile]').forEach(b => b.addEventListener('click', () => {
    const id = b.dataset.profile as ProfileId;
    if (!setActiveProfile(id)) { sfx.wrong(); hint.textContent = SWITCH_HINT; return; }
    sfx.correct(); go(id);
  }));
  const newBtn = $('#new-ninja') as HTMLElement | null;
  newBtn?.addEventListener('click', () => {
    const r = addProfile();
    // 'full' is reachable here even with a "New ninja" card on screen: `addProfile` also refuses a slot that
    // holds a save the index does not list (#335 item 1), so the count that drew the card can be the more
    // optimistic of the two. Saying so is better than hiding the card on a count that is not the real test.
    if (!r.ok) { sfx.wrong(); hint.textContent = r.why === 'full' ? FULL_HINT : STORE_HINT; return; }
    sfx.correct(); onNew();
  });
}
