import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { SUFFIX_ROOT } from '../../src/curriculum/year2';
import { WORD_CLASSES, WORD_CLASS_NAMES, WORD_CLASS_SETS } from '../../src/curriculum/year2-wordclass';

// Deterministic RNG (mulberry32), same construction curriculum.test.ts uses.
function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = (id: string) => TOPICS.find(x => x.id === id)!;

/**
 * #377: the #299 slice-3 rails checked each bank against itself, so a mistyped spelling or a mislabelled word
 * class shipped green. Everything below is a KEY WRITTEN BY HAND, the way a Year 2 teacher would mark it, and
 * imports nothing from the generators' own tables except the bank it marks. A new row has to be added here as
 * well, by a person, before it can pass.
 */

// root + ending -> the correct spelling (NC English Appendix 1, Year 2: adding endings to words ending in e, y,
// and doubling the consonant of a short word).
const SUFFIX_KEY: Record<string, string> = {
  'hope+ing': 'hoping', 'make+ing': 'making', 'ride+ing': 'riding', 'smile+ed': 'smiled', 'bake+ed': 'baked',
  'close+ing': 'closing', 'wave+ed': 'waved', 'nice+er': 'nicer', 'late+er': 'later',
  'hop+ing': 'hopping', 'run+ing': 'running', 'sit+ing': 'sitting', 'swim+ing': 'swimming', 'pat+ed': 'patted',
  'stop+ed': 'stopped', 'big+er': 'bigger', 'sad+est': 'saddest', 'hot+est': 'hottest',
  'happy+er': 'happier', 'baby+es': 'babies', 'carry+ed': 'carried', 'funny+est': 'funniest', 'cry+es': 'cries',
  'try+ed': 'tried', 'easy+er': 'easier', 'silly+est': 'silliest', 'party+es': 'parties',
};
// The rule a teacher would name for each, read off the shape of the right spelling alone.
const ruleOfSpelling = (root: string, suf: string, word: string) =>
  root.endsWith('e') && word === root.slice(0, -1) + suf ? 'drop-e'
    : root.endsWith('y') && word === root.slice(0, -1) + 'i' + suf ? 'y-to-i'
      : word === root + root[root.length - 1] + suf ? 'double' : 'none';
/** Edit distance, so the "wrong spelling" slots can be held to being slips on the right word, not strangers. */
function distance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0]; row[0] = i;
    for (let j = 1; j <= b.length; j++) { const tmp = row[j]; row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = tmp; }
  }
  return row[b.length];
}

describe('y2-suffix-root against a hand-written answer key (#377)', () => {
  it('every bank row has a key entry and the bank spells it the way the key does', () => {
    for (const [root, suf, ans, rule] of SUFFIX_ROOT) {
      const key = SUFFIX_KEY[`${root}+${suf}`];
      expect(key, `${root} + ${suf} has no teacher's answer in SUFFIX_KEY — add one by hand`).toBeDefined();
      expect(ans, `${root} + ${suf}`).toBe(key);
      expect(rule, `${root} + ${suf}: the rule it unlocks under`).toBe(ruleOfSpelling(root, suf, key));
    }
  });

  it('on every card the right bubble is the key, the no-rule slip is there, and the third is a near-miss of the key', () => {
    const t = topic('y2-suffix-root');
    const seen = new Set<string>();
    for (const d of [1, 2, 3] as Difficulty[]) {
      const r = rng(377 + d);
      for (let i = 0; i < 600; i++) {
        const q = t.gen(d, r);
        const [root, suf] = q.prompt.replace(' = ?', '').split(' + ');
        const key = SUFFIX_KEY[`${root}+${suf}`];
        seen.add(`${root}+${suf}`);
        expect(q.answer, q.prompt).toBe(key);
        expect(q.options.length, q.prompt).toBe(3);
        expect(q.options, `${q.prompt}: the rule left unapplied is the trap`).toContain(root + suf);
        for (const o of q.options.filter(x => x !== key)) {
          expect(o, q.prompt).not.toBe(key);
          // `banana` in the third slot is the slip this catches: a wrong spelling is the right word mis-spelt.
          expect(distance(o, key), `${q.prompt}: "${o}" is not a plausible slip for "${key}"`).toBeLessThanOrEqual(3);
        }
        expect(new Set(q.options).size, q.prompt).toBe(3);
      }
    }
    expect(seen.size, 'every key row is reachable').toBe(Object.keys(SUFFIX_KEY).length);
  });
});

// A Year 2 teacher's marking of each sentence: noun, verb, adjective, adverb.
const CLASS_KEY: Record<string, [string, string, string, string]> = {
  'The happy kitten purred loudly.': ['kitten', 'purred', 'happy', 'loudly'],
  'A tiny bird sang sweetly.': ['bird', 'sang', 'tiny', 'sweetly'],
  'The brave ninja jumped quickly.': ['ninja', 'jumped', 'brave', 'quickly'],
  'My little sister giggled quietly.': ['sister', 'giggled', 'little', 'quietly'],
  'The old bus stopped suddenly.': ['bus', 'stopped', 'old', 'suddenly'],
  'A hungry rabbit nibbled greedily.': ['rabbit', 'nibbled', 'hungry', 'greedily'],
  'The red balloon floated slowly.': ['balloon', 'floated', 'red', 'slowly'],
  'Our new teacher smiled warmly.': ['teacher', 'smiled', 'new', 'warmly'],
  'The huge castle stood proudly.': ['castle', 'stood', 'huge', 'proudly'],
  'The tired baby yawned sleepily.': ['baby', 'yawned', 'tired', 'sleepily'],
};
// The words of the "Slice every noun / verb" bank, by what a teacher says each one is.
const NOUNS = new Set(['girl', 'ball', 'dog', 'farmer', 'hens', 'cow', 'fox', 'barn', 'baby', 'clown', 'chef', 'cake', 'buns', 'pirate', 'hole', 'treasure', 'frog', 'stone', 'worm', 'teacher', 'story', 'children', 'knight', 'sword', 'tower', 'driver', 'van', 'mirrors', 'swans', 'lake', 'baker', 'tin', 'soup', 'astronaut', 'suitcase', 'rocket', 'dragon', 'villagers']);
const VERBS = new Set(['kicked', 'chased', 'fed', 'milked', 'crept', 'hid', 'clapped', 'giggled', 'baked', 'iced', 'dug', 'buried', 'jumped', 'caught', 'read', 'listened', 'lifted', 'climbed', 'washed', 'polished', 'swam', 'honked', 'opened', 'stirred', 'packed', 'boarded', 'roared']);
const ADJECTIVES = new Set(['old', 'clever', 'tiny', 'brave']);

describe('y2-wordclass against a hand-written answer key (#377)', () => {
  it('the column order is the one the names say, written here and not imported', () => {
    expect([...WORD_CLASS_NAMES]).toEqual(['noun', 'verb', 'adjective', 'adverb']);
  });

  it('every bank row is marked the way a teacher marks it, and is five plain words in the usual order', () => {
    for (const [sent, noun, verb, adj, adv] of WORD_CLASSES) {
      const key = CLASS_KEY[sent];
      expect(key, `"${sent}" has no teacher's marking in CLASS_KEY — add one by hand`).toBeDefined();
      expect([noun, verb, adj, adv], sent).toEqual(key);
      const words = sent.replace('.', '').split(' ');
      expect(words.length, `${sent}: determiner + adjective + noun + verb + adverb`).toBe(5);
      expect(words.indexOf(adj) + 1, `${sent}: the adjective comes just before the noun`).toBe(words.indexOf(noun));
      expect(words.indexOf(verb), `${sent}: the verb comes just after the noun`).toBe(words.indexOf(noun) + 1);
      expect(adv, `${sent}: the adverb ends -ly`).toMatch(/ly$/);
      expect(words[words.length - 1], `${sent}: the adverb closes the sentence`).toBe(adv);
    }
  });

  it('every card rewards the word the key gives for the class asked, from that sentence only', () => {
    const t = topic('y2-wordclass');
    const index: Record<string, number> = { noun: 0, verb: 1, adjective: 2, adverb: 3 };
    let asked = 0;
    for (const d of [1, 2, 3] as Difficulty[]) {
      const r = rng(3770 + d);
      for (let i = 0; i < 600; i++) {
        const q = t.gen(d, r); if (q.anyOrder) continue;
        asked++;
        const cls = q.prompt.replace('Which word is the ', '').replace('?', '');
        const key = CLASS_KEY[(q.visual as { text: string }).text];
        expect(key, q.prompt).toBeDefined();
        expect(q.answer, `${(q.visual as { text: string }).text} — ${cls}`).toBe(key[index[cls]]);
        expect([...q.options].sort(), q.prompt).toEqual([...key].sort());
      }
    }
    expect(asked, 'the single-word form is drawn').toBeGreaterThan(900);
  });

  it('"Slice every noun / verb": each keyed word is the class a teacher gives it', () => {
    for (const [sent, nouns, verbs, others] of WORD_CLASS_SETS) {
      for (const w of nouns) expect(NOUNS.has(w), `"${w}" in "${sent}" is keyed as a noun but is not one in NOUNS`).toBe(true);
      for (const w of verbs) expect(VERBS.has(w), `"${w}" in "${sent}" is keyed as a verb but is not one in VERBS`).toBe(true);
      for (const w of others) expect(ADJECTIVES.has(w), `"${w}" in "${sent}" is keyed as an adjective but is not one in ADJECTIVES`).toBe(true);
    }
  });
});
