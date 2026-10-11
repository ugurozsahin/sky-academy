import { describe, expect, it } from 'vitest';
import { sats56Block, tablesBlock, weeksTo } from '../../src/game/readiness';
import { readyHTML } from '../../src/ui/parents-ready';
import { DEFAULT } from '../../src/storage/shape';
import { listedTopics } from '../../src/curriculum';
import type { Ks2Fact } from '../../src/save-records';

const chk = (score: number) => ({ date: '2026-09-01', score, missed: [] });
const fact = (right: number, wrong = 0, slow = 0): Ks2Fact => ({ right, wrong, slow });
const FORBIDDEN = /predict|expected standard|on track|\bpass|\bfail|behind/i;

describe('tablesBlock (#1286)', () => {
  it('shows the last five scores oldest first', () => {
    const checks = [22, 19, 16, 15, 14, 13, 12].map(chk);   // newest first, as stored
    expect(tablesBlock(checks, {}).scores).toEqual([14, 15, 16, 19, 22]);
  });
  it('ranks the weakest tables, needs five answers, and breaks ties by the smaller table', () => {
    const facts = { '7×8': fact(1, 4), '3×4': fact(2, 3), '2×2': fact(1, 2), '6×6': fact(5), '9×9': fact(2, 0, 3) };
    // 7: 1/5, 8: 1/5, 3: 2/5, 4: 2/5, 9: 2/5, 6: 5/5, 2: only 3 answers (left out)
    expect(tablesBlock([], facts).weakTables).toEqual([7, 8, 3]);
  });
  it('ignores tables outside 2–12', () => {
    expect(tablesBlock([], { '1×5': fact(0, 9), '13×2': fact(0, 9) }).weakTables).toEqual([2, 5]);   // only the 2 and the 5 count
  });
});

describe('sats56Block (#1286)', () => {
  const topics = listedTopics().filter(t => t.strand && (t.year === 'year5' || t.year === 'year6'));
  it('ranks Year 5–6 strands by share right, and skips strands under five tries', () => {
    const [a] = topics, other = topics.find(t => t.strand !== a.strand)!;
    const out = sats56Block({ [a.id]: { stars: 0, plays: 1, best: 0, hits: 6, tries: 10 }, [other.id]: { stars: 0, plays: 1, best: 0, hits: 0, tries: 4 } }, topics);
    expect(out).toEqual([{ strand: a.strand, pct: 60 }]);
  });
  it('is empty with no play', () => expect(sats56Block({}, topics)).toEqual([]));
});

describe('weeksTo (#1286)', () => {
  it.each([[0, 0], [1, 1], [7, 1], [8, 2], [20, 3]])('%i days ahead is %i weeks', (days, w) => {
    const d = new Date(Date.UTC(2026, 9, 11 + days, 12)).toISOString().slice(0, 10);
    expect(weeksTo(d, '2026-10-11')).toBe(w);
  });
  it('is null for a past, missing or malformed date', () => {
    expect(weeksTo('2026-10-10', '2026-10-11')).toBeNull();
    expect(weeksTo(undefined, '2026-10-11')).toBeNull();
    expect(weeksTo('1 May', '2026-10-11')).toBeNull();
  });
});

describe('readyHTML (#1286)', () => {
  const save = (ks2: object) => ({ ...DEFAULT, ks2: { ...DEFAULT.ks2, ...ks2 } });
  it('is absent with no data and no Year 4 or Year 6', () => expect(readyHTML(save({}), '2026-10-11')).toBe(''));
  it('shows the trend, the date field and the weeks for a Year 4 child', () => {
    const html = readyHTML(save({ schoolYear: 'year4', checks: [chk(22), chk(19), chk(16)], checkDate: '2026-11-01' }), '2026-10-11');
    expect(html).toContain('16 → 19 → 22 out of 25');
    expect(html).toContain('type="date"');
    expect(html).toContain('3 weeks to go');
  });
  it('shows for Year 6 and points at Arithmetic practice', () => expect(readyHTML(save({ schoolYear: 'year6' }), '2026-10-11')).toContain('Arithmetic practice, Year 6 island'));
  it('uses no prediction or pass/fail word in any state', () => {
    for (const ks2 of [{ schoolYear: 'year4' }, { schoolYear: 'year6', checks: [chk(3)], facts: { '7×8': fact(0, 9) }, checkDate: '2026-12-01' }])
      expect(readyHTML(save(ks2), '2026-10-11')).not.toMatch(FORBIDDEN);
  });
});
