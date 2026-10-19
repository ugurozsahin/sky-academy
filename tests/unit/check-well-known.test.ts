import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer, type Server } from 'node:http';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { FILES, expectedFiles, checkAll } from '../../scripts/check-well-known.mjs';

/** #2029: the post-deploy check, against a local server that plays each way a host can go wrong. */
const [AL, AASA] = FILES;
const FP = Array.from({ length: 32 }, (_, i) => i.toString(16).padStart(2, '0').toUpperCase()).join(':');
let mode: Record<string, { status: number; type?: string; location?: string; body?: string }> = {};
let server: Server; let base = '';

beforeAll(async () => {
  server = createServer((req, res) => {
    const m = mode[(req.url ?? '').slice(1)] ?? { status: 404 };
    res.writeHead(m.status, { ...(m.type ? { 'content-type': m.type } : {}), ...(m.location ? { location: m.location } : {}) });
    res.end(m.body ?? '{}');
  });
  await new Promise<void>(r => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => { server.close(); });

const both = { [AL]: true, [AASA]: true };
const ok = { status: 200, type: 'application/json' };

describe('check-well-known (#2029)', () => {
  it('passes when both expected files are 200 JSON, charset allowed', async () => {
    mode = { [AL]: ok, [AASA]: { status: 200, type: 'application/json; charset=utf-8' } };
    expect(await checkAll(base, both)).toEqual([]);
  });
  it('fails on a redirect, naming where it went', async () => {
    mode = { [AL]: { status: 301, location: 'https://www.example/x' }, [AASA]: ok };
    const p = await checkAll(base, both);
    expect(p).toHaveLength(1);
    expect(p[0]).toMatch(/redirected \(301 to https:\/\/www\.example\/x\)/);
  });
  it('fails on a 404 for an expected file', async () => {
    mode = { [AL]: ok };
    const p = await checkAll(base, both);
    expect(p).toHaveLength(1);
    expect(p[0]).toMatch(/apple-app-site-association: status 404/);
  });
  it('fails on a wrong content type (the extensionless file case)', async () => {
    mode = { [AL]: ok, [AASA]: { status: 200, type: 'application/octet-stream' } };
    expect((await checkAll(base, both))[0]).toMatch(/content-type "application\/octet-stream", want application\/json/);
    mode = { [AL]: ok, [AASA]: { status: 200 } };
    expect((await checkAll(base, both))[0]).toMatch(/content-type ""/);
  });
  it('fails on a body that is not JSON', async () => {
    mode = { [AL]: { ...ok, body: '<html>' }, [AASA]: ok };
    expect((await checkAll(base, both))[0]).toMatch(/not JSON/);
  });
  it('an intentionally absent file must be 404; any other answer fails', async () => {
    mode = { [AL]: ok };
    expect(await checkAll(base, { [AL]: true, [AASA]: false })).toEqual([]);
    mode = { [AL]: ok, [AASA]: ok };
    expect((await checkAll(base, { [AL]: true, [AASA]: false }))[0]).toMatch(/not expected .* answered 200/);
  });
  it('a host that does not answer fails rather than throws', async () => {
    expect((await checkAll('http://127.0.0.1:1', both))[0]).toMatch(/request failed/);
  });
});

describe('which files are expected (the generator decides)', () => {
  const pkg = 'uk.co.sharpwise.app';
  it('assetlinks follows the fingerprint, exactly as app-links.mjs does; iOS follows the flag', () => {
    expect(expectedFiles(pkg, undefined, false)).toEqual({ [AL]: false, [AASA]: false });
    expect(expectedFiles(pkg, '  ', false)[AL]).toBe(false);
    expect(expectedFiles(pkg, FP, false)).toEqual({ [AL]: true, [AASA]: false });
    expect(expectedFiles(pkg, FP, true)).toEqual({ [AL]: true, [AASA]: true });
  });
});

describe('the command line', () => {
  // async spawn: the test's own server must keep answering while the child runs
  const run = (args: string[], env: Record<string, string> = {}) => new Promise<{ status: number | null; stderr: string }>(done => {
    const p = spawn('node', ['scripts/check-well-known.mjs', ...args], { env: { PATH: process.env.PATH ?? '', ...env } });
    let stderr = '';
    p.stderr.on('data', d => { stderr += d; });
    p.on('close', status => done({ status, stderr }));
  });
  it('exits 2 without a URL, 1 on failure with the message, 0 when as intended', async () => {
    expect((await run([])).status).toBe(2);
    mode = {};
    const bad = await run([base], { ANDROID_APP_LINKS_SHA256: FP });
    expect(bad.status).toBe(1);
    expect(bad.stderr).toContain('FAIL');
    expect((await run([base])).status).toBe(0); // nothing generated, nothing served: both 404 as intended
    mode = { [AL]: ok };
    expect((await run([base], { ANDROID_APP_LINKS_SHA256: FP })).status).toBe(0);
    expect((await run([base, '--ios'], { ANDROID_APP_LINKS_SHA256: FP })).status).toBe(1);
  });
});

describe('the workflow runs it after the deploy, without gating anything else', () => {
  const wf = readFileSync(new URL('../../.github/workflows/pages.yml', import.meta.url), 'utf8');
  it('has a check job that needs deploy, runs the script on the live domain and shares the fingerprint variable', () => {
    const [before, job = ''] = wf.split(/^  check:\n/m);
    expect(job).toMatch(/needs: deploy/);
    expect(job).toContain('node scripts/check-well-known.mjs https://sharpwise.co.uk');
    expect(job).toContain('ANDROID_APP_LINKS_SHA256: ${{ vars.ANDROID_APP_LINKS_SHA256 }}');
    expect(before).not.toMatch(/needs: check/);
  });
});
