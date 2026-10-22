/** The HTML entities the website's pages use, decoded as a reader sees them (#2092, #2094). A no-break space reads as a space. */
export const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", rsquo: '’', nbsp: ' ', '#160': ' ' };
export const decodeEntities = (s: string) => s.replace(/&(#?\w+);/g, (m, e) => ENTITIES[e] ?? m);
