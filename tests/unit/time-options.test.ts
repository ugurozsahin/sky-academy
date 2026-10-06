// Time arrangements (#1121): timeOptsFor, beepDue, tickWithBeep, the `sna:beep` key and the real session's clock.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Session } from '../../src/game/session';
import { MODES } from '../../src/game/modes';
import { timeOptsFor, beepDue } from '../../src/game/time-options';
import { YEARS, topicById } from '../../src/curriculum';

const events = (): any => ({ onQuestion: vi.fn(), onCorrect: vi.fn(), onWrong: vi.fn(), onMiss: vi.fn(), onProgress: vi.fn(), onLives: vi.fn(), onStageClear: vi.fn(), onTime: vi.fn(), onBoss: vi.fn(), onEnd: vi.fn() });
const Y1 = YEARS[1];
// No shipped mission has `questionMs`, so borrow its entry for the clock tests and put it back (as question-clock.test.ts does).
const mtc = (timeScale?: number) => { MODES.mission.questionMs = 6000; const s = new Session({ mode: 'mission', year: Y1, topic: topicById('y1-add')!, rng: () => 0.3, timeScale }, events()); s.start(); s.armQuestionClock(); return s; };
afterEach(() => { delete MODES.mission.questionMs; });
const mem: Record<string, string> = {};
(globalThis as any).localStorage = { getItem: (k: string) => mem[k] ?? null, setItem: (k: string, v: string) => { mem[k] = v; }, removeItem: (k: string) => { delete mem[k]; }, clear: () => { for (const k of Object.keys(mem)) delete mem[k]; } };

describe('timeOptsFor', () => {
  it.each([[1, 1], [1.5, 1.5], [0, Infinity]] as const)('timeX %s → timeScale %s for the Tables Check', (timeX, scale) => {
    expect(timeOptsFor('mtc', { timeX, slow: false })).toEqual({ timeScale: scale, slower: false });
  });
  it('a Sprint gets 90 seconds at ×1.5 and at no limit, and nothing extra at Normal', () => {
    expect(timeOptsFor('sprint', { timeX: 1.5, slow: true })).toMatchObject({ seconds: 90, slower: true });
    expect(timeOptsFor('sprint', { timeX: 0, slow: false })).toMatchObject({ seconds: 90, timeScale: Infinity });
    expect(timeOptsFor('sprint', { timeX: 1, slow: false }).seconds).toBeUndefined();
  });
  it('other modes never get extra seconds', () => {
    for (const m of ['mission', 'endless', 'boss', 'relaxed', 'mtc'] as const) expect(timeOptsFor(m, { timeX: 1.5, slow: false }).seconds).toBeUndefined();
  });
});

describe('the per-question clock honours timeScale', () => {
  it('×1.5 expires a card at 9,000 ms, not 6,000', () => {
    const s = mtc(1.5);
    expect(s.questionLeft).toBe(9000);
    s.tick(6000); expect(s.questionLeft).toBe(3000); expect(s.attempts).toBe(0);
    s.tick(3000); expect(s.attempts).toBe(1);
  });
  it('Infinity never expires', () => {
    const s = mtc(Infinity);
    for (let i = 0; i < 100; i++) s.tick(1000);
    expect(s.attempts).toBe(0); expect(s.questionLeft).toBe(Infinity);
  });
});

describe('beepDue', () => {
  it('fires only on the tick that crosses 2,000 ms left', () => {
    expect(beepDue(2100, 2000)).toBe(true);
    expect(beepDue(2100, 1900)).toBe(true);
    expect(beepDue(2000, 1900)).toBe(false);   // already at the line: it fired on an earlier tick
    expect(beepDue(3000, 2500)).toBe(false);
    expect(beepDue(0, 0)).toBe(false);          // unarmed
    expect(beepDue(2500, 0)).toBe(false);       // a long tick straight to zero ends the question: no stray beep
  });
  it('never fires with no time limit', () => { expect(beepDue(Infinity, Infinity)).toBe(false); });
});

describe('tickWithBeep and the sna:beep key', () => {
  beforeEach(() => { localStorage.clear(); vi.resetModules(); });
  const load = async () => {
    const alert = vi.fn();
    vi.doMock('../../src/audio', () => ({ sfx: { alert } }));
    return { alert, ...(await import('../../src/ui/check-beep')), ...(await import('../../src/device-settings')) };
  };
  const fake = (left: number) => ({ questionLeft: left, tick(ms: number) { this.questionLeft = Math.max(0, this.questionLeft - ms); } });

  it('plays once per question when the toggle is on', async () => {
    const { alert, tickWithBeep, setBeepSetting } = await load();
    setBeepSetting(true);
    const s = fake(3000);
    tickWithBeep(s, 500); tickWithBeep(s, 600); tickWithBeep(s, 600); tickWithBeep(s, 600);
    expect(alert).toHaveBeenCalledTimes(1);
  });
  it('plays nothing when the toggle is off, but still ticks', async () => {
    const { alert, tickWithBeep } = await load();
    const s = fake(3000); tickWithBeep(s, 1500);
    expect(alert).not.toHaveBeenCalled(); expect(s.questionLeft).toBe(1500);
  });
  it('beeps again on the next question', async () => {
    const { alert, tickWithBeep, setBeepSetting } = await load();
    setBeepSetting(true);
    const s = fake(3000); tickWithBeep(s, 1500); s.questionLeft = 6000; tickWithBeep(s, 4500);
    expect(alert).toHaveBeenCalledTimes(2);
  });
  it('sna:beep round-trips and a throwing localStorage reads as off', async () => {
    const { setBeepSetting, beepSetting } = await load();
    expect(beepSetting()).toBe(false);
    expect(setBeepSetting(true)).toBe(true); expect(localStorage.getItem('sna:beep')).toBe('on'); expect(beepSetting()).toBe(true);
    expect(setBeepSetting(false)).toBe(true); expect(localStorage.getItem('sna:beep')).toBeNull();
    const ls = (globalThis as any).localStorage, orig = ls.getItem; ls.getItem = () => { throw new Error('denied'); };
    expect(beepSetting()).toBe(false); ls.getItem = orig;
  });
});

describe('a Sprint at a non-Normal setting never writes a best (#1121)', () => {
  it('Normal records the year best; ×1.5 and no limit record nothing', async () => {
    vi.resetModules(); (globalThis as any).localStorage.clear();
    const { recordSprintOutcome } = await import('../../src/ui/results');
    const { load, save } = await import('../../src/storage');
    const year = YEARS[1];
    const r = { correct: 9, score: 900 };
    save({ settings: { ...load().settings, timeX: 1.5 } });
    expect(recordSprintOutcome(year, undefined, r).newBest).toBe(false); expect(load().sprint[year.id]).toBeUndefined();
    save({ settings: { ...load().settings, timeX: 0 } });
    expect(recordSprintOutcome(year, undefined, r).newBest).toBe(false); expect(load().sprint[year.id]).toBeUndefined();
    const topic = YEARS[1] && topicById('y1-add')!;
    for (const timeX of [1.5, 0] as const) {
      save({ settings: { ...load().settings, timeX } });
      expect(recordSprintOutcome(year, topic, r)).toEqual({ newBest: false, candidates: [] });
      expect(load().progress[topic.id]?.sprint ?? 0).toBe(0);
    }
    save({ settings: { ...load().settings, timeX: 1 } });
    expect(recordSprintOutcome(year, undefined, r).newBest).toBe(true); expect(load().sprint[year.id]).toBe(900);
  });
});

describe('the Settings control (#1121)', () => {
  it('lists Normal, Extra time, No time limit in that order, and marks the stored choice', async () => {
    const { settingsHTML, TIMEX_ORDER, TIMEX_LABEL } = await import('../../src/ui/parents-settings');
    expect(TIMEX_ORDER.map(k => TIMEX_LABEL[k])).toEqual(['Normal', 'Extra time (×1.5)', 'No time limit']);
    const html = settingsHTML();
    expect([...html.matchAll(/data-timex="([^"]+)"/g)].map(m => m[1])).toEqual(['1', '1.5', '0']);
    expect(html).toMatch(/class="tab on" data-timex="1"/);
  });
});
