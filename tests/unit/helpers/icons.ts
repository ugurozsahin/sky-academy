// Shared by the two icon rails (#631): the single-file guard rail in guardrails.test.ts and tests/unit/pwa-icons.test.ts.

/** What a single-file page must NOT still carry after `stripHead`: the Apple icon link itself (the way the
 *  manifest rail asks for it), or any `href`/`src` into `icons/` — relative or root-absolute. */
export const DANGLING_ICON = /<link rel="apple-touch-icon"|(?:href|src)="\/?icons\//;

/** The Apple icon's `href`, however the tag is spelt: `rel` and `href` are matched independently, so
 *  `sizes="180x180"` between them, or a different attribute order, is still the same link. */
export function appleIconHref(html: string): string | undefined {
  const tag = html.match(/<link\b[^>]*\brel="apple-touch-icon"[^>]*>/)?.[0];
  return tag?.match(/\bhref="([^"]+)"/)?.[1];
}
