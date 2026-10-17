import { describe, expect, it } from 'vitest';
import { createMissionPill } from '../../src/ui/mission-pill';

// #1501: the mission-progress pill left `createPlaySession`. Its HTML builder is pinned in hud.test.ts
// (`stageHTML`); this pins the state around it — which segments are coloured, and when they reset.
const el = () => ({ innerHTML: '', textContent: '' }) as unknown as HTMLElement;
const segs = (e: HTMLElement) => [...e.innerHTML.matchAll(/<i class="([^"]*)"><\/i>/g)].map(m => m[1].replace(' cur', '').trim());

describe('createMissionPill (#55, #1501)', () => {
  it('colours the question just decided and keeps the earlier ones', () => {
    const e = el(), pill = createMissionPill(e, true, () => 0);
    pill.draw(1, 0, 3);
    expect(segs(e)).toEqual(['', '', '']);
    pill.mark('good', 1, 0, 3);
    pill.mark('bad', 1, 1, 3);
    expect(segs(e)).toEqual(['good', 'bad', '']);
  });

  it('pulses the current question and counts it', () => {
    const e = el(), pill = createMissionPill(e, true, () => 0);
    pill.draw(1, 1, 3);
    expect(e.innerHTML).toContain('<i class=" cur"></i>');
    expect(e.innerHTML).toContain('2/3');
  });

  it('starts a new stage with empty segments', () => {
    const e = el(), pill = createMissionPill(e, true, () => 0);
    pill.draw(1, 0, 2);
    pill.mark('good', 1, 0, 2);
    pill.draw(2, 0, 4);
    expect(segs(e)).toEqual(['', '', '', '']);
  });

  it('outside a mission it counts questions plainly and ignores a mark', () => {
    const e = el();
    let asked = 4;
    const pill = createMissionPill(e, false, () => asked);
    pill.draw(1, 0, 3);
    expect(e.textContent).toBe('Q4');
    asked = 5;
    pill.mark('good', 1, 0, 3);
    expect(e.textContent).toBe('Q4');   // mark() redraws nothing outside a mission
    expect(e.innerHTML).toBe('');
  });
});
