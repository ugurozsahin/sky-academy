// Synthesised sound effects (Web Audio, no files) + Web Speech for reading prompts aloud.
import { load, save, type SaveData } from './storage';

let ctx: AudioContext | null = null;
function ac(): AudioContext | null {
  if (!load().sound) return null;
  try { ctx ??= new (window.AudioContext || (window as any).webkitAudioContext)(); if (ctx.state === 'suspended') ctx.resume(); return ctx; }
  catch { return null; }
}
function tone(freq: number, dur: number, type: OscillatorType = 'sine', gain = 0.25, slideTo?: number, delay = 0) {
  const c = ac(); if (!c) return;
  const o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, c.currentTime + delay);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, c.currentTime + delay + dur);
  g.gain.setValueAtTime(0.0001, c.currentTime + delay);
  g.gain.exponentialRampToValueAtTime(gain, c.currentTime + delay + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + delay + dur);
  o.connect(g).connect(c.destination); o.start(c.currentTime + delay); o.stop(c.currentTime + delay + dur + 0.05);
}
/** Length of the one shared noise buffer. Every `noise()` duration must fit inside it — `noise is one shared
 *  buffer` in guardrails.test.ts holds the SFX table to that, because a longer sound would run off the end of
 *  the buffer and go quiet early while its gain ramp carried on. */
export const NOISE_SECONDS = 0.5;
let noiseBuf: AudioBuffer | null = null, noiseFor: BaseAudioContext | null = null;
/**
 * The white noise every swish, slice and elemental hit is cut from — built once, lazily, per context (#41).
 *
 * It used to be a fresh `createBuffer` per SFX, filled sample by sample with `Math.random()`: at 48 kHz a
 * single 0.35 s wind wrote nearly 17,000 samples, mid-frame, and the trail fires a swish every few pointer
 * moves. White noise is white noise, so one buffer serves the lot and each play takes a different slice.
 */
function noiseBuffer(c: BaseAudioContext): AudioBuffer {
  if (noiseBuf && noiseFor === c) return noiseBuf;
  const buf = c.createBuffer(1, Math.ceil(c.sampleRate * NOISE_SECONDS), c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;      // flat: the fade is a gain ramp now (see below)
  noiseFor = c; return (noiseBuf = buf);
}
function noise(dur: number, gain = 0.2, hp = 1200, lp = 0) {
  const c = ac(); if (!c) return;
  const t = c.currentTime;
  const s = c.createBufferSource(); s.buffer = noiseBuffer(c);
  const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp;
  // The old per-SFX buffer carried its own linear 1 → 0 fade in its samples ((1 - i / d.length)). A shared
  // buffer cannot, so the same envelope is a gain ramp instead — the identical shape, and what tone() has
  // always done. Nothing about the sound changes; only where the fade is applied.
  const g = c.createGain(); g.gain.setValueAtTime(gain, t); g.gain.linearRampToValueAtTime(0, t + dur);
  if (lp) { const l = c.createBiquadFilter(); l.type = 'lowpass'; l.frequency.value = lp; s.connect(f).connect(l).connect(g).connect(c.destination); }
  else s.connect(f).connect(g).connect(c.destination);
  s.start(t, Math.random() * Math.max(0, NOISE_SECONDS - dur), dur);   // a different slice of the buffer each time
}

/** Element-flavoured slice sounds, keyed by Avatar.fx. */
export const sliceFx: Record<string, () => void> = {
  fire: () => { noise(0.22, 0.18, 300, 1800); tone(180, 0.2, 'sawtooth', 0.08, 90); },
  water: () => { noise(0.25, 0.16, 500, 2400); tone(700, 0.18, 'sine', 0.12, 250); tone(1100, 0.08, 'sine', 0.06, 1500, 0.05); },
  electric: () => { tone(1800, 0.06, 'square', 0.08, 400); tone(2600, 0.05, 'square', 0.06, 900, 0.05); noise(0.06, 0.12, 3000); },
  earth: () => { tone(90, 0.22, 'sine', 0.25, 45); noise(0.12, 0.18, 80, 500); },
  wind: () => { noise(0.35, 0.14, 800, 3000); },
  ice: () => { noise(0.08, 0.1, 3000); [2093, 2637, 3136].forEach((f, i) => tone(f, 0.14, 'sine', 0.08, undefined, i * 0.03)); },
  light: () => { [1319, 1760, 2637].forEach((f, i) => tone(f, 0.12, 'triangle', 0.1, undefined, i * 0.04)); },
  shadow: () => { noise(0.3, 0.12, 150, 900); tone(140, 0.25, 'sine', 0.1, 70); },
  blade: () => { noise(0.07, 0.22, 2500); tone(2400, 0.16, 'sine', 0.07, 1900, 0.02); },
  robot: () => { tone(880, 0.05, 'square', 0.08); tone(1320, 0.05, 'square', 0.08, undefined, 0.06); },
};
/** The Master Ninja's slice borrows a different element's sound each time. */
sliceFx.master = () => { const keys = Object.keys(sliceFx).filter(k => k !== 'master'); sliceFx[keys[Math.floor(Math.random() * keys.length)]](); };

export const sfx = {
  swish: () => noise(0.12, 0.12, 2500),                                   // blade trail
  whoosh: () => { noise(0.14, 0.1, 1200, 5000); tone(500, 0.12, 'sine', 0.05, 1300); },   // a thrown projectile (#48)
  slice: () => { noise(0.08, 0.2, 1800); tone(900, 0.08, 'triangle', 0.15, 300); },
  correct: () => { tone(660, 0.1, 'triangle', 0.2); tone(880, 0.12, 'triangle', 0.2, undefined, 0.09); tone(1320, 0.18, 'triangle', 0.2, undefined, 0.18); },
  wrong: () => { tone(220, 0.25, 'sawtooth', 0.12, 150); },
  miss: () => { tone(300, 0.2, 'sine', 0.1, 200); },
  stage: () => { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, 'triangle', 0.22, undefined, i * 0.12)); },
  tap: () => tone(500, 0.05, 'square', 0.06),
  life: () => { tone(180, 0.3, 'sawtooth', 0.15, 90); noise(0.2, 0.1, 400); },
};

/** Haptic patterns (ms on / off). Vibration follows the sound toggle: muting the game also stills the phone. */
export const HAPTICS = { slice: [12], correct: [15, 40, 25], wrong: [70], life: [40, 50, 40], stage: [30, 40, 30, 40, 90] } as const;
export function haptic(kind: keyof typeof HAPTICS, nav: { vibrate?: (p: number | number[]) => boolean } = navigator): boolean {
  if (!load().sound || typeof nav.vibrate !== 'function') return false;
  try { return !!nav.vibrate([...HAPTICS[kind]]); } catch { return false; }
}

/** Minimal shape of SpeechSynthesisVoice so the ranking is testable in node. */
export interface VoiceLike { name: string; lang: string; localService?: boolean }
/**
 * Score a voice for reading to a 4–7 year old: British English first, warm/child voices first,
 * "natural"/online voices over robotic local ones. Higher = better; < 0 = unusable.
 */
export function voiceScore(v: VoiceLike): number {
  const lang = v.lang.replace('_', '-').toLowerCase(); const name = v.name;
  if (!lang.startsWith('en')) return -1;
  let s = lang === 'en-gb' ? 100 : /en-(ie|au|nz)/.test(lang) ? 60 : 30;
  if (/maisie/i.test(name)) s += 40;                                        // Microsoft's en-GB child voice
  else if (/libby|sonia|kate|serena|martha|google uk english female|moira|fiona/i.test(name)) s += 30;
  else if (/female/i.test(name)) s += 20;
  else if (/daniel|ryan|thomas|oliver|google uk english male|arthur/i.test(name)) s += 10;
  if (/natural|neural|online|premium|enhanced/i.test(name)) s += 8;
  if (v.localService === false) s += 4;                                     // cloud voices sound less robotic
  if (/eddy|flo|grandma|grandpa|reed|rocko|sandy|shelley|bad news|bells|boing|bubbles|cellos|jester|organ|superstar|trinoids|whisper|wobble|zarvox|albert|fred|junior|ralph|kathy/i.test(name)) s -= 100; // Apple novelty voices: any plain English voice beats them
  return s;
}
export function chooseVoice<T extends VoiceLike>(voices: T[]): T | null {
  let best: T | null = null, bs = -1;
  for (const v of voices) { const s = voiceScore(v); if (s > bs) { best = v; bs = s; } }
  return best;
}
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
let pendingLine: SpeechSynthesisUtterance | undefined;   // and which line that is — an old line's late `canceled` must not stop a new line's clock
const voiceListeners = new Set<(state: VoiceState) => void>();

// Read through `window` rather than the bare global so a node test can stand a fake engine up as the default
// and exercise `canHear()` the way the screens call it. `SpeechSynthesisUtterance` is feature-detected too: an
// engine object with no way to build a line is no engine, and saying so here beats a throw looking like one.
const defaultSynth = (): SynthLike | null =>
  typeof window !== 'undefined' && window.speechSynthesis && typeof SpeechSynthesisUtterance === 'function'
    ? window.speechSynthesis : null;

function clearVoiceDeadline() {
  if (voiceDeadline !== undefined) clearTimeout(voiceDeadline);
  voiceDeadline = undefined;
}
/** A line is with the engine: the silence clock runs from now, and the verdict falls when it reaches the budget. */
function startSilence(line: SpeechSynthesisUtterance) {
  stopSilence();
  pendingSince = performance.now(); pendingLine = line;
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
  pendingSince = undefined; pendingLine = undefined;
  clearVoiceDeadline();
}

function recordVoice(state: VoiceState) {
  clearVoiceDeadline();
  pendingSince = undefined; pendingLine = undefined;
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
  observedVoice = undefined; silentMs = 0; pendingSince = undefined; pendingLine = undefined;
  voice = undefined;
}

/**
 * Stop speaking and drop any line still waiting — the screen is going away (#35). Owned here rather than
 * calling `speechSynthesis.cancel()` from the screen, because a cancel is also the one thing that must void
 * the probe: a line cut off by a screen change is no evidence that the engine is silent, so its time is
 * dropped, not banked — three quick screen changes on a cold engine must not add up to a `no`.
 */
export function hush(synth: SynthLike | null = defaultSynth()) {
  if (deferred !== undefined) { clearTimeout(deferred); deferred = undefined; }
  stopSilence(false);
  try { synth?.cancel(); } catch { /* an engine that will not even cancel has nothing left to stop */ }
}

/**
 * The probe (#65): every line handed to the engine is evidence until the launch has a verdict. Any sign that
 * a line is being spoken is a `yes` — `onstart`, but also `onboundary`, `onresume`, and an `onend` on a line
 * we did not take back: Android WebView and older Chrome are known to speak a line and fire only `end`, and
 * a device that really spoke must never be told it cannot. The only negative signal is *silence with a line
 * pending*: the clock runs while the engine holds a line of ours and has not started it, stops when we take
 * the line back (`hush()` drops that time; `say()` replacing a line the engine sat on banks it), and the
 * verdict is `no` when it reaches `VOICE_START_MS` in total. Summed across lines, deliberately: a mute
 * device answering a quick child gets a new line every couple of seconds, and a clock that restarted with
 * each one would never fall — while a slow engine handed 4 s of lines in a row has had its chance. An empty
 * `getVoices()` is evidence of nothing in either direction — Android WebView returns `[]` forever on devices
 * that speak perfectly well — so it plays no part.
 */
function armVoiceProbe(utterance: SpeechSynthesisUtterance) {
  if (observedVoice === 'yes') return;
  const spoke = () => recordVoice('yes');
  utterance.onstart = spoke; utterance.onboundary = spoke; utterance.onresume = spoke;
  // `end` counts only while the line is still ours: some engines fire it for a line they were told to cancel,
  // and that line was never heard.
  utterance.onend = () => { if (pendingLine === utterance) spoke(); };
  utterance.onerror = e => {
    // Taken back (by us, or by anything else calling cancel()): the clock stops. Any other error leaves it
    // running — a later line may still start, and if none does the device really cannot be heard.
    if (pendingLine === utterance && (e.error === 'canceled' || e.error === 'interrupted')) stopSilence();
  };
  startSilence(utterance);
}

/**
 * Speak a line. Interrupts whatever is speaking, unless `queue` is set — then it waits its turn instead,
 * which is what per-letter progress wants: cutting the previous letter off mid-word is the bug (#40).
 *
 * Two things this must not do, both of them faults we shipped: `cancel()` unconditionally, which on iOS and
 * Android leaves the engine wedged often enough that the next line is simply never heard; and `speak()` in
 * the same turn as a `cancel()`, which those engines drop on the floor.
 */
export function say(text: string, force = false, o: { queue?: boolean; synth?: SynthLike | null } = {}) {
  if (!force && !load().speech) return;
  const s = o.synth === undefined ? defaultSynth() : o.synth;
  if (!s) { recordVoice('no'); return; }                                    // no engine at all — the one verdict that needs no probe
  if (deferred !== undefined) { clearTimeout(deferred); deferred = undefined; }   // a line still waiting is stale now
  // Nothing below may throw into the caller: `say()` runs on the line before the wave spawns, and a throw
  // there is a question card with no bubbles (#65 review). An engine whose utterance constructor throws
  // cannot be handed a line at all — that is the missing-engine verdict, not a hiccup.
  let u: SpeechSynthesisUtterance;
  try { u = new SpeechSynthesisUtterance(text); } catch { recordVoice('no'); return; }
  u.lang = 'en-GB'; u.rate = 0.9; u.pitch = 1.08;                           // a touch slower and brighter for young listeners
  try { const v = pickVoice(s); if (v) u.voice = v; } catch { /* a voice is a nicety; the default will do */ }
  // Only the engine call may count against the device. A `speak()` (or `cancel()`) that throws is a line that
  // can never start: the probe is armed BEFORE the engine is asked, so the deadline is left running — a device
  // that throws on every line is called mute in VOICE_START_MS, one that merely hiccupped is judged by the next.
  if (o.queue || !(s.speaking || s.pending)) {                              // nothing to interrupt, or nothing we want to
    armVoiceProbe(u);
    try { s.speak(u); } catch { /* the deadline decides */ }
    return;
  }
  stopSilence();                                                            // the line being cut off banks its silence
  armVoiceProbe(u);                                                         // and the replacement owns the clock from here
  try { s.cancel(); } catch { /* the engine would not even cancel: the deferred speak() and the deadline decide */ }
  deferred = setTimeout(() => {
    deferred = undefined;
    try { s.speak(u); } catch { /* the deadline decides */ }
  }, SAY_DEFER_MS);
}
if (typeof window !== 'undefined' && window.speechSynthesis) window.speechSynthesis.onvoiceschanged = () => { voice = undefined; };
