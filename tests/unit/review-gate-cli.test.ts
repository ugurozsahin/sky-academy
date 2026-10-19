import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

/** #138 — the CLI must not let an empty body read as a clean `closes: nothing`. TIGHTENING. */
const dir = mkdtempSync(join(tmpdir(), 'rg-cli-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));
const run = (content: string) => {
  const f = join(dir, 'body.md');
  writeFileSync(f, content);
  return spawnSync(process.execPath, ['scripts/review-gate.mjs', f], { encoding: 'utf8' });
};

describe('review-gate CLI on an empty body (#138)', () => {
  it.each(['', '   \n\t\n'])('fails with its own message for %j', (body) => {
    const r = run(body);
    expect(r.status).not.toBe(0);
    expect(r.stdout).not.toContain('closes: nothing');
    expect(r.stderr).toContain('EMPTY BODY');
  });
  it('still prints closes: nothing, exit 0, for a real body that closes nothing', () => {
    const r = run('Part of #5\n\nSome text.');
    expect(r.status).toBe(0);
    expect(r.stdout.trim()).toBe('closes: nothing');
  });
  it('still lists what a body closes', () => {
    expect(run('Closes #138 #232').stdout.trim()).toBe('closes: #138');
  });
});
