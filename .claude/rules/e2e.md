---
paths:
  - "tests/e2e/**"
  - "playwright.config.ts"
---

# End-to-end tests (#101)

- `tsc` and Vitest cannot see this directory at all — `npx playwright test --list` is the compile check for
  files here, not `npm test`.
- Mobile is the default project a pull request is judged on (#81); desktop runs on the nightly. Add
  `--project=desktop` yourself when a change could behave differently by viewport.
- A pull request runs e2e at all only when its diff can reach the game (#96): `src/`, `index.html`, `public/`,
  `tests/e2e/`, `playwright.config.*`, `package*.json`, `ci.yml`. Everything else gets a `CI` check with the
  e2e step visibly skipped, never a missing check.
- `window.__sna` (`answer()`, `wrong()`, `bubbles()`, `state()`) is how these tests drive the game — keep new
  scenarios going through it rather than clicking through timing-sensitive UI where a hook already exists.
- A `guard rail:` test here encodes a mistake already made; its name and comment say which incident. Don't
  weaken one to make a build pass — a budget number only ever goes down.
