// Read-aloud: voice choice, the "can this device be heard?" probe, and say()/hush() themselves. Split out of
// audio.ts (#880) so the Android app's native text-to-speech (#881) has somewhere to plug in: everything here
// talks to one SpeechEngine, chosen once — the web engine always, the native one (speech-native.ts) when the
// APK's bridge has it registered.
import { load, save, type SaveData } from './storage';
import { chooseVoice, voiceScore, type VoiceLike } from './voice-score';
import { nativeSpeechEngine } from './speech-native';
export { chooseVoice, voiceScore, type VoiceLike } from './voice-score';

let voice: SpeechSynthesisVoice | null | undefined;
function pickVoice(s: { getVoices?: () => SpeechSynthesisVoice[] }) {
  if (voice !== undefined) return voice;
  let vs: SpeechSynthesisVoice[];
  // Third-party Android TTS engines populate this list and nothing validates it: one entry with no `lang`
  // used to throw out of `voiceScore` — and, until #65's review, out of `say()`, where the catch marked the
  // device mute for good. Choosing a voice is a nicety; it must never be evidence about the engine.
  try { vs = s.getVoices?.() ?? []; } catch { return null; }
  if (!vs.length) return null;                                              // voices not loaded yet: retry next time
  try { voice = chooseVoice(vs.filter(v => typeof v?.lang === 'string' && typeof v.name === 'string')); }
  catch { voice = null; }
  return voice;
}

/** Minimal shape of `speechSynthesis`, so the cancel/queue behaviour is testable in node (#40). */
export interface SynthLike {
  speaking: boolean; pending: boolean;
  cancel(): void; speak(u: SpeechSynthesisUtterance): void;
  getVoices?: () => SpeechSynthesisVoice[];
}
/** The tick a cancelled engine is given before the next line is spoken (#40). A macrotask is the whole point:
 *  `cancel()` finishes asynchronously, so a `speak()` in the same turn is what Android and iOS drop. */
export const SAY_DEFER_MS = 0;
let deferred: ReturnType<typeof setTimeout> | undefined;

/** What a line handed to a `SpeechEngine` is spoken with. */
export interface SpeakOptions { lang: string; rate: number; pitch: number; queue?: boolean }
/** Callbacks a `SpeechEngine` reports a line's fate through — one fresh set per `speak()` call, so a caller
 *  that closes over its own identity in `ended`/`failed` can tell a late event about an old, superseded line
 *  apart from one about the line it is actually waiting on. `started` may fire more than once (a boundary or
 *  a resume counts, matching real engines' foibles) and needs no such check — any sign of life from the
 *  *current* engine is evidence, whichever line it was for. An implementation calls `ended` or `failed` at
 *  most once per `speak()` — the line it was handed has one fate, not several. */
export interface SpeechEvents { started(): void; ended(): void; failed(reason?: unknown): void }
/**
 * One engine that can speak, one at a time, chosen once by `speechEngine()`. `speak()` returns whether the
 * line was even attempted — `false` for one the engine could not build at all, in which case no `events`
 * callback follows for it; a caller that needs to tell one attempted line from another already has its own
 * `events` object per call to close over, so nothing here carries a line's identity back out.
 */
export interface SpeechEngine {
  speak(text: string, opts: SpeakOptions, events: SpeechEvents): boolean;
  cancel(): void;
  /** Whether the engine currently holds or is voicing a line — the signal a future caller (a "sensei is
   *  talking" indicator, or #881's own bridge) reads before deciding to interrupt. `say()` reads the web
   *  engine's underlying state directly today rather than through this method, so nothing here exercises it
   *  yet; `webEngine`'s own unit test (audio.test.ts) does. */
  busy(): boolean;
}

/**
 * Wraps the browser's `speechSynthesis` (`s`) as a `SpeechEngine`. Owns the interrupt dance that used to sit
 * in `say()` itself: cutting a line off is `cancel()` now, `speak()` on the next macrotask (#40) — cancelling
 * and speaking in the same turn is what Android and iOS drop, and cancelling an idle engine wedges it often
 * enough that the next line is simply never heard.
 */
function webEngine(s: SynthLike): SpeechEngine {
  return {
    busy: () => s.speaking || s.pending,
    cancel() {
      if (deferred !== undefined) { clearTimeout(deferred); deferred = undefined; }
      try { s.cancel(); } catch { /* an engine that will not even cancel has nothing left to stop */ }
    },
    speak(text, opts, events) {
      if (deferred !== undefined) { clearTimeout(deferred); deferred = undefined; }   // a line still waiting is stale now
      let u: SpeechSynthesisUtterance;
      // Nothing below may throw into the caller: `say()` runs on the line before the wave spawns, and a throw
      // there is a question card with no bubbles (#65 review). An engine whose utterance constructor throws
      // cannot be handed a line at all — `undefined` is the missing-engine verdict, not a hiccup.
      try { u = new SpeechSynthesisUtterance(text); } catch { return false; }
      u.lang = opts.lang; u.rate = opts.rate; u.pitch = opts.pitch;
      try { const v = pickVoice(s); if (v) u.voice = v; } catch { /* a voice is a nicety; the default will do */ }
      u.onstart = () => events.started();
      u.onboundary = () => events.started();
      u.onresume = () => events.started();
      u.onend = () => events.ended();
      u.onerror = e => events.failed(e.error);
      // Only the engine call may count against the device: the caller arms the probe before this returns, so a
      // `speak()` (or `cancel()`) that throws is judged by the deadline, not condemned on the spot.
      if (opts.queue || !(s.speaking || s.pending)) {
        try { s.speak(u); } catch { /* the deadline decides */ }
        return true;
      }
      try { s.cancel(); } catch { /* the engine would not even cancel: the deferred speak() and the deadline decide */ }
      deferred = setTimeout(() => {
        deferred = undefined;
        try { s.speak(u); } catch { /* the deadline decides */ }
      }, SAY_DEFER_MS);
      return true;
    },
  };
}

// Read through `window` rather than the bare global so a node test can stand a fake engine up as the default
// and exercise `canHear()` the way the screens call it. `SpeechSynthesisUtterance` is feature-detected too: an
// engine object with no way to build a line is no engine, and saying so here beats a throw looking like one.
const defaultSynth = (): SynthLike | null =>
  typeof window !== 'undefined' && window.speechSynthesis && typeof SpeechSynthesisUtterance === 'function'
    ? window.speechSynthesis : null;

/**
 * The engine this device speaks through today. An explicit `synth` (a test's fake, or `null` for "no engine")
 * always wins and is never second-guessed — that is the seam `tests/unit/audio.test.ts` drives directly.
 * Only the *default*, no-argument call — every real caller in `src/` — asks `speech-native.ts` first: the
 * Android APK's `speechSynthesis` is unsupported (crbug 40417848), so `defaultSynth()` there is always `null`
 * and the web engine could never be reached anyway. Off the APK, `nativeSpeechEngine()` finds no plugin and
 * returns `undefined`, so nothing here changes off Android.
 */
export function speechEngine(synth?: SynthLike | null): SpeechEngine | null {
  if (synth !== undefined) return synth ? webEngine(synth) : null;
  const native = nativeSpeechEngine();
  if (native) return native;
  const web = defaultSynth();
  return web ? webEngine(web) : null;
}

/**
 * Whether this device can actually be heard (#65). One declaration, the save's — audio already imports
 * storage, so the type flows this way and the two cannot drift apart.
 *   `unknown` — never probed on this device (or the verdict was cleared); the game is optimistic until it knows.
 *   `yes`     — an utterance really started this launch, or did on a previous one and nothing has said otherwise.
 *   `no`      — no engine at all, or a line was handed to the engine and it neither started nor was taken back
 *               within `VOICE_START_MS`. Stored, and probed afresh on the next launch.
 */
export type VoiceState = SaveData['voice'];
/**
 * How long, in total, the engine may hold lines of ours without starting one before the device is called
 * mute. The first utterance on a cold Android TTS process is routinely 1–3 s, and that is the population this
 * exists for; a wrong `no` is the expensive direction (phonics stops being phonics), a slow `no` costs a few
 * spoken lines. Not scaled: this measures the device, not a game beat.
 */
export const VOICE_START_MS = 4000;
let observedVoice: VoiceState | undefined;      // this launch's verdict; `undefined` until a line settles it
let voiceDeadline: ReturnType<typeof setTimeout> | undefined;
let silentMs = 0;                               // this launch: how long the engine has held a line of ours without starting it
let pendingSince: number | undefined;           // when the line the engine currently holds was handed over
let pendingToken: unknown;                      // and which line that is — an old line's late event must not stop a new line's clock
const voiceListeners = new Set<(state: VoiceState) => void>();

function clearVoiceDeadline() {
  if (voiceDeadline !== undefined) clearTimeout(voiceDeadline);
  voiceDeadline = undefined;
}
/** A line is with the engine: the silence clock runs from now, and the verdict falls when it reaches the budget. */
function startSilence(token: unknown) {
  stopSilence();
  pendingSince = performance.now(); pendingToken = token;
  voiceDeadline = setTimeout(() => {
    pendingSince = undefined; silentMs = VOICE_START_MS;
    if (observedVoice !== 'yes') recordVoice('no');
  }, VOICE_START_MS - silentMs);
}
/**
 * The engine no longer holds a line of ours. `bank` (the default) adds the silence so far to the launch's
 * total — a newer line replacing one the engine sat on is evidence; `hush()` passes false, because a line
 * cut off by a screen change says nothing about the engine and must not add up to a verdict.
 */
function stopSilence(bank = true) {
  if (bank && pendingSince !== undefined) silentMs = Math.min(VOICE_START_MS, silentMs + performance.now() - pendingSince);
  pendingSince = undefined; pendingToken = undefined;
  clearVoiceDeadline();
}

function recordVoice(state: VoiceState) {
  clearVoiceDeadline();
  pendingSince = undefined; pendingToken = undefined;
  if (state === 'yes') silentMs = 0;
  const changed = (observedVoice ?? load().voice) !== state;               // the value canHear() has been reading
  observedVoice = state;
  if (!changed) return;                                                    // a stored verdict confirmed: nothing to redraw
  save({ voice: state });                                                   // load()/save() swallow storage faults themselves
  for (const listener of voiceListeners) {
    // One listener re-renders the question card; a throw there must not abort the others, and must not escape
    // say(), whose caller spawns the wave on the very next line — a throw would leave the child with no bubbles.
    try { listener(state); } catch (e) { console.error('voice listener failed', e); }
  }
}

/** Last observed device capability. `unknown` is optimistic only until the first real utterance is probed. */
export function voiceState(synth: SynthLike | null = defaultSynth()): VoiceState {
  if (!synth) return 'no';
  return observedVoice ?? load().voice;
}

/** Read-aloud is useful only when it is enabled and the device has not proved silent. */
export function canHear(synth: SynthLike | null = defaultSynth()): boolean {
  return load().speech && voiceState(synth) !== 'no';
}

/** Re-render the current question when an honest speech probe changes the available fallback. */
export function onVoiceStateChange(listener: (state: VoiceState) => void): () => void {
  voiceListeners.add(listener);
  return () => { voiceListeners.delete(listener); };
}

/** Start a fresh launch probe. A new module load does this naturally; tests call it between cases. */
export function resetVoiceProbe() {
  clearVoiceDeadline();
  observedVoice = undefined; silentMs = 0; pendingSince = undefined; pendingToken = undefined;
  voice = undefined;
}

/**
 * Stop speaking and drop any line still waiting — the screen is going away (#35). Owned here rather than
 * calling `speechSynthesis.cancel()` from the screen, because a cancel is also the one thing that must void
 * the probe: a line cut off by a screen change is no evidence that the engine is silent, so its time is
 * dropped, not banked — three quick screen changes on a cold engine must not add up to a `no`.
 *
 * `o.engine` is the `SpeechEngine`-level test seam `say()` also takes, over `synth`'s older, web-shaped one;
 * production code passes neither. Passing both is not a real call shape — `engine` wins.
 *
 * `synth` carries no default of its own (unlike `voiceState`/`canHear` below): it is handed straight to
 * `speechEngine()`, whose *own* default is what tries the native engine first (#881) — resolving it here
 * too would fix it at the web engine (or `null`, off the web) before `speechEngine()` ever saw the call.
 */
export function hush(synth?: SynthLike | null, o: { engine?: SpeechEngine } = {}) {
  // Cleared here, unconditionally, not only inside whichever engine's own cancel(): a `say()` with no engine
  // at all (or a different one from this hush()'s) must still drop a macrotask already queued to speak — the
  // very drop-on-screen-change this function exists for, and it must not depend on an engine resolving.
  // "hush() drops a stale deferred line even when it resolves no engine of its own" (audio.test.ts) is red
  // without this line and without it alone — every other hush() test here passes.
  if (deferred !== undefined) { clearTimeout(deferred); deferred = undefined; }
  stopSilence(false);
  (o.engine ?? speechEngine(synth))?.cancel();
}

/**
 * Speak a line. Interrupts whatever is speaking, unless `queue` is set — then it waits its turn instead,
 * which is what per-letter progress wants: cutting the previous letter off mid-word is the bug (#40).
 *
 * Every line handed to the engine is evidence until the launch has a verdict (#65): any sign it is being
 * spoken is a `yes`; the only negative signal is silence with a line pending, summed across lines by
 * `startSilence`/`stopSilence` above. Once the launch already reads `yes`, a line is still spoken but no
 * longer probed — nothing left to learn, and `recordVoice('yes')` on an already-`yes` launch is a no-op.
 *
 * `synth` and `engine` are the same seam at two levels: production code passes neither, so `o.synth` is
 * `undefined` and `speechEngine()` picks native-then-web itself (#881). `synth` is the older, web-shaped
 * test seam (`tests/unit/audio.test.ts`'s `SynthLike` fakes); `engine` lets a test drive the `SpeechEngine`
 * contract itself, with no `SynthLike` or `SpeechSynthesisUtterance` involved. Passing both is not a real
 * call shape — `engine` wins.
 */
export function say(text: string, force = false, o: { queue?: boolean; synth?: SynthLike | null; engine?: SpeechEngine } = {}) {
  if (!force && !load().speech) return;
  const engine = o.engine ?? speechEngine(o.synth);
  if (!engine) { recordVoice('no'); return; }                              // no engine at all — the one verdict that needs no probe
  const token = {};
  if (observedVoice !== 'yes') startSilence(token);
  const events: SpeechEvents = {
    started: () => recordVoice('yes'),
    ended: () => { if (pendingToken === token) recordVoice('yes'); },
    // `canceled`/`interrupted` from the line taken back by `say()` itself; anything else leaves the clock
    // running — a later line may still start, and if none does the device really cannot be heard.
    failed: reason => { if (pendingToken === token && (reason === 'canceled' || reason === 'interrupted')) stopSilence(); },
  };
  const attempted = engine.speak(text, { lang: 'en-GB', rate: 0.9, pitch: 1.08, queue: o.queue }, events);
  if (!attempted) recordVoice('no');
}

if (typeof window !== 'undefined' && window.speechSynthesis) window.speechSynthesis.onvoiceschanged = () => { voice = undefined; };
