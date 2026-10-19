import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Topic, Question } from '../../src/curriculum';

// The duel card's wiring (#647), its voice verdict (#649) and its spoken line (#650), through the real
// `createDuelBeats` and a real `Duel`. No DOM and no timers: the elements are plain records, the scope's `later`
// never fires, and `../audio` is replaced so the test owns the voice verdict and hears what is said.
const voice = vi.hoisted(() => ({ audible: true, listeners: new Set<() => void>(), said: [] as Array<[string, boolean | undefined]> }));
vi.mock('../../src/audio', () => ({
  canHear: () => voice.audible,
  onVoiceStateChange: (fn: () => void) => { voice.listeners.add(fn); return () => { voice.listeners.delete(fn); }; },
  say: (text: string, force?: boolean) => { voice.said.push([text, force]); },
  haptic: () => {}, sfx: new Proxy({}, { get: () => () => {} }),
}));
vi.mock('../../src/ui/font', () => ({ fontReady: () => new Promise<void>(() => {}) }));
vi.mock('../../src/ui/play-session', () => ({ waveOptsFor: () => ({}) }));

import { Duel, DUEL_HANDOVER } from '../../src/game/duel';
import { createDuelBeats } from '../../src/ui/duel-beats';
import { hintText, promptHTML } from '../../src/ui/hud';

interface Fake { hidden: boolean; innerHTML: string; textContent: string; classList: { add(): void; remove(): void } }
const fake = (): Fake => ({ hidden: false, innerHTML: '', textContent: '', classList: { add() {}, remove() {} } });
let els: Record<string, Fake>;

const arena = () => ({ W: 100, H: 100, floatText() {}, reveal() {}, clearWave() {}, spawnWave() {}, topInset: 0, paused: false });
const SOUND: Question = { prompt: 'Which word has the sound?', listen: 'cat, dog', answer: 'cat', options: ['cat', 'dog'] };
const HINTED: Question = { prompt: 'Which is fuller?', hint: 'red jug: 3 · blue jug: 5', hintIsData: true, answer: 'blue', options: ['red', 'blue'] };
const PLAIN: Question = { prompt: 'What is 2 + 2?', answer: '4', options: ['4', '5'] };

function mount(qs: Question[]) {
  let i = 0;
  const topic: Topic = { id: 'test-card', title: 'card', icon: '🔧', subject: 'maths', year: 'year1', nc: '', gen: () => qs[Math.min(i++, qs.length - 1)]! };
  const scope = { alive: true, later() {}, toast() {}, clearToast() {} };
  const beats = createDuelBeats({ o: { year: { speeds: [1] } }, av: { glow: '#fff' }, NAME: { a: 'A', b: 'B' }, scope, arenas: { a: arena(), b: arena() }, commitOnce: () => null, showResults() {} } as any);
  const duel = new Duel({ topic, difficulty: 1, rounds: 3 }, beats.callbacks); beats.bind(duel);
  return { beats, duel };
}

beforeEach(() => {
  voice.audible = true; voice.listeners.clear(); voice.said.length = 0;
  els = Object.fromEntries(['#round', '#prompt', '#vis', '#hint', '#speak', '#toast', '#score-a', '#score-b'].map(k => [k, fake()]));
  vi.stubGlobal('document', { querySelector: (sel: string) => els[sel] ?? null });
});
afterEach(() => { vi.unstubAllGlobals(); });

describe('the duel card is written by the play screen\'s writers (#647)', () => {
  it('a question with a hint puts that hint on the card, and the prompt is the plain one while it can be heard', () => {
    const { duel } = mount([HINTED]); duel.start();
    expect(els['#hint']!.textContent).toBe('red jug: 3 · blue jug: 5');
    expect(els['#prompt']!.innerHTML).toBe(promptHTML(HINTED, 0, false));
  });

  it('a listen question on a device that cannot be heard prints its words and says "Read, then slice"', () => {
    voice.audible = false;
    const { duel, beats } = mount([SOUND]); duel.start();
    expect(els['#prompt']!.innerHTML).toBe(promptHTML(SOUND, 0, true));
    expect(els['#prompt']!.innerHTML).toContain('cat, dog');
    expect(els['#hint']!.textContent).toBe('Read, then slice the answer');
    expect(beats.hintLine).toBe('Read, then slice the answer');
    expect(els['#speak']!.hidden).toBe(true);
  });

  it('a plain question with no hint tells the child what to do, and keeps the speak button', () => {
    const { duel } = mount([PLAIN]); duel.start();
    expect(els['#hint']!.textContent).toBe('Tap or slice the answer');
    expect(els['#speak']!.hidden).toBe(false);
  });
});

describe('the card follows the voice verdict (#649)', () => {
  it('a probe that flips mid-round repaints the current card with its words and the read hint', () => {
    const { duel } = mount([SOUND]); duel.start();
    expect(els['#prompt']!.innerHTML).not.toContain('cat, dog');   // round 1 on the optimistic verdict: "Listen!"
    expect(els['#hint']!.textContent).toBe('Tap or slice the answer');
    voice.audible = false; for (const fn of [...voice.listeners]) fn();
    expect(els['#prompt']!.innerHTML).toContain('cat, dog');
    expect(els['#hint']!.textContent).toBe('Read, then slice the answer');
    expect(els['#speak']!.hidden).toBe(true);
  });

  it('stop() unsubscribes, and a verdict before the first question or after the match paints nothing', () => {
    const { duel, beats } = mount([SOUND]);
    voice.audible = false; for (const fn of [...voice.listeners]) fn();   // before start(): no question yet
    expect(els['#prompt']!.innerHTML).toBe('');
    duel.start(); beats.stop();
    expect(voice.listeners.size).toBe(0);
  });

  it('a verdict after the last round repaints nothing: the card behind the results stays as it was (#2063)', () => {
    const { duel } = mount([SOUND]); duel.start();
    for (let r = 0; r < 3 && !duel.ended; r++) { duel.hit('a', duel.current!.answer); duel.waveEnd(); }
    expect(duel.ended).toBe(true);
    els['#prompt']!.innerHTML = 'untouched'; els['#hint']!.textContent = 'untouched';
    voice.audible = false; for (const fn of [...voice.listeners]) fn();
    expect(els['#prompt']!.innerHTML).toBe('untouched');
    expect(els['#hint']!.textContent).toBe('untouched');
  });
});

describe('🔊 repeats the question as it was first spoken (#650)', () => {
  it('round 1 carries the hand-over line, later rounds do not, and a say override still wins', () => {
    const SAY: Question = { ...PLAIN, say: 'Add two and two.' };
    const { duel, beats } = mount([PLAIN, SAY]); duel.start();
    beats.repeat();
    expect(voice.said.at(-1)).toEqual([`${DUEL_HANDOVER} What is 2 + 2?`, true]);
    duel.hit('a', duel.current!.answer); duel.waveEnd();
    beats.repeat();
    expect(voice.said.at(-1)).toEqual(['Add two and two.', true]);
  });
});

describe('hintText\'s three fallbacks are pinned, in order (#650)', () => {
  const q = { answer: 'b' };
  it('names the instruction for each case', () => {
    expect(hintText(q, { reveal: false })).toBe('Tap or slice the answer');
    expect(hintText(q, { reveal: true })).toBe('Read, then slice the answer');
    expect(hintText(q, { reveal: true, tracing: true })).toBe('Trace over the dotted letters');
    expect(hintText({ answer: '7' }, { reveal: true, tracing: true })).toBe('Trace over the dotted number');
    expect(hintText(q, { reveal: true, keypad: true })).toBe('Type the answer, then tap ✓');
  });
  it('a hint is the question\'s own line, and an empty hint falls through to the instruction (decided, #650)', () => {
    expect(hintText({ hint: '3 cm', answer: 'b' }, { reveal: false })).toBe('3 cm');
    expect(hintText({ hint: '', answer: 'b' }, { reveal: false })).toBe('Tap or slice the answer');
  });
});
