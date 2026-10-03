import { describe, it, expect, vi } from 'vitest';
import { duelTopic } from '../../src/game/duel-topic';
import { topicById } from '../../src/curriculum';

describe('duelTopic (#956: a caller can name the duel topic)', () => {
  const pool = ['y1-add', 'y1-sub', 'y1-skip'].map(id => topicById(id)!);
  it('returns the chosen pool topic for every rng value', () => {
    for (const r of [0, 0.3, 0.99]) expect(duelTopic(pool, 'y1-sub', () => r).id).toBe('y1-sub');
  });
  it('unknown or screened-out ids warn and fall back to a pool topic', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    for (const id of ['nope', 'y1-letters']) expect(pool).toContain(duelTopic(pool, id, () => 0.5));
    expect(warn).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });
  it("no id gives today's random pick without warning", () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(duelTopic(pool, undefined, () => 0.5)).toBe(pool[Math.floor(0.5 * pool.length)]);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
