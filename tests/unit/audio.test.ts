import { describe, it, expect } from 'vitest';
import { chooseVoice, haptic, HAPTICS, voiceScore } from '../../src/audio';
import { reset, save } from '../../src/storage';

const mem: Record<string, string> = {};
(globalThis as any).localStorage = { getItem: (k: string) => mem[k] ?? null, setItem: (k: string, v: string) => { mem[k] = v; }, removeItem: (k: string) => { delete mem[k]; }, clear: () => { for (const k in mem) delete mem[k]; } };
const v = (name: string, lang: string, localService?: boolean) => ({ name, lang, localService });

describe('haptics', () => {
  it('vibrates with the pattern for the event, follows the sound toggle, and is a no-op without the API', () => {
    reset(); const calls: (number | number[])[] = []; const nav = { vibrate: (p: number | number[]) => { calls.push(p); return true; } };
    expect(haptic('slice', nav)).toBe(true); expect(calls).toEqual([[...HAPTICS.slice]]);
    expect(haptic('stage', nav)).toBe(true); expect(calls[1]).toEqual([30, 40, 30, 40, 90]);
    save({ sound: false }); expect(haptic('wrong', nav)).toBe(false); expect(calls.length).toBe(2);   // muted → still
    save({ sound: true }); expect(haptic('wrong', {})).toBe(false);                                  // desktop browsers: no vibrate()
    expect(haptic('life', { vibrate: () => { throw new Error('blocked'); } })).toBe(false);            // never throws into the game loop
  });
});

describe('voice choice for young listeners', () => {
  it('prefers British English over other English, and rejects non-English', () => {
    expect(chooseVoice([v('Samantha', 'en-US'), v('Daniel', 'en-GB'), v('Amélie', 'fr-FR')])?.name).toBe('Daniel');
    expect(chooseVoice([v('Amélie', 'fr-FR'), v('Anna', 'de-DE')])).toBeNull();
    expect(chooseVoice([])).toBeNull();
    expect(voiceScore(v('Karen', 'en_AU'))).toBeGreaterThan(voiceScore(v('Samantha', 'en-US')));   // underscore locale handled
  });
  it('prefers child / warm en-GB voices and natural voices over plain ones', () => {
    const list = [v('Daniel', 'en-GB', true), v('Google UK English Female', 'en-GB', false), v('Microsoft Maisie Online (Natural) - English (United Kingdom)', 'en-GB', false), v('Microsoft Libby Online (Natural)', 'en-GB', false)];
    expect(chooseVoice(list)?.name).toMatch(/Maisie/);
    expect(chooseVoice(list.filter(x => !/Maisie/.test(x.name)))?.name).toMatch(/Libby/);
    expect(voiceScore(v('Google UK English Female', 'en-GB'))).toBeGreaterThan(voiceScore(v('Google UK English Male', 'en-GB')));
  });
  it('never picks Apple novelty voices when a normal voice exists', () => {
    expect(chooseVoice([v('Bubbles', 'en-GB'), v('Zarvox', 'en-US'), v('Daniel', 'en-GB')])?.name).toBe('Daniel');
    expect(voiceScore(v('Bubbles', 'en-GB'))).toBeLessThan(voiceScore(v('Samantha', 'en-US')));
  });
});
