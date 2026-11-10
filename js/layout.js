// ==========================================================
// Layout Duo: decide entre "compacto" (una pantalla) y "abierto" (lienzo + columna)
// Orden de detección:
//   1) Viewport Segments API (window.viewport.segments): plegables con bisagra reportada.
//   2) CSS @media (horizontal/vertical-viewport-segments: 2) → ver style.css.
//   3) Heurística por tamaño CSS: Duo interior 7,6" ≈ 620+ px de ancho; Duo exterior 5,4"
//      e iPhone 15 Pro Max ≈ 430–470 px → compacto.
// El usuario puede forzar el modo desde el panel (útil para probar en un iPhone normal).
// ==========================================================
const MODES = ['auto', 'compacto', 'abierto'];
const body = document.body;
let forced = localStorage.getItem('an-layout') || 'auto';
let current = null;
const listeners = [];

export function onLayoutChange(fn) { listeners.push(fn); }
export function getLayout() { return current; }

export function cycleForcedLayout() {
  forced = MODES[(MODES.indexOf(forced) + 1) % MODES.length];
  localStorage.setItem('an-layout', forced);
  apply();
  return forced;
}
export function getForced() { return forced; }

function apply() {
  const w = window.innerWidth, h = window.innerHeight;
  const root = document.documentElement.style;
  const segs = window.viewport && window.viewport.segments;
  let mode = 'compacto';
  let info = 'Pantalla única (Duo cerrado / iPhone)';
  let segmented = false;
  root.removeProperty('--fold'); root.removeProperty('--seg2-w'); root.removeProperty('--seg2-h');

  if (segs && segs.length === 2) {
    const [a, b] = segs;
    segmented = true;
    if (Math.abs(a.top - b.top) < 2) {            // bisagra vertical: izq | der
      mode = 'abierto';
      root.setProperty('--fold', Math.max(0, b.left - a.right) + 'px');
      root.setProperty('--seg2-w', b.width + 'px');
      info = 'Duo abierto · 2 segmentos (lado a lado)';
    } else {                                       // bisagra horizontal: arriba / abajo
      mode = 'abierto-v';
      root.setProperty('--fold', Math.max(0, b.top - a.bottom) + 'px');
      root.setProperty('--seg2-h', b.height + 'px');
      info = 'Duo abierto · 2 segmentos (apilados)';
    }
  } else if (Math.min(w, h) >= 560 || w >= 760) {
    mode = 'abierto';
    info = `Pantalla grande (${w}×${h}) · Duo abierto`;
  } else {
    info = `Pantalla única (${w}×${h})`;
  }

  if (forced !== 'auto' && !segmented) {
    mode = forced;
    info += ` · forzado: ${forced}`;
  }

  body.classList.remove('layout-compacto', 'layout-abierto', 'layout-abierto-v');
  body.classList.add('layout-' + mode);
  body.classList.toggle('segmented', segmented);
  if (mode !== 'compacto') body.classList.remove('panel-open');

  const changed = mode !== current;
  current = mode;
  const el = document.getElementById('p-mode');
  if (el) el.textContent = 'Modo: ' + info;
  const btn = document.getElementById('btn-layout');
  if (btn) btn.textContent = 'Layout: ' + forced;
  listeners.forEach((fn) => fn(mode, changed));
}

export function initLayout() {
  apply();
  window.addEventListener('resize', apply);
  window.addEventListener('orientationchange', () => setTimeout(apply, 250));
  if (window.visualViewport) window.visualViewport.addEventListener('resize', apply);
  if (window.viewport && 'onsegmentschange' in window.viewport) window.viewport.addEventListener('segmentschange', apply);
  window.matchMedia('(horizontal-viewport-segments: 2)').addEventListener?.('change', apply);
}
