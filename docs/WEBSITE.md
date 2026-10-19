# Website and hosting (#1925, #1933)

`https://sharpwise.co.uk/` is the site (today a one-line holding page, `website/index.html`); `https://sharpwise.co.uk/play/` is the game.
`.github/workflows/pages.yml` builds both on every push to `main` and deploys with GitHub's official `actions/deploy-pages`.
The game is built with `--base=/play/` into `site/play/`. `npm run build` is unchanged, so Android still embeds a root-based `dist/`.
The manifest (`start_url`, `scope`, `id` are `./`), the worker registration and the precache are all relative, so the PWA is scoped to `/play/`.

## Owner steps (once; nothing here can be done from the repo)

0. **Opt in.** Repo Settings, Secrets and variables, Actions, Variables: add `PAGES_ENABLED` = `true`. Until it exists the workflow is skipped, so `main` stays green (the deploy fails with a 404 while Pages is off).
1. **Enable Pages.** Repo Settings, Pages, Build and deployment, Source: **GitHub Actions**
   ([docs](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site#publishing-with-a-custom-github-actions-workflow)).
2. **Run the workflow** once (Actions, Deploy to GitHub Pages, Run workflow), or push to `main`.
3. **Custom domain.** Settings, Pages, Custom domain: `sharpwise.co.uk`, Save. With a GitHub Actions publishing source GitHub ignores a `CNAME` file, so this setting is what counts; the file in `website/` only records the name for readers
   ([docs](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site)).
4. **DNS for sharpwise.co.uk, at the registrar**
   ([docs](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site#configuring-an-apex-domain)):
   - Apex `A` records, four of them, host `@`: `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`.
   - Apex `AAAA` records, four of them, host `@`: `2606:50c0:8000::153`, `2606:50c0:8001::153`, `2606:50c0:8002::153`, `2606:50c0:8003::153`.
   - `CNAME` record, host `www`, value `ugurozsahin.github.io` (GitHub then redirects `www` to the apex).
   - Check the addresses against the docs page above on the day: GitHub owns them.
   - Do not add a wildcard record, and verify the domain in your GitHub account settings, Pages, to stop takeover
     ([docs](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/verifying-your-custom-domain-for-github-pages)).
5. **HTTPS.** When DNS has propagated (up to 24 hours), tick **Enforce HTTPS** in Settings, Pages. GitHub issues the certificate itself.
6. **sharpwise.uk.** At the registrar, use its URL forwarding feature: `sharpwise.uk` and `www.sharpwise.uk` to `https://sharpwise.co.uk`, type **301 (permanent)**. GitHub Pages cannot serve a second domain for the same site, so the redirect has to be the registrar's.
7. **Check**: `https://sharpwise.co.uk/play/` loads, works offline after one visit, and installs as an app;
   `curl -sI http://sharpwise.uk` shows `301`.

8. **Android App Links (#2028, optional until the app is published).** Repo Settings, Secrets and variables, Actions, Variables: add `ANDROID_APP_LINKS_SHA256` = the SHA-256 certificate fingerprint of the key that signs the installed app. With Play App Signing that is **Google's app signing key**: Play Console, Setup, App signing, "App signing key certificate", SHA-256 (the upload key's is not enough). Several fingerprints may be separated by commas. The next deploy then publishes `/.well-known/assetlinks.json`; until then no file is published and links open in the browser, so the web game still works. Testing: `docs/ANDROID.md`.

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
- The holding page has no script and no third party (#1937). The promotional page (#1925) replaces `website/index.html`.
