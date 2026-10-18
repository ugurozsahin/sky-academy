// Content map rail (#2031, subsumes #669): docs/content-map.json and docs/CONTENT-MAP.md are generated from the
// registry by scripts/content-map.mjs, so they cannot say anything the code does not. This file regenerates them
// in memory and fails on drift, and holds docs/CURRICULUM.md to the registry in both directions.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { TOPICS, YEARS } from '../../src/curriculum';
import { R_STORIES } from '../../src/curriculum/stories-r';
import { Y1_STORIES } from '../../src/curriculum/stories-y1';
import { tipFor } from '../../src/game/tips';
import { buildContentMap, curriculumIds, strandsOf, type StrandTable } from '../../scripts/content-map-lib.mjs';

const read = (p: string) => readFileSync(p, 'utf8');
const strands: StrandTable = JSON.parse(read('docs/content-map-strands.json'));
const banks = { 'r-storytime': R_STORIES.length, 'y1-storytime': Y1_STORIES.length };
const input = { topics: TOPICS, years: YEARS, strands, tipFor, banks };
const built = buildContentMap(input);
const REGEN = 'run `npm run content-map` and commit docs/content-map.json and docs/CONTENT-MAP.md';

describe('content map is generated, never hand-kept', () => {
  it('docs/content-map.json equals the registry', () => { expect(read('docs/content-map.json'), REGEN).toBe(built.json); });
  it('docs/CONTENT-MAP.md equals the registry', () => { expect(read('docs/CONTENT-MAP.md'), REGEN).toBe(built.md); });
  it('every registry topic appears exactly once, with a non-empty nc', () => {
    const map = JSON.parse(built.json);
    expect(map.topics.map((t: { id: string }) => t.id)).toEqual(TOPICS.map(t => t.id));
    expect(new Set(map.topics.map((t: { id: string }) => t.id)).size).toBe(TOPICS.length);
    for (const t of TOPICS) expect(t.nc.trim(), t.id).not.toBe('');
  });
  it('the counts come from the registry, not from the file', () => {
    const map = JSON.parse(read('docs/content-map.json'));
    expect(map.topicCount).toBe(TOPICS.length);
    for (const y of YEARS) {
      const row = map.byYear.find((r: { year: string }) => r.year === y.id);
      expect(row.maths, y.id).toBe(TOPICS.filter(t => t.year === y.id && t.subject === 'maths').length);
      expect(row.writing, y.id).toBe(TOPICS.filter(t => t.year === y.id && t.subject === 'writing').length);
    }
  });
});

describe('strand coverage is honest', () => {
  it('every topic matches at least one programme-of-study strand of its own year', () => {
    for (const t of TOPICS) expect(strandsOf(t, strands).length, `${t.id}: ${t.nc}`).toBeGreaterThan(0);
  });
  it('the generator fails on a topic whose nc matches no strand', () => {
    const odd = { ...TOPICS[0], id: 'r-odd', nc: 'Nothing the curriculum names' };
    expect(() => buildContentMap({ ...input, topics: [...TOPICS, odd] })).toThrow(/r-odd/);
  });
  it('a strand no topic names is listed as not covered, and one that has a topic is not', () => {
    const gapTable = { ...strands, strands: [...strands.strands, { id: 'x', subject: 'maths' as const, years: ['year1'], source: 'maths', name: 'Gap strand', re: 'NoSuchText' }] };
    const gapMd = buildContentMap({ ...input, strands: gapTable }).md;
    const notCovered = gapMd.slice(gapMd.indexOf('### Not covered yet'), gapMd.indexOf('### Covered'));
    expect(notCovered).toContain('Gap strand');
    expect(notCovered).not.toContain('Year 1 Number: addition and subtraction');
  });
  it('every strand row names a source the table defines', () => {
    for (const s of strands.strands) expect(strands.sources[s.source], s.id).toMatch(/^https:\/\/www\.gov\.uk\//);
  });
});

describe('docs/CURRICULUM.md and the registry agree both ways (#669)', () => {
  const ids = curriculumIds(read('docs/CURRICULUM.md'));
  it('every registry topic has a row in CURRICULUM.md', () => {
    const rows = new Set(ids);
    expect(TOPICS.filter(t => !rows.has(t.id)).map(t => t.id), 'topics with no row').toEqual([]);
  });
  it('every CURRICULUM.md row is a registry topic', () => {
    const known = new Set(TOPICS.map(t => t.id));
    expect(ids.filter(id => !known.has(id)), 'rows for a topic that does not exist').toEqual([]);
  });
  it('no topic has two rows', () => {
    expect(ids.filter((id, i) => ids.indexOf(id) !== i), 'duplicate rows').toEqual([]);
  });
});
