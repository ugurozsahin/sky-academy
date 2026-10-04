import { describe, expect, it } from 'vitest';
import { inputFor, inputMarkup } from '../../src/ui/play-input';
import type { Topic } from '../../src/curriculum';

const topic = (input?: Topic['input']) => ({ input } as Topic);

describe('play-input (#1064)', () => {
  it('inputFor: explicit, then the topic, then bubbles', () => {
    expect(inputFor({})).toBe('bubbles');
    expect(inputFor({ topic: topic('tracing') })).toBe('tracing');
    expect(inputFor({ topic: topic('tracing'), input: 'keypad' })).toBe('keypad');
    expect(inputFor({ topic: topic() })).toBe('bubbles');
  });
  it('inputMarkup: bubbles is the arena canvas, keypad an empty mount, tracing the pad', () => {
    expect(inputMarkup('bubbles')).toBe('<canvas id="arena" aria-label="Game arena"></canvas>');
    expect(inputMarkup('keypad')).toBe('<div id="keypad"></div>');
    const t = inputMarkup('tracing');
    expect(t).toContain('class="trace-wrap"');
    for (const id of ['trace', 'tclear', 'tcheck']) expect(t).toContain(`id="${id}"`);
  });
});
