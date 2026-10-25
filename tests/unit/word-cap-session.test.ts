// #2315: the word-bubble cap and the once-only instruction, driven through the real play session rather than a
// source-text match (review of 61f268d, finding 1). The harness mirrors tests/unit/play-session.test.ts.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AVATARS } from '../../src/avatars';
import { YEARS, type Question, type YearId } from '../../src/curriculum';
import { say, resetVoiceProbe } from '../../src/audio';
import type { WaveOpts } from '../../src/game/arena';
import { reset, save } from '../../src/storage';
import { createPlaySession, type PlaySessionDeps, type PlaySessionEls } from '../../src/ui/play-session';

const mem: Record<string, string> = {};
(globalThis as any).localStorage = { getItem: (k: string) => mem[k] ?? null, setItem: (k: string, v: string) => { mem[k] = v; }, removeItem: (k: string) => { delete mem[k]; }, clear: () => { for (const k in mem) delete mem[k]; } };
class FakeUtterance { lang = ''; rate = 1; pitch = 1; voice: unknown = null; onstart: unknown = null; onerror: unknown = null; constructor(public text: string) {} }
(globalThis as any).SpeechSynthesisUtterance = FakeUtterance;
(globalThis as any).requestAnimationFrame = (fn: (t: number) => void) => { fn(0); return 1; };
(globalThis as any).window = { speechSynthesis: { speaking: false, pending: false, cancel() {}, speak() {}, getVoices: () => [] } };

function fakeEl() {
  const classes = new Set<string>();
  return {
    innerHTML: '', textContent: '', hidden: false, setAttribute() {},
    classList: { add: (c: string) => classes.add(c), remove: (c: string) => classes.delete(c), contains: (c: string) => classes.has(c), toggle(c: string, on?: boolean) { const w = on ?? !classes.has(c); if (w) classes.add(c); else classes.delete(c); return w; } },
    getBoundingClientRect: () => ({ bottom: 120 }),
  };
}

const WORDS = ['ship', 'chip', 'shop', 'chop'];
const wordQ = (extra: Partial<Question> = {}): Question => ({ prompt: 'Which word has sh?', answer: 'ship', options: WORDS, wide: true, hint: 'Slice the word', hintIsData: false, ...extra });

function build(yearId: YearId, gen: () => Question) {
  const els = { score: fakeEl(), stage: fakeEl(), prompt: fakeEl(), vis: fakeEl(), hint: fakeEl(), qcard: fakeEl(), speak: fakeEl() };
  const arena = { paused: false, W: 390, topInset: 0, spawned: [] as WaveOpts[], spawnWave(o: WaveOpts) { this.spawned.push(o); }, rush() { return false; }, floatText() {}, reveal() {}, clearWave() {} };
  const deps: PlaySessionDeps = {
    training: false, tracing: false, villain: false, av: AVATARS[0], els: els as unknown as PlaySessionEls,
    hud: { drawLives() {}, drawTimer() {}, drawHp() {}, showOutcome() {}, speakCorrection() {} },
    hold: { correct: 900, wrong: 1200, miss: 900 }, arena: () => arena as never, mounted: () => true,
    later: (fn, ms) => { setTimeout(fn, ms); },
    holdTimers() {}, toast() {}, startTrace() {}, showTutorial: () => 0, showTaunt() {}, showStageClear() {},
    commitResult: () => ({ newBest: false, dojo: { state: { date: '', progress: {}, done: [], setDone: false, streak: { last: '', days: 0 }, total: 0 }, completed: [], setDone: false, coins: 0, multiplier: 1 }, fresh: [], streak: 1, cert: null, certSaved: false, dojoSaved: true, candidates: [] }),
    showResults() {},
  };
  const year = YEARS.find(y => y.id === yearId)!;
  const ps = createPlaySession({ mode: 'endless', year, pool: [{ id: 't', title: 't', icon: 't', subject: 'writing', year: yearId, nc: '', gen }] }, deps);
  return { els, arena, ps };
}
const settle = () => vi.advanceTimersByTimeAsync(0);
async function wave(_ps: unknown, arena: { spawned: WaveOpts[] }) {
  const n = arena.spawned.length;
  await vi.advanceTimersByTimeAsync(7000);
  expect(arena.spawned.length, 'a wave launched').toBe(n + 1);
}

describe('the play session applies the word cap and shows the instruction once (#2315)', () => {
  beforeEach(() => { vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date', 'performance'] }); reset(); resetVoiceProbe(); save({ voice: 'yes' }); });
  afterEach(() => { vi.useRealTimers(); });

  it('Year 1: three labels with the answer, the hint on wave 1, none on wave 2, and a re-render keeps wave 1\'s line', async () => {
    const { els, arena, ps } = build('year1', () => wordQ());
    ps.session.start(); await settle(); await wave(ps, arena);
    expect(arena.spawned[0].labels).toHaveLength(3);
    expect(arena.spawned[0].labels).toContain('ship');
    expect(els.hint.textContent).toBe('Slice the word');
    say('probe', false, { synth: null });                     // a voice verdict: renderQuestion runs a second time for the same question
    expect(els.hint.textContent, 'a re-render of wave 1 neither blanks the line').toBe('Slice the word');
    ps.session.hit('ship'); ps.waveEnd(); await wave(ps, arena);
    expect(els.hint.textContent, 'wave 2 is empty').toBe('');
    say('probe', false, { synth: null });
    expect(els.hint.textContent, 'and a re-render of wave 2 does not bring it back').toBe('');
  });

  it('Year 4 is uncapped and keeps its hint on every wave', async () => {
    const { els, arena, ps } = build('year4', () => wordQ());
    ps.session.start(); await settle(); await wave(ps, arena);
    expect(arena.spawned[0].labels).toHaveLength(4);
    ps.session.hit('ship'); ps.waveEnd(); await wave(ps, arena);
    expect(els.hint.textContent).toBe('Slice the word');
  });

  it('Year 1 money, time, measure and place-value sets keep four bubbles and their hint', async () => {
    for (const options of [['100', '120', '130', '140'], ['10p', '20p', '5p', '50p'], ['£1.50', '£2', '£1', '£5'], ['3:30', '4:30', '3:00', '12:00'], ['12 cm', '10 cm', '5 cm', '20 cm']]) {
      const { els, arena, ps } = build('year1', () => wordQ({ answer: options[0], options, prompt: 'p' }));
      ps.session.start(); await settle(); await wave(ps, arena);
      expect(arena.spawned[0].labels, options.join()).toHaveLength(4);
      ps.session.hit(options[0]); ps.waveEnd(); await wave(ps, arena);
      expect(els.hint.textContent, options.join()).toBe('Slice the word');
      ps.dispose();
    }
  });

  it('a question whose options are its content is never trimmed (the prompt may refer to any of them)', async () => {
    const { els, arena, ps } = build('year2', () => wordQ({ optionsAreContent: true }));
    ps.session.start(); await settle(); await wave(ps, arena);
    expect(arena.spawned[0].labels).toHaveLength(4);
    ps.session.hit('ship'); ps.waveEnd(); await wave(ps, arena);
    expect(els.hint.textContent).toBe('Slice the word');
  });
});
