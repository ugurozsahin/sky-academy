import { describe, expect, it } from 'vitest';
import ts from 'typescript';
import { TOPICS } from '../../src/curriculum';

// Owner rule (issue #47): every word a child sees or hears follows British / National Curriculum usage.
const AMERICAN: Record<string, string> = {
  color: 'colour', colors: 'colours', colored: 'coloured', favorite: 'favourite', favorites: 'favourites', gray: 'grey', math: 'maths',
  meter: 'metre', meters: 'metres', centimeter: 'centimetre', centimeters: 'centimetres', kilometer: 'kilometre', liter: 'litre', liters: 'litres',
  center: 'centre', centers: 'centres', learned: 'learnt', spelled: 'spelt', mom: 'mum', mommy: 'mummy', candy: 'sweets', cookie: 'biscuit', cookies: 'biscuits',
  soccer: 'football', trash: 'rubbish', vacation: 'holiday', gotten: 'got', airplane: 'aeroplane', apartment: 'flat', diaper: 'nappy', pants: 'trousers',
  sneakers: 'trainers', flashlight: 'torch', eraser: 'rubber', neighbor: 'neighbour', neighbors: 'neighbours', honor: 'honour', humor: 'humour',
  behavior: 'behaviour', traveling: 'travelling', jewelry: 'jewellery', pajamas: 'pyjamas', zucchini: 'courgette', eggplant: 'aubergine', fries: 'chips',
  parentheses: 'brackets', 'zip code': 'postcode', practiced: 'practised', practicing: 'practising', organize: 'organise', realize: 'realise', recognize: 'recognise',
  analyze: 'analyse', counterclockwise: 'anti-clockwise', cent: 'penny', cents: 'pence', dollar: 'pound', dollars: 'pounds', 'quarter after': 'quarter past',
  'half after': 'half past', trapezoid: 'trapezium', favor: 'favour', flavor: 'flavour', colorful: 'colourful', tire: 'tyre', mold: 'mould', canceled: 'cancelled',
  labeled: 'labelled', modeling: 'modelling', theater: 'theatre', catalog: 'catalogue', dialog: 'dialogue', lowercase: 'lower-case', uppercase: 'upper-case',
};
const wordsIn = (s: string) => s.toLowerCase().match(/[a-z]+(?:'[a-z]+)?/g) ?? [];
function offenders(text: string): string[] {
  const out: string[] = [];
  for (const w of wordsIn(text)) if (Object.hasOwn(AMERICAN, w)) out.push(w);
  for (const phrase of Object.keys(AMERICAN)) if (phrase.includes(' ') && text.toLowerCase().includes(phrase)) out.push(phrase);
  return out;
}
// Every source file, read through Vite (typed by vite/client — no @types/node needed).
// No CSS here on purpose: Vite's css plugin returns an empty string for `?raw` outside the browser, so a
// CSS scan would pass vacuously (found while writing the guard rails, #73). `content:` strings are rare and
// not child-facing; if that changes, check them from an e2e test instead.
const SOURCES = import.meta.glob(['/src/**/*.ts', '/index.html'], { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
/** Every string a TypeScript file can show: plain literals and the static parts of template literals (nested templates included). */
function tsStrings(file: string, src: string): string[] {
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
  const out: string[] = [];
  const visit = (n: ts.Node) => {
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) || ts.isTemplateHead(n) || ts.isTemplateMiddle(n) || ts.isTemplateTail(n)) out.push(n.text);
    ts.forEachChild(n, visit);
  };
  visit(sf); return out;
}
const API_LITERALS = new Set(['center', 'theme-color', 'dialog']);   // canvas textAlign / meta name / ARIA role — never shown to a child
/** Drop markup and `property:` names so CSS/HTML plumbing inside strings is not spell-checked. */
const childText = (s: string) => s.replace(/<[^>]*>/g, ' ').replace(/\b[a-z-]+(?=\s*:)/g, ' ');
const seeded = (seed: number) => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };

describe('British English (National Curriculum usage)', () => {
  it('no American spellings in any generated question text', () => {
    const bad = new Map<string, string>();
    for (const t of TOPICS) for (const d of [1, 2, 3] as const) for (let i = 0; i < 150; i++) {
      const q = t.gen(d, seeded(i * 7 + d));
      const texts = [q.prompt, q.answer, q.hint ?? '', q.say ?? '', q.listen ?? '', ...q.options, ...(q.sequence ?? [])];
      const v = q.visual as any; if (v?.text) texts.push(String(v.text));
      for (const s of texts) for (const w of offenders(s)) bad.set(`${t.id}: "${s}"`, `${w} → ${AMERICAN[w]}`);
    }
    expect([...bad.entries()].map(([k, v]) => `${k} (${v})`)).toEqual([]);
  });
  it('the scanner really reaches nested UI strings and flags offenders', () => {
    expect(tsStrings('play.ts', SOURCES['/src/ui/play.ts']).some(t => t.includes('Slice the bubble!'))).toBe(true);   // nested inside a `${}` template
    expect(tsStrings('x.ts', 'const a = `Well done ${ok ? `Color it ${n}` : "gray"}`;')).toEqual(['Well done ', 'Color it ', '', 'gray', '']);
    expect(offenders('Color it! The gray line')).toEqual(['color', 'gray']);
    expect(offenders('Practice makes a master. She practises at half past three.')).toEqual([]);
  });
  it('no American spellings in any string a source file can show (TS literals, template parts, CSS content, HTML attributes)', () => {
    const bad: string[] = [];
    for (const [file, src] of Object.entries(SOURCES)) {
      const strings = file.endsWith('.ts') ? tsStrings(file, src)
        : file.endsWith('.css') ? (src.match(/content:\s*"[^"]*"/g) ?? []).map(m => m.slice(9, -1))
        : [...src.matchAll(/(?:title|alt|aria-label|content|placeholder)="([^"]*)"/g)].map(m => m[1]).concat(src.match(/<title>([^<]*)<\/title>/)?.[1] ?? []);
      for (const str of strings) { if (API_LITERALS.has(str)) continue; for (const w of offenders(childText(str))) bad.push(`${file}: "${str.slice(0, 70)}" (${w} → ${AMERICAN[w]})`); }
    }
    expect(bad).toEqual([]);
  });
});
