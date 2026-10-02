import { describe, it, expect } from 'vitest';
import { accuracy, weakestTopics, TRAIN_TOPICS, poolWeights, weightedPick } from '../../src/game/sensei';
import { seededRng } from '../../src/game/rng';
import { topicsFor } from '../../src/curriculum';
import type { TopicProgress } from '../../src/storage';

const Y1 = topicsFor('year1');
const p = (stars: number, plays: number, hits?: number, tries?: number): TopicProgress => ({ stars, best: 0, plays, hits, tries });

describe('Train with Sensei: weakest topics', () => {
  it('a new player gets the first playable topics, never tracing', () => {
    const w = weakestTopics(Y1, {});
    expect(w).toHaveLength(TRAIN_TOPICS);
    expect(w.map(t => t.id)).toEqual(Y1.filter(t => t.input !== 'tracing').slice(0, 3).map(t => t.id));
    expect(w.every(t => t.input !== 'tracing')).toBe(true);
  });
  it('ranks played topics by accuracy, then stars, then plays; unplayed topics fill the rest', () => {
    const progress = { 'y1-add': p(3, 4, 40, 40), 'y1-sub': p(1, 2, 5, 10), 'y1-bonds': p(2, 1, 9, 10), 'y1-coins': p(1, 1, 5, 10), 'y1-trace': p(0, 1, 0, 5) };
    const w = weakestTopics(Y1, progress).map(t => t.id);
    expect(w[0]).toBe('y1-coins');                        // 50 %, 1 star, 1 play  → weakest
    expect(w[1]).toBe('y1-sub');                          // 50 %, 1 star, 2 plays
    expect(w[2]).toBe('y1-bonds');                        // 90 %
    expect(weakestTopics(Y1, progress, 5).map(t => t.id)).toEqual(['y1-coins', 'y1-sub', 'y1-bonds', 'y1-add', Y1.find(t => t.input !== 'tracing' && !progress[t.id as keyof typeof progress])!.id]);
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

describe('mixed-pool weighting (#909)', () => {
  const pool = Y1.filter(t => t.input !== 'tracing').slice(0, 6);
  const draws = (w: number[], n = 10000) => {
    const rng = seededRng(7), c = new Map<string, number>();
    for (let i = 0; i < n; i++) { const t = weightedPick(pool, w, rng); c.set(t.id, (c.get(t.id) ?? 0) + 1); }
    return c;
  };

  it('a 50 %-accuracy topic is drawn about twice as often as a 100 % one', () => {
    const prog: Record<string, TopicProgress> = {};
    pool.forEach(t => { prog[t.id] = p(3, 4, 10, 10); });
    prog[pool[0].id] = p(1, 4, 5, 10);
    const c = draws(poolWeights(pool, prog));
    const ratio = c.get(pool[0].id)! / c.get(pool[1].id)!;
    expect(ratio).toBeGreaterThan(1.8); expect(ratio).toBeLessThan(2.2);
  });

  it('unplayed topics together take 20 % ± 2 % of the draws when some exist', () => {
    const prog: Record<string, TopicProgress> = {};
    pool.slice(0, 3).forEach((t, i) => { prog[t.id] = p(2, 3, 5 + i, 10); });
    const c = draws(poolWeights(pool, prog));
    const unplayed = pool.slice(3).reduce((s, t) => s + (c.get(t.id) ?? 0), 0) / 10000;
    expect(unplayed).toBeGreaterThan(0.18); expect(unplayed).toBeLessThan(0.22);
  });

  it('with fewer than three played topics the draw is uniform', () => {
    const w = poolWeights(pool, { [pool[0].id]: p(1, 2, 1, 10), [pool[1].id]: p(1, 2, 1, 10) });
    expect(w).toEqual(pool.map(() => 1));
    for (const n of draws(w).values()) expect(Math.abs(n / 10000 - 1 / 6)).toBeLessThan(0.02);
  });

  it('every topic played means no unplayed share, and the same seed gives the same sequence', () => {
    const prog: Record<string, TopicProgress> = {};
    pool.forEach(t => { prog[t.id] = p(2, 3, 7, 10); });
    const w = poolWeights(pool, prog);
    expect(w.every(x => Math.abs(x - 1.6) < 1e-9)).toBe(true);
    const run = () => { const r = seededRng(3); return Array.from({ length: 30 }, () => weightedPick(pool, w, r).id); };
    expect(run()).toEqual(run());
  });

  it('missing or mismatched weights fall back to a uniform pick', () => {
    expect(weightedPick(pool, undefined, () => 0)).toBe(pool[0]);
    expect(weightedPick(pool, [1, 2], () => 0.99)).toBe(pool[5]);
  });
});
