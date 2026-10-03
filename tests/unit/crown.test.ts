import { describe, it, expect } from 'vitest';
import { load, recordCrown, recordTopic, reset } from '../../src/storage';
import { recordMissionOutcome } from '../../src/ui/results';

// minimal localStorage shim for node
const mem: Record<string, string> = {};
(globalThis as any).localStorage = { getItem: (k: string) => mem[k] ?? null, setItem: (k: string, v: string) => { mem[k] = v; }, removeItem: (k: string) => { delete mem[k]; }, clear: () => { for (const k in mem) delete mem[k]; } };

describe('recordCrown (#932)', () => {
  it('sets the crown, keeps the rest of the topic, and is idempotent', () => {
    reset(); recordTopic('y1-add', 3, 120); recordCrown('y1-add'); recordCrown('y1-add');
    expect(load().progress['y1-add']).toMatchObject({ stars: 3, best: 120, plays: 1, crown: true });
  });
});

describe('recordMissionOutcome crowns only a won Legend run (#932)', () => {
  const topic = { id: 'y1-add', title: 'Adding' } as Parameters<typeof recordMissionOutcome>[0];
  const recordMission = (_id: string, r: { stars: number; score: number; won: boolean }, legend: boolean) => recordMissionOutcome(topic, r, legend);
  const won = { stars: 3, score: 200, won: true }, lost = { stars: 0, score: 40, won: false };

  it('a lost Legend run records like a lost mission and never crowns', () => {
    reset(); recordMission('y1-add', lost, true);
    const p = load().progress['y1-add'];
    expect(p).toMatchObject({ stars: 0, best: 40, plays: 1 });
    expect(p.crown).toBeUndefined();
  });
  it('a won Legend run crowns the topic', () => {
    reset(); recordMission('y1-add', won, true);
    expect(load().progress['y1-add']).toMatchObject({ stars: 3, plays: 1, crown: true });
  });
  it('a won plain mission never crowns', () => {
    reset(); recordMission('y1-add', won, false);
    expect(load().progress['y1-add'].crown).toBeUndefined();
  });
  it('a later lost Legend run keeps an earned crown', () => {
    reset(); recordMission('y1-add', won, true); recordMission('y1-add', lost, true);
    expect(load().progress['y1-add']).toMatchObject({ plays: 2, crown: true });
  });
});
