import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { CATALOGUE } from '../../src/config/catalogue';
import { MAX_BYTES } from '../../scripts/site-shots.mjs';
import { plannedJobs, plannedFiles, overCap, parseArgs, SHOT_BYTES, THUMB_BYTES, THUMB_CROP, THUMB_SIZE, PARALLEL } from '../../scripts/game-shots.mjs';

const root = new URL('../../', import.meta.url).pathname;

/** #2202: the catalogue's pictures are made by scripts/game-shots.mjs from the catalogue, never from a second list. */
describe('game screenshots (#2202)', () => {
  const jobs = plannedJobs();
  const media = [
    ...Object.values(CATALOGUE.games).flatMap(g => [g.media.thumbnail.src, ...g.media.screenshots.map(s => s.src)]),
    ...Object.values(CATALOGUE.years).flatMap(y => [y.media.thumbnail.src, ...y.media.screenshots.map(s => s.src)]),
  ];
  it('plans exactly every media src in the catalogue, once each', () => {
    expect([...plannedFiles(jobs)].sort()).toEqual([...media].sort());
    expect(new Set(plannedFiles(jobs)).size).toBe(plannedFiles(jobs).length);
  });
  it('plans one job per game and per island', () => {
    expect(jobs.filter(j => j.kind === 'game')).toHaveLength(Object.keys(CATALOGUE.games).length);
    expect(jobs.filter(j => j.kind === 'island').map(j => j.id)).toEqual(Object.keys(CATALOGUE.years));
  });
  it('catches a media src the script would not plan, and one it planned twice', () => {
    const extra = structuredClone(CATALOGUE) as unknown as { games: Record<string, { media: { screenshots: { src: string }[] } }> };
    const id = Object.keys(extra.games)[0];
    extra.games[id].media.screenshots.push({ src: `img/games/${id}/2.webp` });
    expect(plannedFiles(plannedJobs(extra))).toContain(`img/games/${id}/2.webp`);
    expect(plannedFiles(plannedJobs(extra)).length).toBe(media.length + 1);
  });
  it('holds the caps the issue names, the screenshot cap being the site shots\'', () => {
    expect(SHOT_BYTES).toBe(MAX_BYTES);
    expect(THUMB_BYTES).toBe(25 * 1024);
    expect(THUMB_CROP).toBe(320);
    expect(THUMB_SIZE).toBeLessThan(THUMB_CROP);
    expect(PARALLEL).toBe(4);
  });
  it('names every file over its cap, and none at it', () => {
    const files = [{ file: 'a.webp', bytes: 150 * 1024, cap: SHOT_BYTES }, { file: 'b.webp', bytes: THUMB_BYTES + 1, cap: THUMB_BYTES }, { file: 'c.webp', bytes: THUMB_BYTES, cap: THUMB_BYTES }];
    expect(overCap(files)).toEqual([`b.webp (${THUMB_BYTES + 1} bytes, cap ${THUMB_BYTES})`]);
  });
  it('reads --only as a list of ids', () => {
    expect(parseArgs(['http://x/', 'out'])).toEqual({ base: 'http://x/', out: 'out', only: null });
    expect(parseArgs(['http://x/', 'out', '--only', 'a,b'])).toMatchObject({ only: ['a', 'b'] });
  });
  it('is run by `npm run game:shots`, which builds, previews on its own port and runs the script', () => {
    const cmd = JSON.parse(readFileSync(root + 'package.json', 'utf8')).scripts['game:shots'] as string;
    expect(cmd).toContain('npm run build');
    expect(cmd).toContain('vite preview');
    expect(cmd).toContain('node scripts/game-shots.mjs');
    expect(cmd).not.toContain(':4399');                    // site:shots' port
  });
  it('git-ignores game-shots/ and commits no file under it', () => {
    expect(execFileSync('git', ['ls-files', 'game-shots'], { cwd: root, encoding: 'utf8' }).trim()).toBe('');
    expect(() => execFileSync('git', ['check-ignore', '-q', 'game-shots/x.webp'], { cwd: root }), 'game-shots/ is not ignored').not.toThrow();
  });
});
