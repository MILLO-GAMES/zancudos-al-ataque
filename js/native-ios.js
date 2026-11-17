/**
 * Puente nativo iOS (Capacitor). Solo se carga en la build www/.
 * En la PWA web no se importa, así que el juego sigue funcionando en el navegador.
 */
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { Share } from '@capacitor/share';

export function isNativeApp() {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

function hideWebOnlyChrome() {
  document.documentElement.classList.add('is-capacitor');
  document.body.classList.add('is-capacitor');
  const hideIds = ['btn-fs', 'btn-fs-menu', 'install', 'm-xr'];
  for (const id of hideIds) {
    const el = document.getElementById(id);
    if (el) el.hidden = true;
  }
}

async function setupStatusBar() {
  try {
    await StatusBar.setOverlaysWebView({ overlay: true });
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.show();
  } catch (err) {
    console.warn('StatusBar', err);
  }
}

export async function hapticImpact(level = 'light') {
  if (!isNativeApp()) return;
  try {
    const map = {
      light: ImpactStyle.Light,
      medium: ImpactStyle.Medium,
      heavy: ImpactStyle.Heavy,
    };
    await Haptics.impact({ style: map[level] || ImpactStyle.Light });
  } catch {
    try {
      await Haptics.notification({ type: NotificationType.Success });
    } catch { /* simulador o hápticos no disponibles */ }
  }
}

export async function shareNativeText(title, text) {
  if (!isNativeApp()) return false;
  try {
    await Share.share({
      title: title || 'Zancudos al Ataque',
      text,
      dialogTitle: 'Compartir resultado',
    });
    return true;
  } catch (err) {
    if (err && (err.message || '').toLowerCase().includes('cancel')) return true;
    console.warn('Share', err);
    return false;
  }
}

export async function initNative() {
  if (!isNativeApp()) return;
  hideWebOnlyChrome();
  await setupStatusBar();
  try {
    await SplashScreen.hide({ fadeOutDuration: 350 });
  } catch { /* ya oculta */ }
}

function bindGlobal() {
  window.__zaNative = {
    isNative: isNativeApp,
    init: initNative,
    haptic: hapticImpact,
    shareText: shareNativeText,
  };
  const start = () => {
    if (isNativeApp()) {
      hideWebOnlyChrome();
      initNative();
    }
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
}

bindGlobal();
