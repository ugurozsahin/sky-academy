import { beforeEach, describe, expect, it } from 'vitest';
import { listProgress, mergeWords } from '../../src/word-record';
import { STATUTORY_LISTS } from '../../src/curriculum/statutory-lists';
import { Y3_WORDLIST } from '../../src/curriculum/wordlist-y3';
import { Y4_WORDLIST } from '../../src/curriculum/wordlist-y4';
import { Y5_WORDLIST } from '../../src/curriculum/year5-wordlist';
import { Y6_WORDLIST } from '../../src/curriculum/wordlist-y6';
import { wordListQ } from '../../src/curriculum/spelling-ks2';
import { createFactLog } from '../../src/fact-record';
import { load, recordGameEnd, reset } from '../../src/storage';
import { parentSummary } from '../../src/game/parents';
import { CORE_TOPICS, YEARS } from '../../src/curriculum';
import { STICKER_IDS } from '../../src/storage';
import { wordsHTML } from '../../src/ui/parents-words';
import { factsOf } from '../../src/ui/play-facts';

const mem: Record<string, string> = {};
(globalThis as any).localStorage = { getItem: (k: string) => mem[k] ?? null, setItem: (k: string, v: string) => { mem[k] = v; }, removeItem: (k: string) => { delete mem[k]; }, clear: () => { for (const k in mem) delete mem[k]; } };
const game = { mode: 'mission' as const, won: true, correct: 1, attempts: 2, bestCombo: 0, stars: 2, score: 50 };
const rng = () => 0.3;

describe('mergeWords / listProgress (#1289)', () => {
  it('keeps the last three outcomes, newest last', () => {
    let r: Record<string, string> = {};
    for (const right of [true, false, true, true, true]) r = mergeWords(r, [{ word: 'busy', right }]);
    expect(r.busy).toBe('rrr');
    expect(mergeWords({ busy: 'rrr' }, [{ word: 'busy', right: false }]).busy).toBe('rrw');
  });
  it('is secure only on rrr; counts tried, secure and the not-secure words in list order', () => {
    const p = listProgress(['a', 'b', 'c', 'd'], { d: 'rrr', b: 'rw', a: 'rrr', x: 'w' });
    expect(p).toEqual({ secure: 2, tried: 3, total: 4, notSecure: ['b'] });
    expect(listProgress(['a'], { a: 'rr' }).secure).toBe(0);
  });
});

describe('the statutory lists (#1289)', () => {
  const [y34, y56] = STATUTORY_LISTS;
  it('y34 has 100 unique words, the first form of each Year 3–4 entry', () => {
    expect(y34.words).toHaveLength(100);
    expect(new Set(y34.words).size).toBe(100);
    expect(y34.words).toEqual([...Y3_WORDLIST, ...Y4_WORDLIST].map(e => e.forms[0].w));
  });
  it('y56 equals the Year 5 and Year 6 banks on main, each once', () => {
    expect(y56.words).toEqual([...Y5_WORDLIST, ...Y6_WORDLIST].map(e => e.forms[0].w));
    expect(new Set(y56.words).size).toBe(y56.words.length);
  });
  it('every word is storable (letters only) and fits the save’s 200-word cap together', () => {
    const all = STATUTORY_LISTS.flatMap(l => l.words);
    expect(all.every(w => /^[A-Za-z]{1,20}$/.test(w))).toBe(true);
    expect(all.length).toBeLessThanOrEqual(200);
  });
  it('every entry’s card carries its first form as listWord, whichever form is drawn', () => {
    let multi = 0;
    for (const e of [...Y3_WORDLIST, ...Y4_WORDLIST, ...Y5_WORDLIST, ...Y6_WORDLIST]) {
      const n = e.forms.length; if (n > 1) multi++;
      for (let k = 0; k < n; k++) for (const d of [1, 2, 3] as const) expect(wordListQ(() => (k + 0.5) / n, e, d).listWord).toBe(e.forms[0].w);
    }
    expect(multi).toBeGreaterThan(0);   // busy/business and friends: the property is only tested if some entry has two forms
  });
});

describe('the word record is written and read end to end (#1289)', () => {
  beforeEach(() => reset());
  it('createFactLog notes a listWord card and ignores others', () => {
    const log = createFactLog();
    log.note(wordListQ(rng, Y3_WORDLIST[2], 1), 'correct');
    log.note({ prompt: 'p', answer: 'a', options: [] }, 'wrong');
    expect(log.words()).toEqual([{ word: Y3_WORDLIST[2].forms[0].w, right: true }]);
  });
  it('note() credits only a correct answer: wrong and miss are both w', () => {
    const q = wordListQ(rng, Y3_WORDLIST[2], 1), log = createFactLog();
    for (const o of ['correct', 'wrong', 'miss']) log.note(q, o);
    expect(log.words().map(w => w.right)).toEqual([true, false, false]);
  });
  it('factsOf hands the logged words to the save, and a mixed game keeps both facts and words', () => {
    const log = createFactLog();
    log.note(wordListQ(rng, Y3_WORDLIST[2], 1), 'correct');
    log.note({ prompt: '7 × 8', answer: '56', options: [], fact: '7×8' }, 'correct');
    const e = factsOf({ facts: log } as any, { mode: 'mission' }, { incomplete: false } as any);
    expect(e.words).toEqual([{ word: Y3_WORDLIST[2].forms[0].w, right: true }]);
    recordGameEnd({ ...game, ...e, check: undefined }, 0);
    expect(load().ks2.words).toEqual({ [Y3_WORDLIST[2].forms[0].w]: 'r' });
    expect(load().ks2.facts['7×8']).toMatchObject({ right: 1 });
  });
  it('recordGameEnd merges words into ks2.words; a wrong or missed answer is w', () => {
    recordGameEnd({ ...game, words: [{ word: 'address', right: true }, { word: 'answer', right: false }] }, 0);
    recordGameEnd({ ...game, words: [{ word: 'address', right: true }] }, 0);
    expect(load().ks2.words).toEqual({ address: 'rr', answer: 'w' });
  });
  it('the dashboard section is absent with no tried word, and reads "N of 100 secure" with the not-yet words', () => {
    expect(wordsHTML(parentSummary(load(), CORE_TOPICS, YEARS, STICKER_IDS.length).words)).toBe('');
    const w = STATUTORY_LISTS[0].words;
    recordGameEnd({ ...game, words: [...w.slice(0, 2), w[0], w[0]].map((word, i) => ({ word, right: i !== 1 })) }, 0);
    const html = wordsHTML(parentSummary(load(), CORE_TOPICS, YEARS, STICKER_IDS.length).words);
    expect(html).toContain('Year 3–4 words: 1 of 100 secure · 1 not yet secure · 98 not tried yet');
    expect(html).toContain(w[1]);
    expect(html).toContain('Copy these words');
    expect(html).not.toContain('Year 5–6');
  });
  it('with only Year 5–6 tried the button is indexed from 0; with both tried each list has its own', () => {
    const row = (title: string, notSecure: string[]) => ({ title, secure: 0, tried: notSecure.length, total: 100, notSecure });
    const only56 = wordsHTML([row('Year 5–6', ['yacht'])]);
    expect(only56).toContain('data-words="0"'); expect(only56).toContain('id="words-0">yacht');
    const both = wordsHTML([row('Year 3–4', ['busy']), row('Year 5–6', ['yacht'])]);
    expect(both).toContain('id="words-1">yacht'); expect(both).toContain('data-words="1"');
  });
});
