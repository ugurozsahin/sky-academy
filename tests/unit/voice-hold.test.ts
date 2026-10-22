// #2268: the wave of an ordinary question waits for its voice; the story card (#1352) is in story-card.test.ts.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const say = vi.fn();
let hear = true;
vi.mock('../../src/audio', () => ({ canHear: () => hear, say: (...a: unknown[]) => say(...a), VOICE_START_MS: 4000 }));

import { holdForStory, holdForVoice, STORY_WORD_MS, VOICE_HOLD_CAP_MS } from '../../src/ui/story-card';

const words = (n: number) => Array.from({ length: n }, () => 'go').join(' ');
const run = (hold: typeof holdForVoice, line: string) => {
  const waits: number[] = []; const go = vi.fn();
  hold((fn, ms) => { waits.push(ms); if (ms === 0) fn(); }, line, go);
  return { waits, go, onEnd: say.mock.calls.at(-1)![2] as { onEnd?: () => void } };
};

describe('#2268 the wave waits for the voice', () => {
  beforeEach(() => { say.mockClear(); hear = true; });

  it('an ordinary line is spoken and its wave launches on the voice ending', () => {
    const r = run(holdForVoice, 'Which is more?');
    expect(say).toHaveBeenCalledWith('Which is more?', false, expect.objectContaining({ onEnd: expect.any(Function) }));
    expect(r.go).not.toHaveBeenCalled();
    r.onEnd.onEnd!(); expect(r.go).toHaveBeenCalledTimes(1);
  });

  it('caps the fallback at 6 s, so a long line never stalls a wave', () => {
    expect(run(holdForVoice, words(30)).waits).toEqual([VOICE_HOLD_CAP_MS]);
  });

  it('a silent device launches within the read time, with no voice start allowance', () => {
    hear = false;
    const r = run(holdForVoice, words(4));
    expect(r.waits).toEqual([STORY_WORD_MS * 4]); expect(say.mock.calls.at(-1)![2]).toEqual({});
  });

  it('a story line keeps its uncapped wait', () => {
    expect(run(holdForStory, words(30)).waits).toEqual([STORY_WORD_MS * 30 + 4000]);
  });

  it('runs go once even when both the end and the timer arrive', () => {
    const r = run(holdForVoice, 'a b'); r.onEnd.onEnd!(); r.onEnd.onEnd!(); expect(r.go).toHaveBeenCalledTimes(1);
  });
});
