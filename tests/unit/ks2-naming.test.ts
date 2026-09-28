import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Topic } from '../../src/curriculum/types';
import { isKs2 } from '../../src/curriculum/key-stage';
import { namingProblems } from './helpers/ks2-naming';

/** A minimal, valid Topic fixture — only `gen`, `icon` and `title` matter to `namingProblems`. */
const fixture = (over: Partial<Topic> & Pick<Topic, 'gen'>): Topic => ({
  id: 'ks2-fixture', title: 'Count in 4s, 8s, 50s and 100s', icon: '🔢', subject: 'maths', year: 'year2', nc: 'test',
  ...over,
});
const noVisual = () => ({ prompt: '7 + 5 = ?', answer: '12', options: ['12', '11', '13', '10'] });
const VISUALS = {
  objects: { type: 'objects', emoji: '🍎', n: 3 } as const,
  tenframe: { type: 'tenframe', n: 3 } as const,
  dots: { type: 'dots', n: 3 } as const,
};
const withVisual = (type: keyof typeof VISUALS) => () => ({ prompt: '?', answer: '3', options: ['3', '4', '5', '2'], visual: VISUALS[type] });

describe('KS2 naming rule (#1041): plain titles, functional icons, no emoji-counting pictures', () => {
  it('every KS2 registry row draws 150 questions at each difficulty with no naming problem', () => {
    // With no KS2 YearId defined yet (#1050+ add the first), this set is empty and the sweep passes by having
    // nothing to check — the fixtures below carry the proof until a real KS2 topic lands.
    const ks2 = TOPICS.filter(t => isKs2(t.year));
    for (const t of ks2) expect(namingProblems(t, 150), t.id).toEqual([]);
  });

  it('a toy icon reports a problem', () => {
    const t = fixture({ icon: '🐾', gen: noVisual });
    expect(namingProblems(t, 1)).toEqual([`${t.id}: toy icon "🐾"`]);
  });

  it('a playful title ("Order Up!") reports a problem', () => {
    const t = fixture({ title: 'Order Up!', gen: noVisual });
    expect(namingProblems(t, 1)).toEqual([`${t.id}: playful title "Order Up!"`]);
  });

  it('an emoji-counting visual (tenframe) reports a problem at every difficulty', () => {
    const t = fixture({ gen: withVisual('tenframe') });
    const problems = namingProblems(t, 1);
    expect(problems).toHaveLength(3);
    for (const d of [1, 2, 3]) expect(problems).toContain(`${t.id} d${d}: emoji-counting visual "tenframe"`);
  });

  it('an objects card at d1 of y3-fracof is exempt, but the same card at d2/d3 still reports (#1092, #1144)', () => {
    const t = fixture({ id: 'y3-fracof', gen: withVisual('objects') });
    const problems = namingProblems(t, 1);
    expect(problems).toEqual([
      `${t.id} d2: emoji-counting visual "objects"`,
      `${t.id} d3: emoji-counting visual "objects"`,
    ]);
  });

  it('the same exemption applies to y4-fracof', () => {
    const t = fixture({ id: 'y4-fracof', gen: withVisual('dots') });
    expect(namingProblems(t, 1).some(p => p.startsWith(`${t.id} d1:`))).toBe(false);
  });

  it('a clean fixture (🔢, "Count in 4s, 8s, 50s and 100s") reports nothing', () => {
    const t = fixture({ gen: noVisual });
    expect(namingProblems(t, 3)).toEqual([]);
  });
});
