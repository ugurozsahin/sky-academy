// The comprehension story card (#1352) — its own file because play-session.test.ts is frozen at its length (#1388).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AVATARS } from '../../src/avatars';
import { YEARS, type Question } from '../../src/curriculum';
import { resetVoiceProbe, say, type SpeechEngine, type SpeechEvents } from '../../src/audio';
import type { WaveOpts } from '../../src/game/arena';
import { reset, save } from '../../src/storage';
import { screenScope } from '../../src/ui/screen';
import { createPlaySession, type PlaySessionDeps, type PlaySessionEls } from '../../src/ui/play-session';
import { repeatKey, type SessionOpts } from '../../src/game/session';

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

function build(gen: () => Question, over: Partial<PlaySessionDeps> = {}, sessionOver: Partial<SessionOpts> = {}) {
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
    hud: { drawLives() {}, drawTimer() {}, drawHp() {}, showOutcome() {}, speakCorrection() {} },
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
      fresh: [], streak: 1, cert: null, certSaved: false, dojoSaved: true, candidates: [],
    }),
    showResults() {},
    ...over,
  };
  const ps = createPlaySession({ mode: 'mission', year: YEARS[1], stages: 1, topic: { id: 't', title: 't', icon: 't', subject: 'writing', year: 'year1', nc: '', gen }, ...sessionOver }, deps);
  return { els: els as Record<keyof typeof els, FakeEl>, arena, ps, holdCalls, unmount: () => { mounted = false; ps.dispose(); } };
}

/** The wave launch waits on the font gate's promise, so a launch is only visible after the microtasks drain. */
const settle = () => vi.advanceTimersByTimeAsync(0);


describe('the comprehension story card (#1352)', () => {
  const STORY = 'Mo has a red kite. It is windy.';   // six words with the question: "What colour is the kite?" is five more
  const LINE = `t! ${STORY} What colour is the kite?`;
  const WORDS = LINE.split(' ').length;
  const storyQ = (): Question => ({ prompt: 'What colour is the kite?', say: `${STORY} What colour is the kite?`, story: STORY, answer: 'red', options: ['red', 'blue', 'green', 'pink'] });
  /** An engine that keeps its utterance, so a test decides when the line ends. */
  let utter: { onend?: () => void; onerror?: (e: { error: string }) => void } | null = null;
  const talking = { speaking: false, pending: false, cancel() {}, speak(u: { text: string }) { spoken.push(u.text); utter = u as never; }, getVoices: () => [] };
  beforeEach(() => { vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date', 'performance'] }); reset(); resetVoiceProbe(); spoken.length = 0; utter = null; (globalThis as any).window.speechSynthesis = talking; });
  afterEach(() => { vi.useRealTimers(); (globalThis as any).window.speechSynthesis = engine; });
  const printed = (els: { vis: FakeEl; prompt: FakeEl }) => { expect(els.vis.innerHTML).toContain(STORY); expect(els.prompt.innerHTML).toContain('What colour is the kite?'); };

  it('with a voice: speaks story and question as one line, and no bubble flies until that line ends', async () => {
    save({ voice: 'yes' });
    const { els, arena, ps } = build(storyQ);
    ps.session.start(); await settle();
    expect(spoken).toEqual([LINE]);
    printed(els);
    await vi.advanceTimersByTimeAsync(2000);
    expect(arena.spawned, 'the line is still being read').toEqual([]);
    utter!.onend!(); await vi.advanceTimersByTimeAsync(1);
    expect(arena.spawned).toHaveLength(1);
    utter!.onend!(); await vi.advanceTimersByTimeAsync(5000);
    expect(arena.spawned, 'exactly one wave').toHaveLength(1);
    printed(els);
  });

  it('a line that failed to start still releases the wave; one cancelled does not', async () => {
    save({ voice: 'yes' });
    const { arena, ps } = build(storyQ);
    ps.session.start(); await settle();
    utter!.onerror!({ error: 'interrupted' }); await vi.advanceTimersByTimeAsync(1);
    expect(arena.spawned).toEqual([]);
    utter!.onerror!({ error: 'synthesis-failed' }); await vi.advanceTimersByTimeAsync(1);
    expect(arena.spawned).toHaveLength(1);
  });

  it('with a voice that never ends: the wave launches at 500 ms a word plus the voice start time', async () => {
    save({ voice: 'yes' });
    const { arena, ps } = build(storyQ);
    ps.session.start(); await settle();
    const fallback = 500 * WORDS + 4000;
    await vi.advanceTimersByTimeAsync(fallback - 1);
    expect(arena.spawned).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);
    expect(arena.spawned).toHaveLength(1);
  });

  it('with no voice: the wave launches after 500 ms a word, and the story stays on the card', async () => {
    save({ voice: 'no' });
    const { els, arena, ps } = build(storyQ);
    ps.session.start(); await settle();
    printed(els);
    await vi.advanceTimersByTimeAsync(500 * WORDS - 1);
    expect(arena.spawned).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);
    expect(arena.spawned).toHaveLength(1);
    printed(els);
  });

  it('the pause overlay stops the launch clock and resuming continues it', async () => {
    save({ voice: 'no' });
    Object.assign((globalThis as any).window, { setTimeout: (f: () => void, ms: number) => setTimeout(f, ms), clearTimeout: (id: number) => clearTimeout(id) });   // the real scope's timers
    const scope = screenScope();
    const { arena, ps } = build(storyQ, { later: scope.later, holdTimers: scope.holdTimers });
    ps.session.start(); await settle();
    await vi.advanceTimersByTimeAsync(1000);
    ps.hold(true);
    await vi.advanceTimersByTimeAsync(500 * WORDS * 3);
    expect(arena.spawned, 'nothing launches under the overlay').toEqual([]);
    ps.hold(false);
    await vi.advanceTimersByTimeAsync(500 * WORDS - 1000 - 1);
    expect(arena.spawned, 'the rest of the reading time runs from the resume').toEqual([]);
    await vi.advanceTimersByTimeAsync(1);
    expect(arena.spawned).toHaveLength(1);
  });
  it('with no voice the line is still offered to the engine once (the APK has no web synth), then the wave launches after the reading time', async () => {
    save({ voice: 'no' });
    const { arena, ps } = build(storyQ);
    ps.session.start(); await settle();
    expect(spoken, 'say() ran once with the story and question').toEqual([LINE]);
    await vi.advanceTimersByTimeAsync(500 * WORDS);
    expect(arena.spawned).toHaveLength(1);
  });

  it('a question without a story speaks its line once and, like a story, launches when the voice ends (#2268)', async () => {
    save({ voice: 'yes' });
    const plain = (): Question => ({ prompt: 'What colour is the kite?', answer: 'red', options: ['red', 'blue', 'green', 'pink'] });
    const { arena, ps } = build(plain);
    ps.session.start(); await settle();
    expect(spoken).toEqual(['t! What colour is the kite?']);
    expect(arena.spawned, 'the wave waits for the voice').toHaveLength(0);
    await vi.advanceTimersByTimeAsync(6000);   // no end ever comes: the fallback is capped at 6 s
    expect(arena.spawned).toHaveLength(1);
  });

  it('an end heard behind the pause overlay waits for the resume', async () => {
    save({ voice: 'yes' });
    Object.assign((globalThis as any).window, { setTimeout: (f: () => void, ms: number) => setTimeout(f, ms), clearTimeout: (id: number) => clearTimeout(id) });
    const scope = screenScope();
    const { arena, ps } = build(storyQ, { later: scope.later, holdTimers: scope.holdTimers });
    ps.session.start(); await settle();
    ps.hold(true);
    utter!.onend!(); await vi.advanceTimersByTimeAsync(10);
    expect(arena.spawned).toEqual([]);
    ps.hold(false); await vi.advanceTimersByTimeAsync(10);
    expect(arena.spawned).toHaveLength(1);
  });
});

describe('repeatKey and a story (#1352)', () => {
  const q = (story?: string) => ({ prompt: 'What colour is the kite?', answer: 'red', options: ['red', 'blue'], ...(story ? { story } : {}) });
  it('differs for the same question on two stories, and is unchanged for a card without one', () => {
    expect(repeatKey(q('Mo has a red kite.'))).not.toBe(repeatKey(q('Mo has a red kite. It is windy.')));
    expect(repeatKey(q('Mo has a red kite.'))).toBe(repeatKey(q('Mo has a red kite.')));
    expect(repeatKey(q()).split('\u0000'), 'the old shape: six fields, none added').toHaveLength(6);
  });
});

describe('say() onEnd (#1352)', () => {
  const run = (finish: (e: SpeechEvents) => void) => {
    let ev!: SpeechEvents; let n = 0;
    const eng: SpeechEngine = { speak: (_t, _o, e) => { ev = e; return true; }, cancel() {}, busy: () => false };
    say('hi', true, { engine: eng, onEnd: () => { n++; } });
    finish(ev); finish(ev);
    return n;
  };
  it('fires once on ended and once on a failure that is not a cancel', () => {
    expect(run(e => e.ended())).toBe(1);
    expect(run(e => e.failed('synthesis-failed'))).toBe(1);
  });
  it('never fires for a line cancelled or interrupted', () => {
    expect(run(e => e.failed('canceled'))).toBe(0);
    expect(run(e => e.failed('interrupted'))).toBe(0);
  });
  it('never fires when no engine could be built', () => {
    let n = 0;
    say('hi', true, { engine: { speak: () => false, cancel() {}, busy: () => false }, onEnd: () => { n++; } });
    expect(n).toBe(0);
  });
});
