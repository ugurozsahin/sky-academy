import { describe, expect, it } from 'vitest';
import { createHud, livesHTML, outcomeHintHTML, promptMode, stageHTML } from '../../src/ui/hud';
import type { Question } from '../../src/curriculum';

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

// #65: `promptMode` is the one place the hear/read/peek decision is made, and the outcome reveal is one of its
// three readers — the one with no test until the 17:41Z review pointed at it. A reveal that ignored the mode
// would overwrite a silent device's listen-words card with the filled-in answer.
describe('promptMode and the outcome reveal (#65)', () => {
  const el = () => ({ innerHTML: '', textContent: '', classList: { add() {}, remove() {} } }) as unknown as HTMLElement;
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
});
