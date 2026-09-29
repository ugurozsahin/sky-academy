// The Android APK's native text-to-speech engine (#881): `speechSynthesis` is unsupported inside a Capacitor
// WebView (crbug 40417848), so `say()`/`hush()` have nothing to speak through there unless something else
// implements the `SpeechEngine` seam #880 built. This is that something — read only through `native.ts`'s
// `plugin()`, never imported by name, so `cap sync` is what puts it in the APK, not a `src/` import.
import { plugin } from './native';
import { chooseVoice, type VoiceLike } from './voice-score';
// Type-only: erased at compile time, so this carries no runtime edge back to speech.ts, which imports this
// file's nativeSpeechEngine() — a real edge the other way. Two runtime imports of each other would be an
// import cycle; a type-only one and a real one are not (#880 already avoided the audio.ts<->speech.ts version).
import type { SpeechEngine, SpeechEvents } from './speech';

/** The slice of `@capacitor-community/text-to-speech`'s `TextToSpeechPlugin` this file calls. Typed here,
 *  not imported from the package — `src/` never imports it (tests/unit/guardrails.test.ts), so `cap sync`
 *  is the only thing that wires the real implementation into the APK. */
interface TextToSpeechPlugin {
  speak(options: { text: string; lang?: string; rate?: number; pitch?: number; voice?: number; queueStrategy?: number }): Promise<void>;
  stop(): Promise<void>;
  getSupportedVoices(): Promise<{ voices: VoiceLike[] }>;
  addListener(eventName: 'onRangeStart', listenerFunc: () => void): Promise<{ remove: () => void }>;
}

// `QueueStrategy.Flush`/`Add` from the plugin's own enum — written as literals, with this comment as the
// citation, because src/ may not import the package to read them.
const FLUSH = 0, ADD = 1;

let voiceIndex: number | undefined;      // memoised across calls, like the web engine's own `voice` (speech.ts)
async function nativeVoiceIndex(tts: TextToSpeechPlugin): Promise<number | undefined> {
  if (voiceIndex !== undefined) return voiceIndex === -1 ? undefined : voiceIndex;
  try {
    const { voices } = await tts.getSupportedVoices();
    const usable = voices.filter(v => typeof v?.lang === 'string' && typeof v?.name === 'string');
    const best = chooseVoice(usable);
    voiceIndex = best ? voices.indexOf(best) : -1;
  } catch { voiceIndex = -1; }                                              // a voice is a nicety; the device default will do
  return voiceIndex === -1 ? undefined : voiceIndex;
}
/** Test-only: `nativeVoiceIndex`'s memo outlives the plugin fake a test built it with. */
export function resetNativeVoiceMemo() { voiceIndex = undefined; }

let rangeListenerArmed = false;
let current: SpeechEvents | undefined;
// Module-wide, not a per-call closure: `speechEngine()` (speech.ts) builds a fresh `nativeEngine(tts)` wrapper
// on every `say()`/`hush()`, since nothing caches the engine object itself — there is exactly one physical
// plugin regardless of how many JS wrappers reference it, the same reason `current` above is module state too.
// A `let busy = false` local to this function would make `busy()` always read `false` on any wrapper other
// than the one currently speaking — pr-test-analyzer review of this PR, caught before push.
let busy = false;
/** Test-only: `current`/`busy` are module state (above), so a call left mid-flight by one test would
 *  otherwise leak into the next. Never touches `rangeListenerArmed` — that models a real plugin registration
 *  and is exercised through fresh `nativeSpeechEngine(bridge)` calls instead. */
export function resetNativeEngineState() { current = undefined; busy = false; }

/**
 * Wraps `@capacitor-community/text-to-speech` as a `SpeechEngine`. The plugin has no `SpeechSynthesisUtterance`
 * to hang `onstart`/`onend` off, so `started()` comes from the plugin's own `onRangeStart` (fired once real
 * speech reaches the device) and `ended()`/`failed()` come from `speak()`'s own promise — exactly the pair the
 * web engine's `onboundary`/`onend`/`onerror` play. `onRangeStart` is armed once, module-wide (the plugin gives
 * no per-call handle): `current` tracks which in-flight call is "now speaking" so a stray boundary from an
 * already-settled call cannot fire a stale `events.started()`.
 */
export function nativeEngine(tts: TextToSpeechPlugin): SpeechEngine {
  if (!rangeListenerArmed) {
    rangeListenerArmed = true;
    // A rejection here must let a *later* nativeEngine() call try again — silent-failure-hunter review of
    // this PR: leaving `rangeListenerArmed` true on a failed registration would drop the `started()` signal
    // for the rest of the session with nothing to retry it, pushing every probe onto `ended()` alone (only
    // fired when the *whole* line finishes) and risking a wrong `no` verdict on any line longer than the
    // probe's own budget (`VOICE_START_MS`, speech.ts).
    const disarm = () => { rangeListenerArmed = false; };
    try { void tts.addListener('onRangeStart', () => current?.started()).catch(disarm); }
    catch { disarm(); }
  }
  return {
    busy: () => busy,
    cancel() {
      // Cleared optimistically, before stop() is known to succeed: say()/hush() must never wait on the
      // native call (busy()/say() would otherwise stall on a device that never answers), the same trade the
      // web engine's own cancel() makes. A stop() that genuinely fails leaves the device speaking with
      // busy() reporting false — nothing reads busy() yet (the SpeechEngine doc names a future caller).
      current = undefined; busy = false;
      try { void tts.stop().catch(() => {}); } catch { /* nothing left to stop */ }
    },
    speak(text, opts, events) {
      current = events; busy = true;
      const settle = (fn: () => void) => { if (current === events) { busy = false; fn(); } };
      nativeVoiceIndex(tts)
        .then(voice => tts.speak({
          text, lang: opts.lang, rate: opts.rate, pitch: opts.pitch,
          ...(voice !== undefined ? { voice } : {}),
          queueStrategy: opts.queue ? ADD : FLUSH,
        }))
        // Two-argument then(), not .then().catch(): a throw from the caller's own events.ended() must not
        // fall into the rejection branch below and replay as a *second* callback (events.failed()) for the
        // same line — SpeechEngine's own contract is ended() or failed(), never both. silent-failure-hunter
        // review of this PR. The trailing .catch() only stops that same throw becoming an unhandled promise
        // rejection; it must never call events.failed() itself — the fate was already decided above.
        .then(() => settle(events.ended), reason => settle(() => events.failed(reason)))
        .catch(() => {});
      return true;
    },
  } satisfies SpeechEngine;
}

/** `nativeEngine()` when the APK's bridge has the plugin registered, else `undefined` — the one place
 *  `speechEngine()` (speech.ts) asks whether a native engine exists at all. `speechEngine()` calls this on
 *  every `say()`/`hush()` in the game, so — unlike `native.ts`'s own default-`window` calls, each reached
 *  from a real browser event — a bare `window` default here would throw `ReferenceError` in every Vitest
 *  run, which has no such global at all (`typeof window !== 'undefined'` is the codebase's own guard for
 *  exactly this, `defaultSynth()` above included). */
export function nativeSpeechEngine(w?: Window & typeof globalThis): SpeechEngine | undefined {
  const bridge = w ?? (typeof window !== 'undefined' ? window : undefined);
  if (!bridge) return undefined;
  const tts = plugin<TextToSpeechPlugin>('TextToSpeech', bridge);
  return tts && typeof tts.speak === 'function' ? nativeEngine(tts) : undefined;
}
