import { test, expect } from './fixtures';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * #2217: the text rail in `tests/unit/resolve.test.ts` lists spellings of an import; this reads what was built. The full
 * `catalogue.json` carries media and playability, so none of its markers may be in any game chunk, whichever way it got in.
 */
test('no built chunk holds the full catalogue: no playability, game or island media paths (#2217)', () => {
  const dir = join(process.cwd(), 'dist', 'assets');
  const chunks = readdirSync(dir).filter(f => f.endsWith('.js'));
  expect(chunks.length, `${dir} holds no .js chunk — run \`npm run build\` first`).toBeGreaterThan(0);
  for (const f of chunks) {
    const text = readFileSync(join(dir, f), 'utf8');
    for (const marker of ['"playability"', 'img/games/', 'img/islands/']) expect(text.includes(marker), `${f} contains ${marker}: the full catalogue.json reached the bundle`).toBe(false);
  }
});
