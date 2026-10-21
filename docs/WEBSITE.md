# Website and hosting (#1925, #1933)

`https://sharpwise.co.uk/` is the site (`website/`, #1935); `https://sharpwise.co.uk/play/` is the game.
`.github/workflows/pages.yml` builds both on every push to `main` and deploys with GitHub's official `actions/deploy-pages`.
The game is built with `--base=/play/` into `site/play/`. `npm run build` is unchanged, so Android still embeds a root-based `dist/`.
The manifest (`start_url`, `scope`, `id` are `./`), the worker registration and the precache are all relative, so the PWA is scoped to `/play/`.

## Owner steps (set up 2026-10-21; nothing here can be done from the repo)

DNS for both domains is on **Cloudflare** (free plan); the domains stay registered at Namecheap, whose nameservers point at Cloudflare.
In this order, because GitHub wants the domain claimed before DNS points at it
([docs](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site)):

1. **Verify the domain.** GitHub profile Settings, Pages, Add a domain: `sharpwise.co.uk`, and add the TXT record it gives (`_github-pages-challenge-ugurozsahin`). **Keep that record**: GitHub says the domain stays verified only while it exists
   ([docs](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/verifying-your-custom-domain-for-github-pages)).
2. **Enable Pages and claim the domain.** Repo Settings, Pages: Source **GitHub Actions**; Custom domain `sharpwise.co.uk`, Save. With a GitHub Actions source GitHub ignores a `CNAME` file, so this setting is what counts; the file in `website/` only records the name for readers.
3. **DNS for sharpwise.co.uk, in Cloudflare, every record DNS only (grey cloud).** Proxied, GitHub cannot issue its certificate (community reports, not GitHub's docs: [#22052](https://github.com/orgs/community/discussions/22052)). Cloudflare's banner suggesting the proxy is advice and is ignored here.
   - Apex `A` records, four of them, host `@`: `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`.
   - Apex `AAAA` records, four of them, host `@`: `2606:50c0:8000::153`, `2606:50c0:8001::153`, `2606:50c0:8002::153`, `2606:50c0:8003::153`.
   - `CNAME` record, host `www`, value `ugurozsahin.github.io`, without the repository name (GitHub then redirects `www` to the apex).
   - No wildcard record, and no leftover registrar parking record: either stops the certificate.
   - Check the addresses against GitHub's docs page on the day: GitHub owns them.
4. **Opt in and deploy.** Repo Settings, Secrets and variables, Actions, **Variables** (a repository variable, not an environment one: the gate sits on the `build` job, which has no environment): add `PAGES_ENABLED` = `true`. Then Actions, Deploy to GitHub Pages, Run workflow. Until the variable exists the workflow is skipped, so `main` stays green.
5. **HTTPS.** Once the certificate is issued, tick **Enforce HTTPS** in Settings, Pages.
6. **sharpwise.uk, in Cloudflare.** GitHub Pages cannot serve a second domain for the same site, so Cloudflare redirects it
   ([docs](https://developers.cloudflare.com/fundamentals/manage-domains/redirect-domain/)):
   - `A` records `@` and `www`, value `192.0.2.1`, **Proxied** (orange cloud): the address routes nowhere, it only lets Cloudflare answer.
   - Rules, Redirect Rules: hostname `sharpwise.uk` or `www.sharpwise.uk`, dynamic target `concat("https://sharpwise.co.uk", http.request.uri.path)`, **301**, preserve query string.
7. **Mail.** Namecheap's email forwarding stops when the nameservers move. Cloudflare Email Routing receives for sharpwise.co.uk (its MX, SPF and DKIM records). It does not send: #2084. sharpwise.uk has no mail at all: its Namecheap forwarding ended with the move too, and nothing replaces it.
8. **Check**: `https://sharpwise.co.uk/play/` loads, works offline after one visit, and installs as an app;
   `curl -sI http://sharpwise.uk` shows `301`.

9. **Android App Links (#2028, optional until the app is published).** Repo Settings, Secrets and variables, Actions, Variables: add `ANDROID_APP_LINKS_SHA256` = the SHA-256 certificate fingerprint of the key that signs the installed app. With Play App Signing that is **Google's app signing key**: Play Console, Setup, App signing, "App signing key certificate", SHA-256 (the upload key's is not enough). Several fingerprints may be separated by commas. The next deploy then publishes `/.well-known/assetlinks.json`; until then no file is published and links open in the browser, so the web game still works. Testing: `docs/ANDROID.md`.

## Checking the `.well-known` files (#2029)

Android and iOS silently ignore an association file that is redirected, missing or served with the wrong type; the only symptom is "the link opens the browser".
The `check` job in `pages.yml` runs after every deploy; by hand, once DNS and HTTPS are up:

```
ANDROID_APP_LINKS_SHA256='AA:BB:...' node scripts/check-well-known.mjs https://sharpwise.co.uk [--ios]
```

It needs only Node and takes any base URL (a local server works). Exit 0 = as intended, 1 = a check failed (the message names the URL and the fault), 2 = bad usage.
For each file it wants status 200, no redirect, `content-type: application/json` and a JSON body.
Which files it wants follows the generator: `assetlinks.json` is expected exactly when `ANDROID_APP_LINKS_SHA256` holds a fingerprint (the same test `scripts/app-links.mjs` applies), so pass the same value; `apple-app-site-association` is expected only with `--ios` until #2030 gives it a generator (and replaces the flag).
A file that is intentionally absent must answer 404; a 200 for it fails, as does a 404 for an expected one.
The job reads the repository variable itself and retries for two minutes (CDN and certificate lag). It is a separate job nothing waits on: a failure turns that run red and blocks no pull request.
Never measured yet: whether Pages serves the extensionless `apple-app-site-association` as JSON (it picks the type from the extension, so `application/octet-stream` is likely). If the first real run says so, the smallest fix is to host `/.well-known` on another host with a headers file (see the Cloudflare note below), not a workaround in the repo.

## Notes

- The service worker's cache name is derived from the build's contents, so each deployment replaces the previous cache.
- If custom headers are ever needed, Cloudflare Pages is the free fallback ([headers](https://developers.cloudflare.com/pages/configuration/headers/)).
- The site (#1935) has no script and no third party: every page under `website/` shares one header, navigation and footer and links `website/site.css`; fonts and the icon are copies of the game's. The only absolute URLs are `https://sharpwise.co.uk/` and the store badge links (`tests/unit/pages.test.ts`).
- The deploy installs Chromium, serves the assembled `site/` on port 4173 and runs `scripts/site-shots.mjs` into `site/img/`, which the pages show as `/img/<name>.webp` (#2088). Nothing under `website/img/` is committed.
- Pages not built yet (curriculum, guides, about, privacy, support) are one-line `noindex` placeholders on the shell, so no navigation link is dead; each one's issue replaces it.
- `/features/` is generated: edit `docs/site/features.json`, then run `node scripts/site-features.mjs` (#2101). Each `today` entry names the module or test that shows it, each `later` entry its open issue; `tests/unit/site-features.test.ts` fails on a stale page or a dated plan.

## Screenshots (#2088)

`node scripts/site-shots.mjs <base-url> <out-dir>` captures every picture the pages and the store listing need, at phone
and desktop size, from fixed seeds. #1935's Pages step runs it and serves the files at `/img/<name>.webp`; no image is
committed. Locally, `npm run site:shots` writes to the git-ignored `site-shots/`. Set `PW_CHROMIUM` for a browser
Playwright did not download. The shot list is in the script; a rail fails if a page references a file it does not make.
