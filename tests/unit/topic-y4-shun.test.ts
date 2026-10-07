import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { AVOID, GAP_WORDS } from '../../src/curriculum/util';
import { HOMOPHONE_SETS } from '../../src/curriculum/year2';
import { REAL_LOOKALIKES } from '../../src/curriculum/spelling-rules';
import { TION_BANK, EXCEPTION_BANK, SSION_BANK, SION_BANK, CIAN_BANK } from '../../src/curriculum/year4-shun';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y4-shun')!;
const BANK = [...TION_BANK, ...EXCEPTION_BANK, ...SSION_BANK, ...SION_BANK, ...CIAN_BANK];
const ENDINGS = ['tion', 'sion', 'ssion', 'cian'];
const EXCEPTIONS = ['attend', 'intend'];
// `AVOID` is a gap-spelling denylist and lists no crude whole words (G13): a short local set too.
const EXCLUDE = ['gay', 'queer', 'bitch', 'butt'];
// Real, if rare, words that a decoy happens to spell (checked by eye; a child will not meet them).
const RARE = new Set(['intension']);

/** The test's own Appendix 1 rule over the root word. */
function ruleFor(root: string): string {
  if (/ss$|mit$/.test(root)) return 'ssion';
  if (/cs?$/.test(root)) return 'cian';
  if (/d$|se$/.test(root)) return EXCEPTIONS.includes(root) ? 'tion' : 'sion';
  if (/te?$/.test(root)) return 'tion';
  throw new Error(`no rule for ${root}`);
}

describe('y4-shun (#1161)', () => {
  it('is registered once in Year 4 spelling', () => {
    expect(TOPICS.filter(t => t.id === 'y4-shun')).toHaveLength(1);
    expect(topic).toMatchObject({ year: 'year4', subject: 'writing', strand: 'spelling' });
  });

  it('the root rule gives the answer for every row, and stem plus answer is the word', () => {
    const homophones = new Set(HOMOPHONE_SETS.flat());
    for (const [stem, ending, root, sentence] of BANK) {
      const word = stem + ending;
      expect(ruleFor(root), `${word}: rule over ${root}`).toBe(ending);
      expect(sentence.split('___').length, `${word}: exactly one gap`).toBe(2);
      expect(sentence.endsWith(`${stem}___.`) || sentence.includes(`${stem}___ `), `${word}: gap follows the stem`).toBe(true);
      expect(sentence.toLowerCase().replace(`${stem}___`, '').includes(word), `${word} leaks into its sentence`).toBe(false);
      expect(homophones.has(word), `${word} has a common homophone`).toBe(false);
      const text = `${word} ${root} ${sentence}`.toLowerCase();
      for (const bad of [...AVOID, ...EXCLUDE]) expect(text.includes(bad), `${word}: ${bad}`).toBe(false);
    }
    expect(EXCEPTION_BANK.map(r => r[2])).toEqual(EXCEPTIONS);
  });

  it('every assembled wrong spelling is a non-word, and the inventory is pinned', () => {
    const homophones = new Set(HOMOPHONE_SETS.flat());
    const all: string[] = [];
    for (const [stem, ending] of BANK) for (const e of ENDINGS) {
      const w = stem + e;
      all.push(w);
      if (e === ending) continue;
      expect(GAP_WORDS.has(w) || AVOID.has(w) || REAL_LOOKALIKES.has(w) || homophones.has(w), `${w} is a real word`).toBe(false);
      if (RARE.has(w)) continue;
      for (const a of AVOID) expect(w.includes(a), `${w} contains ${a}`).toBe(false);
    }
    expect(all.sort()).toEqual(PINNED);
    expect(new Set(all).size).toBe(all.length);
  });

  it('builds the ladder: d1 two endings and no root, d2 and d3 four endings with the root, exceptions only at d3', () => {
    for (const d of [1, 2, 3] as Difficulty[]) {
      const seen = new Set<string>();
      const exceptionsSeen = new Set<string>();
      for (let s = 1; s <= 600; s++) {
        const q = topic.gen(d, rng(s * 11 + d));
        seen.add(q.answer);
        const text = (q.visual as { text: string }).text;
        expect(q.visual).toEqual({ type: 'sentence', text: expect.stringContaining('___') });
        const row = BANK.find(r => r[1] === q.answer && r[3] === text)!;
        expect(row, 'card comes from the bank').toBeDefined();
        expect(q.say).toContain(row[0] + row[1]);
        if (d === 1) {
          expect([...q.options].sort()).toEqual(['cian', 'tion']);
          expect(q.prompt).not.toContain('Root');
        } else {
          expect([...q.options].sort()).toEqual([...ENDINGS].sort());
          expect(q.prompt).toContain(`Root word: ${row[2]}.`);
        }
        if (EXCEPTIONS.includes(row[2])) exceptionsSeen.add(row[2]);
      }
      expect([...seen].sort()).toEqual(d === 1 ? ['cian', 'tion'] : [...ENDINGS].sort());
      expect([...exceptionsSeen].sort()).toEqual(d === 3 ? EXCEPTIONS : []);
    }
  });
});

const PINNED = [
  'accian', 'acsion', 'acssion', 'action', 'admician', 'admision',
  'admission', 'admition', 'attencian', 'attension', 'attenssion', 'attention',
  'colleccian', 'collecsion', 'collecssion', 'collection', 'complecian', 'complesion',
  'complession', 'completion', 'comprehencian', 'comprehension', 'comprehenssion', 'comprehention',
  'confecian', 'confesion', 'confession', 'confetion', 'discucian', 'discusion',
  'discussion', 'discution', 'electrician', 'electrision', 'electrission', 'electrition',
  'expancian', 'expansion', 'expanssion', 'expantion', 'exprecian', 'expresion',
  'expression', 'expretion', 'extencian', 'extension', 'extenssion', 'extention',
  'injeccian', 'injecsion', 'injecssion', 'injection', 'intencian', 'intension',
  'intenssion', 'intention', 'invencian', 'invension', 'invenssion', 'invention',
  'magician', 'magision', 'magission', 'magition', 'musician', 'musision',
  'musission', 'musition', 'permician', 'permision', 'permission', 'permition',
  'politician', 'politision', 'politission', 'politition', 'tencian', 'tension',
  'tenssion', 'tention',
];
