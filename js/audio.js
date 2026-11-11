// ==========================================================
// Audio de ¡Zancudos al Ataque!: todo sintetizado con WebAudio (sin archivos con licencia).
// - Desbloqueo para iOS Safari / PWA: el AudioContext se crea y se reanuda DENTRO del toque,
//   se toca un buffer silencioso, se pide navigator.audioSession.type = 'playback' (iOS 17+)
//   y se reproduce en loop un <audio> HTML silencioso, que pone la sesión en "playback"
//   para que el interruptor de silencio del iPhone no apague el juego.
// - Dos buses: música y efectos, con volumen propio guardado en localStorage.
// - Música: secuenciador propio estilo surf/caricatura de los 60 (bajo boogie, guitarra twang,
//   órgano, batería), con tema de menú, tema de juego que sube con la oleada y con las picadas,
//   y jingles de oleada superada y de fin.
// ==========================================================
let ctx = null, master = null, sfxBus = null, musicBus = null, musicDuck = null, analyser = null, noiseBuf = null, echo = null;
let htmlAudio = null;
const LS = (k, d) => { const v = localStorage.getItem(k); return v == null ? d : +v; };
const vol = { on: localStorage.getItem('an-sound') !== 'off', music: LS('an-music', 0.6), sfx: LS('an-sfx', 0.9) };

function silentWavUrl() {
  // 0,5 s de silencio, PCM 16 bits mono 22 kHz (generado aquí, no es un archivo externo)
  const n = 11025, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
  const w = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true);
  v.setUint16(22, 1, true); v.setUint32(24, 22050, true); v.setUint32(28, 44100, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  w(36, 'data'); v.setUint32(40, n * 2, true);
  return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
}

/** Debe llamarse SINCRÓNICAMENTE dentro de un toque/clic (antes de cualquier await). */
export function unlockAudio() {
  try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch { /* iOS < 17 */ }
  if (!htmlAudio) {
    htmlAudio = new Audio(silentWavUrl()); htmlAudio.loop = true; htmlAudio.preload = 'auto';
    htmlAudio.setAttribute('playsinline', ''); htmlAudio.setAttribute('webkit-playsinline', ''); htmlAudio.volume = 0.01;
  }
  if (htmlAudio.paused) htmlAudio.play().catch(() => {});
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { ctx = new AC({ latencyHint: 'interactive' }); } catch { ctx = new AC(); }
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; comp.attack.value = 0.003; comp.release.value = 0.2;
    master = ctx.createGain(); master.gain.value = vol.on ? 0.9 : 0;
    analyser = ctx.createAnalyser(); analyser.fftSize = 1024;
    master.connect(comp); comp.connect(analyser); analyser.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.gain.value = vol.sfx; sfxBus.connect(master);
    musicDuck = ctx.createGain(); musicDuck.connect(master);
    musicBus = ctx.createGain(); musicBus.gain.value = vol.music * 0.55; musicBus.connect(musicDuck);
    // "reverb de resorte" barata: eco corto con realimentación, solo para la música (sabor surf)
    echo = ctx.createDelay(0.5); echo.delayTime.value = 0.13;
    const fb = ctx.createGain(); fb.gain.value = 0.28; const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600;
    const wet = ctx.createGain(); wet.gain.value = 0.35;
    echo.connect(lp); lp.connect(fb); fb.connect(echo); lp.connect(wet); wet.connect(musicBus);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 1.0, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  resumeAudio();
  // buffer silencioso: algunos iOS solo "despiertan" al reproducir algo dentro del gesto
  try { const b = ctx.createBuffer(1, 1, 22050), s = ctx.createBufferSource(); s.buffer = b; s.connect(ctx.destination); s.start(0); } catch { /* nada */ }
}
export const initAudio = unlockAudio;
/** Reanuda si iOS lo dejó 'suspended' o 'interrupted' (llamadas, cámara, cambio de app). */
export function resumeAudio() {
  if (htmlAudio && htmlAudio.paused && ctx) htmlAudio.play().catch(() => {});
  if (ctx && ctx.state !== 'running' && ctx.state !== 'closed') ctx.resume().catch(() => {});
}
export const audioReady = () => !!ctx && ctx.state === 'running';
export const audioState = () => (ctx ? ctx.state : 'sin crear');
/** Nivel RMS actual de la salida (para pruebas). */
export function outputLevel() {
  if (!analyser) return 0; const a = new Float32Array(analyser.fftSize); analyser.getFloatTimeDomainData(a);
  let s = 0; for (const x of a) s += x * x; return Math.sqrt(s / a.length);
}
export function getVolumes() { return { ...vol }; }
export function setSound(on) {
  vol.on = on; localStorage.setItem('an-sound', on ? 'on' : 'off');
  if (master) master.gain.setTargetAtTime(on ? 0.9 : 0, ctx.currentTime, 0.03);
}
export function setMusicVolume(v) { vol.music = v; localStorage.setItem('an-music', v); if (musicBus) musicBus.gain.setTargetAtTime(v * 0.55, ctx.currentTime, 0.05); }
export function setSfxVolume(v) { vol.sfx = v; localStorage.setItem('an-sfx', v); if (sfxBus) sfxBus.gain.setTargetAtTime(v, ctx.currentTime, 0.05); }
/** Baja la música un momento para que un efecto se escuche claro. */
function duck(amount, dur) {
  if (!musicDuck) return; const t = ctx.currentTime;
  musicDuck.gain.cancelScheduledValues(t); musicDuck.gain.setTargetAtTime(1 - amount, t, 0.02); musicDuck.gain.setTargetAtTime(1, t + dur, 0.15);
}

function tone(type, f0, f1, dur, vol = 0.3, delay = 0, dest) {
  if (!ctx) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(dest || sfxBus); o.start(t); o.stop(t + dur + 0.03);
  return o;
}
function noise(dur, vol = 0.4, freq = 1200, delay = 0, type = 'lowpass', q = 0.8, fEnd = 80) {
  if (!ctx) return;
  const t = ctx.currentTime + delay;
  const s = ctx.createBufferSource(); s.buffer = noiseBuf;
  const f = ctx.createBiquadFilter(); f.type = type; f.Q.value = q; f.frequency.setValueAtTime(freq, t); f.frequency.exponentialRampToValueAtTime(fEnd, t + dur);
  const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  s.connect(f); f.connect(g); g.connect(sfxBus); s.start(t, Math.random() * 0.3); s.stop(t + dur + 0.02);
}

// ==================== MÚSICA ====================
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const _ = null;
// Progresión I–vi–IV–V en Do (C, Am, F, G) y vuelta con ii–V (Dm, G) en la segunda mitad.
const CHORDS = [[48, 'M'], [45, 'm'], [41, 'M'], [43, 'M'], [48, 'M'], [45, 'm'], [38, 'm'], [43, 'M']];
// Bajo "boogie" en corcheas: fundamental, 3ª, 5ª, 6ª, 8ª, 6ª, 5ª, 3ª
const BOOGIE = { M: [0, 4, 7, 9, 12, 9, 7, 4], m: [0, 3, 7, 9, 12, 9, 7, 3] };
// Melodía pegadiza (semicorcheas, 16 por compás). MIDI; _ = silencio.
const LEAD_A = [
  [76, _, 79, _, 81, 79, 76, _, 72, _, 74, 76, _, _, _, _],
  [72, _, 76, _, 81, _, 79, 76, _, _, 74, _, 72, _, 69, _],
  [77, _, 81, _, 84, _, 81, 77, _, _, 79, 81, _, 79, 77, _],
  [74, _, 79, _, 83, _, 81, 79, _, 77, 76, 74, _, 71, _, _],
];
const LEAD_B = [
  [84, 84, _, 81, _, 79, _, 76, 79, _, 81, _, 84, _, _, _],
  [81, 81, _, 79, _, 76, _, 72, 76, _, 79, _, 81, _, _, _],
  [74, _, 77, _, 81, _, 77, _, 74, _, 72, _, 74, 77, _, _],
  [79, _, 83, _, 86, _, 83, 79, 77, 76, 74, 71, 72, _, _, _],
];
const MENU_LEAD = [
  [76, _, _, _, 79, _, _, _, 81, _, 79, _, 76, _, _, _],
  [72, _, _, _, 76, _, _, _, 79, _, 76, _, 72, _, _, _],
  [77, _, _, _, 81, _, _, _, 84, _, 81, _, 77, _, _, _],
  [79, _, _, _, 83, _, _, _, 79, _, 77, _, 74, _, _, _],
];
const music = { mode: null, bpm: 120, step: 0, next: 0, timer: 0, tension: 0, wave: 1, jingleUntil: 0 };

function mNote(type, freq, t, dur, v, opts = {}) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (opts.slide) o.frequency.exponentialRampToValueAtTime(freq * opts.slide, t + dur);
  if (opts.vib) { const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = opts.vib; lg.gain.value = freq * 0.012; l.connect(lg); lg.connect(o.frequency); l.start(t + 0.06); l.stop(t + dur + 0.05); }
  let out = g;
  if (opts.lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(opts.lp, t); if (opts.lpEnd) f.frequency.exponentialRampToValueAtTime(opts.lpEnd, t + dur); f.Q.value = opts.q || 1; g.connect(f); out = f; }
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + (opts.att || 0.005));
  if (opts.sustain) g.gain.setValueAtTime(v, t + dur * 0.7);
  g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
  o.connect(g); out.connect(musicBus); if (opts.echo) out.connect(echo);
  o.start(t); o.stop(t + dur + 0.05);
}
function mNoise(t, dur, v, type, freq, q = 1) {
  const s = ctx.createBufferSource(); s.buffer = noiseBuf;
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = ctx.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
  s.connect(f); f.connect(g); g.connect(musicBus); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
}
const kick = (t, v = 0.9) => mNote('sine', 150, t, 0.22, v, { slide: 0.3 });
const snare = (t, v = 0.45) => { mNoise(t, 0.16, v, 'bandpass', 1800, 0.7); mNote('triangle', 220, t, 0.08, v * 0.5, { slide: 0.6 }); };
const hat = (t, v = 0.12, open) => mNoise(t, open ? 0.18 : 0.04, v, 'highpass', 7000);

function scheduleStep(i, t) {
  const sp = 60 / music.bpm / 4; // duración de una semicorchea
  const bar = Math.floor(i / 16) % 8, s = i % 16;
  const [root, q] = CHORDS[bar];
  const menu = music.mode === 'menu';
  const inten = menu ? 0 : Math.min(1, (music.wave - 1) / 6);
  const ten = menu ? 0 : music.tension;
  // Batería
  if (!menu || bar >= 4) {
    if (s === 0 || s === 8 || (!menu && (s === 10 || (inten > 0.3 && s === 14)))) kick(t, menu ? 0.5 : 0.85);
    if (s === 4 || s === 12) snare(t, menu ? 0.25 : 0.42);
    if (!menu && bar === 7 && s >= 12) snare(t, 0.22 + (s - 12) * 0.05); // redoble surf al final de la vuelta
  }
  if (s % 2 === 0 || (!menu && (inten > 0.5 || ten > 0.3))) hat(t, s % 4 === 2 ? 0.14 : 0.08, s === 14 && !menu);
  // Bajo boogie (corcheas), con "slap" corto
  if (s % 2 === 0) {
    const n = root + BOOGIE[q][s / 2];
    mNote('square', mtof(n - 12), t, sp * 1.8, menu ? 0.14 : 0.2, { lp: 900, lpEnd: 300, q: 2 });
    mNote('triangle', mtof(n - 12), t, sp * 1.9, menu ? 0.2 : 0.28);
  }
  // Órgano de acorde a contratiempo ("chank")
  if (s === 2 || s === 6 || s === 10 || s === 14) {
    const third = q === 'M' ? 4 : 3;
    for (const iv of [12, 12 + third, 19]) mNote('sawtooth', mtof(root + iv), t, sp * 1.2, menu ? 0.025 : 0.035, { lp: 1800, att: 0.004 });
  }
  // Melodía: guitarra surf (pulso con vibrato + eco)
  const half = Math.floor(i / 64) % 2; // cada 2 vueltas alterna A/B
  const L = menu ? MENU_LEAD : (half && inten > 0.15 ? LEAD_B : LEAD_A);
  const m = L[bar % 4][s];
  if (m) mNote('square', mtof(m), t, sp * (menu ? 3.5 : 2.2), menu ? 0.07 : 0.085, { vib: 6, lp: 3200, echo: true, att: 0.004 });
  // Tensión (picada): arpegio agudo nervioso + "sirena" de theremin cómico
  if (ten > 0.05 && s % 1 === 0) {
    const arp = [0, q === 'M' ? 4 : 3, 7, 12][s % 4];
    mNote('square', mtof(root + 36 + arp), t, sp * 0.8, 0.03 * ten, { lp: 4000 });
  }
  if (ten > 0.4 && s === 0) mNote('sine', mtof(root + 31), t, sp * 14, 0.05 * ten, { vib: 5.5, att: 0.2, sustain: true, slide: 1.06 });
}
function tick() {
  if (!ctx || !music.mode) return;
  const sp = 60 / music.bpm / 4;
  if (music.next < ctx.currentTime) music.next = ctx.currentTime + 0.05;
  while (music.next < ctx.currentTime + 0.15) {
    if (music.next >= music.jingleUntil) scheduleStep(music.step, music.next);
    music.step++; music.next += sp;
  }
}
export const musicCtl = {
  /** 'menu' | 'game' | null */
  play(mode) {
    if (!ctx) return;
    if (music.mode === mode) return;
    music.mode = mode; music.step = 0; music.next = ctx.currentTime + 0.08;
    music.bpm = mode === 'menu' ? 112 : 132;
    clearInterval(music.timer); if (mode) music.timer = setInterval(tick, 25);
  },
  /** La oleada sube el tempo (132 → 168 bpm) y la intensidad. */
  setWave(w) { music.wave = w; if (music.mode === 'game') music.bpm = Math.min(168, 128 + w * 5); },
  /** 0..1: cuánto peligro hay ahora (picadas). */
  setTension(x) { music.tension += (x - music.tension) * 0.1; },
  jingle(kind) {
    if (!ctx) return;
    const t = ctx.currentTime + 0.05;
    if (kind === 'wave') { // "¡ta-ra-ra-taaan!" de oleada superada
      [[72, 0], [76, 0.12], [79, 0.24], [84, 0.36]].forEach(([n, d]) => { mNote('square', mtof(n), t + d, 0.3, 0.09, { vib: 6, echo: true }); mNote('triangle', mtof(n - 24), t + d, 0.25, 0.2); });
      for (const n of [72, 76, 79, 84]) mNote('sawtooth', mtof(n), t + 0.5, 0.7, 0.03, { lp: 2400, sustain: true });
      kick(t + 0.5, 0.7); mNoise(t + 0.5, 0.5, 0.15, 'highpass', 6000);
      music.jingleUntil = t + 1.3;
    } else if (kind === 'over') { // "wah wah wah waaah" de trombón de caricatura
      [[67, 0, 0.35], [66, 0.42, 0.35], [65, 0.84, 0.35], [64, 1.26, 1.2]].forEach(([n, d, len]) =>
        mNote('sawtooth', mtof(n - 12), t + d, len, 0.16, { lp: 900, lpEnd: 500, vib: d > 1 ? 5 : 0, att: 0.04, sustain: true, q: 3 }));
      music.jingleUntil = t + 2.8;
    }
  },
  get state() { return { ...music, timer: undefined }; },
};

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
  o.connect(bp); o2.connect(mix2); mix2.connect(bp); bp.connect(g); g.connect(p); p.connect(sfxBus);
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
  s.connect(hp); hp.connect(pk); pk.connect(g); g.connect(sfxBus); s.start(t);
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
    duck(0.5, 0.5);
    tone('sine', 520, 90, 0.16, 0.35);
    if (!ctx) return;
    const t = ctx.currentTime + 0.1;
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'triangle';
    o.frequency.setValueAtTime(180, t); o.frequency.exponentialRampToValueAtTime(420, t + 0.12); o.frequency.exponentialRampToValueAtTime(140, t + 0.45);
    const vib = ctx.createOscillator(), vg = ctx.createGain(); vib.frequency.value = 18; vg.gain.value = 40; vib.connect(vg); vg.connect(o.frequency);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.25, t + 0.02); g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    o.connect(g); g.connect(sfxBus); o.start(t); vib.start(t); o.stop(t + 0.55); vib.stop(t + 0.55);
  },
  // tos chistosa: "kof kof" (ruido con filtro de banda + golpe de tono)
  cough: () => {
    for (const d of [0, 0.17]) { noise(0.12, 0.5, 900, d, 'bandpass', 2.5, 500); tone('sawtooth', 340, 200, 0.08, 0.1, d); }
  },
  // "¡auch!" cuando te pican: vocal "au" con formantes + "ch"
  ouch: () => {
    if (!ctx) return; duck(0.4, 0.6);
    const t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(260, t); o.frequency.linearRampToValueAtTime(330, t + 0.08); o.frequency.exponentialRampToValueAtTime(190, t + 0.32);
    const f1 = ctx.createBiquadFilter(); f1.type = 'bandpass'; f1.Q.value = 5; f1.frequency.setValueAtTime(800, t); f1.frequency.linearRampToValueAtTime(380, t + 0.3);
    const f2 = ctx.createBiquadFilter(); f2.type = 'bandpass'; f2.Q.value = 6; f2.frequency.setValueAtTime(1250, t); f2.frequency.linearRampToValueAtTime(800, t + 0.3);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.7, t + 0.03); g.gain.exponentialRampToValueAtTime(0.001, t + 0.34);
    o.connect(f1); o.connect(f2); f1.connect(g); f2.connect(g); g.connect(sfxBus); o.start(t); o.stop(t + 0.36);
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
