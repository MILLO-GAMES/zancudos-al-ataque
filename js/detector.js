// ==========================================================
// Detector de objetos de la pieza (MediaPipe Object Detector · EfficientDet-Lite0 · COCO).
// Corre sobre el video de la cámara a pocos cuadros por segundo para no botar el rendimiento.
// Primero intenta los archivos copiados en el repo (funciona offline una vez cacheado) y,
// si fallan, el CDN oficial. Si nada carga, el juego sigue igual pero sin posarse en objetos.
// ==========================================================
const VER = '1.2.2';
const SOURCES = [
  { lib: new URL('../vendor/mediapipe/vision_bundle.mjs', import.meta.url).href, wasm: new URL('../vendor/mediapipe/wasm', import.meta.url).href },
  { lib: `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VER}/vision_bundle.mjs`, wasm: `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VER}/wasm` },
];
const MODELS = [
  new URL('../models/efficientdet_lite0.tflite', import.meta.url).href,
  'https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/int8/latest/efficientdet_lite0.tflite',
];

/** Clases COCO donde un zancudo se puede posar, con su nombre en chileno. */
export const PERCH_NAMES = {
  tv: 'la tele', couch: 'el sillón', chair: 'la silla', 'dining table': 'la mesa', bed: 'la cama', laptop: 'el notebook',
  refrigerator: 'el refri', 'potted plant': 'la planta', microwave: 'el microondas', oven: 'el horno', sink: 'el lavaplatos',
  clock: 'el reloj', vase: 'el florero', bench: 'la banca', toilet: 'el baño', 'teddy bear': 'el peluche', keyboard: 'el teclado',
  book: 'el libro', bottle: 'la botella', cup: 'la taza', suitcase: 'la maleta', backpack: 'la mochila',
};
export const PERCH_ICON = { tv: '📺', couch: '🛋️', chair: '🪑', 'dining table': '🍽️', bed: '🛏️', laptop: '💻', refrigerator: '🧊', 'potted plant': '🪴', clock: '🕰️', book: '📘', bottle: '🍾', cup: '☕' };

// MediaPipe escribe avisos informativos ("INFO: Created TensorFlow Lite XNNPACK delegate…") como console.error: los silenciamos.
const _err = console.error.bind(console);
console.error = (...a) => { if (typeof a[0] === 'string' && a[0].startsWith('INFO:')) return; _err(...a); };

const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);

export class ObjectSpotter {
  constructor() { this.status = 'off'; this.det = null; this.delegate = ''; this.lastTs = 0; this.cost = 0; this.error = ''; }

  /** Carga perezosa: se llama al empezar a jugar con cámara. Nunca lanza error. */
  async load() {
    if (this.status === 'loading' || this.status === 'ready') return this.status === 'ready';
    this.status = 'loading';
    for (const src of SOURCES) {
      try {
        const vision = await withTimeout(import(src.lib), 20000);
        const fileset = await withTimeout(vision.FilesetResolver.forVisionTasks(src.wasm), 30000);
        for (const model of MODELS) {
          for (const delegate of ['CPU', 'GPU']) { // CPU primero: el delegado GPU devolvió cero detecciones en pruebas (WebGL por software)
            try {
              this.det = await withTimeout(vision.ObjectDetector.createFromOptions(fileset, {
                baseOptions: { modelAssetPath: model, delegate },
                runningMode: 'VIDEO', scoreThreshold: 0.38, maxResults: 6,
                categoryAllowlist: Object.keys(PERCH_NAMES),
              }), 45000);
              this.delegate = delegate; this.status = 'ready';
              return true;
            } catch (e) { this.error = String(e?.message || e); }
          }
        }
      } catch (e) { this.error = String(e?.message || e); }
    }
    console.info('Detector de objetos no disponible:', this.error);
    this.status = 'error';
    return false;
  }

  /** Detecta sobre el cuadro actual. Devuelve [{label, score, x, y, w, h}] en píxeles del video. */
  detect(video) {
    if (this.status !== 'ready' || !video.videoWidth || video.readyState < 2) return null;
    let ts = performance.now(); if (ts <= this.lastTs) ts = this.lastTs + 1; this.lastTs = ts;
    const t0 = performance.now();
    let res;
    try { res = this.det.detectForVideo(video, ts); } catch (e) { this.error = String(e?.message || e); return null; }
    this.cost = this.cost ? this.cost * 0.8 + (performance.now() - t0) * 0.2 : performance.now() - t0;
    return (res?.detections || []).map((d) => {
      const c = d.categories[0], b = d.boundingBox;
      return { label: c.categoryName, score: c.score, x: b.originX, y: b.originY, w: b.width, h: b.height };
    }).filter((d) => PERCH_NAMES[d.label]);
  }
  /** Intervalo sugerido entre detecciones (ms): 4 fps, baja a ~2 fps si el equipo sufre. */
  interval() { return this.cost > 90 ? 600 : this.cost > 45 ? 380 : 250; }
}
