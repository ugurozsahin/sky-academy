import { describe, expect, it } from 'vitest';
import { chooserHTML } from '../../src/ui/chooser';

// #1072: the entry builder draws the existing `.topic` buttons — Mixed first, then one per entry, keyed by its id.
describe('chooserHTML (#1072)', () => {
  const entries = [{ id: 'strand:fractions', icon: '🍕', title: 'Fractions, decimals and percentages' }, { id: 'y2-tables-5', icon: '5️⃣', title: '5× table', badge: ' 🏆' }];
  it('lists Mixed first, then each entry as a .topic button carrying its id', () => {
    const html = chooserHTML(entries, { mixed: true });
    expect([...html.matchAll(/<button class="topic"([^>]*)>/g)].map(m => m[1].trim())).toEqual(['data-mixed', 'data-id="strand:fractions"', 'data-id="y2-tables-5"']);
    expect(html).toContain('<b>Fractions, decimals and percentages</b>');
    expect(html).toContain('5× table</b> 🏆');
  });
  it('draws no Mixed card when mixed is off, and adds no new class', () => {
    const html = chooserHTML(entries, { mixed: false });
    expect(html).not.toContain('data-mixed');
    expect([...html.matchAll(/class="([^"]+)"/g)].map(m => m[1])).toEqual(['modal', 'topics', 'topic', 'ic', 'topic', 'ic', 'row', 'btn big']);
  });
});
