// #2288: the year's bubble scale must survive the trip from the year id to the spawned wave — waveOptsFor's own
// lookup is covered in bubble-scale.test.ts; this pins the call in launchWave that hands it the year.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AVATARS } from '../../src/avatars';
import { topicById, YEARS, type Question, type Rng } from '../../src/curriculum';
import { say, resetVoiceProbe } from '../../src/audio';
import type { WaveOpts } from '../../src/game/arena';
import { reset, save } from '../../src/storage';
import { createPlaySession, NO_VOICE_PEEK_MS, type PlaySessionDeps, type PlaySessionEls } from '../../src/ui/play-session';
import type { SessionOpts } from '../../src/game/session';

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
  hint: 'Listen, then slice the words in order', hintIsData: false, listen: SENTENCE, peek: true,
});

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

describe('the year reaches the drawn bubbles (#2288)', () => {
  beforeEach(() => { vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date', 'performance'] }); reset(); resetVoiceProbe(); });
  afterEach(() => { vi.useRealTimers(); });

  it.each([['reception', 1.6], ['year1', 1.1], ['year2', undefined as number | undefined]])('a %s session spawns its wave with scale %s', async (id, scale) => {
    save({ voice: 'no' });
    const { arena, ps } = build(sentenceQ, {}, { year: YEARS.find(y => y.id === id)! });
    ps.session.start(); await settle(); await vi.advanceTimersByTimeAsync(NO_VOICE_PEEK_MS);
    expect(arena.spawned).toHaveLength(1);
    expect(arena.spawned[0].scale).toBe(scale);
  });
});
