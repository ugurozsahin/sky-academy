/** The grown-ups page's "About this game" claims. Each is literally true today and pinned by tests/unit/parents.test.ts;
 *  the dependency list is held by the rail in tests/unit/guardrails.test.ts. */
export const ABOUT_LINES = [
  'No adverts.',
  'No account — progress is kept on this device.',
  'No tracking — no analytics, and nothing about your child is collected.',
  'Works offline once installed or loaded.',
] as const;

export const aboutHTML = (): string =>
  `<h3 class="p-h">About this game</h3><ul class="p-note">${ABOUT_LINES.map(l => `<li>${l}</li>`).join('')}</ul>`;
