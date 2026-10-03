import { describe, expect, it } from 'vitest';
import { CORRECTION_LINE_MAX, correctionLine, createHud, livesHTML, NO_SAY_ANSWER_TOPICS, outcomeHintHTML, promptHTML, promptMode, stageHTML } from '../../src/ui/hud';
import { TOPICS, type Difficulty, type Question } from '../../src/curriculum';

const plain = (s: string) => s.replace(/<[^>]+>/g, '');

describe('livesHTML (#36 — the play HUD lives row)', () => {
  it('lights the first n of total hearts and dims the rest', () => {
    expect(livesHTML(2, 3)).toBe('<span class="on">❤️</span><span class="on">❤️</span><span class="off">❤️</span>');
  });
  it('all off at zero lives, all on when full', () => {
    expect(livesHTML(0, 3)).toBe('<span class="off">❤️</span>'.repeat(3));
    expect(livesHTML(3, 3)).toBe('<span class="on">❤️</span>'.repeat(3));
  });
  it('renders exactly `total` hearts regardless of n', () => {
    expect(livesHTML(5, 5).match(/❤️/g)).toHaveLength(5);
    expect(livesHTML(1, 5).match(/❤️/g)).toHaveLength(5);
  });
});

// #36: this markup was a 393-character `els.stage.innerHTML = ...` inside playScreen(), the longest line in
// play.ts and the only one over 180 chars that was not a render() template. It is a pure builder now, so the
// mission progress bar a grown-up reads over the child's shoulder — and its screen-reader labels — are
// checked here rather than only through the e2e spec.
describe('stageHTML (#36 — the mission stage pill)', () => {
  const segs = ['good', 'bad', ''] as const;

  it('names the stage and counts the question for a sighted reader', () => {
    const h = stageHTML('Warm-up', segs, 2, 3);
    expect(h).toContain('<span class="sname">Warm-up</span>');
    expect(h).toContain('<small class="q" aria-hidden="true">3/3</small>');
  });
  it('marks the segments won, slipped and still to come, and pulses only the current one', () => {
    expect(stageHTML('S', segs, 2, 3)).toContain('<i class="good"></i><i class="bad"></i><i class=" cur"></i>');
    expect(stageHTML('S', segs, 0, 3)).toContain('<i class="good cur"></i><i class="bad"></i><i class=""></i>');
  });
  it('carries a progressbar a screen reader can announce', () => {
    const h = stageHTML('Sprint finish', segs, 1, 3);
    expect(h).toContain('role="progressbar"');
    expect(h).toContain('aria-label="Sprint finish: question 2 of 3"');
    expect(h).toContain('aria-valuenow="2"');
    expect(h).toContain('aria-valuemin="1"');
    expect(h).toContain('aria-valuemax="3"');
  });
  it('renders one segment per entry, and never marks a segment outside the stage', () => {
    expect(stageHTML('S', ['', '', '', ''], 9, 4).match(/<i /g)).toHaveLength(4);
    expect(stageHTML('S', ['', '', '', ''], 9, 4)).not.toContain('cur');
  });
  it('escapes HTML in the stage name, in the label as well as the text', () => {
    const h = stageHTML('Ninjas <b>& stars</b>', segs, 0, 3);
    expect(h).not.toContain('<b>');
    expect(h.match(/&lt;b&gt;/g)).toHaveLength(2);            // once in .sname, once in the aria-label
  });
});

describe('outcomeHintHTML (#36 — the outcome reveal under the question card)', () => {
  it('a correct answer is ticked and named', () => {
    const h = outcomeHintHTML('correct', '7');
    expect(h).toContain('✓');
    expect(h).toContain('7');
    expect(plain(h)).toBe("✓ 7 — that's right!");
  });
  it('a wrong answer names the right one', () => {
    expect(plain(outcomeHintHTML('wrong', 'cube'))).toBe('✗ Not this time. The answer is cube');
  });
  it('a miss reads that it flew away', () => {
    expect(plain(outcomeHintHTML('miss', '12'))).toBe('It flew away! The answer is 12');
  });
  it('escapes HTML in the answer', () => {
    expect(outcomeHintHTML('wrong', '5 < 8')).toContain('5 &lt; 8');
    expect(outcomeHintHTML('correct', '5 < 8')).not.toContain('5 < 8');
  });
});

// #1059: a build card keeps its prompt on the card and draws the answer's digits as slots beside it, so a
// device with no speech (the APK, until #880/#881) still shows the child what sum they are answering.
describe('promptHTML — build cards (#1059)', () => {
  const sum: Question = { prompt: '45 + 44 = ?', answer: '89', options: ['89', '90'], sequence: ['8', '9'], build: { template: '__' } };
  const dec: Question = { prompt: '7.5 ÷ 2 = ?', answer: '3.75', options: ['3.75', '3.5'], sequence: ['3', '7', '5'], build: { template: '_.__' } };

  it('keeps the prompt on the card, with a slot for every digit', () => {
    const h = promptHTML(sum, 0);
    expect(plain(h)).toBe('45 + 44 = __');
    expect(h.match(/class="todo"/g)).toHaveLength(2);
  });

  it('fills slots in order as digits are sliced, and leaves the rest as blanks', () => {
    expect(plain(promptHTML(sum, 1))).toBe('45 + 44 = 8_');
    expect(promptHTML(sum, 1)).toContain('<span class="got">8</span>');
    expect(promptHTML(sum, 1)).toContain('<span class="todo">_</span>');
    expect(plain(promptHTML(sum, 2))).toBe('45 + 44 = 89');
    expect(promptHTML(sum, 2).match(/class="got"/g)).toHaveLength(2);
  });

  it('prints the template\'s non-slot characters as themselves, between the slots', () => {
    expect(plain(promptHTML(dec, 0))).toBe('7.5 ÷ 2 = _.__');
    expect(plain(promptHTML(dec, 2))).toBe('7.5 ÷ 2 = 3.7_');
  });

  it('reveal never shows a digit that has not been sliced', () => {
    expect(promptHTML(sum, 0, true)).not.toContain('>8<');
    expect(promptHTML(sum, 0, true)).not.toContain('>9<');
    expect(plain(promptHTML(sum, 1, true))).toBe('45 + 44 = 8_');
  });

  it('a plain sequence card with no build renders exactly as before', () => {
    const spell: Question = { prompt: 'Spell it', answer: 'cat', options: ['c', 'a', 't', 'x'], sequence: ['c', 'a', 't'] };
    expect(promptHTML(spell, 1)).toBe('<span class="seq"><span class="got">c</span><span class="todo">_</span><span class="todo">_</span></span>');
    expect(promptHTML(spell, 1, true)).toBe('<span class="seq reveal"><span class="got">c</span><span class="todo">a</span><span class="todo">t</span></span>');
  });

  it('a prompt with no ? appends the slots after a space, dropping nothing', () => {
    const noQ: Question = { prompt: 'Work it out', answer: '89', options: ['89', '90'], sequence: ['8', '9'], build: { template: '__' } };
    expect(plain(promptHTML(noQ, 0))).toBe('Work it out __');
    expect(promptHTML(noQ, 0)).toBe('Work it out <span class="seq"><span class="todo">_</span><span class="todo">_</span></span>');
  });

  it('an earlier ? in the prompt (a comparison card, "5 ? 8") stays literal — only the last ? takes the slots', () => {
    const twoQ: Question = { prompt: '5 ? 8, so 5 + 4 = ?', answer: '9', options: ['9', '8'], sequence: ['9'], build: { template: '_' } };
    expect(plain(promptHTML(twoQ, 0))).toBe('5 ? 8, so 5 + 4 = _');
    expect(promptHTML(twoQ, 0)).toContain('5 ? 8, so 5 + 4 = <span class="seq">');
  });
});

// #919: "Slice Them All" (#918's engine) has no position to be `done` past — a target can be found in any
// order, so `got`/`todo` here comes from set membership against `remaining`, never from `done`'s index.
describe('promptHTML — any-order cards (#919)', () => {
  const anyQ: Question = { prompt: 'Slice every even number', answer: '2,4,6', options: ['2', '3', '4', '5', '6'], sequence: ['2', '4', '6'], anyOrder: true };

  it('keeps the prompt text, unlike an ordered sequence which replaces it', () => {
    expect(plain(promptHTML(anyQ, 0, false, anyQ.sequence))).toBe('Slice every even number ___');
  });

  it('marks a found target `got` wherever it sits, and every other target `todo`, regardless of finding order', () => {
    // the middle target found first — a plain `done`-index check would get this wrong
    const h = promptHTML(anyQ, 0, false, ['2', '6']);
    expect(h).toBe('Slice every even number <span class="seq"><span class="todo">_</span><span class="got">4</span><span class="todo">_</span></span>');
  });

  it('defaults to every target still open when `remaining` is omitted', () => {
    expect(promptHTML(anyQ, 0)).toContain('<span class="todo">_</span><span class="todo">_</span><span class="todo">_</span>');
  });

  it('reveals every target once none remain, same as a finished ordered sequence', () => {
    expect(promptHTML(anyQ, 0, false, [])).toBe('Slice every even number <span class="seq"><span class="got">2</span><span class="got">4</span><span class="got">6</span></span>');
  });

  it('reveal (#65, no voice) prints every target, found or not — dimmed by `.todo` the same way as an ordered sequence', () => {
    const h = promptHTML(anyQ, 0, true, ['2', '6']);
    expect(h).toBe('Slice every even number <span class="seq reveal"><span class="todo">2</span><span class="got">4</span><span class="todo">6</span></span>');
  });
});

// #65: `promptMode` is the one place the hear/read/peek decision is made, and the outcome reveal is one of its
// three readers — the one with no test until the 17:41Z review pointed at it. A reveal that ignored the mode
// would overwrite a silent device's listen-words card with the filled-in answer.
describe('promptMode and the outcome reveal (#65)', () => {
  /**
   * The class list is a real set, not a pair of no-ops: `showOutcome` clears `.own` from the hint (#328,
   * PR #430 review note 1) and a stub would make that unassertable — which is how the interaction got here
   * with no coverage at all. `classes` is exposed for the test below to read.
   */
  const el = () => {
    const classes = new Set<string>();
    return {
      innerHTML: '', textContent: '', classes,
      classList: { add: (c: string) => classes.add(c), remove: (c: string) => classes.delete(c), contains: (c: string) => classes.has(c) },
    } as unknown as HTMLElement & { classes: Set<string> };
  };
  const soundHunt: Question = { prompt: '🔊 Listen!', answer: 's', options: ['s', 'a'], listen: 'sun · sock · sad' };
  const sum: Question = { prompt: '3 + 4 = ?', answer: '7', options: ['7', '9'] };

  it('decides hear / read / peek from listen, peek and whether the device can be heard', () => {
    expect(promptMode(sum, true)).toBe('hear');
    expect(promptMode(sum, false)).toBe('hear');                     // nothing to read instead: the prompt is the question
    expect(promptMode(soundHunt, true)).toBe('hear');
    expect(promptMode(soundHunt, false)).toBe('read');
    expect(promptMode({ ...soundHunt, peek: true }, false)).toBe('peek');
    expect(promptMode({ ...soundHunt, peek: true }, true)).toBe('hear');
  });

  it('the reveal fills the answer into a heard prompt and leaves a read card\'s listen words alone', () => {
    let audible = true;
    const els = { lives: el(), qcard: el(), prompt: el(), hint: el() };
    const hud = createHud(els, 3, () => audible);
    els.prompt.innerHTML = '3 + 4 = ?';
    hud.showOutcome('correct', sum);
    expect(els.prompt.innerHTML).toContain('<span class="ans">7</span>');
    els.prompt.innerHTML = 'sun · sock · sad';
    hud.showOutcome('wrong', soundHunt);
    expect(els.prompt.innerHTML, 'the device can be heard: the ordinary prompt is revealed').not.toBe('sun · sock · sad');
    audible = false;
    els.prompt.innerHTML = 'sun · sock · sad';
    hud.showOutcome('wrong', soundHunt);
    expect(els.prompt.innerHTML, 'a silent device keeps the words it was reading').toBe('sun · sock · sad');
    expect(els.hint.innerHTML).toContain('<b class="ok">s</b>');
  });

  /**
   * #328, review note 1. The play screen marks the hint `own` when the card is answered from it, and the
   * outcome line replaces that text with this screen's own words ("✓ red — that's right!"). Without the
   * clear, the element goes on claiming to be the question's values while showing the verdict — harmless
   * today only because `.qcard.good .hint` un-hides it by a second, independent mechanism, and silently
   * wrong the moment anything keys off `.own` for a colour or a size.
   *
   * It is checked here rather than in `play-session.test.ts`, whose harness stubs `showOutcome` out
   * entirely — so this path was not merely unasserted there, it was unreachable.
   */
  it('the outcome line drops the hint\'s `own` mark, whatever the outcome (#328)', () => {
    const measure: Question = {
      prompt: 'Which holds more?', answer: 'red', options: ['red', 'blue'],
      hint: 'red jug: 300 ml · blue jug: 100 ml', hintIsData: true,
    };
    for (const kind of ['correct', 'wrong', 'miss'] as const) {
      const els = { lives: el(), qcard: el(), prompt: el(), hint: el() };
      const hud = createHud(els, 3, () => true);
      els.hint.classList.add('own');                       // as `setHint` leaves it for a measure card
      hud.showOutcome(kind, measure);
      expect((els.hint as unknown as { classes: Set<string> }).classes.has('own'),
        `${kind}: the outcome text is still marked as the question's own values`).toBe(false);
    }
  });
});

// #893: seeded so a failing draw reproduces — same mulberry32 shape as curriculum.test.ts's local `rng`.
function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

describe('correctionLine (#893 — the spoken line after a wrong slice or a miss)', () => {
  const q = (answer: string, extra: Partial<Omit<Question, 'hint' | 'hintIsData'>> = {}): Question => ({ prompt: 'p', answer, options: [answer, 'x'], ...extra });

  it('reads a number', () => {
    expect(correctionLine(q('7'), undefined)).toBe("It's 7.");
  });
  it('reads a word', () => {
    expect(correctionLine(q('cat'), undefined)).toBe("It's cat.");
  });
  it('reads a money answer exactly as the card prints it, never rebuilt as a decimal (#652)', () => {
    expect(correctionLine(q('£1 and 50p'), undefined)).toBe("It's £1 and 50p.");
    expect(correctionLine(q('50p'), undefined)).toBe("It's 50p.");
    expect(correctionLine(q('£2'), undefined)).toBe("It's £2.");
  });
  it('reads the whole word for a sequence question, not the letter just missed', () => {
    const seqQ = q('cat', { sequence: ['c', 'a', 't'] });
    expect(correctionLine(seqQ, undefined)).toBe("It's cat.");
  });
  it('is null for a glyph or symbol answer with no letter or digit', () => {
    expect(correctionLine(q('■'), undefined)).toBeNull();
    expect(correctionLine(q('<'), undefined)).toBeNull();
  });
  it('is null for an emoji answer', () => {
    expect(correctionLine(q('🐱'), undefined)).toBeNull();
  });
  it('is null for a card that opts out with noSayAnswer', () => {
    expect(correctionLine(q('7', { noSayAnswer: true }), undefined)).toBeNull();
  });
  it('is null for every topic in NO_SAY_ANSWER_TOPICS, whatever the answer', () => {
    expect(NO_SAY_ANSWER_TOPICS.size).toBe(8);
    for (const id of NO_SAY_ANSWER_TOPICS) expect(correctionLine(q('a'), id), id).toBeNull();
  });
  // A stale or mistyped id here would otherwise pass every test above (they only assert on the set's own
  // contents) while silently no longer suppressing the real topic it once named — a topic rename is exactly
  // the kind of drift `TOPICS` (the live registry) would catch and a bare string literal would not.
  it('every id in NO_SAY_ANSWER_TOPICS names a topic that is actually registered', () => {
    for (const id of NO_SAY_ANSWER_TOPICS) expect(TOPICS.some(t => t.id === id), id).toBe(true);
  });
  it('is not null for an ordinary topic id', () => {
    expect(correctionLine(q('7'), 'y1-add')).toBe("It's 7.");
  });
  it('does not double the full stop when the answer already ends in sentence punctuation', () => {
    expect(correctionLine(q('I can run.'), undefined)).toBe("It's I can run.");
    expect(correctionLine(q('Is it hot?'), undefined)).toBe("It's Is it hot?");
  });
  it('is null once the line would reach CORRECTION_LINE_MAX, however its answer is shaped', () => {
    const long = 'x'.repeat(CORRECTION_LINE_MAX);
    expect(correctionLine(q(long), undefined)).toBeNull();
    const short = 'x'.repeat(CORRECTION_LINE_MAX - "It's .".length - 1);
    expect(correctionLine(q(short), undefined)).not.toBeNull();
  });

  // "Sweep the class, not the instance" (`open-pr` skill §4): every topic × difficulty × 20 seeds, drawn from
  // the real generators rather than a hand-picked sample. This is what actually found that Story Sentences'
  // longer banks (`y1-sentence`, `y2-sentence`, `r-sentence`) needed the length cap above, well past the
  // seven topics the issue's own evidence section sampled by hand.
  // Topics whose answer is never a letter or digit at any difficulty, so `correctionLine` is null on every
  // draw by the generic glyph check rather than by `NO_SAY_ANSWER_TOPICS`: `y2-compare` answers a bare
  // `<`/`>`/`=`, `y2-patterns` a pattern glyph/emoji, `y2-punct` a bare punctuation mark, `r-read` (#967) the
  // CVC picture's own emoji, never the word itself, and `r-initial` (#928) the same CVC picture's emoji, `r-measure` (#971) one of the two compared emoji. Found by running the sweep once and reading which topics
  // came back with zero non-null lines.
  const ALWAYS_SYMBOLIC = new Set(['y2-compare', 'y2-patterns', 'y2-punct', 'r-read', 'r-initial', 'r-measure']);

  it('every non-null correction line across the whole registry is "It\'s …", ends in one full stop, and fits the hold', () => {
    let checked = 0, nonNull = 0;
    const nonNullByTopic = new Map(TOPICS.map(t => [t.id, 0]));
    for (const topic of TOPICS) {
      for (const d of [1, 2, 3] as Difficulty[]) {
        for (let seed = 0; seed < 20; seed++) {
          const question = topic.gen(d, rng(topic.id.length * 97 + d * 31 + seed));
          const line = correctionLine(question, topic.id);
          checked++;
          if (line === null) continue;
          nonNull++; nonNullByTopic.set(topic.id, nonNullByTopic.get(topic.id)! + 1);
          const where = `${topic.id} d${d} seed${seed}: answer "${question.answer}" → "${line}"`;
          expect(line, where).toMatch(/^It's .+[.!?]$/);
          expect(line, where).not.toMatch(/[.!?]{2,}$/);
          expect(line.length, where).toBeLessThan(CORRECTION_LINE_MAX);
        }
      }
    }
    expect(checked).toBe(TOPICS.length * 3 * 20);
    // The shape assertions above pass vacuously if every draw came back null — a `CORRECTION_LINE_MAX` of 0,
    // or an early `return null`, would still leave every `if (line === null) continue;` a no-op and this test
    // green. So: every topic not excluded by name, and not always-symbolic, must actually produce a spoken
    // line at least once across its 60 draws (3 difficulties × 20 seeds) — proof the feature fires at all.
    expect(nonNull, 'a total regression would leave every line null').toBeGreaterThan(0);
    for (const topic of TOPICS) {
      if (NO_SAY_ANSWER_TOPICS.has(topic.id) || ALWAYS_SYMBOLIC.has(topic.id)) continue;
      expect(nonNullByTopic.get(topic.id), `${topic.id}: never spoke a correction across 60 draws`).toBeGreaterThan(0);
    }
  });
});
