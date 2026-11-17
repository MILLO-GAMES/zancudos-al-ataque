#!/usr/bin/env node
/**
 * Arma www/ para Capacitor: copia el juego estático, quita el service worker,
 * deja MediaPipe solo con archivos locales (sin CDN) y empaqueta el puente nativo.
 */
import { cpSync, mkdirSync, rmSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const www = join(root, 'www');

if (existsSync(www)) rmSync(www, { recursive: true, force: true });
mkdirSync(www, { recursive: true });

function copyDir(src, dest) {
  cpSync(src, dest, { recursive: true });
}

for (const dir of ['css', 'js', 'assets', 'icons', 'models', 'vendor']) {
  copyDir(join(root, dir), join(www, dir));
}

cpSync(join(root, 'index.html'), join(www, 'index.html'));
if (existsSync(join(root, 'favicon.ico'))) {
  cpSync(join(root, 'favicon.ico'), join(www, 'favicon.ico'));
}
if (existsSync(join(root, 'manifest.webmanifest'))) {
  cpSync(join(root, 'manifest.webmanifest'), join(www, 'manifest.webmanifest'));
}
if (existsSync(join(root, 'privacidad.html'))) {
  cpSync(join(root, 'privacidad.html'), join(www, 'privacidad.html'));
}

// No copiar sw.js ni promo/ (el GIF/MP4 no se usan en runtime y pesan ~6 MB).

// MediaPipe: en nativo solo archivos empaquetados. Sin jsDelivr ni storage.googleapis.com.
const detPath = join(www, 'js', 'detector.js');
let detector = readFileSync(detPath, 'utf8');
detector = detector.replace(
  /,\s*\{\s*lib: `https:\/\/cdn\.jsdelivr\.net\/npm\/@mediapipe\/tasks-vision@\$\{VER\}\/vision_bundle\.mjs`,\s*wasm: `https:\/\/cdn\.jsdelivr\.net\/npm\/@mediapipe\/tasks-vision@\$\{VER\}\/wasm`\s*\}/,
  '',
);
detector = detector.replace(
  /,\s*'https:\/\/storage\.googleapis\.com\/mediapipe-models\/object_detector\/efficientdet_lite0\/int8\/latest\/efficientdet_lite0\.tflite'/,
  '',
);
if (detector.includes('cdn.jsdelivr.net') || detector.includes('storage.googleapis.com')) {
  console.warn('AVISO: no se pudieron quitar todas las URLs remotas de detector.js');
} else {
  console.log('detector.js: CDN y modelo remoto quitados; solo archivos locales.');
}
writeFileSync(detPath, detector);

// Por si el guard del source no basta: no registrar service worker en nativo.
const mainPath = join(www, 'js', 'main.js');
let main = readFileSync(mainPath, 'utf8');
main = main.replace(
  /if \('serviceWorker' in navigator[^\n]*\n/,
  '// service worker omitido en la build iOS (el contenido ya va empaquetado)\n',
);
writeFileSync(mainPath, main);

let html = readFileSync(join(www, 'index.html'), 'utf8');
if (!html.includes('js/native-ios.js')) {
  html = html.replace(
    '<script type="module" src="js/main.js"></script>',
    '<script type="module" src="js/native-ios.js"></script>\n  <script type="module" src="js/main.js"></script>',
  );
}
// La ficha nativa no debe hablar de «navegador» ni de PWA.
html = html.replaceAll('Juego AR gratis en el navegador', 'Juego de realidad aumentada para iPhone');
html = html.replace(
  '<p class="mini">Es una app web instalable (PWA), no una app de App Store.</p>',
  '',
);
writeFileSync(join(www, 'index.html'), html);

await esbuild.build({
  absWorkingDir: root,
  entryPoints: [join(root, 'js', 'native-ios.js')],
  bundle: true,
  format: 'esm',
  platform: 'browser',
  outfile: join(www, 'js', 'native-ios.js'),
  sourcemap: false,
  legalComments: 'none',
  minify: false,
});

console.log('www/ listo');
