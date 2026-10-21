import { readdirSync, readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { launchSilent, muteSpeech, MUTE_ARGS } from '../e2e/mute.mjs';

// #1460, #2148: every Playwright browser runs silent — the suite's and every script's. A spec that imports `test`
// straight from Playwright skips the fixture that silences the speech engine, and a script that calls
// `chromium.launch` itself skips both switches, so the rail is on those two doors, not on the sound.
const config = readFileSync('playwright.config.ts', 'utf8');
const testDirs = [...config.matchAll(/testDir: '([^']+)'/g)].map(m => m[1]);
// Recursive, as Playwright's own discovery is: a spec in a subfolder runs, so it is checked too.
const specs = testDirs.flatMap(dir => readdirSync(dir, { recursive: true, encoding: 'utf8' })
  .filter(f => /\.spec\.ts$/.test(f)).map(f => `${dir}/${f}`));
// Every file under scripts/, whatever its extension, and every browser type Playwright can launch.
const scriptFiles = readdirSync('scripts', { recursive: true, encoding: 'utf8' }).map(f => `scripts/${f}`)
  .filter(f => /\.[cm]?[jt]s$/.test(f) && !f.endsWith('.d.mts'));
const scripts = scriptFiles.filter(f => /\bchromium\b/.test(readFileSync(f, 'utf8')));

describe('every Playwright run is silent (#1460, #2148)', () => {
  it('finds the test directories and specs it is about', () => {
    expect(testDirs).toEqual(expect.arrayContaining(['tests/e2e', 'tests/sketch']));
    expect(specs.length).toBeGreaterThanOrEqual(10);
  });

  it.each(specs)('%s takes `test` from the e2e fixtures, never from @playwright/test', spec => {
    const src = readFileSync(spec, 'utf8');
    expect(src).toMatch(/import \{ test, expect \} from '(\.\/|\.\.\/e2e\/)fixtures';/);
    expect(src).not.toMatch(/import \{[^}]*\btest\b[^}]*\} from '@playwright\/test'/);
    // The `browser` fixture opens contexts the fixture never sees.
    expect(src).not.toMatch(/\bbrowser\.new(Context|Page)\(/);
  });

  it('the fixture runs muteSpeech in every context', () => {
    expect(readFileSync('tests/e2e/fixtures.ts', 'utf8')).toContain('context.addInitScript(muteSpeech)');
  });

  it('the config launches Chromium with --mute-audio for every project, so a headed run is silent too', () => {
    // In the shared top-level `use`, the one every project inherits — not one project's own.
    expect(config).toMatch(/^  use: \{[^\n]*launchOptions: \{[^\n]*args: \['--mute-audio'\]/m);
    expect(MUTE_ARGS).toEqual(['--mute-audio']);
    expect(Object.isFrozen(MUTE_ARGS), 'one shared array: a caller must not be able to change it for everyone').toBe(true);
    // A project's own `launchOptions` would replace the shared one whole, flag and all.
    expect(config.match(/launchOptions/g), 'launchOptions is set once, in the shared `use`').toHaveLength(1);
  });

  it('finds the scripts that launch Chromium', () => expect(scripts.length).toBeGreaterThanOrEqual(8));

  it.each(scripts)('%s launches Chromium through launchSilent, never chromium.launch', script => {
    const src = readFileSync(script, 'utf8');
    expect(src).not.toMatch(/\bchromium\.launch\w*\(/);
    expect(src).toContain('launchSilent(chromium');
    expect(src).toContain("import { launchSilent } from '../tests/e2e/mute.mjs';");
  });

  it('no script launches any browser type itself', () => {
    const direct = scriptFiles.filter(f => /\b(chromium|firefox|webkit)\.launch\w*\(/.test(readFileSync(f, 'utf8')));
    expect(direct).toEqual([]);
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

  describe('launchSilent', () => {
    function fakeChromium() {
      const launched: unknown[] = [], scripts: unknown[] = [], closed: string[] = [], contexts: unknown[] = [];
      const context = { addInitScript: async (s: unknown) => { scripts.push(s); }, newPage: async () => 'page' };
      const browser = { newContext: async (o: unknown) => { contexts.push(o); return context; }, close: async () => { closed.push('browser'); } };
      return { launched, scripts, closed, contexts, chromium: { launch: async (o: unknown) => { launched.push(o); return browser; } } };
    }

    it('keeps the caller\'s options and adds --mute-audio to its own args', async () => {
      const f = fakeChromium();
      await launchSilent(f.chromium as never, { executablePath: '/x', args: ['--foo'] });
      await launchSilent(f.chromium as never);
      expect(f.launched).toEqual([{ executablePath: '/x', args: ['--foo', '--mute-audio'] }, { args: ['--mute-audio'] }]);
    });

    it('runs muteSpeech in every context and page it opens, and hands back nothing else', async () => {
      const f = fakeChromium();
      const browser = await launchSilent(f.chromium as never);
      const phone = { viewport: { width: 390, height: 844 }, isMobile: true }, icon = { viewport: { width: 192, height: 192 } };
      await browser.newContext(phone);
      expect(await browser.newPage(icon)).toBe('page');
      await browser.close();
      expect(f.contexts, 'the caller\'s context and page options reach the browser unchanged').toEqual([phone, icon]);
      expect(f.scripts).toEqual([muteSpeech, muteSpeech]);
      expect(f.closed).toEqual(['browser']);
      expect(Object.keys(browser).sort()).toEqual(['close', 'newContext', 'newPage']);
    });
  });
});
