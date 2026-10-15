import { describe, expect, it } from 'vitest';
import { SPEED_TITLES, speedTitle, titleRise } from '../../src/game/speed-titles';
import { speedCandidates } from '../../src/ui/play-facts';

describe('speed titles (#1175)', () => {
  it('maps the ladder at every edge', () => {
    const at = (s: number | undefined) => speedTitle(s).name;
    expect(at(undefined)).toBe('Trainee');
    expect(at(5.01)).toBe('Trainee');
    expect(at(5)).toBe('Apprentice');
    expect(at(4)).toBe('Swift');
    expect(at(3)).toBe('Sharp');
    expect(at(2)).toBe('Lightning');
    expect(at(1.5)).toBe('Tables Master');
    expect(at(0.9)).toBe('Tables Master');
  });
  it('reads a missing or non-finite best as Trainee', () => {
    expect(speedTitle(null).n).toBe(1);
    expect(speedTitle(NaN).n).toBe(1);
  });
  it('is monotonic: a smaller best never gives a lower title', () => {
    let last = 0;
    for (let s = 8; s >= 0.1; s -= 0.1) { const n = speedTitle(Math.round(s * 10) / 10).n; expect(n).toBeGreaterThanOrEqual(last); last = n; }
  });
  it('announces a rise once and nothing otherwise', () => {
    expect(titleRise(4.2, 3.9)).toBe('New tables title: Swift');
    expect(titleRise(undefined, 6)).toBeNull();
    expect(titleRise(undefined, 4.9)).toBe('New tables title: Apprentice');
    expect(titleRise(3.5, 3.2)).toBeNull();
    expect(titleRise(3, 4)).toBeNull();
  });
  it('uses no discouraging word', () => {
    for (const t of SPEED_TITLES) expect(t.name).not.toMatch(/wannabe|slow|beginner|only|still/i);
  });
  it('gives the results exactly one trophy line on a rise, and none without one', () => {
    const entries = Array.from({ length: 12 }, () => ({ fact: '7×8', outcome: 'correct' as const, ms: 2500 }));
    const ps = { facts: { entries: () => entries } } as any, mtc = { mode: 'mtc' as const }, done = { incomplete: false } as any;
    const rise = speedCandidates(ps, mtc, done, 4.2);
    expect(rise.filter(c => c.kind === 'trophy').map(c => c.text)).toEqual(['New tables title: Sharp']);
    expect(speedCandidates(ps, mtc, done, 2.4).filter(c => c.kind === 'trophy')).toEqual([]);
    expect(speedCandidates(ps, { mode: 'mission' }, done, 4.2)).toEqual([]);
  });
});
