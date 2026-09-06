import { describe, expect, it } from 'vitest';
import { fiveFrames, renderVisual } from '../../src/ui/visuals';

const count = (html: string, re: RegExp) => (html.match(re) ?? []).length;
describe('five-frames for object visuals (#54)', () => {
  it('lays objects out in rows of five with faint empty slots', () => {
    const h = fiveFrames(7, '🍎');
    expect(count(h, /class="five"/g)).toBe(2);              // 7 objects → two rows
    expect(count(h, /class="slot"/g)).toBe(10);             // 10 slots in total
    expect(count(h, /class="obj"/g)).toBe(7);               // 7 filled, 3 empty
    expect(count(fiveFrames(3, '🐟'), /class="slot"/g)).toBe(5);   // never fewer than one full row
    expect(count(fiveFrames(10, '⭐'), /class="five"/g)).toBe(2);
    expect(count(fiveFrames(24, '🍪'), /class="five"/g)).toBe(5);
  });
  it('crosses out taken-away objects but keeps them in their slots', () => {
    const h = renderVisual({ type: 'objects', emoji: '🍎', n: 8, n2: -3 });
    expect(count(h, /class="obj gone"/g)).toBe(3); expect(count(h, /class="obj"/g)).toBe(5); expect(count(h, /class="slot"/g)).toBe(10);
  });
  it('frames both groups of an addition / comparison', () => {
    const h = renderVisual({ type: 'objects', emoji: '🍎', n: 4, n2: 3, emoji2: '🍎' });
    expect(count(h, /class="grp"/g)).toBe(2); expect(count(h, /class="five"/g)).toBe(2); expect(h).toContain('class="plus">+');
    expect(renderVisual({ type: 'objects', emoji: '🍎', n: 4, n2: 3, emoji2: '🍌' })).toContain('class="plus">or');
  });
});
