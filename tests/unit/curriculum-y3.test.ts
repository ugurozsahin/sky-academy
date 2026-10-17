import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { topicsFor, TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum/types';
import { genericTopicSuite } from './helpers/generic-topic-suite';

// Year 3's per-topic structural loop (#1050), in a file of its own so it runs as a parallel worker.
genericTopicSuite(TOPICS.filter(t => t.year === 'year3'));   // #1467: drills included, so every topic of the year runs the loop once

describe('Year 3 registry (#1050)', () => {
  it('topicsFor("year3") holds y3-count', () => {
    expect(topicsFor('year3').map(t => t.id)).toContain('y3-count');
  });

  it('no topic runs the generic suite twice: Year 3 topics are not in the EYFS/KS1 sweep', () => {
    const y3 = new Set(topicsFor('year3').map(t => t.id));
    expect(TOPICS.filter(t => t.year !== 'year3' && y3.has(t.id))).toEqual([]);
  });

  // #1467: `curriculum.test.ts`'s "no other topic sets slow" rail skips KS2 (#1050) on the promise that a KS2
  // topic which sets `slow` asserts it in its own `topic-<id>.test.ts`. Nothing held it to that promise.
  it('no Year 3 topic sets slow unless its own topic test mentions it', () => {
    let seed = 2972;
    const rng = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    const mentionsSlow = (id: string) => {
      const file = new URL(`./topic-${id}.test.ts`, import.meta.url);
      return existsSync(file) && /\bslow\b/.test(readFileSync(file, 'utf8'));
    };
    const offenders: string[] = [];
    for (const t of TOPICS.filter(x => x.year === 'year3' && !mentionsSlow(x.id))) {
      for (const d of [1, 2, 3] as Difficulty[]) {
        for (let i = 0; i < 40; i++) if (t.gen(d, rng).slow) { offenders.push(`${t.id} d${d}`); break; }
      }
    }
    expect(offenders).toEqual([]);
  });

  // Import direction: year3-topics → year3-* → shared modules. No Year 3 file imports another year's file.
  it('no src/curriculum/year3-*.ts file imports another year’s module', () => {
    const dir = new URL('../../src/curriculum/', import.meta.url);
    const files = readdirSync(dir).filter(f => /^year3-.*\.ts$/.test(f));
    expect(files.length).toBeGreaterThanOrEqual(10);
    const other = /from\s+['"]\.\/(reception|year1|year2|year[4-6]-)[^'"]*['"]/;
    for (const f of files) expect(readFileSync(new URL(f, dir), 'utf8'), f).not.toMatch(other);
  });
});
