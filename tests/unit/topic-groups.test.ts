import { describe, expect, it } from 'vitest';
import { isKs2, STRANDS, TOPICS, topicsFor, YEARS, type Strand, type Topic } from '../../src/curriculum';
import { GROUP_AT, groupTopics, topicsHTML } from '../../src/ui/topic-groups';

// #1068: strand-grouped topic lists for long island tabs. KS1 and short tabs stay the flat grid.
const order = Object.keys(STRANDS) as Strand[];
const fake = (n: number, strand?: Strand): Topic => ({ id: `t${n}`, title: `T${n}`, icon: '⭐', subject: 'maths', year: 'year3', nc: 'nc', strand, gen: () => { throw new Error('unused'); } });
const fixture = (n: number) => Array.from({ length: n }, (_, i) => fake(i, order[(i * 7) % 8]));
const flat = (list: Topic[]) => topicsHTML([{ topics: list }], {});

describe('groupTopics', () => {
  it('draws 37 topics in STRANDS order, registry order kept inside each section', () => {
    const list = fixture(37), sections = groupTopics(list);
    expect(sections.map(s => s.strand)).toEqual(order.filter(s => list.some(t => t.strand === s)));
    for (const s of sections) expect(s.topics.map(t => +t.id.slice(1))).toEqual([...s.topics.map(t => +t.id.slice(1))].sort((a, b) => a - b));
    expect(sections.flatMap(s => s.topics).length).toBe(37);
  });
  it('groups at exactly GROUP_AT topics', () => {
    expect(groupTopics(fixture(GROUP_AT)).every(s => s.strand)).toBe(true);
  });
  it('gives one unheaded section under the threshold or when any topic lacks a strand', () => {
    const short = fixture(GROUP_AT - 1);
    expect(groupTopics(short)).toEqual([{ topics: short }]);
    const list = fixture(37); list[5] = fake(5);
    expect(groupTopics(list)).toEqual([{ topics: list }]);
  });
});

describe('topicsHTML', () => {
  it('is byte-identical to the flat card list for every KS1 tab', () => {
    for (const y of YEARS.filter(y => !isKs2(y.id))) for (const s of ['maths', 'writing'] as const) {
      const list = topicsFor(y.id, s);
      expect(topicsHTML(groupTopics(list), {})).toBe(flat(list));
      expect(topicsHTML(groupTopics(list), {})).not.toContain('section-title');
    }
  });
  it('draws a card exactly as main did before #1068 (literal, not derived from card())', () => {
    const t = { ...fake(0), id: 'y1-bonds', icon: '🔗', title: 'Number Bonds', nc: 'NC ref' };
    const head = '\n      <button class="topic" data-id="y1-bonds" data-subject="maths" title="NC ref">\n        <span class="ic">🔗</span><b>Number Bonds</b>\n        ';
    expect(topicsHTML(groupTopics([t]), {})).toBe(`${head}<span class="stars" aria-label="0 of 3 stars"><i>★★★</i></span>\n      </button>`);
    expect(topicsHTML(groupTopics([t]), { 'y1-bonds': { stars: 2, crown: true } as never }))
      .toBe(`${head}<span class="stars" aria-label="2 of 3 stars">★★<i>★</i></span><small class="pill">👑</small>\n      </button>`);
  });
  it('keeps every card with a data-id from its input, behind full-width headings', () => {
    const list = fixture(37), html = topicsHTML(groupTopics(list), {});
    const ids = [...html.matchAll(/class="topic" data-id="([^"]+)" data-subject="maths"/g)].map(m => m[1]);
    expect(ids.sort()).toEqual(list.map(t => t.id).sort());
    expect(html.match(/<h3 class="section-title" style="grid-column:1\/-1">/g)?.length).toBe(groupTopics(list).length);
  });
  it('draws stars, the crown and the tracing pill from progress', () => {
    const list = [fake(1), { ...fake(2), input: 'tracing' as const }];
    const html = topicsHTML([{ topics: list }], { t1: { stars: 2, crown: true } as never });
    expect(html).toContain('2 of 3 stars');
    expect(html).toContain('👑');
    expect(html).toContain('tracing');
  });
  it('never says coming soon, placeholder or temporary', () => {
    expect(topicsHTML(groupTopics(fixture(37)), {})).not.toMatch(/coming soon|placeholder|temporary/i);
    for (const h of Object.values(STRANDS)) expect(h).not.toMatch(/coming soon|placeholder|temporary/i);
  });
});

describe('strand on the registry', () => {
  it('every KS2 row has a strand that is a key of STRANDS', () => {
    for (const t of TOPICS.filter(t => isKs2(t.year))) expect(Object.keys(STRANDS), t.id).toContain(t.strand);
  });
});
