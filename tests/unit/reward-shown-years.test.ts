// #1039: rewards, dashboard and footer must ignore a hidden KS2 island — this file, not storage.test.ts,
// because storage.test.ts is a frozen `fileLines` ratchet file that must not grow (#1388).
import { describe, it, expect, vi } from 'vitest';

/**
 * No KS2 `YearId` exists on `main` yet, so a hidden island is reproduced with a `vi.doMock` of the curriculum
 * barrel that appends one fixture year and one fixture topic on it, below `meetsShowGate` (real
 * `shownYears()` is reused as-is, so the fixture year is never returned by it) — a dynamic re-import of
 * `storage.ts` afterwards picks up the mocked barrel. `vi.doMock`/dynamic `import()`, not the hoisted
 * `vi.mock`, so no other test file's static, real registry is ever touched.
 */
describe('rewards ignore a hidden KS2 island (#1039)', () => {
  it('a topic on a hidden year moves no reward, and a sticker already earned stays earned', async () => {
    vi.resetModules();
    vi.doMock('../../src/curriculum', async (importOriginal) => {
      const actual = await importOriginal<typeof import('../../src/curriculum')>();
      const fixtureTopic = { id: 'fx-year3-hidden', title: 'Fixture', icon: '🧪', subject: 'maths' as const, year: 'year3', nc: 'fixture', gen: () => ({ prompt: '', answer: '', options: [] }) };
      const fixtureYear = { id: 'year3', title: 'Year 3', short: 'Y3', age: '7–8', blurb: '', tint: '#000000' };
      const TOPICS = [...actual.TOPICS, fixtureTopic] as typeof actual.TOPICS;
      return {
        ...actual, TOPICS,
        YEARS: [...actual.YEARS, fixtureYear] as typeof actual.YEARS,
        topicById: (id: string) => TOPICS.find(t => t.id === id),
        topicsFor: (year: string, subject?: string) => TOPICS.filter(t => t.year === year && (!subject || t.subject === subject)) as typeof actual.TOPICS,
        // The fixture year never meets `meetsShowGate` (one topic, well under the KS2 minimum), so the real
        // gate — unmocked — never shows it; `listedTopics` is re-derived the same way `curriculum/index.ts` builds it.
        shownYears: () => actual.shownYears(),
        listedTopics: () => { const shown = new Set(actual.shownYears().map(y => y.id)); return TOPICS.filter(t => shown.has(t.year)); },
      };
    });
    try {
      const fresh = await import('../../src/storage');
      fresh.reset();
      fresh.recordTopic('r-count', 1, 5); fresh.recordTopic('y1-bonds', 1, 5); fresh.recordTopic('y2-tables', 1, 5);
      const withThreeIslands = fresh.evaluateStickers(fresh.load());
      expect(withThreeIslands).toContain('gust');
      fresh.recordTopic('fx-year3-hidden', 1, 5);   // starring the hidden island's only topic
      expect(fresh.evaluateStickers(fresh.load()), 'a hidden year is not one of shownYears(), so it moves nothing').toEqual(withThreeIslands);
    } finally {
      vi.doUnmock('../../src/curriculum');
      vi.resetModules();
    }
  });
});
