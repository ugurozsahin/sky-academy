import { describe, it, expect, beforeEach } from 'vitest';
import { load, recordSprint, recordTopic, recordTopicSprint, reset } from '../../src/storage';
import { familyBest, familyBestLine } from '../../src/family-best';

const mem: Record<string, string> = {};
(globalThis as any).localStorage = { getItem: (k: string) => mem[k] ?? null, setItem: (k: string, v: string) => { mem[k] = v; }, removeItem: (k: string) => { delete mem[k]; }, clear: () => { for (const k in mem) delete mem[k]; } };

describe('recordTopicSprint (#911)', () => {
  beforeEach(() => reset());

  it('stores the first positive score and reports a new best', () => {
    expect(recordTopicSprint('y1-bonds', 7)).toBe(true);
    expect(load().progress['y1-bonds'].sprint).toBe(7);
  });
  it('keeps the best: a lower or equal score changes nothing and is not a new best', () => {
    recordTopicSprint('y1-bonds', 7);
    expect(recordTopicSprint('y1-bonds', 5)).toBe(false);
    expect(recordTopicSprint('y1-bonds', 7)).toBe(false);
    expect(load().progress['y1-bonds'].sprint).toBe(7);
    expect(recordTopicSprint('y1-bonds', 9)).toBe(true);
    expect(load().progress['y1-bonds'].sprint).toBe(9);
  });
  it('never records a score of 0', () => {
    expect(recordTopicSprint('y1-bonds', 0)).toBe(false);
    expect(load().progress['y1-bonds']).toBeUndefined();
  });
  it('leaves plays, stars and best alone, on a fresh topic and on a played one', () => {
    recordTopicSprint('y1-bonds', 4);
    expect(load().progress['y1-bonds']).toMatchObject({ stars: 0, best: 0, plays: 0, sprint: 4 });
    recordTopic('y1-count', 3, 120);
    recordTopicSprint('y1-count', 6);
    expect(load().progress['y1-count']).toMatchObject({ stars: 3, best: 120, plays: 1, sprint: 6 });
  });
  it('never touches the year\'s Sprint best, and is independent of it', () => {
    recordSprint('year1', 50);
    const before = JSON.stringify(load().sprint);
    recordTopicSprint('y1-bonds', 99);
    expect(JSON.stringify(load().sprint)).toBe(before);
    expect(recordSprint('year1', 60)).toBe(true);
    expect(load().progress['y1-bonds'].sprint).toBe(99);
  });
  it('keeps one topic\'s best apart from another\'s', () => {
    recordTopicSprint('y1-bonds', 8);
    recordTopicSprint('y1-count', 3);
    expect(load().progress['y1-bonds'].sprint).toBe(8);
    expect(load().progress['y1-count'].sprint).toBe(3);
  });
  it('survives a later mission on the same topic (recordTopic keeps the other fields)', () => {
    recordTopicSprint('y1-bonds', 6);
    recordTopic('y1-bonds', 2, 90);
    expect(load().progress['y1-bonds']).toMatchObject({ stars: 2, best: 90, plays: 1, sprint: 6 });
  });
  it('refuses NaN, fractions and infinities', () => {
    for (const bad of [NaN, 2.5, Infinity, -3]) expect(recordTopicSprint('y1-bonds', bad)).toBe(false);
    expect(load().progress['y1-bonds']).toBeUndefined();
  });
});

describe('familyBest (#1293)', () => {
  const put = (id: string, v: unknown) => { mem[id] = typeof v === 'string' ? v : JSON.stringify(v); };
  const save = (name: string, sprint?: number, v = 6) => ({ v, name, progress: sprint === undefined ? {} : { 'y2-tables': { stars: 0, best: 0, plays: 0, sprint } } });
  beforeEach(() => { for (const k in mem) delete mem[k]; });

  it('picks the highest sibling best, ties to the lowest slot, skipping the active, empty, future and corrupt slots', () => {
    put('sna:profiles', { v: 1, active: 'p1', ids: ['p1', 'p2', 'p3', 'p4'] });
    put('sna:v1', save('Ada', 99));                 // the active profile: never read
    put('sna:v1:p2', save('Bo', 7));
    put('sna:v1:p3', save('Cy', 7));                // ties with Bo: the lower slot wins
    put('sna:v1:p4', save('Di', 50, 99));           // a newer build's save: skipped
    expect(familyBest('y2-tables', 'p1')).toEqual({ name: 'Bo', best: 7 });
    put('sna:v1:p4', '{not json');
    expect(familyBest('y2-tables', 'p1')).toEqual({ name: 'Bo', best: 7 });
    expect(familyBest('y2-other', 'p1')).toBeNull();
  });
  it('ignores bests below 1 and names an unnamed sibling by slot', () => {
    put('sna:profiles', { v: 1, active: 'p1', ids: ['p1', 'p2', 'p3'] });
    put('sna:v1:p2', save('Bo', 0));
    put('sna:v1:p3', save('  ', 4));
    expect(familyBest('y2-tables', 'p1')).toEqual({ name: 'Ninja 3', best: 4 });
  });
  it('words the three outcomes as praise, never as a loss', () => {
    const fam = { name: 'Bo', best: 5 };
    const lines = [familyBestLine(fam, 6, 'Tables'), familyBestLine(fam, 5, 'Tables'), familyBestLine(fam, 2, 'Tables')];
    expect(lines).toEqual(['You set the family best on Tables: 6!', 'You matched the family best on Tables: 5!', 'Bo holds the family best on Tables: 5. Race again?']);
    for (const l of lines) expect(l).not.toMatch(/lost|lose|beat you|behind|loser/i);
  });
});
