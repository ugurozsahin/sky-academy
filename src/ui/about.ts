import { topicById } from '../curriculum';
import { MODES } from '../game/modes';
import { mtcForm, MTC_SIZE } from '../game/mtc';
import { seededRng } from '../game/rng';

/** The grown-ups page's "About this game" claims. Each is literally true today and pinned by tests/unit/parents.test.ts;
 *  the dependency list is held by the rail in tests/unit/guardrails.test.ts. */
export const ABOUT_LINES = [
  'No adverts.',
  'No account — progress is kept on this device.',
  'No tracking — no analytics, and nothing about your child is collected.',
  'Works offline once installed or loaded.',
] as const;

/** What the claims below ask the game about itself; the defaults read the live registry and modes (#1291). */
export type AboutFacts = { hasTopic: (id: string) => boolean; mtcPractice: () => boolean };
const LIVE: AboutFacts = {
  hasTopic: id => !!topicById(id),
  mtcPractice: () => MODES.mtc?.questionMs === 6000 && mtcForm(seededRng(1)).length === MTC_SIZE,
};

/** KS2 claims, each shown only once the feature behind it ships. "Timing", not "format": the practice is sliced, not typed. */
export const ks2Lines = (f: AboutFacts = LIVE): string[] => {
  const has = (...ids: string[]) => ids.every(f.hasTopic);
  const lines: string[] = [];
  if (f.mtcPractice()) lines.push('Tables Check practice with the same timing as the Year 4 check: 25 questions, 6 seconds each.');
  if (has('y3-wordlist', 'y4-wordlist', 'y5-wordlist', 'y6-wordlist')) lines.push('Every word on the statutory Year 3–4 and Year 5–6 spelling lists.');
  else if (has('y3-wordlist', 'y4-wordlist')) lines.push('Every word on the statutory Year 3–4 spelling list.');
  return lines;
};

export const aboutLines = (f?: AboutFacts): string[] => [...ABOUT_LINES, ...ks2Lines(f)];

export const aboutHTML = (): string =>
  `<h3 class="p-h">About this game</h3><ul class="p-note">${aboutLines().map(l => `<li>${l}</li>`).join('')}</ul>`;
