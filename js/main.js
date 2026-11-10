// ==========================================================
// Asedio Neón · Millo Games — Invasión de zancudos AR
// Quédate en tu sitio, gira el teléfono, apunta y rocíales insecticida.
// Render: Three.js sobre el video de la cámara trasera. Apuntado: orientación del teléfono (3DoF).
// Los zancudos se posan sobre objetos reales que detecta MediaPipe (tele, sillón, mesa…).
// ==========================================================
import * as THREE from '../vendor/three.module.min.js';
import { initLayout, onLayoutChange, cycleForcedLayout, getLayout } from './layout.js';
import { initAudio, unlockAudio, resumeAudio, sfx, createBuzz, sprayStart, sprayStop, musicCtl, setSound, setMusicVolume, setSfxVolume, getVolumes, audioState, outputLevel } from './audio.js';
import { requestMotionPermission, startCamera, AimController, matchCameraFov } from './sensors.js';
import { ObjectSpotter, PERCH_NAMES, PERCH_ICON } from './detector.js';
import { drawCriadero, unlockCard, renderAlbum, albumCount, listenShake } from './extras.js';

const $ = (id) => document.getElementById(id);
const stage = $('stage'), video = $('cam'), glCanvas = $('gl'), fx2d = $('fx2d');
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const DEG = Math.PI / 180;

// ---------------- Configuración (más fácil que la versión de drones) ----------------
const CFG = {
  maxHp: 150, maxShield: 100,
  shieldDrain: 14, shieldRegen: 16, shieldCone: Math.cos(70 * DEG), shieldReach: 1.8,
  sprayMax: 30, sprayDrain: 5, sprayRegen: 0, shakeTime: 0.8, sprayTick: 0.1,
  sprayRange: 9, sprayCone: 6 * DEG,            // el cono se ensancha con la distancia (ayuda de puntería)
  arcYaw: 45 * DEG, arcPitch: 20 * DEG,          // arco frontal donde aparecen y vuelan
  perchDist: 3.0,                                // distancia fija a la que se proyecta un objeto detectado
};

// ---------------- Three.js ----------------
const renderer = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setClearColor(0x000000, 0);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(65, 1, 0.05, 200);
camera.rotation.order = 'YXZ';
scene.add(camera);
const aim = new AimController(camera, stage);
const spotter = new ObjectSpotter();

// Texturas
const loader = new THREE.TextureLoader();
const tex = (name) => { const t = loader.load(`assets/sprites/${name}.webp`); t.colorSpace = THREE.SRGBColorSpace; return t; };
const TEX = {
  flap: [1, 2, 3, 4].map((i) => tex(`zancudo_${i}`)),
  dead: tex('zancudo_muerto'),
  var2: tex('zancudo_var2'),
  var3: tex('zancudo_var3'),
};
const FLAP_SEQ = [1, 2, 3, 2]; // índices 0-based de los cuadros 2-3-4-3
function softTexture(inner, outer) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, inner); grd.addColorStop(0.55, outer); grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const PUFF = softTexture('rgba(255,255,235,.95)', 'rgba(230,250,200,.45)');
const FOG = softTexture('rgba(150,255,110,.9)', 'rgba(90,220,80,.4)');

// ---------- Ambiente holodeck (solo sin cámara) ----------
const holodeck = new THREE.Group(); scene.add(holodeck);
{
  const grid = new THREE.GridHelper(80, 80, 0xff2bd6, 0x7a1a8a); grid.position.y = -1.5;
  grid.material.transparent = true; grid.material.opacity = 0.55; holodeck.add(grid);
  const starsG = new THREE.BufferGeometry(); const p = [];
  for (let i = 0; i < 900; i++) { const v = new THREE.Vector3().randomDirection().multiplyScalar(rand(60, 90)); if (v.y < -5) v.y *= -1; p.push(v.x, v.y, v.z); }
  starsG.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  holodeck.add(new THREE.Points(starsG, new THREE.PointsMaterial({ color: 0x99ddff, size: 0.25 })));
  // Una "tele" falsa en el holodeck para que también haya donde posarse sin cámara
  const tv = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.75, 0.08), new THREE.MeshBasicMaterial({ color: 0x1b1b2e }));
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.66), new THREE.MeshBasicMaterial({ color: 0x2a6cff }));
  scr.position.z = 0.045; tv.add(scr);
  tv.position.set(-1.1, -0.55, -3.2); tv.lookAt(0, -0.55, 0); holodeck.add(tv);
  holodeck.userData.tvTop = new THREE.Vector3(-1.1, -0.55 + 0.375, -3.2);
}

// ---------------- Estado ----------------
const S = {
  state: 'menu', mode: 'ar', // 'ar' (cámara+IMU) | 'holo' (sin cámara) | 'xr'
  score: 0, best: +(localStorage.getItem('an-best') || 0),
  wave: 0, toSpawn: 0, spawnTimer: 0, interTimer: 0,
  hp: CFG.maxHp, shield: CFG.maxShield, shieldBroken: false, shieldIdle: 0,
  spray: CFG.sprayMax, shaking: 0, sprayIdle: 0, tickCd: 0,
  firing: false, shielding: false, wasFiring: false,
  combo: 0, comboTimer: 0, shots: 0, hits: 0, kills: 0, perchKills: 0, avoided: 0, bites: 0, nests: 0,
  coop: localStorage.getItem('an-coop') === 'on',
  diveCd: 4, perchCd: 2, time: 0,
  detectOn: localStorage.getItem('an-detect') !== 'off', detectT: 0, spotted: new Set(),
};
const enemies = [], puffs = [], perches = [], nests = [];

// ---------------- Tipos de zancudo ----------------
const TYPES = {
  zancudo:    { name: 'zancudo',    hp: 2, score: 100, speed: 0.55, dive: 1.5, dmg: 10, size: 0.62, zig: 0.22, zigF: 1.3, pitch: 1.0,  tex: 'flap' },
  explorador: { name: 'explorador', hp: 2, score: 150, speed: 0.9,  dive: 1.9, dmg: 10, size: 0.55, zig: 0.35, zigF: 2.0, pitch: 1.25, tex: 'var2' },
  acorazado:  { name: 'acorazado',  hp: 6, score: 300, speed: 0.4,  dive: 1.2, dmg: 15, size: 0.85, zig: 0.15, zigF: 0.9, pitch: 0.72, tex: 'var3' },
};

/** Dirección dentro del arco frontal (−Z es "el frente" fijado al iniciar o recentrar). */
function arcDir(yawMax = CFG.arcYaw, pitchMax = CFG.arcPitch) {
  const yaw = rand(-yawMax, yawMax), pitch = rand(-pitchMax, pitchMax);
  return new THREE.Vector3(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
}
const arcPoint = () => arcDir(Math.min(CFG.arcYaw, (30 + S.wave * 4) * DEG)).multiplyScalar(rand(3.8, 6));

function spawnEnemy(forceType) {
  const w = S.wave; let type = 'zancudo'; const r = Math.random();
  if (w >= 2 && r < Math.min(0.3, 0.1 + w * 0.03)) type = 'explorador';
  else if (w >= 3 && r > 1 - Math.min(0.25, 0.06 + w * 0.025)) type = 'acorazado';
  if (forceType) type = forceType;
  const t = TYPES[type];
  const mat = new THREE.SpriteMaterial({ map: t.tex === 'flap' ? TEX.flap[1] : TEX[t.tex], transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(mat); sprite.scale.setScalar(t.size);
  const home = arcPoint();
  const full = nests.filter((n) => n.full);
  let base;
  if (full.length && Math.random() < 0.7) { const n = full[Math.floor(Math.random() * full.length)]; base = n.sprite.position.clone(); n.wiggle = 0.6; }
  else { base = home.clone().setLength(14); base.y += rand(1, 3); }  // entra desde lejos, al frente
  sprite.position.copy(base); scene.add(sprite);
  const e = {
    type, t, sprite, mat, hp: t.hp, radius: t.size * 0.55, state: 'enter', st: 0,
    base, home, phase: rand(0, 10), retarget: rand(2.5, 4), flipX: 1, buzz: createBuzz(t.pitch), perch: null, perchCd: rand(1, 3),
    hitFlash: 0, vel: new THREE.Vector3(),
  };
  enemies.push(e);
  return e;
}

function removeEnemy(e) {
  const i = enemies.indexOf(e); if (i >= 0) enemies.splice(i, 1);
  scene.remove(e.sprite); e.mat.dispose(); e.buzz?.stop();
  if (e.perch && e.perch.occupant === e) e.perch.occupant = null;
}
function killEnemy(e) {
  if (e.state === 'dying') return;
  const wasPerched = e.state === 'perched';
  if (e.state === 'warn' || e.state === 'dive') S.avoided++;
  card(e.type); if (wasPerched) card('posado');
  e.buzz?.stop(); e.buzz = null;
  if (e.perch && e.perch.occupant === e) e.perch.occupant = null;
  e.state = 'dying'; e.st = 0;
  e.mat.map = e.t.tex === 'flap' ? TEX.dead : TEX[e.t.tex];
  e.mat.color.setHex(e.t.tex === 'flap' ? 0xffffff : 0xb8ffb0);
  e.vel.set(rand(-0.3, 0.3), 0.8, 0);
  fog(e.sprite.position, 6);
  sfx.plop(); if (Math.random() < 0.6) setTimeout(() => sfx.cough(), 120);
  S.kills++; if (wasPerched) S.perchKills++;
  S.combo++; S.comboTimer = 3;
  addScore(e.t.score * comboMult() * (wasPerched ? 2 : 1));
  if (wasPerched) floatText('¡×2 posado!');
}
const comboMult = () => 1 + Math.min(4, Math.floor(S.combo / 4));
function addScore(n) { S.score += Math.round(n); }

// ---------------- Nubes (spray y niebla verde) ----------------
function puff(pos, vel, tx, size0, size1, life, opacity) {
  const m = new THREE.SpriteMaterial({ map: tx, transparent: true, opacity, depthWrite: false });
  const s = new THREE.Sprite(m); s.position.copy(pos); s.scale.setScalar(size0); s.material.rotation = rand(0, 6);
  scene.add(s); puffs.push({ s, vel, size0, size1, life, max: life, opacity });
}
function fog(pos, n) {
  if (pos.distanceTo(camera.position) < 1.6) n = Math.min(n, 1); // no tapar la vista si muere encima tuyo
  for (let i = 0; i < n; i++) puff(pos.clone().add(new THREE.Vector3(rand(-0.15, 0.15), rand(-0.1, 0.1), rand(-0.15, 0.15))),
    new THREE.Vector3(rand(-0.4, 0.4), rand(-0.2, 0.4), rand(-0.4, 0.4)), FOG, 0.25, rand(0.8, 1.3), rand(0.9, 1.4), 0.55);
}
const fwd = new THREE.Vector3(), right = new THREE.Vector3(), up = new THREE.Vector3(), tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();
function sprayPuffs() {
  camera.getWorldDirection(fwd);
  right.set(1, 0, 0).applyQuaternion(camera.quaternion); up.set(0, 1, 0).applyQuaternion(camera.quaternion);
  for (let i = 0; i < 2; i++) {
    const p = camera.position.clone().addScaledVector(fwd, 0.45).addScaledVector(right, 0.1).addScaledVector(up, -0.12);
    const v = fwd.clone().multiplyScalar(rand(6, 8)).addScaledVector(right, rand(-0.5, 0.2)).addScaledVector(up, rand(-0.2, 0.5));
    puff(p, v, PUFF, 0.08, rand(1.0, 1.6), rand(0.55, 0.75), 0.32);
  }
}

// ---------------- Spray del jugador ----------------
/** ¿El zancudo está dentro del cono de spray? Devuelve la distancia o -1. Hitbox amplia + cono que se abre. */
function inCone(e, extra = 1) {
  tmp.copy(e.sprite.position).sub(camera.position);
  const t = tmp.dot(fwd); if (t < 0.3 || t > CFG.sprayRange) return -1;
  const perp = Math.sqrt(Math.max(0, tmp.lengthSq() - t * t));
  return perp < (e.radius * 1.5 + t * Math.tan(CFG.sprayCone)) * extra ? t : -1;
}
function sprayTick() {
  S.shots++;
  camera.getWorldDirection(fwd);
  let any = false;
  for (const e of [...enemies]) {
    if (e.state === 'dying' || e.state === 'enter') continue;
    if (inCone(e) < 0) continue;
    any = true;
    e.hp -= e.state === 'perched' ? 2 : 1; e.hitFlash = 0.12;
    if (e.hp <= 0) killEnemy(e); else { sfx.hit(); if (Math.random() < 0.35) sfx.cough(); }
  }
  for (const n of nests) if (n.full && inCone(n) >= 0) { any = true; n.hp--; if (n.hp <= 0) emptyNest(n); else splash(n.sprite.position, 3); }
  if (any) { S.hits++; flashCross('hit'); }
}
function shakeCan() {
  if (S.shaking > 0 || S.spray >= CFG.sprayMax) return;
  S.shaking = CFG.shakeTime; sfx.shake(); stopSprayFx();
  handEl.classList.remove('agitando'); void handEl.offsetWidth; handEl.classList.add('agitando');
}

// ---------------- Mano con insecticida (DOM, primera persona) ----------------
const handEl = $('hand'); const handImgs = [...handEl.querySelectorAll('img')];
const H = { frame: 1, t: 0, phase: 'idle' }; // idle | press | spray | release
function setHand(f) {
  if (H.frame === f) return;
  handImgs[H.frame - 1].classList.remove('on'); handImgs[f - 1].classList.add('on'); H.frame = f;
  const kick = f === 4 ? [-8, 6, -2.5] : f === 5 ? [-4, 9, -1.2] : f === 3 ? [0, 3, 0] : [0, 0, 0];
  handEl.style.transform = `translate(${kick[0]}px, ${kick[1]}px) rotate(${kick[2]}deg)`;
}
function updateHand(dt, spraying) {
  H.t += dt;
  if (spraying) {
    if (H.phase === 'idle' || H.phase === 'release') { H.phase = 'press'; H.t = 0; }
    if (H.phase === 'press') { setHand(H.t < 0.05 ? 2 : 3); if (H.t > 0.1) { H.phase = 'spray'; H.t = 0; } }
    else if (H.phase === 'spray') setHand(Math.floor(H.t / 0.09) % 2 ? 5 : 4);
  } else {
    if (H.phase === 'spray' || H.phase === 'press') { H.phase = 'release'; H.t = 0; }
    if (H.phase === 'release') { setHand(6); if (H.t > 0.14) { H.phase = 'idle'; setHand(1); } }
  }
}
function stopSprayFx() { sprayStop(); }

// ---------------- Daño al jugador ----------------
function playerHit(dmg) {
  S.bites++;
  S.hp = Math.max(0, S.hp - dmg); S.combo = 0;
  sfx.ouch();
  const d = $('dmg'); d.classList.add('on'); setTimeout(() => d.classList.remove('on'), 120);
  if (navigator.vibrate) navigator.vibrate(60);
  floatText('¡AUCH!');
  if (S.hp <= 0) gameOver();
}

// ---------------- Oleadas (curva suave) ----------------
function startWave() {
  S.wave++;
  S.toSpawn = 3 + S.wave * 2;
  const want = Math.min(3, 1 + Math.floor(S.wave / 2)) - nests.filter((n) => n.full).length;
  for (let i = 0; i < want; i++) spawnNest();
  if (S.wave === 1) setTimeout(() => toast('MISIÓN: ¡VACÍA LOS CRIADEROS!'), 1700);
  S.spawnTimer = 0.6;
  S.diveCd = Math.max(3, 6 - S.wave * 0.3);
  toast(`OLEADA ${S.wave}`);
  musicCtl.setWave(S.wave);
  if (S.wave === 1) sfx.wave();
  if (S.wave > 1) S.hp = Math.min(CFG.maxHp, S.hp + 25);
}
const maxAlive = () => Math.min(7, 2 + Math.floor(S.wave * 0.7));
const maxDivers = () => 1 + Math.floor(S.wave / 4);

// ---------------- Objetos detectados → perchas ----------------
const ndc = new THREE.Vector3();
/** Convierte un bounding box (px de video) a una dirección 3D usando la orientación actual (3DoF). */
function boxTopToWorld(d) {
  const vw = video.videoWidth, vh = video.videoHeight, ew = stage.clientWidth, eh = stage.clientHeight;
  const sc = Math.max(ew / vw, eh / vh), ox = (vw * sc - ew) / 2, oy = (vh * sc - eh) / 2;
  const sx = (d.x + d.w / 2) * sc - ox, sy = d.y * sc - oy, sw = d.w * sc;
  if (sy < eh * 0.03 || sx < 0 || sx > ew || sy > eh * 0.92) return null; // el borde superior debe verse
  ndc.set((sx / ew) * 2 - 1, -(sy / eh) * 2 + 1, 0.5).unproject(camera);
  const dir = ndc.sub(camera.position).normalize();
  // ancho aproximado en metros a la distancia fija (para repartir dónde se posa)
  const ndcW = (sw / ew) * 2; const halfW = Math.tan(camera.fov * DEG / 2) * camera.aspect * CFG.perchDist * ndcW / 2;
  return { pos: camera.position.clone().addScaledVector(dir, CFG.perchDist), halfW: clamp(halfW, 0.15, 1.2) };
}
function addOrUpdatePerch(label, pos, halfW, fake = false) {
  let p = perches.find((q) => q.label === label && q.pos.angleTo(pos) < 12 * DEG);
  if (p) { p.pos.lerp(pos, 0.4); p.halfW = p.halfW * 0.6 + halfW * 0.4; p.seen = S.time; return p; }
  if (perches.length >= 4) { const old = perches.filter((q) => !q.occupant).sort((a, b) => a.seen - b.seen)[0]; if (!old) return null; perches.splice(perches.indexOf(old), 1); }
  p = { label, pos: pos.clone(), halfW, seen: S.time, born: S.time, occupant: null, fake };
  perches.push(p);
  if (!S.spotted.has(label)) { S.spotted.add(label); sfx.spot(); toast(`¡Veo ${PERCH_NAMES[label] || label}!`); }
  S.perchCd = Math.min(S.perchCd, 0.5);
  return p;
}
function runDetector() {
  if (!S.detectOn || S.mode !== 'ar' || spotter.status !== 'ready') return;
  const res = spotter.detect(video); if (!res) return;
  for (const d of res) { const w = boxTopToWorld(d); if (w) addOrUpdatePerch(d.label, w.pos, w.halfW); }
}
let detectTimer = 0;
function scheduleDetect() {
  clearTimeout(detectTimer);
  detectTimer = setTimeout(() => { if (S.state === 'playing') runDetector(); scheduleDetect(); }, spotter.interval());
}
function prunePerches() {
  camera.getWorldDirection(fwd);
  for (const p of [...perches]) {
    if (p.fake) continue;
    tmp.copy(p.pos).project(camera);
    const inView = tmp.z < 1 && Math.abs(tmp.x) < 0.9 && Math.abs(tmp.y) < 0.9;
    const unseen = S.time - p.seen;
    if ((inView && unseen > 3.5) || unseen > 30) {
      if (p.occupant && p.occupant.state === 'perched') { p.occupant.state = 'wander'; p.occupant.perchCd = 3; }
      perches.splice(perches.indexOf(p), 1);
    }
  }
}

// ---------------- Misión: eliminar criaderos (agua estancada) ----------------
const NEST_KINDS = ['balde', 'neumatico', 'florero'];
const NEST_NAMES = { balde: 'el balde', neumatico: 'el neumático', florero: 'el florero' };
const NEST_TEX = {};
for (const k of NEST_KINDS) for (const full of [true, false]) {
  const t = new THREE.CanvasTexture(drawCriadero(k, full)); t.colorSpace = THREE.SRGBColorSpace; NEST_TEX[k + full] = t;
}
const CRIADERO_URL = drawCriadero('balde', true).toDataURL();
function spawnNest() {
  const kind = NEST_KINDS[Math.floor(Math.random() * NEST_KINDS.length)];
  // abajo y al frente, "en el suelo" de la pieza, separados entre sí
  let pos;
  for (let k = 0; k < 8; k++) {
    const yaw = rand(-40, 40) * DEG, pitch = rand(-22, -10) * DEG, d = rand(3.4, 4.4);
    pos = new THREE.Vector3(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)).multiplyScalar(d);
    if (nests.every((n) => n.sprite.position.angleTo(pos) > 15 * DEG)) break;
  }
  const mat = new THREE.SpriteMaterial({ map: NEST_TEX[kind + true], transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(mat); sprite.scale.setScalar(0.75); sprite.position.copy(pos); scene.add(sprite);
  nests.push({ kind, sprite, mat, radius: 0.42, hp: 3, full: true, releaseT: rand(6, 10), baseY: pos.y, wiggle: 0, fade: 2.5 });
}
function splash(pos, n) {
  for (let i = 0; i < n; i++) puff(pos.clone().add(new THREE.Vector3(rand(-0.1, 0.1), 0.15, rand(-0.1, 0.1))),
    new THREE.Vector3(rand(-0.6, 0.6), rand(0.8, 1.6), rand(-0.6, 0.6)), PUFF, 0.08, rand(0.25, 0.45), rand(0.4, 0.7), 0.6);
}
function emptyNest(n) {
  if (!n.full) return;
  n.full = false; n.mat.map = NEST_TEX[n.kind + false]; n.fade = 3;
  splash(n.sprite.position, 10); sfx.plop(); S.nests++; addScore(250);
  floatText('¡CRIADERO VACIADO!'); toast(`¡Vaciaste ${NEST_NAMES[n.kind]}!`); card('criadero');
}
/** Tocar un criadero en pantalla también lo vacía. */
function tapNest(cx, cy) {
  const r = stage.getBoundingClientRect();
  for (const n of nests) {
    if (!n.full) continue;
    tmp.copy(n.sprite.position).project(camera); if (tmp.z > 1) continue;
    const x = (tmp.x * 0.5 + 0.5) * r.width + r.left, y = (-tmp.y * 0.5 + 0.5) * r.height + r.top;
    tmp2.copy(n.sprite.position).add(new THREE.Vector3(0, 0.38, 0)).project(camera);
    const rad = Math.max(40, Math.abs((-tmp2.y * 0.5 + 0.5) * r.height + r.top - y) * 1.2);
    if (Math.hypot(cx - x, cy - y) < rad) { emptyNest(n); return true; }
  }
  return false;
}

// ---------------- Álbum de láminas ----------------
function card(id) {
  const c = unlockCard(id); if (!c) return;
  setTimeout(() => { sfx.spot(); toast(`¡NUEVA LÁMINA: ${c.name.toUpperCase()}!`); }, 500);
}
const TIPS = [
  'Usa mosquitero en la cama, sobre todo si duermes con la ventana abierta.',
  'Vacía una vez a la semana el agua de baldes, neumáticos, floreros y platos de maceteros.',
  'Aplica repelente en la piel expuesta siguiendo las instrucciones del envase (en niños, que lo ponga un adulto).',
  'Pon mallas en ventanas y puertas para que no entren.',
  'Tapa bien estanques y tambores de agua, y cambia el agua de los bebederos de mascotas a menudo.',
  'Usa ropa clara de manga larga al atardecer, cuando muchos zancudos salen a comer.',
  'Si usas insecticida en spray, ventila la pieza y aléjalo de la comida, los niños y las mascotas.',
];

// ---------------- Modo copiloto (Duo abierto) ----------------
// La otra pantalla muestra un radar grande: el copiloto toca un punto y marca al zancudo más cercano en esa dirección.
function radarPick(ev) {
  if (S.state !== 'playing') return;
  const cv = $('radar'), r = cv.getBoundingClientRect();
  const x = (ev.clientX - r.left) / r.width * 2 - 1, y = (ev.clientY - r.top) / r.height * 2 - 1;
  camera.getWorldDirection(tmp2);
  const ang = Math.atan2(-x, -y) + Math.atan2(tmp2.x, tmp2.z); // inverso de drawRadar
  let best = null, bd = 1e9;
  for (const e of enemies) {
    if (e.state === 'dying' || e.state === 'enter') continue;
    const p = e.sprite.position; let d = Math.abs(Math.atan2(Math.sin(Math.atan2(p.x, p.z) - ang), Math.cos(Math.atan2(p.x, p.z) - ang)));
    if (d < bd) { bd = d; best = e; }
  }
  if (best && bd < 35 * DEG) {
    best.marked = S.time + 4; sfx.warn();
    tmp.copy(best.sprite.position).project(camera);
    const side = tmp.z > 1 ? 'ATRÁS' : tmp.x < -0.6 ? 'IZQUIERDA' : tmp.x > 0.6 ? 'DERECHA' : tmp.y > 0.5 ? 'ARRIBA' : tmp.y < -0.5 ? 'ABAJO' : 'AL FRENTE';
    toast(`COPILOTO: ¡${side}!`);
  }
}
$('radar').addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); unlockAudio(); radarPick(e); });
function applyCoop() {
  document.body.classList.toggle('coop', S.coop);
  $('btn-coop').textContent = `Copiloto: ${S.coop ? 'sí' : 'no'}`;
  requestAnimationFrame(resize);
}

// Agitar el iPhone recarga el spray (botón ⟳ de respaldo)
listenShake(() => { if (S.state === 'playing') shakeCan(); });

// ---------------- Loop ----------------
const clock = new THREE.Clock();
function update(dt) {
  S.time += dt;
  if (S.mode !== 'xr') aim.update();
  camera.updateMatrixWorld();
  camera.getWorldDirection(fwd);
  const playing = S.state === 'playing';

  if (playing) {
    // oleada
    if (S.toSpawn > 0) {
      S.spawnTimer -= dt;
      const alive = enemies.filter((e) => e.state !== 'dying').length;
      if (S.spawnTimer <= 0 && alive < maxAlive()) { spawnEnemy(); S.toSpawn--; S.spawnTimer = Math.max(0.9, 2.4 - S.wave * 0.12); }
    } else if (enemies.length === 0) {
      S.interTimer += dt;
      if (S.interTimer > 0.6 && S.interTimer - dt <= 0.6) { toast(`OLEADA ${S.wave} SUPERADA`); showFact(); musicCtl.jingle('wave'); }
      if (S.interTimer > 4.2) { S.interTimer = 0; startWave(); }
    }
    // criaderos activos siguen soltando zancudos de a poco
    for (const n of nests) {
      if (n.wiggle > 0) n.wiggle -= dt;
      n.sprite.position.y = n.baseY + (n.wiggle > 0 ? Math.sin(S.time * 40) * 0.02 : 0);
      if (!n.full) { n.fade -= dt; n.mat.opacity = clamp(n.fade, 0, 1); continue; }
      n.releaseT -= dt; if (n.releaseT <= 0) { n.releaseT = rand(9, 13); if (S.toSpawn < 12) S.toSpawn++; }
    }
    for (const n of [...nests]) if (!n.full && n.fade <= 0) { scene.remove(n.sprite); n.mat.dispose(); nests.splice(nests.indexOf(n), 1); }
    // spray
    const canSpray = S.firing && S.shaking <= 0 && S.spray > 0;
    if (S.shaking > 0) { S.shaking -= dt; S.spray = Math.min(CFG.sprayMax, S.spray + CFG.sprayMax * dt / CFG.shakeTime); if (S.shaking <= 0) S.spray = CFG.sprayMax; }
    if (canSpray) {
      if (!S.wasFiring) sprayStart();
      S.spray = Math.max(0, S.spray - CFG.sprayDrain * dt); S.sprayIdle = 0;
      S.tickCd -= dt; if (S.tickCd <= 0) { S.tickCd = CFG.sprayTick; sprayTick(); sprayPuffs(); }
      if (S.spray <= 0) { sfx.empty(); toast('¡AGITA EL IPHONE!'); S.hintT = S.time; }
    } else {
      if (S.wasFiring) sprayStop();
      S.tickCd = 0; S.sprayIdle += dt;
      if (S.firing && S.spray <= 0 && S.shaking <= 0 && S.time - (S.hintT || 0) > 2.5) { S.hintT = S.time; toast('¡AGITA EL IPHONE!'); sfx.empty(); }
    }
    S.wasFiring = canSpray;
    updateHand(dt, canSpray);
    // manotazo (escudo)
    const wasShield = document.body.classList.contains('shielding');
    const sh = S.shielding && !S.shieldBroken && S.shield > 0;
    if (sh) { S.shield = Math.max(0, S.shield - CFG.shieldDrain * dt); S.shieldIdle = 0; if (S.shield <= 0) S.shieldBroken = true; }
    else { S.shieldIdle += dt; if (S.shieldIdle > 0.7) S.shield = Math.min(CFG.maxShield, S.shield + CFG.shieldRegen * dt); }
    if (S.shieldBroken && S.shield >= 30) S.shieldBroken = false;
    if (sh !== wasShield) { document.body.classList.toggle('shielding', sh); if (sh) sfx.shieldOn(); }
    if (S.comboTimer > 0) { S.comboTimer -= dt; if (S.comboTimer <= 0) S.combo = 0; }
    // picadas: de a una (o pocas) y siempre con aviso
    S.diveCd -= dt;
    const divers = enemies.filter((e) => e.state === 'warn' || e.state === 'dive').length;
    musicCtl.setTension(Math.min(1, divers * 0.7));
    if (S.diveCd <= 0 && divers < maxDivers()) {
      const cands = enemies.filter((e) => e.state === 'wander');
      if (cands.length) {
        // prefiere uno que estés viendo, para que la picada sea justa
        cands.sort((a, b) => tmp.copy(b.sprite.position).normalize().dot(fwd) - tmp2.copy(a.sprite.position).normalize().dot(fwd));
        const e = Math.random() < 0.75 ? cands[0] : cands[Math.floor(Math.random() * cands.length)];
        e.state = 'warn'; e.st = 0; sfx.warn();
      }
      S.diveCd = rand(4.5, 7.5) * Math.max(0.55, 1 - S.wave * 0.05);
    }
    // posarse: cada tanto un zancudo libre va a un objeto detectado
    S.perchCd -= dt;
    if (S.perchCd <= 0) {
      S.perchCd = rand(1.5, 3);
      const free = perches.filter((p) => !p.occupant);
      const cands = enemies.filter((e) => e.state === 'wander' && e.perchCd <= 0);
      if (free.length && cands.length && Math.random() < 0.8) {
        const p = free[Math.floor(Math.random() * free.length)], e = cands[Math.floor(Math.random() * cands.length)];
        p.occupant = e; e.perch = p; e.state = 'toPerch'; e.st = 0; e.perchX = rand(-0.6, 0.6) * p.halfW;
      }
    }
    prunePerches();
  } else if (S.wasFiring) { sprayStop(); S.wasFiring = false; updateHand(dt, false); }

  // zancudos
  for (const e of [...enemies]) updateEnemy(e, dt, playing);

  // nubes
  for (const p of [...puffs]) {
    p.life -= dt; const k = Math.max(0, p.life / p.max);
    p.s.position.addScaledVector(p.vel, dt); p.vel.multiplyScalar(Math.pow(0.12, dt));
    p.s.scale.setScalar(p.size1 + (p.size0 - p.size1) * k);
    p.s.material.opacity = p.opacity * Math.min(1, k * 2.2);
    if (p.life <= 0) { scene.remove(p.s); p.s.material.dispose(); puffs.splice(puffs.indexOf(p), 1); }
  }

  const tgt = enemies.some((e) => e.state !== 'dying' && e.state !== 'enter' && inCone(e) >= 0);
  $('crosshair').classList.toggle('on-target', tgt);
}

const camRight = new THREE.Vector3();
function updateEnemy(e, dt, playing) {
  const s = e.sprite, t = e.t;
  e.phase += dt; e.st += dt;
  const sp = playing ? 1 : 0.25;
  // aleteo 2-3-4-3 (cuadros con alas); el acorazado/explorador "vibran" con escala
  if (e.state !== 'dying') {
    if (t.tex === 'flap') {
      const rate = e.state === 'perched' ? 0 : e.state === 'dive' ? 26 : 18;
      e.mat.map = e.state === 'perched' ? TEX.flap[3] : TEX.flap[FLAP_SEQ[Math.floor(e.phase * rate) % 4]];
    }
    const wob = e.state === 'perched' ? 0 : Math.sin(e.phase * 55) * 0.03;
    s.scale.set(t.size * (1 + wob) * e.flipX, t.size * (1 - wob), 1);
  }
  // giro hacia donde vuela (sprite en espejo)
  const prev = tmp2.copy(s.position);
  camRight.set(-e.base.z, 0, e.base.x).normalize(); // perpendicular horizontal al rayo
  switch (e.state) {
    case 'enter': {
      e.base.lerp(e.home, 1 - Math.pow(0.15, dt * sp));
      s.position.copy(e.base);
      if (e.base.distanceTo(e.home) < 0.4) e.state = 'wander';
      break;
    }
    case 'wander': {
      e.retarget -= dt; e.perchCd -= dt;
      if (e.retarget <= 0) { e.retarget = rand(2.5, 4.5); e.home.copy(arcPoint()); }
      tmp.copy(e.home).sub(e.base); const d = tmp.length();
      if (d > 0.01) e.base.addScaledVector(tmp.normalize(), Math.min(d, t.speed * dt * sp));
      s.position.copy(e.base).addScaledVector(camRight, Math.sin(e.phase * t.zigF * 2) * t.zig).add(tmp.set(0, Math.sin(e.phase * 2.3) * 0.1, 0));
      break;
    }
    case 'warn': {
      // aviso: tiembla, se pone rojizo y el zumbido sube
      s.position.copy(e.base).add(tmp.set(rand(-0.04, 0.04), rand(-0.04, 0.04), 0));
      if (e.st > 1.4) { e.state = 'dive'; e.st = 0; }
      break;
    }
    case 'dive': {
      tmp.copy(camera.position).sub(e.base); const d = tmp.length();
      e.base.addScaledVector(tmp.normalize(), t.dive * dt * sp);
      s.position.copy(e.base).addScaledVector(camRight, Math.sin(e.phase * 5) * 0.12 * Math.min(1, d / 2));
      // manotazo: si estás bloqueando y viene de frente, lo espantas
      if (playing && document.body.classList.contains('shielding') && d < CFG.shieldReach && tmp.copy(e.base).normalize().dot(fwd) > CFG.shieldCone) {
        S.shield = Math.max(0, S.shield - 15); sfx.swat(); sfx.cough(); addScore(25); floatText('¡PAF!'); S.avoided++; card('manotazo');
        e.state = 'retreat'; e.home.copy(arcPoint()); e.st = 0; break;
      }
      if (playing && d < 0.55) { playerHit(t.dmg); e.state = 'retreat'; e.home.copy(arcPoint()); e.st = 0; }
      break;
    }
    case 'retreat': {
      tmp.copy(e.home).sub(e.base); const d = tmp.length();
      e.base.addScaledVector(tmp.normalize(), Math.min(d, 2.2 * dt));
      s.position.copy(e.base);
      if (d < 0.3) { e.state = 'wander'; e.perchCd = 2; }
      break;
    }
    case 'toPerch': {
      if (!e.perch || !perches.includes(e.perch)) { e.state = 'wander'; e.perch = null; break; }
      const target = tmp.copy(e.perch.pos).addScaledVector(camRightOf(e.perch.pos), e.perchX).add(new THREE.Vector3(0, t.size * 0.36, 0));
      const d = target.distanceTo(e.base);
      e.base.lerp(target, Math.min(1, (1.4 * dt) / Math.max(d, 0.01)));
      s.position.copy(e.base).add(new THREE.Vector3(0, Math.sin(e.phase * 3) * 0.05 * Math.min(1, d), 0));
      if (d < 0.06) { e.state = 'perched'; e.st = 0; e.perchTime = rand(5, 8); sfx.perch(); }
      break;
    }
    case 'perched': {
      // quieto, "frotando las patas": pequeño vaivén lateral
      if (!e.perch || !perches.includes(e.perch)) { e.state = 'wander'; e.perch = null; break; }
      const target = tmp.copy(e.perch.pos).addScaledVector(camRightOf(e.perch.pos), e.perchX).add(new THREE.Vector3(0, t.size * 0.36, 0));
      e.base.lerp(target, 0.3);
      s.position.copy(e.base); s.position.x += Math.sin(e.phase * 14) * 0.006; s.material.rotation = Math.sin(e.phase * 7) * 0.04;
      if (e.st > e.perchTime) { e.state = 'wander'; e.perch.occupant = null; e.perch = null; e.perchCd = rand(4, 7); s.material.rotation = 0; }
      break;
    }
    case 'dying': {
      e.vel.y -= 4.5 * dt; s.position.addScaledVector(e.vel, dt);
      s.material.rotation += dt * 4 * (e.flipX || 1);
      if (t.tex !== 'flap') s.scale.y = -Math.abs(s.scale.y); // patas arriba
      e.mat.opacity = clamp(1.6 - e.st, 0, 1);
      if (Math.random() < dt * 10) fog(s.position, 1);
      if (e.st > 1.6) removeEnemy(e);
      return;
    }
  }
  if (e.state !== 'perched') s.material.rotation = 0;
  // mirar hacia donde vuela (espejo horizontal según movimiento en pantalla)
  tmp.copy(s.position).sub(prev);
  const lateral = tmp.dot(right.set(1, 0, 0).applyQuaternion(camera.quaternion));
  if (Math.abs(lateral) > 0.004) e.flipX = lateral > 0 ? -1 : 1;
  // color: aviso rojizo / destello al recibir spray
  if (e.hitFlash > 0) { e.hitFlash -= dt; e.mat.color.setRGB(0.75, 1, 0.55); }
  else if (e.state === 'warn') e.mat.color.setRGB(1, Math.floor(e.st * 10) % 2 ? 0.55 : 1, Math.floor(e.st * 10) % 2 ? 0.55 : 1);
  else e.mat.color.setRGB(1, 1, 1);
  // zumbido espacial: volumen por distancia, paneo según el lado de la pantalla, sube al picar
  if (e.buzz) {
    tmp.copy(s.position).sub(camera.position); const dist = tmp.length();
    const pan = tmp.normalize().dot(right);
    const facing = tmp.dot(fwd);
    let vol = clamp(1.6 / (dist * dist * 0.35 + 0.6), 0.05, 1) * (facing > 0 ? 1 : 0.7);
    let bend = 1;
    if (e.state === 'warn') { vol = Math.min(1, vol + e.st * 0.4); bend = 1 + e.st * 0.25; }
    if (e.state === 'dive') { vol = Math.min(1, vol * 1.5 + 0.3); bend = 1.35 + 0.5 / Math.max(0.5, dist); }
    if (e.state === 'perched') vol *= 0.15;
    if (!playing) vol *= 0.2;
    e.buzz.set(vol, pan, bend);
  }
}
const _cr = new THREE.Vector3();
const camRightOf = (p) => _cr.set(-p.z, 0, p.x).normalize();

function frame() {
  const dt = Math.min(0.05, clock.getDelta());
  update(dt);
  renderer.render(scene, camera);
  drawHud();
  drawPerches();
}
renderer.setAnimationLoop(frame);

/** Marcas sobre los objetos detectados (corchetes + nombre) en el canvas 2D. */
function drawPerches() {
  const g = fx2d.getContext('2d'), w = fx2d.width, h = fx2d.height;
  g.clearRect(0, 0, w, h);
  if (S.state === 'menu') return;
  for (const e of enemies) {
    if (!(e.marked > S.time) || e.state === 'dying') continue;
    tmp.copy(e.sprite.position).project(camera); if (tmp.z > 1 || Math.abs(tmp.x) > 1 || Math.abs(tmp.y) > 1) continue;
    const x = (tmp.x * 0.5 + 0.5) * w, y = (-tmp.y * 0.5 + 0.5) * h, r = 34 + Math.sin(S.time * 10) * 5;
    g.strokeStyle = '#ffe14a'; g.lineWidth = 4; g.beginPath(); g.arc(x, y, r, 0, 7); g.stroke();
  }
  if (!perches.length) return;
  g.font = `600 ${Math.round(clamp(w * 0.03, 11, 16))}px ui-rounded, system-ui, sans-serif`; g.textAlign = 'center';
  for (const p of perches) {
    tmp.copy(p.pos).project(camera); if (tmp.z > 1 || Math.abs(tmp.x) > 1.1 || Math.abs(tmp.y) > 1.1) continue;
    const x = (tmp.x * 0.5 + 0.5) * w, y = (-tmp.y * 0.5 + 0.5) * h;
    tmp2.copy(p.pos).addScaledVector(camRightOf(p.pos), p.halfW).project(camera);
    const hw = Math.abs((tmp2.x * 0.5 + 0.5) * w - x);
    g.strokeStyle = p.occupant?.state === 'perched' ? 'rgba(255,225,74,.9)' : 'rgba(0,255,160,.7)'; g.lineWidth = 2; g.setLineDash([6, 5]);
    g.beginPath(); g.moveTo(x - hw, y + 10); g.lineTo(x - hw, y); g.lineTo(x + hw, y); g.lineTo(x + hw, y + 10); g.stroke(); g.setLineDash([]);
    const txt = `${PERCH_ICON[p.label] || '📍'} ${PERCH_NAMES[p.label] || p.label}`;
    const tw = g.measureText(txt).width + 12, lx = clamp(x, tw / 2 + 4, w - tw / 2 - 4);
    g.fillStyle = 'rgba(6,4,26,.6)'; g.fillRect(lx - tw / 2, y + 14, tw, 20);
    g.fillStyle = '#e8f6ff'; g.fillText(txt, lx, y + 29);
  }
}
// ---------------- HUD ----------------
const last = {};
function setText(id, v) { if (last[id] !== v) { last[id] = v; $(id).textContent = v; } }
function setWidth(id, pct) { const v = Math.round(pct) + '%'; if (last[id] !== v) { last[id] = v; $(id).style.width = v; } }
const cells = $('p-cells');
for (let i = 0; i < 20; i++) cells.appendChild(document.createElement('i'));

const DETECT_TXT = { off: 'apagado', loading: 'cargando…', ready: 'listo', error: 'no disponible' };
function drawHud() {
  setText('h-wave', S.wave || 1); setText('p-wave', S.wave || 1);
  setText('h-score', S.score.toLocaleString('es-CL')); setText('p-score', S.score.toLocaleString('es-CL'));
  setText('p-best', Math.max(S.best, S.score).toLocaleString('es-CL'));
  setText('h-combo', comboMult() > 1 ? `×${comboMult()}` : '');
  setText('h-hp', Math.ceil(S.hp)); setText('p-hp', Math.ceil(S.hp));
  setText('p-sh', S.shieldBroken ? 'RECARGANDO' : Math.round(S.shield));
  setWidth('b-hp', S.hp / CFG.maxHp * 100); setWidth('pb-hp', S.hp / CFG.maxHp * 100); setWidth('b-sh', S.shield); setWidth('pb-sh', S.shield);
  setText('p-left', enemies.filter((e) => e.state !== 'dying').length + S.toSpawn);
  const pct = Math.round(S.spray / CFG.sprayMax * 100);
  setText('p-ammo', S.shaking > 0 ? 'AGITANDO…' : `${pct}%`); setText('h-ammo-mini', S.shaking > 0 ? '…' : `${pct}%`);
  setText('p-acc', S.shots ? Math.round((S.hits / S.shots) * 100) + '%' : '–');
  const on = Math.round(S.spray / CFG.sprayMax * 20);
  if (last.cells !== on) { last.cells = on; [...cells.children].forEach((c, i) => c.classList.toggle('off', i >= on)); }
  const det = !S.detectOn ? 'apagado' : S.mode !== 'ar' ? 'solo con cámara' : DETECT_TXT[spotter.status] + (spotter.status === 'ready' ? ` (${spotter.delegate})` : '');
  setText('p-detect', det);
  setText('p-perch', perches.length ? perches.map((p) => PERCH_NAMES[p.label] || p.label).join(', ') : '—');
  $('btn-reload').classList.toggle('reloading', S.shaking > 0);
  $('btn-shield').classList.toggle('empty', S.shieldBroken);
  const lay = getLayout();
  drawRadar($('radar'), true);
  if (lay === 'compacto') drawRadar($('radar-mini'), false);
  drawArrows();
}

/** Radar cenital: tú al centro, hacia arriba es donde miras. */
function drawRadar(cv, big) {
  const g = cv.getContext('2d'), W = cv.width, R = W / 2;
  g.clearRect(0, 0, W, W);
  g.save(); g.translate(R, R);
  g.fillStyle = 'rgba(6,4,26,.55)'; g.beginPath(); g.arc(0, 0, R - 2, 0, Math.PI * 2); g.fill();
  g.strokeStyle = 'rgba(0,240,255,.5)'; g.lineWidth = big ? 2 : 3;
  for (const k of [0.33, 0.66, 1]) { g.beginPath(); g.arc(0, 0, (R - 3) * k, 0, Math.PI * 2); g.stroke(); }
  const half = (camera.fov * camera.aspect / 2) * DEG;
  g.fillStyle = 'rgba(0,255,160,.14)'; g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, R - 3, -Math.PI / 2 - half, -Math.PI / 2 + half); g.closePath(); g.fill();
  camera.getWorldDirection(tmp2);
  const camYaw = Math.atan2(tmp2.x, tmp2.z);
  const range = 8;
  const dot = (pos, color, size, square) => {
    const dx = pos.x - camera.position.x, dz = pos.z - camera.position.z;
    const ang = Math.atan2(dx, dz) - camYaw;
    const d = Math.min(1, Math.hypot(dx, dz) / range) * (R - 8);
    const x = -Math.sin(ang) * d, y = -Math.cos(ang) * d;
    g.fillStyle = color; g.shadowColor = color; g.shadowBlur = 8;
    if (square) g.fillRect(x - size, y - size / 2, size * 2, size); else { g.beginPath(); g.arc(x, y, size, 0, Math.PI * 2); g.fill(); }
  };
  for (const p of perches) dot(p.pos, '#00ffa0', big ? 8 : 11, true);
  for (const n of nests) if (n.full) dot(n.sprite.position, '#3fc9ff', big ? 10 : 13, true);
  for (const e of enemies) if (e.state !== 'dying') dot(e.sprite.position, e.marked > S.time ? '#ffe14a' : e.state === 'warn' || e.state === 'dive' ? '#ffffff' : e.state === 'perched' ? '#ffe14a' : '#ff3c5a', (big ? 8 : 11) * e.t.size / 0.62);
  g.shadowBlur = 0; g.fillStyle = '#00ffa0'; g.beginPath(); g.moveTo(0, -10); g.lineTo(7, 8); g.lineTo(-7, 8); g.closePath(); g.fill();
  g.restore();
}

/** Flechas en el borde para zancudos fuera de pantalla (blancas si vienen picando). */
const arrowsEl = $('arrows'); const arrowPool = [];
function drawArrows() {
  let n = 0;
  const w = stage.clientWidth, h = stage.clientHeight;
  for (const e of enemies) {
    if (e.state === 'enter' || e.state === 'dying' || n >= 8) continue;
    tmp.copy(e.sprite.position).project(camera);
    const behind = tmp.z > 1;
    let x = tmp.x, y = tmp.y;
    if (!behind && Math.abs(x) < 1 && Math.abs(y) < 1) continue;
    if (behind) { x = -x; y = -y; }
    const m = Math.max(Math.abs(x), Math.abs(y)) || 1; x /= m; y /= m;
    const px = (x * 0.5 + 0.5) * w, py = (-y * 0.5 + 0.5) * h;
    let a = arrowPool[n]; if (!a) { a = document.createElement('span'); arrowsEl.appendChild(a); arrowPool[n] = a; }
    a.style.display = 'block';
    a.style.left = clamp(px, 24, w - 24) - 10 + 'px'; a.style.top = clamp(py, 90, h - 40) - 9 + 'px';
    a.style.transform = `rotate(${Math.atan2(x, y)}rad)`;
    a.style.borderBottomColor = e.marked > S.time ? '#ffe14a' : e.state === 'warn' || e.state === 'dive' ? '#fff' : '';
    n++;
  }
  for (let i = n; i < arrowPool.length; i++) arrowPool[i].style.display = 'none';
}

let toastT = 0;
function toast(msg) { const t = $('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 1600); }
function flashCross(c) { const x = $('crosshair'); x.classList.add(c); setTimeout(() => x.classList.remove(c), 70); }
function floatText(msg) {
  const el = document.createElement('div'); el.className = 'float'; el.textContent = msg;
  el.style.left = `${rand(38, 62)}%`; $('stage').appendChild(el); setTimeout(() => el.remove(), 900);
}

// ---------------- Datos educativos ----------------
const FACTS = [
  'Solo las hembras de zancudo pican: necesitan proteínas de la sangre para formar sus huevos.',
  'Los zancudos machos no pican: se alimentan del néctar de las flores.',
  'El “bzzz” es el aleteo: un zancudo bate sus alas cientos de veces por segundo.',
  'Te encuentran por el CO₂ que exhalas, el calor de tu cuerpo y el olor de tu piel.',
  'Ponen sus huevos en agua estancada: vaciar platos de maceteros, baldes y neumáticos evita que se reproduzcan.',
  'Algunos zancudos, como el Aedes aegypti, pueden transmitir dengue. En Chile está en Rapa Nui y se vigila en el norte.',
  'Las libélulas, las arañas, las aves y los murciélagos comen zancudos: son parte de la cadena alimenticia.',
  'Un zancudo pesa unos 2 a 3 miligramos: ¡necesitarías cerca de medio millón para juntar un kilo!',
  'Los mosquiteros y el repelente protegen sin químicos en el aire de la pieza.',
  'En la vida real, el insecticida se usa con la pieza ventilada, lejos de la comida y de las mascotas. ¡Aquí es solo un juego!',
  'Los zancudos viven entre dos semanas y un par de meses, según la especie y el clima.',
  'Muchas larvas de zancudo viven en el agua y respiran por un tubito, como un snorkel.',
];
let factI = Math.floor(Math.random() * FACTS.length);
const nextFact = () => FACTS[factI++ % FACTS.length];
let factT = 0;
function showFact() {
  const el = $('dato'); el.textContent = '¿Sabías que…? ' + nextFact(); el.classList.add('show');
  clearTimeout(factT); factT = setTimeout(() => el.classList.remove('show'), 4200);
}

// ---------------- Tamaño / FOV ----------------
function resize() {
  const w = stage.clientWidth, h = stage.clientHeight; if (!w || !h) return;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  const fx = S.mode === 'ar' && video.videoWidth ? matchCameraFov(video, stage) : null;
  camera.fov = fx || (w > h ? 50 : 68);
  camera.updateProjectionMatrix();
  fx2d.width = w; fx2d.height = h;
}
new ResizeObserver(resize).observe(stage);
video.addEventListener('loadedmetadata', resize);
onLayoutChange(() => requestAnimationFrame(resize));
initLayout();

// ---------------- Flujo de juego ----------------
function resetGame() {
  for (const e of [...enemies]) removeEnemy(e);
  for (const p of puffs) scene.remove(p.s); puffs.length = 0;
  perches.length = 0; S.spotted.clear();
  for (const n of nests) scene.remove(n.sprite); nests.length = 0;
  sprayStop();
  Object.assign(S, { score: 0, wave: 0, toSpawn: 0, spawnTimer: 0, interTimer: 0, hp: CFG.maxHp, shield: CFG.maxShield, shieldBroken: false,
    spray: CFG.sprayMax, shaking: 0, sprayIdle: 0, tickCd: 0, combo: 0, comboTimer: 0, shots: 0, hits: 0, kills: 0, perchKills: 0, avoided: 0, bites: 0, nests: 0,
    firing: false, shielding: false, wasFiring: false, diveCd: 5, perchCd: 2 });
  if (S.mode === 'holo') addOrUpdatePerch('tv', holodeck.userData.tvTop, 0.55, true);
}
function show(id, on) { $(id).classList.toggle('show', on); }
function beginPlay() {
  ['menu', 'over', 'pause'].forEach((o) => show(o, false));
  aim.recenter(); aim.update(); camera.updateMatrixWorld();
  resetGame();
  S.state = 'playing';
  musicCtl.play('game'); musicCtl.setWave(1);
  setTimeout(startWave, 400);
  requestWakeLock();
  if (S.mode === 'ar' && S.detectOn) { spotter.load().then(() => scheduleDetect()); }
}
function gameOver() {
  S.state = 'over'; S.firing = false; S.shielding = false; document.body.classList.remove('shielding');
  sprayStop(); for (const e of enemies) e.buzz?.set(0.05, 0, 1);
  musicCtl.jingle('over'); setTimeout(() => { if (S.state !== 'playing') musicCtl.play('menu'); }, 3200);
  const newBest = S.score > S.best;
  if (newBest) { S.best = S.score; localStorage.setItem('an-best', S.best); }
  $('o-score').textContent = S.score.toLocaleString('es-CL');
  $('o-detail').innerHTML = `<div class="resumen">
    <div><b>${S.kills}</b><span>cazados</span></div><div><b>${S.avoided}</b><span>picadas evitadas</span></div>
    <div><b>${S.nests}</b><span>criaderos eliminados</span></div><div><b>${S.perchKills}</b><span>posados</span></div>
    <div><b>${S.bites}</b><span>picadas recibidas</span></div><div><b>${S.shots ? Math.round(S.hits / S.shots * 100) : 0}%</b><span>puntería</span></div></div>
    <p class="mini">Llegaste a la oleada ${S.wave} · Álbum ${albumCount()}</p>`;
  $('o-tip').textContent = '💡 Consejo: ' + TIPS[Math.floor(Math.random() * TIPS.length)];
  $('o-best').textContent = newBest ? '¡Nuevo récord!' : `Récord: ${S.best.toLocaleString('es-CL')}`;
  $('o-fact').textContent = '¿Sabías que…? ' + nextFact();
  setTimeout(() => show('over', true), 700);
}
function pause(on) {
  if (S.state !== 'playing' && S.state !== 'paused') return;
  S.state = on ? 'paused' : 'playing'; S.firing = false; S.shielding = false; sprayStop(); S.wasFiring = false;
  show('pause', on);
}

async function startAR(withCamera) {
  unlockAudio();
  const motionP = requestMotionPermission(); // iOS: debe pedirse dentro del toque
  let camOK = false;
  if (withCamera) camOK = await startCamera(video);
  resumeAudio(); // iOS puede dejar el audio 'interrupted' al abrir la cámara
  const motionOK = await motionP;
  S.mode = camOK ? 'ar' : 'holo';
  document.body.classList.toggle('cam-on', camOK);
  holodeck.visible = !camOK;
  resize();
  if (withCamera && !camOK) toast('Sin cámara: modo holodeck');
  if (!motionOK) setTimeout(() => toast('Sin sensores: arrastra para mirar'), 1800);
  beginPlay();
}

async function checkXR() {
  let ok = false;
  try { ok = !!(navigator.xr && await navigator.xr.isSessionSupported('immersive-ar')); } catch { ok = false; }
  $('m-xr').textContent = ok ? 'WebXR AR disponible en este navegador.' : 'AR por cámara + giroscopio (WebXR no está disponible en Safari de iPhone).';
  if (ok) {
    const b = document.createElement('button'); b.className = 'ghost'; b.textContent = 'Jugar con WebXR (experimental)';
    b.onclick = startXR; $('btn-start-nocam').after(b);
  }
}
async function startXR() {
  unlockAudio();
  try {
    const session = await navigator.xr.requestSession('immersive-ar', { optionalFeatures: ['dom-overlay', 'local-floor'], domOverlay: { root: $('app') } });
    renderer.xr.enabled = true;
    renderer.xr.setReferenceSpaceType('local');
    await renderer.xr.setSession(session);
    S.mode = 'xr'; holodeck.visible = false;
    session.addEventListener('end', () => { renderer.xr.enabled = false; S.mode = 'ar'; S.state = 'menu'; show('menu', true); });
    beginPlay();
  } catch (e) { toast('No se pudo iniciar WebXR'); console.warn(e); }
}

// ---------------- Controles ----------------
function hold(btn, onDown, onUp) {
  btn.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); btn.setPointerCapture?.(e.pointerId); btn.classList.add('active'); onDown(); });
  const up = () => { btn.classList.remove('active'); onUp && onUp(); };
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((ev) => btn.addEventListener(ev, up));
}
hold($('btn-fire'), () => { unlockAudio(); S.firing = S.state === 'playing'; }, () => (S.firing = false));
hold($('btn-shield'), () => (S.shielding = S.state === 'playing'), () => (S.shielding = false));
hold($('btn-reload'), () => shakeCan());
hold($('btn-panel'), () => document.body.classList.toggle('panel-open'));

// Tocar la vista AR también rocía (mantener = spray continuo). Sin sensores: arrastrar para mirar.
const touches = new Map();
let tapTimer = 0;
stage.addEventListener('pointerdown', (e) => {
  if (e.target.closest('.ctl')) return;
  if (S.state === 'playing') tapNest(e.clientX, e.clientY);
  if (document.body.classList.contains('panel-open')) { document.body.classList.remove('panel-open'); return; }
  touches.set(e.pointerId, { x: e.clientX, y: e.clientY, moved: 0 });
  if (aim.has) S.firing = S.state === 'playing';
});
stage.addEventListener('pointermove', (e) => {
  const t = touches.get(e.pointerId); if (!t || aim.has) return;
  aim.addDrag(e.clientX - t.x, e.clientY - t.y); t.moved += Math.abs(e.clientX - t.x) + Math.abs(e.clientY - t.y); t.x = e.clientX; t.y = e.clientY;
});
const endTouch = (e) => {
  const t = touches.get(e.pointerId); touches.delete(e.pointerId);
  if (!aim.has && t && t.moved < 8 && S.state === 'playing') { S.firing = true; clearTimeout(tapTimer); tapTimer = setTimeout(() => (S.firing = false), 350); } // tap = pssst corto
  if (touches.size === 0 && aim.has) S.firing = false;
};
stage.addEventListener('pointerup', endTouch); stage.addEventListener('pointercancel', endTouch);

// Teclado (PC): Espacio = spray, Shift = manotazo, R = agitar, P = pausa, flechas = mirar
const keys = new Set();
addEventListener('keydown', (e) => {
  if (e.repeat) return; keys.add(e.code);
  if (e.code === 'Space') { S.firing = S.state === 'playing'; e.preventDefault(); }
  if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') S.shielding = S.state === 'playing';
  if (e.code === 'KeyR') shakeCan();
  if (e.code === 'KeyP' || e.code === 'Escape') pause(S.state === 'playing');
});
addEventListener('keyup', (e) => {
  keys.delete(e.code);
  if (e.code === 'Space') S.firing = false;
  if (e.code.startsWith('Shift')) S.shielding = false;
});
setInterval(() => { if (aim.has) return; const k = 4; if (keys.has('ArrowLeft')) aim.addDrag(-k, 0); if (keys.has('ArrowRight')) aim.addDrag(k, 0); if (keys.has('ArrowUp')) aim.addDrag(0, -k); if (keys.has('ArrowDown')) aim.addDrag(0, k); }, 16);

$('btn-start').addEventListener('click', () => startAR(true));
$('btn-start-nocam').addEventListener('click', () => startAR(false));
$('btn-restart').addEventListener('click', () => { unlockAudio(); beginPlay(); });
$('btn-menu').addEventListener('click', () => { show('over', false); show('menu', true); resetGame(); S.state = 'menu'; updateMenuBest(); });
$('btn-resume').addEventListener('click', () => pause(false));
$('btn-quit').addEventListener('click', () => { show('pause', false); resetGame(); S.state = 'menu'; show('menu', true); updateMenuBest(); });
$('btn-pause').addEventListener('click', () => pause(true));
$('btn-recenter').addEventListener('click', () => { aim.recenter(); toast('RECENTRADO'); });
$('btn-layout').addEventListener('click', () => cycleForcedLayout());
const detBtn = $('btn-detect');
const paintDet = () => (detBtn.textContent = `Posarse en objetos: ${S.detectOn ? 'sí' : 'no'}`);
paintDet();
detBtn.addEventListener('click', () => {
  S.detectOn = !S.detectOn; localStorage.setItem('an-detect', S.detectOn ? 'on' : 'off'); paintDet();
  if (S.detectOn && S.state === 'playing' && S.mode === 'ar') spotter.load().then(() => scheduleDetect());
  if (!S.detectOn) { for (const p of [...perches]) if (!p.fake) perches.splice(perches.indexOf(p), 1); }
});
$('btn-coop').addEventListener('click', () => { S.coop = !S.coop; localStorage.setItem('an-coop', S.coop ? 'on' : 'off'); applyCoop(); if (S.coop) toast('COPILOTO: toca el radar para marcar'); });
applyCoop();
const openAlbum = () => { renderAlbum($('album-grid'), CRIADERO_URL); $('album-count').textContent = albumCount(); show('album', true); };
$('btn-album').addEventListener('click', openAlbum); $('btn-album2').addEventListener('click', openAlbum);
$('btn-album-close').addEventListener('click', () => show('album', false));
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(true); else resumeAudio(); });
// Audio: en iOS hay que desbloquear y reanudar dentro de un gesto. Cualquier toque sirve.
const firstGesture = () => { unlockAudio(); if (S.state === 'menu') musicCtl.play('menu'); };
for (const ev of ['pointerdown', 'touchend', 'click', 'keydown']) document.addEventListener(ev, firstGesture, { capture: true, passive: true });
addEventListener('pageshow', resumeAudio); addEventListener('focus', resumeAudio);
// Botón 🔊 del HUD y del menú + volúmenes del panel
const vols = getVolumes();
const paintSnd = () => { const t = getVolumes().on ? '🔊' : '🔇'; $('btn-sound').textContent = t; $('btn-sound-menu').textContent = `${t} Sonido: ${getVolumes().on ? 'sí' : 'no'}`; };
const toggleSnd = (e) => { e.preventDefault(); e.stopPropagation(); unlockAudio(); setSound(!getVolumes().on); paintSnd(); };
$('btn-sound').addEventListener('pointerdown', toggleSnd); $('btn-sound-menu').addEventListener('click', toggleSnd);
$('vol-music').value = Math.round(vols.music * 100); $('vol-sfx').value = Math.round(vols.sfx * 100);
$('vol-music').addEventListener('input', (e) => { unlockAudio(); setMusicVolume(e.target.value / 100); });
$('vol-sfx').addEventListener('input', (e) => { unlockAudio(); setSfxVolume(e.target.value / 100); sfx.hit(); });
paintSnd();

function updateMenuBest() { $('m-best').textContent = S.best ? `Récord: ${S.best.toLocaleString('es-CL')}` : ''; }
updateMenuBest();
checkXR();

// Wake Lock: que la pantalla no se apague a mitad de oleada
let wakeLock = null;
async function requestWakeLock() { try { wakeLock = await navigator.wakeLock?.request('screen'); } catch { /* opcional */ } }
document.addEventListener('visibilitychange', () => { if (!document.hidden && S.state !== 'menu') requestWakeLock(); });

// PWA: service worker (red primero, caché offline)
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
if (matchMedia('(display-mode: standalone)').matches || navigator.standalone) $('install').style.display = 'none';

// Para depurar / pruebas automáticas desde la consola
window.__asedio = { audioState, outputLevel, musicCtl, gameOver, S, enemies, perches, nests, emptyNest, tapNest, radarPick, shakeCan, camera, aim, spawnEnemy, spotter, addOrUpdatePerch, runDetector, CFG,
  aimAt(e) { const p = e.sprite.position; aim.dragYaw = Math.atan2(-p.x, -p.z); aim.dragPitch = Math.asin(p.y / p.length()); } };
