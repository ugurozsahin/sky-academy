# Website and hosting (#1925, #1933)

`https://sharpwise.co.uk/` is the site (today a one-line holding page, `website/index.html`); `https://sharpwise.co.uk/play/` is the game.
`.github/workflows/pages.yml` builds both on every push to `main` and deploys with GitHub's official `actions/deploy-pages`.
The game is built with `--base=/play/` into `site/play/`. `npm run build` is unchanged, so Android still embeds a root-based `dist/`.
The manifest (`start_url`, `scope`, `id` are `./`), the worker registration and the precache are all relative, so the PWA is scoped to `/play/`.

## Owner steps (once; nothing here can be done from the repo)

1. **Enable Pages.** Repo Settings, Pages, Build and deployment, Source: **GitHub Actions**
   ([docs](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site#publishing-with-a-custom-github-actions-workflow)).
2. **Run the workflow** once (Actions, Deploy to GitHub Pages, Run workflow), or push to `main`.
3. **Custom domain.** Settings, Pages, Custom domain: `sharpwise.co.uk`, Save. The `CNAME` file in `website/` is deployed with the site and records the same name
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

## Notes

- The service worker's cache name is derived from the build's contents, so each deployment replaces the previous cache.
- If custom headers are ever needed, Cloudflare Pages is the free fallback ([headers](https://developers.cloudflare.com/pages/configuration/headers/)).
- The holding page has no script and no third party (#1937). The promotional page (#1925) replaces `website/index.html`.
