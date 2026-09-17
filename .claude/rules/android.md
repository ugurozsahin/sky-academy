---
paths:
  - "android/**"
  - "capacitor.config.ts"
  - "scripts/android-assets.py"
---

# Android APK (#101)

- `android/` is a generated directory — touch it only through `npx cap` commands or
  `scripts/android-assets.py`, never by hand.
- Capacitor is the one dependency-allowlist exception in this repo, kept specifically for the Android APK build
  — see `docs/ANDROID.md` for the full setup and the GitHub Actions "Android APK" workflow that builds it.
- Node/Java tooling versions used by the Android workflow are pinned deliberately; a deprecation warning there
  is tracked as its own issue rather than bumped ad hoc.
