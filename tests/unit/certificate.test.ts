import { describe, it, expect } from 'vitest';
import { certificateText, certRoute } from '../../src/ui/certificate';
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

describe('certificate delivery route', () => {
  it('prefers the system share sheet when files can be shared', () => {
    expect(certRoute({ canShareFiles: true, claudeSave: true, claudeRuntime: true })).toBe('share');
    expect(certRoute({ canShareFiles: true, claudeSave: false, claudeRuntime: false })).toBe('share');
  });
  it('uses the artifact save prompt when downloads are granted and sharing is unavailable', () => {
    expect(certRoute({ canShareFiles: false, claudeSave: true, claudeRuntime: true })).toBe('save');
  });
  it('falls back to the full-screen view inside the artifact viewer without a downloads grant', () => {
    expect(certRoute({ canShareFiles: false, claudeSave: false, claudeRuntime: true })).toBe('show');
  });
  it('uses a plain download in the static / PWA build with no artifact runtime', () => {
    expect(certRoute({ canShareFiles: false, claudeSave: false, claudeRuntime: false })).toBe('download');
  });
});
