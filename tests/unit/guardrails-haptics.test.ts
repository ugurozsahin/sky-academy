import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// #882: the Android app manifest declared no `VIBRATE` permission, so `navigator.vibrate` (`haptic()`,
// `src/audio.ts`) silently did nothing in the APK — Chromium's `VibrationManagerAndroid` checks the
// permission and skips the call without it. `@capacitor/haptics` is a devDependency only for its own library
// manifest, which the Android manifest merger folds `VIBRATE` in from; `npx cap sync android` registers it.
// While `src/audio.ts` calls `vibrate`, three things must hold together, each proved red first by removing
// the dependency and watching every one of these fail:
const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));
const settingsGradle = readFileSync(new URL('../../android/capacitor.settings.gradle', import.meta.url), 'utf8');
const buildGradle = readFileSync(new URL('../../android/app/capacitor.build.gradle', import.meta.url), 'utf8');
const pluginManifest = readFileSync(
  new URL('../../node_modules/@capacitor/haptics/android/src/main/AndroidManifest.xml', import.meta.url), 'utf8',
);

describe('the Android app can vibrate (#882)', () => {
  it('src/audio.ts still calls navigator.vibrate', () => {
    const audio = readFileSync(new URL('../../src/audio.ts', import.meta.url), 'utf8');
    expect(audio).toContain('nav.vibrate(');
  });

  it('package.json lists @capacitor/haptics as a devDependency', () => {
    expect(pkg.devDependencies?.['@capacitor/haptics'], '@capacitor/haptics must be a devDependency').toBeDefined();
  });

  it('android/capacitor.settings.gradle includes :capacitor-haptics, which proves cap sync ran', () => {
    expect(settingsGradle).toContain("include ':capacitor-haptics'");
  });

  it('android/app/capacitor.build.gradle actually depends on :capacitor-haptics, not just settings.gradle', () => {
    expect(buildGradle).toContain("implementation project(':capacitor-haptics')");
  });

  it("the plugin's own manifest still declares VIBRATE, so the merge still has something to fold in", () => {
    expect(pluginManifest).toContain('android.permission.VIBRATE');
  });
});
