import { readdirSync, readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { topicsFor, TOPICS } from '../../src/curriculum';
import { genericTopicSuite } from './helpers/generic-topic-suite';

// Year 3's per-topic structural loop (#1050), in a file of its own so it runs as a parallel worker.
genericTopicSuite(topicsFor('year3'));

describe('Year 3 registry (#1050)', () => {
  it('topicsFor("year3") holds y3-count', () => {
    expect(topicsFor('year3').map(t => t.id)).toContain('y3-count');
  });

  it('no topic runs the generic suite twice: Year 3 topics are not in the EYFS/KS1 sweep', () => {
    const y3 = new Set(topicsFor('year3').map(t => t.id));
    expect(TOPICS.filter(t => t.year !== 'year3' && y3.has(t.id))).toEqual([]);
  });

  // Import direction: year3-topics → year3-* → shared modules. No Year 3 file imports another year's file.
  it('no src/curriculum/year3-*.ts file imports another year’s module', () => {
    const dir = new URL('../../src/curriculum/', import.meta.url);
    const files = readdirSync(dir).filter(f => /^year3-.*\.ts$/.test(f));
    expect(files.length).toBeGreaterThanOrEqual(10);
    const other = /from\s+['"]\.\/(reception|year1|year2|year[4-6]-)[^'"]*['"]/;
    for (const f of files) expect(readFileSync(new URL(f, dir), 'utf8'), f).not.toMatch(other);
  });
});
