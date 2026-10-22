import { execFileSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { resolvePath, serve } from '../../scripts/site-serve.mjs';
import { workflow } from './helpers/sources';

/**
 * #2096: the website's e2e. Before it, a pull request that touched only `website/` ran no browser at all, and
 * the three checks every page PR needs (no sideways scroll at 360 px, nav links answer, nothing third-party) were
 * done by hand. These rails hold the three parts that make it run: the static server it is served by, the path
 * filter in ci.yml that sends a website diff to it, and the step that consumes that filter.
 */
describe('scripts/site-serve.mjs serves website/ and the game the way Pages lays them out (#2096)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sna-site-'));
  const site = join(dir, 'site'), game = join(dir, 'game');
  const mounts: Array<[string, string]> = [['/play/', game], ['/', site]];
  beforeAll(() => {
    mkdirSync(join(site, 'about'), { recursive: true }); mkdirSync(game);
    writeFileSync(join(site, 'index.html'), 'home'); writeFileSync(join(site, 'about', 'index.html'), 'about');
    writeFileSync(join(site, '404.html'), 'lost'); writeFileSync(join(site, 'site.css'), 'a{}');
    writeFileSync(join(game, 'index.html'), 'game'); writeFileSync(join(dir, 'secret.txt'), 'no');
  });
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it.each([
    ['/', { file: join(site, 'index.html') }],
    ['/about/', { file: join(site, 'about', 'index.html') }],
    ['/about', { redirect: '/about/' }],                       // as Pages does, so a link without its slash is seen as a 301
    ['/site.css?v=1#x', { file: join(site, 'site.css') }],
    ['/play/', { file: join(game, 'index.html') }],
    ['/play', { redirect: '/play/' }],
    ['/playground/', null],                                    // a prefix match on `/play`, not a mount
    ['/missing/', null],
    ['/../secret.txt', null], ['/%2e%2e/secret.txt', null], ['/play/../../secret.txt', null], ['/%E0%A4%A', null],
  ])('%s → %j', (path, want) => {
    expect(resolvePath(path, mounts)).toEqual(want);
  });

  it('answers 200, 301, 404 with the 404 page, and 405, with the right content type', async () => {
    const s = await serve({ mounts });
    try {
      const home = await fetch(`${s.origin}/`);
      expect([home.status, home.headers.get('content-type'), await home.text()]).toEqual([200, 'text/html; charset=utf-8', 'home']);
      const css = await fetch(`${s.origin}/site.css`);
      expect([css.status, css.headers.get('content-type')]).toEqual([200, 'text/css; charset=utf-8']);
      const moved = await fetch(`${s.origin}/about`, { redirect: 'manual' });
      expect([moved.status, moved.headers.get('location')]).toEqual([301, '/about/']);
      const lost = await fetch(`${s.origin}/nope/`);
      expect([lost.status, await lost.text()]).toEqual([404, 'lost']);
      expect((await fetch(`${s.origin}/`, { method: 'POST' })).status).toBe(405);
      const head = await fetch(`${s.origin}/`, { method: 'HEAD' });
      expect([head.status, await head.text()]).toEqual([200, '']);
      expect(s.origin, 'bound to loopback only').toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
    } finally { await s.close(); }
  });
});

describe('ci.yml sends a website diff to the site project, and only there (#2096)', () => {
  const lines = workflow('ci.yml').split('\n');
  const at = lines.findIndex(l => l.includes('id: scope'));
  const runAt = lines.findIndex((l, i) => i > at && /^\s*run:\s*\|\s*$/.test(l));
  const indent = /^\s*/.exec(lines[runAt + 1] ?? '')![0].length;
  let end = runAt + 1;
  while (end < lines.length && (lines[end].trim() === '' || /^\s*/.exec(lines[end])![0].length >= indent)) end++;
  const script = lines.slice(runAt + 1, end).map(l => l.slice(indent)).join('\n');

  /** The scope step's REAL script, with a `git` shim that prints `files` (or fails), as GitHub would feed it. */
  const scope = (files: string[] | 'git-fails', event = 'pull_request') => {
    const tmp = mkdtempSync(join(tmpdir(), 'sna-scope-site-'));
    try {
      const shim = join(tmp, 'git');
      writeFileSync(shim, files === 'git-fails' ? '#!/bin/sh\nexit 128\n' : `#!/bin/sh\nprintf '%s\\n' ${files.map(f => `'${f}'`).join(' ')}\n`);
      chmodSync(shim, 0o755);
      const out = join(tmp, 'out'), summary = join(tmp, 'summary');
      writeFileSync(out, ''); writeFileSync(summary, '');
      execFileSync('bash', ['-c', script], { stdio: 'pipe', env: { ...process.env, PATH: `${tmp}:${process.env.PATH}`, BASE: 'b', HEAD: 'h', EVENT: event, GITHUB_OUTPUT: out, GITHUB_STEP_SUMMARY: summary } });
      const kv = Object.fromEntries(readFileSync(out, 'utf8').trim().split('\n').map(l => l.split('=')));
      return { e2e: kv.e2e, site: kv.site, summary: readFileSync(summary, 'utf8') };
    } finally { rmSync(tmp, { recursive: true, force: true }); }
  };

  it('the scope step was found and declares SITE_PATHS', () => {
    expect(at, 'ci.yml must still have the scope step').toBeGreaterThan(-1);
    expect(script).toContain("SITE_PATHS='");
  });
  // One file per case, so a typo in one alternative cannot hide behind another.
  it.each([
    [['website/index.html'], { e2e: 'false', site: 'true' }],
    [['website/curriculum/year-3/index.html'], { e2e: 'false', site: 'true' }],
    [['website/site.css'], { e2e: 'false', site: 'true' }],
    [['tests/site/site.spec.ts'], { e2e: 'false', site: 'true' }],
    [['scripts/site-serve.mjs'], { e2e: 'false', site: 'true' }],
    [['scripts/site-serve.d.mts'], { e2e: 'false', site: 'true' }],
    [['playwright.config.ts'], { e2e: 'true', site: 'true' }],   // it declares the project
    [['tests/e2e/fixtures.ts'], { e2e: 'true', site: 'true' }],  // the spec imports it
    [['tests/e2e/mute.mjs'], { e2e: 'true', site: 'true' }],
    [['package-lock.json'], { e2e: 'true', site: 'true' }],      // Playwright's version
    [['.github/workflows/ci.yml'], { e2e: 'true', site: 'true' }],
    [['tests/e2e/game.spec.ts'], { e2e: 'true', site: 'false' }],
    [['src/ui/play.ts'], { e2e: 'true', site: 'false' }],
    [['scripts/site-sitemap.mjs'], { e2e: 'false', site: 'false' }],
    [['docs/ROUTINE-PROMPT.md'], { e2e: 'false', site: 'false' }],
  ])('%j → %j', (files, want) => {
    expect(scope(files)).toMatchObject(want);
  });
  it('a diff that cannot be read runs it; the nightly leaves it to the full matrix; the summary names the file', () => {
    expect(scope('git-fails')).toMatchObject({ site: 'true' });
    expect(scope(['website/index.html'], 'schedule')).toMatchObject({ e2e: 'true', site: 'false' });
    expect(scope(['website/about/index.html']).summary).toMatch(/### website: \*\*running\*\*[\s\S]*- website\/about\/index\.html/);
  });

  const stepOf = (needle: string) => {
    const i = lines.findIndex(l => l.includes(needle));
    expect(i, `ci.yml must have a step containing ${needle}`).toBeGreaterThan(-1);
    let from = i; while (from >= 0 && !/^\s*- /.test(lines[from])) from--;
    const sibling = new RegExp(`^\\s{${lines[from].indexOf('- ')}}- `);
    let to = from + 1; while (to < lines.length && !sibling.test(lines[to])) to++;
    return lines.slice(from, to).join('\n');
  };
  it('a step consumes the site output on a pull request, the browser setup runs for it, and the nightly carries the project', () => {
    const step = stepOf('playwright test --project=site');
    expect(step).toMatch(/if:\s*github\.event_name == 'pull_request' && steps\.scope\.outputs\.site == 'true'\s*$/m);
    expect(step, 'one project, no ternary').toMatch(/run:\s*npx playwright test --project=site\s*$/m);
    for (const needle of ['playwright install', 'sources.list.d/google-chrome'])
      expect(stepOf(needle), `the ${needle} step must also run for a website-only pull request`).toMatch(/steps\.scope\.outputs\.site == 'true'/);
    expect(lines.find(l => /playwright test \$\{\{/.test(l)), 'the full-matrix arm carries the site project').toMatch(/--project=site[\s']/);
  });
});

describe('the site project walks the sitemap at 360 px and lets nothing off the origin (#2096)', () => {
  const config = readFileSync('playwright.config.ts', 'utf8');
  const spec = readFileSync('tests/site/site.spec.ts', 'utf8');

  it('is declared on its own testDir at the phone width, after setup', () => {
    const line = config.split('\n').find(l => /name:\s*'site'/.test(l));
    expect(line).toMatch(/testDir:\s*'tests\/site'/);
    expect(line).toMatch(/viewport:\s*\{\s*width:\s*360\b/);
    expect(line).toMatch(/dependencies:\s*\['setup'\]/);
  });

  it('reads the sitemap, serves through site-serve, and blocks every request off the origin with no allow-list', () => {
    expect(spec).toContain("readFileSync('website/sitemap.xml'");
    expect(spec).toContain("from '../../scripts/site-serve.mjs'");
    expect(spec).toMatch(/new URL\(url\)\.origin === site\.origin\) return route\.continue\(\)/);
    expect(spec.match(/route\.continue\(/g), 'one way through, the local origin: a second `continue` is an allow-list').toHaveLength(1);
    expect(spec, 'a sitemap entry that redirects is not an answer').toContain('redirectedFrom()');
    expect(spec).toMatch(/expect\(outbound[^)]*\)\.toEqual\(\[\]\)/);
    expect(spec).toMatch(/scrollWidth/);
    expect(spec).toMatch(/maxRedirects:\s*0/);
    // #2163: what the assertions compare, not only that they exist.
    expect(spec, 'lazy images load, so an off-origin one below the fold is a request at all').toContain(`querySelectorAll('[loading="lazy"]').forEach(e => e.setAttribute('loading', 'eager'))`);
    expect(spec, 'no slack on the scroll comparison').toContain('expect(scroll,');
    expect(spec).toMatch(/expect\(scroll,[^\n]*\)\.toBeLessThanOrEqual\(view\);/);
    expect(spec, 'a page without its viewport meta would lay out wider than the phone').toMatch(/expect\(view,[^\n]*\)\.toBe\(360\);/);
    expect(spec, 'a same-page anchor nothing carries').toMatch(/expect\(lost,[^\n]*\)\.toEqual\(\[\]\);/);
  });

  it('.claude/rules/e2e.md records the project and the paths that run it', () => {
    const rule = readFileSync('.claude/rules/e2e.md', 'utf8');
    expect(rule).toContain('`site` (#2096)');
    expect(rule).toContain('`website/`');
  });
});
