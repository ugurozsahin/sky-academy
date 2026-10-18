// The data layer of the comprehension story card (#1017 part 1): a bank item, its checker and the question builder.
// Not Story Order (`story.ts`, #975) — that one sequences sentences; this one asks about a passage.
import { AVOID, pick, wordQ } from './util';
import type { Difficulty, Generator, Question, Rng } from './types';

export interface StoryItem {
  story: string;
  question: string;
  answer: string;
  decoys: string[];
  evidence: string;            // the words of the story that settle the answer, copied word for word
  kind: 'literal' | 'inference';
  d: 1 | 2 | 3;
  word?: string;               // the word a picture answer stands for
}

export const STORY_MAX_CHARS = 160;

/** A generator drawing an item of the asked difficulty (the nearest one when the bank has none). */
export function storyGen(bank: readonly StoryItem[]): Generator {
  return (d: Difficulty, rng: Rng) => {
    const own = bank.filter(i => i.d === d);
    return storyBankQ(pick(rng, own.length ? own : bank), rng);
  };
}

export function storyBankQ(item: StoryItem, rng: Rng): Question {
  return wordQ(rng, item.question, item.answer, item.decoys, { say: `${item.story} ${item.question}`, story: item.story });
}

const words = (s: string): string[] => s.toLowerCase().match(/[a-z']+/g) ?? [];

/** Every rule a bank item breaks, as a readable line each; `[]` for a good bank. */
export function storyBankProblems(bank: readonly StoryItem[]): string[] {
  const out: string[] = [];
  bank.forEach((it, n) => {
    const at = `item ${n} ("${it.question}")`;
    const sentences = it.story.split(/[.!?]+(?:\s|$)/).filter(s => s.trim()).length;
    if (sentences > 3) out.push(`${at}: ${sentences} sentences, at most 3`);
    if (it.story.length > STORY_MAX_CHARS) out.push(`${at}: story is ${it.story.length} characters, at most ${STORY_MAX_CHARS}`);
    if (!it.story.includes(it.evidence)) out.push(`${at}: evidence is not word for word in the story`);
    if (it.kind === 'literal') {
      const inStory = (w: string) => words(it.story).includes(w.toLowerCase());
      if (!inStory(it.answer) && !(it.word && inStory(it.word))) out.push(`${at}: literal answer "${it.answer}" is not in the story`);
    }
    if (it.decoys.includes(it.answer)) out.push(`${at}: the answer is among its decoys`);
    if (new Set(it.decoys).size !== it.decoys.length) out.push(`${at}: duplicate decoys`);
    const bad = [it.story, it.question, it.answer, ...it.decoys].flatMap(words).filter(w => AVOID.has(w));
    if (bad.length) out.push(`${at}: avoided word "${bad[0]}"`);
    if (it.story.includes('_')) out.push(`${at}: "_" in the story would draw as a gap`);
  });
  return out;
}
