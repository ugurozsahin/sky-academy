// The comprehension story card (#1352, #1017 part 2): the story is printed on the card with the `sentence`
// visual and stays there; the line (story, then question) is spoken as one, and the wave waits for it.
import type { Question, Visual } from '../curriculum';
import { scaled } from '../game/speed';
import { canHear, say, VOICE_START_MS } from '../audio';

/** Just above text-to-speech pace (rate 0.9 is about 450 ms a word). */
export const STORY_WORD_MS = 500;

/** The visual a card shows: a story question prints its story, any other keeps its own. */
export const storyVisual = (q: Question): Visual | undefined => q.story ? { type: 'sentence', text: q.story } : q.visual;

const wordCount = (line: string): number => line.split(/\s+/).filter(Boolean).length;

/**
 * Speak a story question's line and run `go` once it has been heard, or after the reading time: with a voice at
 * `500 ms × words + VOICE_START_MS` if no end ever comes, without one after `500 ms × words`. Every wait goes
 * through `later`, so the pause overlay freezes it as it freezes the peek. `go` runs once.
 */
export function holdForStory(later: (fn: () => void, ms: number) => void, line: string, go: () => void): void {
  let done = false;
  const once = () => { if (!done) { done = true; go(); } };
  const read = STORY_WORD_MS * wordCount(line);
  if (!canHear()) { later(once, scaled(read)); return; }
  say(line, false, { onEnd: () => later(once, scaled(0)) });   // through `later`: an end heard behind the pause overlay waits for it
  later(once, scaled(read + VOICE_START_MS));
}
