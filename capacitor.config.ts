import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.petsphere.app',
  appName: 'PetSphere',
  webDir: 'dist/petsphere-com-br/browser',
  ios: {
    contentInset: 'automatic',
    scheme: 'capacitor',
  },
  server: {
    androidScheme: 'https',
  },
  plugins: {
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true,
    },
    SplashScreen: {
      launchAutoHide: false,
    },
  },
};

export default config;
