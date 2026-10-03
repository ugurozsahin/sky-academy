import { describe, it, expect, vi } from 'vitest';
import { duelTopic } from '../../src/game/duel-topic';
import { topicById, topicsFor } from '../../src/curriculum';
import { duelPool } from '../../src/game/duel';

describe('duelTopic (#956: a caller can name the duel topic)', () => {
  const pool = ['y1-add', 'y1-sub', 'y1-skip'].map(id => topicById(id)!);
  it('returns the chosen pool topic for every rng value', () => {
    for (const r of [0, 0.3, 0.99]) expect(duelTopic(pool, 'y1-sub', () => r).id).toBe('y1-sub');
  });
  it('unknown ids warn and fall back to a pool topic', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(pool).toContain(duelTopic(pool, 'nope', () => 0.5));
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
  it('a topic duelPool screens out (tracing, sequence) never reaches a match: it warns and falls back', () => {
    const all = topicsFor('year1'), real = duelPool(all, 1);
    const screened = [all.find(t => t.input === 'tracing'), topicById('y1-order')].map(t => t!);   // y1-order: sequenceFrom 1
    for (const t of screened) {
      expect(t, 'fixture topic exists').toBeDefined();
      expect(real).not.toContain(t);
    }
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    for (const t of screened) expect(real).toContain(duelTopic(real, t.id, () => 0.5));
    expect(warn).toHaveBeenCalledTimes(screened.length);
    warn.mockRestore();
  });
  it("no id gives today's random pick without warning", () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(duelTopic(pool, undefined, () => 0.5)).toBe(pool[Math.floor(0.5 * pool.length)]);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
