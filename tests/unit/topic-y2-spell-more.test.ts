import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { AVOID, GAP_WORDS } from '../../src/curriculum/util';
import { HOMOPHONE_SETS } from '../../src/curriculum/year2';
import { REAL_LOOKALIKES } from '../../src/curriculum/spelling-rules';
import { A_BEFORE_L, O_FOR_UH, EY, A_AFTER_W, W_OR_AR, S_FOR_ZH } from '../../src/curriculum/year2-spell-more';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y2-spell-more')!;
const RULES: [string, number, typeof EY][] = [
  ['a before l', 1, A_BEFORE_L], ['o for /ʌ/', 1, O_FOR_UH], ['-ey', 2, EY], ['a after w/qu', 2, A_AFTER_W], ['or/ar after w', 3, W_OR_AR], ['s for /ʒ/', 3, S_FOR_ZH],
];
const BANK = RULES.flatMap(r => r[2]);

describe('y2-spell-more (#1014)', () => {
  it('sits directly after y2-spell-tion in the registry', () => {
    const ids = TOPICS.filter(t => t.year === 'year2').map(t => t.id);
    expect(ids.indexOf('y2-spell-more')).toBe(ids.indexOf('y2-spell-tion') + 1);
  });

  it('every decoy is a non-word and no answer is a homophone, over the whole bank', async () => {
    const homophones = new Set(HOMOPHONE_SETS.flat());
    for (const [word, sentence, decoys] of BANK) {
      expect(sentence.split('___').length, `${word}: exactly one gap`).toBe(2);
      expect(sentence.toLowerCase().includes(word), `${word} leaks into its own sentence`).toBe(false);
      expect(decoys.length, word).toBe(3);
      expect(homophones.has(word), `${word} has a common homophone`).toBe(false);
      expect(AVOID.has(word), `${word} is crude`).toBe(false);
      expect(new Set(decoys).size, `${word}: duplicate decoys`).toBe(decoys.length);
      for (const dc of decoys) {
        expect(dc === word, `${dc} is the answer`).toBe(false);
        expect(GAP_WORDS.has(dc) || AVOID.has(dc) || REAL_LOOKALIKES.has(dc) || homophones.has(dc), `${dc} is a real word`).toBe(false);
        for (const a of AVOID) expect(dc.includes(a), `${dc} contains ${a}`).toBe(false);
      }
    }
  });

  it('keeps ball, all, key, talk and war out as answers', () => {
    const words = BANK.map(r => r[0]);
    for (const w of ['ball', 'all', 'key', 'talk', 'war']) expect(words).not.toContain(w);
  });

  it('pins every answer and decoy a card can show, sorted, so a change arrives in a diff (#418)', () => {
    const all = BANK.flatMap(([w, , ds]) => [w, ...ds]).sort();
    expect(all).toEqual(PINNED);
    expect(new Set(all).size, 'no spelling appears twice').toBe(all.length);
  });

  it('unlocks each rule at its difficulty; 3 bubbles at d1, 4 from d2; each card with a sentence and a say', () => {
    for (const d of [1, 2, 3] as Difficulty[]) {
      const seen = new Set<string>();
      for (let s = 1; s <= 800; s++) {
        const q = topic.gen(d, rng(s * 7 + d));
        const rule = RULES.find(r => r[2].some(row => row[0] === q.answer))!;
        expect(rule[1], `${q.answer} (${rule[0]}) not allowed at d${d}`).toBeLessThanOrEqual(d);
        seen.add(rule[0]);
        expect(q.options.length).toBe(d === 1 ? 3 : 4);
        expect(q.options).toContain(q.answer);
        expect(new Set(q.options).size).toBe(q.options.length);
        expect(q.visual).toEqual({ type: 'sentence', text: expect.stringContaining('___') });
        expect(q.say).toContain(q.answer);
        expect(q.say).toContain('blank');
        const row = BANK.find(r => r[0] === q.answer)!;
        for (const o of q.options) if (o !== q.answer) expect(row[2]).toContain(o);
      }
      expect([...seen].sort()).toEqual(RULES.filter(r => r[1] <= d).map(r => r[0]).sort());
    }
  });
});

const PINNED = [
  'brother', 'brothur', 'brutha', 'bruther', 'chalk', 'chaulk', 'chawk', 'chimnee', 'chimney', 'chimnie', 'chimny',
  'chork', 'donkee', 'donkey', 'donkie', 'donky', 'fall', 'faul', 'fawl', 'forl', 'measure', 'meazure', 'mezher',
  'mezure', 'monkee', 'monkey', 'monkie', 'monky', 'month', 'monthe', 'mother', 'mothur', 'munnth', 'munth', 'mutha',
  'muther', 'nothin', 'nothing', 'nuthin', 'nuthing', 'pleasure', 'pleazure', 'plejure', 'pleshure', 'skwash',
  'skwosh', 'small', 'smaul', 'smawl', 'smorl', 'squash', 'squosh', 'swarm', 'swaurm', 'swawm', 'swoarm',
  'televigion', 'televijon', 'television', 'televizion', 'treasure', 'treazure', 'trezher', 'trezure', 'usual',
  'vallee', 'valley', 'vallie', 'vally', 'wach', 'walk', 'wander', 'want', 'warm', 'warn', 'watch', 'waurm', 'waurn',
  'wawk', 'wawm', 'wawn', 'wawnt', 'werd', 'werk', 'werld', 'wirk', 'wirld', 'wirrd', 'woarm', 'woarn', 'wock',
  'wondar', 'wondur', 'wonnder', 'wonnt', 'word', 'work', 'world', 'worlk', 'wotch', 'wotche', 'wunt', 'wurd',
  'wurk', 'wurld', 'yoozhual', 'youzual', 'yuzual'
];
