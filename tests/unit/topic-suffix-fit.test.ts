import { describe, it, expect } from 'vitest';
import { Y1_SUFFIX } from '../../src/curriculum/year1';
import { spokenGap } from '../../src/curriculum/spoken-gap';
import { SUFFIX2, SUFFIX2_REAL, y2Suffix } from '../../src/curriculum/year2/words';
const mk = (seed: number) => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };

// Hand-checked (#2272): the one ending that fits each y1-suffix sentence; every other of ing/ed/er/est makes it wrong.
const Y1_FITS: Record<string, string> = {
  'She is jump___ now.': 'ing', 'Yesterday he play___.': 'ed', 'I am walk___ to school.': 'ing', 'We look___ at the sky.': 'ed',
  'A car is fast___ than a bike.': 'er', 'It is the tall___ tree of all.': 'est', 'Dad is help___ me.': 'ing',
  'He kick___ the ball yesterday.': 'ed', 'Mia is kind___ than Sam.': 'er', 'It is the small___ mouse of all.': 'est',
};

describe('suffix games accept exactly one ending (#2272)', () => {
  it('y1-suffix: every item is in the hand-checked table with its answer', () => {
    expect(Y1_SUFFIX.map(i => i[2]).sort()).toEqual(Object.keys(Y1_FITS).sort());
    for (const [, suf, sent] of Y1_SUFFIX) expect(Y1_FITS[sent], sent).toBe(suf);
  });
  it('y2-suffix: no offered decoy makes a real word with the root', () => {
    expect(SUFFIX2.map(i => i[0]).sort()).toEqual(Object.keys(SUFFIX2_REAL).sort());
    for (const [root, suf] of SUFFIX2) expect(SUFFIX2_REAL[root]).toContain(suf);
    const rng = mk(7);
    for (let i = 0; i < 300; i++) for (const d of [1, 2, 3] as const) {
      const q = y2Suffix(d, rng), item = SUFFIX2.find(x => x[2] === (q.visual as { text: string }).text)!;
      for (const o of q.options.filter(o => o !== q.answer)) expect(SUFFIX2_REAL[item[0]], `${item[2]} ${o}`).not.toContain(o);
    }
  });
  it('the gap is spoken as a pause, never "blank"', () => {
    expect(spokenGap('It is the tall___ tree of all.')).toBe('It is the tall … tree of all.');
    expect(spokenGap('Yesterday he play___.')).toBe('Yesterday he play ….');
    expect(spokenGap('x___')).not.toContain('blank');
  });
});
