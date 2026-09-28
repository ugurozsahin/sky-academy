// Synthesised sound effects (Web Audio, no files). Read-aloud (say/hush/the voice probe) moved to speech.ts
// (#880); re-exported below so no importer or test needs to change.
import { load } from './storage';
import type { Element, FxKind } from './game/arena';   // type only (#214) — audio.ts must not gain a runtime import from game/
export {
  canHear, chooseVoice, hush, onVoiceStateChange, resetVoiceProbe, say, SAY_DEFER_MS, speechEngine,
  type SpeakOptions, type SpeechEngine, type SpeechEvents, type SynthLike, VOICE_START_MS, voiceScore, voiceState,
  type VoiceLike, type VoiceState,
} from './speech';

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

/** Element-flavoured slice sounds, keyed by Avatar.fx. `master` mixes in the elemental table below, at the
 *  literal (#214) rather than assigned after it — `sliceFx` is typed `Record<FxKind, ...>`, so a `FxKind`
 *  gaining a new element fails here at `tsc` time until this table covers it too. */
const elementSlice: Record<Element, () => void> = {
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
export const sliceFx: Record<FxKind, () => void> = {
  ...elementSlice,
  // The Master Ninja's slice borrows a different element's sound each time.
  master: () => { const keys = Object.keys(elementSlice) as (keyof typeof elementSlice)[]; elementSlice[keys[Math.floor(Math.random() * keys.length)]](); },
};

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
