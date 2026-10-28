import { describe, it, expect } from 'vitest';
import { promptHTML, markDivide } from '../../src/ui/hud';
import { TOPICS } from '../../src/curriculum';
import { y6OrderOps } from '../../src/curriculum/year6-order-ops';
import type { Question } from '../../src/curriculum/types';

// #2278: the ÷ is wrapped so the stylesheet can size it up; the text is otherwise unchanged.
describe('÷ in a prompt', () => {
  it('wraps each ÷ and nothing else', () => {
    expect(markDivide('6 + 12 ÷ 3 = ?')).toBe('6 + 12 <span class="op-div">÷</span> 3 = ?');
    expect(markDivide('6 + 3 = ?')).toBe('6 + 3 = ?');
  });
  it('every y6-order-ops card with a ÷ renders it wrapped, and strips back to the prompt', () => {
    let seen = 0;
    for (let seed = 1; seed <= 200; seed++) {
      for (const d of [1, 2, 3] as const) {
        let s = seed * 3 + d;
        const rng = () => { s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
        const q = y6OrderOps(d, rng) as Question;
        const html = promptHTML(q, 0);
        expect(html.replace(/<[^>]+>/g, '')).toBe(q.prompt);
        if (q.prompt.includes('÷')) { seen++; expect(html).toContain('<span class="op-div">÷</span>'); }
      }
    }
    expect(seen).toBeGreaterThan(20);
  });
});

// #2355: the sequence/build/anyOrder branches wrap the ÷ too.
describe('÷ on sequence, build and any-order cards', () => {
  it('every such card with a ÷ renders it wrapped, and strips back to the prompt', () => {
    let seen = 0;
    for (const t of TOPICS) for (const d of [1, 2, 3] as const) for (let seed = 1; seed <= 60; seed++) {
      let s = seed * 7 + d;
      const rng = () => { s = s + 0x6D2B79F5 | 0; let x = Math.imul(s ^ s >>> 15, 1 | s); x = x + Math.imul(x ^ x >>> 7, 61 | x) ^ x; return ((x ^ x >>> 14) >>> 0) / 4294967296; };
      const q = t.gen(d, rng) as Question;
      if (!q.sequence || !(q.build || q.anyOrder) || !q.prompt.includes('÷')) continue;
      seen++;
      const html = promptHTML(q, 0);
      expect(html).toContain('<span class="op-div">÷</span>');
      expect(html).not.toMatch(/÷(?!<\/span>)/);
    }
    expect(seen).toBeGreaterThan(0);
  });
});
