import { afterEach, describe, expect, it, vi } from 'vitest';
import { hush, resetVoiceProbe, say, speechEngine, type SpeechEvents } from '../../src/audio';
import { nativeEngine, nativeSpeechEngine, resetNativeVoiceMemo } from '../../src/speech-native';
import { reset } from '../../src/storage';

const mem: Record<string, string> = {};
(globalThis as any).localStorage = { getItem: (k: string) => mem[k] ?? null, setItem: (k: string, v: string) => { mem[k] = v; }, removeItem: (k: string) => { delete mem[k]; }, clear: () => { for (const k in mem) delete mem[k]; } };

/** Flush the microtask queue: `nativeEngine.speak()` chains two promises (the voice lookup, then `tts.speak()`)
 *  before it calls `tts.speak` at all, so a synchronous assertion right after `say()`/`engine.speak()` is too
 *  early — a `setTimeout(0)` runs after every already-queued microtask, real timers or fake. */
const tick = () => new Promise(r => setTimeout(r, 0));

/** A fake `@capacitor-community/text-to-speech` plugin: records every `speak()` call and lets a test settle
 *  it by hand, the same shape `tests/unit/native.test.ts`'s `bridge()` stands plugins up with. */
function fakeTts(voices: { name: string; lang: string; localService?: boolean }[] = [{ name: 'Daniel', lang: 'en-GB' }]) {
  const calls: { text: string; lang?: string; rate?: number; pitch?: number; voice?: number; queueStrategy?: number }[] = [];
  const pending: { resolve: () => void; reject: (r: unknown) => void }[] = [];
  let stopped = 0;
  return {
    calls, stopped: () => stopped,
    // Settle a specific call by its index in `calls` — two `speak()`s can be in flight at once (a queued
    // second line), and a test proving the first's fate is dropped needs to resolve them out of order.
    resolve: (i = calls.length - 1) => pending[i]?.resolve(),
    reject: (r: unknown, i = calls.length - 1) => pending[i]?.reject(r),
    tts: {
      speak(options: typeof calls[number]) {
        calls.push(options);
        return new Promise<void>((resolve, reject) => { pending.push({ resolve, reject }); });
      },
      stop() { stopped++; return Promise.resolve(); },
      getSupportedVoices() { return Promise.resolve({ voices }); },
      addListener() { return Promise.resolve({ remove: () => {} }); },
    },
  };
}

const bridge = (Plugins?: Record<string, unknown>) =>
  ({ Capacitor: Plugins === undefined ? undefined : { Plugins } }) as unknown as Window & typeof globalThis;

describe('nativeSpeechEngine (#881)', () => {
  // Proved red first: a bare `w: Window & typeof globalThis = window` default threw `ReferenceError: window
  // is not defined` here, and then inside `say('Hello')` — Vitest's node environment declares no `window`
  // global at all, unlike a browser's (even an empty) one, so `speechEngine()`'s every no-argument call
  // (every real say()/hush() in the game) crashed the whole suite the moment this file's own import of
  // speech-native.ts made `nativeSpeechEngine()` reachable from `speechEngine()`'s default branch.
  it('does not throw with no window global at all (no bridge to find)', () => {
    expect(() => nativeSpeechEngine()).not.toThrow();
    expect(nativeSpeechEngine()).toBeUndefined();
  });

  it('is undefined with no bridge, no TextToSpeech plugin, or one missing speak()', () => {
    expect(nativeSpeechEngine(bridge())).toBeUndefined();
    expect(nativeSpeechEngine(bridge({}))).toBeUndefined();
    expect(nativeSpeechEngine(bridge({ TextToSpeech: {} }))).toBeUndefined();
  });

  it('wraps the plugin once it is registered', () => {
    const f = fakeTts();
    expect(nativeSpeechEngine(bridge({ TextToSpeech: f.tts }))).toBeDefined();
  });
});

describe('the native engine as say()/hush() reach it (#881)', () => {
  afterEach(() => { resetVoiceProbe(); resetNativeVoiceMemo(); reset(); });

  it("say() reaches the fake plugin's speak with the line, en-GB, and the flush strategy", async () => {
    reset(); resetNativeVoiceMemo();
    const f = fakeTts();
    say('Hello', false, { engine: nativeEngine(f.tts) });
    await tick();
    expect(f.calls).toHaveLength(1);
    expect(f.calls[0]).toMatchObject({ text: 'Hello', lang: 'en-GB', queueStrategy: 0 });
  });

  it('say(text, false, { queue: true }) reaches the plugin with the Add strategy', async () => {
    reset(); resetNativeVoiceMemo();
    const f = fakeTts();
    const engine = nativeEngine(f.tts);
    say('Hello', false, { engine, queue: true });
    await tick();
    expect(f.calls[0].queueStrategy).toBe(1);
  });

  it("hush() calls the native engine's stop()", async () => {
    reset(); resetNativeVoiceMemo();
    const f = fakeTts();
    const engine = nativeEngine(f.tts);
    say('Hello', false, { engine });
    await tick();
    hush(null, { engine });
    expect(f.stopped()).toBe(1);
  });

  it("picks the en-GB voice's index when the device offers one among others", async () => {
    reset(); resetNativeVoiceMemo();
    const f = fakeTts([{ name: 'Samantha', lang: 'en-US' }, { name: 'Daniel', lang: 'en-GB' }]);
    say('Hello', false, { engine: nativeEngine(f.tts) });
    await tick();
    expect(f.calls[0].voice).toBe(1);
  });

  it('omits the voice index when the device offers nothing usable', async () => {
    reset(); resetNativeVoiceMemo();
    const f = fakeTts([]);
    say('Hello', false, { engine: nativeEngine(f.tts) });
    await tick();
    expect(f.calls[0].voice).toBeUndefined();
  });

  it('a device with no TextToSpeech plugin at all falls back to the web engine, unchanged', () => {
    reset();
    const engine = speechEngine(null);
    expect(engine).toBeNull();                                              // speechEngine(null): the seam every other test in the file drives directly
    const web = speechEngine({ speaking: false, pending: false, cancel() {}, speak() {} });
    expect(web).not.toBeNull();                                             // an explicit web synth is unaffected by #881
  });
});

describe('nativeEngine as a SpeechEngine, driven directly (#881)', () => {
  afterEach(() => resetNativeVoiceMemo());

  it('a rejected speak() calls failed(), not ended()', async () => {
    reset(); resetNativeVoiceMemo();
    const f = fakeTts();
    const engine = nativeEngine(f.tts);
    const events: SpeechEvents = { started: vi.fn(), ended: vi.fn(), failed: vi.fn() };
    engine.speak('Hello', { lang: 'en-GB', rate: 0.9, pitch: 1.08 }, events);
    await tick();
    f.reject(new Error('engine busy'), 0);
    await tick();
    expect(events.failed).toHaveBeenCalledOnce();
    expect(events.ended).not.toHaveBeenCalled();
  });

  it('cancel() before the plugin settles drops the stale ended()/failed() callback', async () => {
    reset(); resetNativeVoiceMemo();
    const f = fakeTts();
    const engine = nativeEngine(f.tts);
    const events: SpeechEvents = { started: vi.fn(), ended: vi.fn(), failed: vi.fn() };
    engine.speak('Hello', { lang: 'en-GB', rate: 0.9, pitch: 1.08 }, events);
    await tick();
    engine.cancel();
    f.resolve();
    await tick();
    expect(events.ended, 'a line taken back by cancel() must not still report a fate').not.toHaveBeenCalled();
    expect(f.stopped()).toBe(1);
  });

  it('a newer speak() settling does not let an older, already-superseded call fire twice', async () => {
    reset(); resetNativeVoiceMemo();
    const f = fakeTts();
    const engine = nativeEngine(f.tts);
    const first: SpeechEvents = { started: vi.fn(), ended: vi.fn(), failed: vi.fn() };
    engine.speak('First', { lang: 'en-GB', rate: 0.9, pitch: 1.08 }, first);
    await tick();
    const second: SpeechEvents = { started: vi.fn(), ended: vi.fn(), failed: vi.fn() };
    engine.speak('Second', { lang: 'en-GB', rate: 0.9, pitch: 1.08, queue: true }, second);
    await tick();
    f.resolve(0);                                                            // the FIRST call settles late, after Second became current
    await tick();
    expect(first.ended, "the superseded call's own callback must not fire for the later call's fate").not.toHaveBeenCalled();
    expect(second.ended, "second is still pending: only first's own promise settled").not.toHaveBeenCalled();
  });
});
