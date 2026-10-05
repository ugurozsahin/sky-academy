// #910: a topic chooser overlay, shared by whichever mode wants a "pick one topic, or Mixed" step before
// play — Ninja Sprint today; Ninja Duel (#957), Relaxed practice (#937), the Legend run (#932) and the
// drills (#915) are later tickets for the same module. No new CSS: a plain `.modal` (`pauseHTML`'s own
// shell, `src/styles/overlays.css`) holding the island's own `.topics`/`.topic` cards (`src/styles/home.css`)
// and a `.row` of buttons (`src/styles/shared.css`) — not `.modal.results`, which guard rail #35 keeps
// single-sourced in `screen.ts`; the surrounding `.overlay` already scrolls on its own if the list is long.
import { drillsFor, topicsFor, type Topic, type YearId, type YearInfo } from '../curriculum';
import { duelPool } from '../game/duel';
import { answerableBy } from '../game/pools';
import { trophyFor } from '../game/trophies';
import type { TopicProgress } from '../storage/shape';
import { $, $$ } from './dom';

export interface ChooserOpts {
  /** When true, "🎲 Mixed" is drawn first and calls `onPick(null)`. */
  mixed: boolean;
  /** The first card's label and icon; "🎲 Mixed" unless a mode says otherwise (Ninja Duel's is "🎲 Random", #957). */
  mixedLabel?: string;
  /** Text drawn after a topic's name (its trophy, #912); empty for none. */
  badge?: (t: Topic) => string;
}

/** Topics the chooser can offer — every topic a bubble pool can ask (#1065: no tracing, no keypad). Shared with the island's trophy count (#912) so the count and the list cannot drift. */
export const chooserEligible = (t: Topic): boolean => answerableBy(t, 'mixed');

/** What the chooser lists for a year's open subject: the regular topics, then that subject's drills (#915). Drills are never in the Mixed pool. */
export const chooserTopics = (year: YearId, subject: Topic['subject']): Topic[] => [...topicsFor(year, subject).filter(chooserEligible), ...drillsFor(year, subject)];

/** #957: what Ninja Duel's chooser lists — the open subject's chooser topics that `duelPool` keeps (no sequence or tracing topic, no drill), in the chooser's order. */
export const duelChooserTopics = (year: YearInfo, subject: Topic['subject']): Topic[] => {
  const playable = new Set(duelPool(topicsFor(year.id), year.diffs[0] ?? 1).map(t => t.id));
  return chooserTopics(year.id, subject).filter(t => playable.has(t.id));
};

/** Opens a topic chooser inside `overlay` (a hidden `.overlay` element already in the DOM, the pattern
 *  `src/ui/profiles.ts`'s `#profile-overlay` uses). Back, or picking a card, hides and empties it again. */
export function openChooser(overlay: HTMLElement, topics: Topic[], onPick: (topic: Topic | null) => void, opts: ChooserOpts): void {
  const mixedCard = opts.mixed ? `<button class="topic" data-mixed><span class="ic">🎲</span><b>${opts.mixedLabel ?? 'Mixed'}</b></button>` : '';
  const cards = topics.map(t => `<button class="topic" data-id="${t.id}"><span class="ic">${t.icon}</span><b>${t.title}</b>${opts.badge?.(t) ?? ''}</button>`).join('');
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

type Progress = Record<string, TopicProgress>;

/** A topic's trophy as a chooser badge — a leading space and the emoji, or '' below one correct answer (#912). */
export const trophyBadge = (year: YearInfo, progress: Progress) => (t: Topic): string => {
  const k = trophyFor(progress[t.id]?.sprint ?? 0, year);
  return k ? ` ${k}` : '';
};

/** The island header's ` · 🏆 n/m`: m counts the chooser's topics across both subject tabs, n those with a trophy (#912). */
export function trophyCount(year: YearInfo, progress: Progress): string {
  const all = topicsFor(year.id).filter(chooserEligible);
  return all.length ? ` · 🏆 ${all.filter(t => trophyBadge(year, progress)(t)).length}/${all.length}` : '';
}
