// The play screen's HUD writers, split out of play.ts (#36). The lives row, the sprint timer, the boss
// health bar, the mission stage pill and the per-question outcome reveal used to be closures inside the one
// long playScreen() function. They are now pure string builders (livesHTML, stageHTML, outcomeHintHTML —
// all unit-tested) plus a thin createHud() that writes them onto the elements the play screen already owns,
// and the `Outcome` union both files name. No game logic, no session:
// play.ts keeps all the wiring, exactly as the overlays split (#99) did.
import type { Question } from '../curriculum';
import { say } from '../audio';
import { $, esc, fillAnswer } from './dom';

/** The lives row: `total` hearts, the first `n` lit and the rest dimmed. */
export const livesHTML = (n: number, total: number): string =>
  Array.from({ length: total }, (_, i) => `<span class="${i < n ? 'on' : 'off'}">❤️</span>`).join('');

/** How a question ended, as the HUD and the play screen both name it (#36: one union, not four copies). */
export type Outcome = 'correct' | 'wrong' | 'miss';

/**
 * The mission stage pill: the stage's name, one segment per question in the stage (green = right,
 * red = slip, `cur` = the one being asked) and a small "3/6" for the grown-ups (#55).
 *
 * `segs` is the stage's running record and is as long as the stage; `index` is the question being asked.
 * A segment past the end of `segs` renders empty, so a short array cannot throw here.
 */
export function stageHTML(name: string, segs: readonly ('good' | 'bad' | '')[], index: number, total: number): string {
  const label = `${esc(name)}: question ${index + 1} of ${total}`;
  const bar = segs.map((k, i) => `<i class="${k}${i === index ? ' cur' : ''}"></i>`).join('');
  return `<span class="sname">${esc(name)}</span>`
    + `<span class="segs" role="progressbar" aria-label="${label}"`
    + ` aria-valuenow="${index + 1}" aria-valuemin="1" aria-valuemax="${total}">${bar}</span>`
    + `<small class="q" aria-hidden="true">${index + 1}/${total}</small>`;
}

/** The outcome hint under the question card: a tick for a right answer, else the answer named. */
export const outcomeHintHTML = (kind: Outcome, answer: string): string =>
  kind === 'correct'
    ? `<b class="ok">✓ ${esc(answer)}</b> — that's right!`
    : `${kind === 'wrong' ? '✗ Not this time.' : 'It flew away!'} The answer is <b class="ok">${esc(answer)}</b>`;

export interface HudEls { lives: HTMLElement; qcard: HTMLElement; prompt: HTMLElement; hint: HTMLElement }

/**
 * Write the line under the prompt (#36; moved here from play-session.ts with #893's second caller, since
 * that file is at its #714 ratchet cap). `own` marks the one kind that must survive a short screen: a hint
 * the card is *answered from*, which the generator declares with `hintIsData` (`types.ts`). The short-screen
 * rule (`@media (max-height: 640px)` in style.css) hides `.hint` to buy the card vertical space on a phone
 * held sideways — a fair trade for an instruction line, and not for the seven measure topics whose values
 * being compared live in `hint` and nowhere else: hidden, "Which is fuller?" sits over two coloured
 * bubbles with nothing to decide by (#328, and #65's rule that every card stays usable without read-aloud).
 *
 * **Not `!!q.hint`**, which is what the first version of this fix used. 47 of the registry's 87 topics
 * write a `hint` and only 7 of those carry data; `hint` is documented as "small instruction text", and
 * that is what the other 40 put there ("Slice the shape", "Put them in twos"). Marking all of them would
 * have given a 16px line back to every one of those cards in landscape and pushed the arena down with it
 * (`arena.topInset`, `play-session.ts`) — the space the media query exists to reclaim (PR #430 review, round 1).
 */
export function setHint(els: Pick<HudEls, 'hint'>, text: string, own = false) {
  els.hint.textContent = text;
  els.hint.classList.toggle('own', own);
}

/**
 * Topics whose answer must never be spoken as the correction line (#893): a grapheme read as a letter name
 * teaches the wrong sound (`r-sounds`, `r-soundhunt`, `y1-soundhunt`, the sound pairs of `y1-digraphs`), and
 * a word-ending fragment read alone means nothing out of context (the plurals of `y1-plurals`, the suffixes
 * of `y1-suffix` and `y2-suffix`).
 */
export const NO_SAY_ANSWER_TOPICS: ReadonlySet<string> = new Set([
  'r-sounds', 'r-soundhunt', 'y1-soundhunt', 'y1-digraphs', 'y1-plurals', 'y1-suffix', 'y2-suffix',
]);

/** The outcome hold is 1.5 s at most (`play.ts`'s `HOLD`); a line at or past this many characters would not finish inside it. */
export const CORRECTION_LINE_MAX = 40;

/**
 * The line spoken after a wrong slice or a miss (#893): `It's <answer>.`, read exactly as the card prints
 * it — for a sequence question `q.answer` is already the whole word, not the letter just missed, and a
 * money answer is already a `coinLabel` string (`£1 and 50p`), never rebuilt into a decimal (#652). No
 * second full stop when the answer already ends in one — Story Sentences' answer is the finished sentence,
 * punctuation and all. `null` when nothing should be read: an answer with no letter or digit (a glyph or
 * emoji), a topic in `NO_SAY_ANSWER_TOPICS`, a card that opts out with `noSayAnswer` (#982's pseudo-word
 * flag), or a line that would not fit `CORRECTION_LINE_MAX` — the sweep this ticket asked for found that
 * Story Sentences' longer banks (`y1-sentence`/`y2-sentence`/`r-sentence` at d2 and d3, mostly) run past
 * the cap, so it excludes those sentences on its own rather than a topic list needing to name every one; a
 * short sentence from the same topic (its d1 bank, "I can run.") is under the cap and is read.
 */
export function correctionLine(q: Pick<Question, 'answer' | 'noSayAnswer'>, topicId: string | undefined): string | null {
  if (q.noSayAnswer || (topicId !== undefined && NO_SAY_ANSWER_TOPICS.has(topicId)) || !/[a-z0-9]/i.test(q.answer)) return null;
  const line = `It's ${q.answer}${/[.!?]$/.test(q.answer) ? '' : '.'}`;
  return line.length < CORRECTION_LINE_MAX ? line : null;
}

/**
 * How a question's prompt is presented on this device (#65) — the one place the listen/peek/audible decision
 * is spelled out, so the card, the outcome reveal and the progress cue cannot disagree about it.
 *   `hear` — read aloud; the card shows the ordinary prompt.
 *   `read` — the `listen` text stays on the card (Sound Hunt's keywords, the word to spell).
 *   `peek` — the `listen` text is shown for a moment, then hidden before the bubbles launch (Story Sentences d2+).
 */
export type PromptMode = 'hear' | 'read' | 'peek';
export function promptMode(q: Pick<Question, 'listen' | 'peek'>, audible: boolean): PromptMode {
  if (!q.listen || audible) return 'hear';
  return q.peek ? 'peek' : 'read';
}

/**
 * The question prompt: a plain question, or the sequence so far with the letters still to come as gaps.
 * `reveal` (#65, a device with no voice) shows the letters still to come as well — the word to copy AND the
 * place in it, which are two different things a child needs — and prints the `listen` text for a plain question.
 *
 * It lives here beside `promptMode` (#16 review) because the duel card renders the same question the play
 * screen does: two copies would let one screen drift into showing a question the other hides.
 *
 * `q.anyOrder` (#919, building on #918's engine) is the one case that keeps the prompt text on the card
 * instead of replacing it — "Slice every even number" means nothing once the numbers are gone — and adds the
 * `.seq` progress run after it, `got`/`todo` by set membership (`remaining`, the caller's own `Session.remaining()`)
 * rather than by position: an any-order target can be found out of the order it was drawn in, unlike a spelling
 * sequence's position-based `done`. `remaining` defaults to the whole sequence so a caller mid-refactor that
 * forgets it still renders every target as `todo` rather than throwing. `done` itself is read only by the
 * two branches above this one — it stays 0 for the life of an any-order question (`Session.hit()` never
 * advances it there) so this branch never reads it.
 */
export function promptHTML(q: Question, done: number, reveal = false, remaining?: readonly string[]): string {
  if (!q.sequence) return esc(reveal && q.listen ? q.listen : q.prompt);
  if (q.build) return buildPromptHTML(q.prompt, q.build.template, q.sequence, done);
  if (q.anyOrder) {
    const left = new Set(remaining ?? q.sequence);
    const items = q.sequence.map(t => `<span class="${left.has(t) ? 'todo' : 'got'}">${left.has(t) && !reveal ? '_' : esc(t)}</span>`);
    return `${esc(q.prompt)} <span class="seq${reveal ? ' reveal' : ''}">${items.join(reveal && q.wide ? ' ' : '')}</span>`;
  }
  const items = q.sequence.map((l, i) => `<span class="${i < done ? 'got' : 'todo'}">${i < done || reveal ? esc(l) : '_'}</span>`);
  return `<span class="seq${reveal ? ' reveal' : ''}">${items.join(reveal && q.wide ? ' ' : '')}</span>`;
}

/**
 * A build card (#1059) keeps its prompt on the card and draws the answer's digits as slots beside it, in
 * place of the prompt's last `?` (or after it, with a space, when the prompt has none — a build card
 * should still have one, but this never drops a slot silently if it does not). Slots reuse the sequence
 * markup (`.got`/`.todo`, `src/styles/play.css`); the template's non-`_` characters print as plain text
 * between them. Unlike a spelling sequence, `reveal` never shows an unsliced digit here — the prompt is
 * already on the card, so there is nothing left to reveal.
 */
function buildPromptHTML(prompt: string, template: string, sequence: string[], done: number): string {
  let i = 0;
  const slots = Array.from(template).map(ch => {
    if (ch !== '_') return esc(ch);
    const shown = i < done, item = sequence[i]; i++;
    return `<span class="${shown ? 'got' : 'todo'}">${shown ? esc(item) : '_'}</span>`;
  }).join('');
  const q = prompt.lastIndexOf('?');
  return q === -1 ? `${esc(prompt)} <span class="seq">${slots}</span>` : `${esc(prompt.slice(0, q))}<span class="seq">${slots}</span>${esc(prompt.slice(q + 1))}`;
}

/**
 * The small line under the prompt (#16 review). It is the question's own `hint` whenever it has one — for seven
 * of the duel pool's topics (`measureCompare()` and `y2Temp`'s comparison branch) the values being compared
 * live in `hint` and nowhere else on the card, so a card without this line asks "Which is fuller?" over two
 * coloured bubbles and cannot be answered without read-aloud (#65). Only when there is no hint does it fall
 * back to telling the child what to do.
 */
export function hintText(q: Pick<Question, 'hint'>, o: { reveal: boolean; tracing?: boolean }): string {
  if (q.hint) return q.hint;
  if (o.tracing) return 'Trace over the dotted letters';
  return o.reveal ? 'Read, then slice the answer' : 'Tap or slice the answer';
}

/**
 * HUD writers bound to the play screen's elements. `audible()` — read-aloud on AND the device can be heard
 * (#65) — is read fresh on every reveal so the toggle and the voice verdict take effect at once (Sound Hunt
 * without a voice keeps its listen words).
 */
export function createHud(els: HudEls, lives: number, audible: () => boolean) {
  return {
    drawLives(n: number) { if (els.lives) els.lives.innerHTML = livesHTML(n, lives); },
    drawTimer(s: number) { const t = $('#timer'); if (!t) return; t.textContent = `⏱ ${s}`; t.classList.toggle('hurry', s <= 10); },
    drawHp(hp: number, max: number) { const h = $('#hp'); if (h) { h.style.width = `${Math.round(100 * hp / max)}%`; h.classList.toggle('low', hp <= 3); } },
    showOutcome(kind: Outcome, q: Question) {
      els.qcard.classList.remove('good', 'bad'); els.qcard.classList.add(kind === 'correct' ? 'good' : 'bad');
      if (!q.sequence && promptMode(q, audible()) === 'hear') els.prompt.innerHTML = fillAnswer(q.prompt, q.answer);   // a `read` card keeps its listen words
      // The outcome line is this screen's words, so it drops the `own` mark `setHint` above
      // put there for a data-carrying hint (#328 review, note 1). Today the media query un-hides it anyway
      // through `.qcard.good .hint`, so nothing renders differently — but without this the element claims to
      // be the question's own values while showing "✓ red — that's right!", and anything that later keys off
      // `.own` (a colour, a size) would silently reach the outcome text of every measure card.
      els.hint.classList.remove('own');
      els.hint.innerHTML = outcomeHintHTML(kind, q.answer);
    },
    /** The correction line after a wrong slice or a miss (#893) — the caller skips this in Ninja Sprint, whose pace leaves it no room. */
    speakCorrection(q: Question, topicId: string | undefined) {
      const line = correctionLine(q, topicId);
      if (line) say(line);
    },
  };
}

/** The writers `createHud` hands back — play.ts builds them, play-session.ts writes through them (#36). */
export type Hud = ReturnType<typeof createHud>;
