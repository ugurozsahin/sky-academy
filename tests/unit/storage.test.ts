import { describe, it, expect, beforeEach, vi } from 'vitest';
import { activeProfile, addProfile, deleteProfile, cleanName, MAX_PROFILES, NAME_MAX, renameProfile, MIGRATIONS, onboardedOf, PROFILE_IDS, profileCard, profileCards, profileIds, saveKeyFor, setActiveProfile, addCoins, ACHIEVEMENTS, certificates, dojoToday, evaluateStickers, exportSave, fileCert, importSave, isFutureSave, isMigratable, isReadOnlySave, isWriteFailing, load, migrate, recordAccuracy, recordBossWin, recordCert, recordDojo, recordEndless, recordGameEnd, recordMemory, recordSprint, recordTopic, recordTraining, reset, save, saveVersionOf, stickersFor, touchStreak, CERT_CAP, SAVE_VERSION, SPRINT_STICKER_SCORE, STICKER_IDS, STICKER_COST, TOPICS_STARRED_GOAL, UNREADABLE_VERSION, DUEL_CAP, duelHistory, fileDuel, recordDuel, type StoredCert, type StoredDuel } from '../../src/storage';
import { certFromStored } from '../../src/ui/certificate';
import { duelHeadline, duelHistoryLine, type DuelResult } from '../../src/game/duel';
import { carriedStreak } from '../../src/game/dojo';
import { esc } from '../../src/ui/dom';
import { topicsFor } from '../../src/curriculum';

// minimal localStorage shim for node
const mem: Record<string, string> = {};
(globalThis as any).localStorage = { getItem: (k: string) => mem[k] ?? null, setItem: (k: string, v: string) => { mem[k] = v; }, removeItem: (k: string) => { delete mem[k]; }, clear: () => { for (const k in mem) delete mem[k]; } };

describe('rewards storage', () => {
  beforeEach(() => reset());
  it('unlocks the first three stickers in order as coins accumulate, and no further (#114)', () => {
    expect(stickersFor(0)).toEqual([]);
    expect(addCoins(29)).toEqual([]);
    expect(addCoins(1)).toEqual([STICKER_IDS[0]]);           // 30 → first sticker
    expect(addCoins(40)).toEqual([STICKER_IDS[1]]);          // 70 → second
    expect(load().coins).toBe(70); expect(load().stickers.length).toBe(2);
    expect(stickersFor(STICKER_COST[STICKER_COST.length - 1]).length).toBe(STICKER_COST.length);   // 120 unlocks exactly the three coin stickers
    expect(addCoins(1_000_000)).toEqual([STICKER_IDS[2]]);   // a huge coin pile still stops at the third — the rest is earned, not bought
    expect(load().stickers).toEqual(STICKER_IDS.slice(0, 3));
  });
  it('the eight achievements are 1:1 with the non-coin stickers, in order', () => {
    expect(ACHIEVEMENTS.map(a => a.id)).toEqual(STICKER_IDS.slice(STICKER_COST.length));
  });
  it('star 5 different topics unlocks terra; four is not enough', () => {
    const d = () => load();
    for (let i = 0; i < TOPICS_STARRED_GOAL - 1; i++) recordTopic(`t${i}`, 1, 10);
    expect(evaluateStickers(d())).not.toContain('terra');
    recordTopic(`t${TOPICS_STARRED_GOAL - 1}`, 1, 10);
    expect(evaluateStickers(d())).toContain('terra');
  });
  it('gust needs a star on every island, not just one', () => {
    recordTopic('r-count', 1, 5); recordTopic('y1-bonds', 1, 5);            // reception + year1 only
    expect(evaluateStickers(load())).not.toContain('gust');
    recordTopic('y2-tables', 1, 5);                                         // + year2 → all three
    expect(evaluateStickers(load())).toContain('gust');
  });
  it('frost and sol read the same streak at their two different thresholds', () => {
    for (let i = 0; i < 3; i++) touchStreak(new Date(Date.UTC(2026, 8, 1 + i)));
    expect(load().streak.days).toBe(3);
    expect(evaluateStickers(load())).toContain('frost');
    expect(evaluateStickers(load())).not.toContain('sol');
    for (let i = 3; i < 7; i++) touchStreak(new Date(Date.UTC(2026, 8, 1 + i)));
    expect(load().streak.days).toBe(7);
    expect(evaluateStickers(load())).toContain('sol');
  });
  it('shadow and kai fire from a single win in any year, and bolt from a sprint score at the threshold', () => {
    expect(evaluateStickers(load())).not.toContain('shadow');
    recordBossWin('reception');
    expect(evaluateStickers(load())).toContain('shadow');
    expect(evaluateStickers(load())).not.toContain('kai');
    recordMemory('year2');
    expect(evaluateStickers(load())).toContain('kai');
    recordSprint('year1', SPRINT_STICKER_SCORE - 1);
    expect(evaluateStickers(load())).not.toContain('bolt');
    recordSprint('year1', SPRINT_STICKER_SCORE);
    expect(evaluateStickers(load())).toContain('bolt');
  });
  it('hammer needs every topic on one island starred, not just most of them', () => {
    const reception = topicsFor('reception');
    reception.slice(0, -1).forEach(t => recordTopic(t.id, 1, 10));           // every topic but the last
    expect(evaluateStickers(load())).not.toContain('hammer');
    recordTopic(reception[reception.length - 1].id, 1, 10);                  // the last one too
    expect(evaluateStickers(load())).toContain('hammer');
  });
  it('a sticker earned under an old rule is never taken away by a recompute that no longer sees the reason (#114)', () => {
    save({ coins: 900, stickers: [...STICKER_IDS] });                       // an old save: every sticker unlocked purely from lifetime coins
    expect(addCoins(1)).toEqual([]);                                        // nothing newly crosses a threshold…
    expect(load().stickers).toEqual(STICKER_IDS);                           // …and nothing already held is dropped, even with no achievement behind it
  });
  it('spending coins in the shop never changes which stickers are unlocked (#114)', () => {
    addCoins(120);
    const before = load().stickers;
    save({ spent: 100 });                                                  // the shop's own write — coins (lifetime) is untouched by it
    expect(evaluateStickers(load())).toEqual(before);
  });
  // #270 review: importSave() only checks `v`, so a hand-edited or corrupted "Restore" code such as
  // `{ v: 2, boss: null }` reaches evaluateStickers() untouched. Before this, only the one mode reading that
  // field (recordBossWin, say) would throw, and only when the child opened it; because every coin award now
  // runs every achievement check, a corruption in any single field used to take coin-earning down app-wide.
  it('a corrupted achievement field never breaks addCoins() — every mode reads all four now (#270)', () => {
    for (const bad of [{ progress: null }, { boss: null }, { memory: 'not an object' }, { sprint: [] }]) {
      reset();
      expect(importSave(JSON.stringify({ v: SAVE_VERSION, name: 'Bad', coins: 5, ...bad })), JSON.stringify(bad)).toBe(true);
      expect(() => addCoins(10), `addCoins() must not throw on ${JSON.stringify(bad)}`).not.toThrow();
    }
  });
  it('a corrupted number inside boss/memory/sprint is skipped rather than breaking the sum (#270)', () => {
    reset();
    importSave(JSON.stringify({ v: SAVE_VERSION, coins: 0, boss: { year1: 'two', reception: 1 } }));
    expect(evaluateStickers(load())).toContain('shadow');   // the one real win still counts
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
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    recordTopic('y1-add', 2, 80);
    recordAccuracy('y1-add', { hits: 5, tries: 6 }); recordAccuracy('y1-add', { hits: 3, tries: 4 }); recordAccuracy('y1-add', { hits: 0, tries: 0 });   // an empty tally changes nothing
    expect(load().progress['y1-add']).toEqual({ stars: 2, best: 80, plays: 1, hits: 8, tries: 10 });
    recordAccuracy('y1-sub', { hits: 1, tries: 2 });                                                    // a topic met only in Sensei training / Sky Storm
    expect(load().progress['y1-sub']).toEqual({ stars: 0, best: 0, plays: 0, hits: 1, tries: 2 });
    expect(load().training).toEqual({});
    expect(recordTraining('year1')).toBe(1); expect(recordTraining('year1')).toBe(2);
    expect(load().training).toEqual({ year1: 2 });
    // Every tally above was already well-formed — silence is the guarantee the clamp's warning makes (#379).
    expect(warn, 'a well-formed tally must never trip the clamp warning').not.toHaveBeenCalled();
    warn.mockRestore();
  });
  it('recordAccuracy clamps hits into [0, tries] and warns — a caller cannot write an accuracy above 100%, silently (#379)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    recordAccuracy('y1-add', { hits: 9, tries: 4 });     // more hits than tries: clamped down to the ceiling
    expect(load().progress['y1-add']).toEqual({ stars: 0, best: 0, plays: 0, hits: 4, tries: 4 });
    recordAccuracy('y1-sub', { hits: -3, tries: 5 });    // negative hits: clamped up to the floor
    expect(load().progress['y1-sub']).toEqual({ stars: 0, best: 0, plays: 0, hits: 0, tries: 5 });
    recordAccuracy('y1-time', { hits: NaN, tries: 3 });  // NaN: the clamp itself cannot bound it, so it is 0
    expect(load().progress['y1-time']).toEqual({ stars: 0, best: 0, plays: 0, hits: 0, tries: 3 });
    // Each of the three malformed tallies above left a trace — the review finding this test guards: a silent
    // repair would trade one silent failure (accuracy over 100%) for another (no evidence the bug happened).
    expect(warn).toHaveBeenCalledTimes(3);
    for (const call of warn.mock.calls) expect(call[0]).toContain('tally out of range');
    warn.mockRestore();
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
    expect(stored.voice).toBe('unknown');            // v1 → v2 adds the launch-to-launch TTS verdict (#65)
    expect(stored.tutorialSeen).toBe(false);         // key absent in the blob → filled from DEFAULT
    expect(stored.boss).toEqual({});
    expect(stored.owned).toEqual([]);
  });

  it('migrate() never rewrites a stored avatar id, even one the roster has since renamed (#113)', () => {
    // #112 renamed the Shadow ninja's display name to Dusk but deliberately kept its id `'shadow'`, precisely
    // so a save written before the rename still resolves to the same ninja. A migrate() that ever translated
    // an old id to a new one on a future rename would silently reassign that player to AVATARS[0] instead
    // (avatarById()'s fallback for an unknown id) — this pins migrate() as a pure carry-forward of the id.
    expect(migrate({ v: 1, avatar: 'shadow' }).avatar).toBe('shadow');
  });

  it('a save migrated from an old version keeps every sticker it already earned, achievement-based or not (#114)', () => {
    // A save from before #114: all 11 stickers unlocked purely from lifetime coins, no achievement stats at all.
    const stored = migrate({ v: 1, name: 'Old', coins: 900, stickers: [...STICKER_IDS] });
    expect(stored.stickers).toEqual(STICKER_IDS);       // migrate() itself never re-evaluates — it only fills and stamps
    reset(); save(stored);
    expect(addCoins(0)).toEqual([]);                    // and playing afterwards does not drop any of them either
    expect(load().stickers).toEqual(STICKER_IDS);
  });

  it('stamps the current version onto a pre-versioning blob that has no `v`', () => {
    const migrated = migrate({ name: 'Old', coins: 5 });   // written before the `v` field existed
    expect(migrated.v).toBe(SAVE_VERSION);
    expect(migrated.name).toBe('Old');
    expect(migrated.coins).toBe(5);
  });

  // #65 review: `migrate` used to read a blob with no `v` as *current*, which skips every migration. That is
  // invisible while the only step is additive (the DEFAULT merge fills the key anyway), and it is precisely
  // the reshaping step (#26's `bests`) that would have been skipped — so the version read is pinned here.
  it('reads a blob with no `v` as v1, so it walks every migration from the start', () => {
    expect(saveVersionOf({})).toBe(1);
    expect(saveVersionOf({ name: 'Old' })).toBe(1);
    expect(saveVersionOf({ v: SAVE_VERSION })).toBe(SAVE_VERSION);
    // A *mangled* version used to land on 1 as well, on the reasoning that the oldest rung is safer than
    // pretending it is current. #232 split the two cases: absent still means v1, but a `v` that is present and
    // unreadable now reads as UNREADABLE_VERSION, because re-running the ladder over data that has already been
    // migrated is only harmless while every step is additive. Still never read as current, which was the point.
    expect(saveVersionOf({ v: 'two' })).toBe(UNREADABLE_VERSION);
    expect(saveVersionOf({ v: 'two' })).not.toBe(SAVE_VERSION);
  });

  // …and the consequence of that read, which is the part a future reshaping step depends on: the step really
  // runs on a pre-versioning blob. `saveVersionOf` returning 1 and the ladder acting on it are two different
  // claims, and only this one goes red if the `while` is ever restructured.
  it('runs every migration step on a pre-versioning blob, not just the last one', () => {
    const junk = migrate({ name: 'Old', certs: 'not an album' as unknown });   // only the v1 → v2 step drops this
    expect(junk.certs).toEqual([]);
  });

  // #65 review: `{ ...s, voice: 'unknown' }` put the key AFTER the spread, so a v1 blob that already carried
  // a verdict (an e2e seed, a save restored from a newer device) came out `unknown` — and the e2e tests
  // seeded with `voice: 'no'` did not start in the state they claimed.
  it('v1 → v2 keeps a voice verdict the blob already carries and adds one only when it is missing', () => {
    expect(migrate({ v: 1, name: 'Seed', voice: 'no' }).voice).toBe('no');
    expect(migrate({ v: 1, name: 'Seed', voice: 'yes' }).voice).toBe('yes');
    expect(migrate({ v: 1, name: 'Seed' }).voice).toBe('unknown');
    expect(migrate({ name: 'Older', voice: 'no' }).voice).toBe('no');   // pre-versioning blobs walk the same step
    expect(migrate({ v: 1, name: 'Seed', voice: 'maybe' }).voice, 'a value outside the union is not a verdict').toBe('unknown');
  });

  // The two features that shared the v1 → v2 step must both land on one blob — the fold is the thing a
  // future reader is most likely to get wrong, so it is pinned rather than left to the two suites above.
  it('the single v1 → v2 step carries both the voice verdict and the certificate album', () => {
    const both = migrate({ v: 1, name: 'Seed', voice: 'yes', certs: 'not an album' as unknown });
    expect(both.voice).toBe('yes');
    expect(both.certs).toEqual([]);
  });

  // #67: the onboarding wizard needs a flag that tells "never played" from "already onboarded", and no
  // existing player may be sent back through it by this update — an existing save with an avatar already
  // counts as onboarded, whatever version it started at.
  it('v2 → v3 marks a save with an avatar already chosen as onboarded, so no current player replays the wizard', () => {
    expect(migrate({ v: 2, name: 'Rey', avatar: 'kai' }).onboarded).toBe(true);
    expect(migrate({ v: 1, name: 'Rey', avatar: 'kai' }).onboarded, 'a v1 blob walks both steps to the same result').toBe(true);
  });
  it('v2 → v3 leaves a save with no avatar chosen not onboarded', () => {
    expect(migrate({ v: 2, name: '' }).onboarded).toBe(false);
    expect(migrate({ v: 2, name: '', avatar: null }).onboarded).toBe(false);
  });
  it('v2 → v3 keeps an explicit onboarded value the blob already carries, avatar or not', () => {
    expect(migrate({ v: 2, avatar: 'kai', onboarded: false }).onboarded).toBe(false);
    expect(migrate({ v: 2, avatar: null, onboarded: true }).onboarded).toBe(true);
  });
  it('a brand-new profile (nothing ever stored) is not onboarded', () => {
    expect(load().onboarded).toBe(false);
  });
  it('a non-boolean onboarded is dropped by sanitizeTypes, then re-derived from avatar by the migration step', () => {
    expect(migrate({ v: 2, avatar: 'kai', onboarded: 'yes' as unknown }).onboarded).toBe(true);
    expect(migrate({ v: 2, avatar: null, onboarded: 'yes' as unknown }).onboarded).toBe(false);
  });

  // #423 review item 4: `certs`/`duels` join the array check every other list field already gets at
  // `sanitizeTypes`'s front door. A blob already at `SAVE_VERSION` skips the migration ladder's own
  // `Array.isArray` filters (`MIGRATIONS[1]`/`MIGRATIONS[3]`, which run only on a blob older than current), so
  // this was the one gap: a non-array `certs`/`duels` on an already-current blob used to reach `{...DEFAULT,
  // ...s}` unfiltered, and only `certificates()`/`duelHistory()`'s own reader-side guard kept it from breaking.
  it('a non-array certs or duels on an already-current save is dropped by sanitizeTypes, not just tolerated at the reader', () => {
    const d = migrate({ v: SAVE_VERSION, certs: 'not an album' as unknown, duels: 'not a history' as unknown });
    expect(d.certs).toEqual([]);
    expect(d.duels).toEqual([]);
  });

  // pr-test-analyzer, #423 review: the test above only checks `migrate()`'s in-memory return. The actual bug
  // was worse than that return alone shows — `load()` caches `migrate(parsed)`, and `save()`'s merge
  // (`{...load(), ...patch}`) re-persists whatever that cache holds on the very next unrelated write, so a
  // corrupt non-array `certs`/`duels` used to survive an ordinary `save({coins: ...})` and ride along in
  // `localStorage` forever rather than being dropped once and forgotten. This proves the fix at that door.
  it('a corrupt certs/duels on disk does not survive an unrelated save, once sanitizeTypes catches it', () => {
    mem['sna:v1'] = JSON.stringify({ v: SAVE_VERSION, certs: 'not an album', duels: 'not a history' });
    save({ coins: 5 });                                                    // an ordinary, unrelated write
    const stored = JSON.parse(mem['sna:v1']);
    expect(stored.certs).toEqual([]);
    expect(stored.duels).toEqual([]);
    expect(stored.coins).toBe(5);
  });

  // pr-test-analyzer, #423 review: `sanitizeTypes` runs on every blob `migrate()` sees, older ones included,
  // strictly before `MIGRATIONS[1]`/`MIGRATIONS[3]` get their own turn at the same fields. The outcome happens
  // to agree with the old ladder-step guard here — both want `[]` for a non-array — but nothing pinned that
  // the new front-door check and the old per-step one do not fight each other on a blob that still has to
  // climb the ladder, only that each alone gives the right answer on a current one.
  it('a non-array certs or duels on an older save is still an empty list after climbing the migration ladder', () => {
    const v1 = migrate({ v: 1, name: 'Ada', certs: 'not an album' as unknown });
    expect(v1.v).toBe(SAVE_VERSION);
    expect(v1.certs).toEqual([]);
    const v3 = migrate({ v: 3, name: 'Ada', duels: 'not a history' as unknown });
    expect(v3.duels).toEqual([]);
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
    const once = migrate({ v: SAVE_VERSION, name: 'Zed', coins: 9, voice: 'yes' });
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

// #205: a certificate used to live only as long as the results overlay was open. On the Android tablet the
// save button does nothing at all, so for that child it never existed. These keep it.
describe('certificate album (#205)', () => {
  beforeEach(() => reset());
  const cert = (p: Partial<StoredCert> = {}): StoredCert => ({
    id: 'year1:y1-bonds', name: 'Ada', avatar: 'volt', year: 'Year 1', title: 'Number bonds',
    stars: 2, score: 80, correct: 8, attempts: 10, date: '2026-09-14', ...p,
  });

  it('keeps one entry per mission, and keeps the best run of it', () => {
    const three = cert({ stars: 3, score: 120, date: '2026-09-12' });
    const one = cert({ stars: 1, score: 20, date: '2026-09-14' });
    // Replaying the same mission badly must not take the three-star certificate away.
    expect(fileCert([three], one)).toEqual([three]);
    expect(fileCert([one], three)).toEqual([three]);
    // Same stars → the higher score wins; an equal run replaces the old, so a renamed child's name follows.
    expect(fileCert([cert({ score: 80 })], cert({ score: 90 }))[0].score).toBe(90);
    expect(fileCert([cert({ score: 90 })], cert({ score: 80 }))[0].score).toBe(90);
    expect(fileCert([cert({ name: 'Ada' })], cert({ name: 'Rey' }))[0].name).toBe('Rey');
  });

  it('files a different mission alongside, most recently earned first', () => {
    const bonds = cert();
    const sensei = cert({ id: 'year1:sensei', title: 'Sensei training', training: true });
    const album = fileCert(fileCert([], bonds), sensei);
    expect(album.map(c => c.id)).toEqual(['year1:sensei', 'year1:y1-bonds']);
    // Re-earning the older one moves it back to the front without duplicating it.
    expect(fileCert(album, cert({ stars: 3 })).map(c => c.id)).toEqual(['year1:y1-bonds', 'year1:sensei']);
  });

  it('caps the album, dropping the oldest', () => {
    let album: StoredCert[] = [];
    for (let i = 0; i < CERT_CAP + 5; i++) album = fileCert(album, cert({ id: `year1:t${i}` }));
    expect(album.length).toBe(CERT_CAP);
    expect(album[0].id).toBe(`year1:t${CERT_CAP + 4}`);                 // newest kept
    expect(album.some(c => c.id === 'year1:t0')).toBe(false);           // oldest dropped
  });

  it('records through the save, and survives a reload', () => {
    expect(certificates()).toEqual([]);
    recordCert(cert());
    recordCert(cert({ id: 'year1:sensei', training: true }));
    expect(certificates().map(c => c.id)).toEqual(['year1:sensei', 'year1:y1-bonds']);
    const stored = JSON.parse(mem['sna:v1']);                           // what a reload would read back
    expect(stored.certs.length).toBe(2);
  });

  it('an export carries the album, and a v1 code from an older build still imports', () => {
    recordCert(cert({ stars: 3 }));
    const code = exportSave();
    reset();
    expect(importSave(code)).toBe(true);
    expect(certificates()[0].stars).toBe(3);
    reset();
    expect(importSave(JSON.stringify({ v: 1, name: 'Old', coins: 5 })), 'a v1 code predates the album').toBe(true);
    expect(certificates()).toEqual([]);
  });

  it('a hand-edited album cannot take the list down with it', () => {
    // The fixture is the point. `'nonsense'`, `null` and `42` are all rejected by the `typeof === 'object'`
    // clause alone, so an album of only those would leave every field check dead. The entries that actually
    // reach a save are the plausible ones: an empty object, a partial, and a truncated paste of a save code —
    // which is exactly how these codes travel between devices (#64).
    const partial = { id: 'year1:y1-bonds', title: 'Number bonds' };
    const truncated = { id: 'year1:y1-add', title: 'Adding', name: 'Ada', year: 'Year 1', date: '2026-09-14', stars: 3 };
    // `avatar: null` is a *valid* value (a child who has not picked an avatar), pinned here alongside the
    // rejected ones — `avatar: str` instead of `avatar: strOrNull` would wrongly drop this and every other
    // test in the file still passes, which is what makes it worth its own row rather than trusting `strOrNull`
    // by inspection (pr-test-analyzer, #422 review).
    const noAvatar = cert({ id: 'year1:y1-count', avatar: null });
    save({ certs: [
      'nonsense', null, 42, {}, partial, truncated, { ...cert(), stars: NaN },
      { ...cert(), avatar: 7 }, { ...cert(), avatar: undefined },   // #422: avatarById()'s fallback used to be
      cert(), noAvatar,                                             // the only thing catching these, silently
    ] as unknown as StoredCert[] });
    expect(certificates()).toEqual([cert(), noAvatar]);
    save({ certs: 'not an album' as unknown as StoredCert[] });
    expect(certificates()).toEqual([]);
  });

  // #422: pinning the deliberate half of the fix, not just the bug. `certKind()`'s own comment in
  // `ui/certificate.ts` says why `training`/`duel` must stay out of this guard: rejecting a malformed flag
  // would drop a certificate the child genuinely earned, which is worse than reading it as the wrong kind.
  // A future "complete the table" pass that starts checking these two would make this red first.
  it('a junk training/duel flag does not filter the certificate out', () => {
    const junk = { ...cert(), training: 'yes', duel: 42 } as unknown as StoredCert;
    save({ certs: [junk] });
    expect(certificates()).toEqual([junk]);
  });

  // The bug a half-checked guard makes rather than prevents: `{ id, title }` passed the first version of
  // `isCert`, and `fileCert` then compared a real `stars: 3` against `undefined` — `3 > undefined` is false —
  // so the junk won every comparison and the earned certificate could never be filed. Storing junk is a
  // nuisance; losing the reward the child actually earned is the thing `fileCert`'s own docblock rules out.
  it('a junk entry under a mission id cannot lock out the certificate a child earns', () => {
    save({ certs: [{ id: 'year1:y1-bonds', title: 'junk' }] as unknown as StoredCert[] });
    const earned = cert({ stars: 3, score: 120 });
    expect(recordCert(earned)).toEqual([earned]);
    expect(certificates()[0].stars, 'the three-star run the child actually earned').toBe(3);
  });

  // The album is data, not PNGs, so the only thing that makes it a certificate again is this function —
  // and the only thing that makes *that* safe is every field drawCertificate() reads being stored.
  it('redraws into the certificate it was earned as', () => {
    const c = certFromStored(cert({ avatar: 'volt' }));
    expect(c.name).toBe('Ada'); expect(c.year).toBe('Year 1'); expect(c.title).toBe('Number bonds');
    expect(c.stars).toBe(2); expect(c.score).toBe(80); expect(c.correct).toBe(8); expect(c.attempts).toBe(10);
    expect(c.avatar.id).toBe('volt');
    expect(certFromStored(cert({ avatar: 'no-such-ninja' })).avatar.id, 'a missing ninja still draws').toBeTruthy();
    // The date is read at LOCAL noon, and this is the assertion that says so. The rendered-string check below
    // cannot carry it alone: CI runs `ubuntu-latest` in UTC, where `new Date('2026-09-14')` — the very
    // regression the fix exists to prevent — renders as 14 September too, so that string was green in the one
    // zone that ever runs it. Local hours are 12 under the fix in every zone, and the runner's own offset
    // under the regression (0 in UTC, 20 in New York, 1 in London): red everywhere except a runner at exactly
    // UTC+12, where midnight UTC *is* local noon and there is no wrong day left to catch.
    expect(c.date!.getHours(), 'read at local noon — UTC midnight renders as the previous day west of Greenwich').toBe(12);
    expect(c.date!.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })).toBe('14 September 2026');
  });
});

describe('duel history (#16)', () => {
  beforeEach(() => reset());
  const duel = (p: Partial<StoredDuel> = {}): StoredDuel => ({
    at: 1_757_000_000_000, topic: 'y1-bonds', title: 'Number bonds', year: 'Year 1',
    winner: 'a', scoreA: 6, scoreB: 4, rounds: 10, ...p,
  });

  // The whole of what makes this different from `fileCert`: a certificate is an award for a mission and there
  // is one per mission, but a duel is an event. Two children who play the same topic five times want five
  // rows. Collapsing them by topic — the obvious thing to copy from the album — would make the list say the
  // afternoon happened once.
  it('keeps every match, newest first, and never collapses a rematch into the one before it', () => {
    const first = duel({ at: 1, winner: 'a', scoreA: 6, scoreB: 4 });
    const rematch = duel({ at: 2, winner: 'b', scoreA: 3, scoreB: 7 });
    const third = duel({ at: 3, winner: 'draw', scoreA: 5, scoreB: 5 });
    const list = fileDuel(fileDuel(fileDuel([], first), rematch), third);
    expect(list.map(m => m.at)).toEqual([3, 2, 1]);
    expect(list.map(m => m.winner)).toEqual(['draw', 'b', 'a']);
    // Same topic, same scoreline, same day: still two rows. `fileCert` would have kept one.
    expect(fileDuel([duel()], duel()).length).toBe(2);
  });

  it('caps the history, dropping the oldest', () => {
    let list: StoredDuel[] = [];
    for (let i = 0; i < DUEL_CAP + 5; i++) list = fileDuel(list, duel({ at: i }));
    expect(DUEL_CAP, 'the value the docstring argues for — "the last few sessions", not an award').toBe(20);
    expect(list.length).toBe(DUEL_CAP);
    expect(list[0].at).toBe(DUEL_CAP + 4);                              // newest kept
    expect(list.some(m => m.at === 0)).toBe(false);                     // oldest dropped
  });

  it('records through the save, and survives a reload', () => {
    expect(duelHistory()).toEqual([]);
    recordDuel(duel({ at: 1 }));
    recordDuel(duel({ at: 2, topic: 'y1-days', title: 'Days of the week' }));
    expect(duelHistory().map(m => m.topic)).toEqual(['y1-days', 'y1-bonds']);
    const stored = JSON.parse(mem['sna:v1']);                           // what a reload would read back
    expect(stored.duels.length).toBe(2);
  });

  // Same fixture reasoning as the album's: the entries that actually reach a save are the plausible ones.
  // `winner` is checked against the three the screen knows, because a fourth value renders as a match nobody
  // won, and the numbers must be finite — `Infinity` formats as "Infinity–0" in a row a child reads.
  it('a hand-edited history cannot take the list down with it', () => {
    // B2 of PR #415's review: the fixture used to hold only `partial`, which is missing `winner`, `at` AND
    // both scores — so the checks that ran first rejected it and the string checks never decided anything.
    // Three of `isDuel`'s clauses could be deleted with the suite green. **Every entry below is a
    // well-formed duel with exactly one bad field**, so each clause is the only thing standing between it and
    // the list: dropping the string checks, the finite checks or the `winner` union each turns this red.
    //
    // `Array.isArray(d)` is the one clause this cannot pin, and saying so beats implying cover it does not
    // have. A save arrives as JSON, and a JSON array cannot carry named members, so an array always fails the
    // string checks a line later — the guard is belt-and-braces against a caller that is not a parsed save,
    // not a load-bearing check. `isCert` has the identical shape and the identical property.
    const partial = { topic: 'y1-bonds', title: 'Number bonds' };
    save({ duels: [
      'nonsense', null, 42, {}, [duel()], partial,                     // shape: not an object, or not this one
      { ...duel(), topic: 42 }, { ...duel(), title: null }, { ...duel(), year: { t: 'Year 1' } },   // one bad string each
      { ...duel(), winner: 'c' }, { ...duel(), winner: null },         // outside the three the screen knows
      { ...duel(), at: NaN }, { ...duel(), scoreA: Infinity },         // and one non-finite number each — the
      { ...duel(), scoreB: Infinity }, { ...duel(), rounds: NaN },     // `6–Infinity` row the comment warns of
      duel(),
    ] as unknown as StoredDuel[] });
    expect(duelHistory()).toEqual([duel()]);
    save({ duels: 'not a history' as unknown as StoredDuel[] });
    expect(duelHistory()).toEqual([]);
  });

  // #423 review item 7: a score or a round count is type-correct and still nonsense once it goes negative or
  // fractional — `scoreB: -5` or `rounds: 1.5` used to pass `isDuel`'s bare `Number.isFinite` check and reach
  // `duelHistoryLine` as-is. `at` is a timestamp, not a count, so it stays on finiteness alone and is not
  // part of this rail.
  it('a duel row with a negative or fractional score or round count is rejected, not just a non-finite one', () => {
    save({ duels: [
      { ...duel(), scoreA: -1 }, { ...duel(), scoreB: -5 }, { ...duel(), rounds: -3 },
      { ...duel(), scoreA: 2.5 }, { ...duel(), rounds: 9.9 },
      duel(),
    ] as unknown as StoredDuel[] });
    expect(duelHistory()).toEqual([duel()]);
  });

  // #423 review item 7 (pr-test-analyzer): the boundary either side of the new check, pinned so a `>= 0` typo
  // (`> 0`, rejecting a legitimate scoreless duel) or a tightened `at` (breaking the deliberate finite-only
  // carve-out `StoredDuel`'s own docstring argues for) would fail here rather than surviving unnoticed.
  it('a zero count is accepted, and a fractional/negative `at` is — deliberately — not', () => {
    save({ duels: [duel({ scoreA: 0, scoreB: 0, rounds: 0 })] });
    expect(duelHistory(), 'no rounds played yet is a real duel, not junk').toEqual([duel({ scoreA: 0, scoreB: 0, rounds: 0 })]);
    save({ duels: [duel({ at: -1 })] });
    expect(duelHistory(), '`at` stays on Number.isFinite, not the count rail').toEqual([duel({ at: -1 })]);
    save({ duels: [duel({ at: 1.5 })] });
    expect(duelHistory(), 'a fractional epoch is still a finite number').toEqual([duel({ at: 1.5 })]);
  });

  // #423 review item 6: `fileDuel` enforces `DUEL_CAP` on every write, but a Restore or a hand-edited save
  // reaches the store by a different door and used to carry as many well-formed rows as it liked straight
  // past `duelHistory()` — 200 rows read back as 200, not "the last few sessions" the cap argues for.
  //
  // Built newest-first, the order `fileDuel` and every legitimate Restore both keep (`StoredDuel.at`'s own
  // docstring: "the list's order and its only identity") — and the test pins WHICH rows survive, not just how
  // many (pr-test-analyzer, #423 review): an ascending fixture would pass a `.slice` that kept the wrong,
  // oldest end just as easily as the right one, which is a silent, wrong-direction data loss on read.
  it('a hand-edited save with more than DUEL_CAP well-formed rows is capped on read, keeping the newest', () => {
    const rows = Array.from({ length: DUEL_CAP + 5 }, (_, i) => duel({ at: DUEL_CAP + 4 - i }));
    save({ duels: rows as unknown as StoredDuel[] });
    const stored = JSON.parse(mem['sna:v1']).duels as StoredDuel[];
    expect(stored.length, 'the save itself still holds every row — this is a read-time cap, not a rewrite').toBe(DUEL_CAP + 5);
    const history = duelHistory();
    expect(history.length).toBe(DUEL_CAP);
    expect(history.map(m => m.at), 'the newest DUEL_CAP rows, oldest 5 dropped — the same bias fileDuel has on write')
      .toEqual(Array.from({ length: DUEL_CAP }, (_, i) => DUEL_CAP + 4 - i));
  });

  // #423 review item 4: `at` is documented as "the list's order and its only identity", but nothing enforced
  // it — `fileDuel` only ever prepends, so ordinary play kept the list newest-first for free, and a Restore or
  // a hand-edited save carrying rows out of `at` order used to render in storage order under "Recent duels".
  it('a hand-edited save with rows out of `at` order reads newest first regardless of storage order', () => {
    save({ duels: [duel({ at: 3 }), duel({ at: 1 }), duel({ at: 5 }), duel({ at: 2 })] });
    expect(duelHistory().map(m => m.at)).toEqual([5, 3, 2, 1]);
  });

  // pr-test-analyzer, #423 review: the sort's tie-break is unstated behaviour, not a rule this file wrote —
  // `Array.prototype.sort`'s spec-guaranteed stability keeps equal-`at` rows in their storage order, which two
  // matches recorded in the same millisecond (a scripted import, or a save merged from two devices) can
  // produce. Pinned by an identifying field (`topic`), since two equal `at` values give no ordering to assert
  // on directly — if `duelHistory()`'s sort ever stopped being stable this would go red without a hand-edited
  // fixture needing to change.
  it('rows tied on `at` keep their storage order — the sort is stable, not merely correct on distinct values', () => {
    save({ duels: [duel({ at: 9, topic: 'first' }), duel({ at: 9, topic: 'second' }), duel({ at: 9, topic: 'third' })] });
    expect(duelHistory().map(m => m.topic)).toEqual(['first', 'second', 'third']);
  });

  // The cap and the sort compose: capping on storage order alone (the old behaviour) could keep an
  // actually-older row over an actually-newer one whenever the two disagree, the same silent, wrong-direction
  // loss review item 6 above closed for a well-ordered save.
  it('caps on the true newest `at`, not the newest by storage position, when the two disagree', () => {
    const rows = [duel({ at: 0 }), ...Array.from({ length: DUEL_CAP }, (_, i) => duel({ at: i + 1 }))];
    save({ duels: rows });
    const history = duelHistory();
    expect(history.length).toBe(DUEL_CAP);
    expect(history.some(m => m.at === 0), 'at:0 is the oldest row and the true newest DUEL_CAP excludes it').toBe(false);
    expect(history[0].at).toBe(DUEL_CAP);
  });

  // A save written before v4 has no duel history to preserve: those matches were never stored. An empty list
  // is the truthful answer, and the v3 → v4 step is what makes it one rather than `undefined` reaching a
  // `.map()` on the rewards screen.
  it('a save from before the history migrates to an empty one, not to a missing field', () => {
    const v3 = migrate({ v: 3, name: 'Ada', coins: 5 });
    expect(v3.v).toBe(SAVE_VERSION);
    expect(v3.duels).toEqual([]);
    expect(migrate({ v: 3, name: 'Ada', duels: [duel(), 'junk'] }).duels).toEqual([duel()]);
  });

  // Seat order, not winner order — the one thing `duelHistoryLine` does not share with `duelHeadline`.
  // Read down a column of twenty rows, a scoreline sorted by winner puts Player 1's score on the left in some
  // rows and the right in others, so "am I getting better?" cannot be answered by looking.
  it('reads a row in seat order, naming the winner in words', () => {
    expect(duelHistoryLine(duel({ winner: 'a', scoreA: 6, scoreB: 4 }))).toBe('Player 1 won · 6–4');
    expect(duelHistoryLine(duel({ winner: 'b', scoreA: 3, scoreB: 7 }))).toBe('Player 2 won · 3–7');
    expect(duelHistoryLine(duel({ winner: 'draw', scoreA: 5, scoreB: 5 }))).toBe('A draw · 5–5');
    // The losing seat's score stays on its own side. This compares the SCORELINE half only: the two rows have
    // different winners, so comparing the whole string is green whatever the scoreline does — it was a vacuous
    // assertion until PR #415's review caught it. Under a sorting mutant both halves read "7–3" and this fails.
    const scoreline = (l: string) => l.split(' · ')[1];
    expect(scoreline(duelHistoryLine(duel({ winner: 'b', scoreA: 3, scoreB: 7 })))).toBe('3–7');
    expect(scoreline(duelHistoryLine(duel({ winner: 'b', scoreA: 3, scoreB: 7 }))))
      .not.toBe(scoreline(duelHistoryLine(duel({ winner: 'a', scoreA: 7, scoreB: 3 }))));
    // **The type claim, pinned.** `duelHistoryLine`'s docstring says a live `DuelResult` is rejected, and
    // that sentence shipped false twice (#415 rounds 1 and 2) because nothing held it. If the parameter is
    // ever widened back to a structural shape or a `Pick` that `DuelResult` satisfies, this stops being an
    // error and `@ts-expect-error` fails the build — which is the only way this claim stays true.
    const live: DuelResult = { winner: 'b', scoreA: 3, scoreB: 7, rounds: 10, tally: { a: { hits: 0, tries: 0 }, b: { hits: 0, tries: 0 } } };
    // @ts-expect-error a DuelResult is not a StoredDuel: no `at`, `topic`, `title` or `year`.
    duelHistoryLine(live);
    // And the headline it is deliberately not: that one sorts, because it is read out once about one match.
    expect(duelHeadline({ winner: 'b', scoreA: 3, scoreB: 7, rounds: 10, tally: { a: { hits: 0, tries: 0 }, b: { hits: 0, tries: 0 } } })).toBe('Player 2 wins 7–3!');
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

/**
 * #95 review: the original fix guarded two readers (`parentSummary()`, the map's star tally) but not `streak`,
 * `dojo`, or the `record*()` writers below — a corrupted `{ v: 1, streak: null }` or `{ v: 1, dojo: null }`
 * still threw, and finishing a topic on a `{ v: 1, progress: null }` save (which the reader fix now lets a
 * player *reach*) threw in `recordTopic()` instead. `migrate()` now drops any field of the wrong type before
 * the `DEFAULT` merge, so every reader gets this for free — these pin the behaviour these tests could not see
 * from `parentSummary()`/`home.ts` alone.
 */
describe('a corrupted save is normalised at the door, not just at two readers (#95)', () => {
  beforeEach(() => reset());

  it('migrate() drops a wrong-typed field instead of carrying it through', () => {
    const m = migrate({ v: 1, streak: null, dojo: null, equipped: 'nope', owned: {}, coins: 'lots' });
    expect(m.streak).toEqual({ last: '', days: 0 });
    expect(m.dojo.date).toBe('');
    expect(m.equipped).toEqual({});
    expect(m.owned).toEqual([]);
    expect(m.coins).toBe(0);
    // a validly-shaped value is left exactly as given, not replaced
    const kept = migrate({ v: 1, streak: { last: '2026-09-10', days: 4 }, coins: 12 });
    expect(kept.streak).toEqual({ last: '2026-09-10', days: 4 });
    expect(kept.coins).toBe(12);
  });

  // Second review round on PR #171: the object/array/number branches above missed every primitive field —
  // `name` above all, since it is the one field a person freely types into the Restore box, and
  // `nameScreen()`'s `esc(d.name)`/`hasName(d.name)` both throw on a non-string.
  it('migrate() drops a wrong-typed primitive field too, not just object/array/number ones', () => {
    const m = migrate({
      v: 1, name: 123, avatar: 42, year: false, voice: 'maybe-ish', sound: 'yes', speech: 1, tutorialSeen: 'true',
    });
    expect(m.name).toBe('');
    expect(m.avatar).toBeNull();
    expect(m.year).toBe('reception');
    expect(m.voice).toBe('unknown');
    expect(m.sound).toBe(true);
    expect(m.speech).toBe(true);
    expect(m.tutorialSeen).toBe(false);
    // valid values, including the legitimate `avatar: null`, are kept exactly as given
    const kept = migrate({ v: 1, name: 'Kai', avatar: null, year: 'year2', voice: 'yes', sound: false });
    expect(kept.name).toBe('Kai');
    expect(kept.avatar).toBeNull();
    expect(kept.year).toBe('year2');
    expect(kept.voice).toBe('yes');
    expect(kept.sound).toBe(false);
  });

  it('a corrupted name does not brick the name screen — importSave() then nameScreen()-shaped reads', () => {
    expect(importSave(JSON.stringify({ v: 1, name: 123, avatar: 'volt' }))).toBe(true);
    const d = load();
    expect(typeof d.name).toBe('string');
    expect(() => esc(d.name)).not.toThrow();
    expect(() => d.name.trim()).not.toThrow();
  });

  // #424: a Restore code is a name a person freely typed, same as the wizard's field, and until this fix
  // sanitizeTypes() only checked `typeof name`, never its length — so an over-length name walked straight
  // past the guard #171 wrote for exactly this write path. Proved red by reverting the `cleanName(clean.name)`
  // line: this then fails with a 400-character `d.name`, `renameProfile`'s own NAME_MAX test unaffected.
  it('a Restore code cannot carry a name past NAME_MAX — sanitizeTypes() clamps, not just type-checks (#424)', () => {
    const long = 'x'.repeat(400);
    expect(importSave(JSON.stringify({ v: SAVE_VERSION, name: long, coins: 0 }))).toBe(true);
    expect(load().name).toBe(long.slice(0, NAME_MAX));
  });

  it('every record*() writer, touchStreak() and recordDojo() survive a save corrupted in every field they touch', () => {
    expect(importSave(JSON.stringify({
      v: 1, name: 'Bad', progress: null, endless: null, sprint: 'nope', boss: [], memory: undefined, training: 42,
      streak: null, dojo: null,
    }))).toBe(true);

    expect(() => recordTopic('y1-add', 2, 40)).not.toThrow();
    expect(() => recordAccuracy('y1-add', { hits: 3, tries: 4 })).not.toThrow();
    expect(() => recordTraining('year1')).not.toThrow();
    expect(() => recordEndless('year1', 50)).not.toThrow();
    expect(() => recordSprint('year1', 20)).not.toThrow();
    expect(() => recordBossWin('year1')).not.toThrow();
    expect(() => recordMemory('year1')).not.toThrow();
    expect(() => touchStreak(new Date('2026-09-16T10:00:00Z'))).not.toThrow();
    expect(() => recordDojo({ mode: 'mission', won: true, correct: 5, attempts: 5, bestCombo: 3, stars: 3, score: 90 })).not.toThrow();
    expect(() => dojoToday(new Date('2026-09-16T10:00:00Z'))).not.toThrow();

    // and the writes actually landed — this is recovery, not merely surviving
    expect(load().progress['y1-add']).toMatchObject({ stars: 2 });
    expect(load().endless.year1).toBe(50);
  });

  /**
   * #363: the loop above stops at `isRecord(clean.dojo)`, and `dojo` is the one key whose interior is read
   * without a guard. `dojoFor()` rebuilds only a *stale* state, so a record carrying TODAY's date — what a
   * game finished today meets — went straight into `carriedStreak()` and `applyEvent()` and threw. Every
   * case below is reachable through the Restore box, which only checks that `v` is an integer in range.
   */
  describe('a record-shaped but broken `dojo` (#363)', () => {
    const today = new Date('2026-09-20T10:00:00Z');
    const iso = '2026-09-20';
    const finish = () => recordDojo({ mode: 'mission', won: true, correct: 20, attempts: 20, bestCombo: 6, stars: 3, score: 90 }, today);
    const broken: Record<string, unknown> = {
      'only a date — the shape a truncated blob leaves': { date: iso },
      'no streak': { date: iso, progress: {}, done: [], total: 0 },
      'a streak that is not a record': { date: iso, progress: {}, done: [], streak: 'nope', total: 0 },
      'a streak missing its fields': { date: iso, progress: {}, done: [], streak: {}, total: 0 },
      // PR #408 review B2: without this row the `typeof dj.streak.last === 'string'` clause could be
      // deleted with all 104 tests still passing — `streak: {}` fails on `last` *and* `days`, and a
      // wrong-typed `days` fails only on `days`, so nothing isolated `last`.
      'streak.last not a string': { date: iso, progress: {}, done: [], streak: { last: 5, days: 0 }, total: 0 },
      'streak.days not a number': { date: iso, progress: {}, done: [], streak: { last: '', days: 'four' }, total: 0 },
      '`done` not an array': { date: iso, progress: {}, done: 1, streak: { last: '', days: 0 }, total: 0 },
      '`progress` not a record': { date: iso, progress: [], done: [], streak: { last: '', days: 0 }, total: 0 },
      'a date that is not a string': { date: 20260920, progress: {}, done: [], streak: { last: '', days: 0 }, total: 0 },
      'no total': { date: iso, progress: {}, done: [], streak: { last: '', days: 0 } },
    };

    it.each(Object.keys(broken))('%s: the day ends normally and the coins are paid', (name) => {
      expect(importSave(JSON.stringify({ v: 3, name: 'Ada', avatar: 'volt', dojo: broken[name] })), name).toBe(true);
      // The key is gone and `DEFAULT` has filled it back in — which is the fix, rather than each reader of
      // the interior coping (the three results screens reach `applyEvent()` through `recordGameEnd()` since
      // #365; `dojoCard()` and `dojoToday()` read it directly). Three of these shapes throw without it and the rest load a
      // half-built state, so this line is what every case here pins.
      expect(load().dojo, name).toEqual({ date: '', progress: {}, done: [], setDone: false, streak: { last: '', days: 0 }, total: 0 });
      // `carriedStreak`, not `dojoToday`: the map screen's `dojoCard()` is the FIRST reader of the interior
      // and it reads a superset of what `applyEvent()` does, so this is the call that actually threw (PR
      // #408 review, note 7 — `dojoFor()` reads only `.date` and was never at risk).
      expect(() => carriedStreak(load().dojo, iso), name).not.toThrow();
      let out: ReturnType<typeof recordDojo> | undefined;
      expect(() => { out = finish(); }, name).not.toThrow();
      // Not merely "did not throw": the bad key is replaced by the default, so the day's challenges are
      // scored and their bonus is actually earned and written.
      expect(out!.completed.length, name).toBeGreaterThan(0);
      expect(out!.coins, name).toBeGreaterThan(0);
      expect(load().dojo.date, name).toBe(iso);
    });

    it('a well-formed `dojo` is left exactly as given — the streak and lifetime total survive', () => {
      const good = { date: iso, progress: { correct15: 3 }, done: [], setDone: false, streak: { last: '2026-09-19', days: 4 }, total: 11 };
      expect(importSave(JSON.stringify({ v: 3, name: 'Ada', avatar: 'volt', dojo: good }))).toBe(true);
      expect(load().dojo).toEqual(good);
      // and a stale-dated one still rolls over rather than being deleted: streak and total carry into today
      const stale = { ...good, date: '2026-09-18' };
      expect(importSave(JSON.stringify({ v: 3, name: 'Ada', avatar: 'volt', dojo: stale }))).toBe(true);
      const rolled = dojoToday(today);
      expect(rolled.date).toBe(iso);
      expect(rolled.streak).toEqual({ last: '2026-09-19', days: 4 });
      expect(rolled.total).toBe(11);
    });
  });
});

// #115: the grown-ups "Start again" action clears the save through this function rather than a raw
// `localStorage.clear()`, so this is the one place the reset behaviour needs pinning.
describe('reset() (#115)', () => {
  it('returns every key to its default value, and the result is already the current shape', () => {
    save({ name: 'Ada', avatar: 'volt', year: 'year2', sound: false, speech: false, voice: 'yes', coins: 500 });
    recordTopic('add-10', 3, 44); recordSprint('year1', 90); recordBossWin('year1'); recordMemory('year1');
    recordTraining('year1'); addCoins(500); touchStreak(new Date('2026-09-10T09:00:00Z'));
    recordCert({ id: 'year1:add-10', name: 'Ada', avatar: 'volt', year: 'Year 1', title: 'Add 10', stars: 3, score: 44, correct: 4, attempts: 4, date: '2026-09-10' });

    reset();
    const d = load();
    expect(d.name).toBe(''); expect(d.avatar).toBeNull(); expect(d.year).toBe('reception');
    expect(d.sound).toBe(true); expect(d.speech).toBe(true); expect(d.voice).toBe('unknown');
    expect(d.progress).toEqual({});
    expect(d.endless).toEqual({}); expect(d.sprint).toEqual({}); expect(d.boss).toEqual({});
    expect(d.memory).toEqual({}); expect(d.training).toEqual({});
    expect(d.coins).toBe(0); expect(d.spent).toBe(0); expect(d.stickers).toEqual([]);
    expect(d.streak).toEqual({ last: '', days: 0 }); expect(d.tutorialSeen).toBe(false);
    expect(d.owned).toEqual([]); expect(d.equipped).toEqual({}); expect(d.certs).toEqual([]);
    expect(d.v).toBe(SAVE_VERSION);
    expect(migrate(d)).toEqual(d);   // already the current shape — passing it through migrate() changes nothing
  });

  it('a save() made before leaving the screen brings a reset player back exactly (the "Undo" affordance)', () => {
    save({ name: 'Ada', avatar: 'volt', coins: 120 }); addCoins(0); recordTopic('add-10', 2, 30);
    const snapshot = load();   // what the grown-ups screen keeps in memory before calling reset()

    reset();
    expect(load().name).toBe('');

    save(snapshot);            // "Undo" — save() replaces the whole record because the patch already has every key
    expect(load()).toEqual(snapshot);
  });
});

/**
 * #232 — a save from a **newer** build must never be relabelled as this build's shape.
 *
 * `migrate()` ended `while (v < SAVE_VERSION && MIGRATIONS[v]) …; return { ...DEFAULT, ...s, v: SAVE_VERSION }`.
 * A `{ v: 3 }` blob fails the loop condition immediately (`3 < 2` is false) and falls through to a return that
 * stamps `v: 2` over v3-shaped data — then `load()` caches it and the next `save()` writes it back, so the
 * mislabelling is permanent, with whatever v3 added sitting unrecognised and whatever v3 *renamed* read under
 * its old name. `importSave()` has always refused a newer code for exactly this reason; this is `load()`'s half.
 *
 * The sequence is ordinary, not exotic: the APK and the web build do not update together (#64 is the whole
 * reason the save code exists), so one device is routinely a version ahead of the other.
 *
 * Behaviour chosen: **refuse and keep the blob untouched.** The session runs on defaults and `save()` writes
 * nothing, so downgrading a build and upgrading again does not cost the child their progress. Refusing *and
 * resetting* was the two-line alternative and was rejected: it discards a save the other device can still read.
 *
 * These are behavioural, and deliberately so — the text rail in `guardrails.test.ts` can see that the guard is
 * still called, but not that it still works, so it is these tests that hold the behaviour (#205's lesson).
 */
describe('a save from a newer build is refused, not down-stamped (#232)', () => {
  const KEY = 'sna:v1';
  beforeEach(() => reset());

  it('never stamps SAVE_VERSION over a version it could not read', () => {
    expect(migrate({ v: SAVE_VERSION + 1, name: 'Future' }).v).not.toBe(SAVE_VERSION + 1);
    // The fault itself: the returned save must not claim to be our shape when the input was not.
    for (const blob of [{ v: SAVE_VERSION + 1 }, { v: SAVE_VERSION + 9 }, { v: 'two' }, { v: null }, { v: {} }, { v: 1.5 }, { v: -3 }, { v: 0 }]) {
      expect(isMigratable(blob as Record<string, unknown>), `${JSON.stringify(blob)} is not migratable`).toBe(false);
      expect(migrate(blob).name, `${JSON.stringify(blob)} must yield a fresh default, not a relabelled blob`).toBe('');
    }
    // …while everything we *can* read still migrates exactly as before.
    for (let v = 1; v <= SAVE_VERSION; v++) expect(isMigratable({ v })).toBe(true);
    expect(isMigratable({})).toBe(true);                     // pre-versioning blobs are readable as v1
    expect(migrate({ v: 1, name: 'Kai' }).name).toBe('Kai');
  });

  it('leaves the newer blob on disk, and save() does not overwrite it', () => {
    const newer = JSON.stringify({ v: SAVE_VERSION + 1, name: 'Tablet', coins: 500, somethingV3: 'kept' });
    localStorage.setItem(KEY, newer);
    expect(load().name, 'the session runs on defaults').toBe('');
    expect(load().coins).toBe(0);
    expect(isReadOnlySave(), 'the read-only latch is set').toBe(true);
    save({ coins: 7 });                                      // an ordinary gameplay write
    expect(localStorage.getItem(KEY), 'the stored blob is byte-for-byte untouched').toBe(newer);
    expect(load().coins, 'but the running session still sees its own state').toBe(7);
  });

  // Review of the first cut: refusing to *read* an unreadable `v` and refusing to *write* over it are two
  // decisions, and only the first is #232's. A shape no build ever wrote has nothing on the other side to
  // preserve, so latching it would leave the device silently unable to save for good — `reset()` has no
  // caller in the app and `?reset` cannot be typed into a Capacitor WebView. It resets instead.
  it('an unreadable `v` is refused as data, but writes resume so the device is not bricked', () => {
    const mangled = JSON.stringify({ v: 'two', name: 'Mangled', coins: 3 });
    localStorage.setItem(KEY, mangled);
    expect(load().name, 'the ladder does not run over it').toBe('');
    expect(isReadOnlySave(), 'and it is NOT latched — nothing is being protected').toBe(false);
    save({ coins: 99 });
    expect(localStorage.getItem(KEY), 'the corrupt blob is replaced').not.toBe(mangled);
    expect(JSON.parse(localStorage.getItem(KEY)!).coins).toBe(99);
    expect(JSON.parse(localStorage.getItem(KEY)!).v, 'with a version we can read next time').toBe(SAVE_VERSION);
  });

  it('an ordinary save still writes, and the latch clears on reset and on a deliberate import', () => {
    localStorage.setItem(KEY, JSON.stringify({ v: SAVE_VERSION + 1, name: 'Tablet' }));
    expect(load().name).toBe('');
    expect(isReadOnlySave()).toBe(true);

    // importSave() is the grown-up deliberately replacing the blob, so the protection ends with it.
    reset();
    localStorage.setItem(KEY, JSON.stringify({ v: SAVE_VERSION + 1, name: 'Tablet' }));
    load();
    expect(importSave(JSON.stringify({ ...load(), v: SAVE_VERSION, name: 'Chosen' })), 'a readable code restores').toBe(true);
    expect(isReadOnlySave(), 'and the latch is cleared by it').toBe(false);
    save({ coins: 4 });
    expect(JSON.parse(localStorage.getItem(KEY)!).coins, 'writes resume').toBe(4);

    // reset() removes the blob there was something to protect, so the latch goes with it. Asserted from a
    // *freshly latched* state: the first cut checked it here, after importSave() had already cleared the
    // latch, so deleting `readOnly = false` from reset() left every test green (review finding 4).
    reset();   // drop the cache first: load() recomputes the latch only on a miss
    localStorage.setItem(KEY, JSON.stringify({ v: SAVE_VERSION + 1, name: 'Tablet' }));
    load();
    expect(isReadOnlySave(), 'latched again before reset() is exercised').toBe(true);
    reset();
    expect(isReadOnlySave(), 'reset() clears the latch on its own').toBe(false);
    save({ coins: 11 });
    expect(JSON.parse(localStorage.getItem(KEY)!).coins).toBe(11);
  });

  // The other mutant that survived the first cut, and it is #232 through a second door: moving
  // `readOnly = false` to the top of importSave() lifts the protection for a code that is then REFUSED.
  // The grown-up on the older phone pastes the tablet's newer code, it is correctly rejected — and the
  // next ordinary save() relabels the tablet's blob anyway.
  it('a REFUSED import leaves the latch exactly as it was', () => {
    const newer = JSON.stringify({ v: SAVE_VERSION + 1, name: 'Tablet', coins: 500 });
    localStorage.setItem(KEY, newer);
    load();
    expect(isReadOnlySave()).toBe(true);
    expect(importSave(JSON.stringify({ v: SAVE_VERSION + 1, name: 'AlsoNewer' })), 'a newer code is refused').toBe(false);
    expect(isReadOnlySave(), 'and refusing it must not lift the protection').toBe(true);
    expect(importSave('not json at all'), 'so must a malformed one').toBe(false);
    expect(isReadOnlySave()).toBe(true);
    save({ coins: 1 });
    expect(localStorage.getItem(KEY), 'the newer blob is still intact').toBe(newer);
  });

  // Review finding 3: the latch was lifted before anything knew the replacement had landed. If setItem
  // throws (private mode, a WebView with DOM storage off, quota), the newer blob is still on disk — and
  // clearing the latch there lets the next ordinary save() relabel it, which is #232 restored through the
  // one line this fix added. Narrow window (a failed write, then a later successful one), but it is the
  // exact failure the rest of the PR exists to prevent.
  it('a failed import write leaves the protection in place', () => {
    const newer = JSON.stringify({ v: SAVE_VERSION + 1, name: 'Tablet', coins: 500 });
    reset();
    localStorage.setItem(KEY, newer);
    load();
    expect(isReadOnlySave()).toBe(true);

    const realSet = localStorage.setItem;
    (localStorage as unknown as { setItem: unknown }).setItem = () => { throw new Error('quota'); };
    try {
      importSave(JSON.stringify({ v: SAVE_VERSION, name: 'Chosen', coins: 1 }));
    } finally {
      (localStorage as unknown as { setItem: unknown }).setItem = realSet;
    }
    expect(isReadOnlySave(), 'the write did not land, so the newer blob is still there to protect').toBe(true);
    save({ coins: 3 });
    expect(localStorage.getItem(KEY), 'and it is still intact').toBe(newer);
  });

  // The review's blocking 1, and the worst of the four: under the latch `load()` is a fresh default, so
  // exporting it handed the grown-up a **valid** code carrying no progress — and `parents.ts` tells them to
  // paste it into Restore on the other device, which is the one holding the real save. The protection
  // mechanism became a better data-loss path than the bug it fixed.
  it('exportSave() moves the real stored blob under the latch, never a blank default', () => {
    const newer = JSON.stringify({ v: SAVE_VERSION + 1, name: 'Ada', coins: 500, somethingV3: 'kept' });
    localStorage.setItem(KEY, newer);
    expect(load().name, 'the session still runs on defaults').toBe('');
    expect(isReadOnlySave()).toBe(true);
    const code = exportSave();
    expect(code, 'the code is the stored save, byte for byte').toBe(newer);
    expect(JSON.parse(code).coins, 'so it carries the progress that actually exists').toBe(500);
    expect(JSON.parse(code).v, 'and it still declares the newer version').toBe(SAVE_VERSION + 1);
    // …which means an older build refuses it rather than silently importing a blank, and the good device
    // (whose SAVE_VERSION is higher) is the one that can read it.
    reset(); save({ name: 'Ada', coins: 500 });
    expect(importSave(code), 'this build cannot read it, so it declines').toBe(false);
    expect(load().coins, 'and the device it was pasted into is untouched').toBe(500);
  });

  it('exportSave() is unchanged when there is no latch', () => {
    reset(); save({ name: 'Kai', coins: 21 });
    const code = exportSave();
    expect(JSON.parse(code).name).toBe('Kai');
    expect(JSON.parse(code).coins).toBe(21);
    expect(JSON.parse(code).v).toBe(SAVE_VERSION);
    expect(importSave(code)).toBe(true);
  });

  it('importSave() still refuses a newer code, unchanged', () => {
    reset(); save({ name: 'Here', coins: 12 });
    expect(importSave(JSON.stringify({ v: SAVE_VERSION + 1, name: 'Future' }))).toBe(false);
    expect(load().name, 'a refused code changes nothing').toBe('Here');
    expect(load().coins).toBe(12);
  });
});

// #151: save() used to swallow a thrown setItem with no trace anywhere, so a shop purchase, a star or a
// streak day could vanish on the next launch with nothing distinguishing that from an ordinary save. These
// pin the new signal and, most importantly, that it is a *different* signal from #232's read-only latch —
// conflating them would send a grown-up to "update this device" for a plain private-browsing tab, or make
// them wait for a device update that a broken localStorage will never need.
describe('save() write failures are distinguishable from the read-only latch (#151)', () => {
  const KEY = 'sna:v1';
  beforeEach(() => reset());

  it('an ordinary save clears the flag; a thrown setItem sets it; a later success clears it again', () => {
    expect(isWriteFailing(), 'nothing has failed yet').toBe(false);
    save({ coins: 5 });
    expect(isWriteFailing()).toBe(false);

    const realSet = localStorage.setItem;
    (localStorage as unknown as { setItem: unknown }).setItem = () => { throw new Error('quota'); };
    try { save({ coins: 6 }); } finally { (localStorage as unknown as { setItem: unknown }).setItem = realSet; }
    expect(isWriteFailing(), 'the write just threw').toBe(true);
    expect(load().coins, 'the running session still sees its own state').toBe(6);
    expect(JSON.parse(localStorage.getItem(KEY)!).coins, 'nothing landed on disk').toBe(5);

    save({ coins: 7 });
    expect(isWriteFailing(), 'a later write that succeeds clears it again').toBe(false);
    expect(JSON.parse(localStorage.getItem(KEY)!).coins).toBe(7);
  });

  it('the read-only latch is a refusal to attempt a write at all, and never touches the write-failure flag', () => {
    localStorage.setItem(KEY, JSON.stringify({ v: SAVE_VERSION + 1, name: 'Tablet', coins: 500 }));
    load();
    expect(isReadOnlySave(), 'a newer blob latches read-only').toBe(true);
    expect(isWriteFailing(), 'load() never sets or clears the write-failure flag').toBe(false);
    save({ coins: 1 });
    expect(isWriteFailing(), 'a latched save() never attempts setItem, so nothing here can fail').toBe(false);
  });

  it('reset() clears the write-failure flag along with the latch — a fresh start gives the device the benefit of the doubt', () => {
    const realSet = localStorage.setItem;
    (localStorage as unknown as { setItem: unknown }).setItem = () => { throw new Error('quota'); };
    try { save({ coins: 1 }); } finally { (localStorage as unknown as { setItem: unknown }).setItem = realSet; }
    expect(isWriteFailing()).toBe(true);
    reset();
    expect(isWriteFailing(), 'reset() clears it, same as the read-only latch').toBe(false);
  });
});

/*
 * #20 slice 1 — siblings on one device, at the storage layer only.
 *
 * The behaviour these pin, in the owner's words (in session, 2026-09-19): the existing save becomes profile 1
 * losing nothing; at most four profiles; nothing changes for a device with one profile. Everything above this
 * block is the single-profile suite and is *also* the regression test for that last claim — it addresses
 * `sna:v1` by name throughout and was not touched by this change.
 */
describe('profiles: siblings on one device (#20)', () => {
  const INDEX = 'sna:profiles';
  // Back to a one-profile device, for a module that keeps session state of its own. The switch is doing the
  // work, and `reset()` cannot stand in for it: `reset()` deliberately does **not** end the session's binding
  // — a fresh start is the same child — so a test that finished playing as p2 would otherwise have the next
  // test's `save()` land in p2, and it must not leave a latch of its own either, or a test that seeds an index
  // naming p2 would still be read as p1. The old helper claimed dropping the index was enough; it never was,
  // because `sessionProfile()` returns the latched profile and never consults the index, and profile 1 leaked
  // from one test into the next (#330 round 2, item 2).
  const freshDevice = () => {
    // `reset()` first, for the cache and both write latches. `setActiveProfile` used to clear those too, as a
    // side effect of re-entering the active profile, and this helper leaned on it — but a re-entry now keeps
    // the cached blob whenever a latch says it diverges from disk (#380 review round 4, B1), so a test that
    // ended under a throwing `setItem` would hand the next one its coins and its fault. The switch below is
    // still what ends the session's *binding*, which `reset()` deliberately does not touch.
    reset();
    for (const id of PROFILE_IDS) localStorage.removeItem(saveKeyFor(id));
    localStorage.removeItem(INDEX);
    expect(setActiveProfile('p1'), 'the teardown checks its own switch').toEqual({ ok: true });   // clears the session's profile
    localStorage.removeItem(INDEX);  // ...and a one-profile device stores no index
  };
  it('the teardown leaves no cached blob and no latch, whatever the test before it did', () => {
    // The helper's own regression: this is the state #380 review round 4's fix makes survive a re-entry, so
    // if `freshDevice` ever drops its `reset()` the leak is a red test here rather than a puzzle two
    // describes later.
    const realSet = localStorage.setItem;
    (localStorage as unknown as { setItem: unknown }).setItem = () => { throw new Error('quota'); };
    try { save({ name: 'Ada', coins: 99 }); } finally { (localStorage as unknown as { setItem: unknown }).setItem = realSet; }
    expect(isWriteFailing(), 'the test before us ended on a store that refused').toBe(true);
    freshDevice();
    expect(isWriteFailing(), 'the next test does not inherit the fault').toBe(false);
    expect(load(), 'nor the blob it was holding').toMatchObject({ name: '', coins: 0 });
  });
  it('the teardown really does hand each test an empty device', () => {
    save({ name: 'Ada', coins: 50 });
    expect(addProfile()).toEqual({ ok: true, id: 'p2' });
    save({ name: 'Bo' });
    freshDevice();
    expect(localStorage.getItem(INDEX)).toBeNull();
    for (const id of PROFILE_IDS) expect(localStorage.getItem(saveKeyFor(id)), id).toBeNull();
    expect(load().name, 'and the module is not still latched to the sibling').toBe('');
    save({ name: 'Cass' });
    expect(JSON.parse(localStorage.getItem(saveKeyFor('p1'))!).name, 'the next test writes to profile 1').toBe('Cass');
  });
  beforeEach(freshDevice);

  it('a device with one profile stores no index at all, and profile 1 is the save that is already there', () => {
    localStorage.setItem(saveKeyFor('p1'), JSON.stringify({ v: SAVE_VERSION, name: 'Ada', coins: 42 }));
    expect(saveKeyFor('p1'), 'profile 1 is not moved off the historical key').toBe('sna:v1');
    expect(activeProfile()).toBe('p1');
    expect(profileIds()).toEqual(['p1']);
    expect(localStorage.getItem(INDEX), 'one profile costs no stored key').toBeNull();
    expect(load().name, 'the v3 save is read in place, unmigrated and unmoved').toBe('Ada');
    expect(load().coins).toBe(42);
  });

  it('an empty store reads as one profile on defaults, and writes profile 1 where it always wrote', () => {
    expect(profileIds()).toEqual(['p1']);
    expect(load().coins).toBe(0);
    save({ name: 'Bo', coins: 7 });
    expect(JSON.parse(localStorage.getItem('sna:v1')!).name).toBe('Bo');
  });

  it('two profiles keep separate coins, progress and certificates', () => {
    save({ name: 'Ada' }); addCoins(50); recordTopic('y1-bonds', 3, 90);
    recordCert({ id: 'year1:y1-bonds', name: 'Ada', avatar: 'volt', year: 'Year 1', title: 'Number bonds', stars: 3, score: 90, correct: 6, attempts: 6, date: '2026-09-20' });

    const second = addProfile();
    expect(second).toEqual({ ok: true, id: 'p2' });
    expect(activeProfile()).toBe('p2');
    expect(profileIds()).toEqual(['p1', 'p2']);
    expect(load().name, 'a new profile starts on defaults, ready for onboarding').toBe('');
    expect(load().coins).toBe(0);
    expect(load().progress).toEqual({});
    expect(certificates()).toEqual([]);

    save({ name: 'Bo' }); addCoins(5); recordTopic('r-count', 1, 10);

    expect(setActiveProfile('p1')).toEqual({ ok: true });
    expect(load().name).toBe('Ada');
    expect(load().coins).toBe(50);
    expect(load().progress['y1-bonds']).toMatchObject({ stars: 3, best: 90 });
    expect(load().progress['r-count'], "the sibling's progress is not here").toBeUndefined();
    expect(certificates().map(c => c.id)).toEqual(['year1:y1-bonds']);

    expect(setActiveProfile('p2')).toEqual({ ok: true });
    expect(load().name).toBe('Bo');
    expect(load().coins).toBe(5);
    expect(certificates(), "and Ada's certificate is not in Bo's album").toEqual([]);
    expect(localStorage.getItem('sna:v1:p2'), 'the sibling has a key of their own').not.toBeNull();
  });

  it('stops at four profiles', () => {
    expect(addProfile()).toEqual({ ok: true, id: 'p2' });
    expect(addProfile()).toEqual({ ok: true, id: 'p3' });
    expect(addProfile()).toEqual({ ok: true, id: 'p4' });
    expect(profileIds().length).toBe(MAX_PROFILES);
    const before = localStorage.getItem(INDEX);
    expect(addProfile(), 'the fifth is refused, and as full rather than as a store fault').toEqual({ ok: false, why: 'full' });
    expect(profileIds()).toEqual(['p1', 'p2', 'p3', 'p4']);
    // Read the store, not `activeProfile()`: `addProfile` short-circuits on `!free` before it writes, so the
    // old assertion could not fail whatever the refusal did (#330 review N8).
    expect(localStorage.getItem(INDEX), 'and the refusal leaves the stored index exactly as it was').toBe(before);
    expect(profileIds().length, 'four is the cap, and the cap is the length of the slot list').toBe(MAX_PROFILES);

    // p3 and p4 existed only in the index: every isolation assertion in this block was p1-against-p2, so two
    // of the owner's four slots had their key derivation held by nothing, and what that hides is the
    // feature's headline failure — two children silently sharing one save (#330 round 3, item 2).
    const NAMES = [['p1', 'Ada'], ['p2', 'Bo'], ['p3', 'Cass'], ['p4', 'Dee']] as const;
    for (const [id, name] of NAMES) { expect(setActiveProfile(id), id).toEqual({ ok: true }); save({ name }); }
    for (const [id, name] of NAMES) {
      expect(JSON.parse(localStorage.getItem(saveKeyFor(id))!).name, `${id} has a key of its own`).toBe(name);
      expect(setActiveProfile(id), id).toEqual({ ok: true });
      expect(load().name, `${id} reads back its own child`).toBe(name);
    }
    expect(new Set(NAMES.map(([id]) => saveKeyFor(id))).size, 'four slots, four keys').toBe(MAX_PROFILES);
  });

  it('a corrupt index falls back to profile 1 with its save intact, and keeps the siblings it can see', () => {
    // Seeded straight into the store rather than through save(): this is a *relaunch* on a device whose
    // index has been corrupted, and `reset()` is a fresh start for one profile, not a way to reload.
    localStorage.setItem(saveKeyFor('p1'), JSON.stringify({ v: SAVE_VERSION, name: 'Ada', coins: 30 }));
    localStorage.setItem(saveKeyFor('p2'), JSON.stringify({ v: SAVE_VERSION, name: 'Bo', coins: 3 }));
    localStorage.setItem(INDEX, '{not json at all');

    expect(activeProfile(), 'not a blank game — profile 1').toBe('p1');
    expect(load().name).toBe('Ada');
    expect(load().coins).toBe(30);
    expect(profileIds(), "the sibling's save is still on disk, so it is not orphaned").toEqual(['p1', 'p2']);
    expect(localStorage.getItem(INDEX), 'a blob we could not parse is not overwritten until a profile action asks').toBe('{not json at all');
  });

  it.each([
    // `'"p2"'` would be refused a third time over by `!Array.isArray(ids)`, so it pinned nothing. These two
    // reach the object guard itself: without it the destructure throws, and `activeProfile()`, `profileIds()`
    // and `load()` throw with it — the whole recovery this block is about never runs (#330 round 2, N1).
    ['null', 'null'],
    ['an array', '[]'],
    // These two name a second profile on purpose: with `v` unchecked, an accepted index yields
    // `['p1','p2']` and an active p2 on defaults, so the row discriminates instead of agreeing with refusal.
    ['no version', JSON.stringify({ active: 'p2', ids: ['p1', 'p2'] })],
    ['a version no build here wrote', JSON.stringify({ v: 2, active: 'p2', ids: ['p1', 'p2'] })],
    ['no ids', JSON.stringify({ v: 1, active: 'p1' })],
    // Truthy but not an array: the falsy row above reaches only half of `!Array.isArray(ids)`, and without
    // the other half this blob puts `ids.every is not a function` through `profileIds()` (#330 round 3, N3).
    ['ids that are not an array', JSON.stringify({ v: 1, active: 'p1', ids: 'p1' })],
    ['an unknown slot', JSON.stringify({ v: 1, active: 'p1', ids: ['p1', 'p9'] })],
    ['a duplicate slot', JSON.stringify({ v: 1, active: 'p1', ids: ['p1', 'p1'] })],
    ['an active profile that is not in ids', JSON.stringify({ v: 1, active: 'p3', ids: ['p1', 'p2'] })],

  ])('an index with %s is refused rather than half-trusted', (_why, blob) => {
    localStorage.setItem(saveKeyFor('p1'), JSON.stringify({ v: SAVE_VERSION, name: 'Ada' }));
    localStorage.setItem(INDEX, blob);
    // The assertion that discriminates (#330 review, item 1). Every fixture but one already says
    // `active: 'p1'`, so `activeProfile() === 'p1'` and the name below are identities under a *half-trusted*
    // reading too, and three of these rows stayed green with their clause deleted from `readIndex`. Under
    // refusal `defaultIndex()` probes and finds only p1's key; under half-trust the half-valid list survives.
    expect(profileIds(), 'the half-valid list must not reach a caller').toEqual(['p1']);
    expect(activeProfile()).toBe('p1');
    expect(load().name).toBe('Ada');
  });

  it('switching to a profile that does not exist changes nothing', () => {
    save({ name: 'Ada' });
    expect(setActiveProfile('p2'), 'a stale card, not a store fault (#401 item 5)').toEqual({ ok: false, why: 'unknown' });
    // Nothing written, not merely nothing visible (#330 review, item 1's coda): writing the index *before*
    // the membership check left 80/80 green, because `readIndex` then rejects the bogus index it just wrote.
    expect(localStorage.getItem(INDEX), 'the refusal does not write an index on the way out').toBeNull();
    expect(activeProfile()).toBe('p1');
    expect(load().name).toBe('Ada');
  });

  it('a store that refuses the index keeps the child on the profile they are already playing (#151)', () => {
    save({ name: 'Ada', coins: 12 });
    addProfile();                                   // p2 exists and is active
    save({ name: 'Bo' });
    const realSet = localStorage.setItem;
    (localStorage as unknown as { setItem: unknown }).setItem = () => { throw new Error('quota'); };
    try {
      expect(setActiveProfile('p1'), 'an unpersisted switch is reported, not pretended').toEqual({ ok: false, why: 'store' });
      expect(addProfile(), 'and no profile is added either').toEqual({ ok: false, why: 'store' });
    } finally { (localStorage as unknown as { setItem: unknown }).setItem = realSet; }
    expect(activeProfile(), 'still Bo, which is what the next launch will also read').toBe('p2');
    expect(load().name).toBe('Bo');
  });

  it('export and restore act on the active profile, not on profile 1', () => {
    save({ name: 'Ada', coins: 99 });
    const adaCode = exportSave();
    // Move profile 1 on *after* the code is taken, so the code and the slot it must not touch differ. With
    // both at 99 coins, clobbering p1 with the code is undetectable — the identity the review caught.
    save({ coins: 7 });
    expect(addProfile()).toEqual({ ok: true, id: 'p2' });
    save({ name: 'Bo', coins: 1 });
    expect(JSON.parse(exportSave()).name, 'the code carries whoever is playing').toBe('Bo');

    expect(importSave(adaCode)).toBe(true);
    // Read the store, not `load()`: `importSave` fills `cache` whichever key its `setItem` targeted, so the
    // cache cannot tell a restore into p2 from one that overwrote p1 (#330 review, item 2). This is the line
    // that stops a grown-up restoring the second child's code over the first child's game.
    const stored = (id: 'p1' | 'p2') => JSON.parse(localStorage.getItem(saveKeyFor(id))!);
    expect(stored('p2'), "the restore lands in the active profile's slot").toMatchObject({ name: 'Ada', coins: 99 });
    expect(stored('p1'), 'and profile 1 is left exactly as it was').toMatchObject({ name: 'Ada', coins: 7 });

    // and it reads back through a real switch, not through the cache the import just filled
    expect(setActiveProfile('p1')).toEqual({ ok: true });
    expect(load().coins).toBe(7);
    expect(setActiveProfile('p2')).toEqual({ ok: true });
    expect(load().coins).toBe(99);
  });

  it("a sibling's own blob is what export moves when their save is read-only (#232)", () => {
    localStorage.setItem(saveKeyFor('p1'), JSON.stringify({ v: SAVE_VERSION, name: 'Ada', coins: 99 }));
    // The sibling plays on a device that has seen a newer build, so `exportSave()` moves the stored blob
    // rather than the defaults the latch runs on. The existing latch test only ever runs on p1, so the
    // `KEY` → `activeKey()` change on that branch was unheld: it handed the grown-up the wrong child's game.
    const newer = JSON.stringify({ v: SAVE_VERSION + 1, name: 'Bo', coins: 5 });
    localStorage.setItem(saveKeyFor('p2'), newer);
    localStorage.setItem(INDEX, JSON.stringify({ v: 1, active: 'p2', ids: ['p1', 'p2'] }));

    load();
    expect(isReadOnlySave(), "the sibling's blob is newer than this build").toBe(true);
    expect(exportSave(), "the code is the sibling's own blob, not profile 1's").toBe(newer);
  });

  it('a switch lifts the latches the profile we left set, and re-arms them on the way back (#232, #151)', () => {
    const newer = JSON.stringify({ v: SAVE_VERSION + 5, name: 'Ada', coins: 500 });
    localStorage.setItem(saveKeyFor('p1'), newer);
    load();
    expect(isReadOnlySave(), "profile 1's blob is from a newer build, so this session writes nothing").toBe(true);

    expect(addProfile()).toEqual({ ok: true, id: 'p2' });
    // The whole job of `dropSessionState()` beyond clearing the cache: reduced to `cache = null` it left
    // 80/80 green, and the sibling could not save for the entire session with nothing shown (#330 review,
    // item 3). Both latches describe one blob, and it is not this profile's.
    expect(isReadOnlySave(), 'the read-only latch belongs to the profile we left').toBe(false);
    save({ name: 'Bo', coins: 3 });
    expect(isWriteFailing(), 'and the write really was attempted').toBe(false);
    expect(JSON.parse(localStorage.getItem(saveKeyFor('p2'))!).name, "the sibling's save lands on disk").toBe('Bo');
    expect(localStorage.getItem(saveKeyFor('p1')), "while profile 1's newer blob is byte-for-byte untouched").toBe(newer);

    expect(setActiveProfile('p1')).toEqual({ ok: true });
    load();
    expect(isReadOnlySave(), 'and switching back re-arms it against the blob it protects').toBe(true);
  });

  /*
   * The 02:36Z review of PR #330: two findings that are design rather than assertions, both reproduced with
   * no store fault at all, and both silent — no throw, no latch, nothing the grown-ups screen could report.
   */
  it('an index that moves under a playing session does not redirect its save into a sibling\'s slot', () => {
    save({ name: 'Ada', coins: 30 });
    expect(addProfile()).toEqual({ ok: true, id: 'p2' });
    save({ name: 'Bo', coins: 3 });
    load();                                    // Bo is the profile this session is playing as
    localStorage.removeItem(INDEX);            // another tab switches, or the key is cleared

    save({ coins: 4 });                        // one ordinary save, no fault anywhere

    expect(JSON.parse(localStorage.getItem(saveKeyFor('p2'))!), "the coins land on the child who earned them")
      .toMatchObject({ name: 'Bo', coins: 4 });
    expect(JSON.parse(localStorage.getItem(saveKeyFor('p1'))!), "and the sibling's game is exactly as it was")
      .toMatchObject({ name: 'Ada', coins: 30 });
  });

  it('a session that reads before it writes keeps its own slot when the index moves', () => {
    // The order a launch actually uses, and the order the two tests below do not: `load()` is the first thing
    // that touches storage and the first `save()` comes minutes later. Both of those prime the latch with a
    // `save()` on the way in, so `load()` re-resolving per call — the very defect `sessionProfile()` exists
    // to close — could not make them fail (#330 round 3, item 1).
    localStorage.setItem(saveKeyFor('p1'), JSON.stringify({ v: SAVE_VERSION, name: 'Ada', coins: 30 }));
    localStorage.setItem(saveKeyFor('p2'), JSON.stringify({ v: SAVE_VERSION, name: 'Bo', coins: 3 }));
    localStorage.setItem(INDEX, JSON.stringify({ v: 1, active: 'p2', ids: ['p1', 'p2'] }));

    expect(load().name, 'the session binds here, on a read, as a launch does').toBe('Bo');
    localStorage.removeItem(INDEX);
    save({ coins: 4 });

    expect(JSON.parse(localStorage.getItem(saveKeyFor('p2'))!).coins, "the write follows the read's profile").toBe(4);
    expect(JSON.parse(localStorage.getItem(saveKeyFor('p1'))!), "and the sibling is untouched")
      .toMatchObject({ name: 'Ada', coins: 30 });
  });

  it('"Start again" under the same conditions clears the child who asked, not their sibling', () => {
    save({ name: 'Ada', coins: 30 });
    expect(addProfile()).toEqual({ ok: true, id: 'p2' });
    save({ name: 'Bo', coins: 3 });
    load();
    localStorage.removeItem(INDEX);

    reset();

    expect(localStorage.getItem(saveKeyFor('p2')), 'the profile that asked to start again is cleared').toBeNull();
    expect(JSON.parse(localStorage.getItem(saveKeyFor('p1'))!), "and the sibling is untouched")
      .toMatchObject({ name: 'Ada', coins: 30 });

    // One statement further than the delete, which is where this stopped and where the defect lived: a fresh
    // start must not end the session's binding, or the next write re-resolves and `defaultIndex()` answers
    // `p1` unconditionally. `parents.ts`'s "Start again" then "Undo" is exactly this shape — it keeps the old
    // save in memory and writes it straight back (#330 round 2, item 1).
    save({ coins: 9 });
    expect(JSON.parse(localStorage.getItem(saveKeyFor('p2'))!), 'the child who started again writes to their own slot')
      .toMatchObject({ coins: 9 });
    expect(JSON.parse(localStorage.getItem(saveKeyFor('p1'))!), "and the sibling is still untouched afterwards")
      .toMatchObject({ name: 'Ada', coins: 30 });
  });

  it('a store that accepts the index and keeps nothing is a refusal, not a new profile (#151)', () => {
    save({ name: 'Ada', coins: 30 });
    const realSet = localStorage.setItem;
    // Not a throw: a store that takes the call and drops this one key. The catch alone never saw this, so
    // addProfile() reported a profile the next read knew nothing about and the new child onboarded over Ada.
    (localStorage as unknown as { setItem: unknown }).setItem = (k: string, v: string) => { if (k !== INDEX) realSet.call(localStorage, k, v); };
    let added: ReturnType<typeof addProfile>, switched: ReturnType<typeof setActiveProfile>;
    try { added = addProfile(); switched = setActiveProfile('p1'); }
    finally { (localStorage as unknown as { setItem: unknown }).setItem = realSet; }

    expect(added, 'no profile was added, and the caller is told it is the store').toEqual({ ok: false, why: 'store' });
    // #384 item 2: a kept-but-different index is a refusal `writeIndex` catches by its read-back, not by a
    // throw, and the latch has to catch it the same way — `save()`'s own catch never sees this shape either.
    expect(isWriteFailing(), 'addProfile latches on a silently-dropped write too, not only a throw').toBe(true);
    // p1 is the only profile and already the active one, so this is not a switch at all: it persists nothing,
    // and a store that keeps nothing therefore has nothing to refuse (#380 review B1). It read `false` here
    // until that review, which is the bug — see the three tests below for what that cost a child.
    expect(switched, 'and re-entering the child already active is not a switch the store can refuse').toEqual({ ok: true });
    expect(activeProfile(), 'the child on the device is still the one who was playing').toBe('p1');
    expect(profileIds()).toEqual(['p1']);
    expect(JSON.parse(localStorage.getItem(saveKeyFor('p1'))!)).toMatchObject({ name: 'Ada', coins: 30 });
  });

  it('setActiveProfile latches writeFailed on a kept-but-different index too, not only a throw (#384 item 2)', () => {
    save({ name: 'Ada', coins: 30 });
    expect(addProfile()).toEqual({ ok: true, id: 'p2' });
    save({ name: 'Bo', coins: 3 });
    expect(setActiveProfile('p1')).toEqual({ ok: true });

    const realSet = localStorage.setItem;
    // A genuine switch this time (p1 → p2), refused the read-back way rather than by a throw.
    (localStorage as unknown as { setItem: unknown }).setItem = (k: string, v: string) => { if (k !== INDEX) realSet.call(localStorage, k, v); };
    let switched: ReturnType<typeof setActiveProfile>;
    try { switched = setActiveProfile('p2'); } finally { (localStorage as unknown as { setItem: unknown }).setItem = realSet; }

    expect(switched, 'the index kept p1 active, so this is refused').toEqual({ ok: false, why: 'store' });
    expect(isWriteFailing()).toBe(true);
    expect(activeProfile(), 'and the store really did keep the old value').toBe('p1');
  });

  /*
   * #380 review B1. `setActiveProfile` wrote the index unconditionally, including when `id` was already
   * `active`, so on a store that refuses writes the launch picker refused *every* card — the child's own
   * included — and the launch picker draws no back control. A device that used to boot to the sky map and
   * play unsaved could no longer reach the game at all. The three below are the three halves of the fix that
   * can each go wrong on their own: the refusal that must stay, the latches that must survive, and the
   * re-read that stops a no-op returning `true` while the session sits on a sibling.
   */
  it('re-entering the child already playing writes nothing, so a refusing store cannot lock them out (#380 review B1)', () => {
    save({ name: 'Ada', coins: 12 });
    addProfile();                                   // p2 exists and is active
    save({ name: 'Bo' });
    const realSet = localStorage.setItem;
    (localStorage as unknown as { setItem: unknown }).setItem = () => { throw new Error('quota'); };
    try {
      expect(setActiveProfile('p1'), 'a real switch still needs the index kept, and is still refused').toEqual({ ok: false, why: 'store' });
      expect(setActiveProfile('p2'), 'but their own card hands them back their own game').toEqual({ ok: true });
    } finally { (localStorage as unknown as { setItem: unknown }).setItem = realSet; }
    expect(activeProfile(), 'and it is still the child the next launch will read').toBe('p2');
    expect(load().name, "their save, not the sibling's").toBe('Bo');
  });

  it('...and it keeps the failed-write flag, which describes the blob the child is still on (#151)', () => {
    save({ name: 'Ada' });
    const realSet = localStorage.setItem;
    (localStorage as unknown as { setItem: unknown }).setItem = () => { throw new Error('quota'); };
    try {
      save({ coins: 3 });
      expect(isWriteFailing(), 'the write just threw').toBe(true);
      expect(setActiveProfile('p1')).toEqual({ ok: true });
      // `leaveProfile()` would clear it here, and the grown-ups screen would stop saying the device is not
      // saving — a real fault forgotten every time a child tapped their own card.
      expect(isWriteFailing(), 'the same child, the same blob, so the same fault').toBe(true);
      // And the blob itself, which the flag is *about*. Dropping `cache` here while keeping `writeFailed`
      // discarded the session's only copy in precisely the state where it is the only copy: the next read
      // answered the last value that reached disk, and every coin earned since was gone on a tap — with no
      // refusal, no hint and no sound (#380 review round 4, B1).
      expect(load().coins, 'the coins the child is playing on, not the last that reached disk').toBe(3);
    } finally { (localStorage as unknown as { setItem: unknown }).setItem = realSet; }
  });

  it('...and the same tap on a store that never accepted a write does not drop them into the wizard (#380 review round 4, B1)', () => {
    // The worse arm of the same branch: nothing has reached disk this session, so re-reading answers
    // `{...DEFAULT}` — `onboarded` false, no name, no ninja — and `afterPick()` sends a child who was playing
    // into the first-run wizard. With one profile the launch picker never draws, so the topbar 👥 is the only
    // way in and their own card is the obvious thing to tap.
    const realSet = localStorage.setItem;
    (localStorage as unknown as { setItem: unknown }).setItem = () => { throw new Error('quota'); };
    try {
      save({ name: 'Ada', avatar: 'volt', onboarded: true, coins: 7 });
      expect(isWriteFailing(), 'nothing this session reached disk').toBe(true);
      expect(setActiveProfile('p1'), 'their own card, on a device with one profile').toEqual({ ok: true });
      expect(load(), 'their name, their ninja and their coins are still on the screen')
        .toMatchObject({ name: 'Ada', avatar: 'volt', onboarded: true, coins: 7 });
    } finally { (localStorage as unknown as { setItem: unknown }).setItem = realSet; }
  });

  it('...and a read-only save is kept too, since save() never writes that one back either (#232)', () => {
    // `readOnly` is the other latch that makes `cache` the only copy: the blob on disk is from a newer build,
    // so `save()` returns before `setItem` and every coin earned this session lives in `cache` alone.
    localStorage.setItem(saveKeyFor('p1'), JSON.stringify({ v: 99, name: 'Ada', coins: 4 }));
    save({ coins: 15 });
    expect(isReadOnlySave(), 'the blob on disk is newer than this build').toBe(true);
    expect(setActiveProfile('p1'), 'their own card').toEqual({ ok: true });
    expect(load().coins, 'the session keeps the coins it is holding, unwritable as they are').toBe(15);
    expect(isReadOnlySave(), 'and goes on refusing to overwrite the newer blob').toBe(true);
  });

  it('...and a second tab that moved the index is honoured, not the profile this session cached (#380 review B1)', () => {
    save({ name: 'Ada' });
    addProfile();                                   // p2 active, and this session is latched to it
    save({ name: 'Bo' });
    // Another tab switches the device back to Ada. This session never saw it and is still cached on Bo.
    localStorage.setItem(INDEX, JSON.stringify({ v: 1, active: 'p1', ids: ['p1', 'p2'] }));
    expect(setActiveProfile('p1'), 'already active in the store, so there is nothing to persist').toEqual({ ok: true });
    expect(load().name, 'but the session re-resolves rather than playing on as the sibling it cached').toBe('Ada');
  });

  /**
   * A store in the band a filling quota necessarily passes through: it keeps the ~39-byte index blob and
   * refuses the ~413-byte save. Round 4's fix was written and tested against a store that refuses *everything*,
   * where `writeIndex` fails and the refusal is honest — so the two paths below, which need a kept index write
   * beside a refused save, were unreachable from any test (#380 review round 5, B2).
   */
  const capWrites = (cap: number) => {
    const realSet = localStorage.setItem.bind(localStorage);
    (localStorage as unknown as { setItem: unknown }).setItem = (k: string, v: string) => {
      if (v.length > cap) throw new Error('quota');
      realSet(k, v);
    };
    return () => { (localStorage as unknown as { setItem: unknown }).setItem = realSet; };
  };

  it('...and a kept index write is still not a new child, so their coins survive that tap too (#380 review round 5, B2)', () => {
    save({ name: 'Ada', avatar: 'volt', onboarded: true, coins: 10 });
    expect(addProfile()).toEqual({ ok: true, id: 'p2' });
    save({ name: 'Bo' });
    expect(setActiveProfile('p1'), 'Ada is the child holding the device').toEqual({ ok: true });
    expect(load().coins).toBe(10);
    // Another tab moves the device to Bo, so Ada's own card now *does* have an index to write back — the arm
    // round 4 left alone. The index is the session's business only through `cacheProfile`, and that still says
    // Ada: dropping her session here discarded the only copy of her afternoon while answering `true`.
    localStorage.setItem(INDEX, JSON.stringify({ v: 1, active: 'p2', ids: ['p1', 'p2'] }));
    const uncap = capWrites(120);
    try {
      save({ coins: 42 });
      expect(isWriteFailing(), 'the save blob is over the cap and was refused').toBe(true);
      expect(setActiveProfile('p1'), 'her own card, and this time the index is written and kept').toEqual({ ok: true });
      expect(activeProfile(), 'the switch really did persist, so the next launch opens on her').toBe('p1');
      expect(load().coins, 'the coins the child is playing on, not the last that reached disk').toBe(42);
      expect(isWriteFailing(), 'and the device goes on saying it is not saving').toBe(true);
    } finally { uncap(); }
  });

  it('...and "New ninja" refuses on that store rather than taking the playing child with it (#380 review round 5, B2)', () => {
    save({ name: 'Ada', avatar: 'volt', onboarded: true, coins: 10 });
    const uncap = capWrites(120);
    try {
      save({ coins: 42 });
      expect(isWriteFailing()).toBe(true);
      expect(addProfile(), 'a profile the store cannot save is one it cannot hand a child')
        .toEqual({ ok: false, why: 'store' });
      // `ok: true` here never reached the picker's `refuse()`: no hint, no sound, nothing spoken, and Ada's
      // name, ninja and 42 coins gone on one tap — into a wizard for a new child that nothing can delete.
      expect(load(), 'her game is still the one on screen').toMatchObject({ name: 'Ada', avatar: 'volt', coins: 42 });
      expect(isWriteFailing(), "and the latch stays, so parents.ts still says why").toBe(true);
      expect(profileIds(), 'nobody was added').toEqual(['p1']);
      expect(activeProfile()).toBe('p1');
    } finally { uncap(); }
  });

  it('...while a read-only save does not refuse it: that store writes, it is the blob that is newer (#232)', () => {
    // The other latch, and deliberately not a refusal: `save()` never writes this blob back, so the session
    // cache holds nothing disk is missing, and the new child's own save will land normally.
    const newer = JSON.stringify({ v: 99, name: 'Ada', coins: 4 });
    localStorage.setItem(saveKeyFor('p1'), newer);
    save({ coins: 15 });
    expect(isReadOnlySave(), 'the blob on disk is from a newer build').toBe(true);
    expect(addProfile(), 'the store is writable; it is this one blob that must not be written')
      .toEqual({ ok: true, id: 'p2' });
    save({ name: 'Bo', coins: 1 });
    expect(JSON.parse(localStorage.getItem(saveKeyFor('p2'))!).name, "the new child's save lands on disk").toBe('Bo');
    expect(localStorage.getItem(saveKeyFor('p1')), 'and the newer blob is byte-for-byte untouched').toBe(newer);
  });

  it('a foreign blob under a slot key does not invent a profile', () => {
    save({ name: 'Ada' });
    localStorage.setItem(saveKeyFor('p3'), 'garbage left by something else');
    expect(profileIds(), 'a phantom would load as defaults and consume one of the four slots for good')
      .toEqual(['p1']);
    // JSON-valid but not a save: the parse alone lets these through, so the shape refinement needs its own
    // fixture or only half the guard is held (#330 round 2, N1).
    for (const blob of ['123', '[1,2]', '"x"', 'null']) {
      localStorage.setItem(saveKeyFor('p3'), blob);
      expect(profileIds(), blob).toEqual(['p1']);
    }
    localStorage.removeItem(saveKeyFor('p3'));
    // and the slot is still free to be handed out
    expect(addProfile()).toEqual({ ok: true, id: 'p2' });
  });

  it('a store whose reads throw does not take the session down with it (#151, #232)', () => {
    const realGet = localStorage.getItem;
    (localStorage as unknown as { getItem: unknown }).getItem = () => { throw new Error('storage disabled'); };
    try {
      // `sessionProfile()` is the first statement of `load()`, *outside* `load()`'s own try, so `readItem`'s
      // catch is the only thing between a private-mode or disabled-WebView store and a throw straight out of
      // `load()`, `activeProfile()` and `profileIds()`. Nothing shimmed `getItem` before (#330 round 3, N2).
      expect(() => profileIds()).not.toThrow();
      expect(profileIds()).toEqual(['p1']);
      expect(activeProfile()).toBe('p1');
      expect(load().name, 'the session runs on defaults rather than dying').toBe('');
    } finally { (localStorage as unknown as { getItem: unknown }).getItem = realGet; }
  });

  it('an index the store altered on the way in is a refusal too, not only one it dropped (#151)', () => {
    save({ name: 'Ada', coins: 30 });
    const realSet = localStorage.setItem;
    // Kept, but not what we wrote. The existing fault-injection drops the key entirely, which a `!== null`
    // read-back would also catch; only a truncating or stale store separates the two (#330 round 3, N4).
    (localStorage as unknown as { setItem: unknown }).setItem =
      (k: string, v: string) => { realSet.call(localStorage, k, k === INDEX ? v.slice(0, 8) : v); };
    let added: ReturnType<typeof addProfile>;
    try { added = addProfile(); }
    finally { (localStorage as unknown as { setItem: unknown }).setItem = realSet; }

    expect(added, 'kept-but-different is not kept').toEqual({ ok: false, why: 'store' });
    expect(profileIds(), 'and the altered blob is not read back as an index either').toEqual(['p1']);
    expect(JSON.parse(localStorage.getItem(saveKeyFor('p1'))!)).toMatchObject({ name: 'Ada', coins: 30 });
  });

  it("a switch clears the failed-write flag the other profile's write set (#151)", () => {
    expect(addProfile()).toEqual({ ok: true, id: 'p2' });
    expect(setActiveProfile('p1')).toEqual({ ok: true });
    const realSet = localStorage.setItem;
    (localStorage as unknown as { setItem: unknown }).setItem = () => { throw new Error('quota'); };
    try { save({ coins: 1 }); } finally { (localStorage as unknown as { setItem: unknown }).setItem = realSet; }
    expect(isWriteFailing()).toBe(true);
    expect(setActiveProfile('p2')).toEqual({ ok: true });
    expect(isWriteFailing(), "the refused write was the other child's, and this session has attempted none").toBe(false);
  });

  it('addProfile latches writeFailed on a refused store, the way save() already does (#384 item 2)', () => {
    save({ name: 'Ada' });
    const realSet = localStorage.setItem;
    (localStorage as unknown as { setItem: unknown }).setItem = () => { throw new Error('quota'); };
    let added: ReturnType<typeof addProfile>;
    // `writeIndex`'s catch used to be the only place that knew a store refused the write, and it discarded
    // that — `isWriteFailing()` stayed false and `parents.ts:35`'s sentence stayed quiet until an unrelated
    // ordinary save() happened to set the latch for a different reason.
    try { added = addProfile(); } finally { (localStorage as unknown as { setItem: unknown }).setItem = realSet; }
    expect(added).toEqual({ ok: false, why: 'store' });
    expect(isWriteFailing(), 'the refusal now latches on its own').toBe(true);
  });

  it('setActiveProfile latches writeFailed on a refused switch (#384 item 2)', () => {
    save({ name: 'Ada' });
    expect(addProfile()).toEqual({ ok: true, id: 'p2' });
    expect(setActiveProfile('p1')).toEqual({ ok: true });
    const realSet = localStorage.setItem;
    (localStorage as unknown as { setItem: unknown }).setItem = () => { throw new Error('quota'); };
    let result: ReturnType<typeof setActiveProfile>;
    try { result = setActiveProfile('p2'); } finally { (localStorage as unknown as { setItem: unknown }).setItem = realSet; }
    expect(result, "the switch is refused, so this session is still Ada's").toEqual({ ok: false, why: 'store' });
    expect(isWriteFailing()).toBe(true);
  });

  it('reset() is a fresh start for the active profile only', () => {
    save({ name: 'Ada', coins: 30 });
    addProfile(); save({ name: 'Bo', coins: 3 });
    reset();
    expect(activeProfile(), 'still the sibling who asked to start again').toBe('p2');
    expect(load().name).toBe('');
    expect(setActiveProfile('p1')).toEqual({ ok: true });
    expect(load().name, "the other child's game is not part of it").toBe('Ada');
    expect(load().coins).toBe(30);
  });

  /*
   * #20 slice 2 — what the picker needs of the store, and the two #335 findings the picker makes reachable.
   */
  it('addProfile refuses a slot that already holds a save the index does not list (#335 item 1)', () => {
    save({ name: 'Ada' });
    // An index that is valid (p1 only, active p1) beside a real save in p2 — the shape `defaultIndex()`'s own
    // probe would never produce, but a hand-edited or half-written index can. `addProfile` used to hand p2
    // out, and the new child's onboarding then merged over the sibling in it.
    localStorage.setItem(saveKeyFor('p2'), JSON.stringify({ v: 3, name: 'Bo', coins: 7 }));
    localStorage.setItem(INDEX, JSON.stringify({ v: 1, active: 'p1', ids: ['p1'] }));
    expect(addProfile(), 'the next free-by-count slot is not free').toEqual({ ok: true, id: 'p3' });
    expect(JSON.parse(localStorage.getItem(saveKeyFor('p2'))!), "and Bo's save is untouched").toMatchObject({ name: 'Bo', coins: 7 });
  });

  it("addProfile says 'full' when every unlisted slot holds a save, not 'store' (#335 item 2)", () => {
    save({ name: 'Ada' });
    for (const id of ['p2', 'p3', 'p4'] as const) localStorage.setItem(saveKeyFor(id), JSON.stringify({ v: 3, name: id }));
    localStorage.setItem(INDEX, JSON.stringify({ v: 1, active: 'p1', ids: ['p1'] }));
    // The count says one profile and three slots spare; the probe says there is nowhere to put a child. The
    // picker shows two different sentences for these, so the refusal has to carry which one it is.
    expect(addProfile()).toEqual({ ok: false, why: 'full' });
  });

  it('addProfile refuses a slot it can read but cannot parse, not only one it parses cleanly (#384 item 4)', () => {
    save({ name: 'Ada' });
    // `holdsSave`'s old shape test answered `false` for "empty" and "garbled" alike, so `addProfile`'s
    // free-slot probe read a slot it could not make sense of as free — the same blind spot #335 item 1 fixed
    // one call site over, for a blob nothing anywhere writes on purpose (no app path leaves one; `setItem` is
    // atomic and every writer goes through `save()`) but nothing stopped either.
    localStorage.setItem(saveKeyFor('p2'), 'not json at all');
    localStorage.setItem(INDEX, JSON.stringify({ v: 1, active: 'p1', ids: ['p1'] }));
    expect(addProfile(), 'p2 is unreadable, not free — the next real slot is p3').toEqual({ ok: true, id: 'p3' });
    expect(localStorage.getItem(saveKeyFor('p2')), 'and the garbled bytes are left alone, not handed out').toBe('not json at all');
  });

  it("profileCard reads a sibling's name and ninja without moving this session (#20 slice 2)", () => {
    save({ name: 'Ada', avatar: 'volt', onboarded: true, coins: 30 });
    expect(addProfile()).toEqual({ ok: true, id: 'p2' });
    save({ name: 'Bo', avatar: 'blaze', onboarded: true });

    expect(profileCard('p1')).toEqual({ id: 'p1', name: 'Ada', avatar: 'volt', onboarded: true, future: false });
    expect(activeProfile(), 'reading a card is not a switch').toBe('p2');
    expect(load().name, 'and the session is still the child who was playing').toBe('Bo');
    expect(profileCards()).toEqual([
      { id: 'p1', name: 'Ada', avatar: 'volt', onboarded: true, future: false },
      { id: 'p2', name: 'Bo', avatar: 'blaze', onboarded: true, future: false },
    ]);
  });

  it('profileCard is blank rather than throwing on a slot the picker cannot read (#20 slice 2)', () => {
    save({ name: 'Ada' });
    expect(profileCard('p2'), 'an empty slot').toEqual({ id: 'p2', name: '', avatar: null, onboarded: false, future: false });
    localStorage.setItem(saveKeyFor('p3'), 'not json at all');
    expect(profileCard('p3'), 'a blob that is not JSON').toEqual({ id: 'p3', name: '', avatar: null, onboarded: false, future: false });
    localStorage.setItem(saveKeyFor('p4'), JSON.stringify(['an', 'array']));
    expect(profileCard('p4'), 'JSON that is not an object').toEqual({ id: 'p4', name: '', avatar: null, onboarded: false, future: false });
    localStorage.setItem(saveKeyFor('p2'), JSON.stringify({ v: 3, name: 42, avatar: 7, onboarded: 'yes' }));
    expect(profileCard('p2'), 'fields of the wrong type are dropped, not shown').toEqual({ id: 'p2', name: '', avatar: null, onboarded: false, future: false });
  });

  it("a v2 save's card agrees with load() about whether that child has played (#20 slice 2)", () => {
    // `onboarded` only exists from v3 and `MIGRATIONS[2]` derives it from the avatar. `load()` does not write
    // the migrated blob back, and nothing on `boot → map → 👥` calls `save()`, so on the first launch after an
    // upgrade the picker draws a still-v2 blob: reading the field raw told a family a fully-played game was
    // empty (#380 review B3). The card and the migration must give the same answer about the same bytes.
    localStorage.setItem(saveKeyFor('p1'), JSON.stringify({ v: 2, name: 'Ada', avatar: 'volt', coins: 30 }));
    expect(migrate({ v: 2, name: 'Ada', avatar: 'volt' }).onboarded, "the migration's own answer").toBe(true);
    expect(profileCard('p1')).toEqual({ id: 'p1', name: 'Ada', avatar: 'volt', onboarded: true, future: false });

    // And the other half of that rule: a v2 blob with no ninja chosen never played, so the card says so.
    localStorage.setItem(saveKeyFor('p2'), JSON.stringify({ v: 2, name: 'Bo' }));
    expect(migrate({ v: 2, name: 'Bo' }).onboarded).toBe(false);
    expect(profileCard('p2')).toEqual({ id: 'p2', name: 'Bo', avatar: null, onboarded: false, future: false });

    // A v3 blob still wins on its own field — `false` there means mid-wizard, whatever the avatar says (#67).
    localStorage.setItem(saveKeyFor('p3'), JSON.stringify({ v: 3, name: 'Cass', avatar: 'kai', onboarded: false }));
    expect(profileCard('p3')).toEqual({ id: 'p3', name: 'Cass', avatar: 'kai', onboarded: false, future: false });
  });

  it('a card is blank for a save this build cannot open, exactly as load() is (#20 slice 2)', () => {
    // #380 review B2. `profileCard` applied `MIGRATIONS[2]`'s rule but skipped the version gate `load()`
    // applies before it, so a save from a **newer build** — which `migrate()` refuses outright — drew the
    // child's real name and ninja. The tap then succeeded, `afterPick()` read `onboarded: false` off the
    // default `load()` answers, and the child went through the first-run wizard with `readOnly` latched and
    // every write silently dropped, their real save sitting intact under its own key.
    const future = { v: SAVE_VERSION + 1, name: 'Bo', avatar: 'blaze', onboarded: true, coins: 99 };
    localStorage.setItem(saveKeyFor('p2'), JSON.stringify(future));
    expect(isFutureSave(future), 'the blob this is about').toBe(true);
    expect(migrate(future), "load()'s own answer is a fresh default").toMatchObject({ name: '', avatar: null, onboarded: false });
    expect(profileCard('p2'), 'so the card says the same thing the tap will give')
      .toEqual({ id: 'p2', name: '', avatar: null, onboarded: false, future: true });

    // The same for a `v` no build ever wrote — also refused by `isMigratable`, for a different reason (#232).
    // Blank the same way, and `future: false`, because that one *is* recoverable: `load()` resets over it and
    // writes resume, so a grown-up may take the slot back (#420 review B2).
    localStorage.setItem(saveKeyFor('p3'), JSON.stringify({ v: 'two', name: 'Cass', avatar: 'kai', onboarded: true }));
    expect(profileCard('p3')).toEqual({ id: 'p3', name: '', avatar: null, onboarded: false, future: false });

    // And the gate is a gate, not a blanket: the versions the ladder *can* walk are unaffected.
    localStorage.setItem(saveKeyFor('p4'), JSON.stringify({ v: 1, name: 'Dev', avatar: 'kai' }));
    expect(profileCard('p4')).toEqual({ id: 'p4', name: 'Dev', avatar: 'kai', onboarded: true, future: false });
  });

  it('the card and the migration derive onboarded from one rule, not two copies (#20 slice 2)', () => {
    // #380 review note 1. The rail held two spellings of the expression against a regex that stopped at the
    // colon, so the fallback — the whole of the rule — was never compared, and the two had already drifted:
    // a truthy non-string avatar answered `true` on one side and `false` on the other.
    for (const avatar of [7, true, {}, []] as const) {
      expect(onboardedOf({ v: 2, avatar }), `avatar: ${JSON.stringify(avatar)} is not a ninja anybody chose`).toBe(false);
      expect(MIGRATIONS[2]({ v: 2, avatar }).onboarded).toBe(false);
    }
    expect(onboardedOf({ v: 2, avatar: 'volt' })).toBe(true);
    expect(onboardedOf({ v: 2, avatar: '' }), 'an empty string is no ninja either').toBe(false);
    expect(onboardedOf({ v: 3, avatar: 'volt', onboarded: false }), 'a real field always wins').toBe(false);
  });

  it('a profile added but never played still draws a card (#20 slice 2)', () => {
    save({ name: 'Ada', onboarded: true });
    expect(addProfile()).toEqual({ ok: true, id: 'p2' });
    // `addProfile` writes no save on purpose, so the new slot is empty: the card has to come from the index.
    expect(profileCards().map(c => c.id)).toEqual(['p1', 'p2']);
    expect(profileCards()[1]).toEqual({ id: 'p2', name: '', avatar: null, onboarded: false, future: false });
  });
  // ── #20 slice 3: rename and delete, the grown-ups screen's two controls ───────────────────────────────────
  describe('renameProfile (#20 slice 3)', () => {
    it('renames the profile this session is playing through save(), so the running screen agrees with the store', () => {
      save({ name: 'Ada', coins: 40, onboarded: true });
      expect(renameProfile('p1', 'Ada Two')).toEqual({ ok: true, name: 'Ada Two' });
      expect(load().name, 'the session cache, not just disk').toBe('Ada Two');
      expect(JSON.parse(localStorage.getItem(saveKeyFor('p1'))!).name).toBe('Ada Two');
      expect(load().coins, 'and nothing else about the save moved').toBe(40);
    });

    it("renames a sibling's slot without touching this session or migrating their blob", () => {
      save({ name: 'Ada', coins: 40, onboarded: true });
      expect(addProfile()).toEqual({ ok: true, id: 'p2' });
      expect(setActiveProfile('p1')).toEqual({ ok: true });
      // A v1 blob — older than this build — written straight into the sibling's slot.
      localStorage.setItem(saveKeyFor('p2'), JSON.stringify({ v: 1, name: 'Bo', avatar: 'blaze', coins: 7 }));
      expect(renameProfile('p2', 'Bobby')).toEqual({ ok: true, name: 'Bobby' });
      const raw = JSON.parse(localStorage.getItem(saveKeyFor('p2'))!);
      expect(raw.name).toBe('Bobby');
      expect(raw.v, 'a rename is not the thing that migrates a sibling').toBe(1);
      expect(raw.coins, 'and it carries every other byte through').toBe(7);
      expect(load().name, 'this session is still Ada, unlatched onto nobody').toBe('Ada');
      expect(activeProfile()).toBe('p1');
    });

    it('trims, truncates to NAME_MAX, and refuses a name of only spaces', () => {
      save({ name: 'Ada', onboarded: true });
      expect(renameProfile('p1', '   ')).toEqual({ ok: false, why: 'blank' });
      expect(load().name, 'a refused rename changes nothing').toBe('Ada');
      expect(renameProfile('p1', '  Bo  ')).toEqual({ ok: true, name: 'Bo' });
      const long = 'Wolfeschlegelsteinhausen';
      expect(long.length).toBeGreaterThan(NAME_MAX);
      const r = renameProfile('p1', long);
      expect(r).toEqual({ ok: true, name: long.slice(0, NAME_MAX) });
      expect(load().name.length, 'the cap the wizard renders is the cap the store enforces').toBe(NAME_MAX);
      // The cut can land on a space, and a trailing space is not part of a name.
      expect(renameProfile('p1', 'Ada Bo Cassie Dee')).toEqual({ ok: true, name: 'Ada Bo Cassie' });
    });

    // #424 review (pr-test-analyzer): `slice` counts UTF-16 code units, and an emoji name is a supported case
    // (avatar.test.ts's `canStart('volt', '😀')`) — a cut landing inside its surrogate pair used to leave a
    // dangling high surrogate, which renders as a broken glyph everywhere a name is drawn. Proved red by
    // reverting `cleanName` to a bare `slice(0, NAME_MAX)`: this then stores a lone `'\ud83e'`.
    it('a truncation that lands inside an emoji drops the whole character, not half of it', () => {
      save({ name: 'Ada', onboarded: true });
      const long = 'x'.repeat(NAME_MAX - 1) + '🤖' + 'yyyy';   // the cut falls between 🤖's two code units
      const r = renameProfile('p1', long);
      expect(r).toEqual({ ok: true, name: 'x'.repeat(NAME_MAX - 1) });
      expect(load().name).not.toMatch(/[\ud800-\udbff]$/);
    });

    it('refuses a slot that is not a profile of this device, and one with nothing to name', () => {
      save({ name: 'Ada', onboarded: true });
      expect(renameProfile('p3', 'Cass'), 'p3 is not in the index').toEqual({ ok: false, why: 'unknown' });
      expect(addProfile()).toEqual({ ok: true, id: 'p2' });
      expect(setActiveProfile('p1')).toEqual({ ok: true });
      expect(renameProfile('p2', 'Bo'), 'listed, but addProfile writes no save').toEqual({ ok: false, why: 'no-save' });
      expect(localStorage.getItem(saveKeyFor('p2')), 'and it does not invent one').toBeNull();
      localStorage.setItem(saveKeyFor('p2'), 'not json at all');
      expect(renameProfile('p2', 'Bo')).toEqual({ ok: false, why: 'no-save' });
      expect(localStorage.getItem(saveKeyFor('p2')), 'a blob we cannot read is left exactly as it is').toBe('not json at all');
    });

    it("refuses a sibling's save from a newer build rather than stamping a name onto it (#232)", () => {
      save({ name: 'Ada', onboarded: true });
      expect(addProfile()).toEqual({ ok: true, id: 'p2' });
      expect(setActiveProfile('p1')).toEqual({ ok: true });
      const future = JSON.stringify({ v: SAVE_VERSION + 1, name: 'Bo', coins: 99 });
      localStorage.setItem(saveKeyFor('p2'), future);
      expect(renameProfile('p2', 'Bobby'), "and it says why, not 'has not played' (#420 review B2)").toEqual({ ok: false, why: 'future' });
      expect(localStorage.getItem(saveKeyFor('p2')), 'the other device still reads it').toBe(future);
      // The same bytes refuse a **delete**, which is the same argument with the save at stake rather than one
      // field of it. This function inherited none of the rename's guard until #420 review B2.
      expect(deleteProfile('p2')).toEqual({ ok: false, why: 'future' });
      expect(localStorage.getItem(saveKeyFor('p2')), '99 coins and all of it still there').toBe(future);
      expect(profileIds(), 'and the family still lists them').toEqual(['p1', 'p2']);
      // The card says which blank it is, so the row can stop asserting the wrong reason.
      expect(profileCard('p2')).toEqual({ id: 'p2', name: '', avatar: null, onboarded: false, future: true });
      // An unreadable `v` is a different case and deliberately *not* protected: `load()` resets over it.
      localStorage.setItem(saveKeyFor('p2'), JSON.stringify({ v: 'banana', name: 'Bo' }));
      expect(profileCard('p2').future, 'not a newer save, just a broken one').toBe(false);
      expect(deleteProfile('p2'), 'so a corrupt slot can still be taken back').toEqual({ ok: true, self: false });
    });

    /**
     * #431 review, type-design-analyzer: hoisting `futureSaveIn(id)` above the `next`/blank check (item 1)
     * changes which refusal wins when both apply — previously `'blank'` ran first for both paths, now
     * `'future'` does. Deliberate: a slot this build cannot touch at all is refused on that alone, whatever
     * was typed. Unreachable through the screen itself — `canRenameCard` never offers the input on a `future`
     * row — so this only pins the direct call.
     */
    it("answers 'future' rather than 'blank' for an empty name on a slot this build cannot touch", () => {
      save({ name: 'Ada', onboarded: true });
      expect(addProfile()).toEqual({ ok: true, id: 'p2' });
      expect(setActiveProfile('p1')).toEqual({ ok: true });
      localStorage.setItem(saveKeyFor('p2'), JSON.stringify({ v: SAVE_VERSION + 1, name: 'Bo', coins: 99 }));
      expect(renameProfile('p2', '   ')).toEqual({ ok: false, why: 'future' });
    });

    it("refuses while the session's own save is read-only, with the remedy that fault has (#232, #420 note 4)", () => {
      localStorage.setItem(saveKeyFor('p1'), JSON.stringify({ v: SAVE_VERSION + 1, name: 'Ada', coins: 99 }));
      expect(load().name, 'the session runs on defaults over a newer blob').toBe('');
      expect(isReadOnlySave()).toBe(true);
      // `'future'`, not `'store'`: the two remedies are opposites and `readOnly`'s own paragraph forbids
      // conflating them — this one needs the other device or an update, `'store'` needs space or private
      // browsing off, and neither ever fixes the other.
      expect(renameProfile('p1', 'Bo')).toEqual({ ok: false, why: 'future' });
      expect(JSON.parse(localStorage.getItem(saveKeyFor('p1'))!).name).toBe('Ada');
    });

    /**
     * #431 review, item 1. The session path used to ask the `readOnly` latch, which only `load()` sets — so
     * with no `load()` run yet this session (the order `reset()` in `beforeEach` leaves things: `sessionProfile()`
     * resolves who is playing without reading their bytes), a newer-build save on the session's OWN slot fell
     * through the stale `false` latch, reached `save()` (which itself sets `readOnly` too late for this
     * function to see it), and answered `'store'` — sending a grown-up to turn off private browsing for a save
     * that needs the other device instead, the exact conflation `RenameProfileResult`'s own doc forbids.
     * `futureSaveIn(id)`, asked once against disk before either path, cannot go stale this way.
     */
    it("answers 'future' for the session's own profile even before this session has ever loaded it", () => {
      const future = JSON.stringify({ v: SAVE_VERSION + 1, name: 'Ada', coins: 99 });
      localStorage.setItem(saveKeyFor('p1'), future);
      expect(isReadOnlySave(), 'nothing has read this blob yet this session').toBe(false);
      expect(renameProfile('p1', 'Bo')).toEqual({ ok: false, why: 'future' });
      expect(localStorage.getItem(saveKeyFor('p1')), 'the other device still reads it').toBe(future);
    });

    it('reports a store that will not keep the new name, on either path (#151, #330)', () => {
      save({ name: 'Ada', onboarded: true });
      expect(addProfile()).toEqual({ ok: true, id: 'p2' });
      save({ name: 'Bo', onboarded: true });          // p2 is now the session's, with a save of its own
      expect(setActiveProfile('p1')).toEqual({ ok: true });
      const realSet = localStorage.setItem;
      (localStorage as unknown as { setItem: unknown }).setItem = () => { throw new Error('quota'); };
      try {
        // #431 review (pr-test-analyzer, round 2): the sibling call runs FIRST and its latch is checked
        // before the session path ever runs, so this assertion can only be satisfied by the sibling path's
        // own code — the earlier ordering let the session call's `save()`-driven latch (pre-existing, not
        // new code) satisfy the sibling assertion on leftover state, which mutation-testing away both of the
        // sibling path's own `writeFailed = true` lines failed to catch.
        expect(isWriteFailing(), 'clean before either path has attempted a write').toBe(false);
        expect(renameProfile('p2', 'Bobby'), "the sibling's raw path").toEqual({ ok: false, why: 'store' });
        // #431 review item 5: the sibling's raw path used to return the reason and touch nothing else, so a
        // refused sibling rename left `parents.ts:35`'s sentence quiet — this asserts it latches on its own now.
        expect(isWriteFailing(), "a thrown setItem on the sibling's raw path latches on its own").toBe(true);
        expect(renameProfile('p1', 'Ada Two'), "the session's own path").toEqual({ ok: false, why: 'store' });
      } finally { (localStorage as unknown as { setItem: unknown }).setItem = realSet; }
      expect(JSON.parse(localStorage.getItem(saveKeyFor('p2'))!).name, 'and nothing was written').toBe('Bo');
      // A real write between the two halves, so the silent-drop half starts from the same clean state the
      // throw half did — otherwise the latch the throw half correctly set would carry over and contaminate
      // the silent-drop assertions the same way the original ordering did (#431 review, pr-test-analyzer).
      save({});
      expect(isWriteFailing(), 'a landed write clears the throw half before the silent-drop half begins').toBe(false);
      // A store that accepts the call and keeps nothing is the other half of "the write did not land" (#330),
      // and until #420 review B3 this block only ever tested the sibling path while its title claimed both.
      // The session path reported `ok`, `sfx.correct()` played, the heading and the map pill both changed
      // because they read `cache`, `saveNote()` stayed quiet because `writeFailed` was false, and at the next
      // launch the old name was back with nothing to explain it.
      (localStorage as unknown as { setItem: unknown }).setItem = () => { /* silently drops it */ };
      try {
        expect(renameProfile('p2', 'Bobby'), "the sibling's raw path").toEqual({ ok: false, why: 'store' });
        // #431 review item 5: a silent drop (no throw, read-back disagrees) latches too, not only a throw —
        // and, going in clean above, this can only be the sibling path's own doing.
        expect(isWriteFailing(), "the sibling's raw path latches on a silent drop, on its own, not only a throw").toBe(true);
        expect(renameProfile('p1', 'Ada Two'), "the session's own path — B3").toEqual({ ok: false, why: 'store' });
        // #431 review, silent-failure-hunter: `save()` sets `writeFailed = false` unconditionally whenever
        // `setItem` does not throw, so this session-path silent drop used to erase the `true` the sibling
        // path had just latched above — even though this write failed too. It must still read `true` here.
        expect(isWriteFailing(), "a silent drop on the session's own path latches too, and does not erase a sibling's").toBe(true);
      } finally { (localStorage as unknown as { setItem: unknown }).setItem = realSet; }
      // And the cache is put back, so nothing on screen shows a name the store refused.
      expect(load().name, 'the session still reads the name that is actually stored').toBe('Ada');
      expect(JSON.parse(localStorage.getItem(saveKeyFor('p1'))!).name, 'which is what disk holds').toBe('Ada');
    });

    it('a silently-dropping store does not leave the session showing a name disk never took (#420 review B3)', () => {
      save({ name: 'Ada', coins: 40, onboarded: true });
      const realSet = localStorage.setItem;
      // A quota that has room for everything except this one key — the band #380 round 5 B2 is about, here
      // hitting the save rather than the index.
      (localStorage as unknown as { setItem: unknown }).setItem = (k: string, v: string) => { if (k !== saveKeyFor('p1')) mem[k] = v; };
      try { expect(renameProfile('p1', 'Bobby')).toEqual({ ok: false, why: 'store' }); }
      finally { (localStorage as unknown as { setItem: unknown }).setItem = realSet; }
      expect(load().name, 'no green "Renamed to Bobby." over a store that kept Ada').toBe('Ada');
      expect(load().coins, 'and the rest of the session is untouched').toBe(40);
    });
  });

  describe('deleteProfile (#20 slice 3)', () => {
    /** Whether a slot really holds no save — `addProfile` writes none on purpose, and the B1 fixture below
     *  depends on that staying true, so it is asserted rather than assumed. */
    const holdsNoSave = (id: 'p3' | 'p4') => localStorage.getItem(saveKeyFor(id)) === null;
    /** Two siblings, Ada in p1 and Bo in p2, with `active` as asked and the session bound to it. */
    const twoChildren = (active: 'p1' | 'p2') => {
      save({ name: 'Ada', coins: 40, onboarded: true });
      expect(addProfile()).toEqual({ ok: true, id: 'p2' });
      save({ name: 'Bo', coins: 7, onboarded: true });
      expect(setActiveProfile(active)).toEqual({ ok: true });
      expect(load().name).toBe(active === 'p1' ? 'Ada' : 'Bo');
    };

    it("removes a sibling's slot and save, and leaves this session alone", () => {
      twoChildren('p1');
      expect(deleteProfile('p2')).toEqual({ ok: true, self: false });
      expect(profileIds()).toEqual(['p1']);
      expect(localStorage.getItem(saveKeyFor('p2')), 'the bytes go with the slot').toBeNull();
      expect(load().name, 'the child holding the device never noticed').toBe('Ada');
      expect(load().coins).toBe(40);
      // The freed slot is genuinely reusable — `addProfile` probes `holdsSave`, so leftover bytes would cap
      // the family below four for good (#335 item 1).
      expect(addProfile()).toEqual({ ok: true, id: 'p2' });
    });

    /**
     * **This reads the stored index, not `activeProfile()`, and that is the whole point of it** (#420 review
     * round 2, B1).
     *
     * It used to assert `activeProfile()` and was satisfied by the wrong thing entirely: mutate `active` so it
     * never moves off the deleted id and `readIndex()` rejects the result — `active` is no longer in `ids` —
     * so `currentIndex()` falls through to `defaultIndex()`, which answers `'p1'` unconditionally. The
     * assertion passed on the **corruption-recovery path** while the line it names did nothing, and the whole
     * 1,633-test suite stayed green.
     *
     * That masking is not free, which is why the fixture carries **p3, a slot the ＋ card created and nobody
     * has played**: `defaultIndex()` only lists slots that hold a save, so under the mutation p3 silently
     * disappears from the picker — a family that tapped ＋ and put the tablet down loses that child's slot.
     * Every other test here gives every slot a save, which is exactly why none of them could see it.
     */
    it('removing the active profile moves `active` on in the stored index, and ends the session bound to it', () => {
      save({ name: 'Ada', coins: 40, onboarded: true });
      expect(addProfile()).toEqual({ ok: true, id: 'p2' });
      save({ name: 'Bo', coins: 7, onboarded: true });
      expect(addProfile(), 'p3 is created and deliberately never played').toEqual({ ok: true, id: 'p3' });
      expect(setActiveProfile('p2')).toEqual({ ok: true });
      expect(load().name).toBe('Bo');
      expect(holdsNoSave('p3'), 'the fixture the recovery path cannot stand in for').toBe(true);

      expect(deleteProfile('p2')).toEqual({ ok: true, self: true });
      // The stored bytes, read raw: this is the line under test, and nothing downstream of `readIndex()` can
      // answer for it.
      expect(JSON.parse(localStorage.getItem(INDEX)!), 'the index the store is actually holding')
        .toEqual({ v: 1, active: 'p1', ids: ['p1', 'p3'] });
      expect(profileIds(), 'and the unplayed slot survives, because the index was never left invalid').toEqual(['p1', 'p3']);
      expect(activeProfile()).toBe('p1');
      expect(load().name, "the next read resolves afresh, onto the sibling's own save").toBe('Ada');
      expect(load().coins, "and not the deleted child's coins written over them").toBe(40);
      expect(JSON.parse(localStorage.getItem(saveKeyFor('p1'))!).coins, 'nothing wrote Bo into p1').toBe(40);
    });

    it('refuses the only profile: clearing the whole device stays "Start again" and its typed word', () => {
      save({ name: 'Ada', coins: 40, onboarded: true });
      expect(deleteProfile('p1')).toEqual({ ok: false, why: 'last' });
      expect(load().name, 'a refused delete changes nothing').toBe('Ada');
      expect(profileIds()).toEqual(['p1']);
      // And it stays refused as the family shrinks back to one, rather than only on a device that never grew.
      expect(addProfile()).toEqual({ ok: true, id: 'p2' });
      save({ name: 'Bo', onboarded: true });
      expect(deleteProfile('p1')).toEqual({ ok: true, self: false });
      expect(deleteProfile('p2')).toEqual({ ok: false, why: 'last' });
      expect(load().name, "the last child's save survives the refusal").toBe('Bo');
    });

    /**
     * #446: `'last'` refuses deleting the *only* profile, but a device can have two slots and still be one
     * delete away from nobody this build can read — a newer build wrote the sibling's slot. Removing the
     * readable one leaves `readIndex()` an index whose one remaining id resolves to a `future` save, which
     * sends the family into the first-run wizard over a store `readOnly` latches shut.
     */
    it('refuses a delete that would leave nobody this build can read (#446)', () => {
      twoChildren('p1');
      const future = JSON.stringify({ v: SAVE_VERSION + 1, name: 'Bo', coins: 99 });
      localStorage.setItem(saveKeyFor('p2'), future);
      expect(deleteProfile('p1'), 'p2 is the only slot left, and this build cannot read it').toEqual({ ok: false, why: 'stranded' });
      expect(profileIds(), 'a refused delete changes nothing about who is listed').toEqual(['p1', 'p2']);
      expect(load().name, "Ada's own save is untouched").toBe('Ada');
      expect(localStorage.getItem(saveKeyFor('p2')), "and Bo's bytes are exactly as they were").toBe(future);

      // A third, readable sibling is enough: the family is not stranded as long as one slot survives.
      expect(setActiveProfile('p1')).toEqual({ ok: true });
      // addProfile() switches the session onto the new slot, so this session is now p3's, not p1's.
      expect(addProfile(), 'p3 is created and deliberately never played').toEqual({ ok: true, id: 'p3' });
      expect(deleteProfile('p1'), 'p3 is empty but readable — an unplayed slot is not a future save').toEqual({ ok: true, self: false });
      expect(profileIds()).toEqual(['p2', 'p3']);

      // And the future slot itself is still refused on its own terms first — 'future', not 'stranded'.
      expect(deleteProfile('p2')).toEqual({ ok: false, why: 'future' });
    });

    it('refuses a slot that is not a profile of this device', () => {
      twoChildren('p1');
      expect(deleteProfile('p3')).toEqual({ ok: false, why: 'unknown' });
      expect(profileIds()).toEqual(['p1', 'p2']);
    });

    it('a store that will not keep the index deletes nothing at all', () => {
      twoChildren('p1');
      const realSet = localStorage.setItem;
      (localStorage as unknown as { setItem: unknown }).setItem = () => { throw new Error('quota'); };
      try { expect(deleteProfile('p2')).toEqual({ ok: false, why: 'store' }); }
      finally { (localStorage as unknown as { setItem: unknown }).setItem = realSet; }
      expect(profileIds(), 'still a family of two').toEqual(['p1', 'p2']);
      expect(JSON.parse(localStorage.getItem(saveKeyFor('p2'))!).name, "and Bo's save is untouched — the index is written first for exactly this").toBe('Bo');
      // #431 review item 5: the index-write refusal used to return the reason and touch nothing else, so a
      // refused delete left `parents.ts:35`'s sentence quiet, the same gap `addProfile`/`setActiveProfile`
      // already closed on their own `writeIndex` calls.
      expect(isWriteFailing(), 'a thrown setItem on the index write latches too').toBe(true);
      // The same for a store that accepts the call and keeps nothing.
      (localStorage as unknown as { setItem: unknown }).setItem = () => { /* silently drops it */ };
      try { expect(deleteProfile('p2')).toEqual({ ok: false, why: 'store' }); }
      finally { (localStorage as unknown as { setItem: unknown }).setItem = realSet; }
      expect(JSON.parse(localStorage.getItem(saveKeyFor('p2'))!).name).toBe('Bo');
      expect(isWriteFailing(), 'and on a silent drop, not only a throw').toBe(true);
    });

    it('a store that keeps the bytes deletes nothing, rather than promising it cannot be undone (#420 review B4)', () => {
      twoChildren('p1');
      const realRemove = localStorage.removeItem;
      // No throw anywhere: the store accepts `removeItem` and keeps the key. `writeIndex` had already
      // succeeded, so nothing else in the function could have noticed.
      (localStorage as unknown as { removeItem: unknown }).removeItem = () => { /* accepted, and kept */ };
      try { expect(deleteProfile('p2')).toEqual({ ok: false, why: 'store' }); }
      finally { (localStorage as unknown as { removeItem: unknown }).removeItem = realRemove; }
      expect(JSON.parse(localStorage.getItem(saveKeyFor('p2'))!).name, "Bo's save is still there…").toBe('Bo');
      expect(profileIds(), '…so the index is put back and the family still sees them').toEqual(['p1', 'p2']);
      expect(activeProfile(), 'and nothing about the active profile moved').toBe('p1');
      // #431 review item 5: `writeFailed` reflects the *last attempted write*, and here the rollback itself
      // succeeded — the store kept the bytes, but every index write it was asked for landed — so the latch
      // stays clear rather than reporting a fault that already healed.
      expect(isWriteFailing(), 'the rollback write succeeded, so nothing is currently failing').toBe(false);
      // The two silent consequences the read-back exists to stop, both provable from the state above: the slot
      // stays occupied for `addProfile`'s probe, and a later lost index brings the child back with their save.
      expect(addProfile(), 'the slot is not quietly reusable either').toEqual({ ok: true, id: 'p3' });
      localStorage.removeItem('sna:profiles');
      expect(profileIds(), 'a rebuilt index finds Bo exactly where they were').toContain('p2');
      expect(profileCard('p2').name).toBe('Bo');
    });

    /**
     * The quota band #420 review round 2 B2 is about: the store takes the *shorter* index and refuses the
     * *longer* one, so the delete's own write lands and the rollback does not. The child is then genuinely
     * delisted with their bytes intact, and `'store'` — whose sentence is "nothing was removed" — would be a
     * falsehood about the family's own device.
     */
    it("a refused rollback is 'orphaned', not 'store': something did change (#420 review round 2, B2)", () => {
      twoChildren('p1');
      const realRemove = localStorage.removeItem, realSet = localStorage.setItem;
      (localStorage as unknown as { removeItem: unknown }).removeItem = () => { /* accepted, and kept */ };
      const shorter = JSON.stringify({ v: 1, active: 'p1', ids: ['p1'] });
      // Takes the delete's index, refuses anything longer — which is exactly the rollback.
      (localStorage as unknown as { setItem: unknown }).setItem = (k: string, v: string) => { if (k !== INDEX || v === shorter) mem[k] = v; };
      try { expect(deleteProfile('p2')).toEqual({ ok: false, why: 'orphaned' }); }
      finally {
        (localStorage as unknown as { removeItem: unknown }).removeItem = realRemove;
        (localStorage as unknown as { setItem: unknown }).setItem = realSet;
      }
      // The state the sentence has to describe, asserted rather than trusted.
      expect(JSON.parse(localStorage.getItem(INDEX)!), 'the rollback did not land').toEqual({ v: 1, active: 'p1', ids: ['p1'] });
      expect(JSON.parse(localStorage.getItem(saveKeyFor('p2'))!).name, "and Bo's bytes are still there").toBe('Bo');
      // #431 review item 5: the rollback write is the last one attempted, and it failed — `'orphaned'`'s own
      // sentence already says the device is out of space, and now the latch agrees. `addProfile` itself
      // refuses under a latched `writeFailed` (#380 round 5, B2), so — with the mocked store now put back to
      // one that actually works — a genuine successful write is what a real device gives the family next
      // (any ordinary save), and that is what clears it here, not the passage of time.
      expect(isWriteFailing(), "the failed rollback latches, same as any other refused write").toBe(true);
      // The composition with `addProfile`'s own precheck (pr-test-analyzer, #431 review): a latch this
      // function set is exactly the kind `addProfile` already refuses under (#380 round 5, B2), store back to
      // working or not — it does not re-check the store itself, only the flag.
      expect(addProfile(), "addProfile refuses on the stale latch before it ever probes a slot").toEqual({ ok: false, why: 'store' });
      save({});
      expect(isWriteFailing(), 'a write that actually lands clears a stale latch, same as any other').toBe(false);
      // And it does not heal, which is the half the docstring used to get wrong: no route back to the slot.
      expect(deleteProfile('p2'), 'delisted, so the UI cannot reach it again').toEqual({ ok: false, why: 'unknown' });
      expect(addProfile(), "addProfile's probe skips the occupied slot for good").toEqual({ ok: true, id: 'p3' });
      expect(profileIds(), 'three ninjas, with the fourth slot used up').toEqual(['p1', 'p3']);
    });

    it('a second tab playing someone else keeps its own session when `active` moves (#380 round 5, B2)', () => {
      // p1 Ada, p2 Bo, p3 Cass. This session is playing Ada; the index says Bo is active, as a second tab
      // that switched would leave it. Removing Bo moves `active`, but not this session's child.
      save({ name: 'Ada', coins: 40, onboarded: true });
      expect(addProfile()).toEqual({ ok: true, id: 'p2' });
      save({ name: 'Bo', coins: 7, onboarded: true });
      expect(addProfile()).toEqual({ ok: true, id: 'p3' });
      save({ name: 'Cass', coins: 3, onboarded: true });
      expect(setActiveProfile('p1')).toEqual({ ok: true });
      expect(load().name, 'this session is Ada').toBe('Ada');
      localStorage.setItem('sna:profiles', JSON.stringify({ v: 1, active: 'p2', ids: ['p1', 'p2', 'p3'] }));
      expect(deleteProfile('p2')).toEqual({ ok: true, self: false });
      expect(load().name, "Ada's session survives a delete that was never hers").toBe('Ada');
      expect(load().coins).toBe(40);
      save({ coins: 41 });
      expect(JSON.parse(localStorage.getItem(saveKeyFor('p1'))!).coins, 'and her writes still land in her own slot').toBe(41);
    });

    it("removing the profile this session is playing drops its cache, so a refused save cannot follow it (#151)", () => {
      twoChildren('p2');
      const realSet = localStorage.setItem;
      (localStorage as unknown as { setItem: unknown }).setItem = () => { throw new Error('quota'); };
      try { save({ coins: 999 }); } finally { (localStorage as unknown as { setItem: unknown }).setItem = realSet; }
      expect(isWriteFailing(), 'Bo has 999 coins that never reached disk').toBe(true);
      expect(deleteProfile('p2')).toEqual({ ok: true, self: true });
      expect(isWriteFailing(), 'the latch describes a blob that is gone').toBe(false);
      expect(load().coins, "and Ada's save is what the next read answers").toBe(40);
      save({ coins: 41 });
      expect(JSON.parse(localStorage.getItem(saveKeyFor('p1'))!).coins, "not 999 written into Ada's slot").toBe(41);
    });
  });
});

// #365: a results screen used to persist a finished game in TWO writes — `recordDojo()` then `addCoins()` —
// with nothing tying them together. `save()` swallows a refused `setItem` by design (#151: a device that
// cannot write must not brick the game), so when the second write was the one dropped, the child was shown
// coins that never reached disk while the dojo write HAD landed. Coins are re-earnable; a completed challenge
// is not — write 1 put the challenge id into `dojo.done`, and `applyEvent()` only pays `!done.includes(c.id)`.
// `recordGameEnd()` is the single write, so the store takes the whole finished game or none of it.
describe('a finished game is persisted in one write, or not at all (#365)', () => {
  // Read the blob back through the key the store is actually writing — an earlier describe in this file
  // leaves a different profile active, and a hardcoded `sna:v1` would then assert against a sibling's save.
  const disked = () => JSON.parse(localStorage.getItem(saveKeyFor(activeProfile()))!);
  beforeEach(() => { setActiveProfile('p1'); reset(); });

  /** A store that accepts `n` writes and then throws — the shape that made the old pair lose a challenge. */
  function refuseFromWrite(n: number) {
    const real = localStorage.setItem;
    let seen = 0;
    (localStorage as unknown as { setItem: unknown }).setItem = function (k: string, v: string) {
      if (++seen > n) throw new Error('quota');
      return (real as (k: string, v: string) => void).call(localStorage, k, v);
    };
    return () => { (localStorage as unknown as { setItem: unknown }).setItem = real; };
  }

  const memoryWin = { mode: 'memory' as const, won: true, correct: 12, attempts: 14, bestCombo: 0, stars: 3, score: 120 };

  it('the whole game lands when the store accepts it: the dojo state and the coins agree on disk', () => {
    save({ coins: 4 });
    const out = recordGameEnd(memoryWin, 9);
    const disk = disked();
    expect(disk.coins, 'the game\'s coins and the dojo bonus both landed').toBe(4 + 9 + out.dojo.coins);
    expect(disk.dojo.date, 'the dojo state landed in the same blob').toBe(out.dojo.state.date);
    // Round 1, note 6: on most dates `memoryWin` completes nothing, so this compares [] to [] and the coin
    // line above is what carries the test. Kept because it is free and is the assertion that would catch the
    // two halves landing in different blobs; `bigWin` in the next test is the one that completes a challenge
    // on all 400 dates swept.
    expect(disk.dojo.done, 'and so did what the game completed').toEqual(out.dojo.state.done);
  });

  it('a store that refuses everything leaves neither half on disk (not discriminating — the old pair did too)', () => {
    // Round 1, note 6: the name used to promise more than the body. A store that refuses EVERY write lands
    // nothing under either shape, so this cannot tell the single write from the old pair — the discriminating
    // case is the next test. What it does pin is that a total refusal is clean rather than half-applied, and
    // that #151's report to the grown-ups screen survives it.
    save({ coins: 4 });
    const before = disked();
    const restore = refuseFromWrite(0);                    // the very next write is refused
    try { recordGameEnd(memoryWin, 9); } finally { restore(); }

    const disk = disked();
    expect(disk.coins, 'no coins landed').toBe(4);
    expect(disk.dojo, 'and no dojo progress landed either — the two cannot disagree').toEqual(before.dojo);
    expect(isWriteFailing(), 'the refusal is still reported to the grown-ups screen (#151)').toBe(true);
  });

  it('a store that would refuse a SECOND write never gets asked for one: the finished game is whole', () => {
    // THE case, and the one the issue asks for: a `setItem` that throws on the second call only. Under the old
    // pair, write 1 (the dojo state) landed and write 2 (the coins) was dropped, so the disk carried a
    // challenge recorded as done whose coins never arrived. `applyEvent()` only pays `!done.includes(c.id)`,
    // so no later game — this session or any after a reload — would ever pay it again: the permanent half of
    // the loss, and the reason this is a P2 rather than a cosmetic slip.
    const bigWin = { ...memoryWin, correct: 30 };
    save({ coins: 4 });
    // Round 1, note 6: under the fix the refusal is never actually thrown — there is no second `setItem` to
    // throw on, and that IS the property. Under the old pair it fired, and the assertions below went red.
    const restore = refuseFromWrite(1);                    // the first write lands, a second would be refused
    let out;
    try { out = recordGameEnd(bigWin, 9); } finally { restore(); }

    expect(out.dojo.completed.length, 'the game really did complete a challenge').toBeGreaterThan(0);
    const disk = disked();
    expect(disk.coins, 'the coins the challenge earned are on disk').toBe(4 + 9 + out.dojo.coins);
    for (const c of out.dojo.completed)
      expect(disk.dojo.done, `${c.id} is recorded done, and its coins are there to match`).toContain(c.id);
  });

  it('one write, not two — counted, so the pair cannot quietly come back', () => {
    save({ coins: 0 });
    const real = localStorage.setItem;
    let writes = 0;
    (localStorage as unknown as { setItem: unknown }).setItem = function (k: string, v: string) {
      writes++; return (real as (k: string, v: string) => void).call(localStorage, k, v);
    };
    try { recordGameEnd(memoryWin, 9); } finally { (localStorage as unknown as { setItem: unknown }).setItem = real; }
    expect(writes, 'settling a finished game is exactly one setItem').toBe(1);
  });

  it('a sticker unlocked by the dojo bonus is still reported', () => {
    // Round 1, B1: this test used to seed 29 coins and pay the game's own 1, crossing STICKER_COST[0] === 30
    // with NO dojo bonus in it at all — `memoryWin` pays a bonus on only 68 of 400 dates (verified), and on
    // the rest `out.dojo.coins` is 0, so the name was true of roughly a sixth of the calendar and the
    // assertion could not tell a dropped bonus from a kept one. Pinned to a date where the bonus is real, and
    // seeded so the game's own coins alone fall SHORT of the threshold: the crossing is the bonus's doing or
    // it does not happen.
    const BONUS_DAY = new Date('2026-01-13T12:00:00Z');    // `memory1` is that day's mode challenge
    const gameCoins = 1;
    const seed = STICKER_COST[0] - gameCoins - 4;          // 25: short of 30 without the bonus, past it with

    save({ coins: seed, stickers: [] });
    const out = recordGameEnd(memoryWin, gameCoins, BONUS_DAY);

    expect(out.dojo.coins, 'the fixture must actually earn a bonus, or this test proves nothing')
      .toBeGreaterThan(0);
    expect(seed + gameCoins, 'and the game\'s own coins must NOT reach the threshold on their own')
      .toBeLessThan(STICKER_COST[0]);
    expect(seed + gameCoins + out.dojo.coins).toBeGreaterThanOrEqual(STICKER_COST[0]);

    expect(out.fresh, 'the bonus carried the child over the threshold, and the unlock was reported')
      .toContain(STICKER_IDS[0]);
    expect(disked().stickers, 'and the unlock is on disk with the rest').toEqual(
      expect.arrayContaining(out.fresh));
  });

  it('a sticker the child already owns is not reported as new', () => {
    // Round 1, N1: `addCoins()` pinned this (`shop.test.ts`, `expect(fresh).toEqual([])`); `recordGameEnd()`
    // inherited the `.filter(id => !d.stickers.includes(id))` but not the test, so mutating it to
    // `const fresh = unlocked;` left the whole suite green. That regression puts a "New sticker!" row for
    // every sticker the child already has on every results screen, after every game.
    save({ coins: STICKER_COST[0] + 10, stickers: [STICKER_IDS[0]] });
    const out = recordGameEnd(memoryWin, 1);
    expect(out.fresh, 'already owned, so nothing is new').toEqual([]);
    expect(disked().stickers, 'and it is still owned — nothing is ever taken away (#114)')
      .toContain(STICKER_IDS[0]);
  });
});
