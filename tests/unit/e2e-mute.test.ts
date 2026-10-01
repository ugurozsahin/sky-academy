import { readdirSync, readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { muteSpeech } from '../e2e/mute';

// #1460: the e2e suite runs silent. A spec that imports `test` straight from Playwright skips the fixture that
// silences the speech engine, so the rail is on the import, not on the speech itself.
describe('the e2e suite runs silent (#1460)', () => {
  const specs = readdirSync('tests/e2e').filter(f => f.endsWith('.spec.ts'));

  it('finds the specs it is about', () => expect(specs.length).toBeGreaterThanOrEqual(4));

  it.each(specs)('%s takes `test` from ./fixtures, never from @playwright/test', spec => {
    const src = readFileSync(`tests/e2e/${spec}`, 'utf8');
    expect(src).toMatch(/import \{ test, expect \} from '\.\/fixtures';/);
    expect(src).not.toMatch(/import \{[^}]*\btest\b[^}]*\} from '@playwright\/test'/);
  });

  it('the fixture runs muteSpeech in every context', () => {
    const src = readFileSync('tests/e2e/fixtures.ts', 'utf8');
    expect(src).toContain('context.addInitScript(muteSpeech)');
  });

  it('the config launches Chromium with --mute-audio, so a headed run is silent too', () => {
    expect(readFileSync('playwright.config.ts', 'utf8')).toContain("args: ['--mute-audio']");
  });

  describe('muteSpeech', () => {
    const g = globalThis as { SpeechSynthesis?: unknown };
    afterEach(() => { delete g.SpeechSynthesis; });

    it('sets the utterance volume to 0 and still calls the real speak, with its this', () => {
      const seen: Array<{ self: unknown; volume: number }> = [];
      class Engine { speak(u: { volume: number }) { seen.push({ self: this, volume: u.volume }); } }
      g.SpeechSynthesis = Engine;
      muteSpeech();
      const engine = new Engine();
      engine.speak({ volume: 1 });
      expect(seen).toEqual([{ self: engine, volume: 0 }]);
    });

    it('does nothing where there is no speech engine', () => {
      expect(() => muteSpeech()).not.toThrow();
    });
  });
});
