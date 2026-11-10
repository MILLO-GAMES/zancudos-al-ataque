// ==========================================================
// Asedio Neón · Millo Games
// Shooter AR por oleadas: quédate en el centro de tu pieza, gira, apunta y dispara.
// Render: Three.js sobre el video de la cámara trasera. Apuntado: orientación del teléfono.
// ==========================================================
import * as THREE from '../vendor/three.module.min.js';
import { initLayout, onLayoutChange, cycleForcedLayout, getLayout } from './layout.js';
import { initAudio, sfx } from './audio.js';
import { requestMotionPermission, startCamera, stopCamera, AimController, matchCameraFov } from './sensors.js';

const $ = (id) => document.getElementById(id);
const stage = $('stage'), video = $('cam'), glCanvas = $('gl');
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ---------------- Configuración de juego ----------------
const CFG = {
  maxHp: 100, maxShield: 100,
  shieldDrain: 16, shieldRegen: 14, shieldCone: Math.cos(60 * Math.PI / 180), shieldBlockCost: 10,
  magazine: 30, fireRate: 7, reloadTime: 1.1,
  projectileHitDist: 0.45,
};

// ---------------- Three.js ----------------
const renderer = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setClearColor(0x000000, 0);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(65, 1, 0.05, 200);
camera.rotation.order = 'YXZ';
scene.add(camera);
scene.add(new THREE.HemisphereLight(0x88ccff, 0x442266, 1.2));
const sun = new THREE.DirectionalLight(0xffffff, 1.2); sun.position.set(2, 5, 3); scene.add(sun);

const aim = new AimController(camera, stage);

// Textura de brillo (glow) generada en canvas: reemplaza el bloom sin postproceso
function glowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.25, 'rgba(255,255,255,.6)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const GLOW = glowTexture();
const glowMat = (color, opacity = 1) => new THREE.SpriteMaterial({ map: GLOW, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false });

// ---------- Ambiente holodeck (solo sin cámara) + anillo holográfico de arena (siempre) ----------
const holodeck = new THREE.Group(); scene.add(holodeck);
{
  const grid = new THREE.GridHelper(80, 80, 0xff2bd6, 0x7a1a8a); grid.position.y = -1.5;
  grid.material.transparent = true; grid.material.opacity = 0.55; holodeck.add(grid);
  const starsG = new THREE.BufferGeometry(); const p = [];
  for (let i = 0; i < 900; i++) { const v = new THREE.Vector3().randomDirection().multiplyScalar(rand(60, 90)); if (v.y < -5) v.y *= -1; p.push(v.x, v.y, v.z); }
  starsG.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  holodeck.add(new THREE.Points(starsG, new THREE.PointsMaterial({ color: 0x99ddff, size: 0.25 })));
  scene.fog = null;
}
const arenaRing = new THREE.Mesh(new THREE.RingGeometry(1.15, 1.2, 64), new THREE.MeshBasicMaterial({ color: 0x00f0ff, transparent: true, opacity: 0.35, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
arenaRing.rotation.x = -Math.PI / 2; arenaRing.position.y = -1.4; scene.add(arenaRing);

// ---------- Geometrías compartidas ----------
const GEO = {
  ring: new THREE.TorusGeometry(0.32, 0.045, 10, 36),
  core: new THREE.SphereGeometry(0.16, 20, 14),
  fin: new THREE.BoxGeometry(0.5, 0.04, 0.12),
  spike: new THREE.ConeGeometry(0.12, 0.45, 10),
  shell: new THREE.IcosahedronGeometry(0.42, 1),
  bolt: new THREE.SphereGeometry(0.11, 12, 8),
  spark: new THREE.BufferGeometry(),
};

// ---------------- Estado ----------------
const S = {
  state: 'menu', mode: 'ar', // 'ar' (cámara+IMU) | 'holo' (sin cámara) | 'xr' (WebXR real)
  score: 0, best: +(localStorage.getItem('an-best') || 0),
  wave: 0, toSpawn: 0, spawnTimer: 0, interTimer: 0,
  hp: CFG.maxHp, shield: CFG.maxShield, shieldBroken: false, shieldIdle: 0,
  ammo: CFG.magazine, reloading: 0, fireCd: 0,
  firing: false, shielding: false,
  combo: 0, comboTimer: 0, shots: 0, hits: 0, kills: 0,
  time: 0,
};
const enemies = [], bolts = [], beams = [], particles = [];

// ---------------- Enemigos ----------------
const TYPES = {
  dron:      { hp: 1, score: 100, speed: 1.6, fireEvery: [2.6, 4.2], dmg: 15, color: 0x00f0ff, core: 0xff3c5a, scale: 1 },
  veloz:     { hp: 1, score: 150, speed: 2.6, fireEvery: null,       dmg: 20, color: 0xffe14a, core: 0xff8a00, scale: 0.8 },
  acorazado: { hp: 4, score: 300, speed: 0.9, fireEvery: [3.2, 4.5], dmg: 20, color: 0xff2bd6, core: 0xffffff, scale: 1.35, burst: 3 },
};

function buildDrone(type) {
  const t = TYPES[type];
  const g = new THREE.Group();
  const ringMat = new THREE.MeshStandardMaterial({ color: t.color, emissive: t.color, emissiveIntensity: 1.4, metalness: 0.3, roughness: 0.3 });
  const coreMat = new THREE.MeshStandardMaterial({ color: t.core, emissive: t.core, emissiveIntensity: 2 });
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1a1030, metalness: 0.8, roughness: 0.35, emissive: 0x110022 });
  if (type === 'acorazado') {
    const shell = new THREE.Mesh(GEO.shell, bodyMat); g.add(shell);
    const r1 = new THREE.Mesh(GEO.ring, ringMat); r1.scale.setScalar(1.6); g.add(r1);
    const r2 = new THREE.Mesh(GEO.ring, ringMat); r2.scale.setScalar(1.6); r2.rotation.y = Math.PI / 2; g.add(r2);
    g.userData.spin = [r1, r2];
  } else if (type === 'veloz') {
    const sp = new THREE.Mesh(GEO.spike, bodyMat); sp.rotation.x = Math.PI / 2; g.add(sp);
    const r = new THREE.Mesh(GEO.ring, ringMat); r.scale.setScalar(0.8); g.add(r);
    g.userData.spin = [r];
  } else {
    const r = new THREE.Mesh(GEO.ring, ringMat); g.add(r);
    const f1 = new THREE.Mesh(GEO.fin, bodyMat); f1.position.y = 0.0; g.add(f1);
    const f2 = f1.clone(); f2.rotation.z = Math.PI / 2; g.add(f2);
    g.userData.spin = [f1, f2];
  }
  const core = new THREE.Mesh(GEO.core, coreMat); core.position.z = 0.02; g.add(core);
  const glow = new THREE.Sprite(glowMat(t.core, 0.85)); glow.scale.setScalar(0.9); g.add(glow);
  g.scale.setScalar(t.scale);
  g.userData.coreMat = coreMat; g.userData.glow = glow;
  return g;
}

function spawnEnemy() {
  const w = S.wave;
  let type = 'dron';
  const r = Math.random();
  if (w >= 2 && r < Math.min(0.35, 0.12 + w * 0.03)) type = 'veloz';
  else if (w >= 3 && r > 1 - Math.min(0.3, 0.08 + w * 0.025)) type = 'acorazado';
  const t = TYPES[type];
  // Aparecen sobre todo al frente; con las oleadas se abren hacia los lados y la espalda
  const spread = Math.min(Math.PI, (70 + w * 18) * Math.PI / 180);
  const yaw = rand(-spread, spread);
  const dist = rand(5.5, 9);
  const home = new THREE.Vector3(-Math.sin(yaw) * dist, rand(-0.6, 2.2), -Math.cos(yaw) * dist).add(camBase);
  const start = home.clone().sub(camBase).setLength(22).add(camBase); start.y += rand(2, 5);
  const mesh = buildDrone(type);
  mesh.position.copy(start);
  scene.add(mesh);
  enemies.push({
    type, t, mesh, hp: t.hp, radius: 0.42 * t.scale,
    home, target: home.clone(), entering: true,
    fireT: t.fireEvery ? rand(...t.fireEvery) * (type === 'dron' ? 1 : 1) : 0, charging: 0, burstLeft: 0,
    wobble: rand(0, 10), retarget: rand(2, 4),
  });
  spawnPortal(home);
}
const camBase = new THREE.Vector3(0, 0, 0); // centro de la arena (en WebXR se fija al iniciar)

function killEnemy(e, byPlayer = true) {
  const i = enemies.indexOf(e); if (i < 0) return;
  enemies.splice(i, 1);
  scene.remove(e.mesh);
  explode(e.mesh.position, e.t.color, e.type === 'acorazado' ? 70 : 40);
  sfx.explode();
  if (byPlayer) {
    S.kills++;
    S.combo++; S.comboTimer = 2.5;
    addScore(e.t.score * comboMult());
  }
}
const comboMult = () => 1 + Math.min(4, Math.floor(S.combo / 5));
function addScore(n) { S.score += Math.round(n); }

// ---------------- Proyectiles enemigos ----------------
function enemyFire(e) {
  const from = e.mesh.position.clone();
  const to = camera.position.clone().add(new THREE.Vector3(rand(-0.08, 0.08), rand(-0.08, 0.05), 0));
  const speed = 3.0 + Math.min(3, S.wave * 0.18);
  const vel = to.sub(from).normalize().multiplyScalar(speed);
  const mesh = new THREE.Group();
  mesh.add(new THREE.Mesh(GEO.bolt, new THREE.MeshBasicMaterial({ color: 0xffb070 })));
  const gl = new THREE.Sprite(glowMat(0xff5a1e, 1)); gl.scale.setScalar(0.7); mesh.add(gl);
  mesh.position.copy(from); scene.add(mesh);
  bolts.push({ mesh, vel, dmg: e.t.dmg, radius: 0.22, life: 12 });
  sfx.enemyShot();
}
function removeBolt(b) { const i = bolts.indexOf(b); if (i >= 0) bolts.splice(i, 1); scene.remove(b.mesh); }

// ---------------- Efectos ----------------
const sparkMat = new THREE.PointsMaterial({ size: 0.09, map: GLOW, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, vertexColors: true });
function explode(pos, color, n = 40) {
  const geo = new THREE.BufferGeometry();
  const p = new Float32Array(n * 3), c = new Float32Array(n * 3), v = [];
  const col = new THREE.Color(color), white = new THREE.Color(0xffffff);
  for (let i = 0; i < n; i++) {
    p.set([pos.x, pos.y, pos.z], i * 3);
    const cc = Math.random() < 0.3 ? white : col; c.set([cc.r, cc.g, cc.b], i * 3);
    v.push(new THREE.Vector3().randomDirection().multiplyScalar(rand(1.5, 5)));
  }
  geo.setAttribute('position', new THREE.BufferAttribute(p, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
  const pts = new THREE.Points(geo, sparkMat.clone()); scene.add(pts);
  const flash = new THREE.Sprite(glowMat(color, 1)); flash.position.copy(pos); flash.scale.setScalar(1.5); scene.add(flash);
  particles.push({ obj: pts, v, life: 0.9, max: 0.9, flash });
}
function spawnPortal(pos) {
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.28, 40), new THREE.MeshBasicMaterial({ color: 0xff2bd6, transparent: true, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
  ring.position.copy(pos); ring.lookAt(camera.position); scene.add(ring);
  particles.push({ obj: ring, portal: true, life: 1.0, max: 1.0 });
}
const beamMat = new THREE.MeshBasicMaterial({ color: 0x7dffd8, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
const beamGeo = new THREE.CylinderGeometry(0.012, 0.02, 1, 6, 1, true); beamGeo.translate(0, 0.5, 0); beamGeo.rotateX(Math.PI / 2);
function shootBeam(from, to) {
  const m = new THREE.Mesh(beamGeo, beamMat.clone());
  m.position.copy(from); m.lookAt(to); m.scale.set(1, 1, from.distanceTo(to));
  scene.add(m);
  const fl = new THREE.Sprite(glowMat(0x7dffd8, 0.9)); fl.position.copy(from); fl.scale.setScalar(0.18); scene.add(fl);
  beams.push({ m, fl, life: 0.09 });
  // Corrige el "lookAt" del cilindro (eje Z) → apunta de from a to
  m.lookAt(to);
}

// ---------------- Disparo del jugador ----------------
const ray = new THREE.Ray(), tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();
/** Busca el objetivo más cercano a lo largo de la mira, con un poco de ayuda de apuntado. */
function pickTarget() {
  camera.getWorldDirection(tmp2);
  ray.set(camera.position, tmp2);
  let best = null, bestT = Infinity;
  const test = (obj, pos, radius) => {
    tmp.copy(pos).sub(ray.origin);
    const t = tmp.dot(ray.direction); if (t < 0.3) return;
    const perp = Math.sqrt(Math.max(0, tmp.lengthSq() - t * t));
    const assist = radius * 1.2 + t * 0.025; // ayuda proporcional a la distancia (pantalla chica)
    if (perp < assist && t < bestT) { bestT = t; best = obj; }
  };
  for (const e of enemies) if (!e.entering) test(e, e.mesh.position, e.radius);
  for (const b of bolts) test(b, b.mesh.position, b.radius + 0.1);
  return best ? { obj: best, t: bestT } : null;
}
const gunOffset = new THREE.Vector3(0.09, -0.12, -0.25);
function playerShoot() {
  if (S.reloading > 0) return;
  if (S.ammo <= 0) { sfx.empty(); startReload(); return; }
  S.ammo--; S.shots++; S.fireCd = 1 / CFG.fireRate;
  sfx.shoot();
  const from = gunOffset.clone().applyMatrix4(camera.matrixWorld);
  const hit = pickTarget();
  camera.getWorldDirection(tmp2);
  const to = hit ? hit.obj.mesh.position.clone() : camera.position.clone().addScaledVector(tmp2, 40);
  shootBeam(from, to);
  if (hit) {
    S.hits++;
    flashCross('hit');
    if (bolts.includes(hit.obj)) { explode(hit.obj.mesh.position, 0xff8a3a, 14); removeBolt(hit.obj); addScore(25); sfx.hit(); }
    else {
      const e = hit.obj; e.hp--;
      if (e.hp <= 0) killEnemy(e); else { sfx.hit(); explode(e.mesh.position, 0xffffff, 10); e.mesh.userData.hitFlash = 0.12; }
    }
  } else { S.combo = 0; }
  if (S.ammo <= 0) startReload();
}
function startReload() {
  if (S.reloading > 0 || S.ammo === CFG.magazine) return;
  S.reloading = CFG.reloadTime; sfx.reload();
}

// ---------------- Daño al jugador ----------------
function playerHit(dmg, fromPos) {
  // Escudo frontal: bloquea si está activo y el golpe viene de donde estás mirando
  if (S.shielding && !S.shieldBroken && S.shield > 0) {
    camera.getWorldDirection(tmp2);
    tmp.copy(fromPos).sub(camera.position).normalize();
    if (tmp.dot(tmp2) > CFG.shieldCone) {
      S.shield = Math.max(0, S.shield - CFG.shieldBlockCost); sfx.block();
      explode(fromPos, 0x00f0ff, 18); addScore(10);
      if (S.shield <= 0) S.shieldBroken = true;
      return;
    }
  }
  S.hp = Math.max(0, S.hp - dmg); S.combo = 0;
  sfx.hurt();
  const d = $('dmg'); d.classList.add('on'); setTimeout(() => d.classList.remove('on'), 90);
  if (navigator.vibrate) navigator.vibrate(80);
  if (S.hp <= 0) gameOver();
}

// ---------------- Oleadas ----------------
function startWave() {
  S.wave++;
  S.toSpawn = 4 + S.wave * 2;
  S.spawnTimer = 0.8;
  toast(`OLEADA ${S.wave}`);
  sfx.wave();
  if (S.wave > 1) { S.hp = Math.min(CFG.maxHp, S.hp + 15); } // pequeño respiro entre oleadas
}
const maxAlive = () => Math.min(9, 3 + Math.floor(S.wave * 0.8));

// ---------------- Loop ----------------
const clock = new THREE.Clock();
function update(dt) {
  S.time += dt;
  if (S.mode !== 'xr') aim.update();
  camera.updateMatrixWorld();

  if (S.state === 'playing') {
    // oleada
    if (S.toSpawn > 0) {
      S.spawnTimer -= dt;
      if (S.spawnTimer <= 0 && enemies.length < maxAlive()) { spawnEnemy(); S.toSpawn--; S.spawnTimer = Math.max(0.5, 1.8 - S.wave * 0.1); }
    } else if (enemies.length === 0) {
      S.interTimer += dt;
      if (S.interTimer > 0.6 && S.interTimer - dt <= 0.6) toast(`OLEADA ${S.wave} SUPERADA`);
      if (S.interTimer > 2.6) { S.interTimer = 0; startWave(); }
    }
    // disparo / recarga
    S.fireCd -= dt;
    if (S.reloading > 0) { S.reloading -= dt; if (S.reloading <= 0) { S.reloading = 0; S.ammo = CFG.magazine; } }
    if (S.firing && S.fireCd <= 0) playerShoot();
    // escudo
    const wasShield = document.body.classList.contains('shielding');
    const sh = S.shielding && !S.shieldBroken && S.shield > 0;
    if (sh) { S.shield = Math.max(0, S.shield - CFG.shieldDrain * dt); S.shieldIdle = 0; if (S.shield <= 0) S.shieldBroken = true; }
    else { S.shieldIdle += dt; if (S.shieldIdle > 0.7) S.shield = Math.min(CFG.maxShield, S.shield + CFG.shieldRegen * dt); }
    if (S.shieldBroken && S.shield >= 30) S.shieldBroken = false;
    if (sh !== wasShield) { document.body.classList.toggle('shielding', sh); if (sh) sfx.shieldOn(); }
    // combo
    if (S.comboTimer > 0) { S.comboTimer -= dt; if (S.comboTimer <= 0) S.combo = 0; }
  }

  // enemigos
  const playing = S.state === 'playing';
  for (const e of [...enemies]) {
    const m = e.mesh;
    e.wobble += dt;
    if (e.entering) {
      m.position.lerp(e.home, 1 - Math.pow(0.02, dt));
      if (m.position.distanceTo(e.home) < 0.3) e.entering = false;
    } else if (e.type === 'veloz') {
      // kamikaze: zigzaguea hacia ti
      tmp.copy(camera.position).sub(m.position);
      const d = tmp.length();
      tmp.normalize().multiplyScalar(e.t.speed * (playing ? 1 : 0) * dt);
      m.position.add(tmp);
      m.position.x += Math.sin(e.wobble * 5) * 0.02; m.position.y += Math.cos(e.wobble * 4) * 0.015;
      if (d < 0.8 && playing) { killEnemy(e, false); playerHit(e.t.dmg, m.position); continue; }
    } else {
      e.retarget -= dt;
      if (e.retarget <= 0) {
        e.retarget = rand(2, 4);
        const off = e.home.clone().sub(camBase);
        const yaw = Math.atan2(off.x, off.z) + rand(-0.5, 0.5);
        const dist = clamp(off.setY(0).length() + rand(-1.2, 1.2), 4.5, 10);
        e.target.set(Math.sin(yaw) * dist, rand(-0.6, 2.2), Math.cos(yaw) * dist).add(camBase);
        e.home.copy(e.target);
      }
      m.position.lerp(e.target, 1 - Math.pow(0.5, dt * e.t.speed * 0.6));
      m.position.y += Math.sin(e.wobble * 2) * 0.004;
      // disparo con aviso: el núcleo brilla blanco antes de disparar
      if (playing && e.t.fireEvery) {
        e.fireT -= dt;
        if (e.fireT < 0.6 && !e.charging) { e.charging = 1; sfx.charge(); }
        if (e.fireT <= 0) {
          enemyFire(e); e.charging = 0;
          if (e.t.burst && e.burstLeft === 0) e.burstLeft = e.t.burst - 1;
          if (e.burstLeft > 0) { e.burstLeft--; e.fireT = 0.25; e.charging = 1; }
          else e.fireT = rand(...e.t.fireEvery) * Math.max(0.55, 1 - S.wave * 0.04);
        }
      }
    }
    m.lookAt(camera.position);
    for (const s of m.userData.spin || []) s.rotation.z += dt * 3;
    const cm = m.userData.coreMat;
    if (m.userData.hitFlash > 0) { m.userData.hitFlash -= dt; cm.emissive.setHex(0xffffff); }
    else if (e.charging) cm.emissive.setHex(Math.floor(S.time * 14) % 2 ? 0xffffff : e.t.core);
    else cm.emissive.setHex(e.t.core);
    m.userData.glow.material.opacity = e.charging ? 1 : 0.7 + Math.sin(e.wobble * 6) * 0.15;
  }

  // proyectiles
  for (const b of [...bolts]) {
    b.mesh.position.addScaledVector(b.vel, playing ? dt : 0);
    b.life -= dt;
    b.mesh.rotation.z += dt * 10;
    if (playing && b.mesh.position.distanceTo(camera.position) < CFG.projectileHitDist) {
      const p = b.mesh.position.clone().sub(b.vel.clone().normalize().multiplyScalar(0.5));
      removeBolt(b); playerHit(b.dmg, p); continue;
    }
    if (b.life <= 0) removeBolt(b);
  }
  // rayos y partículas
  for (const bm of [...beams]) {
    bm.life -= dt; bm.m.material.opacity = Math.max(0, bm.life / 0.09); bm.fl.material.opacity = bm.m.material.opacity;
    if (bm.life <= 0) { scene.remove(bm.m); scene.remove(bm.fl); beams.splice(beams.indexOf(bm), 1); }
  }
  for (const p of [...particles]) {
    p.life -= dt; const k = Math.max(0, p.life / p.max);
    if (p.portal) { p.obj.scale.setScalar(1 + (1 - k) * 4); p.obj.material.opacity = k; }
    else {
      const pos = p.obj.geometry.attributes.position;
      for (let i = 0; i < p.v.length; i++) { pos.array[i * 3] += p.v[i].x * dt; pos.array[i * 3 + 1] += p.v[i].y * dt; pos.array[i * 3 + 2] += p.v[i].z * dt; p.v[i].multiplyScalar(0.96); }
      pos.needsUpdate = true; p.obj.material.opacity = k;
      if (p.flash) { p.flash.material.opacity = k * k; p.flash.scale.setScalar(1.5 + (1 - k) * 2); }
    }
    if (p.life <= 0) { scene.remove(p.obj); if (p.flash) scene.remove(p.flash); p.obj.geometry !== GEO.spark && p.obj.geometry.dispose?.(); particles.splice(particles.indexOf(p), 1); }
  }
  arenaRing.material.opacity = 0.22 + Math.sin(S.time * 2) * 0.08;

  // mira sobre objetivo
  const tgt = enemies.length ? pickTarget() : null;
  $('crosshair').classList.toggle('on-target', !!tgt);
}

function frame() {
  const dt = Math.min(0.05, clock.getDelta());
  update(dt);
  renderer.render(scene, camera);
  drawHud();
}
renderer.setAnimationLoop(frame);

// ---------------- HUD ----------------
const last = {};
function setText(id, v) { if (last[id] !== v) { last[id] = v; $(id).textContent = v; } }
function setWidth(id, pct) { const v = Math.round(pct) + '%'; if (last[id] !== v) { last[id] = v; $(id).style.width = v; } }
const cells = $('p-cells');
for (let i = 0; i < CFG.magazine; i++) cells.appendChild(document.createElement('i'));

function drawHud() {
  setText('h-wave', S.wave || 1); setText('p-wave', S.wave || 1);
  setText('h-score', S.score.toLocaleString('es-CL')); setText('p-score', S.score.toLocaleString('es-CL'));
  setText('p-best', Math.max(S.best, S.score).toLocaleString('es-CL'));
  setText('h-combo', comboMult() > 1 ? `×${comboMult()}` : '');
  setText('h-hp', Math.ceil(S.hp)); setText('p-hp', Math.ceil(S.hp));
  setText('p-sh', S.shieldBroken ? 'RECARGANDO' : Math.round(S.shield));
  setWidth('b-hp', S.hp); setWidth('pb-hp', S.hp); setWidth('b-sh', S.shield); setWidth('pb-sh', S.shield);
  setText('p-left', enemies.length + S.toSpawn);
  const ammoTxt = S.reloading > 0 ? 'RECARGANDO…' : `${S.ammo} / ${CFG.magazine}`;
  setText('p-ammo', ammoTxt); setText('h-ammo-mini', S.reloading > 0 ? '…' : String(S.ammo));
  setText('p-acc', S.shots ? Math.round((S.hits / S.shots) * 100) + '%' : '–');
  if (last.cells !== S.ammo) { last.cells = S.ammo; [...cells.children].forEach((c, i) => c.classList.toggle('off', i >= S.ammo || S.reloading > 0)); }
  $('btn-reload').classList.toggle('reloading', S.reloading > 0);
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
  // cono de visión
  const half = (camera.fov * camera.aspect / 2) * Math.PI / 180;
  g.fillStyle = 'rgba(0,255,160,.14)'; g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, R - 3, -Math.PI / 2 - half, -Math.PI / 2 + half); g.closePath(); g.fill();
  camera.getWorldDirection(tmp2);
  const camYaw = Math.atan2(tmp2.x, tmp2.z);
  const range = 11;
  const dot = (pos, color, size) => {
    const dx = pos.x - camera.position.x, dz = pos.z - camera.position.z;
    const ang = Math.atan2(dx, dz) - camYaw;
    const d = Math.min(1, Math.hypot(dx, dz) / range) * (R - 8);
    const x = -Math.sin(ang) * d, y = -Math.cos(ang) * d;
    g.fillStyle = color; g.shadowColor = color; g.shadowBlur = 8;
    g.beginPath(); g.arc(x, y, size, 0, Math.PI * 2); g.fill();
  };
  for (const e of enemies) dot(e.mesh.position, e.charging ? '#ffffff' : '#' + e.t.core.toString(16).padStart(6, '0'), (big ? 9 : 12) * e.t.scale);
  for (const b of bolts) dot(b.mesh.position, '#ff8a3a', big ? 4 : 6);
  g.shadowBlur = 0; g.fillStyle = '#00ffa0'; g.beginPath(); g.moveTo(0, -10); g.lineTo(7, 8); g.lineTo(-7, 8); g.closePath(); g.fill();
  g.restore();
}

/** Flechas en el borde para enemigos fuera de pantalla. */
const arrowsEl = $('arrows'); const arrowPool = [];
function drawArrows() {
  let n = 0;
  const w = stage.clientWidth, h = stage.clientHeight;
  for (const e of enemies) {
    if (e.entering || n >= 8) continue;
    tmp.copy(e.mesh.position).project(camera);
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
    a.style.borderBottomColor = e.charging ? '#fff' : '';
    n++;
  }
  for (let i = n; i < arrowPool.length; i++) arrowPool[i].style.display = 'none';
}

let toastT = 0;
function toast(msg) { const t = $('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 1600); }
function flashCross(c) { const x = $('crosshair'); x.classList.add(c); setTimeout(() => x.classList.remove(c), 70); }

// ---------------- Tamaño / FOV ----------------
function resize() {
  const w = stage.clientWidth, h = stage.clientHeight; if (!w || !h) return;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  const fx = S.mode === 'ar' && video.videoWidth ? matchCameraFov(video, stage) : null;
  camera.fov = fx || (w > h ? 50 : 68);
  camera.updateProjectionMatrix();
  const fx2 = $('fx2d'); fx2.width = w; fx2.height = h;
}
new ResizeObserver(resize).observe(stage);
video.addEventListener('loadedmetadata', resize);
onLayoutChange(() => requestAnimationFrame(resize));
initLayout();

// ---------------- Flujo de juego ----------------
function resetGame() {
  for (const e of [...enemies]) scene.remove(e.mesh); enemies.length = 0;
  for (const b of [...bolts]) scene.remove(b.mesh); bolts.length = 0;
  Object.assign(S, { score: 0, wave: 0, toSpawn: 0, spawnTimer: 0, interTimer: 0, hp: CFG.maxHp, shield: CFG.maxShield, shieldBroken: false,
    ammo: CFG.magazine, reloading: 0, fireCd: 0, combo: 0, comboTimer: 0, shots: 0, hits: 0, kills: 0, firing: false, shielding: false });
}
function show(id, on) { $(id).classList.toggle('show', on); }
function beginPlay() {
  resetGame();
  ['menu', 'over', 'pause'].forEach((o) => show(o, false));
  S.state = 'playing';
  aim.recenter();
  setTimeout(startWave, 400);
  requestWakeLock();
}
function gameOver() {
  S.state = 'over'; S.firing = false; S.shielding = false; document.body.classList.remove('shielding');
  sfx.over();
  const newBest = S.score > S.best;
  if (newBest) { S.best = S.score; localStorage.setItem('an-best', S.best); }
  $('o-score').textContent = S.score.toLocaleString('es-CL');
  $('o-detail').textContent = `Oleada ${S.wave} · ${S.kills} drones · precisión ${S.shots ? Math.round(S.hits / S.shots * 100) : 0}%`;
  $('o-best').textContent = newBest ? '¡Nuevo récord!' : `Récord: ${S.best.toLocaleString('es-CL')}`;
  setTimeout(() => show('over', true), 700);
}
function pause(on) {
  if (S.state !== 'playing' && S.state !== 'paused') return;
  S.state = on ? 'paused' : 'playing'; S.firing = false; S.shielding = false;
  show('pause', on);
}

async function startAR(withCamera) {
  initAudio();
  // 1) Permiso de movimiento: debe pedirse sincrónicamente dentro del toque (iOS)
  const motionP = requestMotionPermission();
  // 2) Cámara trasera
  let camOK = false;
  if (withCamera) camOK = await startCamera(video);
  const motionOK = await motionP;
  S.mode = camOK ? 'ar' : 'holo';
  document.body.classList.toggle('cam-on', camOK);
  holodeck.visible = !camOK;
  resize();
  if (withCamera && !camOK) toast('Sin cámara: modo holodeck');
  if (!motionOK) setTimeout(() => toast('Sin sensores: arrastra para mirar'), 1800);
  beginPlay();
}

// WebXR immersive-ar real (Android Chrome / visores). En iPhone Safari no existe: se usa cámara + IMU.
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
  initAudio();
  try {
    const session = await navigator.xr.requestSession('immersive-ar', { optionalFeatures: ['dom-overlay', 'local-floor'], domOverlay: { root: $('app') } });
    renderer.xr.enabled = true;
    renderer.xr.setReferenceSpaceType('local');
    await renderer.xr.setSession(session);
    S.mode = 'xr'; holodeck.visible = false;
    session.addEventListener('end', () => { renderer.xr.enabled = false; S.mode = 'ar'; S.state = 'menu'; show('menu', true); });
    camBase.set(0, 0, 0);
    beginPlay();
  } catch (e) { toast('No se pudo iniciar WebXR'); console.warn(e); }
}

// ---------------- Controles ----------------
function hold(btn, onDown, onUp) {
  btn.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); btn.setPointerCapture?.(e.pointerId); btn.classList.add('active'); onDown(); });
  const up = (e) => { btn.classList.remove('active'); onUp && onUp(); };
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((ev) => btn.addEventListener(ev, up));
}
hold($('btn-fire'), () => { initAudio(); if (S.state === 'playing') { S.firing = true; if (S.fireCd <= 0) playerShoot(); } }, () => (S.firing = false));
hold($('btn-shield'), () => (S.shielding = S.state === 'playing'), () => (S.shielding = false));
hold($('btn-reload'), () => startReload());
hold($('btn-panel'), () => document.body.classList.toggle('panel-open'));

// Tocar la vista AR también dispara (mantener = ráfaga). Sin sensores: arrastrar para mirar.
const touches = new Map();
stage.addEventListener('pointerdown', (e) => {
  if (e.target.closest('.ctl')) return;
  if (document.body.classList.contains('panel-open')) { document.body.classList.remove('panel-open'); return; }
  touches.set(e.pointerId, { x: e.clientX, y: e.clientY, moved: 0 });
  if (aim.has) { S.firing = S.state === 'playing'; if (S.firing && S.fireCd <= 0) playerShoot(); }
});
stage.addEventListener('pointermove', (e) => {
  const t = touches.get(e.pointerId); if (!t || aim.has) return;
  aim.addDrag(e.clientX - t.x, e.clientY - t.y); t.moved += Math.abs(e.clientX - t.x) + Math.abs(e.clientY - t.y); t.x = e.clientX; t.y = e.clientY;
});
const endTouch = (e) => {
  const t = touches.get(e.pointerId); touches.delete(e.pointerId);
  if (!aim.has && t && t.moved < 8 && S.state === 'playing') playerShoot(); // tap sin sensores = un disparo
  if (touches.size === 0 && aim.has) S.firing = false;
};
stage.addEventListener('pointerup', endTouch); stage.addEventListener('pointercancel', endTouch);

// Teclado (para probar en PC): Espacio = fuego, Shift = escudo, R = recargar, P = pausa, flechas = mirar
const keys = new Set();
addEventListener('keydown', (e) => {
  if (e.repeat) return; keys.add(e.code);
  if (e.code === 'Space') { S.firing = S.state === 'playing'; e.preventDefault(); }
  if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') S.shielding = S.state === 'playing';
  if (e.code === 'KeyR') startReload();
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
$('btn-restart').addEventListener('click', () => { initAudio(); beginPlay(); });
$('btn-menu').addEventListener('click', () => { show('over', false); show('menu', true); S.state = 'menu'; updateMenuBest(); });
$('btn-resume').addEventListener('click', () => pause(false));
$('btn-quit').addEventListener('click', () => { show('pause', false); resetGame(); S.state = 'menu'; show('menu', true); updateMenuBest(); });
$('btn-pause').addEventListener('click', () => pause(true));
$('btn-recenter').addEventListener('click', () => { aim.recenter(); toast('RECENTRADO'); });
$('btn-layout').addEventListener('click', () => cycleForcedLayout());
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(true); });

function updateMenuBest() { $('m-best').textContent = S.best ? `Récord: ${S.best.toLocaleString('es-CL')}` : ''; }
updateMenuBest();
checkXR();

// Wake Lock: que la pantalla no se apague a mitad de oleada
let wakeLock = null;
async function requestWakeLock() { try { wakeLock = await navigator.wakeLock?.request('screen'); } catch { /* opcional */ } }
document.addEventListener('visibilitychange', () => { if (!document.hidden && S.state !== 'menu') requestWakeLock(); });

// Instalación PWA (service worker para que abra rápido y funcione offline)
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
// Si ya está instalada, ocultamos las instrucciones
if (matchMedia('(display-mode: standalone)').matches || navigator.standalone) $('install').style.display = 'none';

// Exponer para depurar desde consola
window.__asedio = { S, enemies, camera, spawnEnemy };
