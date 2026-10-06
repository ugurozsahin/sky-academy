// Tricky Facts (#1124): a short Sprint over the child's least secure × facts and their reversed pairs. Pure: no DOM,
// no storage import — the caller hands in `ks2.facts`.
import type { Question, Rng, Topic } from '../curriculum/types';
import { q, shuffle } from '../curriculum/util';
import { leastSecure } from '../fact-record';
import type { Ks2Fact } from '../save-records';
import type { DeckItem } from './session';

const FACTORS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

/** One `a × b = ?` card: the answer and three neighbouring-fact products (`(a ± 1) × b`, `a × (b ± 1)`), topped up from 2–12 pairs. */
function card(a: number, b: number, rng: Rng): Question {
  const answer = a * b, decoys: number[] = [];
  const add = (x: number, y: number) => {
    const v = x * y;
    if (x >= 2 && x <= 12 && y >= 2 && y <= 12 && v !== answer && !decoys.includes(v)) decoys.push(v);
  };
  for (const [x, y] of shuffle(rng, [[a - 1, b], [a + 1, b], [a, b - 1], [a, b + 1]])) add(x, y);
  for (const x of shuffle(rng, FACTORS)) for (const y of shuffle(rng, FACTORS)) if (decoys.length < 3) add(x, y);
  return { ...q(`${a} × ${b} = ?`), fact: `${a}×${b}`, answer: String(answer), options: shuffle(rng, [answer, ...decoys.slice(0, 3)].map(String)) };
}

/** A module constant, not a registry row: the deck is what the Session asks; `gen` is only its fallback (any 2–12 fact). */
export const TRICKY: Topic = {
  id: 'tables-tricky', title: 'Tricky facts', icon: '✖️', subject: 'maths', year: 'year4', nc: 'Y4 M&D: recall multiplication facts to 12 × 12', drill: true,
  gen: (_d, rng) => { const [a, b] = shuffle(rng, FACTORS); return card(a, b, rng); },
};

/** The least secure facts (at most 8 lines, #1123), each followed by its reversed pair (a square fact once), shuffled. */
export function trickyDeck(facts: Record<string, Ks2Fact>, rng: Rng): DeckItem[] {
  const keys = new Set<string>();
  for (const line of leastSecure(facts)) for (const k of line) { const [a, b] = k.split('×'); keys.add(k); keys.add(`${b}×${a}`); }
  const cards = [...keys].map(k => { const [a, b] = k.split('×').map(Number); return card(a, b, rng); });
  return shuffle(rng, cards).map(qn => ({ topic: TRICKY, q: qn }));
}

/** Sensei's offer after a Tables Check, or `null` when no fact is insecure. */
export const trickyOffer = (facts: Record<string, Ks2Fact>): string | null =>
  leastSecure(facts).length ? "Sensei says: let's fix your tricky facts!" : null;
