import { afterEach, describe, expect, it, vi } from 'vitest';
import { hush, resetVoiceProbe, say, speechEngine, type SpeechEvents } from '../../src/audio';
import { nativeEngine, nativeSpeechEngine, resetNativeEngineState, resetNativeVoiceMemo } from '../../src/speech-native';
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

// `rangeListenerArmed` is module state, armed at most once for the whole file (it models one real plugin
// registration, #881) — so these two tests must run before any other in this file calls nativeEngine() or
// nativeSpeechEngine(), or the arming they mean to exercise has already happened. Kept first in the file for
// exactly that reason.
describe('onRangeStart arming, first in this file so the module has not armed yet (#881)', () => {
  // silent-failure-hunter review of this PR: a rejected addListener() used to leave `rangeListenerArmed`
  // true forever, with nothing to retry it — the `started()` signal gone for the rest of the session. One
  // test, not two: `rangeListenerArmed` is module state that never un-arms once a registration succeeds, so
  // the only way to prove the *retry* actually re-registered is to drive the listener it registered — a
  // second nativeEngine() call in a fresh test would find the module already armed from this one.
  it("a rejected addListener() lets the retry register, and that registration's onRangeStart fires started()", async () => {
    const broken = fakeTts();
    broken.tts.addListener = () => Promise.reject(new Error('plugin not ready'));
    nativeEngine(broken.tts);
    await tick(); await tick();                                              // let the rejection (and its .catch) settle

    let onRange: (() => void) | undefined;
    const recovered = fakeTts();
    recovered.tts.addListener = ((_: string, cb: () => void) => { onRange = cb; return Promise.resolve({ remove: () => {} }); }) as typeof recovered.tts.addListener;
    const engine = nativeEngine(recovered.tts);
    expect(onRange, 'the earlier rejection must not have latched arming on forever').toBeDefined();

    const events: SpeechEvents = { started: vi.fn(), ended: vi.fn(), failed: vi.fn() };
    engine.speak('Hello', { lang: 'en-GB', rate: 0.9, pitch: 1.08 }, events);
    await tick();
    onRange?.();
    expect(events.started).toHaveBeenCalledOnce();
    recovered.resolve();
    await tick();
    resetNativeVoiceMemo(); resetNativeEngineState();
  });
});

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
  afterEach(() => { resetVoiceProbe(); resetNativeVoiceMemo(); resetNativeEngineState(); reset(); });

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
  afterEach(() => { resetNativeVoiceMemo(); resetNativeEngineState(); });

  // pr-test-analyzer review of this PR: busy() was untested and, before the fix, always read `false` on any
  // engine wrapper other than the one that made the in-flight speak() call — because speechEngine() builds a
  // *fresh* nativeEngine(tts) wrapper on every say()/hush(), so a caller (the "sensei is talking" indicator
  // the SpeechEngine doc names) fetching busy() through a new wrapper never saw the real state.
  it('busy() reflects the in-flight call even read through a freshly re-fetched wrapper', async () => {
    const f = fakeTts();
    const speaking = nativeEngine(f.tts);
    const events: SpeechEvents = { started: vi.fn(), ended: vi.fn(), failed: vi.fn() };
    speaking.speak('Hello', { lang: 'en-GB', rate: 0.9, pitch: 1.08 }, events);
    await tick();
    const fresh = nativeEngine(f.tts);                                       // a different wrapper, same underlying plugin
    expect(fresh.busy(), 'the plugin is still speaking the line').toBe(true);
    f.resolve();
    await tick();
    expect(fresh.busy(), 'the line finished').toBe(false);
  });

  // silent-failure-hunter review of this PR: `.then().catch()` let a throw from the caller's own ended()
  // fall into the trailing catch and replay as failed() for the same line — SpeechEngine's contract is one
  // fate per line, never both.
  it("a throwing ended() does not also fire failed() for the same line", async () => {
    const f = fakeTts();
    const engine = nativeEngine(f.tts);
    const failed = vi.fn();
    const events: SpeechEvents = { started: vi.fn(), ended: () => { throw new Error('listener bug'); }, failed };
    engine.speak('Hello', { lang: 'en-GB', rate: 0.9, pitch: 1.08 }, events);
    await tick();
    f.resolve();
    await tick();
    expect(failed, "ended()'s own throw must not be replayed as this line's failed()").not.toHaveBeenCalled();
  });

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
