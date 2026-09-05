// Synthesised sound effects (Web Audio, no files) + Web Speech for reading prompts aloud.
import { load } from './storage';

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
function noise(dur: number, gain = 0.2, hp = 1200, lp = 0) {
  const c = ac(); if (!c) return;
  const buf = c.createBuffer(1, c.sampleRate * dur, c.sampleRate); const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const s = c.createBufferSource(); s.buffer = buf;
  const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp;
  const g = c.createGain(); g.gain.value = gain;
  if (lp) { const l = c.createBiquadFilter(); l.type = 'lowpass'; l.frequency.value = lp; s.connect(f).connect(l).connect(g).connect(c.destination); }
  else s.connect(f).connect(g).connect(c.destination);
  s.start();
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

export const sfx = {
  swish: () => noise(0.12, 0.12, 2500),                                   // blade trail
  slice: () => { noise(0.08, 0.2, 1800); tone(900, 0.08, 'triangle', 0.15, 300); },
  correct: () => { tone(660, 0.1, 'triangle', 0.2); tone(880, 0.12, 'triangle', 0.2, undefined, 0.09); tone(1320, 0.18, 'triangle', 0.2, undefined, 0.18); },
  wrong: () => { tone(220, 0.25, 'sawtooth', 0.12, 150); },
  miss: () => { tone(300, 0.2, 'sine', 0.1, 200); },
  stage: () => { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, 'triangle', 0.22, undefined, i * 0.12)); },
  tap: () => tone(500, 0.05, 'square', 0.06),
  life: () => { tone(180, 0.3, 'sawtooth', 0.15, 90); noise(0.2, 0.1, 400); },
};

let voice: SpeechSynthesisVoice | null | undefined;
function pickVoice() {
  if (voice !== undefined) return voice;
  const vs = speechSynthesis.getVoices();
  voice = vs.find(v => /en-GB/i.test(v.lang) && /female|Google UK English Female|Kate|Serena|Martha/i.test(v.name))
    ?? vs.find(v => /en-GB/i.test(v.lang)) ?? vs.find(v => /^en/i.test(v.lang)) ?? null;
  return voice;
}
export function say(text: string, force = false) {
  if (!('speechSynthesis' in window)) return;
  if (!force && !load().speech) return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-GB'; u.rate = 0.92; u.pitch = 1.05;
    const v = pickVoice(); if (v) u.voice = v;
    speechSynthesis.speak(u);
  } catch { /* ignore */ }
}
if ('speechSynthesis' in window) speechSynthesis.onvoiceschanged = () => { voice = undefined; };
