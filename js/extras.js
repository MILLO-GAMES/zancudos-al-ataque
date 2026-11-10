// ==========================================================
// Extras: arte de criaderos dibujado en canvas (estilo cómic), álbum de láminas y detector de "agitar".
// ==========================================================

/** Dibuja un criadero (balde, neumático o florero) con o sin agua. Devuelve un <canvas> 256×256. */
export function drawCriadero(kind, full) {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d'); g.lineJoin = 'round'; g.lineCap = 'round';
  const ink = '#14101f', L = 9;
  const water = (cx, cy, rx, ry) => {
    g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    g.fillStyle = full ? '#3fc9ff' : '#3a2d22'; g.fill(); g.lineWidth = L * 0.7; g.strokeStyle = ink; g.stroke();
    if (full) {
      g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 5;
      g.beginPath(); g.ellipse(cx - rx * 0.25, cy - ry * 0.15, rx * 0.35, ry * 0.3, 0, Math.PI * 1.1, Math.PI * 1.8); g.stroke();
      // larvas (rayitas en el agua)
      g.strokeStyle = '#123'; g.lineWidth = 3;
      for (const [dx, dy] of [[0.25, 0.1], [-0.1, 0.25], [0.45, -0.15]]) {
        const x = cx + dx * rx, y = cy + dy * ry; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 6, y - 5, x + 12, y); g.quadraticCurveTo(x + 18, y + 5, x + 22, y); g.stroke();
      }
    }
  };
  const dots = (x0, y0, x1, y1, col) => { g.fillStyle = col; for (let x = x0; x < x1; x += 12) for (let y = y0; y < y1; y += 12) { g.beginPath(); g.arc(x + ((y / 12) % 2) * 6, y, 2.2, 0, 7); g.fill(); } };
  if (kind === 'balde') {
    g.beginPath(); g.moveTo(52, 92); g.lineTo(204, 92); g.lineTo(184, 236); g.lineTo(72, 236); g.closePath();
    g.fillStyle = '#2f7bff'; g.fill(); g.save(); g.clip(); dots(60, 100, 200, 236, 'rgba(10,20,80,.35)'); g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(70, 92, 18, 144); g.restore();
    g.lineWidth = L; g.strokeStyle = ink; g.stroke();
    g.beginPath(); g.arc(128, 96, 82, Math.PI * 1.05, Math.PI * 1.95); g.lineWidth = 7; g.stroke();
    water(128, 92, 76, 20);
  } else if (kind === 'neumatico') {
    g.beginPath(); g.ellipse(128, 160, 112, 70, 0, 0, Math.PI * 2); g.fillStyle = '#2b2b33'; g.fill(); g.lineWidth = L; g.strokeStyle = ink; g.stroke();
    g.strokeStyle = '#55556a'; g.lineWidth = 6;
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 10) { g.beginPath(); g.moveTo(128 + Math.cos(a) * 92, 160 + Math.sin(a) * 56); g.lineTo(128 + Math.cos(a) * 106, 160 + Math.sin(a) * 65); g.stroke(); }
    water(128, 150, 62, 30);
  } else { // florero
    g.beginPath(); g.moveTo(100, 70); g.bezierCurveTo(40, 120, 50, 230, 128, 236); g.bezierCurveTo(206, 230, 216, 120, 156, 70); g.closePath();
    g.fillStyle = '#ff5fa2'; g.fill(); g.save(); g.clip(); dots(50, 70, 210, 236, 'rgba(120,0,60,.35)'); g.restore(); g.lineWidth = L; g.strokeStyle = ink; g.stroke();
    if (full) { // flor
      g.strokeStyle = '#2e9e44'; g.lineWidth = 7; g.beginPath(); g.moveTo(128, 70); g.quadraticCurveTo(140, 40, 132, 14); g.stroke();
      g.fillStyle = '#ffe14a'; for (let a = 0; a < 6.2; a += 1.05) { g.beginPath(); g.arc(132 + Math.cos(a) * 14, 18 + Math.sin(a) * 14, 10, 0, 7); g.fill(); g.lineWidth = 4; g.strokeStyle = ink; g.stroke(); }
    }
    water(128, 72, 30, 10);
  }
  if (!full) { // cómic: "¡VACÍO!" + estrellitas
    g.font = '900 40px ui-rounded, system-ui, sans-serif'; g.textAlign = 'center'; g.lineWidth = 8; g.strokeStyle = ink; g.fillStyle = '#7dff6a';
    g.strokeText('¡VACÍO!', 128, 50); g.fillText('¡VACÍO!', 128, 50);
  }
  return c;
}

// ---------------- Álbum de láminas (localStorage) ----------------
export const CARDS = [
  { id: 'zancudo', name: 'Zancudo común', img: 'assets/sprites/zancudo_2.webp', how: 'Caza tu primer zancudo.',
    txt: 'Lento pero porfiado: zumba cerca de tu oreja. Aguanta 2 rociadas.', fact: 'Solo las hembras pican: necesitan la sangre para formar sus huevos.' },
  { id: 'explorador', name: 'Explorador', img: 'assets/sprites/zancudo_var2.webp', how: 'Caza un explorador (desde la oleada 2).',
    txt: 'Rápido y escurridizo: zigzaguea para que no le atines.', fact: 'Un zancudo bate sus alas cientos de veces por segundo: de ahí el “bzzz”.' },
  { id: 'acorazado', name: 'Acorazado', img: 'assets/sprites/zancudo_var3.webp', how: 'Caza un acorazado (desde la oleada 3).',
    txt: 'El tanque del grupo: lento, grandote y aguanta 6 rociadas.', fact: 'Te encuentran por el CO₂ que exhalas, el calor y el olor de tu piel.' },
  { id: 'posado', name: 'Cazador de muebles', img: 'assets/sprites/zancudo_4.webp', how: 'Elimina un zancudo posado en un objeto.',
    txt: 'Posado se queda quieto frotándose las patas: blanco fácil y ×2.', fact: 'Los zancudos descansan en lugares quietos y oscuros, como detrás de muebles y cortinas.' },
  { id: 'criadero', name: 'Adiós criadero', img: 'criadero', how: 'Vacía un criadero con agua estancada.',
    txt: 'Sin agua estancada no hay larvas, y sin larvas no hay zancudos.', fact: 'Vaciar baldes, neumáticos y platos de maceteros una vez a la semana corta el ciclo.' },
  { id: 'manotazo', name: 'Manotazo justo', img: 'emoji:✋', how: 'Espanta una picada con MANOTAZO.',
    txt: 'Si viene de frente, un manotazo a tiempo lo manda tosiendo de vuelta.', fact: 'Un mosquitero en la cama protege toda la noche sin químicos.' },
];
const KEY = 'an-album';
const load = () => { try { return new Set(JSON.parse(localStorage.getItem(KEY) || '[]')); } catch { return new Set(); } };
let owned = load();
export const albumCount = () => `${owned.size}/${CARDS.length}`;
/** Desbloquea una lámina. Devuelve la ficha si es nueva, o null. */
export function unlockCard(id) {
  if (owned.has(id)) return null;
  owned.add(id); localStorage.setItem(KEY, JSON.stringify([...owned]));
  return CARDS.find((c) => c.id === id) || null;
}
export function renderAlbum(el, criaderoUrl) {
  owned = load();
  el.innerHTML = CARDS.map((c) => {
    const has = owned.has(c.id);
    const img = c.img.startsWith('emoji:') ? `<span class="emo">${c.img.slice(6)}</span>` : `<img src="${c.img === 'criadero' ? criaderoUrl : c.img}" alt="">`;
    return `<div class="lamina ${has ? '' : 'locked'}"><div class="pic">${img}</div><b>${has ? c.name : '???'}</b>
      <p>${has ? c.txt : c.how}</p>${has ? `<p class="fact">¿Sabías que…? ${c.fact}</p>` : ''}</div>`;
  }).join('');
}

// ---------------- Agitar el teléfono (DeviceMotion) ----------------
/** Llama a onShake cuando detecta una sacudida fuerte. Requiere permiso de movimiento en iOS (ya se pide al iniciar). */
export function listenShake(onShake) {
  let lastT = 0, hits = 0, hitT = 0;
  window.addEventListener('devicemotion', (e) => {
    const a = e.acceleration, ag = e.accelerationIncludingGravity;
    let mag = 0;
    if (a && a.x != null) mag = Math.hypot(a.x, a.y, a.z);
    else if (ag && ag.x != null) mag = Math.abs(Math.hypot(ag.x, ag.y, ag.z) - 9.81);
    const now = performance.now();
    if (mag > 14) { if (now - hitT > 90) { hits = now - hitT < 600 ? hits + 1 : 1; hitT = now; } }
    if (hits >= 3 && now - lastT > 1200) { lastT = now; hits = 0; onShake(); }
  });
}
