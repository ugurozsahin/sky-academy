import { readdirSync, readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { topicsFor, TOPICS, YEARS, shownYears } from '../../src/curriculum';
import { genericTopicSuite } from './helpers/generic-topic-suite';

// Year 4's per-topic structural loop (#1069), in a file of its own so it runs as a parallel worker.
genericTopicSuite(topicsFor('year4'));

describe('Year 4 registry (#1069)', () => {
  it('topicsFor("year4") holds y4-count', () => {
    expect(topicsFor('year4').map(t => t.id)).toContain('y4-count');
  });

  it('the YEARS row has no art and allows negative answers down to -50', () => {
    const y = YEARS.find(r => r.id === 'year4')!;
    expect(y.art).toBeUndefined();
    expect(y.minAnswer).toBe(-50);
    expect(y.maxAnswer).toBe(20000);
  });

  it('Year 4 is hidden from the map while it has one topic', () => {
    expect(shownYears().some(y => y.id === 'year4')).toBe(false);
  });

  it('no topic runs the generic suite twice: Year 4 topics are not in the EYFS/KS1 sweep', () => {
    const y4 = new Set(topicsFor('year4').map(t => t.id));
    expect(TOPICS.filter(t => t.year !== 'year4' && y4.has(t.id))).toEqual([]);
  });

  it('year4-topics.ts holds no topic rows, only strand concatenation', () => {
    const src = readFileSync(new URL('../../src/curriculum/year4-topics.ts', import.meta.url), 'utf8');
    expect(src).not.toMatch(/\bid:\s*'/);
  });

  // Import direction: year4-topics → year4-* → shared modules. No Year 4 file imports another year's file.
  it('no src/curriculum/year4-*.ts file imports another year’s module', () => {
    const dir = new URL('../../src/curriculum/', import.meta.url);
    const files = readdirSync(dir).filter(f => /^year4-.*\.ts$/.test(f));
    expect(files.length).toBeGreaterThanOrEqual(10);
    const other = /from\s+['"]\.\/(reception|year1|year2|year3|year[5-6]-)[^'"]*['"]/;
    for (const f of files) expect(readFileSync(new URL(f, dir), 'utf8'), f).not.toMatch(other);
  });
});
