// Efectos de sonido sintetizados con WebAudio (sin archivos de audio, todo original).
// Zumbidos por zancudo con paneo y volumen según distancia, spray "pssst", "plop/boing", tos y "¡auch!".
let ctx = null, master = null, noiseBuf = null;

export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain(); master.gain.value = 0.55; master.connect(ctx.destination);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 1.0, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
}
export const audioReady = () => !!ctx;

function tone(type, f0, f1, dur, vol = 0.3, delay = 0, dest) {
  if (!ctx) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(dest || master); o.start(t); o.stop(t + dur + 0.03);
  return o;
}
function noise(dur, vol = 0.4, freq = 1200, delay = 0, type = 'lowpass', q = 0.8, fEnd = 80) {
  if (!ctx) return;
  const t = ctx.currentTime + delay;
  const s = ctx.createBufferSource(); s.buffer = noiseBuf;
  const f = ctx.createBiquadFilter(); f.type = type; f.Q.value = q; f.frequency.setValueAtTime(freq, t); f.frequency.exponentialRampToValueAtTime(fEnd, t + dur);
  const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  s.connect(f); f.connect(g); g.connect(master); s.start(t, Math.random() * 0.3); s.stop(t + dur + 0.02);
}
/** Paneo estéreo con respaldo si el navegador no tiene StereoPanner. */
function makePanner() {
  if (ctx.createStereoPanner) return ctx.createStereoPanner();
  const g = ctx.createGain(); g.pan = { value: 0, setTargetAtTime() {} }; return g;
}

/** Zumbido continuo de un zancudo: sierra + vibrato + filtro de banda. */
export function createBuzz(pitch = 1) {
  if (!ctx) return null;
  const base = 330 * pitch * (0.92 + Math.random() * 0.16);
  const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = base;
  const o2 = ctx.createOscillator(); o2.type = 'square'; o2.frequency.value = base * 2.01;
  const lfo = ctx.createOscillator(); lfo.frequency.value = 7 + Math.random() * 5;
  const lfoG = ctx.createGain(); lfoG.gain.value = base * 0.035; lfo.connect(lfoG); lfoG.connect(o.frequency); lfoG.connect(o2.frequency);
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = base * 2.4; bp.Q.value = 1.6;
  const mix2 = ctx.createGain(); mix2.gain.value = 0.25;
  const g = ctx.createGain(); g.gain.value = 0;
  const p = makePanner();
  o.connect(bp); o2.connect(mix2); mix2.connect(bp); bp.connect(g); g.connect(p); p.connect(master);
  const t = ctx.currentTime; o.start(t); o2.start(t); lfo.start(t);
  let dead = false;
  return {
    /** vol 0..1, pan -1..1, bend multiplica el tono (picada = sube). */
    set(vol, pan, bend = 1) {
      if (dead) return; const now = ctx.currentTime;
      g.gain.setTargetAtTime(vol * 0.11, now, 0.06);
      p.pan.setTargetAtTime(Math.max(-1, Math.min(1, pan)), now, 0.06);
      o.frequency.setTargetAtTime(base * bend, now, 0.08); o2.frequency.setTargetAtTime(base * 2.01 * bend, now, 0.08);
      bp.frequency.setTargetAtTime(base * 2.4 * bend, now, 0.08);
    },
    stop() {
      if (dead) return; dead = true; const now = ctx.currentTime;
      g.gain.setTargetAtTime(0, now, 0.03);
      [o, o2, lfo].forEach((x) => x.stop(now + 0.2));
    },
  };
}

// Spray continuo mientras se mantiene el botón: "pssssst"
let spray = null;
export function sprayStart() {
  if (!ctx || spray) return;
  const t = ctx.currentTime;
  const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
  const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2600;
  const pk = ctx.createBiquadFilter(); pk.type = 'peaking'; pk.frequency.value = 6000; pk.gain.value = 8;
  const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.32, t + 0.04); g.gain.setTargetAtTime(0.2, t + 0.08, 0.15);
  s.connect(hp); hp.connect(pk); pk.connect(g); g.connect(master); s.start(t);
  tone('square', 2400, 1800, 0.03, 0.05); // "clic" de la válvula
  spray = { s, g };
}
export function sprayStop() {
  if (!spray) return; const t = ctx.currentTime;
  spray.g.gain.cancelScheduledValues(t); spray.g.gain.setTargetAtTime(0, t, 0.04); spray.s.stop(t + 0.25); spray = null;
}

export const sfx = {
  // "plop" + "boing" cómico al caer el zancudo
  plop: () => {
    tone('sine', 520, 90, 0.16, 0.35);
    if (!ctx) return;
    const t = ctx.currentTime + 0.1;
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'triangle';
    o.frequency.setValueAtTime(180, t); o.frequency.exponentialRampToValueAtTime(420, t + 0.12); o.frequency.exponentialRampToValueAtTime(140, t + 0.45);
    const vib = ctx.createOscillator(), vg = ctx.createGain(); vib.frequency.value = 18; vg.gain.value = 40; vib.connect(vg); vg.connect(o.frequency);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.25, t + 0.02); g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    o.connect(g); g.connect(master); o.start(t); vib.start(t); o.stop(t + 0.55); vib.stop(t + 0.55);
  },
  // tos chistosa: "kof kof" (ruido con filtro de banda + golpe de tono)
  cough: () => {
    for (const d of [0, 0.17]) { noise(0.12, 0.5, 900, d, 'bandpass', 2.5, 500); tone('sawtooth', 340, 200, 0.08, 0.1, d); }
  },
  // "¡auch!" cuando te pican: vocal "au" con formantes + "ch"
  ouch: () => {
    if (!ctx) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(260, t); o.frequency.linearRampToValueAtTime(330, t + 0.08); o.frequency.exponentialRampToValueAtTime(190, t + 0.32);
    const f1 = ctx.createBiquadFilter(); f1.type = 'bandpass'; f1.Q.value = 5; f1.frequency.setValueAtTime(800, t); f1.frequency.linearRampToValueAtTime(380, t + 0.3);
    const f2 = ctx.createBiquadFilter(); f2.type = 'bandpass'; f2.Q.value = 6; f2.frequency.setValueAtTime(1250, t); f2.frequency.linearRampToValueAtTime(800, t + 0.3);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.7, t + 0.03); g.gain.exponentialRampToValueAtTime(0.001, t + 0.34);
    o.connect(f1); o.connect(f2); f1.connect(g); f2.connect(g); g.connect(master); o.start(t); o.stop(t + 0.36);
    noise(0.12, 0.25, 3500, 0.3, 'highpass', 0.7, 2500);
  },
  hit: () => tone('triangle', 900, 1500, 0.05, 0.1),
  warn: () => { tone('sine', 700, 1400, 0.25, 0.06); },
  swat: () => { noise(0.09, 0.6, 1800, 0, 'lowpass', 0.8, 300); tone('sine', 220, 90, 0.1, 0.3); },
  shake: () => { [0, 0.12, 0.24, 0.36].forEach((d) => noise(0.06, 0.25, 4000, d, 'bandpass', 3, 2500)); tone('triangle', 1400, 1400, 0.03, 0.06, 0.5); },
  empty: () => tone('square', 160, 120, 0.06, 0.06),
  perch: () => { tone('triangle', 1500, 1500, 0.03, 0.08); tone('triangle', 1800, 1800, 0.03, 0.08, 0.08); },
  spot: () => [880, 1320].forEach((f, i) => tone('sine', f, f, 0.1, 0.08, i * 0.08)),
  wave: () => [523, 659, 784, 1046].forEach((f, i) => tone('triangle', f, f, 0.16, 0.12, i * 0.09)),
  over: () => [500, 400, 300, 160].forEach((f, i) => tone('triangle', f, f * 0.85, 0.3, 0.14, i * 0.18)),
  shieldOn: () => tone('sine', 300, 700, 0.12, 0.06),
};
