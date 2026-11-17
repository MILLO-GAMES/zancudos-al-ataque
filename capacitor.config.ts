import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'cl.millogames.zancudos',
  appName: 'Zancudos al Ataque',
  webDir: 'www',
  // Sin server.url: el juego se sirve empaquetado (cámara, modelo y wasm van en el bundle).
  // No se usa server.iosScheme: Capacitor lo descarta en WKWebView y el origen real es capacitor://localhost,
  // que ya es un contexto seguro para getUserMedia y DeviceOrientation. Hay que comprobarlo en un iPhone real.
  // accessOrigins vacío: evita que cap sync regenere <access origin="*"/> en config.xml.
  cordova: {
    accessOrigins: [],
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
