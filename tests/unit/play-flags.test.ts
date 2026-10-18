import { describe, expect, it } from 'vitest';
import { modeFlags } from '../../src/ui/play-flags';
import { MODES } from '../../src/game/modes';
import { topicsFor } from '../../src/curriculum';

// #1504: the play screen's mode flags, derived once and pure.
describe('modeFlags (#1504)', () => {
  const topic = topicsFor('year1')[0];
  it('a mission on a topic is staged, not timed, titled by the topic', () => {
    const f = modeFlags({ mode: 'mission', topic });
    expect(f).toMatchObject({ sprint: false, boss: false, training: false, villainMode: MODES.mission.villain, title: topic.title });
  });
  it('a staged run with a pool and no practice is Sensei training', () => {
    const f = modeFlags({ mode: 'mission', pool: [topic] });
    expect(f.training).toBe(true);
    expect(f.title).toBe('Sensei Training');
  });
  it('practice is never training and is titled Fix my mistakes', () => {
    const f = modeFlags({ mode: 'mission', topic, pool: [topic], practice: true });
    expect(f.training).toBe(false);
    expect(f.title).toBe('Fix my mistakes');
  });
  it('every mode flag mirrors its MODES spec', () => {
    for (const m of Object.keys(MODES) as (keyof typeof MODES)[]) {
      const f = modeFlags({ mode: m, topic });
      expect([f.sprint, f.boss, f.villainMode]).toEqual([MODES[m].timed, MODES[m].boss, MODES[m].villain]);
    }
  });
});
