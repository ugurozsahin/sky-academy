import { describe, expect, it } from 'vitest';
import { livesHTML, outcomeHintHTML } from '../../src/ui/hud';

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
