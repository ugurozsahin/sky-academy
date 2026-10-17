import { readdirSync, readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { TOPICS, YEARS } from '../../src/curriculum';
import { isKs2 } from '../../src/curriculum/key-stage';
import { NO_REPEATED_SET } from './helpers/topic-lists';

// #1467 (a follow-up of #1050): the generic per-topic suite runs once for EYFS/KS1 in `curriculum.test.ts` and
// once per KS2 year in `curriculum-yN.test.ts`. Nothing failed if a KS2 year's file were missing or its call
// were repeated, so a future `year4` topic could have run no structural loop at all.
describe('the generic topic suite covers every topic exactly once (#1467)', () => {
  const dir = new URL('./', import.meta.url);
  const calls = readdirSync(dir).filter(f => f.endsWith('.test.ts'))
    .flatMap(f => [...readFileSync(new URL(f, dir), 'utf8').matchAll(/^genericTopicSuite\((.+)\);/gm)].map(m => m[1]));
  const ks2Years = YEARS.filter(y => isKs2(y.id));

  it('is called once for EYFS/KS1 and once per KS2 year, and nowhere else', () => {
    const expected = ['TOPICS.filter(t => !isKs2(t.year))', ...ks2Years.map(y => `TOPICS.filter(t => t.year === '${y.id}')`)];
    expect(calls.sort()).toEqual(expected.sort());
  });

  it('every topic belongs to a year in YEARS, so one of those calls reaches it', () => {
    const years = new Set(YEARS.map(y => y.id));
    expect(TOPICS.filter(t => !years.has(t.year)).map(t => t.id)).toEqual([]);
    const reached = [...TOPICS.filter(t => !isKs2(t.year)), ...ks2Years.flatMap(y => TOPICS.filter(t => t.year === y.id))].map(t => t.id);
    expect(reached.sort()).toEqual(TOPICS.map(t => t.id).sort());
  });
});

// The blind-list bookkeeping in `curriculum.test.ts` skips KS2 topics (#1050), so an entry for one is enforced
// in neither direction: it can neither go stale nor be missing, and reads as protection it does not give.
describe('NO_REPEATED_SET holds only cells the bookkeeping checks (#1467)', () => {
  it('every entry names a difficulty of an EYFS/KS1 topic', () => {
    const ids = new Set(TOPICS.filter(t => !isKs2(t.year)).map(t => t.id.replace(/^y2-tables-\d+/, 'y2-tables')));
    const bad = [...NO_REPEATED_SET].filter(cell => {
      const m = /^(.+) d([123])$/.exec(cell);
      return !m || !ids.has(m[1]);
    });
    expect(bad).toEqual([]);
  });
});
