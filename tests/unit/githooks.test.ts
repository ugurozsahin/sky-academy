import { readFileSync, readdirSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import pkg from '../../package.json';

// The opt-in git hooks (#1382) may only run what CI runs, so a hook cannot pass what CI fails or fail what CI passes.
const scripts = (pkg as { scripts: Record<string, string> }).scripts;
const dir = new URL('../../.githooks/', import.meta.url);
const hooks = readdirSync(dir);
const commands = (name: string) => readFileSync(new URL(name, dir), 'utf8').split('\n')
  .filter((l) => /^(npx|npm)\b/.test(l.trim())).flatMap((l) => l.split('&&').map((c) => c.trim()));

describe('.githooks (#1382)', () => {
  it('holds exactly pre-commit and pre-push', () => expect(hooks.sort()).toEqual(['pre-commit', 'pre-push']));

  it.each(hooks)('%s is executable and starts with a shebang', (h) => {
    expect(statSync(new URL(h, dir)).mode & 0o111, `${h} must be chmod +x`).not.toBe(0);
    expect(readFileSync(new URL(h, dir), 'utf8').startsWith('#!/bin/sh\n')).toBe(true);
  });

  it.each(hooks)('%s runs only npm scripts, or the tsc call `build` makes', (h) => {
    const cmds = commands(h);
    expect(cmds.length).toBeGreaterThan(0);
    for (const c of cmds) {
      const m = /^npm (?:run )?(?:--silent )?(\w[\w:-]*)(?: --if-present)?$/.exec(c);
      if (m) { expect(m[1] in scripts || c.endsWith('--if-present'), `${c}: no such npm script`).toBe(true); continue; }
      expect(c, `${c} is not something CI runs`).toBe('npx tsc --noEmit');
      expect(scripts.build).toContain('tsc --noEmit');
    }
  });

  it('pre-commit stays fast and pre-push runs the CI unit step', () => {
    expect(commands('pre-commit')).not.toContain('npm test');
    expect(commands('pre-push')).toEqual(['npm test']);
  });

  it('`npm run hooks` sets the path by hand, and nothing installs it on `npm ci` (a routine clone must not change)', () => {
    expect(scripts.hooks).toBe('git config core.hooksPath .githooks');
    for (const s of ['preinstall', 'install', 'postinstall', 'prepare']) expect(scripts[s], `${s} would run on every routine's npm ci`).toBeUndefined();
  });
});
