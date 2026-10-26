import { afterEach, describe, expect, it } from 'vitest';
import RUNTIME from '../../src/config/catalogue.runtime.json';
import type { RuntimeCatalogue } from '../../src/config/catalogue';
import { activeCatalogue, setActiveCatalogue } from '../../src/config/active';
import { drillsFor, listedTopics, topicsFor } from '../../src/curriculum';

const hidden = (): RuntimeCatalogue => { const c = structuredClone(RUNTIME) as unknown as { games: Record<string, { visible: boolean }> }; c.games['y4-tables'].visible = false; return c as unknown as RuntimeCatalogue; };

afterEach(() => setActiveCatalogue(null));

describe('the catalogue seam (#2239)', () => {
  it('setActiveCatalogue changes what activeCatalogue returns, and null puts the profile\'s back', () => {
    const before = activeCatalogue(), cat = hidden();
    setActiveCatalogue(cat);
    expect(activeCatalogue()).toBe(cat);
    setActiveCatalogue(null);
    expect(activeCatalogue()).toBe(before);
  });

  it('topicsFor, drillsFor and listedTopics take the same catalogue argument as shownYears, and agree with the seam', () => {
    const cat = hidden();
    expect(topicsFor('year4', undefined, cat).some(t => t.id === 'y4-tables')).toBe(false);
    expect(topicsFor('year4').some(t => t.id === 'y4-tables')).toBe(true);
    setActiveCatalogue(cat);
    expect(topicsFor('year4')).toEqual(topicsFor('year4', undefined, cat));
    expect(drillsFor('year4')).toEqual(drillsFor('year4', undefined, cat));
    expect(listedTopics()).toEqual(listedTopics(cat));
    expect(listedTopics().some(t => t.id === 'y4-tables')).toBe(false);
  });
});
