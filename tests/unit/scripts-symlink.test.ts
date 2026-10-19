import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * #309: the CLI guard of every build script compared `resolve(argv[1])` with `import.meta.url`. `resolve()` does
 * not follow symlinks and `import.meta.url` does, so a script reached through a symlinked directory (macOS
 * `/var` -> `/private/var`, a Desktop alias) never matched: the CLI block was skipped and the script exited 0
 * having written nothing. The spaced-path rail in `scripts.test.ts` side-steps this with `realpathSync(tmpdir())`,
 * so nothing ran a script through a link until this.
 */
describe('script CLI guards compare real paths (#309)', () => {
  it('build-sw.mjs still errors loudly when it is run through a symlinked directory', () => {
    const base = mkdtempSync(join(realpathSync(tmpdir()), 'sna symlink rail '));
    try {
      const real = join(base, 'real');
      mkdirSync(real);
      writeFileSync(join(real, 'build-sw.mjs'), readFileSync(new URL('../../scripts/build-sw.mjs', import.meta.url)));
      symlinkSync(real, join(base, 'link'));
      let exitCode: number | null = 0;
      let stderr = '';
      try {
        execFileSync('node', [join(base, 'link', 'build-sw.mjs'), 'nonexistent-dist-xyz'], { encoding: 'utf8', stdio: 'pipe' });
      } catch (e) {
        const err = e as { status: number | null; stderr?: Buffer | string };
        exitCode = err.status;
        stderr = err.stderr?.toString() ?? '';
      }
      // Before the fix: exitCode 0, stderr '' — the guard did not match, so nothing ran.
      expect(exitCode).not.toBe(0);
      expect(stderr).toContain('index.html is missing');
    } finally {
      rmSync(base, { recursive: true, force: true });
    }
  });

  it('no script still gates its CLI block on resolve(argv[1])', () => {
    const dir = new URL('../../scripts/', import.meta.url);
    const offenders = readdirSync(dir)
      .filter(f => f.endsWith('.mjs'))
      .filter(f => /resolve\(process\.argv\[1\]\)\s*===/.test(readFileSync(new URL(f, dir), 'utf8')));
    expect(offenders, 'compare realpathSync of both sides (#309)').toEqual([]);
  });
});
