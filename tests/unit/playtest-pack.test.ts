import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { CATALOGUE } from './helpers/catalogue-file';
import { RUNTIME, resolveGame } from '../../src/config/resolve';
import { MAX_RELAUNCHES, RELAUNCH_DELAY } from '../../src/game/bubbles';
import { createSim } from './sim/harness';
import {
  ABOUT, FRAME_CLAMP_MS, KEYPAD_PACKS, buildMetrics, cardShare, countWords, flightMetrics, frameStats, labelReach, newReach,
  parseArgs, plannedPacks, reachStep, speechMode, type ReachBubble, type ReachRecording, type Recorded, type Sample,
} from '../../scripts/playtest-metrics.mjs';

const root = new URL('../../', import.meta.url).pathname;
const read = (p: string) => readFileSync(root + p, 'utf8');

/**
 * #2205: the play pack's numbers. The browser half (scripts/playtest-pack.mjs) only records frames; every number a
 * profile scores from is worked out here, so it is tested on a stub arena that flies bubbles the way arena.ts does:
 * launched from just below the screen at `y = H + r`, `vy += g·dt; y += vy·dt` each frame, dead once below the edge.
 */
const H = 844, R = 33, FRAME = 1000 / 60;
interface StubBubble { id: number; label: string; launch: number; vy: number; g: number; relaunch?: boolean }
/** Fly `bubbles` and return what the page records: one sample per live bubble per frame, until `until`, or `waveOver`. */
function fly(bubbles: StubBubble[], until: number, waveOver = Infinity): Sample[] {
  const live = bubbles.map(b => ({ ...b, y: H + R, v: b.vy, dead: false, flights: 1 }));
  const out: Sample[] = [];
  for (let t = 0; t <= until && t < waveOver; t += FRAME) {
    for (const b of live) {
      if (t < b.launch || b.dead) continue;
      b.v += b.g * FRAME / 1000; b.y += b.v * FRAME / 1000;
      if (b.y - R > H + 10 && b.v > 0) {
        if (b.relaunch && b.flights === 1) { b.flights = 2; b.y = H + R; b.v = b.vy; } else { b.dead = true; continue; }
      }
      out.push([t, b.id, b.label, b.y, R, b.v]);
    }
  }
  return out;
}
/** The continuous answer for one bubble: when its centre crosses the screen's bottom edge going up, and coming down. */
function crossings(vy: number, g: number, line = H) {
  const a = g / 2, b = vy, c = R + H - line;               // y(t) = H + R + vy·t + g·t²/2 = line
  const d = Math.sqrt(b * b - 4 * a * c);
  return [(-b - d) / (2 * a) * 1000, (-b + d) / (2 * a) * 1000];
}

describe('play-pack flight metrics on a stub arena (#2205)', () => {
  const vy = -600, g = 250;                                  // apex 2.4 s after launch, 720 px up: y = 157, on screen
  it('times a whole flight: launch to apex, and the time it is reachable', () => {
    const f = flightMetrics(fly([{ id: 1, label: '7', launch: 0, vy, g }], 8000), { H, cardBottom: 0, answer: '7' });
    const [up, down] = crossings(vy, g);
    expect(f.bubbles[0].endedBy).toBe('fell');
    expect(Math.abs(f.aboveCardMs!.min - (down - up))).toBeLessThan(2 * FRAME);
    expect(Math.abs(f.launchToApexMs!.min - (-vy / g) * 1000)).toBeLessThan(2 * FRAME);
    expect(f.answerAboveCardMs).toBe(f.aboveCardMs!.min);
    expect(f.bubbleRadiusPx).toBe(R);
  });

  it('does not count time spent above the question card as reachable', () => {
    const card = 300;                                         // the apex (y = 157) is above it
    const f = flightMetrics(fly([{ id: 1, label: '7', launch: 0, vy, g }], 8000), { H, cardBottom: card });
    const [up, down] = crossings(vy, g), [above, below] = crossings(vy, g, card);
    expect(Math.abs(f.aboveCardMs!.min - ((down - up) - (below - above)))).toBeLessThan(3 * FRAME);
  });

  it('takes the first flight only: a gentle relaunch is a second chance, not a slower bubble', () => {
    const once = flightMetrics(fly([{ id: 1, label: '3', launch: 0, vy, g }], 8000), { H, cardBottom: 0 });
    const twice = flightMetrics(fly([{ id: 1, label: '3', launch: 0, vy, g, relaunch: true }], 16000), { H, cardBottom: 0 });
    expect(twice.aboveCardMs).toEqual(once.aboveCardMs);
    expect(twice.bubbles[0].leaveMs).toBe(once.bubbles[0].leaveMs);
  });

  it('keeps a flight the wave cut short out of the range, but lists it, and times the answer on its own', () => {
    const wave = [{ id: 1, label: '6', launch: 0, vy, g }, { id: 2, label: '9', launch: 1500, vy, g }];
    const [up, down] = crossings(vy, g);
    const f = flightMetrics(fly(wave, 12000, down + 200), { H, cardBottom: 0, answer: '9' });
    expect(f.bubbles.map(b => b.endedBy)).toEqual(['fell', 'wave over']);
    expect(f.aboveCardMs!.min).toBe(f.aboveCardMs!.max);                       // the one full flight
    expect(f.slowestBubble!.label).toBe('6');
    expect(f.answerAboveCardMs!).toBeLessThan(f.aboveCardMs!.min);             // '9' had only until the wave ended
    expect(Math.abs(f.answerAboveCardMs! - (down + 200 - 1500 - up))).toBeLessThan(2 * FRAME);
  });

  it('names the slowest and the fastest of the full flights', () => {
    const wave = [{ id: 1, label: 'slow', launch: 0, vy: -500, g: 160 }, { id: 2, label: 'fast', launch: 0, vy: -800, g: 420 }];
    const f = flightMetrics(fly(wave, 12000), { H, cardBottom: 0 });
    expect(f.slowestBubble!.label).toBe('slow');
    expect(f.fastestBubble!.label).toBe('fast');
    expect(f.fastestBubble!.entrySpeedPxS!).toBeGreaterThan(f.slowestBubble!.entrySpeedPxS!);
  });

  it('a bubble cut before it reached the screen is listed but has no reach', () => {
    const f = flightMetrics(fly([{ id: 1, label: 'x', launch: 0, vy, g }], 30), { H, cardBottom: 0 });
    expect(f.bubbles[0].enterMs).toBeNull();
    expect(f.aboveCardMs).toBeNull();
  });

  it('counts what is left of each reach after the spoken prompt ends, below the card only', () => {
    const samples = fly([{ id: 1, label: '7', launch: 0, vy, g }], 8000);
    const [up, down] = crossings(vy, g);
    const after = (speechEnd: number | null, card = 0) => flightMetrics(samples, { H, cardBottom: card, speechEnd }).afterSpeechMs;
    expect(after(null)).toBeNull();
    expect(after(0)).toEqual(flightMetrics(samples, { H, cardBottom: 0 }).aboveCardMs);   // spoken before it rose: all of it
    expect(Math.abs(after(3000)!.min - (down - 3000))).toBeLessThan(2 * FRAME);
    expect(after(down + 1000)).toEqual({ min: 0, max: 0 });
    const [, below] = crossings(vy, g, 300);                  // it passes above a card at 300: that time is not reachable
    expect(below).toBeGreaterThan(3000);
    expect(Math.abs(after(3000, 300)!.min - (down - below))).toBeLessThan(2 * FRAME);
    expect(up).toBeGreaterThan(0);
  });

  it('takes the apex at the highest point, not at the first frame a collision flips vy', () => {
    const samples = fly([{ id: 1, label: '7', launch: 0, vy, g }], 8000);
    const bumped = samples.map((x, i): Sample => (i === 30 ? [x[0], x[1], x[2], x[3], x[4], 40] : x));   // a knock mid-rise
    expect(flightMetrics(bumped, { H, cardBottom: 0 }).launchToApexMs).toEqual(flightMetrics(samples, { H, cardBottom: 0 }).launchToApexMs);
  });

  it('flags a frame gap the arena would have clamped, and none at the clamp', () => {
    expect(frameStats([0, 16, 33, 133])).toEqual({ count: 4, maxGapMs: 100, clean: true });
    expect(frameStats([0, FRAME_CLAMP_MS + 1]).clean).toBe(false);
    expect(read('src/game/arena.ts')).toContain(`dt = Math.min(dt, ${FRAME_CLAMP_MS / 1000});`);   // the clamp this mirrors
  });
});

/**
 * #2251: a sequence label's reach over its first flight and its relaunches. `flySeq` flies required bubbles the way
 * arena.ts does a sequence wave: a fall below the edge sends one back to its launch line, on the same arc, after
 * RELAUNCH_DELAY, until MAX_RELAUNCHES are used; the next fall kills it. The page's own recorder, `reachStep`, runs
 * every frame, so this tests the function the pack injects, not a copy of it.
 */
interface SeqBubble extends ReachBubble { vy0: number; v: number; g: number; launchAt: number }
function flySeq(spec: { id: number; label: string; launch: number; vy: number; g: number }[], o: { need: string[]; until: number; slice?: { id: number; at: number }; freezeAt?: number; extra?: ReachBubble[] }) {
  const rc = newReach();
  const bs: SeqBubble[] = spec.map(b => ({ id: b.id, label: b.label, y: H + R, vy0: b.vy, v: b.vy, g: b.g, launchAt: b.launch, launched: false, hit: false, dead: false, relaunches: 0 }));
  const frozen = (t: number) => t >= (o.freezeAt ?? Infinity);
  for (let t = 0; t <= o.until; t += FRAME) {
    for (const b of bs) if (!b.dead && !b.hit && !frozen(t)) stepSeq(b, t, o.slice);
    reachStep(rc, t, [...bs, ...(o.extra ?? [])], frozen(t), o.need);
  }
  return rc;
}
function stepSeq(b: SeqBubble, t: number, slice?: { id: number; at: number }) {
  if (slice?.id === b.id && t >= slice.at) { b.hit = true; return; }
  if (!b.launched) { if (t < b.launchAt) return; b.launched = true; }
  b.v += b.g * FRAME / 1000; b.y += b.v * FRAME / 1000;
  if (b.y - R <= H + 10 || b.v <= 0) return;
  if (b.relaunches < MAX_RELAUNCHES) { b.relaunches++; b.launched = false; b.launchAt = t + RELAUNCH_DELAY; b.y = H + R; b.v = b.vy0; } else b.dead = true;
}

describe('a sequence label\'s reach over its relaunches, on a stub arena (#2251)', () => {
  const vy = -600, g = 250, opts = { H, cardBottom: 0, maxRelaunches: MAX_RELAUNCHES };
  const [up, down] = crossings(vy, g), flight = down - up;   // one flight's reach, continuous

  it('a label left alone is reachable for every flight it gets, then runs out', () => {
    const rc = flySeq([{ id: 1, label: 'the', launch: 0, vy, g }], { need: ['the'], until: 40000 });
    const { labelReachMs, labelReach: lr } = labelReach(rc, opts);
    expect(lr.labels).toEqual([{ label: 'the', reachMs: expect.any(Number), flights: MAX_RELAUNCHES + 1, endedBy: 'ran out' }]);
    expect(Math.abs(lr.labels[0].reachMs - (MAX_RELAUNCHES + 1) * flight)).toBeLessThan(2 * (MAX_RELAUNCHES + 1) * FRAME);
    expect(labelReachMs).toEqual({ min: lr.labels[0].reachMs, median: lr.labels[0].reachMs, max: lr.labels[0].reachMs });
    expect(lr.maxRelaunches).toBe(MAX_RELAUNCHES);
    expect(lr.frames.clean).toBe(true);
  });

  it('is many times the first flight\'s aboveCardMs, which is why a sequence game does not use that', () => {
    const rc = flySeq([{ id: 1, label: 'the', launch: 0, vy, g }], { need: ['the'], until: 40000 });
    const first = flightMetrics(rc.samples.map(([t, id, label, y]): Sample => [t, id, label, y, R, 0]), { H, cardBottom: 0 });
    expect(labelReach(rc, opts).labelReachMs!.min).toBeGreaterThan(MAX_RELAUNCHES * flight);
    expect(first.bubbles[0].reachMs).toBeGreaterThan(0);
  });

  it('a label sliced on its second flight counts as reachable up to the slice', () => {
    const at = flight + 2 * up + RELAUNCH_DELAY + 1000;       // a second into its second flight's reach, roughly
    const rc = flySeq([{ id: 1, label: 'the', launch: 0, vy, g }], { need: ['the'], until: 20000, slice: { id: 1, at } });
    const l = labelReach(rc, opts).labelReach.labels[0];
    expect([l.endedBy, l.flights]).toEqual(['sliced', 2]);
    expect(l.reachMs).toBeGreaterThan(flight);
    expect(l.reachMs).toBeLessThan(2 * flight);
  });

  it('does not count time above the question card, on any flight', () => {
    const card = 300;
    const [above, below] = crossings(vy, g, card);
    const rc = flySeq([{ id: 1, label: 'the', launch: 0, vy, g }], { need: ['the'], until: 40000 });
    const reach = labelReach(rc, { ...opts, cardBottom: card }).labelReachMs!.min;
    expect(Math.abs(reach - (MAX_RELAUNCHES + 1) * (flight - (below - above)))).toBeLessThan(3 * (MAX_RELAUNCHES + 1) * FRAME);
  });

  it('records required labels only, each bubble on its own (a word can appear twice), and skips the outcome\'s ghost', () => {
    const ghost: ReachBubble = { id: 9, label: 'the', y: 300, launched: true, hit: true, dead: false, relaunches: 0 };
    const rc = flySeq([{ id: 1, label: 'the', launch: 0, vy, g }, { id: 2, label: 'cat', launch: 0, vy, g }, { id: 3, label: 'the', launch: 400, vy, g }],
      { need: ['the', 'the'], until: 40000, extra: [ghost] });
    expect(Object.keys(rc.ids).map(Number)).toEqual([1, 3]);
    expect(labelReach(rc, opts).labelReach.labels.map(l => l.endedBy)).toEqual(['ran out', 'ran out']);
  });

  it('keeps a label the question\'s end cut short out of the range, and flags it only when it had less than the min', () => {
    const wave = [{ id: 1, label: 'Do', launch: 0, vy, g }, { id: 2, label: 'you', launch: 0, vy: -300, g: 52 }, { id: 3, label: 'like', launch: 2.5 * flight, vy, g }];
    const freezeAt = (MAX_RELAUNCHES + 1) * (flight + 2 * up + RELAUNCH_DELAY);   // about when 'Do' runs out
    const r = labelReach(flySeq(wave, { need: ['Do', 'you', 'like'], until: freezeAt + 1000, freezeAt }), opts);
    const by = Object.fromEntries(r.labelReach.labels.map(l => [l.label, l]));
    expect(by.Do.endedBy).toBe('ran out');
    expect(by.you.endedBy, 'a slower arc, still in the air').toBe('wave over');
    expect(by.like.endedBy, 'launched late, still in the air').toBe('wave over');
    expect(r.labelReachMs).toEqual({ min: by.Do.reachMs, median: by.Do.reachMs, max: by.Do.reachMs });
    expect(by.you.reachMs).toBeGreaterThan(by.Do.reachMs);
    expect(by.like.reachMs).toBeLessThan(by.Do.reachMs);
    expect(r.labelReach.cutShortBelowMin, "'like' only: 'you' had already had more than the min").toBe(1);
  });

  it('gives the median of an even count as the middle two\'s mean', () => {
    const rc: ReachRecording = { ids: { 1: 'a', 2: 'b', 3: 'c', 4: 'd' }, samples: [], frames: [0, 16],
      ends: Object.fromEntries([1, 2, 3, 4].map(id => [id, { t: 0, hit: false, dead: true, launched: true, relaunches: MAX_RELAUNCHES }])) };
    for (const [id, ms] of [[1, 1000], [2, 2000], [3, 3000], [4, 9000]]) rc.samples.push([0, id, 'x', 400, 0], [ms, id, 'x', 900, MAX_RELAUNCHES]);
    expect(labelReach(rc, opts).labelReachMs).toEqual({ min: 1000, median: 2500, max: 9000 });
  });

  it('a bubble the outcome removed while it waited to rise again has not run out, even on its last relaunch', () => {
    const rc: ReachRecording = { ids: { 1: 'a' }, samples: [[0, 1, 'a', 400, 0], [500, 1, 'a', 900, 0]], frames: [0, 500],
      ends: { 1: { t: 600, hit: false, dead: true, launched: false, relaunches: MAX_RELAUNCHES } } };
    expect(labelReach(rc, opts).labelReach.labels[0].endedBy).toBe('wave over');
    expect(labelReach(rc, opts).labelReachMs).toBeNull();
    expect(labelReach(rc, opts).labelReach.cutShortBelowMin).toBe(1);
  });

  it('refuses to classify without the relaunch limit', () => {
    expect(() => labelReach(newReach(), { H, cardBottom: 0 } as never)).toThrow(/maxRelaunches/);
  });
});

describe('the reach recorder on the real Arena (#2251)', () => {
  it('sees a required label through every relaunch until it runs out, and the outcome ends the rest', () => {
    const sim = createSim({ seed: 7 });
    try {
      sim.spawn({ labels: ['Do', 'you', 'cat', 'dog'], speed: 2, ordered: ['Do', 'you'] });
      const rc = newReach();
      const need = ['Do', 'you'];
      const ended = (label?: string) => Object.entries(rc.ids).filter(([, l]) => !label || l === label).every(([id]) => id in rc.ends) && Object.keys(rc.ids).length === 2;
      for (let n = 0; n < 6000 && !ended('Do'); n++) { sim.frame(); reachStep(rc, sim.now(), sim.all(), sim.arena.frozen, need); }
      expect(ended('Do'), "'Do' ran out within 100 s of game time").toBe(true);
      expect(sim.events.falls.filter(l => l === 'Do'), "the arena's own fall report: once, after its relaunches").toEqual(['Do']);
      sim.arena.reveal({ good: 'Do' });                        // what the session's miss does: freeze, and a ghost of the answer if it is off screen
      for (let n = 0; n < 5; n++) { sim.frame(); reachStep(rc, sim.now(), sim.all(), sim.arena.frozen, need); }   // the page records on after the outcome, until it is read
      expect(ended(), 'every required label has ended').toBe(true);
      const r = labelReach(rc, { H: sim.arena.H, cardBottom: 0, maxRelaunches: MAX_RELAUNCHES });
      const by = Object.fromEntries(r.labelReach.labels.map(l => [l.label, l]));
      expect(sim.all().some(b => b.label === 'Do' && b.hit && b.mark === 'good'), 'the reveal added its ghost of the answer').toBe(true);
      expect(Object.values(rc.ids).sort(), 'decoys and the ghost are not recorded').toEqual(['Do', 'you']);
      expect([by.Do.endedBy, by.Do.flights]).toEqual(['ran out', MAX_RELAUNCHES + 1]);
      expect(['ran out', 'wave over'], 'nothing sliced it').toContain(by.you.endedBy);
      expect(r.labelReachMs!.min).toBeGreaterThan(0);
    } finally { sim.destroy(); }
  });
});

describe('play-pack words, speech and card (#2205, #2214)', () => {
  it('counts words only: numerals, symbols and the ? placeholder are not words', () => {
    expect(countWords('6 + 1 = ?')).toBe(0);
    expect(countWords('29, 31, 33, 35, ?')).toBe(0);
    expect(countWords('Which one is the real word?')).toBe(6);
    expect(countWords('£5 and 50p')).toBe(1);
    expect(countWords("half past 3, or 3 o'clock?")).toBe(4);
    expect(countWords('Spell: foreign')).toBe(2);
    expect(countWords('')).toBe(0);
    expect(countWords(null)).toBe(0);
  });
  it('says auto, tap or none', () => {
    expect(speechMode({ autoplays: true, offered: true })).toBe('auto');
    expect(speechMode({ autoplays: true, offered: false })).toBe('auto');
    expect(speechMode({ autoplays: false, offered: true })).toBe('tap');
    expect(speechMode({ autoplays: false, offered: false })).toBe('none');
  });
  it('gives the card as a share of the screen', () => {
    expect(cardShare({ width: 366, height: 125 }, { width: 390, height: 844 })).toBe(0.14);
    expect(cardShare({ width: 0, height: 125 }, { width: 390, height: 844 })).toBe(0);
  });
});

describe('a pack carries every key its readers cite (#2205, #2214)', () => {
  const view = { width: 390, height: 844 };
  const screen = {
    H, card: { top: 62, bottom: 187, width: 366, height: 125 }, speakVisible: true, prompt: '6 + 1 = ?', answer: '7', hasLives: true,
    hint: 'Tap or slice the answer', slow: false, wide: false, sequence: false, anyOrder: false, visual: null, lives: 3, mode: 'mission',
  };
  const rec: Recorded = {
    screen, samples: fly([{ id: 1, label: '7', launch: 100, vy: -600, g: 250 }, { id: 2, label: '8', launch: 500, vy: -600, g: 250 }], 9000),
    frames: [0, 16, 33], labels: ['7', '8'], promptAt: 50, extra: {},
    speech: { text: 'Adding! 6 plus 1 equals what', at: 60, start: 80, end: 2880, error: null },
  };
  const settings: Record<string, unknown> = { ...resolveGame('y1-add', 'year1').settings };   // what scripts/playtest-pack.mjs passes, so a key the skill cites (#2245: airTime) is the real one
  const m = buildMetrics({ job: { year: 'year1', game: 'y1-add', catalogue: true }, input: 'bubbles', settings, view, seed: 1, rec, shots: [] }) as Record<string, unknown>;
  const path = (o: unknown, p: string) => p.split('.').reduce<unknown>((x, k) => (x as Record<string, unknown> | undefined)?.[k], o);
  const at = (p: string) => path(m, p);
  // #2251: a sequence game's pack, as playBubbles hands it over: the reach recording, and the lives after the miss.
  const reach = flySeq([{ id: 1, label: 'the', launch: 100, vy: -600, g: 250 }], { need: ['the'], until: 30000 });
  const seqRec: Recorded = { ...rec, screen: { ...screen, sequence: true }, reach, extra: { livesAfterLabelsRanOut: 2 } };
  const seq = buildMetrics({ job: { year: 'year2', game: 'y2-sentence', catalogue: true }, input: 'bubbles', settings, view, seed: 1, rec: seqRec, shots: [], maxRelaunches: MAX_RELAUNCHES });

  it('resolves every `metrics.json#…` reference in the playtest skill and its profiles, in a plain pack or a sequence one', () => {
    const texts = [read('.claude/skills/playtest/SKILL.md'), ...['reception', 'year1', 'year2', 'year3', 'year4', 'year5', 'year6', 'parent'].map(p => read(`.claude/agents/playtester-${p}.md`))];
    const refs = [...new Set(texts.flatMap(t => [...t.matchAll(/metrics\.json#([\w.]+[\w])/g)].map(x => x[1])))].filter(r => r !== 'key' && !r.startsWith('<'));
    expect(refs.length, 'the skill cites at least aboveCardMs.min and settings.speeds').toBeGreaterThanOrEqual(2);
    for (const r of refs) expect(at(r) ?? path(seq, r), `metrics.json#${r}`).not.toBeUndefined();
  });

  it('carries labelReachMs for a sequence game only, measured by labelReach, and the play flow writes the lives it cites (#2251)', () => {
    expect(seq.labelReachMs).toEqual(labelReach(reach, { H, cardBottom: 187, maxRelaunches: MAX_RELAUNCHES }).labelReachMs);
    expect(path(seq, 'labelReachMs.min')).toBeGreaterThan(0);
    expect(path(seq, 'labelReach.maxRelaunches')).toBe(MAX_RELAUNCHES);
    expect(m, 'a game that is not a sequence has no label reach').not.toHaveProperty('labelReachMs');
    expect(Object.keys(ABOUT)).toEqual(expect.arrayContaining(['labelReachMs', 'labelReach']));
    expect(read('scripts/playtest-play.mjs')).toContain('livesAfterLabelsRanOut: reach.lives');
    expect(read('scripts/playtest-pack.mjs'), 'the page runs the very recorder tested here').toContain('window.__reachStep = ${reachStep};');
    expect(read('scripts/playtest-pack.mjs'), 'and reads the relaunch limit from the game').toContain('MAX_RELAUNCHES: bubbles.MAX_RELAUNCHES');
  });

  it('holds the keys the skill lists in prose, #2214 asks for and the #2205 comment names', () => {
    for (const k of ['settings.lives', 'settings.gentle', 'settings.speeds', 'settings.diffs', 'input', 'prompt', 'promptWords', 'speechOffered',
      'answersPerWave', 'bubbleRadiusPx', 'launchToApexMs', 'aboveCardMs.min', 'slowestBubble', 'fastestBubble', 'cardShareOfScreen', 'slow', 'wide',
      'speech', 'speechAutoplays', 'speechMs']) expect(at(k), k).not.toBeUndefined();
    expect(m.speech).toBe('auto');
    expect(m.speechMs).toBe(2800);
    expect(m.promptWords).toBe(0);
    expect(m.about).toBe(ABOUT);
  });

  it('counts its prompt-relative times from the prompt appearing, and its speech times from the line itself', () => {
    const first = rec.samples![0][0];
    const flights = m.flights as { launchMs: number }[];
    expect(m.speechEndsAfterPromptMs).toBe(2880 - 50);
    expect(m.promptLeadMs).toBe(Math.round(first - 50));
    expect(flights[0].launchMs).toBe(Math.round(first - 50));
    expect(m.afterSpeechMs).toEqual(flightMetrics(rec.samples!, { H, cardBottom: 187, speechEnd: 2880 }).afterSpeechMs);
    expect(m.afterSpeechMs).not.toEqual(m.aboveCardMs);
  });

  it('never lets a play flow\'s own key overwrite a measured one', () => {
    const x = buildMetrics({ job: { year: 'year1', game: 'y1-add', catalogue: true }, input: 'bubbles', settings, view, seed: 1, rec: { ...rec, extra: { aboveCardMs: 'forged', livesStart: 3 } }, shots: [] });
    expect(x.aboveCardMs).toEqual(m.aboveCardMs);
    expect(x.livesStart).toBe(3);
  });

  it('keeps a line the engine never voiced as autoplayed but unmeasured, a cut line as unmeasured, and no line as tap', () => {
    const never = buildMetrics({ job: { year: 'year1', game: 'g', catalogue: true }, input: 'bubbles', settings, view, seed: 1, rec: { ...rec, speech: { text: 't', at: 0, start: null, end: null, error: null } }, shots: [] });
    expect([never.speech, never.speechAutoplays, never.speechStarted, never.speechMs, never.afterSpeechMs]).toEqual(['auto', true, false, null, null]);
    const none = buildMetrics({ job: { year: 'year1', game: 'g', catalogue: true }, input: 'bubbles', settings, view, seed: 1, rec: { ...rec, speech: null }, shots: [] });
    expect([none.speech, none.speechAutoplays]).toEqual(['tap', false]);
    const cut = buildMetrics({ job: { year: 'year1', game: 'g', catalogue: true }, input: 'bubbles', settings, view, seed: 1, rec: { ...rec, speech: { text: 't', at: 0, start: 100, end: null, error: 'interrupted', cut: 1600 } }, shots: [] });
    expect([cut.speech, cut.speechMs, cut.speechFinished, cut.speechCutAfterMs, cut.speechHeardMs, cut.speechOutlastedWave]).toEqual(['auto', null, false, 1500, 1500, false]);
    expect(cut.afterSpeechMs, 'cut while the bubbles were up: the reach after it counts from the cut')
      .toEqual(flightMetrics(rec.samples!, { H, cardBottom: 187, speechEnd: 1600 }).afterSpeechMs);
  });

  // #2223 review: a prompt the voice was still speaking when the whole wave had gone left the child no reach after
  // it. That is a measured 0, never a null a profile reads as "not observed".
  const lastLeave = Math.max(...flightMetrics(rec.samples!, { H, cardBottom: 187 }).bubbles.map(b => b.leaveMs ?? 0));
  const outlasting = (speech: Recorded['speech'], collectedAt?: number) =>
    buildMetrics({ job: { year: 'reception', game: 'g', catalogue: true }, input: 'bubbles', settings, view, seed: 1, rec: { ...rec, speech, collectedAt }, shots: [] });
  it('a prompt cut off only after every bubble had gone outlasted the wave: no reach after it, and how long it was heard', () => {
    const m2 = outlasting({ text: 't', at: 0, start: 20, end: null, error: 'interrupted', cut: lastLeave + 130 });
    expect([m2.speechMs, m2.speechFinished, m2.speechOutlastedWave, m2.speechHeardMs]).toEqual([null, false, true, Math.round(lastLeave + 110)]);
    expect(m2.afterSpeechMs).toEqual({ min: 0, max: 0 });
    for (const f of m2.flights as { afterSpeechMs: number | null }[]) expect(f.afterSpeechMs).toBe(0);
  });
  it('a prompt still playing when the wave was collected outlasted it too, heard for at least that long', () => {
    const m2 = outlasting({ text: 't', at: 0, start: 20, end: null, error: null }, lastLeave + 400);
    expect([m2.speechMs, m2.speechFinished, m2.speechOutlastedWave, m2.speechHeardMs, m2.speechCutAfterMs]).toEqual([null, false, true, Math.round(lastLeave + 380), null]);
    expect(m2.afterSpeechMs).toEqual({ min: 0, max: 0 });
    const done = outlasting(rec.speech);
    expect([done.speechFinished, done.speechOutlastedWave, done.speechHeardMs]).toEqual([true, false, done.speechMs]);
  });

  it('leaves the bubble keys out of a pack with no bubbles, rather than writing a number nobody measured', () => {
    const trace = buildMetrics({ job: { year: 'year1', game: 'y1-trace', catalogue: true }, input: 'tracing', settings, view, seed: 1, rec, shots: [] });
    for (const k of ['aboveCardMs', 'launchToApexMs', 'answersPerWave', 'bubbleRadiusPx']) expect(trace, k).not.toHaveProperty(k);
  });
});

describe('which packs a run makes (#2205)', () => {
  it('one per catalogue game and year node, plus the keypad screen', () => {
    const nodes = Object.values(CATALOGUE.games).reduce((n, g) => n + Object.keys(g.years).length, 0);
    expect(plannedPacks(CATALOGUE)).toHaveLength(nodes + KEYPAD_PACKS.length);
    expect(plannedPacks(RUNTIME), 'the script reads the runtime copy; it plans the same packs').toEqual(plannedPacks(CATALOGUE));
  });
  it('filters by --year and --only', () => {
    expect(plannedPacks(CATALOGUE, { year: 'reception' }).every(p => p.year === 'reception')).toBe(true);
    expect(plannedPacks(CATALOGUE, { only: ['y1-add', 'mtcpad'] }).map(p => p.game)).toEqual(['y1-add', 'mtcpad']);
  });
  it('packs the keypad through the menu row that opens it', () => {
    for (const k of KEYPAD_PACKS) {
      expect(read('src/ui/home.ts'), `${k.game} is a menu row id`).toContain(`id: '${k.game}'`);
      expect(CATALOGUE.games, 'a keypad pack is not a catalogue game').not.toHaveProperty(k.game);
    }
  });
  it('reads its arguments', () => {
    expect(parseArgs(['http://x/', 'out'])).toEqual({ base: 'http://x/', out: 'out', year: null, only: null });
    expect(parseArgs(['http://x/', 'out', '--year', 'year2', '--only', 'a,b'])).toMatchObject({ year: 'year2', only: ['a', 'b'] });
  });
});

describe('how the pack script runs (#2205)', () => {
  it('is run by `npm run playtest:pack`, which builds, previews on its own port and runs the script', () => {
    const cmd = JSON.parse(read('package.json')).scripts['playtest:pack'] as string;
    expect(cmd).toContain('npm run build');
    expect(cmd).toContain('vite preview');
    expect(cmd).toContain('node scripts/playtest-pack.mjs');
    for (const port of [':4398', ':4399']) expect(cmd, 'game:shots and site:shots have these').not.toContain(port);
  });
  it('keeps the real clock: no speed-up, no fixed time, no setSpeed', () => {
    const src = read('scripts/playtest-pack.mjs') + read('scripts/playtest-play.mjs');
    for (const fake of ['__SNA_FAST', 'setFixedTime', 'setSpeed(', 'clock.install']) expect(src, fake).not.toContain(fake);
  });
  it('git-ignores playtest-packs/ and commits no file under it', () => {
    expect(execFileSync('git', ['ls-files', 'playtest-packs'], { cwd: root, encoding: 'utf8' }).trim()).toBe('');
    expect(() => execFileSync('git', ['check-ignore', '-q', 'playtest-packs/year1/y1-add/metrics.json'], { cwd: root }), 'playtest-packs/ is not ignored').not.toThrow();
  });
});
