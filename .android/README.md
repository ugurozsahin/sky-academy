# .android

Home for the local copy of the stable debug signing key, `debug.keystore`.

- The file itself is **never committed** — `.gitignore` ignores `*.keystore` and `*.jks` everywhere in the repo.
- CI does not read this folder: the "Android APK" workflow takes the key from the repository secret `ANDROID_DEBUG_KEYSTORE` (the base64 of this file) and writes it to `~/.android/debug.keystore` on the runner.
- To upload or replace the secret: `base64 -i .android/debug.keystore | gh secret set ANDROID_DEBUG_KEYSTORE`
- Keep a backup elsewhere. If the key is lost, a new APK will not install over one signed with the old key.
