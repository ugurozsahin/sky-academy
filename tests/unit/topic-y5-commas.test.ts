import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { AVOID } from '../../src/curriculum/util';
import {
  ADDRESSEES, OBJECT_VERBS, DETERMINERS, ADDRESS_SHORT, ADDRESS_LONG, WHILE_BANK,
  addressSentence, whileSentence, addressMeaning, whileMeaning,
} from '../../src/curriculum/year5-commas';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y5-commas')!;
const EXCLUDE = ['gay', 'queer', 'bitch', 'butt'];
const draws = (d: Difficulty, n = 300) => { const r = rng(1227 + d); return Array.from({ length: n }, () => topic.gen(d, r)); };
const wordsOf = (s: string) => s.replace(/[!?.]$/, '').split(' ');

/** Parse a sentence by its shape; returns the shape names that match, with the answer and meaning derived from the closed lists. */
function parse(s: string): { shape: 'address' | 'while'; answer: string; meaning: string }[] {
  const ws = wordsOf(s), out: { shape: 'address' | 'while'; answer: string; meaning: string }[] = [];
  const n = ws.length;
  if (/[!?]$/.test(s) && ADDRESSEES.includes(ws[n - 1]) && OBJECT_VERBS.includes(ws[n - 2].toLowerCase()))
    out.push({ shape: 'address', answer: ws[n - 2], meaning: `We are talking to ${ws[n - 1]}.` });
  const m = /^While (\S+) (was|were) (\S+ing) (\S+) (\S+) .+\.$/.exec(s);
  if (m && OBJECT_VERBS.includes(m[3]) && DETERMINERS.includes(m[4])) out.push({ shape: 'while', answer: m[3], meaning: `Nobody was ${m[3]} ${m[4]} ${m[5]}.` });
  return out;
}

const ALL = [...ADDRESS_SHORT.map(addressSentence), ...ADDRESS_LONG.map(addressSentence), ...WHILE_BANK.map(whileSentence)];

describe('y5-commas (#1227)', () => {
  it('is registered once in Year 5 writing, as grammar', () => {
    expect(TOPICS.filter(t => t.id === 'y5-commas')).toHaveLength(1);
    expect(topic).toMatchObject({ year: 'year5', subject: 'writing', strand: 'grammar' });
  });

  it('pins the three closed lists', () => {
    expect(ADDRESSEES).toEqual(['Grandma', 'Grandad', 'Mum', 'Dad', 'Jack', 'Priya', 'Sam', 'Nana', 'Ben', 'Mia']);
    expect(OBJECT_VERBS).toEqual(['eat', 'stop', 'help', 'call', 'wash', 'draw', 'paint', 'catch', 'see', 'read',
      'eating', 'stopping', 'helping', 'calling', 'washing', 'drawing', 'painting', 'catching', 'seeing', 'reading']);
    expect(DETERMINERS).toEqual(['the', 'my', 'our', 'his', 'her']);
  });

  it('pins the bank as literal sentences', () => {
    expect(ALL).toEqual([
      'Stop Jack!', "Let's eat Grandma!", 'Help Mum!', 'Call Dad!', 'Wash Sam!', "Let's help Nana!", 'Can you help Mum?', 'Can you call Dad?',
      'Please stop Priya!', "Let's call Grandad!", 'Please help Mia!', 'Can you stop Sam?', 'Please call Nana!',
      'Can you please help Grandad?', 'Will you please stop Jack?', 'Why are you calling Nana?', 'Please do not keep calling Mum!',
      'Did you remember to call Priya?', 'It is time to stop Ben!', 'I am so glad to see Grandma!', 'Thank you for helping Mum!',
      'Are you still drawing Mia?', 'Please remember to call Nana!', 'Are you going to catch Sam?',
      'While I was reading the cat sat on my lap.', 'While we were painting the fence looked bright.', 'While Mum was washing the baby fell asleep.',
      'While Dad was drawing my sister came in.', 'While Sam was helping the teacher cleared the tables.', 'While she was calling the dog barked loudly.',
      'While Jack was stopping the car rolled backwards.', 'While Priya was reading her sister walked in.',
      'While Ben was painting his dog ran across the garden.', 'While they were helping the farmer fed the hens.',
      'While Mia was drawing the teacher walked past.', 'While Nana was calling our neighbour waved from the window.',
    ]);
  });

  it('oracle: every bank sentence matches exactly one shape, and the card agrees with it', () => {
    for (const s of ALL) expect(parse(s), s).toHaveLength(1);
    for (const d of [1, 2, 3] as Difficulty[]) for (const c of draws(d)) {
      const text = (c.visual as { text: string }).text, [p] = parse(text);
      expect(ALL).toContain(text);
      expect(c.answer).toBe(p.answer);
      expect(c.prompt).toBe(`Which word does the comma go after? ${p.meaning}`);
      expect(wordsOf(text).filter(w => w === c.answer)).toHaveLength(1);
      for (const o of c.options.filter(o => o !== c.answer)) expect(wordsOf(text)).toContain(o);
    }
  });

  it('the built meaning lines match the bank rows', () => {
    for (const r of ADDRESS_SHORT) expect(addressMeaning(r)).toBe(parse(addressSentence(r))[0].meaning);
    for (const r of WHILE_BANK) expect(whileMeaning(r)).toBe(parse(whileSentence(r))[0].meaning);
  });

  it('bank has at least 10 items per level, with the right word counts', () => {
    expect(ADDRESS_SHORT.length).toBeGreaterThanOrEqual(10);
    expect(ADDRESS_LONG.length).toBeGreaterThanOrEqual(10);
    expect(WHILE_BANK.length).toBeGreaterThanOrEqual(10);
    for (const r of ADDRESS_SHORT) expect(wordsOf(addressSentence(r)).length).toBeLessThanOrEqual(4);
    for (const r of ADDRESS_LONG) expect(wordsOf(addressSentence(r)).length).toBeGreaterThanOrEqual(5);
    for (const r of ADDRESS_LONG) expect(wordsOf(addressSentence(r)).length).toBeLessThanOrEqual(8);
  });

  it('nobody is eaten or cooked except in "Let\'s eat Grandma!"', () => {
    for (const s of ALL) if (/\b(eat|eating|cook|cooking)\b/i.test(s)) expect(s).toBe("Let's eat Grandma!");
  });

  it('ladder: d1 short address with 2–3 bubbles, d2 While with 4, d3 both shapes with 4 bubbles and neighbouring-word decoys', () => {
    for (const c of draws(1)) {
      const t = (c.visual as { text: string }).text;
      expect(parse(t)[0].shape).toBe('address');
      expect(wordsOf(t).length).toBeLessThanOrEqual(4);
      expect(c.options.length).toBeGreaterThanOrEqual(2);
      expect(c.options.length).toBeLessThanOrEqual(3);
    }
    for (const c of draws(2)) {
      expect(parse((c.visual as { text: string }).text)[0].shape).toBe('while');
      expect(c.options).toHaveLength(4);
    }
    const shapes = new Set<string>();
    for (const c of draws(3)) {
      const t = (c.visual as { text: string }).text, ws = wordsOf(t), i = ws.indexOf(c.answer);
      shapes.add(parse(t)[0].shape);
      expect(c.options).toHaveLength(parse(t)[0].shape === 'address' && i === 0 ? 3 : 4);
      for (const o of c.options.filter(o => o !== c.answer)) expect(Math.abs(ws.indexOf(o) - i)).toBeLessThanOrEqual(2);
    }
    expect([...shapes].sort()).toEqual(['address', 'while']);
  });

  it('every bubble is one word, every card has a sentence visual and a say that speaks the meaning and the sentence', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const c of draws(d)) {
      for (const o of c.options) expect(o).toMatch(/^[A-Za-z']+$/);
      expect(c.visual?.type).toBe('sentence');
      expect(c.say).toContain((c.visual as { text: string }).text);
      expect(c.say).toContain(c.prompt.replace('Which word does the comma go after? ', ''));
    }
  });

  it('crude words stay out of every sentence and bubble', () => {
    for (const s of ALL) for (const a of [...AVOID, ...EXCLUDE]) expect(s.toLowerCase(), s).not.toContain(a);
    for (const d of [1, 2, 3] as Difficulty[]) for (const c of draws(d)) for (const o of c.options)
      for (const a of [...AVOID, ...EXCLUDE]) expect(o.toLowerCase(), o).not.toContain(a);
  });
});
