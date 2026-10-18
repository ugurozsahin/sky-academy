import type { CapacitorConfig } from '@capacitor/cli';

// Android wrapper (issue #53): the Vite build in dist/ is embedded in the APK, so the game works offline on tablets.
const config: CapacitorConfig = {
  appId: 'uk.co.sharpwise',
  appName: 'Sharpwise',
  webDir: 'dist',
  android: { backgroundColor: '#131a33', allowMixedContent: false },
  server: { androidScheme: 'https' },
};

export default config;
