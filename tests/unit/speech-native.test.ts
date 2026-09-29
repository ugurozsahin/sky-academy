import { afterEach, describe, expect, it, vi } from 'vitest';
import { hush, resetVoiceProbe, say, speechEngine, VOICE_START_MS, type SpeechEvents } from '../../src/audio';
import { nativeEngine, nativeSpeechEngine, resetNativeEngineState, resetNativeVoiceMemo } from '../../src/speech-native';
import { load, reset } from '../../src/storage';

const mem: Record<string, string> = {};
(globalThis as any).localStorage = { getItem: (k: string) => mem[k] ?? null, setItem: (k: string, v: string) => { mem[k] = v; }, removeItem: (k: string) => { delete mem[k]; }, clear: () => { for (const k in mem) delete mem[k]; } };

/** Flush the microtask queue: `nativeEngine.speak()` chains two promises (the voice lookup, then `tts.speak()`)
 *  before it calls `tts.speak` at all, so a synchronous assertion right after `say()`/`engine.speak()` is too
 *  early — a `setTimeout(0)` runs after every already-queued microtask, real timers or fake. */
const tick = () => new Promise(r => setTimeout(r, 0));

/** The same flush, but for tests below that fake `setTimeout` itself (to drive `VOICE_START_MS` without a
 *  real four-second wait): a faked macrotask queue never fires `tick()`'s own `setTimeout(0)`, but native
 *  Promise microtasks are not part of what `vi.useFakeTimers` intercepts, so awaiting the chain enough times
 *  drains it regardless. `nativeVoiceIndex()`'s own `await`, then two `.then()`s in `speak()`, is three hops;
 *  extra ticks beyond that are harmless. */
const flush = async (n = 6) => { for (let i = 0; i < n; i++) await Promise.resolve(); };

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
  // Shared with the #892 test below: `rangeListenerArmed` never re-arms once a registration succeeds (the
  // comment on the next test explains why), so this file gets exactly one real `onRangeStart` callback to
  // drive, ever. Captured here so a later test can still trigger it against a `say()`-built engine.
  let onRange: (() => void) | undefined;

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

  // #892: onRangeStart feeds `current?.started()`, where `current` is whichever `speak()` call is in flight —
  // module state shared across every `nativeEngine()` wrapper (speech-native.ts's own comment on `current`),
  // not tied to the specific plugin instance that got armed. So the listener captured above still fires
  // `started()` for a *fresh* engine's in-flight call, which is exactly what proves the wiring reaches
  // `say()`'s probe (`speech.ts`) and not just `nativeEngine`'s own `SpeechEvents` contract in isolation.
  it("say()'s voice probe reaches 'yes' the instant the armed onRangeStart callback fires", async () => {
    expect(onRange, 'must run after the arming test above, in this same describe block').toBeDefined();
    reset(); resetVoiceProbe(); resetNativeVoiceMemo(); resetNativeEngineState();
    const f = fakeTts();
    say('Hello', false, { engine: nativeEngine(f.tts) });                    // sets `current` synchronously, before any promise settles
    expect(load().voice, 'silence so far is not yet a verdict').toBe('unknown');
    onRange?.();
    expect(load().voice, 'onRangeStart is the yes signal, same as the web engine\'s onstart/onboundary').toBe('yes');
    f.resolve();
    await tick();
  });
});

// #892: the four remaining acceptance cases, all about the timed verdict (`VOICE_START_MS`) rather than the
// `SpeechEvents` wiring above — modelled on the web engine's own probe tests, `audio.test.ts` "voice capability
// detection (#65)". `rangeListenerArmed` is already true by the time this block runs (the describe above), so
// these engines get no real `onRangeStart` registration of their own — none of the four needs one.
describe("say()'s voice probe through the native engine, timed cases (#892)", () => {
  afterEach(() => { resetVoiceProbe(); resetNativeVoiceMemo(); resetNativeEngineState(); vi.useRealTimers(); reset(); });
  // `performance` is faked with the timers, as audio.test.ts's own `fresh()` does: the probe banks silence by
  // the clock, and the two must agree.
  const fresh = () => { vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date', 'performance'] }); reset(); resetVoiceProbe(); resetNativeVoiceMemo(); resetNativeEngineState(); };

  it('a speak() that resolves within VOICE_START_MS with no range event still gives yes (Android 7: no range callback at all)', async () => {
    fresh();
    const f = fakeTts();
    say('Hello', false, { engine: nativeEngine(f.tts) });
    await flush();
    f.resolve();
    await flush();
    expect(load().voice, "ended() is the yes signal here, same as the web engine's onend").toBe('yes');
  });

  it('a native engine that holds a line for the whole VOICE_START_MS, starting and finishing nothing, gives no', async () => {
    fresh();
    const f = fakeTts();
    say('Hello', false, { engine: nativeEngine(f.tts) });
    await flush();
    vi.advanceTimersByTime(VOICE_START_MS - 1);
    expect(load().voice, 'silence inside the window is not yet a verdict').toBe('unknown');
    vi.advanceTimersByTime(1);
    expect(load().voice).toBe('no');
  });

  it('a rejected speak() does not itself give yes; the deadline still decides', async () => {
    fresh();
    const f = fakeTts();
    say('Hello', false, { engine: nativeEngine(f.tts) });
    await flush();
    f.reject(new Error('engine busy'));
    await flush();
    expect(load().voice, 'a rejection is evidence of nothing, same as an engine that throws on speak()').toBe('unknown');
    vi.advanceTimersByTime(VOICE_START_MS);
    expect(load().voice, 'nothing ever started: the deadline fires no, as it would for any silent engine').toBe('no');
  });

  // pr-test-analyzer review of this PR: a version of this test that only checked the verdict stayed 'unknown'
  // right after hush() did not actually distinguish "dropped" from "banked" — both read 'unknown' at that
  // instant, since nothing had reached VOICE_START_MS yet either way. The proof is in what a *second*, fresh
  // line does afterwards: if hush() had banked the first line's silence, `startSilence` would give the second
  // line a shortened deadline (`VOICE_START_MS - silentMs`) and it would wrongly read 'no' partway through its
  // own budget — the audio.test.ts pattern this mirrors ("hush() drops a cut line's time…", #65).
  it("a hush() mid-line adds no silence: the next line still gets its own full VOICE_START_MS budget", async () => {
    fresh();
    const first = fakeTts();
    const engine = nativeEngine(first.tts);
    say('Hello', false, { engine });
    await flush();
    vi.advanceTimersByTime(VOICE_START_MS / 2);                              // half the budget, silent so far
    hush(null, { engine });
    expect(first.stopped(), 'hush() must reach the native stop(), not just clear the deadline').toBe(1);

    const second = fakeTts();
    say('World', false, { engine: nativeEngine(second.tts) });               // a fresh line, on a fresh engine wrapper
    await flush();
    vi.advanceTimersByTime(VOICE_START_MS - 1);                              // just short of a FULL budget of its own
    expect(load().voice, "banked silence would have shortened this line's own deadline and already said no").toBe('unknown');
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

// review of this PR (#1343): every test above drives the native engine through an explicit `{ engine }`
// override or an explicit `synth`/`null` argument — `speechEngine(o.synth)`'s own `synth !== undefined`
// branch, never the native-first branch a real, no-argument say()/hush() actually takes. Deleting that
// branch entirely left the rest of the suite green. These two tests are the ones that would have caught it:
// a genuinely no-argument call must reach a plugin registered on the real global `window`, and an explicit
// argument must still win over one even when a native plugin exists.
describe('speechEngine()/say() with NO argument at all, through a real global window (#881, PR #1343 review)', () => {
  const savedWindow = (globalThis as any).window;
  afterEach(() => {
    resetVoiceProbe(); resetNativeVoiceMemo(); resetNativeEngineState(); reset();
    if (savedWindow === undefined) delete (globalThis as any).window; else (globalThis as any).window = savedWindow;
  });

  it('a no-argument say() reaches a plugin registered on window.Capacitor.Plugins.TextToSpeech', async () => {
    reset();
    const f = fakeTts();
    (globalThis as any).window = { Capacitor: { Plugins: { TextToSpeech: f.tts } } };
    say('Hello');                                                          // no second or third argument at all — the real call shape
    await tick();
    expect(f.calls, 'a real zero-argument say() must reach the registered native plugin').toHaveLength(1);
    expect(f.calls[0]).toMatchObject({ text: 'Hello', lang: 'en-GB' });
  });

  it('an explicit synth/null still wins over a plugin registered on window', async () => {
    reset();
    const f = fakeTts();
    (globalThis as any).window = { Capacitor: { Plugins: { TextToSpeech: f.tts } } };
    say('Hello', false, { synth: null });                                  // explicit: speechEngine(null) short-circuits to no engine
    await tick();
    expect(f.calls, 'an explicit null must not fall through to the native engine').toHaveLength(0);
    expect(load().voice, 'no engine at all is the one verdict that needs no probe').toBe('no');
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
