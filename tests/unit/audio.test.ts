import { afterEach, describe, it, expect, vi } from 'vitest';
import { chooseVoice, haptic, HAPTICS, say, SAY_DEFER_MS, type SynthLike, voiceScore } from '../../src/audio';
import { reset, save } from '../../src/storage';

const mem: Record<string, string> = {};
(globalThis as any).localStorage = { getItem: (k: string) => mem[k] ?? null, setItem: (k: string, v: string) => { mem[k] = v; }, removeItem: (k: string) => { delete mem[k]; }, clear: () => { for (const k in mem) delete mem[k]; } };
const v = (name: string, lang: string, localService?: boolean) => ({ name, lang, localService });

describe('haptics', () => {
  it('vibrates with the pattern for the event, follows the sound toggle, and is a no-op without the API', () => {
    reset(); const calls: (number | number[])[] = []; const nav = { vibrate: (p: number | number[]) => { calls.push(p); return true; } };
    expect(haptic('slice', nav)).toBe(true); expect(calls).toEqual([[...HAPTICS.slice]]);
    expect(haptic('stage', nav)).toBe(true); expect(calls[1]).toEqual([30, 40, 30, 40, 90]);
    save({ sound: false }); expect(haptic('wrong', nav)).toBe(false); expect(calls.length).toBe(2);   // muted → still
    save({ sound: true }); expect(haptic('wrong', {})).toBe(false);                                  // desktop browsers: no vibrate()
    expect(haptic('life', { vibrate: () => { throw new Error('blocked'); } })).toBe(false);            // never throws into the game loop
  });
});

describe('voice choice for young listeners', () => {
  it('prefers British English over other English, and rejects non-English', () => {
    expect(chooseVoice([v('Samantha', 'en-US'), v('Daniel', 'en-GB'), v('Amélie', 'fr-FR')])?.name).toBe('Daniel');
    expect(chooseVoice([v('Amélie', 'fr-FR'), v('Anna', 'de-DE')])).toBeNull();
    expect(chooseVoice([])).toBeNull();
    expect(voiceScore(v('Karen', 'en_AU'))).toBeGreaterThan(voiceScore(v('Samantha', 'en-US')));   // underscore locale handled
  });
  it('prefers child / warm en-GB voices and natural voices over plain ones', () => {
    const list = [v('Daniel', 'en-GB', true), v('Google UK English Female', 'en-GB', false), v('Microsoft Maisie Online (Natural) - English (United Kingdom)', 'en-GB', false), v('Microsoft Libby Online (Natural)', 'en-GB', false)];
    expect(chooseVoice(list)?.name).toMatch(/Maisie/);
    expect(chooseVoice(list.filter(x => !/Maisie/.test(x.name)))?.name).toMatch(/Libby/);
    expect(voiceScore(v('Google UK English Female', 'en-GB'))).toBeGreaterThan(voiceScore(v('Google UK English Male', 'en-GB')));
  });
  it('never picks Apple novelty voices when a normal voice exists', () => {
    expect(chooseVoice([v('Bubbles', 'en-GB'), v('Zarvox', 'en-US'), v('Daniel', 'en-GB')])?.name).toBe('Daniel');
    expect(voiceScore(v('Bubbles', 'en-GB'))).toBeLessThan(voiceScore(v('Samantha', 'en-US')));
  });
});

// #40: say() used to call cancel() then speak() in the same turn, on every single call. Both halves are
// faults on a phone: cancel() completes asynchronously, so Android and iOS drop a speak() issued in the same
// turn, and cancelling an idle engine wedges it often enough that the next line is never heard. The engine is
// injected here because node has no speechSynthesis — the same trick haptic() uses for navigator.vibrate.
class FakeUtterance { lang = ''; rate = 1; pitch = 1; voice: unknown = null; constructor(public text: string) {} }
(globalThis as any).SpeechSynthesisUtterance = FakeUtterance;
/** Records what the game asked the engine to do, in order: `cancel` or the text of a `speak`. */
function fakeSynth(state: { speaking?: boolean; pending?: boolean } = {}) {
  const calls: string[] = [];
  return {
    calls,
    synth: {
      get speaking() { return !!state.speaking; },
      get pending() { return !!state.pending; },
      cancel() { calls.push('cancel'); state.speaking = false; state.pending = false; },
      speak(u: SpeechSynthesisUtterance) { calls.push(u.text); state.speaking = true; },
    } as SynthLike,
  };
}

describe('say() — speaking without wedging the phone (#40)', () => {
  afterEach(() => vi.useRealTimers());

  it('does not cancel an engine that is not speaking', () => {
    reset(); const { calls, synth } = fakeSynth();
    say('Well done!', false, { synth });
    expect(calls).toEqual(['Well done!']);                                  // spoken straight away, no cancel
  });

  it('interrupts a line in progress, but speaks on a later tick so the engine does not drop it', () => {
    reset(); vi.useFakeTimers(); const { calls, synth } = fakeSynth({ speaking: true });
    say('Next question', false, { synth });
    expect(calls).toEqual(['cancel']);                                      // nothing spoken in the cancel's turn
    vi.advanceTimersByTime(SAY_DEFER_MS);
    expect(calls).toEqual(['cancel', 'Next question']);
  });

  // Asserted as "never spoken" rather than as an exact call list: a real engine may still report `speaking`
  // for a moment after cancel(), so the second call may or may not cancel again. What must hold either way is
  // that the superseded line is gone — deferring must not turn into a backlog of stale lines.
  it('drops a line still waiting when a newer one arrives, so only the newest is heard', () => {
    reset(); vi.useFakeTimers(); const { calls, synth } = fakeSynth({ speaking: true });
    say('stale', false, { synth });
    say('fresh', false, { synth });
    vi.advanceTimersByTime(SAY_DEFER_MS);
    expect(calls).not.toContain('stale');
    expect(calls.filter(c => c !== 'cancel')).toEqual(['fresh']);
  });

  it('queues without interrupting, so sliced letters are heard as a word instead of fragments', () => {
    reset(); const { calls, synth } = fakeSynth();
    for (const letter of ['b', 'a', 't']) say(letter, false, { queue: true, synth });
    expect(calls).toEqual(['b', 'a', 't']);                                 // three letters, no cancel between them
  });

  it('a queued line never interrupts even mid-sentence, and the next plain line still clears the backlog', () => {
    reset(); vi.useFakeTimers(); const { calls, synth } = fakeSynth({ speaking: true, pending: true });
    say('g', false, { queue: true, synth });
    expect(calls).toEqual(['g']);
    say('Well done!', false, { synth }); vi.advanceTimersByTime(SAY_DEFER_MS);
    expect(calls).toEqual(['g', 'cancel', 'Well done!']);
  });

  it('follows the read-aloud toggle unless forced, and never throws into the game loop', () => {
    reset(); save({ speech: false }); const { calls, synth } = fakeSynth();
    say('silent', false, { synth }); expect(calls).toEqual([]);
    say('forced', true, { synth }); expect(calls).toEqual(['forced']);      // the toggle button must still speak
    save({ speech: true });
    const bad = { speaking: false, pending: false, cancel() {}, speak() { throw new Error('engine gone'); } } as SynthLike;
    expect(() => say('boom', false, { synth: bad })).not.toThrow();
  });
});
