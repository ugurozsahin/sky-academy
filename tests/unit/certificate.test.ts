import { describe, it, expect } from 'vitest';
import { certificateText } from '../../src/ui/certificate';
import { AVATARS } from '../../src/avatars';

const base = { name: 'Ada', avatar: AVATARS[0], year: 'Year 1', title: 'Number Bonds', stars: 3, score: 340, correct: 30, attempts: 30, date: new Date('2026-09-06T10:00:00Z') };

describe('mission certificate text', () => {
  it('names the child, the mission, the island, the stars and a British long date', () => {
    const t = certificateText(base);
    expect(t.heading).toBe('Sky Ninja Academy'); expect(t.child).toBe('Ada');
    expect(t.reason).toBe('completed the Number Bonds mission on Year 1 Island');
    expect(t.detail).toBe('30/30 correct (100%) · score 340');
    expect(t.stars).toBe('★★★'); expect(t.date).toBe('6 September 2026');
    expect(t.signed).toContain('Volt');
  });
  it('falls back to "Ninja" for a blank name, clamps stars, and words Sensei training differently', () => {
    const t = certificateText({ ...base, name: '  ', stars: 5, correct: 21, attempts: 25, training: true });
    expect(t.child).toBe('Ninja'); expect(t.stars).toBe('★★★');
    expect(t.reason).toBe('completed Sensei training on Year 1 Island');
    expect(t.detail).toBe('21/25 correct (84%) · score 340');
    expect(certificateText({ ...base, stars: 1, attempts: 0, correct: 0 }).stars).toBe('★☆☆');
    expect(certificateText({ ...base, stars: 1, attempts: 0, correct: 0 }).detail).toContain('(0%)');
  });
});
