# Android build (tablet APK)

The game is wrapped with [Capacitor](https://capacitorjs.com): the Vite build in `dist/` is embedded in the APK, so it runs **offline** on a tablet or phone. App id `uk.co.sharpwise`, name "Sharpwise".

## Get the APK (no tools needed)
1. GitHub → **Actions** → workflow **Android APK** → **Run workflow** on `main`, and wait ~3 minutes.
   (The APK is built on demand, not on every push: on a private repo that was ~3 metered minutes per commit
   for an artifact nobody downloaded. A `v*` tag builds one too, and attaches it to the release.)
2. Download the **sky-ninja-academy-apk** artifact (a zip), unzip → `sky-ninja-academy-<commit>.apk`.
3. On the tablet: allow "install unknown apps" for your browser/file manager once, open the APK, install.
   **Updating:** each CI run signs the debug APK with a fresh key, so Android refuses to install a newer build over the old one (`INSTALL_FAILED_UPDATE_INCOMPATIBLE`) — you must uninstall first, **which deletes the saved progress on that tablet**. To keep one key across builds, create a debug keystore once (`keytool -genkey -v -keystore debug.keystore -alias androiddebugkey -storepass android -keypass android -keyalg RSA -validity 10000 -dname CN=Android` ), then add the repo secret `ANDROID_DEBUG_KEYSTORE` = `base64 -i debug.keystore`; the workflow picks it up automatically. The Play release key is separate: see "Release build" below.
4. Tagging a commit `vX.Y.Z` also attaches the APK to a GitHub Release.

## The app id changed (old Sky Ninja id → `uk.co.sharpwise`, #1930)
Android treats a different application id as a different app. A build with the new id installs **beside** any build with the old id and starts with no saved progress; it does not update it. Nothing has been published to a store (the APK is debug-signed), so the only installs affected are test tablets. To carry progress across: in the **old** app open the parents' area → **Move to another device** → copy the save code; in the **new** app paste it into **Restore**. Then uninstall the old app. The id is fixed from the first store upload, so this is the cheap moment to change it. **Unverified:** no device install and no old-to-new save-code round trip has been done yet; that is a step for someone with a tablet, and the Android APK workflow only proves the build.

## Release build (signed bundle for Google Play, #1939)
Play takes an Android App Bundle (`.aab`), not an APK ([docs](https://developer.android.com/guide/app-bundle)). The `release` job in **Android APK** builds one with `./gradlew bundleRelease`, signed with an **upload key** that lives only in repository secrets. It runs on a `v*` tag or **Run workflow**, never on a PR, and it is **skipped (not failed)** until you opt in, so `main` stays green. It validates the bundle with `bundletool validate` and uploads it as the artifact **sharpwise-aab**. `versionCode` is the workflow run number (it only rises); `versionName` is the tag without its `v`. Uploading to Play stays manual.

**One-time steps (the owner):**
1. Create the upload key on your own machine (keep the passwords somewhere safe; you will paste them in step 4):
   `keytool -genkeypair -v -keystore sharpwise-upload.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000`
2. **Back it up now**: the `.jks` file and its passwords, in a password manager and one offline copy. **Never commit it, paste it into an issue, or put it in the repo.** If you lose it, Play can reset the upload key (that is the point of step 3), but only through a support request.
3. In Play Console enrol the app in **Play App Signing** (the default for new apps): Google then holds the app-signing key, and you hold only the upload key ([docs](https://support.google.com/googleplay/android-developer/answer/9842756)).
4. Repository **Secrets** (Settings, Secrets and variables, Actions): `ANDROID_UPLOAD_KEYSTORE` = `base64 -i sharpwise-upload.jks`, `ANDROID_UPLOAD_KEYSTORE_PASSWORD`, `ANDROID_UPLOAD_KEY_ALIAS` (`upload` above) and `ANDROID_UPLOAD_KEY_PASSWORD`.
5. Repository **Variable**: `ANDROID_RELEASE_ENABLED` = `true` (a job-level condition cannot read secrets, so a variable is the switch). With it set and a secret missing, the job fails with a message naming it.
6. Tag `vX.Y.Z` (or Run workflow), download **sharpwise-aab**, and upload it to the internal test track.

**App Links:** the SHA-256 that matters for `assetlinks.json` is **Google's app-signing key**, not the upload key you create here; see "App Links" below for where it goes.

The workflow decodes the keystore to a temp file, passes its path and the passwords to Gradle through environment variables (`android/app/build.gradle`, `signingConfigs.release`), and deletes the file afterwards. With none of those set, `./gradlew assembleDebug` below works as before and `bundleRelease` gives an unsigned bundle.

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
- Icons and splash screens are generated from the 賢 (wise) mark by `python3 scripts/android-assets.py` (owner art can replace them later).
- Fonts: Fredoka is loaded from Google Fonts; offline the system font is used (inlining the font is issue #44).
- The web build stays unchanged — the same `dist/` feeds the single-file artifact and the APK.
- **No service worker inside the APK.** `dist/` carries one (#15) and `androidScheme: 'https'` makes
  `https://localhost` a secure context, so it *would* register here. `src/pwa.ts` gates it out on the presence
  of `window.Capacitor`: the APK already has every byte locally, and because that origin is identical for
  every version of the app, a cache surviving an update would serve the previous release with no route back
  but clearing app data. Offline play in the APK comes from the embedded `dist/`, not from a worker.
