import { afterEach, describe, expect, it, vi } from 'vitest';
import { hush, resetVoiceProbe, say, VOICE_START_MS, type SynthLike } from '../../src/audio';
import { reset, save } from '../../src/storage';

const mem: Record<string, string> = {};
(globalThis as any).localStorage = { getItem: (k: string) => mem[k] ?? null, setItem: (k: string, v: string) => { mem[k] = v; }, removeItem: (k: string) => { delete mem[k]; }, clear: () => { for (const k in mem) delete mem[k]; } };

// node has no speechSynthesis: the engine is injected, and the utterance class stubbed as in audio.test.ts.
(globalThis as any).SpeechSynthesisUtterance = class { constructor(public text: string) {} };

// #1630: "Start again" is reset() then hush() (parents.ts). A line spoken before it leaves a silence deadline
// pending; fired afterwards it save()s a fresh default blob over the key reset() just removed.
describe('Start again and a pending speech verdict (#1630)', () => {
  afterEach(() => { resetVoiceProbe(); vi.useRealTimers(); reset(); });
  // An engine that accepts a line and never starts it, so the voice-start deadline is left pending.
  const silent = {
    speaking: false, pending: false, cancel() {},
    speak(u: SpeechSynthesisUtterance) { (this as any).speaking = true; void u; },   // accepted, never started
    getVoices: () => [{ name: 'Daniel', lang: 'en-GB' }],
  } as unknown as SynthLike;

  it('does not re-create the cleared save once the deadline passes', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date', 'performance'] });
    reset(); resetVoiceProbe(); save({ name: 'Ada' });
    say('Hello', false, { synth: silent });
    reset(); hush(silent);
    vi.advanceTimersByTime(VOICE_START_MS * 2);
    expect(localStorage.getItem('sna:v1')).toBeNull();
  });
});
