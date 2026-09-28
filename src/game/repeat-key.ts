// The identity of a card, for "do not ask the same thing twice running" — split out of session.ts (#878)
// to make room under its #714 ratchet cap. Re-exported from session.ts, the one caller.
import type { Question, Visual } from '../curriculum';

/**
 * Which `Visual` types carry their question in a form this key can read, and which part of them does it
 * (PR #407 review, B1; widened by #455).
 *
 * The first cut stringified the **whole** visual, and decoration went into the card's identity: five
 * Reception generators re-roll `emoji` per draw independent of the sum, so `1 + 4 = ?` came round twice
 * running 11.75% of the time on `r-add` against 0.00% before, wearing a different sticker each time. A
 * blocklist of cosmetic field names is not enough either — `r-balance` hides its re-rolled emoji *inside* a
 * pan string (`emoji.repeat(n)`), and `y2-stats` inside a chart row's label.
 *
 * So this is an allowlist, and an absent type means **the old `(prompt, answer)` behaviour**: a visual this
 * table does not know about can never make two cards look different, only ever the same. That is the safe
 * direction **against over-discrimination only** — and an earlier version of this sentence went on to claim it
 * could "never cost a repeat the re-roll existed to prevent", which is false and is contradicted by the key's
 * own docstring below (#412 review round 4, note 6). An unread carrier drives the *answer* to stop repeating,
 * which is #390's defect: `y1-coins` at d2 keys 14 identities over 112 exercises. Safe here means a needless
 * re-roll, not no cost.
 *
 * Seven names are here now, each taking only the part of the visual that is the question. The first three are
 * #390's: `objects` for `r-oddeven`, `sentence` for `y2-sentencetype` and `y2-tense`, `symmetry` for
 * `y2-symmetry`. The next three are #455's, where the visual carries a comparison or a chart a bare
 * `(prompt, answer)` cannot tell apart: `coins` (the pence values as a **set** — so `£1 or 20p` and `£1 or
 * 10p` take different keys, which their shared prompt and answer do not), `numberline` (`from`/`to`/`mark`/
 * `step`) and `chart` (`kind` plus the rows' counts — deliberately **not** a row's `label` or a pictogram's
 * `icon`, which is where `y2-stats` hides its re-rolled emoji, the same trap PR #407's B1 found in `objects`).
 * `strip` is #391's: `y2-patterns` used to ship as a `sentence`, which incidentally kept it keyed on its own
 * `v.text` here; splitting it into its own `Visual` variant (#391) would otherwise have silently dropped that
 * key back to `''` for every pattern card, the exact #390 shape (`d1` is one constant prompt and one glyph
 * answer per card — the pattern itself, not the prompt or answer, is what tells two cards apart).
 * `word` stays out: it carries `orderQ`'s per-draw *shuffled* display order, which is presentation.
 * Adding a type is a deliberate act, and the rails in `tests/unit/session.test.ts` measure both directions.
 */
const VISUAL_QUESTION = {
  objects: (v: Extract<Visual, { type: 'objects' }>) => `${v.n}/${v.n2 ?? ''}`,
  sentence: (v: Extract<Visual, { type: 'sentence' }>) => v.text,
  strip: (v: Extract<Visual, { type: 'strip' }>) => v.text,
  symmetry: (v: Extract<Visual, { type: 'symmetry' }>) => v.grid.join('/'),
  coins: (v: Extract<Visual, { type: 'coins' }>) => [...new Set(v.coins)].sort((a, b) => a - b).join('/'),
  numberline: (v: Extract<Visual, { type: 'numberline' }>) => `${v.from}/${v.to}/${v.mark ?? ''}/${v.step ?? ''}`,
  chart: (v: Extract<Visual, { type: 'chart' }>) => `${v.kind}/${v.rows.map(r => r.n).join(',')}`,
} satisfies Partial<{ [T in Visual['type']]: (v: Extract<Visual, { type: T }>) => string }>;
const visualKey = (v: Visual): string => {
  const f = (VISUAL_QUESTION as Record<string, ((x: Visual) => string) | undefined>)[v.type];
  return f ? f(v) : '';
};
/**
 * The separators that unambiguously delimit a **list** in a `Question`'s content field, so the order within it
 * is presentation. `' · '` is the one the three generators use; the other three are here because a generator
 * switching to one of them would otherwise bring round 1's defect back in silence — measured at 1.2% for
 * `' / '` with the whole suite green (round 4, note 3). None of them appears in any `hint` or `listen` today,
 * so widening this is a no-op now and a closed hole later.
 *
 * `', '` is deliberately **not** here: four sentence topics carry prose commas in `hint`/`listen`, and sorting
 * those could merge two genuinely different cards, which is the #390 defect rather than a cure for it. The
 * oracle in `tests/unit/session.test.ts` does normalise it, which is the asymmetry round 2's B2 asked for — a
 * coarser oracle can only produce a red, never hide one. What neither sees is a fifth separator nobody has
 * thought of; that residue is real and is why the oracle stays wider than this list rather than importing it.
 */
const LIST_SEPARATORS = [' · ', ' | ', '; ', ' / '];
const contentList = (s: string) => {
  for (const sep of LIST_SEPARATORS) if (s.includes(sep)) return s.split(sep).sort().join(sep);
  return s;
};
/**
 * The identity of a card, for "do not ask the same thing twice running" (#390, widened by #412).
 *
 * **`Session` only.** `nextQuestion` below is the one caller; `src/game/duel.ts` draws its cards with a bare
 * `topic.gen()` and never consults this, so nothing in Ninja Duel avoids an immediate repeat. Pre-existing, and
 * worth knowing before reading the rest of this as a property of the game (#412 review round 4, note 7).
 *
 * `prompt` and `answer` are not enough, and neither is adding the visual: on nine topics the question is
 * carried by **text that is not the prompt**, and there is no visual at all. `measureCompare` puts the values
 * only in `hint` ("red pencil: 12 cm · blue pencil: 7 cm") and `say`; `soundQ`'s prompt is the constant
 * `🔊 Listen!` and its three keyword words — the whole question — go into `listen` and `say`. So the key
 * reduced to the answer, and the re-roll loop then refused every card whose answer matched the previous one:
 * driven through a real `Session` at d1, `r-soundhunt` repeated the target sound 0.000% of the time over 4000
 * pairs. A child who remembers the last answer was doing better than one who listens.
 *
 * `hint` and `listen` are therefore in the key — both are content wherever they are set. **`say` is not**,
 * because it is the only one of the three that carries presentation as well as content. (Not by analogy with
 * `VISUAL_QUESTION`, which round 2's N7 rightly points out runs the other way: an omitted *visual type* costs
 * a needless re-roll, which is safe, while an omitted *`Question` field* collapses two cards onto one key,
 * which is the bug — twice now. A field goes in unless it is shown to carry presentation; a visual type stays
 * out unless it is shown to carry the question.) `orderQ` speaks the numbers in their *shuffled* display order (`Slice the numbers from
 * smallest to biggest: 7, 2, 9`), which is re-shuffled per draw independently of the exercise, so folding it
 * in would put the same decoration into the card's identity that a per-draw `emoji` did. On every topic whose
 * question `say` carries, that question is also in `listen` (`soundQ`), `hint` (`measureCompare`) or the visual
 * (`y2-tense`, `y2-sentencetype`, `r-oddeven`) — **except `intervalCompare`, where `say` and `options` are the
 * only carriers** (round 3, #453 note 1: an earlier version of this sentence claimed no exception, which was
 * false for the very topic the paragraph below defers). Keying `say` would not be the fix there either, for the
 * `orderQ` reason above; #451 is.
 *
 * **But the order *within* `hint` and `listen` is presentation too** (#412 review round 1, B1), and missing
 * that was this key's own version of the same mistake: `soundQ` builds `listen` from the very
 * `shuffle(rng, words).slice(0, 3)` that `say` is built from, so three keyword words have up to six spellings
 * of one question, and a first cut that keyed the raw string served the same sound-hunt card twice running
 * 1.11% of the time — *dog, duck, dig* then *dog, dig, duck* — against 0.000% before the change. The same
 * mechanism, without the child-visible effect, is in `measureCompare`'s shuffled colour columns and
 * `y2-temp`'s two readings. So `contentList` keys a `' · '`-separated list as a **set**: the separator is this
 * repository's list separator, and those three generators are the only places it reaches a `Question`'s content
 * fields — it is also in a dozen or so UI strings, which this never sees (round 3). Normalised in the key,
 * never on the card — what the child reads is unchanged. Nothing enforces that inventory; the rails answer it
 * from the other end by normalising over five separators — the key's four plus `', '` — so a generator
 * switching to one of them goes red.
 *
 * **`options` is read only when the generator says it is the question** (#451, `Question.optionsAreContent`).
 * #412 ruled out folding `options` in unconditionally, because they are shuffled and re-drawn per draw on the
 * forty-odd topics whose extra bubbles are decoys — keying them there switches repeat-avoidance off. But
 * `intervalCompare` sets no `hint`, no `listen` and no visual, and its own comment says the bubbles *are* the
 * durations, so unmarked it reduced to `(prompt, answer)`: at d2, 22 keys over 3,000 draws with 18 covering more
 * than one comparison. `intervalCompare` sets `optionsAreContent` and the key then reads `options` as the sorted
 * set it is judged as — order is the per-draw shuffle, presentation rather than content, exactly `contentList`'s
 * distinction for `hint`/`listen` above.
 *
 * **The one cost this widening carries, stated because a child pays it** (#412 review round 4). `hint` is
 * content on a tall screen and **not on the card at all on a short one**: `src/style.css`'s
 * `@media (max-height: 640px)` hides `.hint` until the answer is given, and a landscape phone is exactly that
 * band (the rule says so itself, and `src/ui/hud.ts` says the measure values "live in `hint` and nowhere else
 * on the card"). So on `y1-mass`, `y1-capacity`, `y1-length` and `y2-temp`, keying `hint` lets through a pair
 * this loop used to refuse: driven 8,000 transitions at d1, counting only pairs byte-identical in everything a
 * ≤640px screen renders — prompt, bubble set, visual, which bubble is correct — the rate goes from **0.00% on
 * the old key to 1.84%–2.69%** here. Main's zero was structural rather than luck: its key was
 * `(prompt, answer, visual)` and these generators carry no visual, so a card that looked the same and answered
 * the same *was* the card it refused.
 *
 * Taken knowingly, because the trade is lopsided: `r-soundhunt` goes from a sound that could never repeat
 * (0.000%) to the generator's own 6.1%, on every viewport, against about one card in forty on four topics in an
 * orientation where those cards already cannot be answered without read-aloud (#65). **And the premise is being
 * removed**: PR #430 (`Closes #328`) renders the hint inside this very media query for these five topics, after
 * which keying it is simply correct and this paragraph should go, with the table above re-measured to 0.00%. No
 * rail here can see any of this — `asked()` reads `hint`, and no Playwright project is shorter than 640px — so
 * it is written down instead of pinned, which is the honest shape and not a good one.
 *
 * `sequence` is not in the key either, which is safe only because every sequence generator encodes the order
 * in `answer` (`orderQ`'s is the joined `sequence`) — an invariant pinned in `tests/unit/curriculum.test.ts`,
 * noted here so both ends say so (round 2, N4).
 *
 * Exported so the rails in `tests/unit/session.test.ts` can measure this key against the text a child reads
 * rather than against a copy of it, in both directions: different questions never share a key, and one
 * question never takes two. Those rails normalise lists over five separators against this one's four,
 * deliberately, so that narrowing `contentList` goes red once a generator actually uses the dropped
 * separator, not on its own (round 2, B2; #465).
 */
export const repeatKey = (q: Question) => [q.prompt, q.answer, contentList(q.hint ?? ''), contentList(q.listen ?? ''), q.visual ? `${q.visual.type}\u0000${visualKey(q.visual)}` : '', q.optionsAreContent ? [...q.options].sort().join('\u0001') : ''].join('\u0000');
