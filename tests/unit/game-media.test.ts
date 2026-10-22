import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer, type Server } from 'node:http';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { CATALOGUE, type Catalogue } from '../../src/config/catalogue';
import { TOPICS, shownYears, type YearId } from '../../src/curriculum';
import { catalogueShown, gameOn, islandShown } from '../../src/curriculum/catalogue-shown';
import { mediaPlan, checkMedia, checkFile } from '../../scripts/game-media.mjs';

/** #2203: the Pages deploy publishes the pictures of what the repository catalogue shows, and checks them after. */
type Mut = { years: Record<string, { visible: 'auto' | boolean }>; games: Record<string, { visible: boolean; years: Record<string, { visible: boolean }> }> };
const copy = (edit: (c: Mut) => void): Catalogue => { const c = structuredClone(CATALOGUE) as unknown as Mut; edit(c); return c as unknown as Catalogue; };
const allMedia = (cat: Catalogue) => [...Object.values(cat.years), ...Object.values(cat.games)]
  .flatMap(n => [n.media.thumbnail.src, ...n.media.screenshots.map(s => s.src)]);
const core = (year: YearId, subject: 'maths' | 'writing') => TOPICS.filter(t => t.year === year && t.subject === subject && !t.drill);

describe('what the catalogue shows (src/curriculum/catalogue-shown.ts)', () => {
  it('with the committed file: exactly the islands the map shows today, and every game on them, drills included', () => {
    const shown = catalogueShown(CATALOGUE, TOPICS);
    expect(shown.years).toEqual(shownYears().map(y => y.id));
    const onShown = TOPICS.filter(t => shown.years.includes(t.year)).map(t => t.id);
    expect([...shown.games].sort()).toEqual([...onShown].sort());
    expect(shown.games.length, 'the registry has drills, and the catalogue holds them').toBeGreaterThan(TOPICS.filter(t => !t.drill && shown.years.includes(t.year)).length);
  });
  it('an island: true always shows, false never, "auto" by the gate', () => {
    expect(islandShown(copy(c => { c.years.year1.visible = false; }), 'year1', TOPICS)).toBe(false);
    expect(islandShown(copy(c => { c.years.year1.visible = true; }), 'year1', TOPICS)).toBe(true);
    expect(islandShown(CATALOGUE, 'year1', TOPICS), 'EYFS/KS1 on auto always shows, as today').toBe(true);
    const fewTopics = TOPICS.filter(t => t.year !== 'year3' || t.subject !== 'maths').concat(core('year3', 'maths').slice(0, 11));
    expect(islandShown(CATALOGUE, 'year3', fewTopics), 'a KS2 island with 11 maths topics is under the gate').toBe(false);
    expect(islandShown(copy(c => { c.years.year3.visible = true; }), 'year3', fewTopics), 'true beats the gate').toBe(true);
  });
  it('the gate counts only the games the catalogue switches on, globally or for the year, and never a drill', () => {
    expect(islandShown(CATALOGUE, 'year3', TOPICS)).toBe(true);
    const maths = core('year3', 'maths');
    const hideAllBut = (n: number, how: 'global' | 'year') => copy(c => {
      for (const t of maths.slice(n)) { if (how === 'global') c.games[t.id].visible = false; else c.games[t.id].years.year3.visible = false; }
    });
    expect(islandShown(hideAllBut(11, 'global'), 'year3', TOPICS)).toBe(false);
    expect(islandShown(hideAllBut(11, 'year'), 'year3', TOPICS)).toBe(false);
    expect(islandShown(hideAllBut(12, 'global'), 'year3', TOPICS), '12 maths is the KS2 bar').toBe(true);
    const writing = core('year3', 'writing');
    const writingOn = (n: number) => copy(c => { for (const t of writing.slice(n)) c.games[t.id].visible = false; });
    expect(islandShown(writingOn(5), 'year3', TOPICS), 'and 6 writing').toBe(false);
    expect(islandShown(writingOn(6), 'year3', TOPICS)).toBe(true);
    const under = hideAllBut(11, 'global'), stillOn = maths[0].id;
    expect(gameOn(under, stillOn, 'year3')).toBe(true);
    expect(catalogueShown(under, TOPICS).games, 'a game still on, on an island under its gate, is hidden').not.toContain(stillOn);
    expect(mediaPlan(under, catalogueShown(under, TOPICS)).withheld).toContain(CATALOGUE.games[stillOn].media.thumbnail.src);
    const drills = TOPICS.filter(t => t.year === 'year3' && t.drill);
    expect(drills.length, 'year 3 has a drill to hide').toBeGreaterThan(0);
    expect(islandShown(copy(c => { for (const t of drills) c.games[t.id].visible = false; }), 'year3', TOPICS)).toBe(true);
  });
  it('a game shows when it is on, globally and for its year, and its island shows', () => {
    const [a, b, c3] = [core('year1', 'maths')[0].id, core('year1', 'writing')[0].id, core('year2', 'maths')[0].id];
    expect(gameOn(CATALOGUE, a, 'year1')).toBe(true);
    expect(gameOn(CATALOGUE, a, 'year2'), 'a game is on only for a year it has a node for').toBe(false);
    expect(gameOn(CATALOGUE, 'no-such-game', 'year1')).toBe(false);
    const cat = copy(c => { c.games[a].visible = false; c.games[b].years.year1.visible = false; c.years.year2.visible = false; });
    const shown = catalogueShown(cat, TOPICS);
    expect(shown.games).not.toContain(a);
    expect(shown.games).not.toContain(b);
    expect(shown.games, 'every game on a hidden island is hidden').not.toContain(c3);
    expect(shown.years).toContain('year1');
    expect(shown.years).not.toContain('year2');
    expect(shown.games.length).toBe(Object.keys(CATALOGUE.games).length - 2 - TOPICS.filter(t => t.year === 'year2').length);
  });
});

describe('the media plan (scripts/game-media.mjs)', () => {
  it('with the committed file: every media src published, none withheld, islands then games captured', () => {
    const shown = catalogueShown(CATALOGUE, TOPICS);
    const plan = mediaPlan(CATALOGUE, shown);
    expect([...plan.publish].sort()).toEqual([...allMedia(CATALOGUE)].sort());
    expect(plan.withheld).toEqual([]);
    expect(plan.ids).toEqual([...shown.years, ...shown.games]);
  });
  it('a hidden game and a hidden island are withheld; every src is in exactly one list', () => {
    const id = core('year1', 'maths')[0].id;
    const cat = copy(c => { c.games[id].visible = false; c.years.year2.visible = false; });
    const plan = mediaPlan(cat, catalogueShown(cat, TOPICS));
    expect(plan.withheld).toEqual(expect.arrayContaining([CATALOGUE.games[id].media.thumbnail.src, CATALOGUE.years.year2.media.thumbnail.src]));
    expect(plan.publish).not.toContain(CATALOGUE.games[id].media.thumbnail.src);
    expect(plan.ids).not.toContain(id);
    expect(plan.ids).not.toContain('year2');
    expect([...plan.publish, ...plan.withheld].sort()).toEqual([...allMedia(CATALOGUE)].sort());
  });
});

// The post-deploy check, against a local server that plays each way a host can go wrong (modelled on #2029's).
let mode: Record<string, { status: number; type?: string }> = {};
let fallback: { status: number; type?: string } = { status: 404 };
let server: Server; let base = '';
beforeAll(async () => {
  server = createServer((req, res) => {
    const m = mode[(req.url ?? '').slice(1)] ?? fallback;
    res.writeHead(m.status, m.type ? { 'content-type': m.type } : {});
    res.end('RIFF');
  });
  await new Promise<void>(r => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => { server.close(); });
const webp = { status: 200, type: 'image/webp' };

describe('the post-deploy media check', () => {
  it('passes a published file at 200 image/webp and a withheld one at 404', async () => {
    mode = { 'img/a.webp': webp };
    expect(await checkMedia(base, { publish: ['img/a.webp'], withheld: ['img/b.webp'] })).toEqual([]);
  });
  it('fails a published file that is missing, redirected or of the wrong type', async () => {
    mode = { 'img/r.webp': { status: 301 }, 'img/t.webp': { status: 200, type: 'text/html' }, 'img/n.webp': { status: 200 } };
    const p = await checkMedia(base, { publish: ['img/m.webp', 'img/r.webp', 'img/t.webp', 'img/n.webp'], withheld: [] });
    expect(p).toHaveLength(4);
    expect(p.join('\n')).toMatch(/n\.webp: content-type "", want image\/webp/);
    expect(p.join('\n')).toMatch(/m\.webp: status 404, want 200/);
    expect(p.join('\n')).toMatch(/r\.webp: status 301, want 200/);
    expect(p.join('\n')).toMatch(/t\.webp: content-type "text\/html", want image\/webp/);
  });
  it('fails a withheld file that is served', async () => {
    mode = { 'img/h.webp': webp, 'img/r.webp': { status: 301 } };
    const p = await checkMedia(base, { publish: [], withheld: ['img/h.webp', 'img/r.webp'] });
    expect(p.join('\n')).toMatch(/h\.webp: withheld .* answered 200; want 404/);
    expect(p.join('\n')).toMatch(/r\.webp: withheld .* answered 301; want 404/);
  });
  it('a host that does not answer fails rather than throws', async () => {
    expect((await checkFile('http://127.0.0.1:1', 'img/a.webp', true))[0]).toMatch(/request failed/);
  });
});

describe('the command line', () => {
  const run = (args: string[]) => new Promise<{ status: number | null; stdout: string; stderr: string }>(done => {
    const p = spawn('node', ['scripts/game-media.mjs', ...args], { env: { PATH: process.env.PATH ?? '' } });
    let stdout = '', stderr = '';
    p.stdout.on('data', d => { stdout += d; });
    p.stderr.on('data', d => { stderr += d; });
    p.on('close', status => done({ status, stdout, stderr }));
  });
  it('exits 2 on bad usage', async () => {
    expect((await run([])).status).toBe(2);
    expect((await run(['check', 'sharpwise.co.uk'])).status).toBe(2);
  });
  it('ids prints the plan the shared helper makes, over the real registry', async () => {
    const out = await run(['ids']);
    expect(out.status).toBe(0);
    expect(out.stdout.trim()).toBe(mediaPlan(CATALOGUE, catalogueShown(CATALOGUE, TOPICS)).ids.join(','));
  }, 60_000);
  it('check exits 0 when every picture is served as WebP, 1 with the failures named otherwise', async () => {
    mode = {}; fallback = webp;
    expect((await run(['check', base])).status).toBe(0);
    fallback = { status: 404 };
    const bad = await run(['check', base]);
    expect(bad.status).toBe(1);
    expect(bad.stderr).toMatch(/^FAIL .*status 404/m);
  }, 60_000);
});

describe('the Pages workflow runs it (#2203)', () => {
  const wf = readFileSync(new URL('../../.github/workflows/pages.yml', import.meta.url), 'utf8');
  it('captures what the catalogue shows into the site, after the site shots and before the upload, and fails the deploy on a failure', () => {
    const siteShots = wf.indexOf('node scripts/site-shots.mjs http://localhost:4173/play/ site/img');
    const step = wf.indexOf('- name: Game and island pictures into site/img (#2203)');
    const ids = wf.indexOf('ids="$(node scripts/game-media.mjs ids)"');
    const shots = wf.indexOf('node scripts/game-shots.mjs http://localhost:4173/play/ site --only "$ids"');
    const upload = wf.indexOf('uses: actions/upload-pages-artifact');
    expect(siteShots).toBeGreaterThan(-1);
    expect(step).toBeGreaterThan(siteShots);
    expect(ids).toBeGreaterThan(step);
    expect(shots).toBeGreaterThan(ids);
    expect(upload).toBeGreaterThan(shots);
    expect(wf.slice(step, upload)).not.toMatch(/continue-on-error|^\s+if:|\|\|\s*(true|:)|\bset \+e\b/m);
  });
  it('checks every picture on the live domain in the check job, even when the .well-known check failed', () => {
    const [, job = ''] = wf.split(/^ {2}check:\n/m);
    const step = job.slice(job.indexOf('- name: Every published game and island picture'));
    expect(step).toContain('npm ci');
    expect(step).toContain('node scripts/game-media.mjs check https://sharpwise.co.uk && exit 0');
    expect(step).toMatch(/if: \$\{\{ !cancelled\(\) \}\}/);
  });
});
