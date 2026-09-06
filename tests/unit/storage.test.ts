import { describe, it, expect, beforeEach } from 'vitest';
import { addCoins, load, recordAccuracy, recordBossWin, recordMemory, recordSprint, recordTopic, recordTraining, reset, stickersFor, touchStreak, STICKER_IDS, STICKER_COST } from '../../src/storage';

// minimal localStorage shim for node
const mem: Record<string, string> = {};
(globalThis as any).localStorage = { getItem: (k: string) => mem[k] ?? null, setItem: (k: string, v: string) => { mem[k] = v; }, removeItem: (k: string) => { delete mem[k]; }, clear: () => { for (const k in mem) delete mem[k]; } };

describe('rewards storage', () => {
  beforeEach(() => reset());
  it('unlocks stickers in order as coins accumulate', () => {
    expect(stickersFor(0)).toEqual([]);
    expect(addCoins(29)).toEqual([]);
    expect(addCoins(1)).toEqual([STICKER_IDS[0]]);           // 30 → first sticker
    expect(addCoins(40)).toEqual([STICKER_IDS[1]]);          // 70 → second
    expect(load().coins).toBe(70); expect(load().stickers.length).toBe(2);
    expect(stickersFor(STICKER_COST[STICKER_COST.length - 1]).length).toBe(STICKER_IDS.length);
  });
  it('tutorial flag defaults to unseen and survives old saves without the field', () => {
    expect(load().tutorialSeen).toBe(false);
    mem['sna:v1'] = JSON.stringify({ v: 1, name: 'Old', coins: 5 });   // save written before the field existed
    reset(); mem['sna:v1'] = JSON.stringify({ v: 1, name: 'Old', coins: 5 });
    expect(load().name).toBe('Old'); expect(load().tutorialSeen).toBe(false); expect(load().streak.days).toBe(0);
    expect(load().sprint).toEqual({});
  });
  it('sprint best is kept per year and only reports a new best when beaten', () => {
    expect(recordSprint('year1', 0)).toBe(false);
    expect(recordSprint('year1', 120)).toBe(true);
    expect(recordSprint('year1', 120)).toBe(false);
    expect(recordSprint('year1', 90)).toBe(false);
    expect(recordSprint('year2', 30)).toBe(true);
    expect(load().sprint).toEqual({ year1: 120, year2: 30 });
  });
  it('boss knock-outs are counted per year', () => {
    expect(load().boss).toEqual({});
    expect(recordBossWin('year1')).toBe(1); expect(recordBossWin('year1')).toBe(2); expect(recordBossWin('reception')).toBe(1);
    expect(load().boss).toEqual({ year1: 2, reception: 1 });
  });
  it('memory boards are counted per year and old saves start at none', () => {
    expect(load().memory).toEqual({});
    expect(recordMemory('reception')).toBe(1); expect(recordMemory('reception')).toBe(2); expect(recordMemory('year2')).toBe(1);
    expect(load().memory).toEqual({ reception: 2, year2: 1 });
  });
  it('topic accuracy accumulates across runs and keeps stars; training sessions are counted per year', () => {
    recordTopic('y1-add', 2, 80);
    recordAccuracy('y1-add', 5, 6); recordAccuracy('y1-add', 3, 4); recordAccuracy('y1-add', 0, 0);   // an empty tally changes nothing
    expect(load().progress['y1-add']).toEqual({ stars: 2, best: 80, plays: 1, hits: 8, tries: 10 });
    recordAccuracy('y1-sub', 1, 2);                                                                    // a topic met only in Sensei training / Sky Storm
    expect(load().progress['y1-sub']).toEqual({ stars: 0, best: 0, plays: 0, hits: 1, tries: 2 });
    expect(load().training).toEqual({});
    expect(recordTraining('year1')).toBe(1); expect(recordTraining('year1')).toBe(2);
    expect(load().training).toEqual({ year1: 2 });
  });
  it('streak counts consecutive days only', () => {
    expect(touchStreak(new Date('2026-09-05T10:00:00Z'))).toBe(1);
    expect(touchStreak(new Date('2026-09-05T20:00:00Z'))).toBe(1);   // same day
    expect(touchStreak(new Date('2026-09-06T08:00:00Z'))).toBe(2);   // next day
    expect(touchStreak(new Date('2026-09-09T08:00:00Z'))).toBe(1);   // gap resets
  });
});
