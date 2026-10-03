import { describe, it, expect } from 'vitest';
import { topicsFor, YEARS } from '../../src/curriculum';

describe('first-run mission (#947)', () => {
  // "Let's go!" starts a Mission on the first non-tracing Maths topic of the ninja's island (main.ts).
  it('every year has a bubbles Maths topic for the first-run mission, and a fresh save starts in Reception', () => {
    for (const y of YEARS) if (topicsFor(y.id, 'maths').length) expect(topicsFor(y.id, 'maths').find(t => t.input !== 'tracing'), y.id).toBeDefined();
    expect(topicsFor('reception', 'maths')[0].id).toBe('r-count');
  });
});
