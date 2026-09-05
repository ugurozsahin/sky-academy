// Shared question model for every subject. Generators are pure: (difficulty, rng) => Question.
export type Rng = () => number; // [0,1)

export type Visual =
  | { type: 'objects'; emoji: string; n: number; n2?: number; emoji2?: string } // groups of objects
  | { type: 'tenframe'; n: number; n2?: number }         // ten-frame with n filled (n2 = second colour)
  | { type: 'dots'; n: number }                          // subitising dots (random arrangement)
  | { type: 'array'; rows: number; cols: number }        // multiplication array
  | { type: 'coins'; coins: number[] }                   // pence values, 100 = £1, 200 = £2
  | { type: 'clock'; h: number; m: number }
  | { type: 'fraction'; parts: number; shaded: number; shape?: 'circle' | 'bar' }
  | { type: 'numberline'; from: number; to: number; mark?: number; step?: number }   // mark = hidden number shown as ?
  | { type: 'word'; text: string; emoji?: string }       // big word / letter card (writing)
  | { type: 'sentence'; text: string };                  // sentence with a blank "_"

export interface Question {
  prompt: string;         // shown on the question card ("7 + 5 = ?")
  say?: string;           // spoken form (Web Speech), defaults to prompt
  answer: string;         // correct option OR, for 'sequence', the letters joined
  options: string[];      // bubble labels (shuffled, includes answer / all sequence letters)
  sequence?: string[];    // slice these in order (spelling); options = sequence letters + decoys
  visual?: Visual;
  hint?: string;          // small instruction text under the prompt
  wide?: boolean;         // options are words → bigger bubbles
}

export type Difficulty = 1 | 2 | 3;
export type Generator = (d: Difficulty, rng: Rng) => Question;

export interface Topic {
  id: string;             // "y1-bonds"
  title: string;          // "Number Bonds"
  icon: string;           // emoji
  subject: 'maths' | 'writing';
  year: 'reception' | 'year1' | 'year2';
  nc: string;             // curriculum reference (short)
  mode?: 'bubbles' | 'tracing';
  gen: Generator;
}

export interface YearInfo {
  id: 'reception' | 'year1' | 'year2';
  title: string;
  short: string;
  age: string;
  perStage: number;       // questions per stage
  lives: number;
  gentle: boolean;        // missed bubbles don't cost a life
  speeds: number[];       // bubble speed per stage (1 slow … 3 fast); length = number of stages
  diffs: Difficulty[];    // generator difficulty per stage
}
export const STAGE_NAMES = ['Apprentice', 'Warrior', 'Master', 'Grandmaster', 'Legend'];

export const YEARS: YearInfo[] = [
  { id: 'reception', title: 'Reception', short: 'R', age: 'Ages 4–5', perStage: 5, lives: 4, gentle: true, speeds: [1, 1, 1, 2, 2], diffs: [1, 1, 2, 2, 3] },
  { id: 'year1', title: 'Year 1', short: 'Y1', age: 'Ages 5–6', perStage: 6, lives: 3, gentle: false, speeds: [1, 2, 2, 3, 3], diffs: [1, 2, 2, 3, 3] },
  { id: 'year2', title: 'Year 2', short: 'Y2', age: 'Ages 6–7', perStage: 7, lives: 3, gentle: false, speeds: [1, 2, 3, 3, 3], diffs: [1, 2, 2, 3, 3] },
];
