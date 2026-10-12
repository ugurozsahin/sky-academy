import { describe, it, expect } from 'vitest';
import { Session } from '../../src/game/session';
import { topicsFor, YEARS, type Question } from '../../src/curriculum';
import { dailySprintPool, dailySprintSeed } from '../../src/game/daily-sprint';
import { seeded } from '../../src/game/dojo';

const ev = () => ({ onQuestion: () => {}, onProgress: () => {}, onCorrect: () => {}, onWrong: () => {}, onLives: () => {}, onScore: () => {}, onCombo: () => {}, onStage: () => {}, onEnd: () => {}, onTime: () => {}, onBoss: () => {} }) as never;
const prompts = (yearId: string, seed: string, right: boolean, n = 20): string[] => {
  const year = YEARS.find(y => y.id === yearId)!;
  const s = new Session({ mode: 'sprint', year, pool: dailySprintPool(topicsFor(year.id)), rng: seeded(seed) }, ev());
  const out: string[] = [];
  s.start();
  for (let i = 0; i < n && !s.ended; i++) {
    const q = s.current as Question; out.push(`${s.currentTopic?.id}|${q.prompt}`);
    s.hit(right ? q.answer : q.options.find(o => o !== q.answer) ?? 'x'); s.advance();
  }
  return out;
};

describe('Daily Sprint (#924)', () => {
  it('asks the same first 20 questions whatever the child answers', () => {
    const seed = dailySprintSeed('2026-10-12', 'year1');
    const a = prompts('year1', seed, true), b = prompts('year1', seed, false);
    expect(a.length).toBe(20); expect(b).toEqual(a);
  });
  it('differs by day and by island', () => {
    const base = prompts('year1', dailySprintSeed('2026-10-12', 'year1'), true);
    expect(prompts('year1', dailySprintSeed('2026-10-13', 'year1'), true)).not.toEqual(base);
    expect(prompts('year2', dailySprintSeed('2026-10-12', 'year2'), true)).not.toEqual(base);
  });
  it('the pool holds both subjects and no drill, sequence or non-bubble topic', () => {
    for (const y of YEARS) {
      const pool = dailySprintPool(topicsFor(y.id));
      for (const t of pool) { expect(t.drill, t.id).toBeFalsy(); expect(t.sequenceFrom, t.id).toBeUndefined(); expect(['tracing', 'keypad']).not.toContain(t.input); }
    }
    expect(new Set(dailySprintPool(topicsFor('year1')).map(t => t.subject))).toEqual(new Set(['maths', 'writing']));
  });
  it('the seed is the Dojo day key plus the island', () => { expect(dailySprintSeed('2026-10-12', 'year1')).toBe('sprint:2026-10-12:year1'); });
});
