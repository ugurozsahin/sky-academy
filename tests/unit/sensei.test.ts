import { describe, it, expect } from 'vitest';
import { accuracy, weakestTopics, TRAIN_TOPICS } from '../../src/game/sensei';
import { topicsFor } from '../../src/curriculum';
import type { TopicProgress } from '../../src/storage';

const Y1 = topicsFor('year1');
const p = (stars: number, plays: number, hits?: number, tries?: number): TopicProgress => ({ stars, best: 0, plays, hits, tries });

describe('Train with Sensei: weakest topics', () => {
  it('a new player gets the first playable topics, never tracing', () => {
    const w = weakestTopics(Y1, {});
    expect(w).toHaveLength(TRAIN_TOPICS);
    expect(w.map(t => t.id)).toEqual(Y1.filter(t => t.mode !== 'tracing').slice(0, 3).map(t => t.id));
    expect(w.every(t => t.mode !== 'tracing')).toBe(true);
  });
  it('ranks played topics by accuracy, then stars, then plays; unplayed topics fill the rest', () => {
    const progress = { 'y1-add': p(3, 4, 40, 40), 'y1-sub': p(1, 2, 5, 10), 'y1-bonds': p(2, 1, 9, 10), 'y1-coins': p(1, 1, 5, 10), 'y1-trace': p(0, 1, 0, 5) };
    const w = weakestTopics(Y1, progress).map(t => t.id);
    expect(w[0]).toBe('y1-coins');                        // 50 %, 1 star, 1 play  → weakest
    expect(w[1]).toBe('y1-sub');                          // 50 %, 1 star, 2 plays
    expect(w[2]).toBe('y1-bonds');                        // 90 %
    expect(weakestTopics(Y1, progress, 5).map(t => t.id)).toEqual(['y1-coins', 'y1-sub', 'y1-bonds', 'y1-add', Y1.find(t => t.mode !== 'tracing' && !progress[t.id as keyof typeof progress])!.id]);
  });
  it('old saves without tallies fall back to stars; unplayed topics have no accuracy', () => {
    expect(accuracy(undefined)).toBeNull();
    expect(accuracy(p(0, 0))).toBeNull();
    expect(accuracy(p(2, 3))).toBeCloseTo(2 / 3);
    expect(accuracy(p(3, 3, 1, 4))).toBe(0.25);           // real slices beat the star rating
    const w = weakestTopics(Y1, { 'y1-add': p(3, 1), 'y1-sub': p(1, 1) }).map(t => t.id);
    expect(w.slice(0, 2)).toEqual(['y1-sub', 'y1-add']);
  });
});
