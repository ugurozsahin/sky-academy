import { describe, expect, it } from 'vitest';
import { ks2Lines, parentSummary, progressText } from '../../src/game/parents';
import { STICKER_IDS, type SaveData } from '../../src/storage';
import { DEFAULT } from '../../src/storage/shape';
import { STATUTORY_LISTS } from '../../src/curriculum/statutory-lists';
import { leastSecure } from '../../src/fact-record';
import { listedTopics, shownYears } from '../../src/curriculum';

const now = new Date('2026-10-03T12:00:00');
const withKs2 = (ks2: Partial<SaveData['ks2']>): SaveData => ({ ...DEFAULT, ks2: { ...DEFAULT.ks2, ...ks2 } });
const text = (d: SaveData) => progressText(parentSummary(d, listedTopics(), shownYears(), STICKER_IDS.length, now, listedTopics()), 'Mia', now);
const w = STATUTORY_LISTS[0].words;

describe('KS2 lines in the copyable summary (#1290)', () => {
  it('a save with no KS2 data gives exactly the five lines it gave before', () => {
    const t = text(DEFAULT).split('\n');
    expect(t).toEqual([
      'Sharpwise — progress for Mia, 3 October 2026',
      'This week: no play yet.',
      expect.stringMatching(/^Stars: /),
      'Going well: not enough play yet',
      'Where to help: not enough play yet',
    ]);
    expect(ks2Lines(DEFAULT)).toEqual([]);
  });
  it('the Tables Check line appears alone: best of all, last is the newest (checks are newest first)', () => {
    const d = withKs2({ checks: [{ date: '2026-10-02', score: 19, missed: [] }, { date: '2026-10-01', score: 22, missed: [] }] });
    expect(ks2Lines(d)).toEqual(['Tables Check practice: best 22 out of 25 (last 19)']);
    expect(text(d).split('\n').pop()).toBe('Tables Check practice: best 22 out of 25 (last 19)');
  });
  it('the facts line lists leastSecure(facts, 5) in its own order, at most five entries', () => {
    const facts: SaveData['ks2']['facts'] = {};
    for (let b = 2; b <= 8; b++) facts[`7×${b}`] = { right: 0, wrong: b, slow: 0, last: 'w', day: '2026-10-01' };
    const lines = ks2Lines(withKs2({ facts }));
    expect(lines).toHaveLength(1);
    const want = leastSecure(facts, 5).map(l => l.map(f => f.replace('×', ' × ')).join(' and '));
    expect(want).toHaveLength(5);
    expect(lines[0]).toBe(`Times-table facts to practise: ${want.join(', ')}`);
  });
  it('words: only unsecure tried words, capped at 12 with "+N more"', () => {
    const words: Record<string, string> = {};
    for (const x of w.slice(0, 15)) words[x] = 'w';
    words[w[15]] = 'rrr';
    const lines = ks2Lines(withKs2({ words }));
    expect(lines).toEqual([`Year 3–4 spelling words not yet secure: ${w.slice(0, 12).join(', ')}, … (+3 more)`]);
  });
  it('a list whose tried words are all secure adds no line', () => {
    expect(ks2Lines(withKs2({ words: { [w[0]]: 'rrr' } }))).toEqual([]);
  });
  it('never mentions a save code, a prediction or "official"', () => {
    const d = withKs2({ checks: [{ date: '2026-10-02', score: 19, missed: [] }], words: { [w[0]]: 'w' } });
    expect(text(d)).not.toMatch(/official|predict|code/i);
  });
});
