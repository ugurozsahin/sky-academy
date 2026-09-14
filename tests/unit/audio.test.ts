import { afterEach, beforeAll, describe, it, expect, vi } from 'vitest';
import { canHear, chooseVoice, haptic, HAPTICS, hush, NOISE_SECONDS, onVoiceStateChange, resetVoiceProbe, say, SAY_DEFER_MS, sfx, sliceFx, type SynthLike, VOICE_START_MS, voiceScore, voiceState } from '../../src/audio';
import { load, reset, save } from '../../src/storage';

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
class FakeUtterance {
  lang = ''; rate = 1; pitch = 1; voice: unknown = null;
  onstart: ((event: Event) => unknown) | null = null;
  onend: ((event: Event) => unknown) | null = null;
  onboundary: ((event: Event) => unknown) | null = null;
  onresume: ((event: Event) => unknown) | null = null;
  onerror: ((event: { error: string }) => unknown) | null = null;
  constructor(public text: string) {}
}
(globalThis as any).SpeechSynthesisUtterance = FakeUtterance;
/** Records what the game asked the engine to do, in order: `cancel` or the text of a `speak`. */
function fakeSynth(state: { speaking?: boolean; pending?: boolean; starts?: boolean; voices?: VoiceLike[] } = {}) {
  const calls: string[] = [];
  const utterances: FakeUtterance[] = [];
  return {
    calls, utterances,
    synth: {
      get speaking() { return !!state.speaking; },
      get pending() { return !!state.pending; },
      // A real engine fires `error: 'canceled'` on every line it drops; `interrupted` on the one it was saying.
      cancel() { calls.push('cancel'); state.speaking = false; state.pending = false; for (const u of utterances.splice(0)) u.onerror?.({ error: 'canceled' }); },
      speak(u: SpeechSynthesisUtterance) {
        calls.push(u.text); utterances.push(u as unknown as FakeUtterance); state.speaking = true;
        if (state.starts !== false) u.onstart?.(new Event('start') as SpeechSynthesisEvent);
      },
      getVoices() { return (state.voices ?? [v('Daniel', 'en-GB')]) as SpeechSynthesisVoice[]; },
    } as SynthLike,
  };
}

type VoiceLike = ReturnType<typeof v>;

// #65: the probe. `onstart` is the only positive evidence; a line handed to the engine that neither started nor
// was taken back within VOICE_START_MS is the only negative evidence. Everything else — an empty voice list, a
// malformed voice entry, a line we cancelled ourselves — is evidence of nothing, and these cases pin that.
describe('voice capability detection (#65)', () => {
  afterEach(() => { resetVoiceProbe(); vi.useRealTimers(); reset(); });
  // `performance` is faked with the timers: the probe banks silence by the clock, and the two must agree.
  const fresh = () => { vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date', 'performance'] }); reset(); resetVoiceProbe(); };

  it('marks a missing speech engine unavailable immediately and persists the verdict', () => {
    reset(); resetVoiceProbe();
    say('Hello', false, { synth: null });
    expect(load().voice).toBe('no');
    expect(voiceState(null)).toBe('no');
    expect(canHear(null)).toBe(false);
  });

  it('writes nothing about a missing engine when read-aloud is off and nobody asked for speech', () => {
    reset(); save({ speech: false }); resetVoiceProbe();
    say('Hello', false, { synth: null });
    expect(load().voice, 'a verdict the user did not ask for is not stored').toBe('unknown');
    say('Hello', true, { synth: null });
    expect(load().voice, 'a forced line is a request, and an absent engine is the answer').toBe('no');
  });

  it('a line that starts is a yes, at once and persisted', () => {
    fresh();
    const { synth } = fakeSynth();
    say('Hello', false, { synth });
    expect(voiceState(synth)).toBe('yes');
    expect(load().voice).toBe('yes');
  });

  it('a line that never starts is a no only after VOICE_START_MS, and a start before then wins', () => {
    fresh();
    const { synth, utterances } = fakeSynth({ starts: false });
    say('Hello', false, { synth });
    vi.advanceTimersByTime(VOICE_START_MS - 1);
    expect(load().voice, 'silence inside the window is not yet a verdict').toBe('unknown');
    utterances[0].onstart?.(new Event('start'));
    vi.advanceTimersByTime(1);
    expect(voiceState(synth)).toBe('yes');
  });

  it('marks a silent engine unavailable when nothing starts within VOICE_START_MS', () => {
    fresh();
    const { synth } = fakeSynth({ starts: false });
    say('Hello', false, { synth });
    vi.advanceTimersByTime(VOICE_START_MS);
    expect(voiceState(synth)).toBe('no');
    expect(load().voice).toBe('no');
  });

  it('an empty voice list is evidence of nothing: Android WebView returns [] on devices that speak', () => {
    fresh();
    const { synth } = fakeSynth({ voices: [] });                     // starts, as such a device does
    say('Hello', false, { synth });
    expect(voiceState(synth), 'the line started, so the device speaks, voices or no voices').toBe('yes');
    fresh();
    const mute = fakeSynth({ voices: [], starts: false }).synth;
    say('Hello', false, { synth: mute });
    vi.advanceTimersByTime(VOICE_START_MS - 1);
    expect(load().voice, 'and an empty list is not a shortcut to no either').toBe('unknown');
  });

  it('one malformed voice entry never condemns a device whose engine speaks', () => {
    // Third-party Android TTS engines populate getVoices() with entries that have no `lang`; ranking one used
    // to throw out of say() and the catch recorded `no` for good.
    fresh();
    const { synth, calls } = fakeSynth({ voices: [{ name: 'Broken' } as unknown as VoiceLike, v('Daniel', 'en-GB')] });
    say('Hello', false, { synth });
    expect(calls).toEqual(['Hello']);
    expect(voiceState(synth)).toBe('yes');
    expect(load().voice).toBe('yes');
    fresh();
    const throwing = fakeSynth().synth;
    throwing.getVoices = () => { throw new Error('voice list unavailable'); };
    say('Hello', false, { synth: throwing });
    expect(voiceState(throwing), 'a voice list that throws is a nicety we do without').toBe('yes');
  });

  it('a line we take back is not evidence — a stored yes survives a launch whose first line is cut off', () => {
    fresh(); save({ voice: 'yes' }); resetVoiceProbe();
    const { synth, calls } = fakeSynth({ starts: false });
    say('Reception island', false, { synth });                       // handed over, never started …
    hush(synth);                                                     // … and cancelled by the screen change
    expect(calls).toEqual(['Reception island', 'cancel']);
    vi.advanceTimersByTime(VOICE_START_MS * 2);
    expect(voiceState(synth), 'nothing was learnt: the stored verdict stands').toBe('yes');
    expect(load().voice).toBe('yes');
  });

  it('silence adds up across lines: a mute device answering a quick child still gets its verdict', () => {
    // Each question hands the engine a new line and takes the last one back; a clock that restarted with every
    // line would never fall on a device where questions turn over faster than VOICE_START_MS.
    fresh();
    const state = { starts: false, speaking: false };
    const { synth } = fakeSynth(state);
    for (let i = 0; i < 3; i++) {
      say(`Question ${i + 1}`, false, { synth });
      vi.advanceTimersByTime(VOICE_START_MS / 4);                    // a quarter of the budget each, engine silent throughout
      expect(load().voice, `after ${i + 1} silent quarters`).toBe('unknown');
      state.speaking = true;                                         // the engine claims to be busy with it …
    }
    say('Question 4', false, { synth });                             // … so this one interrupts: cancel, then speak
    vi.advanceTimersByTime(SAY_DEFER_MS + VOICE_START_MS / 4 - 1);
    expect(load().voice, 'a whisker short of the budget').toBe('unknown');
    vi.advanceTimersByTime(1);
    expect(voiceState(synth), 'four silent quarters make a mute device').toBe('no');
  });

  it('time between lines is not silence: a stored yes survives a launch that only ever cuts its lines short', () => {
    fresh(); save({ voice: 'yes' }); resetVoiceProbe();
    const { synth } = fakeSynth({ starts: false });
    for (let i = 0; i < 20; i++) {                                   // twenty screen changes, each cutting a line off at once
      say(`Screen ${i}`, false, { synth });
      hush(synth);
      vi.advanceTimersByTime(1000);                                  // a second of nothing pending, twenty times over
    }
    expect(voiceState(synth), 'nothing was ever held long enough to be silent about').toBe('yes');
  });

  it('a newer line interrupting the probe line hands the probe on, deadline included', () => {
    fresh();
    const state = { starts: false, speaking: false };
    const { synth, calls, utterances } = fakeSynth(state);
    say('Island', false, { synth });
    state.speaking = true;                                           // the engine is busy with it (or says it is)
    say('Question', false, { synth });                               // interrupts: cancel now, speak next tick
    expect(calls).toEqual(['Island', 'cancel']);
    vi.advanceTimersByTime(SAY_DEFER_MS);
    expect(calls).toEqual(['Island', 'cancel', 'Question']);
    vi.advanceTimersByTime(VOICE_START_MS - 1);
    expect(load().voice, 'the replacement line owns the deadline now').toBe('unknown');
    utterances.at(-1)!.onstart?.(new Event('start'));
    expect(voiceState(synth)).toBe('yes');
  });

  it('an engine that throws on speak() is judged by the deadline, not condemned on the spot', () => {
    fresh();
    const bad = { speaking: false, pending: false, cancel() {}, speak() { throw new Error('busy'); } } as SynthLike;
    say('Hello', false, { synth: bad });
    expect(load().voice, 'one hiccup is not a verdict').toBe('unknown');
    vi.advanceTimersByTime(VOICE_START_MS);
    expect(voiceState(bad), 'but a line that could never start counts when nothing else did').toBe('no');
  });

  it('a mid-launch recovery is heard: a later line that starts turns this launch\'s no into a yes', () => {
    fresh();
    const state = { starts: false };
    const { synth, utterances } = fakeSynth(state);
    say('Hello', false, { synth });
    vi.advanceTimersByTime(VOICE_START_MS);
    expect(voiceState(synth)).toBe('no');
    state.starts = true;
    say('Again', false, { synth });                                  // interrupts the silent line: cancel, then speak next tick
    vi.advanceTimersByTime(SAY_DEFER_MS);
    expect(utterances.at(-1)!.onstart, 'every line is probed until the device proves it speaks').toBeTruthy();
    expect(voiceState(synth)).toBe('yes');
    expect(load().voice).toBe('yes');
  });

  it('re-probes a stored no on the next launch and tells the active screen when it recovers', () => {
    reset(); save({ voice: 'no' }); resetVoiceProbe();
    const changes: string[] = [];
    const stop = onVoiceStateChange(state => { changes.push(state); });
    const { synth } = fakeSynth();
    say('Hello', false, { synth });
    stop();
    expect(load().voice).toBe('yes');
    expect(canHear(synth)).toBe(true);
    expect(changes).toEqual(['yes']);
  });

  it('a verdict that merely confirms the stored one wakes no listener', () => {
    fresh(); save({ voice: 'no' }); resetVoiceProbe();
    const changes: string[] = [];
    const stop = onVoiceStateChange(state => { changes.push(state); });
    say('Hello', false, { synth: fakeSynth({ starts: false }).synth });
    vi.advanceTimersByTime(VOICE_START_MS);
    stop();
    expect(changes, 'the screen already rendered for a silent device; a redraw would restart a peek').toEqual([]);
  });

  it('a listener that throws neither escapes say() nor silences the listeners after it', () => {
    fresh();
    const heard: string[] = [];
    const stopBad = onVoiceStateChange(() => { throw new Error('render failed'); });
    const stopGood = onVoiceStateChange(state => { heard.push(state); });
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      expect(() => say('Hello', false, { synth: fakeSynth().synth })).not.toThrow();
      expect(heard).toEqual(['yes']);
      expect(spy).toHaveBeenCalledTimes(1);
    } finally { stopBad(); stopGood(); spy.mockRestore(); }
  });

  it('hush() drops a line still waiting its turn and clears the deadline, so a dead screen writes nothing', () => {
    fresh();
    const state = { starts: false, speaking: true };
    const { synth, calls } = fakeSynth(state);
    say('Next question', false, { synth });                          // deferred behind the cancel
    hush(synth);
    vi.advanceTimersByTime(SAY_DEFER_MS + VOICE_START_MS);
    expect(calls.filter(c => c !== 'cancel'), 'the deferred line never reached the engine').toEqual([]);
    expect(load().voice, 'and no verdict fired against a screen that no longer exists').toBe('unknown');
  });

  it('a throwing cancel() never escapes say(), and the engine is still judged by the deadline', () => {
    // The 17:41Z review: say() runs on the line before the wave spawns, so a throw here is a card with no
    // bubbles — and with the probe armed only after cancel(), that engine also never got a verdict.
    fresh();
    const bad = { speaking: true, pending: false, cancel() { throw new Error('cancel unsupported'); }, speak() {} } as SynthLike;
    say('Island', false, { synth: bad });                            // idle path: handed over, never starts
    (bad as { speaking: boolean }).speaking = true;
    expect(() => say('Question', false, { synth: bad })).not.toThrow();
    vi.advanceTimersByTime(SAY_DEFER_MS + VOICE_START_MS);
    expect(voiceState(bad), 'the line could never start: the deadline still decides').toBe('no');
  });

  it('an utterance constructor that throws is the missing-engine verdict, not a throw into the game', () => {
    fresh();
    const Real = (globalThis as any).SpeechSynthesisUtterance;
    (globalThis as any).SpeechSynthesisUtterance = class { constructor() { throw new Error('no utterances here'); } };
    try {
      expect(() => say('Hello', false, { synth: fakeSynth().synth })).not.toThrow();
      expect(load().voice).toBe('no');
    } finally { (globalThis as any).SpeechSynthesisUtterance = Real; }
  });

  it('an engine that speaks but only ever fires end (or boundary) is a yes, not a permanent no', () => {
    // Android WebView and older Chrome speak a line and fire `end` without `start`; condemning them prints
    // Sound Hunt's keywords and tells the parent to install a voice they have.
    fresh();
    const a = fakeSynth({ starts: false });
    say('Hello', false, { synth: a.synth });
    vi.advanceTimersByTime(1000);
    a.utterances[0].onend?.(new Event('end'));
    expect(voiceState(a.synth)).toBe('yes');
    fresh();
    const b = fakeSynth({ starts: false });
    say('Hello', false, { synth: b.synth });
    b.utterances[0].onboundary?.(new Event('boundary'));
    expect(voiceState(b.synth)).toBe('yes');
  });

  it('an end fired for a line we cancelled is not a yes — that line was never heard', () => {
    fresh();
    const { synth, utterances } = fakeSynth({ starts: false });
    say('Island', false, { synth });
    const line = utterances[0];
    hush(synth);                                                     // taken back; some engines still fire `end` for it
    line.onend?.(new Event('end'));
    expect(load().voice).toBe('unknown');
  });

  it('a late canceled error from the old line does not stop the new line\'s clock', () => {
    // Real engines fire `canceled` asynchronously — after the replacement line has been armed. The identity
    // guard on the handler is what keeps the new clock running; the fake fires synchronously, so this delivers
    // the old line's error by hand, in the real order.
    fresh();
    const state = { starts: false, speaking: false };
    const { synth, utterances } = fakeSynth(state);
    synth.cancel = () => { state.speaking = false; };                // a cancel that fires nothing yet
    say('Island', false, { synth });
    const old = utterances[0];
    state.speaking = true;
    say('Question', false, { synth });
    vi.advanceTimersByTime(SAY_DEFER_MS);
    old.onerror?.({ error: 'canceled' });                            // arrives after `Question` was handed over
    vi.advanceTimersByTime(VOICE_START_MS);
    expect(voiceState(synth), 'the new line sat silent for the whole budget').toBe('no');
  });

  it('hush() drops a cut line\'s time; a newer line replacing a silent one banks it', () => {
    fresh();
    const a = fakeSynth({ starts: false });
    for (let i = 0; i < 3; i++) { say(`Screen ${i}`, false, { synth: a.synth }); vi.advanceTimersByTime(1500); hush(a.synth); }
    expect(load().voice, 'three screen changes on a cold engine are not a verdict').toBe('unknown');
    fresh();
    const state = { starts: false, speaking: false };
    const b = fakeSynth(state);
    for (let i = 0; i < 3; i++) { say(`Question ${i}`, false, { synth: b.synth }); vi.advanceTimersByTime(1500); state.speaking = true; }
    expect(voiceState(b.synth), 'three questions the engine sat on are').toBe('no');
  });

  it('the silence budget is a device number, pinned to the range the review argued for', () => {
    // Every other case here advances the clock by the constant, so a wrong constant passes them all: 200 ms
    // would condemn every slow-but-working engine, a minute would leave a child on a silent card for it.
    expect(VOICE_START_MS).toBeGreaterThanOrEqual(3000);
    expect(VOICE_START_MS).toBeLessThanOrEqual(6000);
  });

  it('{ synth: undefined } means the default engine, exactly as leaving it out does', () => {
    reset(); resetVoiceProbe();
    say('Hello', false, { synth: undefined });                       // node: no default engine → `no`, same as say('Hello')
    expect(load().voice).toBe('no');
  });
});

describe('say() — speaking without wedging the phone (#40)', () => {
  afterEach(() => { resetVoiceProbe(); vi.useRealTimers(); });

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
