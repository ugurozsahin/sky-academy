import { describe, it, expect, beforeEach } from 'vitest';
import { addCoins, exportSave, importSave, load, migrate, recordAccuracy, recordBossWin, recordMemory, recordSprint, recordTopic, recordTraining, reset, save, stickersFor, touchStreak, SAVE_VERSION, STICKER_IDS, STICKER_COST } from '../../src/storage';

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

describe('save migration (#38)', () => {
  beforeEach(() => reset());

  it('carries a stored v1 save forward unchanged, filling missing keys from the default', () => {
    const stored = migrate({ v: 1, name: 'Rey', avatar: 'kai', year: 'year1', coins: 42, sprint: { year1: 200 } });
    expect(stored.v).toBe(SAVE_VERSION);
    expect(stored.name).toBe('Rey');                 // preserved
    expect(stored.avatar).toBe('kai');
    expect(stored.year).toBe('year1');
    expect(stored.coins).toBe(42);
    expect(stored.sprint).toEqual({ year1: 200 });
    expect(stored.tutorialSeen).toBe(false);         // key absent in the blob → filled from DEFAULT
    expect(stored.boss).toEqual({});
    expect(stored.owned).toEqual([]);
  });

  it('stamps the current version onto a pre-versioning blob that has no `v`', () => {
    const migrated = migrate({ name: 'Old', coins: 5 });   // written before the `v` field existed
    expect(migrated.v).toBe(SAVE_VERSION);
    expect(migrated.name).toBe('Old');
    expect(migrated.coins).toBe(5);
  });

  it('falls back to a fresh default for corrupt or non-object data', () => {
    for (const bad of [null, undefined, 42, 'nonsense', [] as unknown]) {
      const d = migrate(bad);
      expect(d.v).toBe(SAVE_VERSION);
      expect(d.name).toBe('');
      expect(d.coins).toBe(0);
    }
  });

  it('is idempotent — migrating an already-current save changes nothing', () => {
    const once = migrate({ v: 1, name: 'Zed', coins: 9 });
    expect(migrate(once)).toEqual(once);
  });

  it('load() routes stored data through migrate(): a blob missing `v` comes back stamped and merged', () => {
    mem['sna:v1'] = JSON.stringify({ name: 'NoVersion', coins: 3 });
    reset(); mem['sna:v1'] = JSON.stringify({ name: 'NoVersion', coins: 3 });
    expect(load().v).toBe(SAVE_VERSION);
    expect(load().name).toBe('NoVersion');
    expect(load().coins).toBe(3);
    expect(load().boss).toEqual({});                 // shape completed from DEFAULT
  });
});

// #64: the APK is re-signed on every build, so updating it means uninstalling, and uninstalling takes
// localStorage — the child's coins, stars and streak — with it. These are the code that carries them across.
describe('save export / import (#64)', () => {
  beforeEach(() => reset());

  it('round-trips a played save: what comes back is what went in', () => {
    save({ name: 'Ada', avatar: 'volt', year: 'year1' });
    addCoins(120);
    recordTopic('add-10', 3, 44);
    recordSprint('year1', 17);
    touchStreak(new Date('2026-09-10T09:00:00Z'));
    const code = exportSave();
    const before = load();

    reset();                                          // a fresh device: nothing saved at all
    expect(load().coins).toBe(0);
    expect(importSave(code)).toBe(true);
    expect(load()).toEqual(before);
    expect(load().coins).toBe(120);
    expect(load().progress['add-10'].best).toBe(44);
    expect(load().streak.days).toBe(1);
  });

  it('writes the restored save to the device, not just the in-memory cache', () => {
    save({ name: 'Ada' }); addCoins(50);
    const code = exportSave();
    reset(); save({ name: 'Someone else' });
    expect(importSave(code)).toBe(true);
    const stored = JSON.parse(mem['sna:v1']);         // what a reload after this would read back
    expect(stored.name).toBe('Ada');
    expect(stored.coins).toBe(50);
  });

  it('replaces the save rather than merging over it — the old device leaves nothing behind', () => {
    save({ name: 'Old' }); recordTopic('old-topic', 3, 99); addCoins(500);
    const other = migrate({ v: 1, name: 'New', coins: 7 });
    expect(importSave(JSON.stringify(other))).toBe(true);
    expect(load().name).toBe('New');
    expect(load().coins).toBe(7);
    expect(load().progress['old-topic']).toBeUndefined();   // a merge would have kept it
    expect(load().stickers).toEqual([]);
  });

  it('refuses anything that is not one of our codes, and changes nothing when it does', () => {
    save({ name: 'Keep' }); addCoins(80);
    for (const junk of ['', '   ', 'not json', 'null', '42', '"a string"', '[1,2,3]', '{}', '{"coins":999}']) {
      expect(importSave(junk), `should refuse ${JSON.stringify(junk)}`).toBe(false);
    }
    expect(load().name).toBe('Keep');                 // a stray paste must not wipe a child's progress
    expect(load().coins).toBe(80);
  });

  it('refuses a code from a newer build — migrations only run forwards', () => {
    save({ name: 'Keep' });
    expect(importSave(JSON.stringify({ v: SAVE_VERSION + 1, name: 'Future', coins: 3 }))).toBe(false);
    expect(importSave(JSON.stringify({ v: 0, name: 'Ancient' }))).toBe(false);
    expect(importSave(JSON.stringify({ v: 1.5, name: 'Odd' }))).toBe(false);
    expect(load().name).toBe('Keep');
  });

  it('an exported code is accepted by migrate(), so a code kept from an older build still imports', () => {
    const code = exportSave();
    expect(JSON.parse(code).v).toBe(SAVE_VERSION);    // the version is what makes a code recognisable
    expect(importSave(code)).toBe(true);
  });
});
