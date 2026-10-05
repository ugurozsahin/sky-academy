// One table describing every play mode, so adding or tuning a mode is a single entry here instead of
// ~12 `o.mode === 'endless' ? … : sprint ? …` chains scattered across session.ts, play.ts and home.ts (#26).
// Session reads the behaviour (difficulty/speed/points/stars/coins/lives); the UI reads the labels.
import type { Difficulty, YearInfo } from '../curriculum';

export type Mode = 'mission' | 'endless' | 'sprint' | 'boss' | 'relaxed';

/** Live state a mode needs while a question is on screen. */
export interface ModeCtx {
  year: YearInfo;
  stage: number;            // 1-based mission stage (1 for continuous modes)
  questionsAsked: number;
  sequence: boolean;        // the current question is a spelling/sentence sequence (a touch slower)
  slow: boolean;            // the current question is flagged `slow` by its generator — several mental steps (#297)
  slower: boolean;          // the child's own "Slower bubbles" accessibility setting is on (#905)
  enraged: boolean;         // boss on its last 3 HP
  legend: boolean;          // a Legend run (#932): the hardest questions from stage 1, one speed step faster
}
/** What a finished run scored — used to award end-stars and coins. */
export interface EndCtx {
  won: boolean;
  score: number;
  correct: number;
  accuracy: number;         // correct / attempts (0 when nothing attempted)
  stageStarsTotal: number;  // sum of mission stage stars (0 for continuous modes)
  stages: number;           // mission stage count
  stars: number;            // the end-stars just computed (coins read it back)
  year: YearInfo;           // Ninja Sprint reads its year-aware star thresholds off this (#700)
}

export interface ModeSpec {
  id: Mode;
  title: string;            // play-screen title (mission's is the topic/training name, set by the UI)
  overHeadingWon: string;   // results heading when the run is won
  overHeadingLost: string;  // results heading when the run is lost
  hasLives: boolean;        // false = a slip costs no life (Ninja Sprint)
  staged: boolean;          // true = five staged waves (mission); false = one continuous run
  timed: boolean;           // Ninja Sprint clock
  questionMs?: number;      // a per-question time limit (#1063); unset = no per-question clock. No mode sets it yet
  runLength?: number;       // an unstaged run that ends once this many questions are asked (Relaxed practice, #937)
  boss: boolean;            // Boss Battle HP bar
  villain: boolean;         // Hammer Man on screen + TNT bubbles in the mix
  difficulty(c: ModeCtx): Difficulty;
  speed(c: ModeCtx): number;
  basePoints(c: ModeCtx): number;   // points for a correct slice, before the combo bonus
  stars(c: EndCtx): number;         // end-of-run stars
  coins(c: EndCtx): number;         // ninja coins earned
}

// A question that is worked out in steps rather than recalled gets one speed step, floored at 1: a spelling
// sequence (slice several letters in order) or one a generator flagged `slow` — the d3 draws of `y2Add`,
// `y2Sub` and `y2Inverse`, all of them, not only the ones that cross a ten (#297; `slowAtD3` in `maths.ts`
// has the measured share, why it is deliberate, and that it is opt-in per generator rather than a rule
// about Year 2 d3). One helper so the two flags always ease by the same amount, in every mode that eases
// at all. Sky Storm is not one of them: its speed ramps on questions answered rather than on the year,
// and it clamps for `gentle` years instead — `sequence` has never eased there either.
// The floor is 1 for Year 1/Year 2, whose slowest table entry is 1 — but Reception's gentle-float 0 (#700)
// is slower still, so a gentle year's floor drops to 0 or a sequence/slow question at Reception's own
// floor would ease to a FASTER flight than the plain question beside it, the opposite of what easing means.
//
// The "Slower bubbles" accessibility setting (#905) is a second, independent step: it always applies (on top
// of a sequence/slow question's own step, never instead of it) and its own floor is 0 in every year, not just
// gentle ones — the setting exists precisely so a non-gentle year can reach Reception's gentle-float speed
// when a child needs it, which a floor of 1 would refuse.
const eased = (c: ModeCtx, s: number) => {
  const out = c.sequence || c.slow ? Math.max(c.year.gentle ? 0 : 1, s - 1) : s;
  return c.slower ? Math.max(0, out - 1) : out;
};
// Sky Storm's own one-step drop for "Slower bubbles" — it never goes through `eased()` (see the comment
// above), so it gets the same floor-0 treatment inline instead.
const slowerStep = (c: ModeCtx, s: number) => c.slower ? Math.max(0, s - 1) : s;

// Endless and Boss share the same "ramp on questions answered" points curve.
const rampPoints = (c: ModeCtx) => 10 + Math.min(20, Math.floor(c.questionsAsked / 5) * 5);
// Base coins earned every mode: 1 per correct answer + 5 per mission stage star.
const baseCoins = (c: EndCtx) => c.correct + c.stageStarsTotal * 5;

export const MODES: Record<Mode, ModeSpec> = {
  mission: {
    id: 'mission', title: 'Mission', overHeadingWon: 'Mission complete!', overHeadingLost: 'Out of lives',
    hasLives: true, staged: true, timed: false, boss: false, villain: false,
    difficulty: c => c.legend ? 3 : c.year.diffs[Math.min(c.stage, c.year.diffs.length) - 1] ?? 3,
    // #932: Legend's step comes before `eased()`'s, so "Slower bubbles" still takes one off the Legend speed; a gentle year gets none (#700).
    speed: c => { const s = c.year.speeds[Math.min(c.stage, c.year.speeds.length) - 1] ?? 3; return eased(c, c.legend && !c.year.gentle ? Math.min(3, s + 1) : s); },
    basePoints: c => 10 * c.stage,
    stars: c => c.won ? Math.max(1, Math.round(c.stageStarsTotal / c.stages)) : 0,
    coins: c => baseCoins(c) + (c.won ? 20 : 0),
  },
  endless: {
    id: 'endless', title: 'Sky Storm', overHeadingWon: 'Storm over!', overHeadingLost: 'Storm over!',
    hasLives: true, staged: false, timed: false, boss: false, villain: true,
    difficulty: c => c.questionsAsked < 8 ? 1 : c.questionsAsked < 20 ? 2 : 3,
    speed: c => { const s = c.questionsAsked < 10 ? 1 : c.questionsAsked < 25 ? 2 : 3; return slowerStep(c, c.year.gentle ? Math.min(2, s) : s); },
    basePoints: rampPoints,
    stars: c => c.score >= 300 ? 3 : c.score >= 150 ? 2 : c.score >= 50 ? 1 : 0,
    coins: c => baseCoins(c) + Math.floor(c.score / 10),
  },
  sprint: {
    id: 'sprint', title: 'Ninja Sprint', overHeadingWon: "Time's up!", overHeadingLost: "Time's up!",
    hasLives: false, staged: false, timed: true, boss: false, villain: false,
    difficulty: c => c.questionsAsked < 5 ? 1 : c.questionsAsked < 12 ? 2 : 3,
    speed: c => eased(c, c.year.speeds[1] ?? 2),   // steady pace: the clock is the pressure
    basePoints: () => 10,
    stars: c => c.correct >= c.year.sprintStars.threeStar ? 3 : c.correct >= c.year.sprintStars.twoStar ? 2 : c.correct >= 1 ? 1 : 0,
    coins: c => baseCoins(c) + c.stars * 5,
  },
  boss: {
    id: 'boss', title: 'Boss Battle', overHeadingWon: 'Knock-out!', overHeadingLost: 'Hammer Man wins this round',
    hasLives: true, staged: false, timed: false, boss: true, villain: true,
    difficulty: c => c.questionsAsked < 4 ? 1 : c.questionsAsked < 9 ? 2 : 3,
    speed: c => eased(c, c.year.speeds[c.enraged ? 2 : 1] ?? 2),
    basePoints: rampPoints,
    stars: c => c.won ? (c.accuracy >= 0.9 ? 3 : c.accuracy >= 0.7 ? 2 : 1) : 0,
    coins: c => baseCoins(c) + (c.won ? 20 : 0) + c.stars * 5,
  },
  // #937: no lives, no clock, no villain — ten questions at the year's gentlest speed, one coin per right answer.
  relaxed: {
    id: 'relaxed', title: 'Relaxed practice', overHeadingWon: 'Practice done!', overHeadingLost: 'Practice done!',
    hasLives: false, staged: false, timed: false, boss: false, villain: false, runLength: 10,
    difficulty: c => c.questionsAsked < 5 ? 1 : c.questionsAsked < 12 ? 2 : 3,   // Sprint's ramp
    speed: c => eased(c, c.year.speeds[0] ?? 1),
    basePoints: () => 10,
    stars: () => 0,
    coins: c => c.correct,
  },
};

export const modeSpec = (m: Mode): ModeSpec => MODES[m];
