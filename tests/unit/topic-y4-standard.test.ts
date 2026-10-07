import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { AVOID } from '../../src/curriculum/util';
import { WAS_WERE, OTHER_VERBS } from '../../src/curriculum/year4-standard';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y4-standard')!;
const BANK = [...WAS_WERE, ...OTHER_VERBS];
// `AVOID` is a gap-spelling denylist and lists no crude whole words (G13): a short local set too.
const EXCLUDE = ['gay', 'queer', 'bitch', 'butt'];
const PARTICIPLES = ['done', 'seen', 'come', 'gone', 'given', 'written'];
const PASTS = ['did', 'saw', 'came', 'went', 'gave', 'wrote'];
const ALL_FORMS = ['was', 'were', ...PARTICIPLES, ...PASTS];

/** The test's own rule, independent of the bank's columns: subject decides was/were, an auxiliary decides past or participle. */
function standard(sentence: string, formsHere: string[]): string {
  const words = sentence.replace(/[.?!]/g, '').toLowerCase().split(' ');
  if (formsHere.some(f => f === 'was' || f === 'were')) {
    const subject = words[0];
    return ['we', 'you', 'they'].includes(subject) ? 'were' : 'was';
  }
  const hasAux = words.some(w => ['has', 'have', 'had'].includes(w));
  return hasAux ? formsHere.find(f => PARTICIPLES.includes(f))! : formsHere.find(f => PASTS.includes(f))!;
}

describe('y4-standard (#1164)', () => {
  it('is registered once in Year 4 grammar', () => {
    expect(TOPICS.filter(t => t.id === 'y4-standard')).toHaveLength(1);
    expect(topic).toMatchObject({ year: 'year4', subject: 'writing', strand: 'grammar', title: 'Standard English' });
  });

  it('every bank row agrees with the subject and auxiliary rule', () => {
    for (const [sentence, std, local] of BANK) expect(standard(sentence, [std, local]), sentence).toBe(std);
  });

  it('every verb pair is used once as the past form and once as the participle (was and were each once per side)', () => {
    for (const [past, part] of [['did', 'done'], ['saw', 'seen'], ['came', 'come'], ['went', 'gone'], ['gave', 'given'], ['wrote', 'written']]) {
      expect(OTHER_VERBS.filter(r => r[1] === past), past).toHaveLength(1);
      expect(OTHER_VERBS.filter(r => r[1] === part), part).toHaveLength(1);
    }
    for (const f of ['was', 'were']) expect(WAS_WERE.filter(r => r[1] === f).length, f).toBeGreaterThan(0);
  });

  it('the bank is clean: one gap, one verb form, four words or more, no excluded word', () => {
    for (const [sentence, std, local] of BANK) {
      expect(sentence.match(/___/g)).toHaveLength(1);
      const words = sentence.replace(/[.?!]/g, '').toLowerCase().split(' ');
      expect(words.filter(w => ALL_FORMS.includes(w)), sentence).toEqual([]);
      expect(words.length, sentence).toBeGreaterThanOrEqual(4);
      const whole = `${sentence} ${std} ${local}`.toLowerCase().replace(/[.?!]/g, '').split(' ');
      for (const bad of [...AVOID, ...EXCLUDE]) expect(whole.includes(bad), `${sentence}: ${bad}`).toBe(false);
      expect(/wrong|bad/i.test(sentence)).toBe(false);
    }
  });

  it('d1 and d2 give two bubbles and the answer is the Standard form', () => {
    for (const d of [1, 2] as Difficulty[]) for (let s = 1; s <= 300; s++) {
      const q = topic.gen(d, rng(s * 7 + d));
      const text = (q.visual as { text: string }).text;
      const row = BANK.find(r => r[0] === text)!;
      expect(row, text).toBeDefined();
      expect(q.prompt).toBe('Which is Standard English?');
      expect(q.options).toHaveLength(2);
      expect(q.answer).toBe(standard(text, q.options));
      expect([...q.options].sort()).toEqual([row[1], row[2]].sort());
      if (d === 1) expect(['was', 'were']).toContain(q.answer);
    }
  });

  it('d2 reaches every verb pair; d1 never leaves was and were', () => {
    const seen = (d: Difficulty) => { const a = new Set<string>(); for (let s = 1; s <= 600; s++) a.add(topic.gen(d, rng(s * 3 + d)).answer); return a; };
    expect([...seen(1)].sort()).toEqual(['was', 'were']);
    expect([...seen(2)].sort()).toEqual([...ALL_FORMS].sort());
  });

  it('d3 shows one sentence with exactly one non-Standard word and four wide bubbles', () => {
    for (let s = 1; s <= 400; s++) {
      const q = topic.gen(3, rng(s * 11));
      const text = (q.visual as { text: string }).text;
      expect(q.prompt).toBe('Which word is not Standard English?');
      expect(q.wide).toBe(true);
      expect(q.options).toHaveLength(4);
      expect(new Set(q.options).size).toBe(4);
      const words = text.replace(/[.?!]/g, '').split(' ');
      for (const o of q.options) expect(words, o).toContain(o);
      const forms = words.filter(w => ALL_FORMS.includes(w.toLowerCase()));
      expect(forms, text).toEqual([q.answer]);
      const gapped = text.replace(q.answer, '___');
      const row = BANK.find(r => r[0] === gapped)!;
      expect(row, text).toBeDefined();
      expect(q.answer).toBe(row[2]);
      expect(q.answer).not.toBe(standard(gapped, [row[1], row[2]]));
    }
  });
});
