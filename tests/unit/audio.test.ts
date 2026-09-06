import { describe, it, expect } from 'vitest';
import { chooseVoice, voiceScore } from '../../src/audio';

const v = (name: string, lang: string, localService?: boolean) => ({ name, lang, localService });

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
