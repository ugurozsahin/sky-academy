import { describe, it, expect } from 'vitest';
import { load, recordCrown, recordTopic, reset } from '../../src/storage';

// minimal localStorage shim for node
const mem: Record<string, string> = {};
(globalThis as any).localStorage = { getItem: (k: string) => mem[k] ?? null, setItem: (k: string, v: string) => { mem[k] = v; }, removeItem: (k: string) => { delete mem[k]; }, clear: () => { for (const k in mem) delete mem[k]; } };

describe('recordCrown (#932)', () => {
  it('sets the crown, keeps the rest of the topic, and is idempotent', () => {
    reset(); recordTopic('y1-add', 3, 120); recordCrown('y1-add'); recordCrown('y1-add');
    expect(load().progress['y1-add']).toMatchObject({ stars: 3, best: 120, plays: 1, crown: true });
  });
});
