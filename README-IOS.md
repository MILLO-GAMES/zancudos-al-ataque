# Zancudos al Ataque — proyecto iOS (Capacitor)

Empaquetado para publicar en la App Store. El juego web no se reescribió: se copia a `www/` y se abre en un WebView nativo, **sin `server.url`**, para que funcione sin internet.

Este directorio es un clon local. **No se ha hecho push a GitHub ni se modificó `main`.**

Christian se refirió al juego como «Mosquitos al Ataque». El nombre oficial del producto, el que aparece en el juego y en el repo, es **¡Zancudos al Ataque!**. En la app y en la ficha se usa ese nombre. El bundle ID quedó `cl.millogames.zancudos` (no `cl.millogames.mosquitos`) para que coincida con la marca.

## Origen del código

- Repo: `https://github.com/MILLO-GAMES/zancudos-al-ataque` (público)
- Rama usada: `main`
- Commit: `0c1cd444b89bc71cf5cf45408eab33e37a96e3cc` (`0c1cd44`)
- Fecha del commit: 12 de noviembre de 2026, 19:39 hora de Chile (America/Santiago)
- Mensaje: `URL nueva: el juego pasa a /zancudos-al-ataque/, caché v5-link y Open Graph actualizado`

Antes se llamaba Asedio Neón (el repo `MILLO-GAMES/asedio-neon` solo redirige). Existe además el repo privado `MILLO-GAMES/zancudos-singular` («Edición Singular», con caras reales del equipo). **Esa edición no se usa en este empaquetado** y no debe publicarse en la App Store.

## Qué es la app

Juego de realidad aumentada de MILLO GAMES: te quedas en tu sitio, giras el iPhone, apuntas con la mira y rocias insecticida a zancudos estilo cómic que zumban en tu pieza. La cámara trasera es el fondo. Si el detector de objetos reconoce un mueble, algunos zancudos se posan y valen el doble. Hay oleadas, criaderos que hay que vaciar, un álbum de láminas, modo copiloto (pensado para un iPhone Duo abierto) y un modo sin cámara (holodeck).

En Xcode la versión de marketing quedó en **1.0** (build 1).

## Versiones usadas en este empaquetado

- Node (en el box de preparación): **22.23.5** (Capacitor 8.6.2 exige Node >= 22)
- Capacitor CLI / core / iOS: **8.6.2**
- Plugins: `@capacitor/haptics@8.0.2`, `@capacitor/status-bar@8.0.4`, `@capacitor/splash-screen@8.0.2`, `@capacitor/share@8.0.3`
- `@capacitor/assets@4.0.0` (ícono y splash)
- Gestor nativo iOS: **Swift Package Manager** (predeterminado en Capacitor 8). No hace falta CocoaPods ni `pod install`.

## Qué se agregó (sin reescribir la lógica del juego)

- Proyecto Capacitor iOS, `appId` `cl.millogames.zancudos`, nombre «Zancudos al Ataque».
- Contenido web empaquetado en `www/` (y, tras `cap sync`, en `ios/App/App/public`).
- Ícono 1024×1024 y splash a partir de `icons/icon-512.png` del repo (ilustración cómic del zancudo y el spray, ya usada en la PWA).
- Status bar (estilo oscuro, overlay).
- Hápticos al cazar un zancudo, al recibir una picada, al agitar la lata y al terminar la partida.
- Hoja nativa de compartir el puntaje (botón «Compartir resultado» en la pantalla final).
- `NSCameraUsageDescription` y `NSMotionUsageDescription` en español.
- En nativo se ocultan: instrucciones para instalar la PWA desde Safari, botones de pantalla completa y el texto de WebXR.
- No se registra el service worker en la app nativa.
- El detector de objetos (MediaPipe) en la build iOS usa **solo** los archivos locales (`vendor/mediapipe/`, `models/`). Se quitaron los respaldos a jsDelivr y a `storage.googleapis.com`.
- `server.iosScheme = 'https'` para que `getUserMedia` y la orientación del dispositivo corran en un origen seguro dentro de WKWebView.
- Política de privacidad empaquetada (`privacidad.html`), accesible desde el menú. **No se publicó en ningún servidor.**
- El proyecto Xcode quedó **solo para iPhone** (Targeted Device Family = 1). El juego está pensado para girar un teléfono; incluir iPad exigiría capturas de iPad 13".

## Uso offline y dependencias de red

La app está pensada para funcionar sin internet. Revisión hecha sobre el código:

| Recurso | ¿Offline? |
| --- | --- |
| Sprites, fuente Bangers, CSS/JS, Three.js r170 | Sí, empaquetado |
| MediaPipe Tasks Vision 1.2.2 y wasm | Sí, empaquetado (`vendor/mediapipe/`) |
| Modelo EfficientDet-Lite0 (int8, ~4,6 MB) | Sí, empaquetado (`models/`) |
| Música y efectos | Sí, sintetizados con WebAudio en el aparato |
| `localStorage` (récord, álbum, preferencias) | Sí, en el dispositivo |
| Cámara y sensores | Hardware local; no se envía nada |
| Respaldo CDN de MediaPipe (jsDelivr / Google Storage) | **Quitado en la build iOS** |
| Open Graph (`millo-games.github.io`) | Solo metadato en el HTML; no se llama en runtime |
| Service worker | No se registra en nativo |

No hay analíticas, anuncios, compras, cuentas ni rastreo.

Si el modelo local no carga, el juego sigue (sin posarse en muebles), igual que en la web.

## Comandos exactos en el MacBook Pro

Requisitos:

- **Node.js 22 o superior** (Capacitor 8.6.2 no soporta Node 20). Comprobar con `node -v`.
- **Xcode 26.0 o superior** (requisito de Capacitor 8), con el componente iOS y una cuenta de Apple Developer para firmar.
- CocoaPods **no** es necesario (el proyecto iOS usa SPM).
- Probar la cámara en un **iPhone real**. El simulador no entrega una cámara trasera usable; en ese caso el juego cae al modo holodeck.

```bash
# 1. Descomprimir el zip y entrar al proyecto
cd /ruta/a/mosquitos-al-ataque

# 2. Instalar dependencias JS (incluye los plugins que SPM referencia desde node_modules)
npm install

# 3. Regenerar www/ y copiarlo al proyecto Xcode
npm run cap:sync
# equivale a:  npm run build && npx cap sync ios

# 4. Abrir en Xcode (abre ios/App/App.xcodeproj, no un .xcworkspace)
npx cap open ios
```

En Xcode, una sola vez:

1. Signing & Capabilities: elegir el Team de la cuenta Apple Developer y dejar el Bundle ID `cl.millogames.zancudos`.
2. Si Xcode pide resolver paquetes Swift: File → Packages → Resolve Package Versions.
3. Elegir un iPhone (o un simulador solo para probar menú/holodeck) y pulsar Run.
4. Para la tienda: Product → Archive, y subir a App Store Connect.

No hace falta correr `pod install`.

Si se cambian HTML/JS/CSS/assets, repetir `npm run cap:sync` antes de volver a compilar.

## Rutas útiles

- Proyecto: `/workspace/ios-apps/mosquitos-al-ataque` (en el box); la misma estructura dentro del zip
- Config Capacitor: `capacitor.config.ts` (`webDir: www`, sin `server.url`, `server.iosScheme: 'https'`)
- Puente nativo: `js/native-ios.js` (se empaqueta a `www/js/native-ios.js`)
- Build web: `scripts/build-www.mjs`
- Ícono y splash fuente: `resources/icon.png`, `resources/splash.png`
- Catálogo Xcode: `ios/App/App/Assets.xcassets/`
- Info.plist: `ios/App/App/Info.plist` (cámara, movimiento, `ITSAppUsesNonExemptEncryption = false`)
- Ficha App Store: `/workspace/ios-apps/mosquitos-ficha.md`
- Política de privacidad (fuente): `/workspace/ios-apps/mosquitos-privacidad/privacidad.html` (copia también en el repo: `privacidad.html`)
- URL pública propuesta (aún no publicada): `https://zancudos.millogames.online/privacidad.html`

## Riesgos de revisión (Apple)

- **Guideline 4.2 (Minimum functionality):** es una WebView de un juego HTML5/Three.js. Se añadieron ícono, splash, status bar, hápticos, share nativo, permisos nativos de cámara/movimiento y modo offline. El juego en sí es sustancial (AR, oleadas, detector de objetos, álbum, copiloto). Aun así existe riesgo si el revisor lo percibe como «solo un sitio envuelto». En la ficha no conviene hablar de PWA, Safari ni «versión web».
- **Cámara en WKWebView:** `getUserMedia` debería funcionar con `NSCameraUsageDescription` y `iosScheme: https`. Hay que comprobarlo en un iPhone real antes de enviar a revisión. Si fallara, el modo holodeck sigue disponible, pero la propuesta de valor de la ficha es el AR en la pieza.
- **Guideline 5.1.1 (privacidad):** al usar cámara hace falta una política de privacidad **con URL pública** en App Store Connect. El HTML está listo, pero **no se ha publicado en ningún servidor**. Hay que subirla (por ejemplo a `https://zancudos.millogames.online/privacidad.html`) antes del envío, con autorización y revisión del Auditor.
- **MediaPipe / visión:** en esta build no hay llamadas de red. Declarar en la ficha de privacidad que la cámara se procesa solo en el dispositivo y que no se recolectan datos.
- No se incluye la Edición Singular (caras reales). Publicarla sería un riesgo grave de privacidad y de consentimiento de imagen.
- Monetización futura (compras, anuncios) no está en esta versión; habría que declararla en una actualización.
- El nombre «Mosquitos al Ataque» no aparece en el juego. Usar ese nombre en la ficha chocaría con la guía de precisión de metadatos (2.3).

La ficha para App Store Connect está en `../mosquitos-ficha.md` (junto al zip).
