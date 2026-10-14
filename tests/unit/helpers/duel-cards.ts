import { duelPool, seededRng } from '../../../src/game/duel';
import { topicsFor, YEARS, type Question, type Topic, type Visual } from '../../../src/curriculum';
import { renderVisual } from '../../../src/ui/visuals';

// The duel card catalogue (#1022): browser-free, shared by `tests/e2e/duel.spec.ts`'s layout sweeps and the
// unit rail in `tests/unit/duel-cards.test.ts`.
/**
 * Every visual a duel can actually put on the card, rendered by the app's OWN `renderVisual()` over the real
 * `duelPool(topicsFor(year), year.diffs[0])` for all three years — not hand-written markup.
 *
 * Hand-written fixtures are how this rail kept missing things. They covered six of the thirteen reachable
 * visual kinds, and one of the missing ones was `chart` — at `diffs[0]` that is the TALLY card from `y2-stats`,
 * and only that: block and pictogram never appear at this difficulty (0 of 40 draws per topic). The pool's
 * tallest card is `symmetry` at 165.6px at 844x390, not `chart` at 90.5-100.9px — an earlier version of this
 * comment claimed both, on no measurement. Two of the fixtures were not even the shape
 * `renderVisual` emits. Deriving them means the catalogue cannot drift from the app again: a new visual type
 * appears here the moment a generator can draw it.
 *
 * `diffs[0]` is deliberate and is the whole reachable set: `duelScreen` fixes a match at the year's gentlest
 * stage and `Duel` passes that one value to every round, so cards needing difficulty 2 or 3 — a 16- or
 * 20-object counting frame among them — cannot appear in a duel however the match runs.
 *
 * Seeded, so the catalogue is identical on every run and in both projects.
 */
/**
 * Every card a duel can actually deal: the app's own `renderVisual()` output paired with the SAME question's
 * own prompt and hint, over the real `duelPool(topicsFor(year), year.diffs[0])` for all three years.
 *
 * Real triples, not a cross product. Pairing the pool's longest prompt with another topic's longest hint and a
 * third's tallest picture builds a card no child can be dealt, and a bound measured against it is a bound
 * about nothing — it read 180px here for a `scales` card whose real text is short. What a rail should hold is
 * what the generators can actually produce together.
 *
 * Derived rather than hand-written because hand-written is how this kept missing things: the previous
 * catalogue covered six of the thirteen reachable kinds and omitted `chart` — the tally, block and pictogram
 * cards. Two of its fixtures were not even the shape `renderVisual` emits. Derived, the catalogue cannot drift
 * from the app: a new visual kind appears the moment a generator can draw it.
 *
 * `diffs[0]` is the whole reachable set, not a sample: `duelScreen` fixes a match at the year's gentlest stage
 * and `Duel` passes that one value to every round, so a card needing difficulty 2 or 3 — a 16- or 20-object
 * counting frame among them — cannot appear in a duel however the match runs.
 *
 * Seeded, so the catalogue is byte-identical on every run and in both projects.
 */
export interface Card { what: string; kind: Visual['type'] | 'none'; topic: string; html: string; prompt: string; hint: string }
/** One card, built in code from one question, so the "real triple" is a fact rather than a promise in a comment. */
export const cardFor = (topic: Topic, q: Question): Card => ({
  what: `${q.visual?.type ?? 'none'} (${topic.id})`, kind: q.visual?.type ?? 'none', topic: topic.id,
  html: q.visual ? renderVisual(q.visual) : '', prompt: q.prompt, hint: q.hint ?? '',
});
export const POOL_CARDS: Card[] = (() => {
  const out: Card[] = [];
  const biggest = new Map<string, Card>();
  let plain: Card | null = null;
  let rightmostTick: Card | null = null;
  for (const year of YEARS) {
    for (const topic of duelPool(topicsFor(year.id), year.diffs[0])) {
      for (let seed = 1; seed <= 40; seed++) {
        const q = topic.gen(year.diffs[0], seededRng(seed));
        const card = cardFor(topic, q);
        if (card.kind === 'none') {
          if (!plain || q.prompt.length + card.hint.length > plain.prompt.length + plain.hint.length) plain = card;
          continue;
        }
        // The number line whose hidden tick is RIGHTMOST, by name. That is the card `overflow-y: clip` exists
        // for — `overflow: hidden` cut the `?` clean off it at 320px wide — and `markPainted` is vacuous
        // without it, on the very viewports this rail added for width.
        if (card.html.includes('class="mark">?</span></div></div>')) rightmostTick ??= { ...card, what: `${card.what} — hidden tick rightmost` };
        // Keyed by kind AND topic, never by kind alone, and kept by SIZE, not by seed order: the first two
        // cards seen used to win the slot, so `objects` kept `r-count`'s two stars and `y2-fractions`'s own
        // FOUR-star draw, never the pool's real twelve-star maximum — the card `src/style.css`'s 160px budget
        // and the portrait floor below are both written around, and both measured nothing (PR #428 review
        // round 4, B1a). `html.length` stands in for element count: every kind here repeats one child markup
        // per item (a `.slot`, an `<i>`, a `<circle>`...), so more items is a longer string.
        const key = `${card.kind}|${topic.id}`;
        const prev = biggest.get(key);
        if (!prev || card.html.length > prev.html.length) biggest.set(key, card);
      }
    }
  }
  out.push(...biggest.values());
  if (plain) out.unshift(plain);
  if (rightmostTick) out.push(rightmostTick);
  return out;
})();

