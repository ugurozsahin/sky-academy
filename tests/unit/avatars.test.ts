import { describe, it, expect } from 'vitest';
import { ALL_AVATARS, AVATARS, avatarById, MASTER, nameElementCollide, praiseLine, SENSEI, SENSEI_LINES, senseiLine, welcomeLine } from '../../src/avatars';
import { masterProgress } from '../../src/game/sensei';
import { TOPICS } from '../../src/curriculum';
import { STICKER_IDS, type TopicProgress } from '../../src/storage';

const starred = (ids: string[], stars = 1): Record<string, TopicProgress> => Object.fromEntries(ids.map(id => [id, { stars, best: 0, plays: 1 }]));

/*
 * #112 — the owner played the game and read "Shadow · Shadow Ninja" off the top user card.
 *
 * Every card in the game renders a ninja as `name` next to `element` (`src/ui/home.ts:21`, the avatar picker
 * at `src/ui/avatar.ts:31-33`, the read-aloud at `:55`, the certificate's signature line). That only reads
 * well while the given name is distinct from the element it is printed beside — and the Shadow ninja was the
 * one whose name was a substring of its own element, so the card said the same word twice.
 *
 * The fix is one field. The rail is here because the next avatar added is where it comes back: a roster is
 * exactly the kind of list someone extends without re-reading what the card does with it.
 */
describe('a ninja\'s name reads well beside its element (#112)', () => {
  it('no avatar repeats its own name inside its element', () => {
    expect(ALL_AVATARS.length, 'an empty roster would pass every assertion below vacuously').toBeGreaterThan(0);
    for (const a of ALL_AVATARS)
      expect(nameElementCollide(a.name, a.element),
        `"${a.name} · ${a.element}" says the same word twice — give ${a.id} a given name of its own`).toBe(false);
  });

  it('and no two of them share a name', () => {
    const names = ALL_AVATARS.map(a => a.name.toLowerCase());
    expect(names.length, 'an empty roster would pass this vacuously too').toBeGreaterThan(0);
    expect([...new Set(names)], 'two ninjas with one name are indistinguishable on the picker').toHaveLength(names.length);
  });

  it('the Shadow ninja is called Dusk, and still answers to the id every save stores', () => {
    // The id, the slice effect and the artwork are deliberately NOT renamed: `avatar: 'shadow'` is what sits
    // in localStorage and in STICKER_IDS, so a player who already chose this ninja keeps it.
    const dusk = avatarById('shadow');
    expect(dusk.name).toBe('Dusk');
    expect(dusk.element).toBe('Shadow Ninja');
    expect([dusk.id, dusk.fx, dusk.img]).toEqual(['shadow', 'shadow', 'avatars/shadow.webp']);
    expect(STICKER_IDS, 'the sticker album is keyed by id, so it must not have moved').toContain('shadow');
  });
});

/*
 * #113 — the roster rail above compared with a whole-string `includes`, which reads a short given name
 * embedded mid-word in an unrelated element as a collision (`'spring ninja'.includes('rin')`), and never
 * checked the mirror direction (an element word embedded in a longer name). Both are reproduced directly
 * against `nameElementCollide`, not against the real roster, since neither shape exists in it today.
 */
describe('nameElementCollide (#113)', () => {
  it('does not flag a short given name merely embedded inside an unrelated element word', () => {
    expect(nameElementCollide('Rin', 'Spring Ninja'), '"Rin · Spring Ninja" reads perfectly').toBe(false);
    expect(nameElementCollide('Ai', 'Rain Ninja'), '"Ai · Rain Ninja" reads perfectly').toBe(false);
  });

  it('flags a whole-word match either direction, prefix matching so a short name still catches its own element', () => {
    expect(nameElementCollide('Shadow', 'Shadow Ninja'), 'the original #112 bug shape').toBe(true);
    expect(nameElementCollide('Sol', 'Solar Ninja'), 'prefix match: Sol is a prefix of Solar').toBe(true);
    expect(nameElementCollide('Bolt the Robot', 'Robot'), 'the mirror direction: a one-word element inside the name').toBe(true);
  });

  it('is case-insensitive and untroubled by real roster pairs', () => {
    expect(nameElementCollide('KAI', 'ninja boy')).toBe(false);
    expect(nameElementCollide('Dusk', 'Shadow Ninja')).toBe(false);
  });
});

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
    // #67's welcome line joins the lines already checked here, so a future Sensei line keeps the same calm voice.
    for (const l of [...MASTER.praise, ...SENSEI_LINES.trained, ...SENSEI_LINES.tryAgain, SENSEI_LINES.welcome]) expect(l).not.toMatch(/!/);   // no shouting
  });
  it('greets the child by name in the first-run wizard (#67), and falls back to "Ninja" the same way senseiLine does', () => {
    expect(welcomeLine('Ada')).toBe(SENSEI_LINES.welcome.replace('{name}', 'Ada'));
    expect(welcomeLine('')).toMatch(/Ninja/);
    expect(welcomeLine('')).not.toMatch(/\{name\}/);
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
