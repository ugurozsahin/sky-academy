# Android build (tablet APK)

The game is wrapped with [Capacitor](https://capacitorjs.com): the Vite build in `dist/` is embedded in the APK, so it runs **offline** on a tablet or phone. App id `uk.co.sharpwise`, name "Sharpwise".

## Get the APK (no tools needed)
1. GitHub → **Actions** → workflow **Android APK** → **Run workflow** on `main`, and wait ~3 minutes.
   (The APK is built on demand, not on every push: on a private repo that was ~3 metered minutes per commit
   for an artifact nobody downloaded. A `v*` tag builds one too, and attaches it to the release.)
2. Download the **sky-ninja-academy-apk** artifact (a zip), unzip → `sky-ninja-academy-<commit>.apk`.
3. On the tablet: allow "install unknown apps" for your browser/file manager once, open the APK, install.
   **Updating:** each CI run signs the debug APK with a fresh key, so Android refuses to install a newer build over the old one (`INSTALL_FAILED_UPDATE_INCOMPATIBLE`) — you must uninstall first, **which deletes the saved progress on that tablet**. To keep one key across builds, create a debug keystore once (`keytool -genkey -v -keystore debug.keystore -alias androiddebugkey -storepass android -keypass android -keyalg RSA -validity 10000 -dname CN=Android` ), then add the repo secret `ANDROID_DEBUG_KEYSTORE` = `base64 -i debug.keystore`; the workflow picks it up automatically. A proper release keystore is a follow-up.
4. Tagging a commit `vX.Y.Z` also attaches the APK to a GitHub Release.

## The app id changed (old Sky Ninja id → `uk.co.sharpwise`, #1930)
Android treats a different application id as a different app. A build with the new id installs **beside** any build with the old id and starts with no saved progress; it does not update it. Nothing has been published to a store (the APK is debug-signed), so the only installs affected are test tablets. To carry progress across: in the **old** app open the parents' area → **Move to another device** → copy the save code; in the **new** app paste it into **Restore**. Then uninstall the old app. The id is fixed from the first store upload, so this is the cheap moment to change it. **Unverified:** no device install and no old-to-new save-code round trip has been done yet; that is a step for someone with a tablet, and the Android APK workflow only proves the build.

## App Links: `https://sharpwise.co.uk/play/…` opens the app (#2028)
`AndroidManifest.xml` has an `autoVerify` filter on `MainActivity` for `https://sharpwise.co.uk/play`; `src/deeplink-native.ts` hands the URL the OS opened to `handleDeepLink` (warm start: `appUrlOpen`; cold start: `App.getLaunchUrl()`) and ignores any other host or path. The app trusts the domain only if `https://sharpwise.co.uk/.well-known/assetlinks.json` lists this app's signing fingerprint.
- **Until the owner supplies the fingerprint nothing is published**: the Pages workflow (`scripts/app-links.mjs`) writes `assetlinks.json` only when the repository variable `ANDROID_APP_LINKS_SHA256` is set (comma or space separated for several), with the package from `capacitor.config.ts`. A file with no real fingerprint would verify nothing, and a debug key changes every CI run. Without verification Android opens the link in the browser, i.e. the web game at `/play/`: a safe fallback. A malformed value fails the deploy.
- With Play App Signing the fingerprint is **Google's app signing key** (Play Console, Setup, App signing, SHA-256), not the upload key. Add it (and the debug key's, to test a debug APK) to the variable. Details: `docs/WEBSITE.md`.
- Check on a device or emulator (Android 12+) after installing: `adb shell pm verify-app-links --re-verify uk.co.sharpwise`, then `adb shell pm get-app-links uk.co.sharpwise` (expect `sharpwise.co.uk: verified`), then `adb shell am start -a android.intent.action.VIEW -d "https://sharpwise.co.uk/play/?topic=<topicId>"`. Unverified on a device so far: the Android CI job proves the build only.

## Build locally (optional)
Android Studio (or the SDK command-line tools) + JDK 21:
```
npm ci && npm run build && npx cap sync android
cd android && ./gradlew assembleDebug        # → app/build/outputs/apk/debug/app-debug.apk
```
`npx cap open android` opens the project in Android Studio; `npx cap run android` installs on a connected device.

## Notes
- Read-aloud in the APK speaks through the device's own text-to-speech engine (`@capacitor-community/text-to-speech`, #881) — the WebView has no `speechSynthesis` of its own (crbug 40417848) — with no plugin, or in a browser, `say()`/`hush()` behave exactly as before.
- Back button (hardware or browser) steps back one screen: play/memory → island → sky map; the in-app Back/Islands buttons pop the same history, so the stack never grows. On the sky map, back sends the app to the background rather than closing it (`App.minimizeApp()`, #699) — in the browser or the PWA, where there is no such plugin, back at the root leaves the page as before.
- Icons and splash screens are generated from the 忍 mark by `python3 scripts/android-assets.py` (owner art can replace them later).
- Fonts: Fredoka is loaded from Google Fonts; offline the system font is used (inlining the font is issue #44).
- The web build stays unchanged — the same `dist/` feeds the single-file artifact and the APK.
- **No service worker inside the APK.** `dist/` carries one (#15) and `androidScheme: 'https'` makes
  `https://localhost` a secure context, so it *would* register here. `src/pwa.ts` gates it out on the presence
  of `window.Capacitor`: the APK already has every byte locally, and because that origin is identical for
  every version of the app, a cache surviving an update would serve the previous release with no route back
  but clearing app data. Offline play in the APK comes from the embedded `dist/`, not from a worker.
