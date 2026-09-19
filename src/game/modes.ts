// One table describing every play mode, so adding or tuning a mode is a single entry here instead of
// ~12 `o.mode === 'endless' ? … : sprint ? …` chains scattered across session.ts, play.ts and home.ts (#26).
// Session reads the behaviour (difficulty/speed/points/stars/coins/lives); the UI reads the labels.
import type { Difficulty, YearInfo } from '../curriculum';

export type Mode = 'mission' | 'endless' | 'sprint' | 'boss';

/** Live state a mode needs while a question is on screen. */
export interface ModeCtx {
  year: YearInfo;
  stage: number;            // 1-based mission stage (1 for continuous modes)
  questionsAsked: number;
  sequence: boolean;        // the current question is a spelling/sentence sequence (a touch slower)
  slow: boolean;            // the current question is flagged `slow` by its generator — several mental steps (#297)
  enraged: boolean;         // boss on its last 3 HP
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
}

export interface ModeSpec {
  id: Mode;
  title: string;            // play-screen title (mission's is the topic/training name, set by the UI)
  overHeadingWon: string;   // results heading when the run is won
  overHeadingLost: string;  // results heading when the run is lost
  hasLives: boolean;        // false = a slip costs no life (Ninja Sprint)
  staged: boolean;          // true = five staged waves (mission); false = one continuous run
  timed: boolean;           // Ninja Sprint clock
  boss: boolean;            // Boss Battle HP bar
  villain: boolean;         // Hammer Man on screen + TNT bubbles in the mix
  difficulty(c: ModeCtx): Difficulty;
  speed(c: ModeCtx): number;
  basePoints(c: ModeCtx): number;   // points for a correct slice, before the combo bonus
  stars(c: EndCtx): number;         // end-of-run stars
  coins(c: EndCtx): number;         // ninja coins earned
}

// A question that is worked out in steps rather than recalled gets one speed step, floored at 1: a spelling
// sequence (slice several letters in order) or one a generator flagged `slow` — Year 2's two-digit arithmetic
// that crosses a ten (#297). One helper so the two flags always ease by the same amount, in every mode that
// eases at all. Sky Storm is not one of them: its speed ramps on questions answered rather than on the year,
// and it clamps for `gentle` years instead — `sequence` has never eased there either.
const eased = (c: ModeCtx, s: number) => c.sequence || c.slow ? Math.max(1, s - 1) : s;

// Endless and Boss share the same "ramp on questions answered" points curve.
const rampPoints = (c: ModeCtx) => 10 + Math.min(20, Math.floor(c.questionsAsked / 5) * 5);
// Base coins earned every mode: 1 per correct answer + 5 per mission stage star.
const baseCoins = (c: EndCtx) => c.correct + c.stageStarsTotal * 5;

export const MODES: Record<Mode, ModeSpec> = {
  mission: {
    id: 'mission', title: 'Mission', overHeadingWon: 'Mission complete!', overHeadingLost: 'Out of lives',
    hasLives: true, staged: true, timed: false, boss: false, villain: false,
    difficulty: c => c.year.diffs[Math.min(c.stage, c.year.diffs.length) - 1] ?? 3,
    speed: c => eased(c, c.year.speeds[Math.min(c.stage, c.year.speeds.length) - 1] ?? 3),
    basePoints: c => 10 * c.stage,
    stars: c => c.won ? Math.max(1, Math.round(c.stageStarsTotal / c.stages)) : 0,
    coins: c => baseCoins(c) + (c.won ? 20 : 0),
  },
  endless: {
    id: 'endless', title: 'Sky Storm', overHeadingWon: 'Storm over!', overHeadingLost: 'Storm over!',
    hasLives: true, staged: false, timed: false, boss: false, villain: true,
    difficulty: c => c.questionsAsked < 8 ? 1 : c.questionsAsked < 20 ? 2 : 3,
    speed: c => { const s = c.questionsAsked < 10 ? 1 : c.questionsAsked < 25 ? 2 : 3; return c.year.gentle ? Math.min(2, s) : s; },
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
    stars: c => c.correct >= 12 ? 3 : c.correct >= 6 ? 2 : c.correct >= 1 ? 1 : 0,
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
};

export const modeSpec = (m: Mode): ModeSpec => MODES[m];
