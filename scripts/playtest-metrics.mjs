// The pure half of the play-pack script (#2205): which packs a run makes, and the numbers a pack's metrics.json
// carries, worked out from what the page recorded. No browser here, so tests/unit/playtest-pack.test.ts runs it on
// a stub arena. The playtest skill (.claude/skills/playtest/SKILL.md §1) is the reader of every key named here.

/** The one game that is not a catalogue topic but a keypad screen: Year 4's Tables Check on the number pad (#1120). */
export const KEYPAD_PACKS = [{ year: 'year4', game: 'mtcpad', catalogue: false }];

/** Every pack a run makes: one per catalogue game and year node, plus the keypad screen, filtered by `--year` and `--only`. */
export function plannedPacks(cat, { year = null, only = null } = {}) {
  const all = [
    ...Object.entries(cat.games).flatMap(([game, g]) => Object.keys(g.years).map(y => ({ year: y, game, catalogue: true }))),
    ...KEYPAD_PACKS,
  ];
  return all.filter(p => (!year || p.year === year) && (!only || only.includes(p.game)));
}

export function parseArgs(argv) {
  const [base, out, ...rest] = argv;
  const flag = name => { const i = rest.indexOf(name); return i >= 0 ? rest[i + 1] ?? '' : null; };
  const only = flag('--only');
  return { base, out, year: flag('--year') || null, only: only === null ? null : only.split(',').filter(Boolean) };
}

/**
 * Words a child has to read, as the skill counts them: a run of letters, apostrophes or hyphens inside, that is
 * not glued to a digit. Numerals, maths symbols, `?`, `£5` and `50p` are read at a glance, so they are not words.
 */
export function countWords(text) {
  if (!text) return 0;
  return String(text).split(/\s+/).filter(t => /^[^\p{L}\p{N}]*\p{L}[\p{L}'’-]*[^\p{L}\p{N}]*$/u.test(t)).length;
}

const ms = v => Math.round(v);
const span = vs => (vs.length ? { min: ms(Math.min(...vs)), max: ms(Math.max(...vs)) } : null);

/**
 * One wave's first flights, from per-frame samples `[t, id, label, y, r, vy]` (CSS px, y down, `t` in ms) of the
 * bubbles still live: the page stops sampling a bubble once it is hit, faded or frozen by the wave's outcome.
 * A bubble is reachable while its centre is inside the play area: below the question card's bottom edge
 * (`cardBottom`) and above the screen's bottom edge (`H`); its reach is the time it spent there. Its first
 * flight ends when it falls back below the screen's edge (`fell`), or, if the wave ended first (the answer fell,
 * or was sliced), at its last live frame (`wave over`). FIRST flight only: a gentle year's relaunch, or a
 * sequence letter sent back up, is a second chance, not a slower bubble. With `speechEnd`, each bubble's reach is
 * also counted from the moment the spoken prompt ended: the Reception floor counts from there.
 */
export function flightMetrics(samples, { H, cardBottom, answer = null, speechEnd = null }) {
  const byId = new Map();
  for (const [t, id, label, y, r, vy] of samples) {
    if (!byId.has(id)) byId.set(id, { id, label, r, pts: [] });
    byId.get(id).pts.push({ t, y, vy });
  }
  const inside = p => p.y < H && p.y > cardBottom;
  /** Time inside the play area, from `from` on: each frame interval counts when it starts inside. */
  const timeInside = (pts, from) => {
    let sum = 0;
    for (let i = 0; i + 1 < pts.length; i++) if (inside(pts[i])) sum += Math.max(0, pts[i + 1].t - Math.max(pts[i].t, from));
    return sum;
  };
  const bubbles = [...byId.values()].map(b => {
    const all = b.pts.sort((p, q) => p.t - q.t);
    const enter = all.findIndex(inside);
    const fell = enter < 0 ? -1 : all.findIndex((p, i) => i > enter && p.vy > 0 && p.y >= H);   // back below the edge after rising into view
    const pts = fell < 0 ? all : all.slice(0, fell + 1);
    const top = pts.reduce((m, p) => (p.y < m.y ? p : m));                                         // the lowest y, not the first vy >= 0: a collision can flip vy mid-rise
    const peaked = top !== pts[pts.length - 1];
    return {
      id: b.id, label: b.label, r: b.r, launchMs: pts[0].t, apexMs: peaked ? top.t : null, apexY: peaked ? Math.round(top.y) : null,
      enterMs: enter < 0 ? null : pts[enter].t, leaveMs: enter < 0 ? null : pts[pts.length - 1].t, reachMs: enter < 0 ? null : timeInside(pts, -Infinity),
      afterSpeechMs: enter < 0 || speechEnd === null ? null : timeInside(pts, speechEnd),
      endedBy: fell >= 0 ? 'fell' : 'wave over', entrySpeedPxS: enter < 0 ? null : Math.round(Math.abs(pts[enter].vy)),
    };
  });
  const full = bubbles.filter(b => b.enterMs !== null && b.endedBy === 'fell');   // a flight cut short by the wave ending is not a bubble's own time
  const pick = better => full.reduce((m, b) => (m === null || better(b.reachMs, m.reachMs) ? b : m), null);
  const brief = b => b && { label: b.label, aboveCardMs: ms(b.reachMs), entrySpeedPxS: b.entrySpeedPxS };
  const right = bubbles.find(b => b.label === answer && b.enterMs !== null);
  return {
    bubbles,
    launched: bubbles.length,
    bubbleRadiusPx: bubbles.length ? Math.round(Math.max(...bubbles.map(b => b.r))) : null,
    launchToApexMs: span(bubbles.filter(b => b.apexMs !== null).map(b => b.apexMs - b.launchMs)),
    aboveCardMs: span(full.map(b => b.reachMs)),
    answerAboveCardMs: right ? ms(right.reachMs) : null,
    afterSpeechMs: speechEnd === null ? null : span(full.map(b => b.afterSpeechMs)),
    slowestBubble: brief(pick((a, b) => a > b)),
    fastestBubble: brief(pick((a, b) => a < b)),
  };
}

/** The longest gap between frames while a wave was timed. Over 100 ms the arena clamps its step (arena.ts), so the flight ran slow. */
export const FRAME_CLAMP_MS = 100;
export function frameStats(times) {
  let maxGap = 0;
  for (let i = 1; i < times.length; i++) maxGap = Math.max(maxGap, times[i] - times[i - 1]);
  return { count: times.length, maxGapMs: ms(maxGap), clean: maxGap <= FRAME_CLAMP_MS };
}

/** `auto` when the game spoke the prompt by itself, `tap` when only the speaker button would, `none` with neither. */
export const speechMode = ({ autoplays, offered }) => (autoplays ? 'auto' : offered ? 'tap' : 'none');

/** The question card's area as a share of the screen's, to two places. */
export const cardShare = (rect, view) => Math.round((Math.max(0, rect.width) * Math.max(0, rect.height)) / (view.width * view.height) * 100) / 100;

const round = v => (v === null || v === undefined ? null : Math.round(v));
/** When the spoken line ended, if it was spoken to its end: started, ended, and not cut off. */
const heardEnd = sp => (sp && sp.start !== null && sp.end !== null && !sp.error ? sp.end : null);

/**
 * The spoken prompt. `speechAutoplays`: the game called speak() for it by itself, before any tap. `speechStarted`:
 * the speech engine really began it; with no voice (a headless Linux browser) it never does, and then every
 * duration is null, not a number nobody heard.
 */
function speechKeys(sp, offered, promptAt) {
  const autoplays = !!sp;
  const heard = heardEnd(sp) !== null;
  return {
    speech: speechMode({ autoplays, offered }), speechOffered: offered, speechAutoplays: autoplays, speechStarted: autoplays && sp.start !== null,
    speechText: sp?.text ?? null, speechMs: heard ? round(sp.end - sp.start) : null,
    speechEndsAfterPromptMs: heard && promptAt !== null ? round(sp.end - promptAt) : null,
    speechVoice: sp?.voice ?? null, speechError: sp?.error ?? null,
    speechCutAfterMs: autoplays && sp.error && sp.cut && sp.start !== null ? round(sp.cut - sp.start) : null,
  };
}

/** The first wave's timing; every time in `flights` counts from the prompt appearing. */
function flightKeys(p, sp) {
  const f = flightMetrics(p.samples, { H: p.screen.H, cardBottom: p.screen.card?.bottom ?? 0, answer: p.screen.answer, speechEnd: heardEnd(sp) });
  const firstLaunch = f.bubbles.length ? Math.min(...f.bubbles.map(b => b.launchMs)) : null;
  const rel = v => (v === null || p.promptAt === null ? null : Math.round(v - p.promptAt));
  return {
    answersPerWave: p.labels.length, bubbleLabels: p.labels, launchedBeforeWaveEnded: f.launched,
    bubbleWords: p.labels.reduce((n, l) => n + countWords(l), 0), bubbleRadiusPx: f.bubbleRadiusPx,
    promptLeadMs: firstLaunch === null ? null : rel(firstLaunch),
    launchToApexMs: f.launchToApexMs, aboveCardMs: f.aboveCardMs, answerAboveCardMs: f.answerAboveCardMs,
    afterSpeechMs: f.afterSpeechMs,
    slowestBubble: f.slowestBubble, fastestBubble: f.fastestBubble,
    flights: f.bubbles.map(b => ({ label: b.label, launchMs: rel(b.launchMs), enterMs: rel(b.enterMs), apexMs: rel(b.apexMs), leaveMs: rel(b.leaveMs), reachMs: round(b.reachMs), afterSpeechMs: round(b.afterSpeechMs), endedBy: b.endedBy })),
    frames: frameStats(p.frames),
  };
}

/** What each timing key means, written into every pack so a profile reads the definition beside the number. */
export const ABOUT = {
  aboveCardMs: "over the first-wave bubbles that fell out of reach on their first flight: the time each one's centre spent below the question card and above the screen's bottom edge",
  answerAboveCardMs: 'the same, for the right answer\'s bubble',
  launchToApexMs: 'from the frame a bubble launched to the top of its arc',
  afterSpeechMs: 'over the same bubbles: how much of each one\'s reachable time came after the spoken prompt ended',
  speechAutoplays: 'the game spoke the prompt by itself; speechStarted says the voice really began it, and only then are speech times measured',
  promptLeadMs: 'from the prompt appearing to the first bubble launching; near 0 means the wave rose with the prompt',
  flights: "per bubble, in ms from the prompt appearing; endedBy 'wave over' means the wave ended (the answer fell) while it was still in reach",
  speechCutAfterMs: "when the game's next line cut the spoken prompt off (speechError), how long it had played; a cut just after the answer fell (flights[].leaveMs) means the prompt was still being spoken when the wave ended",
  frames: 'the longest gap between frames while the wave was timed; over 100 ms the arena slows its step, so the times ran long',
  promptWords: 'words only: numerals, symbols and the ? placeholder are read at a glance',
  demoShown: "the animated first-ever-play demo is skipped: the pack plays as a child who has played any game before",
};

/**
 * A pack's metrics.json: every key the skill reads, plus what a profile needs to check them, the shots in play
 * order with what each shows, and `about`, the definitions. `rec` is what the play flow recorded (`screen`, the
 * first wave's `samples`/`frames`/`labels`, `promptAt`, the first spoken line, and `extra` keys of its own).
 */
export function buildMetrics({ job, input, settings, view, seed, rec: p, shots }) {
  const { screen } = p;
  return {
    ...p.extra,                                       // first, so a play flow's own key can never overwrite a measured one
    year: job.year, game: job.game, catalogue: job.catalogue, viewport: `${view.width}x${view.height}`, seed,
    input, mode: screen.mode, hasLives: screen.hasLives, settings,
    prompt: screen.prompt, promptWords: countWords(screen.prompt), hint: screen.hint, hintWords: countWords(screen.hint),
    ...speechKeys(p.speech, screen.speakVisible, p.promptAt), speechVoices: p.voices ?? null,
    ...(input === 'bubbles' ? flightKeys(p, p.speech) : {}),
    cardShareOfScreen: screen.card ? cardShare(screen.card, view) : null, cardBottomPx: screen.card ? Math.round(screen.card.bottom) : null,
    slow: screen.slow, wide: screen.wide, sequence: screen.sequence, anyOrder: screen.anyOrder, visual: screen.visual,
    demoShown: false,
    shots,
    about: ABOUT,
  };
}
