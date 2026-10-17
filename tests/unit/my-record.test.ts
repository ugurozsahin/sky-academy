import { describe, it, expect } from 'vitest';
import { DEFAULT } from '../../src/storage/shape';
import type { SaveData } from '../../src/storage';
import { recordLines } from '../../src/ui/my-record';
import { Y3_WORDLIST } from '../../src/curriculum/wordlist-y3';
import { Y5_WORDLIST } from '../../src/curriculum/year5-wordlist';

const save = (ks2: Partial<SaveData['ks2']> = {}): SaveData => ({ ...DEFAULT, ks2: { ...DEFAULT.ks2, ...ks2 } });
const y3 = Y3_WORDLIST[0].forms[0].w, y5 = Y5_WORDLIST[0].forms[0].w;

describe('rewards "My record" lines (#1292)', () => {
  it('an empty save gives no lines, so a KS1 child sees today\'s rewards screen', () => {
    expect(recordLines(save())).toEqual([]);
    expect(recordLines(DEFAULT)).toEqual([]);
  });

  it('the fastest tables speed alone: one decimal place, in seconds per answer', () => {
    expect(recordLines(save({ bestSpeed: 2.4 }))).toEqual(['My record · fastest tables: 2.4 seconds per answer']);
    expect(recordLines(save({ bestSpeed: 3 }))).toEqual(['My record · fastest tables: 3.0 seconds per answer']);
    expect(recordLines(save({ bestSpeed: 2.449 }))[0]).toContain('2.4 seconds');
  });

  it('a speed that is not a positive number is not a record', () => {
    for (const bad of [0, -1, NaN, Infinity]) expect(recordLines(save({ bestSpeed: bad })), String(bad)).toEqual([]);
  });

  it('the words line alone: only a list with a word tried, "secure of total", the other list left out until it is tried', () => {
    const one = recordLines(save({ words: { [y3]: 'rrr' } }));
    expect(one).toHaveLength(1);
    expect(one[0]).toMatch(/^My record · spelling words secure: Year 3–4 1 of \d+$/);
    expect(one[0]).not.toContain('Year 5–6');
    const both = recordLines(save({ words: { [y3]: 'rrr', [y5]: 'w' } }));
    expect(both[0]).toMatch(/^My record · spelling words secure: Year 3–4 1 of \d+ · Year 5–6 0 of \d+$/);
  });

  it('a word tried but not yet secure counts as tried, not secure', () => {
    expect(recordLines(save({ words: { [y3]: 'rw' } }))[0]).toMatch(/Year 3–4 0 of/);
  });

  it('both lines, speed first', () => {
    const lines = recordLines(save({ bestSpeed: 2.4, words: { [y3]: 'rrr' } }));
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain('fastest tables'); expect(lines[1]).toContain('spelling words secure');
  });

  it('never says official, STA or the DfE', () => {
    for (const l of recordLines(save({ bestSpeed: 2.4, words: { [y3]: 'rrr' } }))) expect(l).not.toMatch(/official|STA\b|DfE/i);
  });
});
