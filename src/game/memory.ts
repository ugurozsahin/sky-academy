// Memory Match: flip two cards, keep the pairs. Pure logic + pair decks (no DOM) so it is unit-testable.
import type { Rng, YearId } from '../curriculum';
import { coinLabel, numberWord, OBJECTS, pick, ri, SAME_SOLID, shuffle, SHAPES_2D, SHAPES_3D } from '../curriculum/util';

export interface Face { text: string; say: string; coin?: number; small?: boolean }  // coin = pence, drawn as a coin
export interface Pair { a: Face; b: Face }
// `hintIsData` (named after the same flag on `Question`, `curriculum/types.ts`): true when the hint is the
// only place the matching rule is stated. Every other theme pairs a picture/count/word with a name — the
// two faces already say "this kind matches that kind" without being told — but `doubles` shows `double 3`
// beside `6` and `tables` shows `4 × 2` beside `8`: both faces are plain numeric text, so nothing on the
// board itself says a child is hunting for an ANSWER rather than, say, a bigger number (#461).
//
// Required, not optional (#461 review round 1): an optional flag defaults every theme literal that omits it
// to `undefined` — falsy, same as an explicit `false` — so a tenth theme added later with no opinion either
// way compiles silently and ships with its matching rule gone in landscape, the exact regression this file
// exists to close. A required field makes every theme literal state its answer, checked by `tsc` before any
// test runs.
export interface Theme { id: string; title: string; hint: string; hintIsData: boolean; pairs: (rng: Rng) => Pair[] }
export interface Card { pair: number; face: Face; up: boolean; matched: boolean }
export type FlipResult = 'ignored' | 'open' | 'match' | 'miss';

const txt = (text: string, say = text, small = false): Face => ({ text, say, small });
const coin = (p: number): Face => ({ text: coinLabel(p), say: p >= 100 ? `${p / 100} pound${p > 100 ? 's' : ''}` : `${p} pence`, coin: p });
const objs = (n: number, emoji: string): Face => ({ text: emoji.repeat(n), say: String(n) });
const words = (rng: Rng, from: number, to: number, n: number): Pair[] => shuffle(rng, Array.from({ length: to - from + 1 }, (_, i) => from + i)).slice(0, n).map(v => ({ a: txt(String(v), numberWord(v)), b: txt(numberWord(v), numberWord(v), v > 20) }));
// Shape tables come from curriculum/util.ts (SHAPES_2D/SHAPES_3D); Memory only needs the glyph + name, so
// `shapes()` reads the first two members and ignores the extra fact field (sides / faces).
// At most ONE name from `SAME_SOLID` per board (#372). A cube IS a cuboid — the Year 1 NC's own "cuboids
// including cubes" — so a deck carrying both 🎲/cube and 🧱/cuboid scores a child who pairs 🎲 with "cuboid"
// a MISS for doing exactly what the curriculum teaches, and `shapes()` pairs one glyph with one name, so only
// 🎲↔cube counts. `maths.ts` has held the two apart in its decoys since #371; the deck is the other place they
// can meet. `SHAPES_3D` has exactly six rows, so the Year 2 board is five pairs rather than six — a smaller
// board, not a wrong one, and Reception already plays four.
//
// `SAME_SOLID` is ONE set, deliberately read here as "at most one of these", and this comment does not call it
// a class (#372 review, note 3): the set cannot express a second group, and its two readers would diverge if
// one were added — `maths.ts:411` reads it pairwise, this reads it as a union, and with one group those are
// indistinguishable. A second group needs a `Map<name, groupId>` and both readers changed together, not
// another name dropped into this set.
//
// `max`, not an exact count: the filter can return fewer rows than asked for, which is exactly what makes the
// Year 2 board five. Each theme's exact size is pinned in `tests/unit/memory.test.ts`.
const shapes = (rng: Rng, list: readonly (readonly [string, string, ...unknown[]])[], max: number): Pair[] => {
  const out: Pair[] = [];
  let solid = false;
  for (const [g, name] of shuffle(rng, list)) {
    if (out.length >= max) break;
    if (SAME_SOLID.has(name)) { if (solid) continue; solid = true; }
    out.push({ a: txt(g, name), b: txt(name, name, name.length > 6) });
  }
  return out;
};
const coins = (rng: Rng, list: number[], n: number): Pair[] => shuffle(rng, list).slice(0, n).map(p => ({ a: coin(p), b: txt(p >= 100 ? `£${p / 100}` : `${p}p`, coin(p).say) }));

/** Card decks per island. Each theme yields 4 (Reception) to 8 (Year 2) pairs with all faces distinct. */
export const THEMES: Partial<Record<YearId, Theme[]>> = {
  reception: [
    { id: 'count', title: 'Count & match', hint: 'Match each number to the same number of things', hintIsData: false, pairs: rng => { const e = pick(rng, OBJECTS); return shuffle(rng, [1, 2, 3, 4, 5, 6]).slice(0, 4).map(n => ({ a: txt(String(n), numberWord(n)), b: objs(n, e) })); } },
    { id: 'shapes', title: 'Shapes', hint: 'Match each shape to its name', hintIsData: false, pairs: rng => shapes(rng, SHAPES_2D.slice(0, 4), 4) },
    { id: 'words', title: 'Number words', hint: 'Match each number to its word', hintIsData: false, pairs: rng => words(rng, 1, 5, 4) },
  ],
  year1: [
    { id: 'words', title: 'Number words', hint: 'Match each number to its word', hintIsData: false, pairs: rng => words(rng, 1, 20, 6) },
    { id: 'coins', title: 'Coins', hint: 'Match each coin to its value', hintIsData: false, pairs: rng => coins(rng, [1, 2, 5, 10, 20, 50], 6) },
    { id: 'shapes', title: '2-D shapes', hint: 'Match each shape to its name', hintIsData: false, pairs: rng => shapes(rng, SHAPES_2D, 6) },
    { id: 'doubles', title: 'Doubles', hint: 'Match each double to its answer', hintIsData: true, pairs: rng => shuffle(rng, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]).slice(0, 6).map(n => ({ a: txt(`double ${n}`, `double ${n}`, true), b: txt(String(n * 2), numberWord(n * 2)) })) },
  ],
  year2: [
    { id: 'words', title: 'Number words', hint: 'Match each number to its word', hintIsData: false, pairs: rng => words(rng, 21, 99, 6) },
    { id: 'coins', title: 'Coins', hint: 'Match each coin to its value', hintIsData: false, pairs: rng => coins(rng, [1, 2, 5, 10, 20, 50, 100, 200], 8) },
    { id: 'shapes', title: '3-D shapes', hint: 'Match each shape to its name', hintIsData: false, pairs: rng => shapes(rng, SHAPES_3D, 6) },
    { id: 'tables', title: 'Times tables', hint: 'Match each times-table fact to its answer', hintIsData: true, pairs: rng => {
      const facts: [number, number][] = []; const seen = new Set<number>();
      for (let guard = 0; facts.length < 8 && guard < 80; guard++) { const t = pick(rng, [2, 5, 10]), k = ri(rng, 2, 10); if (!seen.has(t * k)) { seen.add(t * k); facts.push([t, k]); } }
      return facts.map(([t, k]) => ({ a: txt(`${k} × ${t}`, `${k} times ${t}`), b: txt(String(t * k), numberWord(t * k)) }));
    } },
  ],
};

export class Memory {
  cards: Card[]; moves = 0; matched = 0; score = 0; streak = 0; bestStreak = 0; open: number[] = [];
  readonly pairs: Pair[];
  constructor(pairs: Pair[], rng: Rng = Math.random) {
    this.pairs = pairs;
    const faces = pairs.flatMap((p, i) => [{ pair: i, face: p.a, up: false, matched: false }, { pair: i, face: p.b, up: false, matched: false }]);
    this.cards = shuffle(rng, faces);
  }
  get done() { return this.matched === this.pairs.length; }
  /** Turn a card face up. Two open non-matching cards must be hidden (`hide()`) before the next flip. */
  flip(i: number): FlipResult {
    const c = this.cards[i];
    if (!c || c.up || c.matched || this.open.length >= 2 || this.done) return 'ignored';
    c.up = true; this.open.push(i);
    if (this.open.length < 2) return 'open';
    this.moves++;
    const [x, y] = this.open.map(k => this.cards[k]);
    if (x.pair === y.pair) {
      x.matched = y.matched = true; this.open = []; this.matched++;
      this.streak++; this.bestStreak = Math.max(this.bestStreak, this.streak);
      this.score += 10 + (this.streak > 1 ? 5 * Math.min(this.streak - 1, 3) : 0);
      return 'match';
    }
    this.streak = 0;
    return 'miss';
  }
  /** After a miss: turn the two open cards back over. */
  hide() { for (const k of this.open) this.cards[k].up = false; this.open = []; }
  /** Stars by efficiency: perfect play = one move per pair. */
  get stars(): 0 | 1 | 2 | 3 { const n = this.pairs.length; if (!this.done) return 0; return this.moves <= n * 1.5 ? 3 : this.moves <= n * 2.5 ? 2 : 1; }
  get coins() { return this.done ? this.matched * 2 + 5 * this.stars : 0; }
}

export function pickTheme(year: YearId, rng: Rng = Math.random, id?: string): Theme {
  // Fall back to Reception's decks for any year that has no themes yet (e.g. Y3–Y6 before their own are added).
  const list = THEMES[year] ?? THEMES.reception!;
  return list.find(t => t.id === id) ?? pick(rng, list);
}

/**
 * How to lay a board of `cards` out: the column count, and the column its last row starts at.
 *
 * Four columns was hard-coded with the comment "8 / 12 / 16 cards → 2 / 3 / 4 rows", and that enumeration
 * stopped being true the moment a deck was not a multiple of four: the Year 2 3-D board is five pairs, which
 * four columns lay out as 4 + 4 + 2 — a last row shoved left with two empty cells beside it, on the one mode
 * whose whole visual is a tidy grid (#372 review B1). Pure and unit-tested here rather than inline in
 * `src/ui/memory.ts`, because "no board lays out ragged" is a claim about arithmetic, not about a screen.
 *
 * **Four columns still, for every board, and the short row is CENTRED instead.** Five columns was built and
 * rendered first, because ten cards divide into 5 x 2 exactly — and it is the wrong answer: at 390px the
 * cards drop from 82px to 63px and `overflow-wrap: anywhere` breaks the names mid-syllable, `spher/e` and
 * `cylin/der` and `cuboi/d`, on cards a Year 2 child is there to READ. A centred short row keeps every card
 * the size it has always been and every word whole. So `cols` is the constant the screen already had, and
 * `offset` is the only new thing: how far in the last row starts when it does not fill.
 */
export function gridFor(cards: number): { cols: number; offset: number; lastRowStart: number } {
  const cols = 4;
  const short = cards % cols;
  // `lastRowStart` is the INDEX of the card the offset applies to, or -1 when the grid comes out square, so
  // the caller has nothing left to derive (#372 review round 2, note 6). It was `cards % cols` again in
  // `src/ui/memory.ts`, gated on `offset` being non-zero — which disagree for a row of three, where the row
  // is short and `Math.floor((4 - 3) / 2)` is 0. Unreachable on a deck of pairs, and not the caller's to
  // know: this function owns the arithmetic or it owns nothing.
  return { cols, offset: short ? Math.floor((cols - short) / 2) : 0, lastRowStart: short ? cards - short : -1 };
}
