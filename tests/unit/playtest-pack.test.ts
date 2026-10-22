import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { CATALOGUE } from './helpers/catalogue-file';
import { RUNTIME } from '../../src/config/resolve';
import {
  ABOUT, FRAME_CLAMP_MS, KEYPAD_PACKS, buildMetrics, cardShare, countWords, flightMetrics, frameStats,
  parseArgs, plannedPacks, speechMode, type Recorded, type Sample,
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
  const settings = { lives: 3, gentle: false, speeds: [1, 2], diffs: [1, 2], airTime: [7.5, 5.6, 4.4, 3.4] };   // the resolved settings carry airTime (#2245 cites it)
  const m = buildMetrics({ job: { year: 'year1', game: 'y1-add', catalogue: true }, input: 'bubbles', settings, view, seed: 1, rec, shots: [] }) as Record<string, unknown>;
  const at = (path: string) => path.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], m);

  it('resolves every `metrics.json#…` reference in the playtest skill and its profiles', () => {
    const texts = [read('.claude/skills/playtest/SKILL.md'), ...['reception', 'year1', 'year2', 'year3', 'year4', 'year5', 'year6', 'parent'].map(p => read(`.claude/agents/playtester-${p}.md`))];
    const refs = [...new Set(texts.flatMap(t => [...t.matchAll(/metrics\.json#([\w.]+[\w])/g)].map(x => x[1])))].filter(r => r !== 'key' && !r.startsWith('<'));
    expect(refs.length, 'the skill cites at least aboveCardMs.min and settings.speeds').toBeGreaterThanOrEqual(2);
    for (const r of refs) expect(at(r), `metrics.json#${r}`).not.toBeUndefined();
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
