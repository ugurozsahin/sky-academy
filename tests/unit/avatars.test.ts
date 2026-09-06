import { describe, it, expect } from 'vitest';
import { ALL_AVATARS, AVATARS, avatarById, MASTER, praiseLine, SENSEI, SENSEI_LINES, senseiLine } from '../../src/avatars';
import { masterProgress } from '../../src/game/sensei';
import { TOPICS } from '../../src/curriculum';
import type { TopicProgress } from '../../src/storage';

const starred = (ids: string[], stars = 1): Record<string, TopicProgress> => Object.fromEntries(ids.map(id => [id, { stars, best: 0, plays: 1 }]));

describe('Master Ninja', () => {
  it('is the eleventh avatar, kept out of the free roster, and doubles as Sensei', () => {
    expect(AVATARS.map(a => a.id)).not.toContain('master');
    expect(ALL_AVATARS).toHaveLength(AVATARS.length + 1);
    expect(ALL_AVATARS[ALL_AVATARS.length - 1]).toBe(MASTER);
    expect(SENSEI).toBe(MASTER);
    expect(MASTER.img).toBe('avatars/sensei.webp');
    expect(MASTER.fx).toBe('master');
    expect(avatarById('master')).toBe(MASTER);
    expect(avatarById('nobody')).toBe(AVATARS[0]);
  });
  it('speaks in a calm master voice', () => {
    expect(praiseLine(MASTER, 'Ada', () => 0)).toBe('Calm mind, sharp blade, Ada.');
    expect(senseiLine(true, 'Ada', () => 0)).toBe('Well trained, Ada. Practice makes a master.');
    expect(senseiLine(false, '', () => 0.99)).toMatch(/Ninja/);
    for (const l of [...MASTER.praise, ...SENSEI_LINES.trained, ...SENSEI_LINES.tryAgain]) expect(l).not.toMatch(/!/);   // no shouting
  });
  it('unlocks only when every topic on every island has at least one star', () => {
    const ids = TOPICS.map(t => t.id);
    expect(masterProgress(TOPICS, {})).toEqual({ done: 0, total: ids.length, unlocked: false });
    const allButOne = masterProgress(TOPICS, starred(ids.slice(1), 3));
    expect(allButOne).toEqual({ done: ids.length - 1, total: ids.length, unlocked: false });
    expect(masterProgress(TOPICS, { ...starred(ids), [ids[0]]: { stars: 0, best: 50, plays: 4 } }).unlocked).toBe(false);   // played but never won
    expect(masterProgress(TOPICS, starred(ids)).unlocked).toBe(true);
    expect(masterProgress([], {}).unlocked).toBe(false);
  });
});
