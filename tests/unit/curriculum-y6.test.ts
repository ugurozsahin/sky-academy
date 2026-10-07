import { readdirSync, readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { topicsFor, TOPICS, YEARS, shownYears } from '../../src/curriculum';
import { genericTopicSuite } from './helpers/generic-topic-suite';

// Year 6's per-topic structural loop (#1212), in a file of its own so it runs as a parallel worker.
genericTopicSuite(topicsFor('year6'));

describe('Year 6 registry (#1212)', () => {
  it('topicsFor("year6") holds y6-round', () => {
    expect(topicsFor('year6').map(t => t.id)).toContain('y6-round');
  });

  it('the YEARS row has no art and allows negative answers down to -1,000', () => {
    const y = YEARS.find(r => r.id === 'year6')!;
    expect(y.art).toBeUndefined();
    expect(y.minAnswer).toBe(-1000);
    expect(y.maxAnswer).toBe(10000000);
    expect([y.perStage, y.lives]).toEqual([7, 3]);
  });

  it('Year 6 stays off the map until it has enough topics', () => {
    expect(shownYears().some(y => y.id === 'year6')).toBe(false);
  });

  it('no topic runs the generic suite twice: Year 6 topics are not in the EYFS/KS1 sweep', () => {
    const y6 = new Set(topicsFor('year6').map(t => t.id));
    expect(TOPICS.filter(t => t.year !== 'year6' && y6.has(t.id))).toEqual([]);
  });

  it('year6-topics.ts holds no topic rows, only strand concatenation', () => {
    const src = readFileSync(new URL('../../src/curriculum/year6-topics.ts', import.meta.url), 'utf8');
    expect(src).not.toMatch(/\bid:\s*'/);
  });

  it('the eleven strand modules exist, ratio and algebra among them', () => {
    const dir = readdirSync(new URL('../../src/curriculum/', import.meta.url));
    for (const s of ['number', 'calc', 'fractions', 'ratio', 'algebra', 'measure', 'geometry', 'stats', 'reading', 'spelling', 'grammar']) expect(dir).toContain(`year6-${s}.ts`);
  });

  // Import direction: year6-topics → year6-* → shared modules. No Year 6 file imports another year's file.
  it('no src/curriculum/year6-*.ts file imports another year’s module', () => {
    const dir = new URL('../../src/curriculum/', import.meta.url);
    const files = readdirSync(dir).filter(f => /^year6-.*\.ts$/.test(f));
    expect(files.length).toBeGreaterThanOrEqual(12);
    const other = /from\s+['"]\.\/(reception|year1|year2|year3|year4|year5)[^'"]*['"]/;
    for (const f of files) expect(readFileSync(new URL(f, dir), 'utf8'), f).not.toMatch(other);
  });
});
