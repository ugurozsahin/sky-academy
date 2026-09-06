import type { CapacitorConfig } from '@capacitor/cli';

// Android wrapper (issue #53): the Vite build in dist/ is embedded in the APK, so the game works offline on tablets.
const config: CapacitorConfig = {
  appId: 'uk.skyninja.academy',
  appName: 'Sky Ninja Academy',
  webDir: 'dist',
  android: { backgroundColor: '#131a33', allowMixedContent: false },
  server: { androidScheme: 'https' },
};

export default config;
