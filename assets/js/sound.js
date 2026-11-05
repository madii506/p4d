// p4d sound: a calm ambient loop and a few soft machine sounds for the intro, all synthesized in the browser (no files).
// Nothing plays until the visitor presses "boot"; the ♪ button mutes it, and the choice is remembered.
const KEY = 'p4d.sound';
let ctx = null, master = null, musicBus = null, sfxBus = null, verb = null, timer = 0, nextT = 0, step = 0, on = true;
try { on = localStorage.getItem(KEY) !== 'off'; } catch {}

function impulse(sec = 3.2) {
  const n = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(2, n, ctx.sampleRate);
  for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2.6); }
  return b;
}
function noiseBuf(sec = 1) { const n = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; return b; }
const hz = m => 440 * Math.pow(2, (m - 69) / 12);

function init() {
  if (ctx) return true;
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return false;
  ctx = new AC();
  master = ctx.createGain(); master.gain.value = 0;
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 3;
  master.connect(comp).connect(ctx.destination);
  verb = ctx.createConvolver(); verb.buffer = impulse(); const wet = ctx.createGain(); wet.gain.value = .55; verb.connect(wet).connect(master);
  musicBus = ctx.createGain(); musicBus.gain.value = .0; musicBus.connect(master); musicBus.connect(verb);
  sfxBus = ctx.createGain(); sfxBus.gain.value = .5; sfxBus.connect(master); sfxBus.connect(verb);
  return true;
}

// ---------------------------------------------------------------- music: slow chords, a soft sub, a few music-box notes
// Fmaj9 → Am7 → Dm9 → Cmaj7/E, about 5.6 s per chord
const CHORDS = [[53, 57, 60, 64, 67], [57, 60, 64, 67, 71], [50, 53, 57, 60, 64], [52, 55, 59, 60, 67]];
const BELLS = [72, 74, 76, 79, 81, 84, 86, 88];
const BAR = 5.6;
function padVoice(m, t, dur) {
  const o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), f = ctx.createBiquadFilter(), gn = ctx.createGain();
  o1.type = 'triangle'; o2.type = 'sawtooth'; o1.frequency.value = hz(m); o2.frequency.value = hz(m); o2.detune.value = 7;
  const g2 = ctx.createGain(); g2.gain.value = .18;
  f.type = 'lowpass'; f.frequency.setValueAtTime(500, t); f.frequency.linearRampToValueAtTime(1100, t + dur * .5); f.frequency.linearRampToValueAtTime(600, t + dur); f.Q.value = .4;
  gn.gain.setValueAtTime(0, t); gn.gain.linearRampToValueAtTime(.05, t + 1.8); gn.gain.setValueAtTime(.05, t + dur - .4); gn.gain.linearRampToValueAtTime(0, t + dur + 1.6);
  o1.connect(f); o2.connect(g2).connect(f); f.connect(gn).connect(musicBus);
  o1.start(t); o2.start(t); o1.stop(t + dur + 1.8); o2.stop(t + dur + 1.8);
}
function sub(m, t, dur) {
  const o = ctx.createOscillator(), gn = ctx.createGain(); o.type = 'sine'; o.frequency.value = hz(m - 12);
  gn.gain.setValueAtTime(0, t); gn.gain.linearRampToValueAtTime(.09, t + 1.2); gn.gain.linearRampToValueAtTime(0, t + dur + 1); o.connect(gn).connect(musicBus); o.start(t); o.stop(t + dur + 1.1);
}
function bell(m, t, v = .05) {
  const o = ctx.createOscillator(), o2 = ctx.createOscillator(), gn = ctx.createGain(); o.type = 'sine'; o2.type = 'sine'; o.frequency.value = hz(m); o2.frequency.value = hz(m) * 2.01;
  const g2 = ctx.createGain(); g2.gain.value = .25;
  gn.gain.setValueAtTime(0, t); gn.gain.linearRampToValueAtTime(v, t + .012); gn.gain.exponentialRampToValueAtTime(.0005, t + 2.4);
  o.connect(gn); o2.connect(g2).connect(gn); gn.connect(musicBus); o.start(t); o2.start(t); o.stop(t + 2.5); o2.stop(t + 2.5);
}
function schedule() {
  while (nextT < ctx.currentTime + 1.5) {
    const ch = CHORDS[step % CHORDS.length];
    ch.forEach(m => padVoice(m, nextT, BAR)); sub(ch[0], nextT, BAR);
    // a sparse music-box line: 4–6 notes per bar on a slow eighth grid
    const grid = BAR / 8; for (let i = 0; i < 8; i++) if (Math.random() < (i % 2 ? .35 : .6)) { const pool = BELLS.filter(b => ch.some(c => (b - c) % 12 === 0) || Math.random() < .3); bell(pool[Math.floor(Math.random() * pool.length)] || 76, nextT + i * grid + Math.random() * .03, .03 + Math.random() * .025); }
    nextT += BAR; step++;
  }
}
function startMusic() {
  if (timer) return; nextT = ctx.currentTime + .1; step = 0; schedule(); timer = setInterval(schedule, 400);
  musicBus.gain.cancelScheduledValues(ctx.currentTime); musicBus.gain.setValueAtTime(musicBus.gain.value, ctx.currentTime); musicBus.gain.linearRampToValueAtTime(1, ctx.currentTime + 5);
}

// ---------------------------------------------------------------- machine sounds for the intro
function noise(t, dur, { type = 'bandpass', f0 = 1200, f1 = f0, q = 1, v = .2, a = .005 } = {}) {
  const s = ctx.createBufferSource(); s.buffer = noiseBuf(dur + .1); const f = ctx.createBiquadFilter(), gn = ctx.createGain();
  f.type = type; f.Q.value = q; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t + dur);
  gn.gain.setValueAtTime(0, t); gn.gain.linearRampToValueAtTime(v, t + a); gn.gain.exponentialRampToValueAtTime(.0005, t + dur);
  s.connect(f).connect(gn).connect(sfxBus); s.start(t); s.stop(t + dur + .05);
}
function thump(t, f0 = 90, f1 = 40, dur = .35, v = .35) {
  const o = ctx.createOscillator(), gn = ctx.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  gn.gain.setValueAtTime(0, t); gn.gain.linearRampToValueAtTime(v, t + .01); gn.gain.exponentialRampToValueAtTime(.0005, t + dur); o.connect(gn).connect(sfxBus); o.start(t); o.stop(t + dur + .05);
}
function tone(t, f, dur, v = .06, type = 'sine') { const o = ctx.createOscillator(), gn = ctx.createGain(); o.type = type; o.frequency.value = f; gn.gain.setValueAtTime(0, t); gn.gain.linearRampToValueAtTime(v, t + .01); gn.gain.exponentialRampToValueAtTime(.0005, t + dur); o.connect(gn).connect(sfxBus); o.start(t); o.stop(t + dur + .05); }
const SFX = {
  light1: t => { thump(t, 70, 38, .5, .28); noise(t, .08, { type: 'highpass', f0: 3000, v: .05 }); },
  light2: t => { thump(t, 80, 42, .4, .2); noise(t, .06, { type: 'highpass', f0: 3500, v: .04 }); },
  light3: t => { thump(t, 90, 46, .4, .18); noise(t, .06, { type: 'highpass', f0: 4000, v: .04 }); },
  floppy: t => noise(t, 1.6, { type: 'bandpass', f0: 300, f1: 1400, q: .7, v: .06, a: .9 }),
  insert: t => { noise(t, .05, { type: 'highpass', f0: 2500, v: .18 }); noise(t + .09, .07, { type: 'bandpass', f0: 1600, q: 2, v: .16 }); thump(t + .09, 160, 70, .16, .2); },
  drive: t => { for (let i = 0; i < 7; i++) { const s = t + i * .09 + (i > 3 ? .12 : 0); noise(s, .06, { type: 'bandpass', f0: 420 + (i % 3) * 90, q: 6, v: .07 }); tone(s, 110 + (i % 2) * 30, .05, .025, 'square'); } },
  crt: t => { thump(t, 55, 30, .7, .3); noise(t, .5, { type: 'highpass', f0: 6000, f1: 2500, v: .05, a: .02 }); tone(t + .05, 7800, 1.2, .004); },
  type: t => { for (let i = 0; i < 46; i++) if (Math.random() < .55) noise(t + i * .045, .018, { type: 'highpass', f0: 4500, v: .025 }); },
  chime: t => { [76, 81, 84, 88].forEach((m, i) => bell(m, t + i * .11, .06)); },
  ready: t => { bell(93, t, .04); bell(88, t + .14, .035); },
  dive: t => { noise(t, 1.3, { type: 'lowpass', f0: 200, f1: 3200, q: .5, v: .08, a: 1.0 }); },
};

export const sound = {
  get on() { return on; },
  // call from a click/keypress (browsers only allow audio after one)
  boot(withSound = true) {
    on = withSound; try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch {}
    if (!init()) return false; ctx.resume && ctx.resume();
    master.gain.cancelScheduledValues(ctx.currentTime); master.gain.setValueAtTime(0, ctx.currentTime); master.gain.linearRampToValueAtTime(on ? .9 : 0, ctx.currentTime + .4);
    startMusic(); return true;
  },
  cue(name) { if (!ctx || !on || !SFX[name]) return; SFX[name](ctx.currentTime + .02); },
  toggle() {
    on = !on; try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch {}
    if (!init()) return on; ctx.resume && ctx.resume(); startMusic();
    master.gain.cancelScheduledValues(ctx.currentTime); master.gain.setValueAtTime(master.gain.value, ctx.currentTime); master.gain.linearRampToValueAtTime(on ? .9 : 0, ctx.currentTime + .6);
    return on;
  },
  // quieter under the page than during the intro
  settle() { if (!ctx) return; musicBus.gain.cancelScheduledValues(ctx.currentTime); musicBus.gain.setValueAtTime(musicBus.gain.value, ctx.currentTime); musicBus.gain.linearRampToValueAtTime(.55, ctx.currentTime + 3); },
};
