import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { activeProfile, addCoins, addProfile, buyItem, endGuest, importSave, isGuest, isReadOnlySave, isWhiteboard, load, recordEndless, recordGameEnd, recordSprint, recordTopic, reset, save, saveKeyFor, saveKept, startGuest, touchStreak, SAVE_VERSION } from '../../src/storage';

const mem: Record<string, string> = {};
(globalThis as any).localStorage = { getItem: (k: string) => mem[k] ?? null, setItem: (k: string, v: string) => { mem[k] = v; }, removeItem: (k: string) => { delete mem[k]; }, clear: () => { for (const k in mem) delete mem[k]; } };

// #948: guest play runs on an in-memory save — every writer leaves the store byte-identical.
describe('guest play (#948)', () => {
  const snap = () => JSON.stringify(mem);
  beforeEach(() => { reset(); endGuest(); });
  afterEach(() => endGuest());
  it('every writer leaves the store byte-identical, and endGuest brings the profile back', () => {
    save({ name: 'Ada', avatar: 'volt', onboarded: true, coins: 40 });
    const before = snap();
    startGuest('year1', 'volt');
    expect(isGuest()).toBe(true);
    expect(load().name).toBe('Guest');
    expect(load().year).toBe('year1');
    addCoins(50); touchStreak(); recordTopic('y1-add', 3, 9); recordEndless('year1', 12); recordSprint('year1', 8);
    recordGameEnd({ mode: 'mission', won: true, correct: 5, attempts: 5, bestCombo: 3, stars: 3, score: 90 }, 10); buyItem('sword'); save({ coins: 999 });
    expect(importSave(JSON.stringify({ v: SAVE_VERSION, name: 'X' }))).toBe(false);
    expect(addProfile().ok).toBe(false);
    reset();
    expect(load().name, 'reset() does not wipe the guest session either').toBe('Guest');
    expect(snap(), 'the shimmed store is untouched').toBe(before);
    expect(saveKept(), 'guest results claim nothing as kept').toBe(false);
    endGuest();
    expect(isGuest()).toBe(false);
    expect(load().name).toBe('Ada');
    expect(load().coins).toBe(40);
    expect(saveKept()).toBe(true);
    expect(snap()).toBe(before);
  });
  it('the newer-build latch is untouched by a guest session', () => {
    localStorage.setItem(saveKeyFor(activeProfile()), JSON.stringify({ v: SAVE_VERSION + 1, name: 'Tablet' }));
    load(); expect(isReadOnlySave()).toBe(true);
    startGuest('reception', 'volt'); endGuest();
    load(); expect(isReadOnlySave(), 'and it is still latched afterwards').toBe(true);
  });
  // #949: Whiteboard mode is a guest session with slower bubbles, speech and sound forced on, writing nothing.
  it('Whiteboard mode is slow, spoken and unsaved, and ends with the guest', () => {
    save({ name: 'Ada', avatar: 'volt', onboarded: true, speech: false, sound: false });
    const before = snap();
    startGuest('year1', 'volt', true);
    expect(isWhiteboard()).toBe(true);
    expect(load().settings.slow).toBe(true);
    expect(load().speech).toBe(true);
    expect(load().sound).toBe(true);
    save({ coins: 5 }); addCoins(9);
    expect(snap()).toBe(before);
    endGuest();
    expect(isWhiteboard()).toBe(false);
    expect(load().speech, "the family's own save keeps its speech setting").toBe(false);
    startGuest('year1', 'volt');
    expect(isWhiteboard(), 'plain guest play is not Whiteboard mode').toBe(false);
    expect(load().settings.slow).toBe(false);
  });
});
