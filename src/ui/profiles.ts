import { avatarOrNull } from '../avatars';
import { addProfile, MAX_PROFILES, profileCards, setActiveProfile, type AddProfileResult, type ProfileId, type SetActiveResult } from '../storage';
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

/**
 * A child with no name yet — a slot added but not onboarded — is still a card they can tap, so it needs
 * words of its own. **Not the ＋ card's words** (#380 review B1): "New ninja" labelled both, while tapping
 * them does two different things — one opens an existing slot, the other creates a slot that nothing can
 * delete until slice 3. The slot number is what actually distinguishes two empty cards from each other.
 */
const cardName = (name: string, slot: number) => (name.trim() ? name : `Ninja ${slot}`);

/** What the hint line says when the store refuses. Two sentences, not one: only one of them is the family's
 *  doing (#335 item 2), and a child cannot act on the other. */
const FULL_HINT = `Four ninjas is the most one device can hold. 🥷`;
const STORE_HINT = `This browser will not let the game save, so a new ninja cannot be added. 😕`;
const SWITCH_STORE_HINT = `This browser will not let the game save, so it cannot swap ninja. 😕`;
/** `pickOutcome`'s own stale-card refusal (#401 item 5) — a second tab moved or deleted this slot between the
 *  picker drawing the card and the tap landing on it. Not the browser's fault, so not `SWITCH_STORE_HINT`'s
 *  sentence: nothing a family does fixes a store that will not save, but this clears on its own once the
 *  picker redraws. */
const SWITCH_UNKNOWN_HINT = `That ninja is not on this device any more. 🥷`;
/**
 * The one question a tap on a `corrupt` card asks before it switches (#681). `setActiveProfile` does not
 * refuse a corrupt slot — the bytes are writable, just unreadable — so without this a tap silently starts a
 * fresh game over them, and the very next ordinary `save()` (no special action, just play) overwrites the
 * corrupt blob for good. `future` gets no such gate: that slot's `readOnly` latch (`storage.ts`) already keeps
 * `save()` from writing back, so nothing is lost by switching onto it without asking.
 */
function corruptConfirmHTML(name: string): string {
  return `
      <div class="modal reset-modal prof-modal">
        <h2>Play as ${esc(name)}?</h2>
        <p>This device cannot read the game saved here, so there is no way to know what is on it. Playing now starts fresh, and the next save replaces it for good.</p>
        <div class="reset-actions">
          <button class="btn" id="corrupt-cancel">Cancel</button>
          <button class="btn bad" id="corrupt-go">Play anyway</button>
        </div>
      </div>`;
}
/** `addProfile`'s own refusal union, read off it rather than written out a second time (#401 item 1). */
type AddRefusal = Extract<AddProfileResult, { ok: false }>['why'];
/** A `Record` rather than `addOutcome`'s old ternary (#401 item 2): `AddProfileResult['why']` gaining a third
 *  reason makes this a `tsc` error at the one place that words a refusal, instead of the ternary's silent
 *  `STORE_HINT` fallback for whatever the new reason was. That guarantee holds only while `why` stays a
 *  finite string-literal union, as it is today — widen it to plain `string` and `Record<AddRefusal, string>`
 *  stops requiring any particular keys at all (PR #590 review round 1, non-blocking). */
const ADD_HINTS: Record<AddRefusal, string> = { full: FULL_HINT, store: STORE_HINT };
/** `setActiveProfile`'s refusal union, the same shape as `ADD_HINTS` for the same reason (#401 item 5). */
type SwitchRefusal = Extract<SetActiveResult, { ok: false }>['why'];
const SWITCH_HINTS: Record<SwitchRefusal, string> = { unknown: SWITCH_UNKNOWN_HINT, store: SWITCH_STORE_HINT };

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
/**
 * Takes the committer, not its answer (#401 item 3): the old `(id, switched: boolean)` let
 * `pickOutcome(idA, setActiveProfile(idB))` type-check, since the id moved to and the id the store actually
 * saw were two independent parameters agreeing only by whoever wrote the call site. The call site's laziest
 * form is now also the correct one — `pickOutcome(id, setActiveProfile)` cannot express the mismatch any
 * more — though a caller determined to disagree still can, through a closure (`pickOutcome(idA, () =>
 * setActiveProfile(idB))` still compiles): the type does not rule that out, it just stops being the shortest
 * way to write the bug (PR #590 review round 1, non-blocking).
 *
 * The two refusals `setActiveProfile` can give are told apart here (#401 item 5), the same shape as
 * `addOutcome` below: a stale card and a store that will not save are different faults, and only one of them
 * is the family's to act on.
 */
export const pickOutcome = (id: ProfileId, switchTo: (id: ProfileId) => SetActiveResult): PickOutcome => {
  const r = switchTo(id);
  return r.ok ? { move: true, id } : { move: false, hint: SWITCH_HINTS[r.why] };
};

/**
 * The same for the "New ninja" card: `addProfile`'s two refusals become the two sentences the picker shows
 * (#335 item 2), and the new profile's id rides the accepted arm so onboarding cannot start on a refusal.
 */
export type AddOutcome = { add: true; id: ProfileId } | { add: false; hint: string };
export const addOutcome = (r: AddProfileResult): AddOutcome =>
  r.ok ? { add: true, id: r.id } : { add: false, hint: ADD_HINTS[r.why] };

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
      ${cards.map((c, i) => {
        // `avatarOrNull`, not `avatarById`: a slot with no ninja chosen is a state this screen must *draw*,
        // and the Volt fallback drew it as a sibling's face — same portrait, same glow, only the text under
        // it different, on the one screen a pre-reader picks by the picture (#380 review B1). A portrait-less
        // card borrows the ＋ card's dashed figure, which `.new-ninja` already builds for exactly this
        // meaning, and stays tappable: it leads to the wizard, which is where that child belongs.
        const a = c.state === 'save' ? avatarOrNull(c.avatar) : null, name = cardName(c.state === 'save' ? c.name : '', i + 1); return `
        <button class="avatar-card${a ? '' : ' new-ninja'}" data-profile="${c.id}"${a ? ` style="--glow:${a.glow}"` : ''} role="listitem" aria-label="Play as ${esc(name)}">
          <span class="figure">${a ? `<img src="${a.img}" alt="" draggable="false">` : `<span class="plus" aria-hidden="true">＋</span>`}</span>
          <b>${esc(name)}</b><small>${
            // `future`/`corrupt` used to fall through to "Not started yet" here — the same wrong-reason
            // conflation #420/#431 fixed on the grown-ups row, one screen over, just not on this one
            // (#431 review item 2). This screen has no rename/remove controls to withhold, only the label.
            c.state === 'future' ? 'Saved by a newer version' : c.state === 'corrupt' ? 'Cannot be read on this device' : a && c.state === 'save' && c.onboarded ? a.name : 'Not started yet'
          }</small>
        </button>`; }).join('')}
      ${room ? `
        <button class="avatar-card new-ninja" id="new-ninja" role="listitem" aria-label="Add a new ninja">
          <span class="figure"><span class="plus" aria-hidden="true">＋</span></span>
          <b>New ninja</b><small>Add a player</small>
        </button>` : ''}
    </div>
    <p class="name-hint" id="who-hint" aria-live="polite"></p>
    <div class="overlay" id="profile-overlay" hidden></div>
  </section>`, 'bg-sky');
  ($('#who-heading') as HTMLElement).focus();   // the launch screen announces itself, as the wizard steps do (#67 a11y)
  say('Who is playing?');
  const hint = $('#who-hint');
  // A refusal is read aloud as well as printed, the way a locked ninja is on the choice screen
  // (`avatar.ts`'s `SENSEI_LINES.locked`): these sentences are the only thing standing between a pre-reader
  // and a screen that looks broken, and `.claude/rules/style.md` is "read-aloud everywhere" (#380 review B6).
  const refuse = (text: string) => { sfx.wrong(); hint.textContent = text; say(text); };
  const overlay = $('#profile-overlay');
  const closeOverlay = () => { overlay.hidden = true; overlay.innerHTML = ''; };
  const commit = (c: { id: ProfileId }) => {
    const o = pickOutcome(c.id, setActiveProfile);
    if (!o.move) return refuse(o.hint);
    sfx.correct(); go(o.id);
  };
  // A lookup against `cards`, not `b.dataset.profile as ProfileId` (#401 item 1): `data-profile` stays on the
  // button for e2e's own selectors, but the id the handler acts on now comes off the matching `ProfileCard`
  // rather than the DOM string, the one unchecked widening into `ProfileId` in the codebase gone with it. By
  // value, not by NodeList position: a positional `cards[i]` would trade the cast for an equally unchecked
  // trust that `$$`'s order can never drift from `cards.map`'s, which a later reshuffle of the markup could
  // break with nothing to catch it — `.find` makes the pairing itself the thing checked, not assumed.
  $$('.avatar-card[data-profile]').forEach(b => b.addEventListener('click', () => {
    const c = cards.find(c => c.id === b.dataset.profile);
    if (!c) return;                 // cannot happen — every such button was drawn from `cards` above
    // A corrupt slot is writable, just unreadable, so switching onto it and playing loses whatever is there for
    // good the moment the next ordinary `save()` runs — unlike `future`, which `readOnly` protects (#681).
    if (c.state === 'corrupt') {
      overlay.hidden = false;
      overlay.innerHTML = corruptConfirmHTML(cardName('', cards.findIndex(x => x.id === c.id) + 1));
      $('#corrupt-cancel').addEventListener('click', () => { sfx.tap(); closeOverlay(); });
      $('#corrupt-go').addEventListener('click', () => { closeOverlay(); commit(c); });
      return;
    }
    commit(c);
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
