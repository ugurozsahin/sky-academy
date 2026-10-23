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

/**
 * One frame of a sequence wave's reach recording (#2251). Self-contained, because the pack's page runs this very
 * function (scripts/playtest-pack.mjs injects its source) and tests/unit runs it on the real Arena. `need` is the
 * question's required labels. Each required bubble is sampled `[t, id, label, y, relaunches]` while it is launched
 * and unresolved, and its end is noted on the first frame it is hit, dead, faded or frozen by the outcome. A bubble
 * first seen already resolved is skipped: `Arena.reveal` adds the missed answer as a ghost bubble born hit.
 */
export function reachStep(rc, t, bubbles, frozen, need) {
  rc.frames.push(t);
  for (const b of bubbles) {
    if (!need.includes(b.label) || b.id in rc.ends) continue;
    const over = b.hit || b.dead || b.fade || frozen;
    if (over && !(b.id in rc.ids)) continue;        // born resolved: the outcome's ghost of the right answer, never a target
    rc.ids[b.id] = b.label;
    if (over) rc.ends[b.id] = { t, hit: b.hit, dead: b.dead, launched: b.launched, relaunches: b.relaunches };
    else if (b.launched) rc.samples.push([t, b.id, b.label, b.y, b.relaunches]);
  }
}
export const newReach = () => ({ on: false, ids: {}, ends: {}, samples: [], frames: [] });

/**
 * One frame of the question-line recording (#2250). Self-contained, for the same reason as `reachStep`: the pack's
 * page runs this very function. `asked` is the session's `questionsAsked`; `st` is `window.__sna.state()`, whose
 * `prompt` is the question's own line, shown or hidden; `q` is the question itself (`session.current`). Its `listen`
 * line is what a device with no voice shows instead (promptHTML in src/ui/hud.ts). A plain sequence question (a
 * `sequence` with no `build` and no `anyOrder`) never puts its line on the card at all: promptHTML draws only the
 * slots, so the child only hears it (#2265). A row `[asked, stage, prompt, listen, shown]` is kept each time the
 * question or its line changes; an empty line (no question yet, or the session over) is skipped.
 */
export function promptStep(rows, asked, st, q) {
  if (!st?.prompt || asked < 1) return;
  const last = rows[rows.length - 1];
  if (last && last[0] === asked && last[2] === st.prompt) return;
  rows.push([asked, st.stage, st.prompt, !!q?.listen, !(q?.sequence && !q.build && !q.anyOrder)]);
}

/**
 * Whether the question line is the same on every question of the stage the pack played (#2250): the first row's
 * stage, read from the game's state per question, never from a screenshot, because a plain sequence card never
 * shows the line (#2265). A line that changed within a question is not fixed. Nor is one the pack cannot vouch was
 * shown: with no voice (`voiced` false), a question with a `listen` line put that, or its answer, on the card
 * instead, so a fixed `prompt` says nothing about what the child read. `promptShown` (#2265) says whether the card
 * carried a line on any question of that stage: `false` when every one was a plain sequence, voice or not. Its
 * card draws only the slots, or with no voice the answer's letters, never the line, so its words are never read.
 * Fewer than two questions read is no comparison, so the pack fails rather than write a value nobody observed.
 */
export function promptKeys(rows, { voiced = true } = {}) {
  const stage = rows[0]?.[1];
  const own = rows.filter(r => r[1] === stage);
  const waves = new Set(own.map(r => r[0])).size;
  if (waves < 2) throw new Error(`promptFixed needs the question line of two questions in one stage; ${waves} read`);
  return {
    promptFixed: own.every(r => r[2] === own[0][2]) && (voiced || !own.some(r => r[3])), promptWaves: waves,
    promptShown: own.some(r => r[4]),
  };
}

/**
 * How a required bubble's reach ended: `sliced`; `ran out`, when it fell on its last flight (launched, dead, unhit,
 * every relaunch used); or `wave over`, when the outcome froze or cleared it first, or recording stopped first.
 */
const reachEnd = (e, maxRelaunches) => (!e ? 'wave over' : e.hit ? 'sliced' : e.dead && e.launched && e.relaunches >= maxRelaunches ? 'ran out' : 'wave over');
const median = vs => { const s = [...vs].sort((a, b) => a - b), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

/**
 * A sequence game's reach (#2251, the product owner's option 2): for each required bubble, its total time inside
 * the play area (below `cardBottom`, above `H`) over its first flight and every relaunch, until it was sliced or
 * its relaunches ran out. `labelReachMs` is the min, median and max over the bubbles that ended either way. One
 * the question's end cut short (`wave over`) is listed for information only: the pack's own miss ended it, so its
 * reach so far says nothing about the game, as `aboveCardMs` keeps a cut flight out.
 */
export function labelReach(rc, { H, cardBottom, maxRelaunches }) {
  if (!Number.isInteger(maxRelaunches)) throw new Error('labelReach needs maxRelaunches, from src/game/bubbles.ts');
  const inside = y => y < H && y > cardBottom;
  const byId = new Map(Object.keys(rc.ids).map(id => [Number(id), []]));
  for (const s of rc.samples) byId.get(s[1])?.push(s);
  const labels = [...byId].map(([id, pts]) => {
    pts.sort((p, q) => p[0] - q[0]);
    const end = rc.ends[id];
    let sum = 0;                                     // each frame interval counts when it starts inside; the last one runs to the end frame
    for (let i = 0; i < pts.length; i++) {
      const next = i + 1 < pts.length ? pts[i + 1][0] : end?.t;
      if (next !== undefined && inside(pts[i][3])) sum += Math.max(0, next - pts[i][0]);
    }
    return { label: rc.ids[id], reachMs: ms(sum), flights: pts.length ? 1 + Math.max(...pts.map(p => p[4])) : 0, endedBy: reachEnd(end, maxRelaunches) };
  });
  const ended = labels.filter(l => l.endedBy !== 'wave over').map(l => l.reachMs);
  const stats = ended.length ? { min: Math.min(...ended), median: ms(median(ended)), max: Math.max(...ended) } : null;
  return { labelReachMs: stats, labelReach: { maxRelaunches, labels, frames: frameStats(rc.frames) } };
}

/** `auto` when the game spoke the prompt by itself, `tap` when only the speaker button would, `none` with neither. */
export const speechMode = ({ autoplays, offered }) => (autoplays ? 'auto' : offered ? 'tap' : 'none');

/** The question card's area as a share of the screen's, to two places. */
export const cardShare = (rect, view) => Math.round((Math.max(0, rect.width) * Math.max(0, rect.height)) / (view.width * view.height) * 100) / 100;

const round = v => (v === null || v === undefined ? null : Math.round(v));
/** When the spoken line ended, if it was spoken to its end: started, ended, and not cut off. */
const heardEnd = sp => (sp && sp.start !== null && sp.end !== null && !sp.error ? sp.end : null);
/**
 * When the voice stopped speaking the line, whether or not it finished: its end, the moment the game's next line
 * cut it off, or, still speaking when the pack was collected, that moment (`collectedAt`), the most that is known.
 * Null when the voice never began it.
 */
const stoppedAt = (sp, collectedAt) => (!sp || sp.start === null ? null : heardEnd(sp) ?? (sp.error ? sp.cut ?? null : collectedAt ?? null));

/**
 * The spoken prompt. `speechAutoplays`: the game called speak() for it by itself, before any tap. `speechStarted`:
 * the speech engine really began it; with no voice (a headless Linux browser) it never does, and then every
 * duration is null, not a number nobody heard.
 */
function speechKeys(sp, offered, promptAt, collectedAt) {
  const autoplays = !!sp;
  const heard = heardEnd(sp) !== null, stop = stoppedAt(sp, collectedAt);
  return {
    speech: speechMode({ autoplays, offered }), speechOffered: offered, speechAutoplays: autoplays, speechStarted: autoplays && sp.start !== null,
    speechText: sp?.text ?? null, speechMs: heard ? round(sp.end - sp.start) : null,
    speechFinished: heard, speechHeardMs: stop === null ? null : round(stop - sp.start),
    speechEndsAfterPromptMs: heard && promptAt !== null ? round(sp.end - promptAt) : null,
    speechVoice: sp?.voice ?? null, speechError: sp?.error ?? null,
    speechCutAfterMs: autoplays && sp.error && sp.cut && sp.start !== null ? round(sp.cut - sp.start) : null,
  };
}

/** The first wave's timing; every time in `flights` counts from the prompt appearing. */
function flightKeys(p, sp) {
  // The reach after speech counts from when the voice stopped: a line that outlasted the wave leaves 0, not "not measured".
  const stop = stoppedAt(sp, p.collectedAt);
  const f = flightMetrics(p.samples, { H: p.screen.H, cardBottom: p.screen.card?.bottom ?? 0, answer: p.screen.answer, speechEnd: stop });
  const lastLeave = f.bubbles.reduce((m, b) => (b.leaveMs === null ? m : Math.max(m, b.leaveMs)), -Infinity);
  const firstLaunch = f.bubbles.length ? Math.min(...f.bubbles.map(b => b.launchMs)) : null;
  const rel = v => (v === null || p.promptAt === null ? null : Math.round(v - p.promptAt));
  return {
    answersPerWave: p.labels.length, bubbleLabels: p.labels, launchedBeforeWaveEnded: f.launched,
    bubbleWords: p.labels.reduce((n, l) => n + countWords(l), 0), bubbleRadiusPx: f.bubbleRadiusPx,
    promptLeadMs: firstLaunch === null ? null : rel(firstLaunch),
    launchToApexMs: f.launchToApexMs, aboveCardMs: f.aboveCardMs, answerAboveCardMs: f.answerAboveCardMs,
    afterSpeechMs: f.afterSpeechMs,
    speechOutlastedWave: stop !== null && heardEnd(sp) === null && lastLeave > -Infinity && stop >= lastLeave,
    slowestBubble: f.slowestBubble, fastestBubble: f.fastestBubble,
    flights: f.bubbles.map(b => ({ label: b.label, launchMs: rel(b.launchMs), enterMs: rel(b.enterMs), apexMs: rel(b.apexMs), leaveMs: rel(b.leaveMs), reachMs: round(b.reachMs), afterSpeechMs: round(b.afterSpeechMs), endedBy: b.endedBy })),
    frames: frameStats(p.frames),
  };
}

/** A sequence game's reach keys (#2251). A sequence pack with no label that ran out or was sliced has no reach to score: it fails, never a silent null. */
function reachKeys(p, maxRelaunches) {
  if (!p.screen.sequence) return {};
  const r = p.reach ? labelReach(p.reach, { H: p.screen.H, cardBottom: p.screen.card?.bottom ?? 0, maxRelaunches }) : null;
  if (!r?.labelReachMs) throw new Error('a sequence game with no required label that ran out or was sliced: labelReachMs would be empty');
  return r;
}

/** What each timing key means, written into every pack so a profile reads the definition beside the number. */
export const ABOUT = {
  aboveCardMs: "over the first-wave bubbles that fell out of reach on their first flight: the time each one's centre spent below the question card and above the screen's bottom edge",
  answerAboveCardMs: 'the same, for the right answer\'s bubble',
  launchToApexMs: 'from the frame a bubble launched to the top of its arc',
  afterSpeechMs: 'over the same bubbles: how much of each one\'s reachable time came after the voice stopped speaking the prompt; 0 when the prompt outlasted the wave',
  speechAutoplays: 'the game spoke the prompt by itself; speechStarted says the voice really began it, and only then are speech times measured',
  speechMs: 'the spoken prompt\'s length, when it was spoken to its end (speechFinished); null when it was cut off or still playing',
  speechHeardMs: 'how long the voice spoke the prompt: to its end, to the moment the next line cut it off, or, still speaking when the pack was taken, at least this long',
  speechOutlastedWave: 'the prompt was still being spoken when every first-wave bubble had gone: the child had no reach at all after hearing it',
  promptLeadMs: 'from the prompt appearing to the first bubble launching; near 0 means the wave rose with the prompt',
  flights: "per bubble, in ms from the prompt appearing; endedBy 'wave over' means the wave ended (the answer fell) while it was still in reach",
  speechCutAfterMs: "when the game's next line cut the spoken prompt off (speechError), how long it had played; a cut just after the answer fell (flights[].leaveMs) means the prompt was still being spoken when the wave ended",
  frames: 'the longest gap between frames while the wave was timed; over 100 ms the arena slows its step, so the times ran long',
  promptWords: 'words only: numerals, symbols and the ? placeholder are read at a glance. They are the line\'s words whether or not the card shows it (promptShown)',
  promptFixed: "the question line was the same text on every question of the stage the pack played, read from the game's state (window.__sna.state().prompt) for each question, not from a screenshot: a plain sequence card never shows the line (promptShown). Always false when the voice never started and a question had a listen line, which a voiceless device shows instead",
  promptWaves: 'how many questions of that stage promptFixed compared',
  promptShown: "the card showed the question line on at least one question of that stage. False when every question was a plain sequence (a sequence with no build and no anyOrder), whether or not the voice spoke: its card draws only the slots, or with no voice the answer's letters, never the line, so the line's words are never read. With no voice (speechStarted false) the child then neither hears nor reads the line",
  demoShown: "the animated first-ever-play demo is skipped: the pack plays as a child who has played any game before",
  labelReachMs: "sequence games only: over the first question's required labels, each one's total time below the question card and above the screen's bottom edge, across its first flight and its relaunches, until it was sliced or its relaunches ran out. The pack slices none of them while timing, so each one's whole chance is measured; a label the wave cut short is left out",
  labelReach: "per required label: its reachMs, how many flights it had, and endedBy: 'ran out' (it fell on its last flight), 'sliced', or 'wave over' (the pack's own miss decided the question first: information only, never the reach); frames is the longest frame gap while it was timed",
};

/**
 * A pack's metrics.json: every key the skill reads, plus what a profile needs to check them, the shots in play
 * order with what each shows, and `about`, the definitions. `rec` is what the play flow recorded (`screen`, the
 * first wave's `samples`/`frames`/`labels`, `promptAt`, the first spoken line, and `extra` keys of its own), every
 * question's `lines` (#2250), and for a sequence game `reach`, the first question's reach recording (#2251), read
 * with `maxRelaunches`.
 */
export function buildMetrics({ job, input, settings, view, seed, rec: p, shots, maxRelaunches }) {
  const { screen } = p;
  return {
    ...p.extra,                                       // first, so a play flow's own key can never overwrite a measured one
    year: job.year, game: job.game, catalogue: job.catalogue, viewport: `${view.width}x${view.height}`, seed,
    input, mode: screen.mode, hasLives: screen.hasLives, settings,
    prompt: screen.prompt, promptWords: countWords(screen.prompt), ...promptKeys(p.lines ?? [], { voiced: !!p.speech && p.speech.start !== null }), hint: screen.hint, hintWords: countWords(screen.hint),
    ...speechKeys(p.speech, screen.speakVisible, p.promptAt, p.collectedAt), speechVoices: p.voices ?? null,
    ...(input === 'bubbles' ? flightKeys(p, p.speech) : {}),
    ...(input === 'bubbles' ? reachKeys(p, maxRelaunches) : {}),
    cardShareOfScreen: screen.card ? cardShare(screen.card, view) : null, cardBottomPx: screen.card ? Math.round(screen.card.bottom) : null,
    slow: screen.slow, wide: screen.wide, sequence: screen.sequence, anyOrder: screen.anyOrder, visual: screen.visual,
    demoShown: false,
    shots,
    about: ABOUT,
  };
}
