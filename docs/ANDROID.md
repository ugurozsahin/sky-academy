# Android build (tablet APK)

The game is wrapped with [Capacitor](https://capacitorjs.com): the Vite build in `dist/` is embedded in the APK, so it runs **offline** on a tablet or phone. App id `uk.skyninja.academy`, name "Sky Ninja Academy".

## Get the APK (no tools needed)
1. GitHub → **Actions** → workflow **Android APK** → **Run workflow** on `main`, and wait ~3 minutes.
   (The APK is built on demand, not on every push: on a private repo that was ~3 metered minutes per commit
   for an artifact nobody downloaded. A `v*` tag builds one too, and attaches it to the release.)
2. Download the **sky-ninja-academy-apk** artifact (a zip), unzip → `sky-ninja-academy-<commit>.apk`.
3. On the tablet: allow "install unknown apps" for your browser/file manager once, open the APK, install.
   **Updating:** each CI run signs the debug APK with a fresh key, so Android refuses to install a newer build over the old one (`INSTALL_FAILED_UPDATE_INCOMPATIBLE`) — you must uninstall first, **which deletes the saved progress on that tablet**. To keep one key across builds, create a debug keystore once (`keytool -genkey -v -keystore debug.keystore -alias androiddebugkey -storepass android -keypass android -keyalg RSA -validity 10000 -dname CN=Android` ), then add the repo secret `ANDROID_DEBUG_KEYSTORE` = `base64 -i debug.keystore`; the workflow picks it up automatically. A proper release keystore is a follow-up.
4. Tagging a commit `vX.Y.Z` also attaches the APK to a GitHub Release.

## Build locally (optional)
Android Studio (or the SDK command-line tools) + JDK 21:
```
npm ci && npm run build && npx cap sync android
cd android && ./gradlew assembleDebug        # → app/build/outputs/apk/debug/app-debug.apk
```
`npx cap open android` opens the project in Android Studio; `npx cap run android` installs on a connected device.

## Notes
- Back button (hardware or browser) steps back one screen: play/memory → island → sky map; the in-app Back/Islands buttons pop the same history, so the stack never grows. On the sky map, back sends the app to the background rather than closing it (`App.minimizeApp()`, #699) — in the browser or the PWA, where there is no such plugin, back at the root leaves the page as before.
- Icons and splash screens are generated from the 忍 mark by `python3 scripts/android-assets.py` (owner art can replace them later).
- Fonts: Fredoka is loaded from Google Fonts; offline the system font is used (inlining the font is issue #44).
- The web build stays unchanged — the same `dist/` feeds the single-file artifact and the APK.
- **No service worker inside the APK.** `dist/` carries one (#15) and `androidScheme: 'https'` makes
  `https://localhost` a secure context, so it *would* register here. `src/pwa.ts` gates it out on the presence
  of `window.Capacitor`: the APK already has every byte locally, and because that origin is identical for
  every version of the app, a cache surviving an update would serve the previous release with no route back
  but clearing app data. Offline play in the APK comes from the embedded `dist/`, not from a worker.
