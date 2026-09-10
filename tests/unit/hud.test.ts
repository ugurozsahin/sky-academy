import { describe, expect, it } from 'vitest';
import { livesHTML, outcomeHintHTML, stageHTML } from '../../src/ui/hud';

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
