// ==========================================================
// Sensores: cámara trasera (fondo real) + orientación del dispositivo (apuntar girando).
// iOS exige: HTTPS + gesto del usuario + DeviceOrientationEvent.requestPermission().
// ==========================================================
import * as THREE from '../vendor/three.module.min.js';

const DEG = Math.PI / 180;
const zee = new THREE.Vector3(0, 0, 1);
const euler = new THREE.Euler();
const q0 = new THREE.Quaternion();
const q1 = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5)); // -90° en X: cámara mira "hacia afuera" de la pantalla

/** Pide permiso de movimiento/orientación (iOS 13+). Debe llamarse dentro de un toque. */
export function requestMotionPermission() {
  const reqs = [];
  if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function')
    reqs.push(DeviceOrientationEvent.requestPermission());
  if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function')
    reqs.push(DeviceMotionEvent.requestPermission().catch(() => 'denied'));
  if (!reqs.length) return Promise.resolve(true);
  return Promise.all(reqs).then((r) => r[0] === 'granted').catch(() => false);
}

/** Enciende la cámara trasera en el <video>. Devuelve true si hay imagen. */
export async function startCamera(video) {
  if (!navigator.mediaDevices?.getUserMedia) return false;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
    });
    video.srcObject = stream;
    await video.play().catch(() => {});
    return true;
  } catch (e) {
    console.warn('Cámara no disponible', e);
    return false;
  }
}
export function stopCamera(video) {
  const s = video.srcObject; if (s) s.getTracks().forEach((t) => t.stop()); video.srcObject = null;
}

/**
 * Controla la cámara 3D con la orientación del teléfono (como estar parado al centro de la arena).
 * Si no hay sensor (PC), cae a arrastrar con el dedo/mouse.
 */
export class AimController {
  constructor(camera, dom) {
    this.camera = camera;
    this.dom = dom;
    this.has = false;          // ¿llegan datos reales de orientación?
    this.ev = null;
    this.yawOffset = 0;
    this.qDev = new THREE.Quaternion();
    this.qTarget = new THREE.Quaternion();
    this.qYaw = new THREE.Quaternion();
    this.dragYaw = 0; this.dragPitch = 0;
    this._needRecenter = true;
    this._onOri = (e) => {
      if (e.alpha == null && e.beta == null) return;
      this.ev = e; this.has = true;
    };
    window.addEventListener('deviceorientation', this._onOri);
  }
  screenAngle() {
    const a = (screen.orientation && screen.orientation.angle) ?? window.orientation ?? 0;
    return a * DEG;
  }
  /** Gira el mundo para que lo que tienes al frente sea "el norte" de la arena. */
  recenter() { this._needRecenter = true; this.dragYaw = 0; this.dragPitch = 0; }
  addDrag(dx, dy) {
    this.dragYaw -= dx * 0.005;
    this.dragPitch = Math.max(-1.3, Math.min(1.3, this.dragPitch - dy * 0.005));
  }
  update() {
    if (this.has && this.ev) {
      const { alpha, beta, gamma } = this.ev;
      euler.set((beta || 0) * DEG, (alpha || 0) * DEG, -(gamma || 0) * DEG, 'YXZ');
      this.qDev.setFromEuler(euler);
      this.qDev.multiply(q1);
      this.qDev.multiply(q0.setFromAxisAngle(zee, -this.screenAngle()));
      if (this._needRecenter) {
        const f = new THREE.Vector3(0, 0, -1).applyQuaternion(this.qDev);
        this.yawOffset = -Math.atan2(-f.x, -f.z);
        this._needRecenter = false;
        this.qYaw.setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.yawOffset);
        this.camera.quaternion.copy(this.qYaw).multiply(this.qDev);
        return;
      }
      this.qYaw.setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.yawOffset);
      this.qTarget.copy(this.qYaw).multiply(this.qDev);
      // suavizado leve para quitar temblor del giroscopio sin meter lag
      this.camera.quaternion.slerp(this.qTarget, 0.55);
    } else {
      this.camera.rotation.set(this.dragPitch, this.dragYaw, 0, 'YXZ');
    }
  }
}

/**
 * FOV vertical que calza con la cámara real recortada con object-fit: cover.
 * Supone ~69° en el lado largo del sensor (cámara principal de iPhone).
 */
export function matchCameraFov(video, el) {
  const vw = video.videoWidth, vh = video.videoHeight;
  const ew = el.clientWidth, eh = el.clientHeight;
  if (!vw || !vh || !ew || !eh) return null;
  const tLong = Math.tan(34.5 * DEG);
  let tw, th;
  if (vw >= vh) { tw = tLong; th = tLong * vh / vw; } else { th = tLong; tw = tLong * vw / vh; }
  const scale = Math.max(ew / vw, eh / vh);
  const frac = eh / (vh * scale);
  return 2 * Math.atan(th * frac) / DEG;
}
