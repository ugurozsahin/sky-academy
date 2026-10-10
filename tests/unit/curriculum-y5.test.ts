import { readdirSync, readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { topicsFor, TOPICS, YEARS, shownYears } from '../../src/curriculum';
import { genericTopicSuite } from './helpers/generic-topic-suite';

// Year 5's per-topic structural loop (#1177), in a file of its own so it runs as a parallel worker.
genericTopicSuite(topicsFor('year5'));

describe('Year 5 registry (#1177)', () => {
  it('topicsFor("year5") holds y5-round', () => {
    expect(topicsFor('year5').map(t => t.id)).toContain('y5-round');
  });

  it('the YEARS row has no art and allows negative answers down to -100', () => {
    const y = YEARS.find(r => r.id === 'year5')!;
    expect(y.art).toBeUndefined();
    expect(y.minAnswer).toBe(-100);
    expect(y.maxAnswer).toBe(1000000);
    expect([y.perStage, y.lives]).toEqual([7, 3]);
  });

  it('Year 5 reaches the map once it has 12 maths and 6 writing topics (#1224 is the sixth writing topic)', () => {
    expect(shownYears().some(y => y.id === 'year5')).toBe(true);
  });

  it('no topic runs the generic suite twice: Year 5 topics are not in the EYFS/KS1 sweep', () => {
    const y5 = new Set(topicsFor('year5').map(t => t.id));
    expect(TOPICS.filter(t => t.year !== 'year5' && y5.has(t.id))).toEqual([]);
  });

  it('year5-topics.ts holds no topic rows, only strand concatenation', () => {
    const src = readFileSync(new URL('../../src/curriculum/year5-topics.ts', import.meta.url), 'utf8');
    expect(src).not.toMatch(/\bid:\s*'/);
  });

  it('the nine strand modules exist', () => {
    const dir = readdirSync(new URL('../../src/curriculum/', import.meta.url));
    for (const s of ['number', 'calc', 'fractions', 'measure', 'geometry', 'stats', 'reading', 'spelling', 'grammar']) expect(dir).toContain(`year5-${s}.ts`);
  });

  // Import direction: year5-topics → year5-* → shared modules. No Year 5 file imports another year's file.
  it('no src/curriculum/year5-*.ts file imports another year’s module', () => {
    const dir = new URL('../../src/curriculum/', import.meta.url);
    const files = readdirSync(dir).filter(f => /^year5-.*\.ts$/.test(f));
    expect(files.length).toBeGreaterThanOrEqual(10);
    const other = /from\s+['"]\.\/(reception|year1|year2|year3|year4|year6-)[^'"]*['"]/;
    for (const f of files) expect(readFileSync(new URL(f, dir), 'utf8'), f).not.toMatch(other);
  });
});
