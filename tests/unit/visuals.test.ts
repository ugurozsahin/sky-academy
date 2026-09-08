import { describe, expect, it } from 'vitest';
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
});

describe('clockSVG — hand angles (#43)', () => {
  it('at 3:00 the hour hand points right and the minute hand points up', () => {
    const h = clockSVG(3, 0);
    expect(h).toContain('x2="72.0"');                         // 50 + 22·sin(90°)
    expect(h).toContain('class="min"');
    expect(h).toContain('y2="18.0"');                         // 50 - 32·cos(0°)
  });
});
