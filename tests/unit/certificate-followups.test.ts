import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { TOPICS } from '../../src/curriculum';

/** #402 follow-ups (#671, #672, #674): rails for the certificate album's copy, id namespace, duel hooks and 🎓 handlers. */
const read = (f: string) => readFileSync(f, 'utf8');

describe('album id namespace (#672, #402 note 5)', () => {
  // `certKind()`'s words: a topic with one of these ids would share `${year}:<word>` with a certificate entry.
  const RESERVED = ['duel', 'sensei', 'mission', 'island', 'belt'];
  it('no topic id is a reserved certificate word', () => {
    expect(TOPICS.length).toBeGreaterThan(100);
    expect(TOPICS.filter(t => RESERVED.includes(t.id)).map(t => t.id)).toEqual([]);
  });
});

describe('DuelHooks are all still built (#672, #402 note 9)', () => {
  const iface = /export interface DuelHooks \{([\s\S]*?)\n\}/.exec(read('src/ui/hooks.ts'))![1];
  const declared = [...iface.matchAll(/^ {2}(\w+)\s*[(:]/gm)].map(m => m[1]);
  const built = read('src/ui/duel-hooks.ts');
  it('the interface still declares the whole set', () => {
    expect(declared.sort()).toEqual(['answer', 'arenas', 'bubbles', 'certWords', 'certificate', 'duel', 'setSpeed', 'state', 'timing', 'wrong']);
  });
  it.each(declared)('createDuelHooks builds %s', hook => {
    expect(built).toMatch(new RegExp(`(^|[\\s{,])${hook}\\s*[:,]`, 'm'));
  });
});

describe('the 🎓 handlers report outside the try (#674, #402 note 10)', () => {
  const file = (f: string) => read(f).replace(/\/\/.*$/gm, '');
  it.each(['src/ui/play-results.ts', 'src/ui/duel-results.ts'])('%s: delivery-only try, the button re-enabled in a finally', f => {
    const src = file(f);
    const tryBlock = /try \{([^]*?)\n\s*catch/.exec(src.slice(src.indexOf('deliverCertificate(') - 200))![1];
    expect(tryBlock).toContain('deliverCertificate(');
    expect(tryBlock).not.toMatch(/toast\(|certMsg\(/);
    expect(src).toMatch(/finally \{ b\.disabled = false; \}/);
    expect(src).toMatch(/catch \(e\) \{ console\.error\(/);
  });
});

describe('the empty album copy does not say missions only (#671, #402 note 2)', () => {
  it.each(['src/ui/home.ts', 'src/ui/certificate.ts'])('%s names more than a mission', f => {
    const lines = read(f).split('\n').filter(l => /Win a mission/.test(l));
    expect(lines.length).toBeGreaterThan(0);
    for (const l of lines) expect(l).toMatch(/Win a mission( or|,)/);
  });
});
