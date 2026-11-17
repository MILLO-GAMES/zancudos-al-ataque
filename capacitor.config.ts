import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'cl.millogames.zancudos',
  appName: 'Zancudos al Ataque',
  webDir: 'www',
  // Sin server.url: el juego se sirve empaquetado (cámara, modelo y wasm van en el bundle).
  // iosScheme https: origen seguro, necesario para getUserMedia y DeviceOrientation en WKWebView.
  server: {
    iosScheme: 'https',
    hostname: 'localhost',
  },
  ios: {
    contentInset: 'never',
    preferredContentMode: 'mobile',
    allowsLinkPreview: false,
    scrollEnabled: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
      launchAutoHide: false,
      backgroundColor: '#ff9628',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#14101f',
      overlaysWebView: true,
    },
  },
};

export default config;
