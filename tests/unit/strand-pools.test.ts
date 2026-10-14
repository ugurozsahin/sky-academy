import { describe, expect, it } from 'vitest';
import { topicsFor, YEARS, type Topic } from '../../src/curriculum';
import { MIN_STRAND_TOPICS, strandPools } from '../../src/game/strand-pools';

const t = (id: string, strand: Topic['strand'], extra: Partial<Topic> = {}): Topic => ({ ...(topicsFor('year3')[0]), id, strand, drill: undefined, input: undefined, ...extra } as Topic);

// #1072: a strand Boss draws from one strand's core topics only.
describe('strandPools (#1072)', () => {
  it('groups by strand and keeps the list order', () => {
    const pools = strandPools([t('a', 'fractions'), t('b', 'number'), t('c', 'fractions'), t('d', 'number'), t('e', 'fractions'), t('f', 'number')]);
    expect(pools.map(p => p.strand)).toEqual(['fractions', 'number']);
    expect(pools[0].topics.map(x => x.id)).toEqual(['a', 'c', 'e']);
  });
  it('drops strands with fewer than 3 topics', () => {
    expect(MIN_STRAND_TOPICS).toBe(3);
    expect(strandPools([t('a', 'calc'), t('b', 'calc')])).toEqual([]);
  });
  it('leaves out drills, tracing and topics with no strand', () => {
    const pools = strandPools([t('a', 'calc'), t('b', 'calc'), t('c', 'calc', { drill: true }), t('d', 'calc', { input: 'tracing' }), t('e', 'calc', { strand: undefined })]);
    expect(pools).toEqual([]);
  });
  it('every real pool has 3+ topics of one strand and no drills', () => {
    for (const y of YEARS) for (const p of strandPools(topicsFor(y.id))) {
      expect(p.topics.length).toBeGreaterThanOrEqual(3);
      expect(p.topics.every(x => x.strand === p.strand && !x.drill)).toBe(true);
    }
  });
  it('KS1 years offer no strand pool', () => {
    for (const id of ['reception', 'year1', 'year2'] as const) expect(strandPools(topicsFor(id))).toEqual([]);
  });
});
