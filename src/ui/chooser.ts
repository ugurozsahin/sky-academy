// #910: a topic chooser overlay, shared by whichever mode wants a "pick one topic, or Mixed" step before
// play — Ninja Sprint today; Ninja Duel (#957), Relaxed practice (#937), the Legend run (#932) and the
// drills (#915) are later tickets for the same module. No new CSS: a plain `.modal` (`pauseHTML`'s own
// shell, `src/styles/overlays.css`) holding the island's own `.topics`/`.topic` cards (`src/styles/home.css`)
// and a `.row` of buttons (`src/styles/shared.css`) — not `.modal.results`, which guard rail #35 keeps
// single-sourced in `screen.ts`; the surrounding `.overlay` already scrolls on its own if the list is long.
import type { Topic } from '../curriculum';
import { $, $$ } from './dom';

export interface ChooserOpts {
  /** When true, "🎲 Mixed" is drawn first and calls `onPick(null)`. */
  mixed: boolean;
}

/** Opens a topic chooser inside `overlay` (a hidden `.overlay` element already in the DOM, the pattern
 *  `src/ui/profiles.ts`'s `#profile-overlay` uses). Back, or picking a card, hides and empties it again. */
export function openChooser(overlay: HTMLElement, topics: Topic[], onPick: (topic: Topic | null) => void, opts: ChooserOpts): void {
  const mixedCard = opts.mixed ? `<button class="topic" data-mixed><span class="ic">🎲</span><b>Mixed</b></button>` : '';
  const cards = topics.map(t => `<button class="topic" data-id="${t.id}"><span class="ic">${t.icon}</span><b>${t.title}</b></button>`).join('');
  overlay.hidden = false;
  overlay.innerHTML = `
    <div class="modal">
      <h2>Choose a topic</h2>
      <div class="topics">${mixedCard}${cards}</div>
      <div class="row"><button class="btn big" id="chooser-back">Back</button></div>
    </div>`;
  const close = () => { overlay.hidden = true; overlay.innerHTML = ''; };
  $$('.topic', overlay).forEach(b => b.addEventListener('click', () => {
    const picked = b.hasAttribute('data-mixed') ? null : topics.find(t => t.id === b.dataset.id) ?? null;
    close();
    onPick(picked);
  }));
  $('#chooser-back', overlay).addEventListener('click', close);
}
