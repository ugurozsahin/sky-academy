import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

/** #1939: the signed Play bundle. The job is skipped until the owner opts in, and the key never leaves secrets. */
const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const wf = read('.github/workflows/android.yml');
const release = wf.slice(wf.indexOf('\n  release:'));
const gradle = read('android/app/build.gradle');

describe('the Android release job (#1939)', () => {
  it('is skipped, not failed, until the variable is set, and never runs on a pull request', () => {
    expect(release).toMatch(/^    if: .*github\.event_name != 'pull_request' && vars\.ANDROID_RELEASE_ENABLED == 'true'/m);
    expect(read('docs/ANDROID.md')).toContain('`ANDROID_RELEASE_ENABLED` = `true`');
  });
  it('leaves the debug APK job alone', () => {
    const apk = wf.slice(wf.indexOf('\n  apk:'), wf.indexOf('\n  release:'));
    expect(apk).toContain('./gradlew assembleDebug --no-daemon');
    expect(apk).not.toMatch(/bundleRelease|ANDROID_UPLOAD/);
  });
  it('builds a bundle with an upload key from secrets, decoded to a temp file that is removed', () => {
    expect(release).toContain('./gradlew bundleRelease');
    for (const s of ['KEYSTORE', 'KEYSTORE_PASSWORD', 'KEY_ALIAS', 'KEY_PASSWORD']) expect(release).toContain(`secrets.ANDROID_UPLOAD_${s}`);
    expect(release).toContain('base64 -d > "$RUNNER_TEMP/upload.jks"');
    expect(release).toMatch(/if: \$\{\{ always\(\) \}\}\n\s+run: rm -f "\$RUNNER_TEMP\/upload\.jks"/);
  });
  it('never echoes a secret: every secret is read through env:, none inside a run: line', () => {
    const uses = release.split('\n').filter((l) => l.includes('secrets.'));
    expect(uses.length).toBe(4);
    for (const l of uses) expect(l, l).toMatch(/^\s+(env: \{ )?[A-Z_]+: '?\$\{\{ secrets\.[A-Z_]+ \}\}/);
    expect(release).not.toMatch(/echo[^\n]*\$KS\b/);
    expect(release).not.toMatch(/echo[^\n]*(PASSWORD|\$\{\{ secrets)/);
  });
  it('takes versionCode from the run number, validates with bundletool and uploads the .aab', () => {
    expect(release).toContain('ANDROID_VERSION_CODE: ${{ github.run_number }}');
    expect(release).toMatch(/bundletool.*validate --bundle=/);
    expect(release).toContain('sha256sum -c');
    expect(release).toMatch(/upload-artifact@v\d+\n\s+with:\n\s+name: sharpwise-aab\n\s+path: sharpwise-\*\.aab/);
  });
});

describe('android/app/build.gradle signing (#1939)', () => {
  it('reads the upload key from the environment only, and signs release only when it is set', () => {
    expect(gradle).toMatch(/signingConfigs \{\s+release \{/);
    for (const e of ['ANDROID_KEYSTORE_PATH', 'ANDROID_KEYSTORE_PASSWORD', 'ANDROID_KEY_ALIAS', 'ANDROID_KEY_PASSWORD']) {
      expect(gradle).toContain(`System.getenv("${e}")`);
    }
    expect(gradle).toContain('if (System.getenv("ANDROID_KEYSTORE_PATH")) signingConfig signingConfigs.release');
    expect(gradle).not.toMatch(/storePassword\s+["']|keyPassword\s+["']/);
  });
  it('takes versionCode and versionName from the environment with local defaults', () => {
    expect(gradle).toContain('versionCode((System.getenv("ANDROID_VERSION_CODE") ?: "1").toInteger())');
    expect(gradle).toContain('versionName(System.getenv("ANDROID_VERSION_NAME") ?: "1.0")');
  });
});
