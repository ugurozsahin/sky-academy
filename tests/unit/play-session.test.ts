// The no-voice sentence peek (#65) — a hand-clocked state machine, driven here without a browser the way
// sim.test.ts drives the arena. The e2e for it runs mobile-only on a pull request (#141), so this is the check
// a reviewer can actually execute: the peek holds the launch, its clock stops under the pause overlay, the
// card's repeat control shows the sentence again, a verdict that lands mid-wave reads through, and teardown
// launches nothing.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AVATARS } from '../../src/avatars';
import { topicById, YEARS, type Question, type Rng } from '../../src/curriculum';
import { say, resetVoiceProbe } from '../../src/audio';
import type { WaveOpts } from '../../src/game/arena';
import { reset, save } from '../../src/storage';
import { createPlaySession, NO_VOICE_PEEK_MS, type PlaySessionDeps, type PlaySessionEls } from '../../src/ui/play-session';

const mem: Record<string, string> = {};
(globalThis as any).localStorage = { getItem: (k: string) => mem[k] ?? null, setItem: (k: string, v: string) => { mem[k] = v; }, removeItem: (k: string) => { delete mem[k]; }, clear: () => { for (const k in mem) delete mem[k]; } };
class FakeUtterance { lang = ''; rate = 1; pitch = 1; voice: unknown = null; onstart: ((e: Event) => unknown) | null = null; onerror: unknown = null; constructor(public text: string) {} }
(globalThis as any).SpeechSynthesisUtterance = FakeUtterance;
(globalThis as any).requestAnimationFrame = (fn: (t: number) => void) => { fn(0); return 1; };
// The default engine `canHear()` consults, so the stored verdict — not node's lack of a window — decides the
// prompt mode. It says nothing on its own: each scenario seeds the verdict it is about.
const spoken: string[] = [];
const engine = { speaking: false, pending: false, cancel() {}, speak(u: { text: string }) { spoken.push(u.text); }, getVoices: () => [] };
(globalThis as any).window = { speechSynthesis: engine };

/** A DOM element as far as the callbacks touch one: HTML in, attributes, hidden, and a class list nobody reads. */
function fakeEl() {
  const attrs: Record<string, string> = {};
  return {
    innerHTML: '', textContent: '', hidden: false, attrs,
    setAttribute(k: string, v: string) { attrs[k] = v; },
    classList: { add() {}, remove() {} },
    getBoundingClientRect: () => ({ bottom: 120 }),
  };
}
type FakeEl = ReturnType<typeof fakeEl>;

const SENTENCE = 'The cat sat on the mat';
const sentenceQ = (): Question => ({
  prompt: 'Build the sentence', say: `Build the sentence: ${SENTENCE}`, answer: SENTENCE, sequence: SENTENCE.split(' '),
  options: [...SENTENCE.split(' '), 'dog', 'hat'], wide: true, visual: { type: 'word', text: '🐱' },
  hint: 'Listen, then slice the words in order', listen: SENTENCE, peek: true,
});
const soundHuntQ = (): Question => ({ prompt: '🔊 Listen!', say: 'Listen: sun, sock, sad', answer: 's', options: ['s', 'a', 't', 'p'], listen: 'sun · sock · sad' });

function build(gen: () => Question) {
  const els = { score: fakeEl(), stage: fakeEl(), prompt: fakeEl(), vis: fakeEl(), hint: fakeEl(), qcard: fakeEl(), speak: fakeEl() };
  const arena = {
    paused: false, W: 390, topInset: 0, spawned: [] as WaveOpts[],
    spawnWave(o: WaveOpts) { this.spawned.push(o); }, rush() { return false; }, floatText() {}, reveal() {}, clearWave() {},
  };
  let mounted = true;
  const deps: PlaySessionDeps = {
    training: false, tracing: false, villain: false, av: AVATARS[0],
    els: els as unknown as PlaySessionEls,
    hud: { drawLives() {}, drawTimer() {}, drawHp() {}, showOutcome() {} },
    hold: { correct: 900, wrong: 1200, miss: 900 },
    arena: () => arena as never, mounted: () => mounted,
    later: (fn, ms) => { setTimeout(() => { if (mounted) fn(); }, ms); },
    toast() {}, startTrace() {}, showTutorial: () => 0, showTaunt() {}, showStageClear() {}, showResults() {},
  };
  const ps = createPlaySession({ mode: 'mission', year: YEARS[1], stages: 1, topic: { id: 't', title: 't', icon: 't', subject: 'writing', year: 'year1', nc: '', gen } }, deps);
  return { els: els as Record<keyof typeof els, FakeEl>, arena, ps, unmount: () => { mounted = false; ps.dispose(); } };
}

/** The wave launch waits on the font gate's promise, so a launch is only visible after the microtasks drain. */
const settle = () => vi.advanceTimersByTimeAsync(0);

describe('the no-voice sentence peek (#65)', () => {
  beforeEach(() => { vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date', 'performance'] }); reset(); resetVoiceProbe(); });
  afterEach(() => { vi.useRealTimers(); });

  it('shows the sentence, holds the wave, then hides it and launches', async () => {
    save({ voice: 'no' });
    const { els, arena, ps } = build(sentenceQ);
    ps.session.start(); await settle();
    expect(els.prompt.innerHTML).toBe(SENTENCE);
    expect(els.hint.textContent).toBe('Look, remember, then build it');
    expect(arena.paused, 'the arena is held for the whole look').toBe(true);
    expect(arena.spawned, 'the contract in types.ts: hide it BEFORE the bubbles launch').toEqual([]);
    expect(els.speak.hidden).toBe(false);
    expect(els.speak.attrs['aria-label'], 'the 🔊 button says what it does on this device').toBe('Show the sentence again');

    await vi.advanceTimersByTimeAsync(NO_VOICE_PEEK_MS - 1);
    expect(arena.spawned).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);
    expect(els.prompt.innerHTML, 'gaps, one per word, none earned').toBe(`<span class="seq">${'<span class="todo">_</span>'.repeat(6)}</span>`);
    expect(els.hint.textContent).toBe('Slice the words in order');
    expect(arena.paused).toBe(false);
    expect(arena.spawned).toHaveLength(1);
    expect(arena.spawned[0].ordered).toEqual(SENTENCE.split(' '));
  });

  it('the pause overlay stops the peek clock — the sentence is still there on resume, with its time left', async () => {
    save({ voice: 'no' });
    const { els, arena, ps } = build(sentenceQ);
    ps.session.start(); await settle();
    await vi.advanceTimersByTimeAsync(1000);
    ps.hold(true);
    expect(arena.paused).toBe(true);
    await vi.advanceTimersByTimeAsync(NO_VOICE_PEEK_MS * 3);
    expect(els.prompt.innerHTML, 'a child who paused mid-look must not lose the sentence behind the overlay').toBe(SENTENCE);
    expect(arena.spawned, 'and nothing launches under the overlay').toEqual([]);
    ps.hold(false);
    expect(arena.paused, 'resume: the peek still holds the arena').toBe(true);
    await vi.advanceTimersByTimeAsync(NO_VOICE_PEEK_MS - 1000 - 1);
    expect(els.prompt.innerHTML, 'the remaining 2 s run from the resume, not from the start').toBe(SENTENCE);
    await vi.advanceTimersByTimeAsync(1);
    expect(els.prompt.innerHTML).toContain('class="seq"');
    expect(arena.paused).toBe(false);
    expect(arena.spawned).toHaveLength(1);
  });

  it('repeat() shows the sentence again for the peek time and comes back with the progress kept', async () => {
    save({ voice: 'no' });
    const { els, arena, ps } = build(sentenceQ);
    ps.session.start(); await settle();
    await vi.advanceTimersByTimeAsync(NO_VOICE_PEEK_MS);
    expect(ps.session.hit('The'), 'first word earned').toBe('step');
    expect(els.prompt.innerHTML).toContain('<span class="got">The</span>');

    expect(ps.repeat(), 'on a silent device the card tap is the repeat').toBe(true);
    expect(els.prompt.innerHTML).toBe(SENTENCE);
    expect(arena.paused, 'bubbles in the air freeze while the child looks').toBe(true);
    expect(ps.repeat(), 'a tap during the look is absorbed, not restarted').toBe(true);
    await vi.advanceTimersByTimeAsync(NO_VOICE_PEEK_MS);
    expect(els.prompt.innerHTML, 'back to the gaps, with the word already earned still earned').toContain('<span class="got">The</span>');
    expect(arena.paused).toBe(false);
    expect(arena.spawned, 'a repeat launches nothing new').toHaveLength(1);
  });

  it('repeat() declines — so the screen reads the line aloud instead — when the device speaks, or the words are on the card', async () => {
    save({ voice: 'yes' });
    const hearing = build(sentenceQ);
    hearing.ps.session.start(); await settle();
    expect(hearing.ps.repeat()).toBe(false);
    expect(hearing.els.speak.hidden).toBe(false);
    expect(hearing.els.speak.attrs['aria-label']).toBe('Read the question aloud');

    save({ voice: 'no' });
    const reading = build(soundHuntQ);
    reading.ps.session.start(); await settle();
    expect(reading.els.prompt.innerHTML, 'a `read` question keeps its listen words on the card').toBe('sun · sock · sad');
    expect(reading.els.speak.hidden, 'so the 🔊 button, which could do nothing, is not offered').toBe(true);
    expect(reading.ps.repeat()).toBe(false);
    expect(reading.arena.paused).toBe(false);
  });

  it('a `no` that lands after the bubbles are up never freezes them: the sentence reads through instead', async () => {
    const { els, arena, ps } = build(sentenceQ);          // voice: 'unknown' → optimistic, hearing form
    ps.session.start(); await settle();
    expect(arena.spawned, 'unknown is optimistic: the wave launches at once').toHaveLength(1);
    expect(els.prompt.innerHTML).toContain('class="seq"');
    say('probe', false, { synth: null });                 // the verdict arrives mid-wave (an engine gone missing: `no` at once)
    expect(arena.paused, 'a live wave is never paused for a peek').toBe(false);
    expect(els.prompt.innerHTML, 'the sentence is shown in the gaps instead').toBe(
      `<span class="seq reveal">${SENTENCE.split(' ').map(w => `<span class="todo">${w}</span>`).join(' ')}</span>`);
    expect(els.speak.hidden).toBe(true);
    expect(ps.session.hit('The')).toBe('step');
    expect(els.prompt.innerHTML, 'and it stays readable as the child builds it').toContain('<span class="got">The</span> <span class="todo">cat</span>');
    expect(ps.repeat(), 'nothing to show again — it is all on the card').toBe(false);
  });

  it('a `yes` that lands mid-peek is left alone: the look finishes and the wave launches once', async () => {
    save({ voice: 'no' });
    const { els, arena, ps } = build(sentenceQ);
    ps.session.start(); await settle();
    const starts = { speaking: false, pending: false, cancel() {}, speak(u: SpeechSynthesisUtterance) { u.onstart?.(new Event('start') as SpeechSynthesisEvent); } };
    say('probe', false, { synth: starts });
    expect(els.prompt.innerHTML, 'the sentence on the card is not snatched away').toBe(SENTENCE);
    expect(arena.paused).toBe(true);
    await vi.advanceTimersByTimeAsync(NO_VOICE_PEEK_MS);
    expect(arena.spawned).toHaveLength(1);
    expect(arena.paused).toBe(false);
  });

  it('the spelling fallback shows the word to copy AND the place in it', async () => {
    save({ voice: 'no' });
    const spell = (): Question => ({ prompt: '🐱  Spell it!', answer: 'cat', sequence: ['c', 'a', 't'], options: ['c', 'a', 't', 'p'], listen: 'cat', hint: 'Slice the letters in order' });
    const { els, arena, ps } = build(spell);
    ps.session.start(); await settle();
    expect(arena.paused, 'no peek for a spelling: the word stays').toBe(false);
    expect(els.prompt.innerHTML).toBe('<span class="seq reveal"><span class="todo">c</span><span class="todo">a</span><span class="todo">t</span></span>');
    expect(ps.session.hit('c')).toBe('step');
    expect(els.prompt.innerHTML).toBe('<span class="seq reveal"><span class="got">c</span><span class="todo">a</span><span class="todo">t</span></span>');
  });

  it('every question hands its line to the engine, so the probe runs during play and not only at boot', async () => {
    // The 17:41Z review: replacing `say(q.say ?? q.prompt)` in spawn() with nothing passed 818/818 — no unit
    // case showed the game ever probes while playing. This one does: the question's line reaches the engine.
    save({ voice: 'yes' });
    spoken.length = 0;
    const { ps } = build(sentenceQ);
    ps.session.start(); await settle();
    expect(spoken).toEqual([`Build the sentence: ${SENTENCE}`]);
  });

  it('teardown during a peek launches nothing and leaves nothing paused', async () => {
    save({ voice: 'no' });
    const { arena, ps, unmount } = build(sentenceQ);
    ps.session.start(); await settle();
    unmount();
    await vi.advanceTimersByTimeAsync(NO_VOICE_PEEK_MS * 2);
    expect(arena.spawned).toEqual([]);
    expect(arena.paused).toBe(false);
  });
});

describe('NO_VOICE_PEEK_MS: bounded against what a child actually has to read (#128)', () => {
  // Every case above advances the clock by the constant itself, so any value of NO_VOICE_PEEK_MS passes them —
  // the property worth holding is its relationship to the longest sentence a Story Sentences generator can
  // actually hand a child, not a pair of numbers picked to match today's constant.
  const SENTENCE_TOPICS = ['r-sentence', 'y1-sentence', 'y2-sentence'];
  // pick(rng, arr) reads arr[floor(rng() * arr.length)]; 20 evenly spaced fractions in [0, 1) hit every index
  // of a bank up to length 20 twice over, whatever that bank's real length turns out to be.
  const FRACTIONS = Array.from({ length: 20 }, (_, i) => i / 20);

  /** A one-shot rng: its first call picks the bank entry, every call after (shuffling options) is inert. */
  function pickAt(fraction: number): Rng {
    let n = 0;
    return () => (n++ === 0 ? fraction : 0.5);
  }

  function longestSentenceWords(): number {
    let longest = 0;
    for (const id of SENTENCE_TOPICS) {
      const topic = topicById(id)!;
      for (const d of [1, 2, 3] as const) for (const f of FRACTIONS) {
        const q = topic.gen(d, pickAt(f));
        longest = Math.max(longest, q.sequence?.length ?? 0);
      }
    }
    return longest;
  }

  it('allows enough time to read the longest sentence any Story Sentences generator produces', () => {
    // A generously slow beginning-reader's pace, so this only goes red on a sentence genuinely too long for
    // the peek — not on the ordinary spread of NC-length sentences the banks already hold.
    const MIN_MS_PER_WORD = 400;
    const words = longestSentenceWords();
    expect(words, 'sanity: the walk above must actually find sentence questions').toBeGreaterThan(0);
    expect(NO_VOICE_PEEK_MS, `the longest sentence found is ${words} words; the peek must allow at least ${words * MIN_MS_PER_WORD} ms to read it`).toBeGreaterThanOrEqual(words * MIN_MS_PER_WORD);
  });

  it('is not so long that it stops being a memory task', () => {
    expect(NO_VOICE_PEEK_MS).toBeLessThanOrEqual(5000);
  });
});
