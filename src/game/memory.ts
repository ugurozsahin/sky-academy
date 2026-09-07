// Memory Match: flip two cards, keep the pairs. Pure logic + pair decks (no DOM) so it is unit-testable.
import type { Rng, YearId } from '../curriculum';
import { numberWord, OBJECTS, pick, ri, shuffle } from '../curriculum/util';

export interface Face { text: string; say: string; coin?: number; small?: boolean }  // coin = pence, drawn as a coin
export interface Pair { a: Face; b: Face }
export interface Theme { id: string; title: string; hint: string; pairs: (rng: Rng) => Pair[] }
export interface Card { pair: number; face: Face; up: boolean; matched: boolean }
export type FlipResult = 'ignored' | 'open' | 'match' | 'miss';

const txt = (text: string, say = text, small = false): Face => ({ text, say, small });
const coin = (p: number): Face => ({ text: p >= 100 ? `£${p / 100}` : `${p}p`, say: p >= 100 ? `${p / 100} pound${p > 100 ? 's' : ''}` : `${p} pence`, coin: p });
const objs = (n: number, emoji: string): Face => ({ text: emoji.repeat(n), say: String(n) });
const words = (rng: Rng, from: number, to: number, n: number): Pair[] => shuffle(rng, Array.from({ length: to - from + 1 }, (_, i) => from + i)).slice(0, n).map(v => ({ a: txt(String(v), numberWord(v)), b: txt(numberWord(v), numberWord(v), v > 20) }));
const SHAPES2D: [string, string][] = [['●', 'circle'], ['■', 'square'], ['▲', 'triangle'], ['▬', 'rectangle'], ['⬟', 'pentagon'], ['⬢', 'hexagon']];
const SHAPES3D: [string, string][] = [['🎲', 'cube'], ['⚽', 'sphere'], ['🥫', 'cylinder'], ['🍦', 'cone'], ['🔺', 'pyramid'], ['🧱', 'cuboid']];
const shapes = (rng: Rng, list: [string, string][], n: number): Pair[] => shuffle(rng, list).slice(0, n).map(([g, name]) => ({ a: txt(g, name), b: txt(name, name, name.length > 6) }));
const coins = (rng: Rng, list: number[], n: number): Pair[] => shuffle(rng, list).slice(0, n).map(p => ({ a: coin(p), b: txt(p >= 100 ? `£${p / 100}` : `${p}p`, coin(p).say) }));

/** Card decks per island. Each theme yields 4 (Reception) to 8 (Year 2) pairs with all faces distinct. */
export const THEMES: Partial<Record<YearId, Theme[]>> = {
  reception: [
    { id: 'count', title: 'Count & match', hint: 'Match each number to the same number of things', pairs: rng => { const e = pick(rng, OBJECTS); return shuffle(rng, [1, 2, 3, 4, 5, 6]).slice(0, 4).map(n => ({ a: txt(String(n), numberWord(n)), b: objs(n, e) })); } },
    { id: 'shapes', title: 'Shapes', hint: 'Match each shape to its name', pairs: rng => shapes(rng, SHAPES2D.slice(0, 4), 4) },
    { id: 'words', title: 'Number words', hint: 'Match each number to its word', pairs: rng => words(rng, 1, 5, 4) },
  ],
  year1: [
    { id: 'words', title: 'Number words', hint: 'Match each number to its word', pairs: rng => words(rng, 1, 20, 6) },
    { id: 'coins', title: 'Coins', hint: 'Match each coin to its value', pairs: rng => coins(rng, [1, 2, 5, 10, 20, 50], 6) },
    { id: 'shapes', title: '2-D shapes', hint: 'Match each shape to its name', pairs: rng => shapes(rng, SHAPES2D, 6) },
    { id: 'doubles', title: 'Doubles', hint: 'Match each double to its answer', pairs: rng => shuffle(rng, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]).slice(0, 6).map(n => ({ a: txt(`double ${n}`, `double ${n}`, true), b: txt(String(n * 2), numberWord(n * 2)) })) },
  ],
  year2: [
    { id: 'words', title: 'Number words', hint: 'Match each number to its word', pairs: rng => words(rng, 21, 99, 6) },
    { id: 'coins', title: 'Coins', hint: 'Match each coin to its value', pairs: rng => coins(rng, [1, 2, 5, 10, 20, 50, 100, 200], 8) },
    { id: 'shapes', title: '3-D shapes', hint: 'Match each shape to its name', pairs: rng => shapes(rng, SHAPES3D, 6) },
    { id: 'tables', title: 'Times tables', hint: 'Match each times-table fact to its answer', pairs: rng => {
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
