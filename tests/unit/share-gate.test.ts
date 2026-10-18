import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * #1943, Apple's Kids Category (App Review 1.3): nothing may take a child out of the app unless it sits behind a
 * parental gate. Every outbound call in `src/` is listed here with the reason it is safe; a new one fails this test
 * until someone reads it and adds it, with its reason.
 */
const files = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap(e =>
  e.isDirectory() ? files(join(dir, e.name)) : /\.ts$/.test(e.name) ? [join(dir, e.name)] : []);
const code = (f: string) => readFileSync(f, 'utf8').split('\n').map((l, n) => ({ n: n + 1, t: l.replace(/\/\/.*$/, '').trim() }))
  .filter(l => l.t && !l.t.startsWith('*') && !l.t.startsWith('/*'));
const OUTBOUND = /\bShare\.share\(|\bnavigator\.share\(|\bnav\.share!?\(|\bcap!?\.share\(|\bwindow\.open\(|\blocation\.(href|assign)\s*=/;

const SAFE: Record<string, string> = {
  'src/ui/certificate.ts': 'the certificate: reached only through deliverCertificate, which asks `mayShare` (default: no) before it offers any share sheet',
  'src/ui/parents-share.ts': 'the progress summary: a button on the grown-ups dashboard, which is only drawn after the maths gate',
};

describe('every outbound call is behind the grown-ups gate (#1943)', () => {
  const hits = files('src').flatMap(f => code(f).filter(l => OUTBOUND.test(l.t)).map(l => `${f}:${l.n}`));

  it('only the two audited files reach the share sheet, a link out, or a new location', () => {
    const where = [...new Set(hits.map(h => h.split(':')[0]))].sort();
    expect(where, `unaudited outbound call: ${hits.join(', ')}. Put it behind the gate and add it to SAFE with the reason.`)
      .toEqual(Object.keys(SAFE).sort());
  });

  it('the certificate offers a share sheet only after `mayShare`, and its default says no', () => {
    const src = readFileSync('src/ui/certificate.ts', 'utf8');
    expect(src).toMatch(/mayShare: \(\) => Promise<boolean> = \(\) => Promise\.resolve\(false\)/);
    expect(src).toMatch(/files \|\| capacitor \? await mayShare\(\) : false/);
  });

  it('each child-facing certificate button asks a grown-up first', () => {
    for (const f of ['src/ui/play-results.ts', 'src/ui/duel-results.ts']) {
      const calls = code(f).filter(l => /deliverCertificate\(/.test(l.t) && !/^import/.test(l.t));
      expect(calls.length, f).toBeGreaterThan(0);
      for (const c of calls) expect(c.t, `${f}:${c.n} must pass the gate`).toContain("askGrownUp('share the certificate')");
    }
  });

  it('the grown-ups dashboard is drawn only after the gate answer is checked', () => {
    const src = readFileSync('src/ui/parents.ts', 'utf8');
    expect(src).toMatch(/if \(checkGate\(input\.value, gate\.answer\)\) \{ sfx\.correct\(\); drawDash\(\); \}/);
  });
});
