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
        // DERIVED from the table, not the literal 5 that was here first — and derived the way `shapes()`
        // actually behaves, which the first attempt did not (#372 review round 2, note 1): it returns
        // `min(max asked, rows - solidsLost)`, so subtracting `solidsLost` from the request alone still failed
        // on a seventh NON-solid row with `expected 6 to be 5`, buying nothing over the literal while reading
        // as if it did. Both growths are right now: a seventh solid, and a seventh row that is not one.
        const solidsLost = Math.max(0, SHAPES_3D.filter(r => SAME_SOLID.has(r[1])).length - 1);
        const asked = y.id === 'reception' ? 4 : 6;
        const want = y.id === 'year2' && theme.id === 'shapes' ? Math.min(asked, SHAPES_3D.length - solidsLost)
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
  // `maths.ts` has honoured it in its decoys since #371; this is the deck honouring it too.
  //
  // **What this holds is exactly "no board carries two names from `SAME_SOLID`" — the one two-name set — and
  // NOT "no board names two shapes of a kind"** (#372 review round 2, B1). The wider claim was written here
  // first and it is false today, not in some future table: `SHAPES_2D` holds `■ square` and `▬ rectangle`,
  // Reception deals `slice(0, 4)` and Year 1 deals all six, so EVERY 2-D board carries both — and the Year 1
  // NC says "rectangles (including squares)", word for word the construction this fix is built on. That
  // instance is **#476**, not this rail's to catch: `SAME_SOLID` cannot express a second group at all (see
  // `src/game/memory.ts`), and adding one needs a `Map<name, groupId>` with `maths.ts`'s pairwise reader
  // changed in step. Running over every theme of every year is coverage, so a later table adding a `SAME_SOLID`
  // name is caught wherever it lands — it is not a claim about shapes the set does not name.
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
      // The glyph-on-`a`, name-on-`b` convention, on the decks `shapes()` builds. Stated plainly (#372 review
      // round 2, note 5): `b: txt(name, name, …)` makes this `name === name`, so it catches a swap only when
      // the swap moves the glyph onto `b` while `say` keeps the name — which is the swap round 1 found. It is
      // a statement of the convention, NOT what holds the line; the `names` union above is that, and it reads
      // both faces for exactly this reason. (`count` pairs '🐸🐸' with 'two', so this is not general.)
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
    }
    // Four columns for every board, which is what keeps the cards the size a five-year-old taps: five columns
    // were built and rendered first and broke the names mid-syllable at 390px (`spher/e`, `cylin/der`).
    expect(gridFor(8)).toEqual({ cols: 4, offset: 0, lastRowStart: -1 });
    expect(gridFor(10), 'ten cards: 4 + 4 + 2, the two centred').toEqual({ cols: 4, offset: 1, lastRowStart: 8 });
    expect(gridFor(12)).toEqual({ cols: 4, offset: 0, lastRowStart: -1 });
    expect(gridFor(16)).toEqual({ cols: 4, offset: 0, lastRowStart: -1 });
    // A board is pairs x 2, so `cards` is always even and `short` is always 0 or 2 — 14 is the same case as
    // 10 and was labelled as a third one (#372 review round 2, note 3). The odd counts are asked directly so
    // the asymmetric branch is not dead code: a row of 3 cannot sit dead centre in 4 columns, and 1 can.
    expect(gridFor(9), 'nine: a row of 1, centred as near as four columns allow').toEqual({ cols: 4, offset: 1, lastRowStart: 8 });
    expect(gridFor(15), 'fifteen: a row of 3, which four columns cannot centre exactly').toEqual({ cols: 4, offset: 0, lastRowStart: 12 });
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

  // #461: `doubles` and `tables` are the only two themes whose faces are both plain numeric text — every
  // other theme pairs a picture, a count or a word with a name, so the two faces already say which kind
  // matches which. Named exhaustively rather than "the rest are false" (#526): a theme added later with no
  // opinion either way is a silent `undefined`, caught here the moment its id is missing from either list.
  it('only doubles and tables mark their hint as the sole statement of the matching rule', () => {
    const dataThemes = new Set(['doubles', 'tables']);
    for (const y of YEARS) for (const theme of THEMES[y.id] ?? []) {
      expect(!!theme.hintIsData, `${y.id}/${theme.id}`).toBe(dataThemes.has(theme.id));
    }
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
