import type { Visual } from '../../../src/curriculum';

/**
 * The part of a visual that is the question, read independently of `VISUAL_QUESTION` in the repeat key
 * (`tests/unit/session.test.ts`'s `asked`). Split out of that file, which is frozen at its length (#985).
 */
export function visualAsked(v: Visual | undefined): string {
  switch (v?.type) {
    case 'coins': return [...new Set(v.coins)].sort((a, b) => a - b).join('/');
    case 'numberline': return `${v.from}/${v.to}/${v.mark ?? ''}/${v.step ?? ''}`;
    case 'chart': return `${v.kind}/${v.rows.map(r => r.n).join(',')}`;
    case 'coords': return `${v.size}/${v.points.map(c => `${c.x},${c.y}`).sort().join(';')}`;   // #1129: where the points are, not their letters
    case 'objects': return `${v.n}/${v.n2 ?? ''}`;   // #985: the counts are the question on a compare card
    default: return '';
  }
}
