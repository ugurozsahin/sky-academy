import { describe, it, expect } from 'vitest';
import { gateChallenge, checkGate, parentSummary, pct, RANK_MIN_TRIES } from '../../src/game/parents';
import { TOPICS, YEARS, topicsFor } from '../../src/curriculum';
import { SAVE_VERSION, STICKER_IDS, type ProfileCard, type SaveData, type TopicProgress } from '../../src/storage';
import { canRemoveCard, canRenameCard, DELETE_HINTS, RENAME_HINTS } from '../../src/ui/parents';
import { freshDojo } from '../../src/game/dojo';

const base: SaveData = {
  v: SAVE_VERSION, name: 'Test', avatar: 'kai', year: 'year1', sound: true, speech: true, voice: 'unknown',
  progress: {}, endless: {}, sprint: {}, boss: {}, memory: {}, training: {}, certs: [],
  coins: 0, spent: 0, owned: [], equipped: {}, stickers: [], streak: { last: '', days: 0 }, tutorialSeen: false, dojo: freshDojo(''), onboarded: true, duels: [],
};
const p = (stars: number, plays: number, hits?: number, tries?: number): TopicProgress => ({ stars, best: 0, plays, hits, tries });
// small deterministic rng
const rngOf = (seed: number) => { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; };

describe('grown-ups gate', () => {
  it('asks a times-table question with both factors 6–9', () => {
    const r = rngOf(7);
    for (let i = 0; i < 500; i++) {
      const g = gateChallenge(r);
      expect(g.a).toBeGreaterThanOrEqual(6); expect(g.a).toBeLessThanOrEqual(9);
      expect(g.b).toBeGreaterThanOrEqual(6); expect(g.b).toBeLessThanOrEqual(9);
      expect(g.answer).toBe(g.a * g.b);
      expect(g.prompt).toBe(`${g.a} × ${g.b}`);
    }
  });
  it('accepts only the exact whole-number answer', () => {
    expect(checkGate('42', 42)).toBe(true);
    expect(checkGate('  42 ', 42)).toBe(true);       // surrounding spaces are fine
    expect(checkGate('43', 42)).toBe(false);
    expect(checkGate('', 42)).toBe(false);
    expect(checkGate('4two', 42)).toBe(false);
    expect(checkGate('42x', 42)).toBe(false);
    expect(checkGate('4.2', 42)).toBe(false);        // not a whole number
    expect(checkGate('042', 42)).toBe(true);         // leading zeros still parse
  });
});

describe('parent dashboard summary', () => {
  it('an untouched save reports nothing played but the full topic count', () => {
    const sm = parentSummary(base, TOPICS, YEARS, STICKER_IDS.length);
    expect(sm.totalAnswered).toBe(0);
    expect(sm.overallAccuracy).toBeNull();
    expect(sm.starsEarned).toBe(0);
    expect(sm.starsMax).toBe(TOPICS.length * 3);
    expect(sm.topicsTried).toBe(0);
    expect(sm.topicsTotal).toBe(TOPICS.length);
    expect(sm.weakest).toEqual([]);
    expect(sm.strongest).toEqual([]);
    expect(sm.stickersTotal).toBe(STICKER_IDS.length);
    expect(sm.modes).toHaveLength(YEARS.length);
  });

  it('aggregates accuracy, stars, weakest/strongest and per-mode bests', () => {
    const data: SaveData = {
      ...base,
      progress: {
        'y1-add': p(3, 5, 45, 50),    // 90 %
        'y1-sub': p(1, 3, 6, 20),     // 30 %  → weakest
        'y1-bonds': p(2, 2, 3, 5),    // 60 %  (tries == RANK_MIN_TRIES, still ranked)
        'r-count': p(1, 1, 2, 3),     // only 3 tries → below the ranking threshold
      },
      endless: { year1: 120 }, sprint: { year1: 15 }, boss: { year1: 2 }, memory: { year1: 1 }, training: { year1: 3 },
      coins: 70, stickers: ['volt', 'blaze'], streak: { last: '2026-09-06', days: 4 },
    };
    const sm = parentSummary(data, TOPICS, YEARS, STICKER_IDS.length);

    expect(sm.totalAnswered).toBe(50 + 20 + 5 + 3);
    expect(sm.totalCorrect).toBe(45 + 6 + 3 + 2);
    expect(pct(sm.overallAccuracy)).toBe(Math.round((56 / 78) * 100));   // 72
    expect(sm.starsEarned).toBe(3 + 1 + 2 + 1);
    expect(sm.topicsTried).toBe(4);

    // ranking uses only topics with >= RANK_MIN_TRIES answers, weakest first
    expect(sm.weakest.map(t => t.id)).toEqual(['y1-sub', 'y1-bonds', 'y1-add']);
    expect(sm.strongest[0].id).toBe('y1-add');
    expect(sm.weakest.some(t => t.id === 'r-count')).toBe(false);        // excluded: only 3 tries
    expect(RANK_MIN_TRIES).toBe(5);

    const y1 = sm.years.find(y => y.id === 'year1')!;
    expect(y1.answered).toBe(50 + 20 + 5);
    expect(y1.correct).toBe(45 + 6 + 3);
    expect(pct(y1.accuracy)).toBe(Math.round((54 / 75) * 100));          // 72
    expect(y1.stars).toBe(6);
    expect(y1.maxStars).toBe(topicsFor('year1').length * 3);
    expect(y1.topicsTried).toBe(3);

    const rec = sm.years.find(y => y.id === 'reception')!;
    expect(rec.answered).toBe(3);
    expect(rec.correct).toBe(2);
    expect(rec.topicsTried).toBe(1);

    const m1 = sm.modes.find(m => m.id === 'year1')!;
    expect(m1).toMatchObject({ endless: 120, sprint: 15, boss: 2, memory: 1, training: 3 });
    const m2 = sm.modes.find(m => m.id === 'year2')!;
    expect(m2).toMatchObject({ endless: 0, sprint: 0, boss: 0, memory: 0, training: 0 });

    expect(sm.coins).toBe(70);
    expect(sm.stickers).toBe(2);
    expect(sm.streakDays).toBe(4);
  });

  // #95: importSave() only checks the version, so a hand-edited or corrupted "Restore" paste can carry any of
  // these fields as anything — `{ v: 1, progress: null }` passes the version check and is written straight
  // through. parentSummary() used to index `data.progress[t.id]` directly and throw the moment `progress`
  // itself was not an object; it now reads every per-topic/per-year field the same tolerant way storage.ts's
  // own achievement calculations already do (#270).
  it('never throws on a corrupted save, and reads every affected field as empty', () => {
    const corrupted: SaveData = {
      ...base,
      progress: null as unknown as SaveData['progress'],
      endless: null as unknown as SaveData['endless'],
      sprint: 'not an object' as unknown as SaveData['sprint'],
      boss: [] as unknown as SaveData['boss'],
      memory: undefined as unknown as SaveData['memory'],
      training: 42 as unknown as SaveData['training'],
    };
    let sm: ReturnType<typeof parentSummary>;
    expect(() => { sm = parentSummary(corrupted, TOPICS, YEARS, STICKER_IDS.length); }).not.toThrow();
    expect(sm!.topicsTried).toBe(0);
    expect(sm!.starsEarned).toBe(0);
    expect(sm!.modes.every(m => m.endless === 0 && m.sprint === 0 && m.boss === 0 && m.memory === 0 && m.training === 0)).toBe(true);
  });

  it('pct rounds and passes null through', () => {
    expect(pct(null)).toBeNull();
    expect(pct(0.725)).toBe(73);
    expect(pct(1)).toBe(100);
    expect(pct(0)).toBe(0);
  });
});

/**
 * #20 slice 3 — the two rules the grown-ups list is built on that a screenshot could not tell you: which rows
 * offer a rename, and that every refusal the store can return has a sentence to show for it.
 */
describe('ninjas on this device (#20 slice 3)', () => {
  const card = (over: Partial<ProfileCard> = {}): ProfileCard => ({ id: 'p1', name: '', avatar: null, onboarded: false, future: false, ...over });

  it('offers a rename exactly when there is a save behind the row', () => {
    expect(canRenameCard(card()), 'a slot ＋ created and nothing ever played').toBe(false);
    expect(canRenameCard(card({ onboarded: true })), 'played').toBe(true);
    expect(canRenameCard(card({ avatar: 'volt' })), 'mid-wizard: a ninja chosen, no name yet').toBe(true);
    expect(canRenameCard(card({ name: 'Ada' })), 'a name and no ninja is still a save').toBe(true);
    expect(canRenameCard(card({ name: '   ' })), 'spaces are not a name').toBe(false);
    // The arm the rail's "exactly when" was claiming and never feeding (#420 review round 2, note 2): a save
    // this build cannot read has a name, and it is not one a rename may touch.
    expect(canRenameCard(card({ onboarded: true, future: true })), 'a newer build wrote it, so there is nothing to change here').toBe(false);
    expect(canRenameCard(card({ name: 'Bo', avatar: 'blaze', future: true })), 'name and ninja notwithstanding').toBe(false);
  });

  /**
   * `canRemoveCard`'s three exclusions, which had no unit test for the first two while `canRenameCard`'s did
   * (#420 review round 2, note 1) — both were held only by the mobile e2e, and inverting either was green on
   * the unit suite. The third (#446) is the one this rail was written for: it has no e2e coverage yet, because
   * reproducing it needs two profiles, one of them a `future` save.
   */
  it('offers Remove for every ninja except the last one, except a save a newer build wrote, and except one whose removal would strand the family (#446)', () => {
    expect(canRemoveCard(card({ onboarded: true }), [card({ id: 'p2' })]), 'one of several, sibling readable').toBe(true);
    expect(canRemoveCard(card({ onboarded: true }), []), 'the only one — that is "Start again"').toBe(false);
    expect(canRemoveCard(card({ future: true }), [card({ id: 'p2' })]), '99 coins this build cannot read are behind it').toBe(false);
    expect(canRemoveCard(card(), [card({ id: 'p2' })]), 'an unplayed slot is removable: it is the only way the family gets it back').toBe(true);
    // #446: a readable profile with siblings, but every sibling is a `future` save — removing it would leave
    // nobody this build can open, so the button must not offer that.
    expect(canRemoveCard(card({ onboarded: true }), [card({ id: 'p2', future: true })]),
      'the only sibling is unreadable by this build').toBe(false);
    expect(canRemoveCard(card({ onboarded: true }), [card({ id: 'p2', future: true }), card({ id: 'p3', onboarded: true })]),
      'one sibling unreadable, another readable — the family is not stranded').toBe(true);
  });

  /**
   * The maps are `Record`s over the refusal unions, so a new refusal is a type error rather than a blank
   * status line — but nothing stops an entry being added as `''`, and an empty `role="status"` is exactly the
   * silence the values exist to prevent. These are `renameProfile`'s and `deleteProfile`'s own unions,
   * re-stated here so a refusal that loses its sentence fails a test instead of a review.
   */
  it('has a sentence for every refusal the store can return, and names the safer route out of the last one', () => {
    for (const [why, text] of [...Object.entries(RENAME_HINTS), ...Object.entries(DELETE_HINTS)])
      expect(text.trim().length, why).toBeGreaterThan(10);
    // The refusal that has to teach a grown-up what to do instead: `deleteProfile` sends the only profile to
    // "Start again", which is the control that asks for the typed word.
    expect(DELETE_HINTS.last).toContain('Start again');
    expect(DELETE_HINTS.last).toContain('RESET');
  });
});
