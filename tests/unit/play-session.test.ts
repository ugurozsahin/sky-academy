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
import { createPlaySession, NO_VOICE_PEEK_MS, waveOptsFor, type PlaySessionDeps, type PlaySessionEls } from '../../src/ui/play-session';

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

/**
 * A DOM element as far as the callbacks touch one: HTML in, attributes, hidden, and a class list. The class
 * list is a real set rather than a pair of no-ops because `.hint` now carries `own` (#328) and that mark is
 * the whole of what the landscape fix does — a stub would let the tests below pass with it never written.
 */
function fakeEl() {
  const attrs: Record<string, string> = {};
  const classes = new Set<string>();
  return {
    innerHTML: '', textContent: '', hidden: false, attrs, classes,
    setAttribute(k: string, v: string) { attrs[k] = v; },
    classList: {
      add(c: string) { classes.add(c); },
      remove(c: string) { classes.delete(c); },
      contains: (c: string) => classes.has(c),
      toggle(c: string, on?: boolean) { const want = on ?? !classes.has(c); classes[want ? 'add' : 'delete'](c); return want; },
    },
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

function build(gen: () => Question, over: Partial<PlaySessionDeps> = {}) {
  const els = { score: fakeEl(), stage: fakeEl(), prompt: fakeEl(), vis: fakeEl(), hint: fakeEl(), qcard: fakeEl(), speak: fakeEl() };
  const arena = {
    paused: false, W: 390, topInset: 0, spawned: [] as WaveOpts[],
    spawnWave(o: WaveOpts) { this.spawned.push(o); }, rush() { return false; }, floatText() {}, reveal() {}, clearWave() {},
  };
  let mounted = true;
  const holdCalls: boolean[] = [];
  const deps: PlaySessionDeps = {
    training: false, tracing: false, villain: false, av: AVATARS[0],
    els: els as unknown as PlaySessionEls,
    hud: { drawLives() {}, drawTimer() {}, drawHp() {}, showOutcome() {} },
    hold: { correct: 900, wrong: 1200, miss: 900 },
    arena: () => arena as never, mounted: () => mounted,
    later: (fn, ms) => { setTimeout(() => { if (mounted) fn(); }, ms); },
    // The real one freezes and re-arms these (#301); this stub only records that the screen calls it, which is
    // what `screen.test.ts` then holds the freezing itself to.
    holdTimers: (open) => { holdCalls.push(open); },
    toast() {}, startTrace() {}, showTutorial: () => 0, showTaunt() {}, showStageClear() {},
    commitResult: () => ({
      newBest: false,
      dojo: { state: { date: '', progress: {}, done: [], setDone: false, streak: { last: '', days: 0 }, total: 0 }, completed: [], setDone: false, coins: 0, multiplier: 1 },
      fresh: [], streak: 1, cert: null, certSaved: false,
    }),
    showResults() {},
    ...over,
  };
  const ps = createPlaySession({ mode: 'mission', year: YEARS[1], stages: 1, topic: { id: 't', title: 't', icon: 't', subject: 'writing', year: 'year1', nc: '', gen } }, deps);
  return { els: els as Record<keyof typeof els, FakeEl>, arena, ps, holdCalls, unmount: () => { mounted = false; ps.dispose(); } };
}

/** The wave launch waits on the font gate's promise, so a launch is only visible after the microtasks drain. */
const settle = () => vi.advanceTimersByTimeAsync(0);

describe('waveOptsFor: the spawn-options bridge to tests/unit/sim.test.ts (#126)', () => {
  const q = (extra: Partial<Question> = {}): Question => ({ prompt: 'p', answer: 'a', options: ['a', 'b'], ...extra });

  it('is wide when the question itself says so, whatever the label lengths', () => {
    expect(waveOptsFor(q({ wide: true }), { labels: ['a', 'b'], speed: 2 }, 0).wide).toBe(true);
  });

  it('is wide when any label is longer than three characters, even if the question does not say so', () => {
    expect(waveOptsFor(q(), { labels: ['a', 'blaze'], speed: 2 }, 0).wide).toBe(true);
  });

  it('is not wide when the question says nothing and every label is short', () => {
    expect(waveOptsFor(q(), { labels: ['a', 'bee', 'cat'], speed: 2 }, 0).wide).toBe(false);
  });

  it('carries the labels and speed straight from info, untouched', () => {
    const opts = waveOptsFor(q(), { labels: ['x', 'y'], speed: 3 }, 0);
    expect(opts.labels).toEqual(['x', 'y']);
    expect(opts.speed).toBe(3);
  });

  it('slices the sequence from the given index for an ordered question, or omits it for one with none', () => {
    const sequence = ['one', 'two', 'three'];
    expect(waveOptsFor(q({ sequence }), { labels: sequence, speed: 1 }, 1).ordered).toEqual(['two', 'three']);
    expect(waveOptsFor(q(), { labels: ['a', 'b'], speed: 1 }, 0).ordered).toBeUndefined();
  });
});

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
    const { els, arena, ps, holdCalls } = build(sentenceQ);
    ps.session.start(); await settle();
    await vi.advanceTimersByTimeAsync(1000);
    ps.hold(true);
    expect(arena.paused).toBe(true);
    await vi.advanceTimersByTimeAsync(NO_VOICE_PEEK_MS * 3);
    expect(els.prompt.innerHTML, 'a child who paused mid-look must not lose the sentence behind the overlay').toBe(SENTENCE);
    expect(arena.spawned, 'and nothing launches under the overlay').toEqual([]);
    ps.hold(false);
    expect(arena.paused, 'resume: the peek still holds the arena').toBe(true);
    // #301: the screen's own beats are handed the same open/close, so the outcome hold and the gap freeze with
    // the arena rather than running behind the overlay. What the freezing itself must do is in `screen.test.ts`;
    // this is the wiring, which no rail held before.
    expect(holdCalls, 'the scope is told to freeze and re-arm its beats, in that order').toEqual([true, false]);
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

/**
 * #328: on a phone held sideways `@media (max-height: 640px)` hides `.hint` to buy the play card vertical
 * space. That is a fair trade for an instruction line and not for the seven measure topics, which put the
 * values being compared there and nowhere else, so the card becomes "Which holds more?" over two coloured
 * bubbles (#65: usable without read-aloud). The fix is one class, written from the generator's own
 * `hintIsData` flag: the CSS keeps hiding every other hint and lets the marked one through.
 *
 * **The predicate is the whole finding of this pull request's round-1 review.** It was `!!q.hint` by way of
 * `line === q.hint`, and `hint` is documented as "small instruction text": 47 of 87 topics write one and
 * only 7 carry data, so the first version gave a line back to ~40 landscape cards that the media query
 * exists to reclaim. The tests could not tell, because both controls — here and in the e2e — were drawn
 * from topics that write no hint at all. `instructionQ` below is that gap closed: it is the shape of
 * `y1-shapes`/`y2-punct`, a hint-writing card that must stay hidden, and it fails against `!!q.hint`.
 *
 * Checked here as well as in the e2e (`game.spec.ts`, at 844×390) because the mark is the whole mechanism:
 * this says the writer sets it on the right questions, that says the rule then renders it.
 */
describe('the line under the prompt says whose it is (#328)', () => {
  beforeEach(() => { vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date', 'performance'] }); reset(); resetVoiceProbe(); });
  afterEach(() => { vi.useRealTimers(); });

  /** A `measureCompare()` card, in the shape `y1-capacity` draws: the millilitres live in the hint alone. */
  const measureQ = (): Question => ({
    prompt: 'Which holds more?', answer: 'red', options: ['red', 'blue'],
    hint: 'red jug: 300 ml · blue jug: 100 ml', hintIsData: true, say: 'the red jug holds 300 millilitres, the blue jug holds 100 millilitres. Which one holds more?',
  });
  /**
   * A card that writes a `hint` and does NOT need it — the majority case, `y1-shapes`'s shape. This is the
   * control the first version of the fix was missing: it is what separates `hintIsData` from `!!q.hint`,
   * and it is red against the latter.
   */
  const instructionQ = (): Question => ({ prompt: 'Which is the circle?', answer: '⭕', options: ['⭕', '🔺'], hint: 'Slice the shape' });
  const plainQ = (): Question => ({ prompt: '3 + 4', answer: '7', options: ['7', '8'] });

  it("marks the question's own hint, so the short-screen rule cannot hide the only values on the card", async () => {
    save({ voice: 'yes' });
    const { els, ps } = build(measureQ);
    ps.session.start(); await settle();
    expect(els.hint.textContent).toBe('red jug: 300 ml · blue jug: 100 ml');
    expect(els.hint.classes.has('own'), 'without this class the landscape rule hides the millilitres').toBe(true);
  });

  it("leaves a generator's INSTRUCTION hint unmarked, which is 40 of the 47 topics that write one", async () => {
    save({ voice: 'yes' });
    const { els, ps } = build(instructionQ);
    ps.session.start(); await settle();
    expect(els.hint.textContent, 'the card still shows its instruction on a tall screen').toBe('Slice the shape');
    expect(els.hint.classes.has('own'), 'marking this costs every such card a line of arena in landscape').toBe(false);
  });

  it('leaves the screen\'s own generic instruction unmarked, so landscape keeps the space it buys today', async () => {
    save({ voice: 'yes' });
    const { els, ps } = build(plainQ);
    ps.session.start(); await settle();
    expect(els.hint.textContent).toBe('Tap or slice the answer');
    expect(els.hint.classes.has('own')).toBe(false);
  });

  it('does not mark a fallback instruction when a generator sets the flag but writes no hint', async () => {
    save({ voice: 'yes' });
    const { els, ps } = build(() => ({ prompt: '3 + 4', answer: '7', options: ['7', '8'], hintIsData: true }));
    ps.session.start(); await settle();
    expect(els.hint.textContent, 'no hint, so `hintText` fell back to the screen\'s line').toBe('Tap or slice the answer');
    expect(els.hint.classes.has('own'), 'the flag alone must not mark a line the question did not write').toBe(false);
  });

  it('clears the mark when a hint-carrying question is followed by one without, so it cannot stick', async () => {
    save({ voice: 'yes' });
    let first = true;
    const { els, ps } = build(() => { const q = first ? measureQ() : instructionQ(); first = false; return q; });
    ps.session.start(); await settle();
    expect(els.hint.classes.has('own')).toBe(true);
    expect(ps.session.hit('red')).toBe('correct');
    ps.waveEnd();                                   // the arena's callback, which the stub arena above cannot fire
    await vi.advanceTimersByTimeAsync(3000);
    expect(els.hint.textContent, 'the second question is the instruction one').toBe('Slice the shape');
    expect(els.hint.classes.has('own'), 'a stale mark would keep an instruction on screen in landscape').toBe(false);
  });

  it('does not mark the tracing instruction, on the path the harness never used to reach', async () => {
    // `build()` hardcoded `tracing: false` and nothing in the suite overrode it, so `hintText`'s tracing
    // branch had no coverage in either direction (#430 review, addendum to note 5). No live bug — the three
    // trace topics emit no `hint` — but the line is this screen's words, so it must not be marked.
    save({ voice: 'yes' });
    const { els, ps } = build(plainQ, { tracing: true });
    ps.session.start(); await settle();
    expect(els.hint.textContent).toBe('Trace over the dotted letters');
    expect(els.hint.classes.has('own')).toBe(false);
  });

  it("does not mark the peek's own instructions, which are this screen's words and not the card's", async () => {
    save({ voice: 'no' });
    const { els, ps } = build(sentenceQ);
    ps.session.start(); await settle();
    expect(els.hint.textContent).toBe('Look, remember, then build it');
    expect(els.hint.classes.has('own')).toBe(false);
    await vi.advanceTimersByTimeAsync(NO_VOICE_PEEK_MS);
    expect(els.hint.textContent).toBe('Slice the words in order');
    expect(els.hint.classes.has('own')).toBe(false);
  });
});

/**
 * #484 (mirroring #375/#441's `commitMatch` for Ninja Duel): a finished game's writes must be committed the
 * instant `session.end()` decides it, not ~1.2s later inside the results overlay's own scope-bound `later()`
 * — where a quit before the overlay's timer fires (Pause -> Islands, or the Android back button) used to
 * cancel them outright, in every mode but Duel.
 */
describe('onEnd commits the payout before the results overlay is ever scheduled to draw it (#484)', () => {
  beforeEach(() => { vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date', 'performance'] }); reset(); resetVoiceProbe(); });
  afterEach(() => { vi.useRealTimers(); });

  it('commitResult runs synchronously from the losing hit, before showResults is scheduled — and survives teardown that cancels showResults', async () => {
    const els = { score: fakeEl(), stage: fakeEl(), prompt: fakeEl(), vis: fakeEl(), hint: fakeEl(), qcard: fakeEl(), speak: fakeEl() };
    const arena = {
      paused: false, W: 390, topInset: 0, spawned: [] as WaveOpts[],
      spawnWave(o: WaveOpts) { this.spawned.push(o); }, rush() { return false; }, floatText() {}, reveal() {}, clearWave() {},
    };
    let mounted = true;
    const calls: string[] = [];
    const payout = {
      newBest: false,
      dojo: { state: { date: '', progress: {}, done: [], setDone: false, streak: { last: '', days: 0 }, total: 0 }, completed: [], setDone: false, coins: 0, multiplier: 1 },
      fresh: [], streak: 1, cert: null, certSaved: false,
    };
    const deps: PlaySessionDeps = {
      training: false, tracing: false, villain: false, av: AVATARS[0],
      els: els as unknown as PlaySessionEls,
      hud: { drawLives() {}, drawTimer() {}, drawHp() {}, showOutcome() {} },
      hold: { correct: 900, wrong: 1200, miss: 900 },
      arena: () => arena as never, mounted: () => mounted,
      later: (fn, ms) => { setTimeout(() => { if (mounted) fn(); }, ms); },
      holdTimers() {}, toast() {}, startTrace() {}, showTutorial: () => 0, showTaunt() {}, showStageClear() {},
      commitResult: () => { calls.push('commit'); return payout; },
      showResults: (r, p) => { calls.push('show'); expect(p, 'the overlay draws the payout it was handed, never a second one it computed itself').toBe(payout); },
    };
    const gen = (): Question => ({ prompt: 'Pick one', answer: 'right', options: ['right', 'wrong'] });
    const topic = { id: 't', title: 't', icon: 't', subject: 'writing' as const, year: 'year1' as const, nc: '', gen };
    const ps = createPlaySession({ mode: 'endless', year: YEARS[1], pool: [topic] }, deps);
    ps.session.start(); await settle();
    // year1 has 3 lives (#484 test targets Endless, one of the modes #375/#441 never touched): three slips end
    // the run. `waveEnd()` advances to the next question between slips, exactly as the arena's own onWaveEnd
    // would — the LAST slip is what matters: `end()` calls `onEnd` synchronously from inside that `hit()`,
    // no timer runs in between, and nothing here advances past it.
    for (let i = 0; i < YEARS[1].lives - 1; i++) { ps.session.hit('wrong'); ps.waveEnd(); await vi.advanceTimersByTimeAsync(5000); }
    ps.session.hit('wrong');
    expect(ps.session.ended, 'three slips end an Endless run').toBe(true);
    expect(calls, 'the commit already ran; the overlay is only scheduled, not drawn').toEqual(['commit']);
    // Teardown (the screen's own `cleanup()` -> `scope.dispose()`) is exactly `mounted` going false: the real
    // `later()` guards every callback on it. The commit already happened and cannot be undone by this.
    mounted = false;
    await vi.advanceTimersByTimeAsync(10_000);
    expect(calls, 'a quit before the overlay timer fires drops the DRAWING, never the payout').toEqual(['commit']);
  });

  /**
   * #484 review round 2, B1: the test above drives Endless, which never fires `session.ts`'s `onCommit` at
   * all — so it cannot exercise the one line that makes the staged-mission fix work, `onCommit(r) { earlyPayout
   * = deps.commitResult(r); }` (and `onEnd`'s `earlyPayout ?? deps.commitResult(r)` reuse below it). The
   * reviewer replaced that handler with a no-op and the full suite stayed green — this drives a real, staged
   * (`stages: 1`) mission through `createPlaySession` itself, so a no-op there fails this test directly:
   * `deps.commitResult` would then only run later, from `onEnd`'s fallback, defeating the whole point of the
   * early commit (a quit between the last question and the deferred `advance()`/"Next" chain would go back to
   * losing the payout, session.ts's own preview notwithstanding).
   */
  it("play-session.ts's onCommit handler calls deps.commitResult synchronously on a staged mission's last question, and onEnd reuses it rather than committing twice", async () => {
    const els = { score: fakeEl(), stage: fakeEl(), prompt: fakeEl(), vis: fakeEl(), hint: fakeEl(), qcard: fakeEl(), speak: fakeEl() };
    const arena = {
      paused: false, W: 390, topInset: 0, spawned: [] as WaveOpts[],
      spawnWave(o: WaveOpts) { this.spawned.push(o); }, rush() { return false; }, floatText() {}, reveal() {}, clearWave() {},
    };
    let mounted = true;
    const commitCalls: unknown[] = []; const showCalls: unknown[] = [];
    const payout = {
      newBest: false,
      dojo: { state: { date: '', progress: {}, done: [], setDone: false, streak: { last: '', days: 0 }, total: 0 }, completed: [], setDone: false, coins: 0, multiplier: 1 },
      fresh: [], streak: 1, cert: null, certSaved: false,
    };
    const deps: PlaySessionDeps = {
      training: false, tracing: false, villain: false, av: AVATARS[0],
      els: els as unknown as PlaySessionEls,
      hud: { drawLives() {}, drawTimer() {}, drawHp() {}, showOutcome() {} },
      hold: { correct: 900, wrong: 1200, miss: 900 },
      arena: () => arena as never, mounted: () => mounted,
      later: (fn, ms) => { setTimeout(() => { if (mounted) fn(); }, ms); },
      holdTimers() {}, toast() {}, startTrace() {}, showTutorial: () => 0, showTaunt() {}, showStageClear() {},
      commitResult: (r) => { commitCalls.push(r); return payout; },
      showResults: (r, p) => { showCalls.push(p); },
    };
    const gen = (): Question => ({ prompt: 'Pick one', answer: 'right', options: ['right', 'wrong'] });
    const topic = { id: 't', title: 't', icon: 't', subject: 'writing' as const, year: 'year1' as const, nc: '', gen };
    const ps = createPlaySession({ mode: 'mission', year: YEARS[1], stages: 1, topic }, deps);
    ps.session.start(); await settle();
    for (let i = 0; i < YEARS[1].perStage - 1; i++) {
      expect(ps.session.hit('right')).toBe('correct');
      ps.waveEnd(); await vi.advanceTimersByTimeAsync(5000);
    }
    // The last question of the only (and so last) stage: the commit must land INSIDE this call, synchronously
    // — nothing below advances a fake timer before the assertion, so a deferred-only commit fails this.
    expect(ps.session.hit('right')).toBe('correct');
    expect(commitCalls, "deps.commitResult ran inside hit() itself, via session.ts's onCommit").toHaveLength(1);
    expect(showCalls, 'the overlay is not drawn yet — only committed').toHaveLength(0);
    // The natural path still runs afterwards (advance() -> onStageClear, then the "Next" click's nextStage()
    // -> end() -> onEnd) — and must reuse the same payout rather than committing a second time.
    ps.waveEnd(); await vi.advanceTimersByTimeAsync(5000);
    ps.session.nextStage();
    await vi.advanceTimersByTimeAsync(5000);
    expect(commitCalls, 'onEnd must reuse the early payout, never call commitResult a second time').toHaveLength(1);
    expect(showCalls, 'the overlay eventually draws the SAME payout object commitResult returned').toEqual([payout]);
  });
});
