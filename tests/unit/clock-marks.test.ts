import { describe, it, expect } from 'vitest';
import { clockSVG, renderVisual } from '../../src/ui/visuals';

describe('clockSVG — minute marks (#2278)', () => {
  it('a face drawn with marks has sixty ticks, the same hands and numerals; one without has none', () => {
    const on = clockSVG(7, 4, true), off = clockSVG(7, 4);
    expect(on.match(/class="tick"/g)).toHaveLength(60);
    expect(off).not.toContain('tick');
    const rest = (x: string) => x.replace(/<g [^>]*>(<line [^>]*class="tick"\/>)+<\/g>/, '');
    expect(rest(on)).toBe(off);
    expect(renderVisual({ type: 'clock', h: 7, m: 4, marks: true })).toBe(`<div class="vis">${on}</div>`);
  });
});
