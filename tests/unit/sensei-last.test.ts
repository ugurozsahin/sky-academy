import { describe, it, expect, beforeEach } from 'vitest';
import { senseiTopics } from '../../src/game/sensei';
import { topicsFor } from '../../src/curriculum';
import { load, recordAccuracy, reset, today } from '../../src/storage';

describe('recordAccuracy stamps the last-played day (#936)', () => {
  beforeEach(() => reset());
  it('stamps `last` with today, and writes nothing when tries is 0', () => {
    recordAccuracy('y1-add', { hits: 0, tries: 0 });
    expect(load().progress['y1-add']).toBeUndefined();
    recordAccuracy('y1-add', { hits: 1, tries: 2 });
    expect(load().progress['y1-add'].last).toBe(today());
  });
});

describe('senseiTopics brings back a stale starred topic (#936)', () => {
  const Y1 = topicsFor('year1');
  const now = new Date(2026, 9, 20);
  const weak = { 'y1-add': { stars: 1, best: 0, plays: 3, hits: 1, tries: 10 }, 'y1-sub': { stars: 1, best: 0, plays: 3, hits: 2, tries: 10 }, 'y1-bonds': { stars: 1, best: 0, plays: 3, hits: 3, tries: 10 } };
  it('includes a starred topic last played 20 days ago, and not without it', () => {
    const old = { ...weak, 'y1-coins': { stars: 2, best: 0, plays: 3, hits: 9, tries: 10, last: '2026-09-30' } };
    expect(senseiTopics(Y1, old, now).map(t => t.id)).toContain('y1-coins');
    expect(senseiTopics(Y1, weak, now).map(t => t.id)).toEqual(['y1-add', 'y1-sub', 'y1-bonds']);
  });
});
