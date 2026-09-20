import { describe, expect, it, vi } from 'vitest';
import { clockSVG, coinSVG, fiveFrames, renderVisual } from '../../src/ui/visuals';

const count = (html: string, re: RegExp) => (html.match(re) ?? []).length;
describe('five-frames for object visuals (#54)', () => {
  it('lays objects out in rows of five with faint empty slots', () => {
    const h = fiveFrames(7, '🍎');
    expect(count(h, /class="five"/g)).toBe(2);              // 7 objects → two rows
    expect(count(h, /class="slot"/g)).toBe(10);             // 10 slots in total
    expect(count(h, /class="obj"/g)).toBe(7);               // 7 filled, 3 empty
    expect(count(fiveFrames(3, '🐟'), /class="slot"/g)).toBe(5);   // never fewer than one full row
    expect(count(fiveFrames(10, '⭐'), /class="five"/g)).toBe(2);
    expect(count(fiveFrames(24, '🍪'), /class="five"/g)).toBe(5);
  });
  it('crosses out taken-away objects but keeps them in their slots', () => {
    const h = renderVisual({ type: 'objects', emoji: '🍎', n: 8, n2: -3 });
    expect(count(h, /class="obj gone"/g)).toBe(3); expect(count(h, /class="obj"/g)).toBe(5); expect(count(h, /class="slot"/g)).toBe(10);
  });
  it('frames both groups of an addition / comparison', () => {
    const h = renderVisual({ type: 'objects', emoji: '🍎', n: 4, n2: 3, emoji2: '🍎' });
    expect(count(h, /class="grp"/g)).toBe(2); expect(count(h, /class="five"/g)).toBe(2); expect(h).toContain('class="plus">+');
    expect(renderVisual({ type: 'objects', emoji: '🍎', n: 4, n2: 3, emoji2: '🍌' })).toContain('class="plus">or');
  });
});

describe('renderVisual — a builder for every Visual.type (#43)', () => {
  const count = (html: string, re: RegExp) => (html.match(re) ?? []).length;

  it('no visual renders nothing', () => {
    expect(renderVisual(undefined)).toBe('');
  });

  it('tenframe fills n cells in the first colour, n2 in the second, across as many frames as needed', () => {
    const one = renderVisual({ type: 'tenframe', n: 7 });
    expect(count(one, /class="tenframe"/g)).toBe(1);
    expect(count(one, /<i class="a">/g)).toBe(7);
    expect(count(one, /<i class="">/g)).toBe(3);              // 10 - 7 empty
    const two = renderVisual({ type: 'tenframe', n: 7, n2: 5 });
    expect(count(two, /class="tenframe"/g)).toBe(2);          // total 12 → two frames
    expect(count(two, /<i class="a">/g)).toBe(7);
    expect(count(two, /<i class="b">/g)).toBe(5);
  });

  it('dots draws one circle per pip for the layouts it knows (1–6) and none beyond', () => {
    expect(count(renderVisual({ type: 'dots', n: 3 }), /<circle/g)).toBe(3);
    expect(count(renderVisual({ type: 'dots', n: 6 }), /<circle/g)).toBe(6);
    expect(count(renderVisual({ type: 'dots', n: 9 }), /<circle/g)).toBe(0);   // no layout past 6
  });

  it('array lays out rows × cols cells with a column template', () => {
    const h = renderVisual({ type: 'array', rows: 2, cols: 3 });
    expect(count(h, /<i><\/i>/g)).toBe(6);
    expect(h).toContain('grid-template-columns:repeat(3,1fr)');
  });

  it('coins draws one coin per value', () => {
    expect(count(renderVisual({ type: 'coins', coins: [1, 5, 100] }), /class="coin"/g)).toBe(3);
  });

  it('a clock places twelve numerals and points the hour hand to the right at 3 o’clock', () => {
    const h = renderVisual({ type: 'clock', h: 3, m: 0 });
    expect(h).toContain('class="clock"');
    expect(count(h, /<text/g)).toBe(12);
    expect(h).toContain('class="hour"');
  });

  it('a circle fraction draws one wedge per part and shades `shaded` of them', () => {
    const h = renderVisual({ type: 'fraction', parts: 4, shaded: 1 });
    expect(h).toContain('class="frac"');
    expect(count(h, /<path/g)).toBe(4);
    expect(count(h, /class="sh"/g)).toBe(1);
  });

  it('a bar fraction draws one segment per part', () => {
    const h = renderVisual({ type: 'fraction', parts: 5, shaded: 2, shape: 'bar' });
    expect(h).toContain('class="bar"');
    expect(count(h, /<i /g)).toBe(5);
    expect(count(h, /class="sh"/g)).toBe(2);
  });

  it('a number line spans from..to and hides the marked number as a "?"', () => {
    const h = renderVisual({ type: 'numberline', from: 0, to: 5, mark: 3 });
    expect(count(h, /<span/g)).toBe(6);                       // 0..5 inclusive
    expect(h).toContain('class="mark">?');
    expect(h).toContain('>0<');
    expect(h).not.toContain('>3<');                           // 3 is the hidden mark
  });

  it('balance scales escape each pan and flag a crowded pan as "many"', () => {
    const h = renderVisual({ type: 'scales', left: '3 + 4', right: '? + 2' });
    expect(h).toContain('class="scales"');
    expect(count(h, /class="pan/g)).toBe(2);
    expect(renderVisual({ type: 'scales', left: '1 + 2 + 3 + 4', right: '?' })).toContain('class="pan many"');
  });

  it('a word card shows the text and, when given, an emoji', () => {
    const withEmoji = renderVisual({ type: 'word', text: 'cat', emoji: '🐱' });
    expect(withEmoji).toContain('class="vis wordcard"');
    expect(withEmoji).toContain('class="emoji">🐱');
    expect(withEmoji).toContain('class="txt">cat');
    expect(renderVisual({ type: 'word', text: 'dog' })).not.toContain('class="emoji"');
  });

  it('a sentence turns the blank underscores into an underlined gap', () => {
    const h = renderVisual({ type: 'sentence', text: 'The ___ sat' });
    expect(h).toContain('class="vis sentence"');
    expect(h).toContain('<u class="gap">');
    expect(h).not.toContain('_');                             // every run of underscores becomes the gap
  });
});

describe('coinSVG — real UK coin shapes (#43)', () => {
  it('the 20p and 50p are seven-sided; the round coins are circles', () => {
    expect(coinSVG(20)).toContain('<polygon');
    expect(coinSVG(50)).toContain('<polygon');
    expect(coinSVG(20)).toContain('points=');
    expect(coinSVG(5)).not.toContain('<polygon');
    expect((coinSVG(5).match(/<circle/g) ?? []).length).toBe(1);
  });
  it('the £2 coin gets an inner ring (bimetallic)', () => {
    expect((coinSVG(200).match(/<circle/g) ?? []).length).toBe(2);
  });
  // #298 slice 4: Year 1 recognises "coins **and notes**", so £5 and £10 are paper, not very large coins.
  it('the £5 and £10 are drawn as notes — a rectangle, never a disc', () => {
    for (const p of [500, 1000]) {
      expect(coinSVG(p), `${p}p`).toContain('<rect');
      expect(coinSVG(p), `${p}p`).not.toContain('<circle');
      expect(coinSVG(p), `${p}p`).not.toContain('<polygon');
    }
    expect(coinSVG(500)).toContain('>£5<');
    expect(coinSVG(1000)).toContain('>£10<');
    // Distinguishable from each other, and both from the gold the £1/£2 use.
    expect(coinSVG(500)).not.toBe(coinSVG(1000));
    for (const p of [500, 1000]) expect(coinSVG(p), `${p}p reuses the coin gold`).not.toContain('#e6c250');
  });
  it('a note is wider than it is tall — the coin viewBox would render it as a square', () => {
    for (const p of [500, 1000]) {
      const box = coinSVG(p).match(/viewBox="0 0 (\d+) (\d+)"/);
      expect(box, `${p}p has no viewBox`).not.toBeNull();
      expect(Number(box![1]), `${p}p width`).toBeGreaterThan(Number(box![2]));
    }
  });
  it('a note still carries the .coin class, so the arena keeps sizing and shadowing it', () => {
    // `.coins .coin` in style.css owns height/drop-shadow, and the e2e visual check counts `.vis .coin`.
    for (const p of [500, 1000]) expect(coinSVG(p), `${p}p`).toMatch(/class="coin(\s|")/);
  });
});

describe('clockSVG — hand angles (#43)', () => {
  it('at 3:00 the hour hand points right and the minute hand points up', () => {
    const h = clockSVG(3, 0);
    expect(h).toContain('x2="72.0"');                         // 50 + 22·sin(90°)
    expect(h).toContain('class="min"');
    expect(h).toContain('y2="18.0"');                         // 50 - 32·cos(0°)
  });
});

/**
 * Y2 statistics charts (#8). The drawing *is* the data for this topic, so each row must show its own count:
 * a pictogram divides by the key, a tally groups in fives, a block diagram draws one block each.
 *
 * Prove it red: drop the `/ each` from the pictogram row, or the gate-stroke class from the fifth tally mark.
 */
describe('chart visuals: pictogram, tally and block diagram (#8)', () => {
  const rows = [{ label: '🍎 apples', n: 6 }, { label: '🍌 bananas', n: 4 }, { label: '🍓 strawberries', n: 2 }];

  /** Symbols per row, in order — an aggregate count cannot see a row drawn with its neighbour's data. */
  const perRow = (html: string, re: RegExp) => html.split('class="chart-row"').slice(1).map(seg => (seg.match(re) ?? []).length);

  it('a pictogram draws n / each symbols per row and states its key', () => {
    const h = renderVisual({ type: 'chart', kind: 'pictogram', rows, icon: '⭐', each: 2 });
    // Per row, not summed: 6/4/2 with a key of 2 is 3/2/1, and shifting a row's data past its neighbour
    // keeps the total at 6 while making every question in the topic unanswerable (#8 review).
    expect(perRow(h, /class="pic"/g)).toEqual([3, 2, 1]);
    expect(h).toContain('1 ⭐ = 2');
    // A key of one is the absence of a key, not the sentence "1 ⭐ = 1".
    expect(renderVisual({ type: 'chart', kind: 'pictogram', rows, icon: '⭐', each: 1 })).not.toContain('class="key"');
  });

  it('a key it cannot honour draws one symbol per child rather than rounding to a number nobody has', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});   // #137 item 5's trace is expected here
    try {
      // `Visual` is public and `each` is an unconstrained number on it. Rounding used to invent the data:
      // n=7 with a key of 2 drew 4 symbols — 8 children — for a question whose answer is 7.
      const odd = [{ label: 'a', n: 7 }];
      expect(perRow(renderVisual({ type: 'chart', kind: 'pictogram', rows: odd, icon: '⭐', each: 2 }), /class="pic"/g)).toEqual([7]);
      expect(renderVisual({ type: 'chart', kind: 'pictogram', rows: odd, icon: '⭐', each: 2 })).not.toContain('class="key"');
      // And a key of zero used to throw RangeError out of renderVisual, aborting the card before its bubbles.
      for (const each of [0, -2, 1.5]) {
        expect(() => renderVisual({ type: 'chart', kind: 'pictogram', rows, icon: '⭐', each }), `each=${each}`).not.toThrow();
        expect(perRow(renderVisual({ type: 'chart', kind: 'pictogram', rows, icon: '⭐', each }), /class="pic"/g)).toEqual([6, 4, 2]);
      }
    } finally {
      warn.mockRestore();
    }
  });

  // #137 item 3: the guard is `Number.isInteger(wanted) && wanted > 0 && rows.every(r => r.n % wanted === 0)`.
  // The test above already exercises `wanted > 0` (via 0 and -2) and the case where `every` matters least
  // (all three rows divide by 2 anyway). It never reaches a fixture where dropping `Number.isInteger` or
  // swapping `every` for `some` would actually change the output — both mutations stayed green under #137's
  // own review. These two do change under each mutation.
  it('a fractional key is refused even when it happens to divide every row evenly', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});   // the demotion trace is expected here
    try {
      // 3 % 1.5 === 0 and 6 % 1.5 === 0 in JS, so `rows.every(r => r.n % wanted === 0)` alone would call this
      // usable — only `Number.isInteger(wanted)` stops "1 ⭐ = 1.5 children" from being drawn.
      const rows = [{ label: 'a', n: 3 }, { label: 'b', n: 6 }];
      const h = renderVisual({ type: 'chart', kind: 'pictogram', rows, icon: '⭐', each: 1.5 });
      expect(perRow(h, /class="pic"/g), 'demoted to one symbol per child, not 2/4').toEqual([3, 6]);
      expect(h).not.toContain('class="key"');
    } finally {
      warn.mockRestore();
    }
  });

  it('one row failing to divide the key demotes every row, not just the one that fails', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});   // the demotion trace is expected here
    try {
      // rows.every(...): 6 % 2 === 0 but 7 % 2 !== 0, so the whole chart falls back to each=1 — a demotion
      // that is all-or-nothing across rows (the same rule item 4 in the issue names for the pictogram key
      // line). Swapping `every` for `some` would instead keep each=2 and draw 3 for the n:7 row — half a child.
      const rows = [{ label: 'a', n: 6 }, { label: 'b', n: 7 }];
      const h = renderVisual({ type: 'chart', kind: 'pictogram', rows, icon: '⭐', each: 2 });
      expect(perRow(h, /class="pic"/g), 'neither row is drawn at the requested key').toEqual([6, 7]);
      expect(h).not.toContain('class="key"');
    } finally {
      warn.mockRestore();
    }
  });

  it('a tally groups in fives, and the fifth mark is the gate stroke rather than a fifth upright', () => {
    const h = renderVisual({ type: 'chart', kind: 'tally', rows: [{ label: '🐶 dogs', n: 7 }] });
    expect(count(h, /class="tal five"/g)).toBe(1);             // one complete gate
    expect(h).toContain('<span class="tal five">||||</span>'); // four uprights; the stroke is drawn in CSS
    expect(h).toContain('<span class="tal">||</span>');        // and the remaining two
    expect(count(renderVisual({ type: 'chart', kind: 'tally', rows: [{ label: 'x', n: 10 }] }), /class="tal five"/g)).toBe(2);
    expect(renderVisual({ type: 'chart', kind: 'tally', rows: [{ label: 'x', n: 5 }] })).not.toContain('<span class="tal">');
  });

  it('a block diagram draws one block per child', () => {
    const h = renderVisual({ type: 'chart', kind: 'block', rows });
    expect(perRow(h, /class="blk"/g)).toEqual([6, 4, 2]);
    expect(count(h, /class="chart-row"/g)).toBe(3);
  });

  it('a tally draws each row its own marks, not the chart total', () => {
    const h = renderVisual({ type: 'chart', kind: 'tally', rows: [{ label: 'a', n: 7 }, { label: 'b', n: 3 }] });
    expect(perRow(h, /class="tal five"/g)).toEqual([1, 0]);
    expect(perRow(h, /class="tal"/g)).toEqual([1, 1]);
  });

  it('escapes the category label rather than trusting it as markup', () => {
    expect(renderVisual({ type: 'chart', kind: 'block', rows: [{ label: '<b>x</b>', n: 1 }] })).toContain('&lt;b&gt;');
  });

  // #137 item 4: `label` was escaped, `icon` was not, though both reach this template as unconstrained
  // strings on the same public `Visual`. `PICTO_SYMBOL` is the only `icon` any producer supplies today, so
  // this was never a live injection — the point is the asymmetry itself, which a test naming only the safe
  // field would certify rather than catch.
  it('escapes the pictogram icon too, in both the row and the key', () => {
    const rows = [{ label: 'a', n: 4 }, { label: 'b', n: 4 }];
    const h = renderVisual({ type: 'chart', kind: 'pictogram', rows, icon: '<i>x</i>', each: 2 });
    expect(h).not.toContain('<i>x</i>');
    expect(h).toContain('&lt;i&gt;x&lt;/i&gt;');
  });

  // `kind` is a three-way literal on `Visual` — no generator can produce anything else — but it is
  // interpolated raw into a class attribute the same way `icon` was, so a hand-edited or migrated blob that
  // slips past the type checker (the way #95's corrupted-save fixtures already do elsewhere in this file)
  // gets the same treatment rather than a silent hole. `as unknown as` here stands in for that corruption.
  it('escapes `kind` too, defensively, since it interpolates into a class attribute the same way `icon` does', () => {
    const rows = [{ label: 'a', n: 1 }];
    const bad = { type: 'chart', kind: '"><script>', rows } as unknown as Parameters<typeof renderVisual>[0];
    expect(renderVisual(bad)).not.toContain('<script>');
  });

  // #133 made `each` and `icon` required on the pictogram variant, so no generator can omit them — but the
  // type is not the runtime, and a migrated or hand-edited blob can. The fallbacks that used to serve the
  // optional fields are kept for exactly that, and this is what keeps them from being dead code.
  it('a pictogram blob that lost its key and symbol still draws one symbol per child rather than throwing', () => {
    const rows = [{ label: 'a', n: 3 }];
    const bare = { type: 'chart', kind: 'pictogram', rows } as unknown as Parameters<typeof renderVisual>[0];
    expect(() => renderVisual(bare)).not.toThrow();
    expect(perRow(renderVisual(bare), /class="pic"/g)).toEqual([3]);
    expect(renderVisual(bare)).not.toContain('class="key"');
  });

  // #137 item 2: `n` is just as unconstrained on the public `Visual` type as `each` (above), and reached the
  // same way with no try/catch between the generator and here. Before this fix: n=-3 threw a RangeError out
  // of Array.from/String.repeat, n=Infinity never terminated the tally loop (Math.floor(Infinity/5) is
  // Infinity), and n=1e9 tried to allocate that many DOM strings. Every one of the six must now render an
  // empty row instead — a wrong picture is bad, a crashed or frozen one is worse.
  it('n is defended the same way each is — no throw, no hang, no unbounded allocation, no fractional row (#137)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});   // every bad value here is meant to warn
    try {
      const bad = [-3, 0, 1.5, Infinity, -Infinity, NaN, 1e9];
      for (const kind of ['tally', 'pictogram', 'block'] as const) {
        for (const n of bad) {
          const rows = [{ label: 'x', n }];
          // Built per variant (#133): a key belongs to a pictogram only, and `{ kind: 'tally', each: 1 }` no
          // longer compiles.
          const v: Parameters<typeof renderVisual>[0] = kind === 'pictogram'
            ? { type: 'chart', kind, rows, icon: '⭐', each: 1 } : { type: 'chart', kind, rows };
          expect(() => renderVisual(v), `${kind} n=${n}`).not.toThrow();
        }
      }
      for (const n of [-3, 1.5, Infinity, -Infinity, NaN, 1e9]) {
        expect(perRow(renderVisual({ type: 'chart', kind: 'block', rows: [{ label: 'x', n }] }), /class="blk"/g), `n=${n}`)
          .toEqual([0]);
      }
    } finally {
      warn.mockRestore();
    }
  });

  it('an invalid row count warns; zero — a real "nobody chose this" count — does not (#137)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      renderVisual({ type: 'chart', kind: 'block', rows: [{ label: 'x', n: 0 }] });
      expect(warn, 'zero is a legitimate count, not something to sanitise away').not.toHaveBeenCalled();
      renderVisual({ type: 'chart', kind: 'block', rows: [{ label: 'y', n: -3 }] });
      expect(warn).toHaveBeenCalledTimes(1);
    } finally {
      warn.mockRestore();
    }
  });

  // #137 item 5: the demotion itself is correct (refusing loudly mid-mission is worse than a coarser but
  // honest picture) — it is the silence that was the bug. A trace must name what forced it, and it must not
  // fire for the ordinary case (each divides every row, or a tally/block that never reads `each` at all).
  it('a key demotion leaves a trace naming the key that failed; a tally/block chart never warns about one (#137)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      renderVisual({ type: 'chart', kind: 'pictogram', rows: [{ label: 'a', n: 7 }], icon: '⭐', each: 2 });
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0][0]).toContain('2');
      warn.mockClear();
      renderVisual({ type: 'chart', kind: 'pictogram', rows: [{ label: 'a', n: 6 }, { label: 'b', n: 4 }], icon: '⭐', each: 2 });
      expect(warn, 'every row divides by 2 — nothing to demote').not.toHaveBeenCalled();
      renderVisual({ type: 'chart', kind: 'tally', rows: [{ label: 'a', n: 7 }] });
      expect(warn, 'tally never reads each, so it has nothing to demote or warn about').not.toHaveBeenCalled();
      renderVisual({ type: 'chart', kind: 'block', rows: [{ label: 'a', n: 7 }] });
      expect(warn, 'block never reads each either').not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });
});
