// Pure results-screen derivations, carved out of the play.ts closure (#36): the medal and the heading are
// decided purely from the finished run, with no DOM or side effects, so they can be unit-tested directly
// instead of only through the e2e results screen. play.ts keeps the recording, speech and overlay wiring.
import { MODES, type Mode } from '../game/modes';
import type { Question, Topic } from '../curriculum';
import { esc } from './dom';
import { REST_LINE, restDue, type RestClock } from '../game/rest';
import type { RestSetting } from '../device-settings';
import { load, recordCrown, recordSprint, recordTopic, recordTopicSprint } from '../storage';
import { raisesTrophy, trophyFor, TROPHY_WORD } from '../game/trophies';
import { listedTopics, topicById, type YearInfo } from '../curriculum';
import { beltFor, totalStarsOf } from '../game/belts';

/** How a finished run scored — the fields the medal reads. */
export interface RunOutcome {
  mode: Mode;
  won: boolean;
  score: number;
  stars: number;
  incomplete?: boolean;
}

/**
 * The medal shown on the results screen. Endless grades on score, Sprint on its star tier, and the
 * staged/boss modes on stars when won; a lost run that can be lost (mission/boss) shows the effort medal.
 * #522: a generator throw is graded on nothing — Endless/Sprint would otherwise still hand out a real
 * 🥇/🥈/🥉 for whatever partial score/stars had accrued before the crash, next to a heading that says the
 * session did not really finish.
 */
export function resultMedal(r: RunOutcome): string {
  if (r.incomplete) return '💪';
  const tier = (n: number) => n === 3 ? '🥇' : n === 2 ? '🥈' : '🥉';
  // #1117: exhaustive over Mode — a new mode must name its medal here, never inherit the mission's.
  switch (r.mode) {
    case 'endless': return r.score >= 300 ? '🥇' : r.score >= 150 ? '🥈' : '🥉';
    case 'relaxed': return '💪';   // #937: effort, never stars
    case 'mtc': return '';           // #1118: practice, no medal
    case 'paper': return r.stars >= 1 ? tier(r.stars) : '💪';   // #1233: graded on stars, as Sprint is
    case 'sprint': return r.stars >= 1 ? tier(r.stars) : '💪';
    case 'mission': case 'boss': return r.won ? tier(r.stars) : '💪';
    default: { const never: never = r.mode; return never; }
  }
}

/**
 * The results heading, taken from the mode table — a won Sensei-training run (staged + training) reads
 * "Training complete!" rather than the mission's own "Mission complete!".
 */
export function resultHeading(mode: Mode, opts: { won: boolean; training: boolean }): string {
  const spec = MODES[mode];
  return spec.staged && opts.won && opts.training ? 'Training complete!'
    : opts.won ? spec.overHeadingWon : spec.overHeadingLost;
}

/**
 * The results screen's spoken/shown headline. #877: Mission has no villain (`MODES.mission.villain` is
 * false), so a lost Mission used to say "Hammer Man got away" regardless — the caller already has
 * `senseiLine`/`praiseLine` (both need an Avatar, so they stay outside this pure function), passed as
 * thunks rather than pre-drawn strings so a branch that does not use one never spends its `Math.random()` pick.
 */
export function resultHeadline(
  r: RunOutcome, opts: { training: boolean; newBest: boolean; name: string; senseiLine: () => string; praiseLine: () => string },
): string {
  const name = opts.name || 'Ninja';
  if (r.incomplete) return 'That question broke — here is what you earned so far!';
  if (opts.training) return opts.senseiLine();
  if (r.mode === 'sprint' && opts.newBest) return `New best, ${name}!`;
  if (r.mode === 'boss' && r.won) return `K.O.! You beat Hammer Man, ${name}!`;
  if (r.won) return opts.praiseLine();
  return MODES[r.mode].villain ? `Hammer Man got away this time, ${name}!` : `Good try, ${name}! Have another go.`;
}

/**
 * A results-screen announcement (#896) — the new-best line, a belt, a trophy, island master or the rest
 * prompt. Each is its own later ticket (#933, #951, #912, #952, #940); this only makes room for them.
 */
/** `spoken` is what is said when it differs from what is shown (an emoji is not read aloud well, #912). */
export interface ResultCandidate { kind: 'belt' | 'island' | 'trophy' | 'best' | 'rest'; text: string; spoken?: string }

/** Register order (§R of #896): belt outranks island, island outranks trophy, and so on. */
const RESULT_LINE_ORDER: ResultCandidate['kind'][] = ['belt', 'island', 'trophy', 'best', 'rest'];

/**
 * At most two results-screen announcements, in register order, so two features speaking on the same
 * results screen never talk over each other or crowd the coin row. A stable sort, so two candidates of the
 * same kind (which should not happen — each kind is one announcement) keep their input order rather than
 * being reordered against each other.
 */
export function resultsLines(candidates: ResultCandidate[]): ResultCandidate[] {
  return [...candidates].sort((a, b) => RESULT_LINE_ORDER.indexOf(a.kind) - RESULT_LINE_ORDER.indexOf(b.kind)).slice(0, 2);
}

/**
 * #940: the rest line joins the candidates when the grown-up's time is up. It is last in register order, so a
 * results screen already carrying two announcements leaves it pending, and only a line actually shown restarts the clock.
 */
export function withRestLine(candidates: ResultCandidate[], clock: RestClock, setting: RestSetting): ResultCandidate[] {
  const lines = resultsLines(restDue(clock.elapsed(), setting) ? [...candidates, { kind: 'rest', text: REST_LINE }] : candidates);
  if (lines.some(l => l.kind === 'rest')) clock.reset();
  return lines;
}

/**
 * `lines` (already chosen by `resultsLines()`) rendered as `best-pill` spans for the coin row — the same
 * class `newBest`'s pill already uses (`overlays.ts`), escaped through `esc()` the way every other piece of
 * child-authored or generated text on this screen is. Pulled out as its own pure function (#896 review,
 * pr-test-analyzer) so the escaping has a unit test that does not need a real DOM, which this project's
 * unit suite has no `document` for.
 */
export function resultPillsHTML(lines: ResultCandidate[]): string {
  return lines.map(l => `<span class="best-pill">${esc(l.text)}</span>`).join('');
}

/**
 * The results row's one contextual action (#929) — beside Play again and Islands. `retry` and `fix` are
 * #931's and #930's own buttons; `lostAtStage` is the stage a lost mission ended in (play-results.ts). Precedence: retry a lost mission from its lost stage, else offer to fix
 * mistakes, else move on to the next unstarred topic in the same subject.
 */
export interface ResultsActionCtx {
  mode: Mode; training: boolean; won: boolean; lostAtStage?: number; misses: number; next: Topic | null;
}
export type ResultsAction = { kind: 'retry'; stage: number } | { kind: 'fix' } | { kind: 'next'; topic: Topic };

export function resultsAction(ctx: ResultsActionCtx): ResultsAction | null {
  if (ctx.mode === 'mission' && !ctx.training && !ctx.won && (ctx.lostAtStage ?? 0) >= 3) return { kind: 'retry', stage: ctx.lostAtStage! };
  if ((ctx.mode === 'mission' || ctx.training) && ctx.misses >= 1) return { kind: 'fix' };
  if (ctx.mode === 'mission' && !ctx.training && ctx.won && ctx.next) return { kind: 'next', topic: ctx.next };
  return null;
}

/** The results row's button for `action` (#929/#930/#931): its id and label, `undefined` for no action. */
export function actionButton(action: ResultsAction | null): { id: string; label: string } | undefined {
  if (!action) return undefined;
  if (action.kind === 'next') return { id: 'next-topic', label: 'Next topic →' };
  if (action.kind === 'fix') return { id: 'fix-mistakes', label: 'Fix my mistakes' };
  if (action.kind === 'retry') return { id: 'retry-stage', label: `Retry stage ${action.stage}` };
  return action satisfies never;
}

/**
 * The results screen's spoken score line (#897) — a non-reader hears how they did, not only a praise line.
 * "You got 18 right." always; a won mission with a star tier adds "Three/Two/One star(s)!" (endless/sprint's
 * own medal reads score/star-tier the same way, but this line is scoped to the one mode the issue asks for).
 */
export function scoreLine(r: { mode: Mode; won: boolean; correct: number; stars: number }): string {
  const right = `You got ${r.correct} right.`;
  if (r.mode !== 'mission' || !r.won || r.stars <= 0) return right;
  const word = r.stars === 3 ? 'Three' : r.stars === 2 ? 'Two' : 'One';
  return `${right} ${word} star${r.stars === 1 ? '' : 's'}!`;
}

/**
 * The first utterance of a topic mission (#897): a pre-reader tapping straight into a topic hears its name.
 * Folded into the SAME utterance as the first question — a separate, earlier `say()` would be cancelled by
 * the question's own line, the same reasoning `duel.ts`'s `spokenQuestion` hand-over already follows for
 * Ninja Duel's round 1 (round === 1, decided inside that function too, not by its caller). `topic` is
 * undefined for every pool-driven mode (Sensei training, Storm, Sprint, Boss all pass `pool`, never a single
 * `topic`) and `questionsAsked === 1` only once per session, so this reaches only a topic mission's first
 * question — never a later one, and never a "Fix my mistakes" replay of one (`practice`), which already heard
 * its topic named the first time it was played.
 *
 * `prev` guards a fourth, easy-to-miss repeat: `Session.respawn()` re-poses the SAME `Question` object (a
 * sequence card whose wave fell with nothing decided) without advancing `questionsAsked`, so question 1
 * respawned would otherwise read `questionsAsked === 1` a second time and announce the topic again, cutting
 * off whatever was still speaking — `q === prev` is exactly the respawn signature (a genuinely new question
 * is always a new object), so the announcement fires only the first time this question is posed at all.
 */
export function firstQuestionLine(q: Question, topic: Topic | undefined, questionsAsked: number, practice: boolean, prev: Question | null): string {
  const line = q.say ?? q.prompt;
  return topic && questionsAsked === 1 && !practice && q !== prev ? `${topic.title}! ${line}` : line;
}

/**
 * The results announcement for a topic Sprint that raised the topic's trophy tier (#912), or null: a Sprint
 * that does not raise it announces nothing. Shown with the emoji, spoken with the metal's name.
 */
export function trophyCandidate(topic: Topic, year: YearInfo, before: number, after: number): ResultCandidate | null {
  const t = raisesTrophy(before, after, year) ? trophyFor(after, year) : null;
  return t ? { kind: 'trophy', text: `New trophy: ${t} ${topic.title}!`, spoken: `New ${TROPHY_WORD[t]} trophy for ${topic.title}!` } : null;
}

/** What is said for a results line: its `spoken` form when it has one, else its text. */
export const spokenLine = (l: ResultCandidate): string => l.spoken ?? l.text;

/**
 * Record a Sprint's result (#911) and work out its announcement (#912): a topic Sprint writes the topic's own
 * best and may announce a raised trophy; a mixed Sprint writes the year's best. Returns `newBest` and the
 * results candidates, so `commitResult()` stays one line for it.
 */
export function recordSprintOutcome(year: YearInfo, topic: Topic | undefined, r: { correct: number; score: number }, pooled = false): { newBest: boolean; candidates: ResultCandidate[] } {
  if (pooled || load().settings.timeX !== 1) return { newBest: false, candidates: [] };   // #1121: a best is always a 60-second run; #1234: a titled pool (Grammar mix) keeps no year record
  if (!topic) return { newBest: recordSprint(year.id, r.score), candidates: [] };
  if (!topicById(topic.id)) return { newBest: false, candidates: [] };   // #1124: a drill built for one run (Tricky Facts) has no row to keep a best on
  const before = load().progress[topic.id]?.sprint ?? 0, newBest = recordTopicSprint(topic.id, r.correct);
  const t = newBest ? trophyCandidate(topic, year, before, r.correct) : null;
  return { newBest, candidates: t ? [t] : [] };
}

/** A Mission's `best` announcement (#933): `New best for <topic title>!` only when `recordTopic()` said the score beat a real previous best. */
export const missionBestCandidates = (topic: Pick<Topic, 'title'>, isNewBest: boolean): ResultCandidate[] =>
  isNewBest ? [{ kind: 'best', text: `New best for ${topic.title}!` }] : [];

/** Record a Mission's result and work out its announcements (#933 best, #951 belt), so `commitResult()` stays one line for it: the call site is pinned in `results.test.ts`, not only the pieces. A *won* Legend run also crowns the topic (#932); a lost one changes nothing more. */
export function recordMissionOutcome(topic: Topic, r: { stars: number; score: number; won?: boolean }, legend = false): { candidates: ResultCandidate[] } {
  const total = () => totalStarsOf(load().progress, listedTopics()), before = beltFor(total());
  const candidates = missionBestCandidates(topic, recordTopic(topic.id, r.stars, r.score)), after = beltFor(total());
  if (legend && r.won) recordCrown(topic.id);
  return { candidates: after.n > before.n ? [{ kind: 'belt', text: `🥋 You earned the ${after.name} belt!`, spoken: `You earned the ${after.name} belt!` }, ...candidates] : candidates };
}
