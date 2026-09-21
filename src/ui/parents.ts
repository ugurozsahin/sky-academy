import { avatarOrNull } from '../avatars';
import { TOPICS, YEARS } from '../curriculum';
import { deleteProfile, exportSave, importSave, isReadOnlySave, isWriteFailing, load, NAME_MAX, profileCards, renameProfile, reset, save, STICKER_IDS, type DeleteRefusal, type ProfileCard, type ProfileId, type RenameRefusal, type SaveData } from '../storage';
import { sfx, voiceState } from '../audio';
import { gateChallenge, checkGate, parentSummary, pct, type ParentSummary, type TopicStat } from '../game/parents';
import { $, $$, esc, render } from './dom';

/** `launch` is where a grown-up lands after removing the ninja this session was playing (#20 slice 3): the
 *  boot decision, re-run — the picker while two or more profiles are left, otherwise that child's map, or
 *  onboarding when the remaining slot has never been played. It is `main.ts`'s one copy of that rule, not a
 *  second statement of it here. */
type Nav = { map: () => void; avatar: () => void; launch: () => void };
/** The word a grown-up must type to confirm "Start again" — deliberately not a single tap a child could land on. */
const RESET_WORD = 'RESET';

/**
 * Set from a confirmed-but-not-undone reset until the grown-ups screen is left, by whichever route. Module
 * level, not a local in `drawDash()`'s closure, because the hardware/browser back button never runs through
 * that closure's `#back` click handler — it goes straight to `popstate` in `main.ts` (#53), which has no other
 * way to know a reset just happened. Without this, the invariant "leaving this screen after a reset always
 * goes to onboarding, never to the map with an empty profile" held for the on-screen tap and not for the OS
 * back gesture — reviewed and caught on #274.
 */
let pendingReset = false;
export const isPendingReset = () => pendingReset;
export const clearPendingReset = () => { pendingReset = false; };

const showPct = (x: number | null) => (x === null ? '—' : `${pct(x)}%`);
const bar = (frac: number) => `<span class="isl-bar"><i style="width:${Math.round(100 * Math.max(0, Math.min(1, frac)))}%"></i></span>`;

function topicRow(s: TopicStat): string {
  return `<li class="p-topic"><span class="ic">${s.icon}</span><span class="p-topic-t"><b>${esc(s.title)}</b><small>${s.hits}/${s.tries} right · ${'★'.repeat(s.stars)}${'☆'.repeat(3 - s.stars)}</small></span><span class="p-acc">${showPct(s.accuracy)}</span></li>`;
}

/** One of #151's two distinguishable not-saving reasons, or null when saving is working normally. The wording
 *  differs because the remedy differs: a newer-device save needs the *other* device or an update; a browser
 *  that refuses to write needs private browsing turned off or storage space freed — neither fixes the other. */
function saveNote(): string | null {
  if (isReadOnlySave()) return "This device is showing a save from a newer version of the app, so today's play is not being kept here. Open the game on the other device to add to it, or update this app to bring that save back.";
  if (isWriteFailing()) return 'This device is not saving progress right now — coins, stars and certificates earned today may be lost when the game closes. Turning off private browsing, or freeing up storage space, usually fixes it.';
  return null;
}
/**
 * #20 slice 3 — the ninjas on this device, renamed and removed from behind the grown-ups gate.
 *
 * The owner's decision at the top of #20 is that "renaming and deleting sit behind the grown-ups gate", which
 * is this screen and this section. Adding a ninja stays where slice 2 put it, on the picker's ＋ card, because
 * that one is deliberately open to the child.
 *
 * Built from the dashboard's own `.p-*` classes and the `.btn`/`.btn.bad` pair the reset block already uses,
 * so nothing here is a new look (`design-language` §5): the rows are the shape `.p-topic` already is.
 */
/** Whether a row offers a rename — there is a save behind it to write a name into, and it is one this build
 *  can read. A slot in the index that nothing has ever played (＋ tapped and the app closed, or "Start again")
 *  has no name to change and `renameProfile` answers `'no-save'`; a slot holding a **newer build's** save has a
 *  name this build must not touch and it answers `'future'` (#420 review B2). The row says which, instead of
 *  offering a control that refuses. */
export const canRenameCard = (c: ProfileCard) => !c.future && (c.onboarded || !!c.avatar || !!c.name.trim());
/**
 * Whether a row offers "Remove" — every profile except the last one on the device, and except a slot holding a
 * save a newer build wrote (#420 review B2).
 *
 * Both exclusions are `deleteProfile`'s own refusals, mirrored here so a grown-up is never invited to tap a
 * button that answers no. The **guard** is in the store, not in this predicate: a rail on a withheld button
 * only pins the current screen, and "there is exactly one way to wipe this device" and "this build does not
 * destroy a newer build's save" are properties of the store.
 */
export const canRemoveCard = (c: ProfileCard, only: boolean) => !only && !c.future;
/** What the card is called when the child has not typed a name yet. The slot number is what tells two unnamed
 *  rows apart — the picker's `cardName` rule (#380 review B1), the same words for the same reason. */
const rowName = (c: ProfileCard, slot: number) => (c.name.trim() ? c.name : `Ninja ${slot}`);
/** The sentence for `'future'`, shared by both tables and by the row itself, because all three are saying the
 *  same thing about the same bytes — and it is `saveNote()`'s remedy, not `'store'`'s: the other device, or an
 *  update to this one (#420 review note 4). */
const FUTURE_SAY = 'That ninja’s game was saved by a newer version of the app, so this one cannot change it or clear it. Open the game on the other device, or update this app.';
/**
 * Every refusal `renameProfile` and `deleteProfile` can return, as the sentence a grown-up reads — a missing
 * case is otherwise a blank `role="status"` line.
 *
 * Keyed on `RenameRefusal`/`DeleteRefusal`, which are `Extract`ed from the result types rather than written out
 * again (#420 review note 3). A hand-copied key union made the comment above false: adding an arm errored only
 * at the `RENAME_HINTS[r.why]` *index* site, where a cast would have silenced it, and **removing** one was
 * caught nowhere at all, because the union was written out three times and one copy was checked.
 */
export const RENAME_HINTS: Record<RenameRefusal, string> = {
  unknown: 'That ninja is no longer on this device.',
  'no-save': 'That ninja has not played yet, so there is no name to change.',
  future: FUTURE_SAY,
  blank: 'A ninja needs a name — type one in first.',
  store: 'This browser will not let the game save, so the new name was not kept.',
};
export const DELETE_HINTS: Record<DeleteRefusal, string> = {
  unknown: 'That ninja is no longer on this device.',
  last: 'This is the only ninja on the device, so removing it is the same as starting again — use “Start again” below, which asks you to type RESET first.',
  future: FUTURE_SAY,
  store: 'This browser will not let the game save, so nothing was removed.',
};
function profileRow(c: ProfileCard, slot: number, only: boolean): string {
  const a = avatarOrNull(c.avatar);      // not `avatarById`: an unplayed slot is a state this list must draw (#380 review B1)
  const label = rowName(c, slot);
  return `
    <li class="p-prof" data-prof="${c.id}">
      <span class="p-prof-face"${a ? ` style="--glow:${a.glow}"` : ''}>${a ? `<img src="${a.img}" alt="" draggable="false">` : `<span class="plus" aria-hidden="true">＋</span>`}</span>
      <span class="p-prof-who"><b>${esc(label)}</b><small>${c.future ? 'Saved by a newer version' : a && c.onboarded ? esc(a.name) : 'Not started yet'}</small></span>
      ${canRenameCard(c)
        ? `<input class="p-prof-in" data-name="${c.id}" type="text" maxlength="${NAME_MAX}" autocomplete="off" value="${esc(c.name)}" aria-label="Name for ${esc(label)}">
           <button class="btn" data-rename="${c.id}">Save name</button>`
        // Two different reasons, never the same sentence (#420 review B2): the row used to say "has not
        // played" about a sibling's newer save — bytes it could not read and had no business claiming
        // anything about — and offered to destroy it.
        : `<span class="p-prof-wait">${c.future ? esc(FUTURE_SAY) : 'No name yet — this ninja has not played.'}</span>`}
      ${canRemoveCard(c, only) ? `<button class="btn bad" data-del="${c.id}">Remove</button>` : ''}
    </li>`;
}
function profilesHtml(cards: ProfileCard[]): string {
  const only = cards.length === 1;
  return `
    <h3 class="p-h">Ninjas on this device</h3>
    <div class="p-profs">
      <p class="p-profs-say">Each ninja has their own progress, coins and certificates. A new one is added by the child, from “Who is playing?” on the sky map.</p>
      <ul class="p-prof-list">${cards.map((c, i) => profileRow(c, i + 1, only)).join('')}</ul>
      <p class="p-prof-msg" id="prof-msg" role="status" hidden></p>
    </div>`;
}
/** The one question a removal asks. Deliberately a single named confirmation and not `RESET_WORD`'s typed
 *  word: that guard belongs to clearing the whole device, and `deleteProfile` refuses the last profile so this
 *  control can never be the cheaper route to the same end. */
function deleteConfirmHTML(name: string): string {
  return `
      <div class="modal reset-modal prof-modal">
        <h2>Remove ${esc(name)}?</h2>
        <p>This clears everything saved for ${esc(name)} on this device: progress, stars, coins, stickers, streak, name and ninja. It cannot be undone.</p>
        <div class="reset-actions">
          <button class="btn" id="prof-cancel">Cancel</button>
          <button class="btn bad" id="prof-go">Remove ${esc(name)}</button>
        </div>
      </div>`;
}
function dashHtml(sm: ParentSummary, noVoice = false, note = saveNote(), cards: ProfileCard[] = profileCards()): string {
  const modeRows = sm.modes.map(m => `
    <tr><th scope="row">${esc(m.title)}</th><td>${m.endless}</td><td>${m.sprint}</td><td>${m.boss}</td><td>${m.memory}</td><td>${m.training}</td></tr>`).join('');
  const yearCards = sm.years.map(y => `
    <div class="p-year">
      <div class="p-year-head"><b>${esc(y.title)}</b><small>${y.topicsTried}/${y.topicsTotal} topics tried</small></div>
      <div class="p-year-row"><span>★ ${y.stars}/${y.maxStars}</span>${bar(y.maxStars ? y.stars / y.maxStars : 0)}</div>
      <div class="p-year-row"><span>Accuracy ${showPct(y.accuracy)}</span>${bar(y.accuracy ?? 0)}</div>
    </div>`).join('');
  const weak = sm.weakest.length
    ? `<ul class="p-topics">${sm.weakest.map(topicRow).join('')}</ul>`
    : `<p class="p-empty">Not enough play yet to spot tricky topics — keep going!</p>`;
  const strong = sm.strongest.length
    ? `<ul class="p-topics">${sm.strongest.map(topicRow).join('')}</ul>`
    : '';
  return `
    <div class="p-stats">
      <div><b>${sm.totalAnswered}</b><small>questions answered</small></div>
      <div><b>${showPct(sm.overallAccuracy)}</b><small>overall accuracy</small></div>
      <div><b>★ ${sm.starsEarned}/${sm.starsMax}</b><small>stars earned</small></div>
      <div><b>${sm.topicsTried}/${sm.topicsTotal}</b><small>topics tried</small></div>
    </div>
    <div class="p-extra"><span>🔥 ${sm.streakDays}-day streak</span><span>🪙 ${sm.coins} coins</span><span>🏷️ ${sm.stickers}/${sm.stickersTotal} stickers</span></div>
    ${noVoice ? '<p class="p-note voice-note">This device has no speaking voice installed, so the game is showing the words instead. On Android: Settings → Accessibility → Text-to-speech.</p>' : ''}
    ${note ? `<p class="p-note save-note">${esc(note)}</p>` : ''}

    <h3 class="p-h">By island</h3>
    <div class="p-years">${yearCards}</div>

    <h3 class="p-h">Where to help ${sm.weakest.length ? '(trickiest topics)' : ''}</h3>
    ${weak}

    ${strong ? `<h3 class="p-h">Going well</h3>${strong}` : ''}

    <h3 class="p-h">Game modes — personal bests</h3>
    <div class="p-table-wrap"><table class="p-table">
      <thead><tr><th scope="col">Island</th><th scope="col" title="Sky Storm best score">Storm</th><th scope="col" title="Ninja Sprint best score">Sprint</th><th scope="col" title="Boss Battle knock-outs">Boss</th><th scope="col" title="Memory Match boards">Cards</th><th scope="col" title="Sensei training sessions">Sensei</th></tr></thead>
      <tbody>${modeRows}</tbody>
    </table></div>

    ${profilesHtml(cards)}

    <h3 class="p-h">Move to another device</h3>
    <div class="p-move">
      <p class="p-move-say">Reinstalling the app clears everything saved on this device. Copy this code first, then paste it into <b>Restore</b> on the other device (or on this one after reinstalling).</p>
      <textarea class="p-code" id="save-code" rows="3" readonly aria-label="Your save code"></textarea>
      <button class="btn" id="copy-code">Copy the code</button>
      <textarea class="p-code" id="restore-code" rows="3" placeholder="Paste a code here to restore" aria-label="Paste a save code to restore"></textarea>
      <button class="btn" id="restore-go">Restore</button>
      <p class="p-move-msg" id="move-msg" role="status" hidden></p>
    </div>

    <p class="p-note">Everything above is read from this device, and the code never leaves it — nothing is uploaded and there are no accounts. (Time-on-task isn't recorded yet.)</p>

    <div class="p-reset">
      <p class="p-reset-say">Handing the tablet to a different child, or want a fresh start? This clears everything on this device.</p>
      <button class="btn bad" id="start-again">Start again</button>
    </div>`;
}

/** The confirmation modal: a deliberate typed word, not a single tap, before anything is cleared. */
function resetConfirmHTML(): string {
  return `
      <div class="modal reset-modal">
        <h2>Start again?</h2>
        <p>This clears everything on this device: progress, stars, coins, stickers, streak, name and ninja. It cannot be undone once you leave this screen.</p>
        <label class="reset-label" for="reset-word">Type ${RESET_WORD} to confirm</label>
        <input id="reset-word" class="gate-input reset-input" type="text" autocomplete="off" autocapitalize="characters" aria-label="Type ${RESET_WORD} to confirm">
        <div class="reset-actions">
          <button class="btn" id="reset-cancel">Cancel</button>
          <button class="btn bad" id="reset-go" disabled>Start again</button>
        </div>
      </div>`;
}

/** Shown for as long as the grown-up stays on this screen after resetting — the one chance to undo. */
function resetDoneHTML(): string {
  return `
      <div class="modal reset-modal">
        <h2>All cleared</h2>
        <p>This device is back to a fresh start. You can undo this until you leave this screen — after that it is gone.</p>
        <div class="reset-actions">
          <button class="btn" id="reset-undo">Undo</button>
          <button class="btn primary" id="reset-continue">Continue</button>
        </div>
      </div>`;
}

/**
 * "Move to another device" (#64): show the save code, copy it, and restore one.
 *
 * Restoring replaces everything on the device, so it takes two taps — the first only warns. `redraw` re-runs
 * the dashboard once a restore lands, because every number on the screen came from the save that was just
 * replaced. The clipboard write can be refused (an insecure origin, a browser that withholds it), and that is
 * not a failure worth a scary message: the text is selected instead so the grown-up can copy it by hand.
 */
function wireMove(redraw: () => void) {
  const code = $<HTMLTextAreaElement>('#save-code');
  const paste = $<HTMLTextAreaElement>('#restore-code');
  const msg = $('#move-msg');
  code.value = exportSave();

  const say = (text: string, bad = false) => {
    msg.textContent = text;
    msg.classList.toggle('bad', bad);
    msg.hidden = false;
  };

  const byHand = 'Select the code above and copy it by hand — this browser will not do it for us.';
  $('#copy-code').addEventListener('click', () => {
    sfx.tap();
    code.select();
    const written = navigator.clipboard?.writeText(code.value);
    if (!written) { say(byHand); return; }
    written.then(() => say('Copied. Paste it into Restore on the other device.')).catch(() => say(byHand));
  });

  let armed = false;
  $('#restore-go').addEventListener('click', () => {
    sfx.tap();
    if (!paste.value.trim()) { armed = false; say('Paste a code into the box above first.', true); return; }
    if (!armed) { armed = true; say('This replaces all the progress on this device. Tap Restore again to go ahead.', true); return; }
    armed = false;
    if (!importSave(paste.value.trim())) { say('That code is not a Sky Ninja Academy save.', true); return; }
    sfx.correct();
    redraw();
    // `msg` belongs to the dashboard that redraw() just threw away, so the confirmation goes on the new one.
    const fresh = $('#move-msg');
    fresh.textContent = 'Restored — the progress below came from that code.';
    fresh.classList.remove('bad');
    fresh.hidden = false;
  });
}

/** For grown-ups: a quick maths gate, then a read-only progress dashboard. */
export function parentsScreen(nav: Nav) {
  let gate = gateChallenge(Math.random);

  const drawGate = (wrong = false) => {
    render(`
    <section class="screen home parents">
      <div class="isl-head"><button class="icon-btn" id="back" aria-label="Back">←</button><div><b>For grown-ups</b><small>A quick check to keep this out of little hands</small></div></div>
      <div class="gate">
        <p class="gate-q">What is <b id="gate-q">${esc(gate.prompt)}</b>?</p>
        <input id="gate-input" class="gate-input" type="number" inputmode="numeric" autocomplete="off" aria-label="Answer" value="">
        <button class="btn" id="gate-go">Enter</button>
        <p class="gate-msg" id="gate-msg"${wrong ? '' : ' hidden'}>Not quite — this bit is for a grown-up.</p>
      </div>
    </section>`, 'bg-sky');
    $('#back').addEventListener('click', () => { sfx.tap(); nav.map(); });
    const input = $<HTMLInputElement>('#gate-input');
    const submit = () => {
      if (checkGate(input.value, gate.answer)) { sfx.correct(); drawDash(); }
      else { sfx.wrong(); gate = gateChallenge(Math.random); drawGate(true); }
    };
    $('#gate-go').addEventListener('click', submit);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
    input.focus();
  };

  const drawDash = () => {
    let snapshot: SaveData | null = null;

    const sm = parentSummary(load(), TOPICS, YEARS, STICKER_IDS.length);
    render(`
    <section class="screen home parents dash">
      <div class="isl-head"><button class="icon-btn" id="back" aria-label="Back">←</button><div><b>Grown-ups dashboard</b><small>How ${esc(load().name || 'your ninja')} is getting on</small></div></div>
      <div class="parents-dash">${dashHtml(sm, voiceState() === 'no')}</div>
      <div class="overlay" id="reset-overlay" hidden></div>
    </section>`, 'bg-sky');
    // Once a reset has happened, leaving this screen — by "Continue", the back arrow, or the hardware/browser
    // back button (main.ts's popstate handler reads `isPendingReset()` directly) — must land on onboarding,
    // never on the map with an empty profile (#115). "Undo" is the only way out of that state.
    $('#back').addEventListener('click', () => { sfx.tap(); if (isPendingReset()) { clearPendingReset(); nav.avatar(); } else nav.map(); });
    wireMove(() => drawDash());

    const overlay = $('#reset-overlay');
    const closeOverlay = () => { overlay.hidden = true; overlay.innerHTML = ''; };

    // #20 slice 3. Both controls redraw rather than patching the row: every number above came from the save
    // that was just renamed or removed, which is the same reason `wireMove`'s restore redraws.
    const profMsg = (text: string, bad = false) => {
      const el = $('#prof-msg');
      el.textContent = text; el.classList.toggle('bad', bad); el.hidden = false;
    };
    $$('button[data-rename]').forEach(b => b.addEventListener('click', () => {
      sfx.tap();
      const id = b.dataset.rename as ProfileId;
      const input = $<HTMLInputElement>(`input[data-name="${id}"]`);
      const r = renameProfile(id, input.value);
      if (!r.ok) { sfx.wrong(); profMsg(RENAME_HINTS[r.why], true); return; }
      sfx.correct();
      // The stored name, not what was typed: `renameProfile` trims and truncates, and the row has to redraw
      // with what the store is actually holding.
      const done = `Renamed to ${r.name}.`;
      drawDash();
      profMsg(done);
    }));
    $$('button[data-del]').forEach(b => b.addEventListener('click', () => {
      sfx.tap();
      const id = b.dataset.del as ProfileId;
      const row = profileCards().find(c => c.id === id);
      const name = row ? rowName(row, profileCards().findIndex(c => c.id === id) + 1) : 'this ninja';
      overlay.hidden = false;
      overlay.innerHTML = deleteConfirmHTML(name);
      $('#prof-cancel').addEventListener('click', () => { sfx.tap(); closeOverlay(); });
      $('#prof-go').addEventListener('click', () => {
        sfx.tap();
        const r = deleteProfile(id);
        closeOverlay();
        if (!r.ok) { sfx.wrong(); profMsg(DELETE_HINTS[r.why], true); return; }
        sfx.correct();
        // The save this whole screen is drawn from has just gone, so there is nothing to redraw: `launch` puts
        // the device back where boot would, which is the picker while siblings remain (#20 slice 3).
        if (r.self) { nav.launch(); return; }
        drawDash();
        profMsg(`${name} was removed from this device.`);
      });
    }));

    $('#start-again').addEventListener('click', () => {
      sfx.tap();
      overlay.hidden = false;
      overlay.innerHTML = resetConfirmHTML();
      const input = $<HTMLInputElement>('#reset-word');
      const go = $<HTMLButtonElement>('#reset-go');
      const update = () => { go.disabled = input.value.trim() !== RESET_WORD; };
      input.addEventListener('input', update);
      input.addEventListener('keydown', e => { if (e.key === 'Enter' && !go.disabled) go.click(); });
      $('#reset-cancel').addEventListener('click', () => { sfx.tap(); closeOverlay(); });
      go.addEventListener('click', () => {
        sfx.tap();
        snapshot = load();       // kept in memory only — the "Undo" affordance below is what can bring it back
        reset();
        pendingReset = true;
        overlay.innerHTML = resetDoneHTML();
        $('#reset-undo').addEventListener('click', () => {
          sfx.tap();
          if (snapshot) save(snapshot);   // save() replaces every key, so this restores the snapshot exactly
          clearPendingReset();
          closeOverlay();
          drawDash();
        });
        $('#reset-continue').addEventListener('click', () => { sfx.tap(); clearPendingReset(); nav.avatar(); });
      });
      input.focus();
    });
  };

  drawGate();
}
