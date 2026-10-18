// #2027: parseDeepLink, the one resolver every platform's link goes through (epic #2026).
import { describe, expect, it } from 'vitest';
import { parseDeepLink, type KnownLinks } from '../../src/deeplink';
import { queueLink, takeLink } from '../../src/deeplink-open';
import { SOURCES, code } from './helpers/sources';
import { edges } from './helpers/edges';

const known: KnownLinks = { topics: new Set(['y1-bonds', 'r-count', 'y2-solo']), years: new Set(['reception', 'year1']) };
const home = { to: 'home' };
const P = (h: string) => parseDeepLink(h, known);

describe('parseDeepLink (#2027)', () => {
  it('opens a valid topic, from an absolute URL or a bare path and query', () => {
    expect(P('https://sharpwise.co.uk/play/?topic=y1-bonds')).toEqual({ to: 'topic', id: 'y1-bonds' });
    expect(P('/play/?topic=r-count')).toEqual({ to: 'topic', id: 'r-count' });
    expect(P('?topic=y2-solo')).toEqual({ to: 'topic', id: 'y2-solo' });
  });
  it('opens a valid year as an island', () => {
    expect(P('https://sharpwise.co.uk/play/?year=year1')).toEqual({ to: 'island', year: 'year1' });
  });
  it('lets topic win when both are given, and a bad topic does not fall back to the year', () => {
    expect(P('/play/?year=reception&topic=y1-bonds')).toEqual({ to: 'topic', id: 'y1-bonds' });
    expect(P('/play/?topic=nope&year=year1')).toEqual(home);
  });
  it.each([
    ['an unknown topic', '/play/?topic=nope'],
    ['an unknown year', '/play/?year=year99'],
    ['a hidden year', '/play/?year=year6'],
    ['a topic with a different case', '/play/?topic=Y1-Bonds'],
    ['a topic padded with spaces', '/play/?topic=%20y1-bonds'],
    ['a trailing space', '/play/?topic=y1-bonds%20'],
    ['a repeated topic key', '/play/?topic=y1-bonds&topic=r-count'],
    ['a repeated year key', '/play/?year=year1&year=reception'],
    ['an empty value', '/play/?topic='],
    ['an over-long value', `/play/?topic=${'y1-bonds'.padEnd(41, 'x')}`],
    ['a javascript: string', 'javascript:alert(1)'],
    ['a javascript: string with a topic', 'javascript:alert(1)?topic=y1-bonds'.replace('?', '//?')],
    ['a data: string', 'data:text/html,<script>1</script>'],
    ['a malformed URL', 'http://[::1'],
    ['an empty string', ''],
    ['no recognised key', '/play/?utm_source=x&fast=8&three=off'],
  ])('gives home for %s', (_n, href) => {
    expect(P(href)).toEqual(home);
  });
  it('ignores extra parameters beside a valid key', () => {
    expect(P('/play/?utm_source=x&topic=y1-bonds&fast=8')).toEqual({ to: 'topic', id: 'y1-bonds' });
  });
  it('never throws, whatever it is handed', () => {
    for (const h of ['%', '//', 'http://', ':::', '\u0000', 'a'.repeat(100_000), undefined as unknown as string, null as unknown as string]) expect(() => P(h)).not.toThrow();
  });
  it('a hidden id in the known set is the caller\'s call: the web wiring passes only listed topics and shown years', () => {
    queueLink('/play/?topic=y1-bonds-10');   // a drill: in the registry, not listed
    expect(takeLink()).toBeNull();
    queueLink('/play/?topic=y1-bonds');
    expect(takeLink()?.topic?.id).toBe('y1-bonds');
    expect(takeLink()).toBeNull();           // taken once, then gone
  });
});

describe('guard rail: the resolver is pure (#2027)', () => {
  const src = SOURCES['/src/deeplink.ts'];
  it('imports nothing from src/ui or src/storage, and has no navigation or storage call of its own', () => {
    expect(src?.length ?? 0).toBeGreaterThan(300);   // read the real file, not an empty glob
    expect(edges('/src/deeplink.ts', src).filter(e => /\/src\/(ui|storage)\b/.test(e.to) || /storage|\/ui\//.test(e.spec))).toEqual([]);
    expect(code(src)).not.toMatch(/\b(history|location|document|window|localStorage|sessionStorage|navigator)\b|\.assign\(|\.replace\(/);
  });
  it('the check can fail: it catches a ui import and a history call', () => {
    expect(edges('/src/deeplink.ts', "import { x } from './ui/home';").some(e => /\/src\/ui\b/.test(e.to))).toBe(true);
    expect(code('history.pushState({}, "")')).toMatch(/\bhistory\b/);
  });
});
