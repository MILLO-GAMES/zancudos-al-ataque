// Efectos de sonido sintetizados con WebAudio (sin archivos de audio, todo original).
let ctx = null, master = null, noiseBuf = null;

export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.6, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
}

function tone(type, f0, f1, dur, vol = 0.3, delay = 0) {
  if (!ctx) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
}
function noise(dur, vol = 0.4, freq = 1200, delay = 0) {
  if (!ctx) return;
  const t = ctx.currentTime + delay;
  const s = ctx.createBufferSource(); s.buffer = noiseBuf;
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(freq, t); f.frequency.exponentialRampToValueAtTime(80, t + dur);
  const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  s.connect(f); f.connect(g); g.connect(master); s.start(t); s.stop(t + dur);
}

export const sfx = {
  shoot: () => { tone('square', 1400, 260, 0.09, 0.12); tone('sine', 2600, 900, 0.05, 0.06); },
  hit: () => tone('triangle', 900, 1800, 0.06, 0.15),
  explode: () => { noise(0.5, 0.5, 2400); tone('sawtooth', 180, 40, 0.4, 0.15); },
  enemyShot: () => tone('sine', 300, 900, 0.18, 0.12),
  charge: () => tone('sine', 500, 1500, 0.4, 0.05),
  block: () => { tone('sine', 1800, 2400, 0.12, 0.2); tone('triangle', 3600, 3000, 0.1, 0.08); },
  hurt: () => { tone('sawtooth', 160, 60, 0.35, 0.3); noise(0.25, 0.3, 600); },
  reload: () => { tone('square', 300, 300, 0.04, 0.08); tone('square', 600, 600, 0.04, 0.08, 0.5); },
  empty: () => tone('square', 120, 100, 0.05, 0.08),
  wave: () => [523, 659, 784, 1046].forEach((f, i) => tone('triangle', f, f, 0.16, 0.14, i * 0.09)),
  over: () => [400, 300, 200, 120].forEach((f, i) => tone('sawtooth', f, f * 0.8, 0.3, 0.15, i * 0.18)),
  shieldOn: () => tone('sine', 400, 1200, 0.15, 0.08),
};
