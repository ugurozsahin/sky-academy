import { describe, it, expect, beforeEach } from 'vitest';
import { addCoins, ACHIEVEMENTS, certificates, dojoToday, evaluateStickers, exportSave, fileCert, importSave, isFutureSave, isMigratable, isReadOnlySave, load, migrate, recordAccuracy, recordBossWin, recordCert, recordDojo, recordEndless, recordMemory, recordSprint, recordTopic, recordTraining, reset, save, saveVersionOf, stickersFor, touchStreak, CERT_CAP, SAVE_VERSION, SPRINT_STICKER_SCORE, STICKER_IDS, STICKER_COST, TOPICS_STARRED_GOAL, UNREADABLE_VERSION, type StoredCert } from '../../src/storage';
import { certFromStored } from '../../src/ui/certificate';
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
    expect(stored.voice).toBe('unknown');            // v1 → v2 adds the launch-to-launch TTS verdict (#65)
    expect(stored.tutorialSeen).toBe(false);         // key absent in the blob → filled from DEFAULT
    expect(stored.boss).toEqual({});
    expect(stored.owned).toEqual([]);
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
    save({ certs: ['nonsense', null, 42, {}, partial, truncated, { ...cert(), stars: NaN }, cert()] as unknown as StoredCert[] });
    expect(certificates()).toEqual([cert()]);
    save({ certs: 'not an album' as unknown as StoredCert[] });
    expect(certificates()).toEqual([]);
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
  // `avatarScreen()`'s `esc(d.name)`/`hasName(d.name)` both throw on a non-string.
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

  it('a corrupted name does not brick the avatar screen — importSave() then avatarScreen()-shaped reads', () => {
    expect(importSave(JSON.stringify({ v: 1, name: 123, avatar: 'volt' }))).toBe(true);
    const d = load();
    expect(typeof d.name).toBe('string');
    expect(() => esc(d.name)).not.toThrow();
    expect(() => d.name.trim()).not.toThrow();
  });

  it('every record*() writer, touchStreak() and recordDojo() survive a save corrupted in every field they touch', () => {
    expect(importSave(JSON.stringify({
      v: 1, name: 'Bad', progress: null, endless: null, sprint: 'nope', boss: [], memory: undefined, training: 42,
      streak: null, dojo: null,
    }))).toBe(true);

    expect(() => recordTopic('y1-add', 2, 40)).not.toThrow();
    expect(() => recordAccuracy('y1-add', 3, 4)).not.toThrow();
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
