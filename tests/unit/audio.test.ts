import { afterEach, beforeAll, describe, it, expect, vi } from 'vitest';
import { chooseVoice, haptic, HAPTICS, NOISE_SECONDS, say, SAY_DEFER_MS, sfx, sliceFx, type SynthLike, voiceScore } from '../../src/audio';
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

// #41: noise() used to build a fresh AudioBuffer per SFX and fill it sample by sample with Math.random() —
// ~17,000 samples for one 0.35 s wind, written mid-frame, and the blade trail fires a swish every few pointer
// moves. It is now one lazily built 0.5 s buffer per context, played as sub-ranges. These tests drive the
// real sfx/sliceFx tables through a stand-in AudioContext, so they check the behaviour, not the source text.
type Start = { when: number; offset: number; duration: number };
type Ramp = { kind: 'set' | 'linear'; value: number; at: number };
const buffers: number[] = [];        // one entry per createBuffer call: its length in samples
const starts: Start[] = [];
const ramps: Ramp[] = [];
const SAMPLE_RATE = 48000;
function fakeAudio() {
  const chain = <T extends object>(n: T) => Object.assign(n, { connect: (next: unknown) => next });
  return {
    sampleRate: SAMPLE_RATE, state: 'running', currentTime: 3, destination: {}, resume() {},
    createBuffer: (_ch: number, length: number, sampleRate: number) => {
      buffers.push(length);
      return { length, sampleRate, duration: length / sampleRate, getChannelData: () => new Float32Array(length) };
    },
    createBufferSource: () => chain({
      buffer: null as unknown,
      start: (when = 0, offset = 0, duration = 0) => { starts.push({ when, offset, duration }); },
    }),
    createBiquadFilter: () => chain({ type: '', frequency: { value: 0 } }),
    createGain: () => chain({ gain: {
      value: 0,
      setValueAtTime: (value: number, at: number) => { ramps.push({ kind: 'set', value, at }); },
      linearRampToValueAtTime: (value: number, at: number) => { ramps.push({ kind: 'linear', value, at }); },
      exponentialRampToValueAtTime: () => {},
    } }),
    createOscillator: () => chain({
      type: '', frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, start() {}, stop() {},
    }),
  };
}

describe('noise SFX share one buffer (#41)', () => {
  beforeAll(() => {
    // ac() reads window.AudioContext and caches the first context it builds, exactly as it does in the game,
    // so the whole describe shares one — which is what lets the first test count buffers across every SFX.
    (globalThis as any).window = { AudioContext: function () { return fakeAudio(); } };
  });
  afterEach(() => { buffers.length = 0; starts.length = 0; ramps.length = 0; });

  it('builds exactly one 0.5 s buffer for the whole SFX table, however many sounds play', () => {
    reset();
    const plays = [...Object.values(sfx), ...Object.values(sliceFx)];
    for (const play of plays) play();
    for (const play of plays) play();                                       // and again: nothing is rebuilt
    expect(buffers).toEqual([Math.ceil(SAMPLE_RATE * NOISE_SECONDS)]);      // one buffer, 0.5 s of it
    expect(starts.length).toBeGreaterThan(20);                              // …serving a lot of noise sounds
  });

  it('keeps the linear 1 → 0 fade the old per-SFX buffer baked into its samples', () => {
    reset(); sfx.swish();                                                   // noise(0.12, 0.12, 2500)
    expect(ramps).toEqual([{ kind: 'set', value: 0.12, at: 3 }, { kind: 'linear', value: 0, at: 3.12 }]);
  });

  it('plays a different slice of the buffer each time, and never runs off the end of it', () => {
    reset();
    for (let i = 0; i < 40; i++) sfx.swish();
    expect(new Set(starts.map(s => s.offset)).size).toBeGreaterThan(1);     // sub-ranges, not the same 0.12 s
    for (const s of starts) {
      expect(s.duration).toBeGreaterThan(0);
      expect(s.offset).toBeGreaterThanOrEqual(0);
      expect(s.offset + s.duration).toBeLessThanOrEqual(NOISE_SECONDS + 1e-9);
    }
  });

  it('asks for a bounded sub-range per sound, never the whole buffer', () => {
    reset();
    for (const play of [...Object.values(sfx), ...Object.values(sliceFx)]) play();
    // Every start() carries an explicit duration — the old code passed none and let the buffer run out, which
    // is only equivalent while the buffer is the length of the sound.
    expect(starts.every(s => s.duration > 0), 'start(when, offset, duration) — a bare start() plays 0.5 s').toBe(true);
    expect(Math.max(...starts.map(s => s.duration))).toBe(0.35);             // wind, the longest sound there is
    for (const s of starts) expect(s.offset + s.duration).toBeLessThanOrEqual(NOISE_SECONDS + 1e-9);
  });

  it('stays silent — and allocates nothing — while the sound toggle is off', () => {
    reset(); save({ sound: false });
    sfx.swish(); sliceFx.fire();
    expect(starts).toEqual([]);
    save({ sound: true });
  });
});
