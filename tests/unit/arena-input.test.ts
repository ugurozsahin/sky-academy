import { describe, expect, it } from 'vitest';
import { advanceStroke, slicedBy } from '../../src/game/slicing';
import { markOutcome, ghostX } from '../../src/game/arena-step';
import type { Bubble } from '../../src/game/bubbles';

const bub = (o: Partial<Bubble>) => ({ label: '', x: 0, y: 0, r: 20, launched: true, hit: false, dead: false, ...o }) as Bubble;

describe('advanceStroke / slicedBy (#1433)', () => {
  it('ignores a jitter under 2px but still counts it, and moves the stroke otherwise', () => {
    const s = { lastPt: { x: 0, y: 0 }, moved: 0, stale: false };
    expect(advanceStroke(s, { x: 1, y: 0 })).toBe(false);
    expect(s.lastPt).toEqual({ x: 0, y: 0 });
    expect(advanceStroke(s, { x: 30, y: 40 })).toBe(true);
    expect(s.lastPt).toEqual({ x: 30, y: 40 });
    expect(s.moved).toBeCloseTo(51);
  });
  it('yields only launched, live, unhit bubbles on the segment', () => {
    const on = bub({ label: 'on' });
    const bs = [on, bub({ label: 'hit', hit: true }), bub({ label: 'dead', dead: true }), bub({ label: 'queued', launched: false }), bub({ label: 'far', y: 90 })];
    expect([...slicedBy(bs, { x: -50, y: 0 }, { x: 50, y: 0 })]).toEqual([on]);
  });
});

describe('markOutcome / ghostX (#1433)', () => {
  it('marks the first right answer and the hit wrong one, fades the rest, kills queued bubbles', () => {
    const good = bub({ label: '5' }), twin = bub({ label: '5' }), bad = bub({ label: '7', hit: true }), other = bub({ label: '9' }), queued = bub({ label: '3', launched: false });
    expect(markOutcome([good, twin, bad, other, queued], { good: '5', bad: '7' }, 100)).toBe(true);
    expect([good.mark, bad.mark, twin.fade, other.fade, queued.dead]).toEqual(['good', 'bad', true, true, true]);
    expect(good.markAt).toBe(100);
  });
  it('reports a right answer that is not on screen', () => {
    expect(markOutcome([bub({ label: '1' })], { good: '2' }, 0)).toBe(false);
  });
  it('centres the ghost, or steps aside from a ✗ bubble sitting under it', () => {
    expect(ghostX(400, 30, undefined, 100)).toBe(200);
    expect(ghostX(400, 30, bub({ x: 400 - 100, y: 100 }), 100)).toBe(200);
    expect(ghostX(400, 30, bub({ x: 190, y: 100 }), 100)).toBe(190 + 72);
    expect(ghostX(400, 30, bub({ x: 210, y: 100 }), 100)).toBe(210 - 72);
  });
});
