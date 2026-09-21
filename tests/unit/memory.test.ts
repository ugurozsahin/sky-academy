import { describe, it, expect } from 'vitest';
import { gridFor, Memory, THEMES, pickTheme } from '../../src/game/memory';
import { YEARS } from '../../src/curriculum';
import { SAME_SOLID, SHAPES_3D } from '../../src/curriculum/util';

function rng(seed: number) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const faceKey = (f: { text: string; coin?: number }) => `${f.coin ? 'coin:' : ''}${f.text}`;

describe('memory decks', () => {
  it('every theme builds 4–8 pairs with distinct faces on each side, for every year', () => {
    for (const y of YEARS) {
      const themes = THEMES[y.id];
      expect(themes, `${y.id} has its own decks`).toBeDefined();
      expect(themes!.length).toBeGreaterThanOrEqual(3);
      for (const theme of themes!) for (let seed = 1; seed <= 40; seed++) {
        const pairs = theme.pairs(rng(seed));
        // Year 2's 3-D board is FIVE, not six: `SHAPES_3D` has six rows and no board may carry two names
        // from `SAME_SOLID` (#372), so one row is always dropped. A smaller board, not a wrong one —
        // Reception plays four — and the rail below is what says which of the two it is.
        //
        // DERIVED from the table, not the literal 5 that was here first (#372 review, note 6): a legitimate
        // seventh solid would otherwise fail this unrelated assertion with `expected 6 to be 5`. The pin is
        // not lost — `asked` is still the deck's own request, and `solidsLost` is still exactly 1 today.
        const solidsLost = Math.max(0, SHAPES_3D.filter(r => SAME_SOLID.has(r[1])).length - 1);
        const asked = y.id === 'reception' ? 4 : 6;
        const want = y.id === 'year2' && theme.id === 'shapes' ? asked - solidsLost
          : y.id === 'reception' ? 4 : y.id === 'year1' ? 6 : theme.id === 'words' ? 6 : 8;
        expect(pairs.length, `${y.id}/${theme.id}`).toBe(want);
        expect(new Set(pairs.map(p => faceKey(p.a))).size, `${y.id}/${theme.id} left faces`).toBe(pairs.length);
        expect(new Set(pairs.map(p => faceKey(p.b))).size, `${y.id}/${theme.id} right faces`).toBe(pairs.length);
        for (const p of pairs) { expect(faceKey(p.a)).not.toBe(faceKey(p.b)); expect(p.a.say.length).toBeGreaterThan(0); expect(p.b.say.length).toBeGreaterThan(0); }
      }
    }
  });
  // guard rail (#372): Memory Match's Year 2 3-D board asked a child to pair the die with "cube" while
  // "cuboid" sat on the same board, and a cube IS a cuboid — the Year 1 NC's own "cuboids including cubes".
  // `shapes()` pairs one glyph with one name, so the child who pairs the die with "cuboid" was scored a MISS
  // for doing what the curriculum teaches. `SAME_SOLID` is the shared rule (`src/curriculum/util.ts`) and
  // `maths.ts` has honoured it in its decoys since #371; this is the deck honouring it too. Every theme of
  // every year, not just the 3-D one, so a future table that names two of a class cannot slip in beside it.
  it('no board carries two names from SAME_SOLID — a cube is a cuboid', () => {
    const solids = new Set<string>();
    for (const y of YEARS) for (const theme of THEMES[y.id] ?? []) for (let seed = 1; seed <= 120; seed++) {
      const pairs = theme.pairs(rng(seed));
      // BOTH faces, not just `p.b`. Reading the name side alone let the rail pass while glyph and name were
      // swapped in `shapes()` — the convention the whole check depends on was stated nowhere (#372 review,
      // note 2). A pair may name a solid on one side and draw it on the other; it may never name two.
      const names = pairs.flatMap(p => [p.a.text, p.b.text]).filter(t => SAME_SOLID.has(t));
      expect(names.length, `${y.id}/${theme.id} seed ${seed} offered ${names.join(' and ')}`).toBeLessThanOrEqual(1);
      if (y.id === 'year2' && theme.id === 'shapes') for (const n of names) solids.add(n);
      // The convention itself, on the decks `shapes()` builds, so note 2's swap is a failure with a message
      // rather than a silent pass: `shapes()` puts the GLYPH on `a` and the NAME on `b`, and a name is the
      // one face whose spoken form is its own text. (`count` pairs '🐸🐸' with 'two', so this is not general.)
      if (theme.id === 'shapes') for (const p of pairs) expect(p.b.text, `${y.id}/${theme.id}: the NAME is the right-hand face`).toBe(p.b.say);
    }
    // Which solid survives is alternation, not a fixed winner: `if (name === 'cuboid') continue;` satisfies
    // every line above — one solid, right board size — while the word "cuboid" never reaches a child at any
    // seed, which is a curriculum-coverage loss of exactly the kind this fix is about (#372 review, note 1).
    expect([...solids].sort(), 'both solids are reachable over the seeds, never together').toEqual([...SAME_SOLID].sort());
  });

  // guard rail (#372 review B1): four columns were hard-coded, so the five-pair 3-D board laid out 4 + 4 + 2
  // with two empty cells — the first ragged Memory board there had ever been, on the one mode whose whole
  // visual is a tidy grid. Every deck the game deals, plus the sizes a new one could plausibly be.
  it('no board lays out with a short row hanging off the left edge', () => {
    for (const y of YEARS) for (const theme of THEMES[y.id] ?? []) {
      const cards = theme.pairs(rng(1)).length * 2;
      const { cols, offset } = gridFor(cards);
      const short = cards % cols;
      const gapLeft = offset, gapRight = short ? cols - short - offset : 0;
      expect(Math.abs(gapLeft - gapRight), `${y.id}/${theme.id} (${cards} cards): a short row sits centred`).toBeLessThanOrEqual(1);
      expect(offset + short, `${y.id}/${theme.id}: the last row fits the grid`).toBeLessThanOrEqual(cols);
    }
    // Four columns for every board, which is what keeps the cards the size a five-year-old taps: five columns
    // were built and rendered first and broke the names mid-syllable at 390px (`spher/e`, `cylin/der`).
    expect(gridFor(8)).toEqual({ cols: 4, offset: 0 });
    expect(gridFor(10), 'ten cards: 4 + 4 + 2, the two centred').toEqual({ cols: 4, offset: 1 });
    expect(gridFor(12)).toEqual({ cols: 4, offset: 0 });
    expect(gridFor(14), 'a three-short row is centred as near as an even grid allows').toEqual({ cols: 4, offset: 1 });
    expect(gridFor(16)).toEqual({ cols: 4, offset: 0 });
  });

  it('year ranges: Reception counts to 6 and words to five, Y1 words within 20, Y2 words 21–99 and tables 2/5/10', () => {
    for (let seed = 1; seed <= 30; seed++) {
      for (const p of pickTheme('reception', rng(seed), 'count').pairs(rng(seed))) expect(Number(p.a.text)).toBeLessThanOrEqual(6);
      for (const p of pickTheme('year1', rng(seed), 'words').pairs(rng(seed))) expect(Number(p.a.text)).toBeLessThanOrEqual(20);
      for (const p of pickTheme('year2', rng(seed), 'words').pairs(rng(seed))) { expect(Number(p.a.text)).toBeGreaterThan(20); expect(Number(p.a.text)).toBeLessThan(100); }
      for (const p of pickTheme('year2', rng(seed), 'tables').pairs(rng(seed))) { const [k, t] = p.a.text.split(' × ').map(Number); expect([2, 5, 10]).toContain(t); expect(k * t).toBe(Number(p.b.text)); }
    }
  });
  it('coins are drawn as coins on one side and named on the other', () => {
    const pairs = pickTheme('year2', rng(3), 'coins').pairs(rng(3));
    expect(pairs.length).toBe(8);
    for (const p of pairs) { expect(p.a.coin).toBeGreaterThan(0); expect(p.b.coin).toBeUndefined(); expect(p.b.text).toBe(p.a.text); }
    expect(pairs.some(p => p.a.text.startsWith('£'))).toBe(true);
  });
  it('pickTheme falls back to a random theme of the year when the id is unknown', () => {
    expect(THEMES.year1!.map(t => t.id)).toContain(pickTheme('year1', rng(9), 'nope').id);
  });
});

describe('memory game', () => {
  const deck = () => pickTheme('year1', rng(1), 'words').pairs(rng(1));
  const partner = (g: Memory, i: number) => g.cards.findIndex((c, k) => k !== i && c.pair === g.cards[i].pair);
  const other = (g: Memory, i: number) => g.cards.findIndex((c, k) => c.pair !== g.cards[i].pair && !c.matched);
  it('shuffles two cards per pair and starts face down', () => {
    const g = new Memory(deck(), rng(2));
    expect(g.cards.length).toBe(12); expect(g.cards.every(c => !c.up && !c.matched)).toBe(true);
    expect(g.cards.map(c => c.pair).sort()).toEqual([0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5]);
    expect(g.done).toBe(false); expect(g.stars).toBe(0); expect(g.coins).toBe(0);
  });
  it('a miss must be hidden before the next flip; a match locks both cards', () => {
    const g = new Memory(deck(), rng(2));
    expect(g.flip(0)).toBe('open'); expect(g.flip(0)).toBe('ignored');                // same card twice
    expect(g.flip(other(g, 0))).toBe('miss'); expect(g.moves).toBe(1);
    expect(g.flip(partner(g, 0))).toBe('ignored');                                    // two open cards: locked
    g.hide(); expect(g.cards.filter(c => c.up).length).toBe(0);
    expect(g.flip(0)).toBe('open'); expect(g.flip(partner(g, 0))).toBe('match');
    expect(g.matched).toBe(1); expect(g.score).toBe(10); expect(g.moves).toBe(2);
    expect(g.flip(0)).toBe('ignored'); expect(g.cards[0].matched).toBe(true);
  });
  it('perfect play earns 3 stars, streak bonuses and coins; sloppy play still finishes with 1 star', () => {
    const g = new Memory(deck(), rng(2));
    for (let i = 0; i < g.cards.length; i++) if (!g.cards[i].matched) expect(g.flip(i) === 'open' && g.flip(partner(g, i))).toBe('match');
    expect(g.done).toBe(true); expect(g.moves).toBe(6); expect(g.stars).toBe(3);
    expect(g.score).toBe(10 * 6 + 5 * (1 + 2 + 3 + 3 + 3)); expect(g.bestStreak).toBe(6);
    expect(g.coins).toBe(6 * 2 + 15);
    expect(g.flip(0)).toBe('ignored');                                                // finished board ignores flips
    const s = new Memory(deck(), rng(2));
    for (let n = 0; n < 12; n++) { s.flip(0); s.flip(other(s, 0)); s.hide(); }          // 12 wasted turns
    for (let i = 0; i < s.cards.length; i++) if (!s.cards[i].matched) { s.flip(i); s.flip(partner(s, i)); }
    expect(s.done).toBe(true); expect(s.moves).toBe(18); expect(s.stars).toBe(1); expect(s.coins).toBe(12 + 5);
  });
});
