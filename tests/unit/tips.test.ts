import { describe, expect, it } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import { TIPS, tipFor } from '../../src/game/tips';
import { topicRow } from '../../src/ui/parents-trophies';
import type { TopicStat } from '../../src/game/parents';

describe('help-at-home tips (#941)', () => {
  const used = new Set(TOPICS.map(t => tipFor(t.id)).filter((x): x is string => !!x));
  it('every tip is used by at least one registered topic (no dead tips)', () => {
    for (const [family, tip] of Object.entries(TIPS)) expect(used.has(tip), family).toBe(true);
  });
  it('at least 78 registered topics resolve to a tip, and most of them do', () => {
    const n = TOPICS.filter(t => tipFor(t.id)).length;
    expect(n).toBeGreaterThanOrEqual(78);
    expect(n / TOPICS.length).toBeGreaterThan(0.9);
  });
  it('each tip is one sentence of at most 120 characters ending in a full stop', () => {
    for (const [family, tip] of Object.entries(TIPS)) {
      expect(tip.length, family).toBeLessThanOrEqual(120);
      expect(tip.endsWith('.'), family).toBe(true);
    }
  });
  it('a year prefix folds away and a topic sharing a stem shares the tip; an unknown topic gets none', () => {
    expect(tipFor('y1-bonds')).toBe(tipFor('r-bonds'));
    expect(tipFor('y1-bonds-10')).toBe(tipFor('y1-bonds'));
    expect(tipFor('y3-tables-8')).toBe(tipFor('y2-tables'));
    expect(tipFor('y9-nothing')).toBeNull();
  });
  it('only the Where to help row shows "Try at home"', () => {
    const s = { id: 'y1-bonds', title: 'Bonds', icon: '🔟', year: 'y1', subject: 'maths', stars: 1, plays: 2, hits: 3, tries: 4, accuracy: 0.5, nc: 'nc' } as unknown as TopicStat;
    expect(topicRow(s, true)).toContain('Try at home: Lay out 10 spoons');
    expect(topicRow(s)).not.toContain('Try at home');
    expect(topicRow({ ...s, id: 'y9-nothing' }, true)).not.toContain('Try at home');
  });
});
