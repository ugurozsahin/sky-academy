import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { GRAMMAR, GRAMMAR_MIN, grammarPool, offeredPool, playTitle } from '../../src/game/sprint-pools';
import { topicById, YEARS } from '../../src/curriculum';
import { recordSprintOutcome } from '../../src/ui/results';
import { load } from '../../src/storage';
import { seededRng } from '../../src/game/rng';

describe('Grammar mix pool (#1234)', () => {
  it('every GRAMMAR id is absent or a core writing topic', () => {
    for (const id of GRAMMAR) { const t = topicById(id); if (t) { expect(t.subject, id).toBe('writing'); expect(t.drill, id).toBeFalsy(); } }
  });
  it('is empty on the KS1 and Year 3–4 islands, and holds only Year 3–6 topics on Year 6', () => {
    for (const y of ['reception', 'year1', 'year2', 'year3', 'year4'] as const) expect(grammarPool(y)).toEqual([]);
    expect(grammarPool('year6').length).toBeGreaterThan(0);
    expect(GRAMMAR.length).toBeGreaterThanOrEqual(GRAMMAR_MIN);
  });
  // TODO(#1234): vacuous until y5-*/y6-* topics exist — then it pins the year filter.
  it('a year-5 pool holds no Year 6 id', () => {
    expect(grammarPool('year5' as never).some(t => t.id.startsWith('y6-'))).toBe(false);
  });
  it('paper voice: at d2–d3 every pooled prompt starts with "Slice" or "Which"', () => {
    for (const t of grammarPool('year6')) for (const d of [2, 3] as const) for (let i = 0; i < 20; i++) {
      const q = t.gen(d, seededRng(i + 1)); expect(q.prompt, `${t.id} d${d}`).toMatch(/^(Slice|Which)/);
    }
  });
  it('a titled pool writes no year Sprint best', () => {
    expect(recordSprintOutcome(YEARS.find(y => y.id === 'year6')!, undefined, { correct: 9, score: 900 }, true).newBest).toBe(false);
    expect(load().sprint.year6 ?? 0).toBe(0);
  });

  // #1657 review: the wiring the acceptance criteria rest on.
  it('playTitle: a title wins on an unstaged mode; practice, staged and the mode title are unchanged', () => {
    const t = { title: 'Counting' } as never;
    expect(playTitle({ title: 'Grammar mix' }, false, false, 'Ninja Sprint')).toBe('Grammar mix');
    expect(playTitle({}, false, false, 'Ninja Sprint')).toBe('Ninja Sprint');
    expect(playTitle({ practice: true, title: 'Grammar mix' }, false, false, 'Ninja Sprint')).toBe('Fix my mistakes');
    expect(playTitle({ topic: t }, true, false, 'Mission')).toBe('Counting');
    expect(playTitle({ topic: t }, true, true, 'Mission')).toBe('Sensei Training');
  });
  it('the row needs GRAMMAR_MIN topics', () => {
    const pool = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `t${i}` })) as never[];
    expect(offeredPool(pool(GRAMMAR_MIN - 1))).toEqual([]);
    expect(offeredPool(pool(GRAMMAR_MIN))).toHaveLength(GRAMMAR_MIN);
  });
  it('play.ts passes the title flag to the sprint record and builds its heading through playTitle', () => {
    const src = readFileSync('src/ui/play.ts', 'utf8');
    expect(src).toContain('recordSprintOutcome(o.year, o.topic, r, !!o.title)');
    expect(src).toContain('playTitle(o, spec.staged, training, spec.title)');
  });
  it('home.ts offers the row through offeredPool and starts it as a titled sprint pool', () => {
    const src = readFileSync('src/ui/home.ts', 'utf8');
    expect(src).toContain('offeredPool(grammarPool(year.id))');
    expect(src).toContain("mode: 'sprint', pool, title: 'Grammar mix'");
  });
});
