import { avatarById } from '../avatars';
import { addProfile, MAX_PROFILES, profileCards, setActiveProfile, type AddProfileResult, type ProfileId } from '../storage';
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
 * What a tap on a profile card comes to, as a value.
 *
 * Exported and pure on purpose. A rail reading the source can only see that the store check is *written
 * above* the move, never that the move waits for it: deleting the handler's one `return` left all 1427 tests
 * green while a refused switch dropped the child into their sibling's game anyway (#380 review B2). The union
 * is the other half of the fix — the `id` a caller needs in order to move a child exists only on the
 * `move: true` arm, so falling out of the refusal branch is a type error rather than a silent bug.
 */
export type PickOutcome = { move: true; id: ProfileId } | { move: false; hint: string };
export const pickOutcome = (id: ProfileId, switched: boolean): PickOutcome =>
  switched ? { move: true, id } : { move: false, hint: SWITCH_HINT };

/**
 * The same for the "New ninja" card: `addProfile`'s two refusals become the two sentences the picker shows
 * (#335 item 2), and the new profile's id rides the accepted arm so onboarding cannot start on a refusal.
 */
export type AddOutcome = { add: true; id: ProfileId } | { add: false; hint: string };
export const addOutcome = (r: AddProfileResult): AddOutcome =>
  r.ok ? { add: true, id: r.id } : { add: false, hint: r.why === 'full' ? FULL_HINT : STORE_HINT };

/**
 * Render the picker. `go` is called with the chosen profile once the store has actually accepted the switch —
 * never before, so a refused write leaves the child on the screen with a reason rather than in a sibling's
 * game. `onNew` is called with the added profile once it is active, for the caller to run onboarding.
 *
 * `onBack` is the way out when the picker was opened from the 👥 button rather than met at launch (#380
 * review B5). Without it the only exits were "commit to a child" and the ＋ card, which adds a profile for
 * good — there is no delete anywhere until slice 3 — so a child who tapped 👥 out of curiosity could put the
 * launch picker on every boot from then on with no way back. At launch it is left out: the picker is the root
 * screen there and back leaves the app, exactly as it does from the sky map.
 */
export function profilesScreen(go: (id: ProfileId) => void, onNew: (id: ProfileId) => void, onBack?: () => void) {
  const cards = profileCards();
  const room = cards.length < MAX_PROFILES;
  render(`
  <section class="screen avatar-screen profile-screen">
    ${onBack ? `<button class="icon-btn" id="back" aria-label="Back">←</button>` : ''}
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
  // A refusal is read aloud as well as printed, the way a locked ninja is on the choice screen
  // (`avatar.ts`'s `SENSEI_LINES.locked`): these sentences are the only thing standing between a pre-reader
  // and a screen that looks broken, and `.claude/rules/style.md` is "read-aloud everywhere" (#380 review B6).
  const refuse = (text: string) => { sfx.wrong(); hint.textContent = text; say(text); };
  $$('.avatar-card[data-profile]').forEach(b => b.addEventListener('click', () => {
    const id = b.dataset.profile as ProfileId;
    const o = pickOutcome(id, setActiveProfile(id));
    if (!o.move) return refuse(o.hint);
    sfx.correct(); go(o.id);
  }));
  const newBtn = $('#new-ninja') as HTMLElement | null;
  newBtn?.addEventListener('click', () => {
    // 'full' is reachable here even with a "New ninja" card on screen: `addProfile` also refuses a slot that
    // holds a save the index does not list (#335 item 1), so the count that drew the card can be the more
    // optimistic of the two. Saying so is better than hiding the card on a count that is not the real test.
    const o = addOutcome(addProfile());
    if (!o.add) return refuse(o.hint);
    sfx.correct(); onNew(o.id);
  });
  ($('#back') as HTMLElement | null)?.addEventListener('click', () => { sfx.tap(); onBack?.(); });
}
