// p4d in 3D: the beige PC in a dark tech studio. Used twice: the intro (a floppy goes in, the CRT boots, the camera dives into the screen)
// and the hero (the PC turns toward the cursor while its CRT shows the pad you're building).
import * as THREE from './vendor/three.module.min.js';
import { RoundedBoxGeometry } from './vendor/RoundedBoxGeometry.js';
import { EffectComposer } from './vendor/EffectComposer.js';
import { RenderPass } from './vendor/RenderPass.js';
import { UnrealBloomPass } from './vendor/UnrealBloomPass.js';
import { OutputPass } from './vendor/OutputPass.js';

const BG = 0x030f11, C = '#5ff5e4', CD = '#3c8f8a';
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x)), seg = (t, a, b) => clamp((t - a) / (b - a));
const eio = x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2, eo = x => 1 - Math.pow(1 - x, 3);
const lerp = (a, b, k) => a + (b - a) * k;
const tex = (w, h, draw, rep) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...rep); } return t; };
const std = o => new THREE.MeshStandardMaterial(o);

// ---------------------------------------------------------------- the pixel p4d logo (11 rows: ascender, x-height, descender)
const GL = { p: ['......', '......', '......', 'XXXXX.', 'XX..XX', 'XX..XX', 'XX..XX', 'XX..XX', 'XXXXX.', 'XX....', 'XX....'], 4: ['XX..XX', 'XX..XX', 'XX..XX', 'XX..XX', 'XXXXXX', '....XX', '....XX', '....XX', '....XX', '......', '......'], d: ['....XX', '....XX', '....XX', '.XXXXX', 'XX..XX', 'XX..XX', 'XX..XX', 'XX..XX', '.XXXXX', '......', '......'] };
export function pixelLogo(g, cx, top, px, color, reveal = 1) {
  const rows = Array(11).fill(''); [...'p4d'].forEach((ch, i) => GL[ch].forEach((r, y) => rows[y] += (i ? '.' : '') + r));
  const w = rows[0].length * px, x0 = cx - w / 2; let n = 0, total = rows.join('').split('X').length - 1;
  g.save(); g.shadowColor = color; g.shadowBlur = px * .9; g.fillStyle = color;
  for (let x = 0; x < rows[0].length; x++) for (let y = 0; y < 11; y++) if (rows[y][x] === 'X') { if (n++ / total <= reveal) g.fillRect(x0 + x * px, top + y * px, px - Math.max(1, px * .1), px - Math.max(1, px * .1)); }
  g.restore();
}
function scan(g, w, h) { g.fillStyle = 'rgba(0,0,0,.22)'; for (let y = 0; y < h; y += 3) g.fillRect(0, y, w, 1); const v = g.createRadialGradient(w / 2, h / 2, w * .3, w / 2, h / 2, w * .75); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.7)'); g.fillStyle = v; g.fillRect(0, 0, w, h); }
function crtBg(g, w, h) { const r = g.createRadialGradient(w / 2, h / 2, 60, w / 2, h / 2, w * .7); r.addColorStop(0, '#08343a'); r.addColorStop(1, '#010b0d'); g.fillStyle = r; g.fillRect(0, 0, w, h); }

// ---------------------------------------------------------------- the stage: studio, grid, halo and the PC
function stage(canvas, { clear = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: clear, premultipliedAlpha: false, powerPreference: 'high-performance' }); if (clear) renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(1.75, devicePixelRatio || 1)); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = .95; renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene(); if (!clear) { scene.background = new THREE.Color(BG); scene.fog = new THREE.FogExp2(BG, .14); }
  const mesh = (geo, mat, x = 0, y = 0, z = 0, parent = scene) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; parent.add(m); return m; };
  // grid floor
  const grid = tex(1024, 1024, (g, w, h) => { g.fillStyle = '#000'; g.fillRect(0, 0, w, h); for (let i = 0; i <= 16; i++) { const p = i * w / 16; g.fillStyle = i % 4 ? 'rgba(95,245,228,.22)' : 'rgba(95,245,228,.55)'; const lw = i % 4 ? 2 : 3; g.fillRect(p - lw / 2, 0, lw, h); g.fillRect(0, p - lw / 2, w, lw); } }, [14, 14]);
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x071a1c, roughness: .5, metalness: .25, emissive: 0xffffff, emissiveMap: grid, emissiveIntensity: .32 });
  const floor = mesh(new THREE.PlaneGeometry(40, 40), clear ? new THREE.ShadowMaterial({ opacity: .5 }) : floorMat); floor.rotation.x = -Math.PI / 2; if (clear) { floor.geometry = new THREE.CircleGeometry(1.6, 48); }
  const halo = tex(512, 512, (g, w, h) => { const r = g.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w / 2); r.addColorStop(0, 'rgba(95,245,228,.55)'); r.addColorStop(.4, 'rgba(47,185,173,.18)'); r.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = r; g.fillRect(0, 0, w, h); });
  const haloM = new THREE.Mesh(new THREE.PlaneGeometry(5.5, 5.5), new THREE.MeshBasicMaterial({ map: halo, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); haloM.position.set(0, 1, -2.6); if (!clear) scene.add(haloM);
  const hz = new THREE.Mesh(new THREE.PlaneGeometry(30, .02), new THREE.MeshBasicMaterial({ color: 0x5ff5e4, transparent: true, opacity: .25, fog: false })); hz.position.set(0, .01, -6); if (!clear) scene.add(hz);
  // a sweep of light that runs across the grid
  const sweepT = tex(64, 512, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(95,245,228,0)'); gr.addColorStop(.5, 'rgba(95,245,228,.9)'); gr.addColorStop(1, 'rgba(95,245,228,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
  const sweep = new THREE.Mesh(new THREE.PlaneGeometry(40, 1.4), new THREE.MeshBasicMaterial({ map: sweepT, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 })); sweep.rotation.x = -Math.PI / 2; sweep.position.y = .005; scene.add(sweep);
  // dust
  const N = 900, pos = new Float32Array(N * 3); for (let i = 0; i < N; i++) { pos[i * 3] = (Math.random() - .5) * 10; pos[i * 3 + 1] = Math.random() * 3.5; pos[i * 3 + 2] = (Math.random() - .5) * 8 - 1; }
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const dust = new THREE.Points(pg, new THREE.PointsMaterial({ color: 0xbfeee8, size: .011, transparent: true, opacity: .5, depthWrite: false })); if (!clear) scene.add(dust);

  // the PC
  const pc = new THREE.Group(); scene.add(pc);
  const BEIGE = 0xd2c6a6, BEIGE2 = 0xc2b590;
  const plastic = std({ color: BEIGE, roughness: .55 }), plastic2 = std({ color: BEIGE2, roughness: .6 }), dark = std({ color: 0x2a2a26, roughness: .7 }), black = std({ color: 0x0b0b0c, roughness: .5 });
  mesh(new RoundedBoxGeometry(.98, .2, .78, 4, .02), plastic, 0, .1, -.12, pc);
  const front = (w, h, x, y, m = black) => mesh(new THREE.BoxGeometry(w, h, .01), m, x, y, .272, pc);
  front(.3, .016, .2, .12); front(.3, .016, .2, .07); front(.12, .03, -.3, .1, dark);
  const led = mesh(new THREE.BoxGeometry(.014, .014, .01), new THREE.MeshBasicMaterial({ color: 0x47ffd2, toneMapped: false }), -.42, .06, .274, pc);
  for (let i = 0; i < 7; i++) front(.004, .1, -.15 + i * .018, .1, dark);
  // the floppy (it flies in during the intro)
  const floppy = new THREE.Group(); scene.add(floppy);
  mesh(new THREE.BoxGeometry(.09, .006, .09), std({ color: 0x1f5f5c, roughness: .45 }), 0, 0, 0, floppy);
  mesh(new THREE.BoxGeometry(.036, .0072, .032), std({ color: 0xb8c4c4, roughness: .25, metalness: .8 }), 0, 0, -.026, floppy);
  mesh(new THREE.BoxGeometry(.066, .0068, .036), std({ color: 0xe9f3ef, roughness: .7 }), 0, 0, .02, floppy);
  mesh(new THREE.BoxGeometry(.034, .0071, .005), new THREE.MeshBasicMaterial({ color: 0x5ff5e4, toneMapped: false }), 0, 0, .036, floppy);
  const FLOPPY_IN = new THREE.Vector3(.2, .122, .29);
  // the monitor
  const mon = new THREE.Group(); mon.position.set(0, .26, -.05); pc.add(mon);
  mesh(new THREE.CylinderGeometry(.16, .2, .05, 32), plastic2, 0, -.035, -.05, mon);
  mesh(new RoundedBoxGeometry(.8, .64, .1, 5, .03), plastic, 0, .32, .06, mon);
  const back = new THREE.BoxGeometry(.74, .58, .5); const pp = back.attributes.position;
  for (let i = 0; i < pp.count; i++) if (pp.getZ(i) < 0) { pp.setX(i, pp.getX(i) * .66); pp.setY(i, pp.getY(i) * .7 + .02); }
  back.computeVertexNormals(); mesh(back, plastic2, 0, .32, -.2, mon);
  mesh(new THREE.BoxGeometry(.64, .49, .02), std({ color: 0x1a1a18, roughness: .4 }), 0, .335, .105, mon);
  const crtC = document.createElement('canvas'); crtC.width = 1024; crtC.height = 768; const crtG = crtC.getContext('2d');
  const crtT = new THREE.CanvasTexture(crtC); crtT.colorSpace = THREE.SRGBColorSpace; crtT.anisotropy = 8;
  const sg = new THREE.PlaneGeometry(.6, .45, 24, 18); const sp = sg.attributes.position;
  for (let i = 0; i < sp.count; i++) { const x = sp.getX(i) / .3, y = sp.getY(i) / .225; sp.setZ(i, .016 * (1 - .5 * (x * x + y * y))); } sg.computeVertexNormals();
  const screenMat = new THREE.MeshBasicMaterial({ map: crtT, toneMapped: false, color: 0xd8ffff });
  const screen = new THREE.Mesh(sg, screenMat); screen.position.set(0, .335, .118); mon.add(screen);
  // keyboard
  const kb = new THREE.Group(); kb.position.set(0, .018, .43); kb.rotation.set(.05, 0, 0); pc.add(kb);
  mesh(new RoundedBoxGeometry(.86, .03, .27, 3, .01), plastic, 0, 0, 0, kb);
  const keys = new THREE.InstancedMesh(new THREE.BoxGeometry(.034, .014, .034), plastic2, 120); let n = 0; const M = new THREE.Matrix4();
  for (let r = 0; r < 6; r++) for (let c = 0; c < 20; c++) { if (r === 5 && c > 3 && c < 12) continue; M.makeTranslation(-.38 + c * .04, .021, -.1 + r * .042); keys.setMatrixAt(n++, M); }
  M.makeScale(8, 1, 1).setPosition(-.06, .021, .11); keys.setMatrixAt(n++, M); keys.count = n; keys.castShadow = keys.receiveShadow = true; kb.add(keys);
  if (!clear) mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(-.45, .08, -.45), new THREE.Vector3(-.7, .02, -.55), new THREE.Vector3(-1.1, -.01, -.3), new THREE.Vector3(-1.6, -.02, -.7)]), 40, .01, 6, false), std({ color: 0x1a1a18, roughness: .6 }), 0, 0, 0, pc);
  // light
  const hemi = new THREE.HemisphereLight(0x9fd8d4, 0x020606, clear ? .55 : .32); scene.add(hemi);
  const key = new THREE.SpotLight(0xfff1de, 21, 0, .42, .8, 1.5); key.position.set(-.6, 3.2, 3.0); key.target.position.set(0, .35, 0); key.castShadow = true; key.shadow.mapSize.set(1024, 1024); key.shadow.bias = -.0008; key.shadow.radius = 5; scene.add(key, key.target);
  const rimL = new THREE.SpotLight(0x5ff5e4, 20, 0, .35, .9, 1.4); rimL.position.set(-2.0, 2.4, -1.8); rimL.target.position.set(0, .4, 0); scene.add(rimL, rimL.target);
  const rimR = new THREE.SpotLight(0x5ff5e4, 17, 0, .35, .9, 1.4); rimR.position.set(2.0, 2.3, -1.6); rimR.target.position.set(0, .4, 0); scene.add(rimR, rimR.target);
  const glow = new THREE.PointLight(0x5ff5e4, 1.2, 2.6, 2); glow.position.set(0, .62, .75); scene.add(glow);
  const torch = new THREE.SpotLight(0xffdcb0, clear ? 6 : 3, 0, .32, .85, 1.6); torch.position.set(-1.2, 1.5, 3.2); torch.target.position.set(0, .35, 0); scene.add(torch, torch.target);
  const cam = new THREE.PerspectiveCamera(34, 1, .02, 60);
  const comp = new EffectComposer(renderer); comp.addPass(new RenderPass(scene, cam));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), .42, .6, .86); comp.addPass(bloom); comp.addPass(new OutputPass());
  const render = () => clear ? renderer.render(scene, cam) : comp.render();
  const resize = () => { const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight; renderer.setSize(w, h, false); comp.setSize(w, h); cam.aspect = w / h; cam.updateProjectionMatrix(); };
  resize(); addEventListener('resize', resize);
  return { THREE, renderer, scene, cam, comp, render, pc, mon, screen, screenMat, crtC, crtG, crtT, floppy, FLOPPY_IN, led, sweep, dust, glow, floorMat, haloM, hz, hemi, key, rimL, rimR, torch, resize, dispose: () => { removeEventListener('resize', resize); renderer.dispose(); } };
}

// ---------------------------------------------------------------- the intro (~11.5 s, calm):
// the studio lights up, a floppy drifts in, the drive reads it, the CRT boots a BIOS, the p4d logo installs, the camera dives into the screen
export const INTRO_LEN = 11.6;
const k3c = t => eio(seg(t, 4.9, 6.4));
export function playIntro(canvas, { onReveal, onDone, onCue, live, manual } = {}) {
  const S = stage(canvas); const { cam, crtG: g, crtT, floppy, FLOPPY_IN, led, sweep, dust, mon, floorMat, haloM, hz, hemi, key, rimL, rimR, torch, glow } = S;
  const W = 1024, H = 768; let t0 = null, raf = 0, revealed = false, stopped = false; const fired = new Set();
  const cue = (name, at, t) => { if (t >= at && !fired.has(name)) { fired.add(name); if (!manual && onCue) try { onCue(name); } catch {} } };
  const screenWorld = new THREE.Vector3(); mon.updateMatrixWorld(); S.screen.getWorldPosition(screenWorld);
  const start = new THREE.Vector3(2.6, 3.3, 9.6), mid = new THREE.Vector3(.12, 1.12, 3.5), look0 = new THREE.Vector3(0, .2, 0), look1 = new THREE.Vector3(0, .42, 0);
  const I = { key: key.intensity, rimL: rimL.intensity, rimR: rimR.intensity, hemi: hemi.intensity, torch: torch.intensity, glow: glow.intensity, grid: floorMat.emissiveIntensity };
  const bios = () => [
    ['P4D BIOS v1.00   (c) 1998 p4d', CD],
    ['memory test ............ 640K OK', '#cfeee9'],
    ['floppy A: .............. pad.img', '#cfeee9'],
    ['linking Raydium LaunchLab ..... ok', '#cfeee9'],
    [live ? live() : 'LaunchLab online', C],
    ['', ''],
    ['C:\\> setup.exe /new-pad_', C],
  ];
  function crt(t) {
    g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    const on = seg(t, 5.3, 5.75);
    if (on <= 0) { crtT.needsUpdate = true; return; }
    crtBg(g, W, H);
    if (on < 1) { const hgt = Math.max(2, H * eio(on) * .98); g.fillStyle = 'rgba(230,255,252,' + (1 - on * .6) + ')'; g.fillRect(0, H / 2 - hgt / 2, W, hgt); scan(g, W, H); crtT.needsUpdate = true; return; }
    const flick = .86 + .14 * Math.sin(t * 57) * (1 - seg(t, 5.75, 6.3));
    g.save(); g.globalAlpha = flick; g.textBaseline = 'alphabetic';
    if (t < 8.0) {
      // the BIOS types itself, line by line
      const L = bios(), chars = Math.floor(Math.max(0, t - 5.9) * 150); let used = 0;
      g.font = '46px VT, monospace'; g.textAlign = 'left';
      L.forEach(([s, col], i) => { const n = Math.max(0, Math.min(s.length, chars - used)); used += s.length + 6; if (!n) return; g.fillStyle = col; g.shadowColor = col; g.shadowBlur = 10; g.fillText(s.slice(0, n), 64, 118 + i * 72); });
      g.shadowBlur = 0;
      
      // fade the BIOS out before the logo
      const out = seg(t, 7.7, 8.0); if (out > 0) { g.globalAlpha = 1; g.fillStyle = `rgba(1,11,13,${out})`; g.fillRect(0, 0, W, H); }
    } else {
      pixelLogo(g, W / 2, 120, 30, C, eo(seg(t, 8.05, 8.9)));
      const pr = eio(seg(t, 8.8, 10.1)); g.font = '40px VT, monospace'; g.fillStyle = CD; g.textAlign = 'center';
      g.fillText(pr < 1 ? 'installing your pad' : 'your pad is ready', W / 2, 530);
      g.strokeStyle = C; g.lineWidth = 3; g.strokeRect(212, 560, 600, 34); g.fillStyle = C; g.shadowColor = C; g.shadowBlur = 16; g.fillRect(218, 566, 588 * pr, 22); g.shadowBlur = 0;
      g.fillStyle = '#cfeee9'; g.font = '34px VT, monospace'; g.fillText(Math.round(pr * 100) + '%', W / 2, 642);
      g.fillStyle = CD; g.font = '28px VT, monospace'; g.fillText('make your own launchpad on Raydium', W / 2, 694);
    }
    g.restore(); scan(g, W, H); crtT.needsUpdate = true;
  }
  function frame(now) {
    if (stopped) return; if (t0 == null) t0 = now; const t = (now - t0) / 1000;
    // the studio lights come up one by one
    const kl = eo(seg(t, .3, 1.8)); key.intensity = I.key * kl; torch.intensity = I.torch * kl; hemi.intensity = I.hemi * (.25 + .75 * kl);
    rimL.intensity = I.rimL * eo(seg(t, 1.3, 1.9)); rimR.intensity = I.rimR * eo(seg(t, 1.9, 2.5));
    floorMat.emissiveIntensity = I.grid * eo(seg(t, 0, 2.2)); haloM.material.opacity = eo(seg(t, .8, 3.0)); hz.material.opacity = .25 * seg(t, 1.0, 2.6);
    glow.intensity = I.glow * (.15 + .45 * seg(t, 5.3, 6.0)) * (1 - .6 * k3c(t));
    cue('light1', .3, t); cue('light2', 1.3, t); cue('light3', 1.9, t);
    // camera: a slow glide in, a drift while the drive works, a push to the screen for the BIOS, then the dive
    const close = new THREE.Vector3(0, .66, Math.max(1.18, (.72 / Math.max(.3, cam.aspect)) / .611) + screenWorld.z);
    const k1 = eio(seg(t, 0, 3.4)), k3 = eio(seg(t, 4.9, 6.4)), k2 = eio(seg(t, 10.2, 11.3));
    const p = new THREE.Vector3().lerpVectors(start, mid, k1); p.x += Math.sin(t * .35) * .05 * (1 - k3);
    p.lerp(close, k3); p.y += Math.sin(t * .6) * .006 * (1 - k2);
    const dive = new THREE.Vector3(screenWorld.x, screenWorld.y + .01, screenWorld.z + .16); p.lerp(dive, k2); cam.position.copy(p);
    const look = new THREE.Vector3().lerpVectors(look0, look1, k1).lerp(new THREE.Vector3(0, screenWorld.y - .01, 0), k3).lerp(screenWorld, k2); cam.lookAt(look);
    cam.fov = lerp(34, 30, k2); cam.updateProjectionMatrix();
    // the sweep of light across the grid, the dust drifting
    sweep.material.opacity = .28 * (1 - seg(t, 2.4, 3.4)) * seg(t, .2, .8); sweep.position.z = lerp(-9, 5, seg(t, 0, 3.4));
    dust.rotation.y = t * .015;
    // the floppy: drifts in from the right, turns slowly, slides into the drive
    const kf = seg(t, 2.5, 4.3), kin = seg(t, 4.2, 4.55);
    const a = eio(kf), from = new THREE.Vector3(2.4, 1.6, 2.6), hover = new THREE.Vector3(FLOPPY_IN.x, FLOPPY_IN.y + .002, FLOPPY_IN.z + .14);
    const fp = new THREE.Vector3().lerpVectors(from, hover, a); fp.y += Math.sin(a * Math.PI) * .32; fp.z = lerp(fp.z, FLOPPY_IN.z, eio(kin));
    floppy.position.copy(fp); floppy.rotation.set(lerp(-1.1, 0, a), lerp(2.4, 0, a), lerp(.7, 0, a));
    cue('floppy', 2.5, t); cue('insert', 4.45, t); cue('drive', 4.7, t);
    led.material.color.setHex(t > 4.6 && t < 5.3 && Math.floor(t * 18) % 2 ? 0xffffff : 0x47ffd2);
    cue('crt', 5.3, t); cue('type', 5.9, t); cue('chime', 8.05, t); cue('ready', 10.1, t); cue('dive', 10.2, t);
    crt(t);
    if (t > 10.85 && !revealed) { revealed = true; onReveal && onReveal(); }
    S.render();
    if (manual) return;
    if (t > INTRO_LEN) { stop(); onDone && onDone(); return; }
    raf = requestAnimationFrame(frame);
  }
  function stop() { if (stopped) return; stopped = true; cancelAnimationFrame(raf); S.dispose(); }
  // the first frame: the studio still dark
  key.intensity = rimL.intensity = rimR.intensity = torch.intensity = 0; floorMat.emissiveIntensity = 0; haloM.material.opacity = 0; hz.material.opacity = 0; crt(0); S.render();
  if (manual) { t0 = 0; return { at: t => { stopped = false; frame(t * 1000); stopped = false; cancelAnimationFrame(raf); } }; }
  return {
    play: () => { if (!raf && !stopped) raf = requestAnimationFrame(frame); },
    skip: () => { if (!revealed) { revealed = true; onReveal && onReveal(); } stop(); onDone && onDone(); },
  };
}

// ---------------------------------------------------------------- the hero: the PC follows the cursor; its CRT shows your pad
export function heroPC(canvas, getPad) {
  const S = stage(canvas, { clear: true }); const { cam, comp, pc, crtG: g, crtT, floppy, FLOPPY_IN, dust } = S;
  floppy.position.copy(FLOPPY_IN); cam.position.set(0, 1.02, 3.1); cam.lookAt(0, .42, 0);
  const W = 1024, H = 768; let tx = 0, ty = 0, cx = 0, cy = 0, visible = true, last = '', img = null, imgSrc = '';
  addEventListener('pointermove', e => { tx = (e.clientX / innerWidth - .5); ty = (e.clientY / innerHeight - .5); }, { passive: true });
  new IntersectionObserver(es => visible = es[0].isIntersecting).observe(canvas);
  function draw(t) {
    const p = getPad(); const keyStr = JSON.stringify(p) + Math.floor(t * 2);
    if (keyStr === last) return; last = keyStr;
    if (p.img && p.img !== imgSrc) { imgSrc = p.img; img = new Image(); img.crossOrigin = 'anonymous'; img.onload = () => last = ''; img.onerror = () => { img = null; }; img.src = p.img; }
    crtBg(g, W, H); g.textAlign = 'left'; g.textBaseline = 'alphabetic';
    g.font = '34px VT, monospace'; g.fillStyle = CD; g.fillText('P4D 98 · ' + (p.mode || 'pad preview'), 60, 70);
    // logo tile
    g.strokeStyle = C; g.lineWidth = 3; g.strokeRect(60, 110, 200, 200);
    if (img && img.complete && img.naturalWidth) { try { g.drawImage(img, 63, 113, 194, 194); } catch {} } else { pixelLogo(g, 160, 150, 10, C); }
    g.font = '64px VT, monospace'; g.fillStyle = '#effffc'; g.shadowColor = C; g.shadowBlur = 12; g.fillText((p.name || 'my pad').slice(0, 18), 290, 170); g.shadowBlur = 0;
    g.font = '34px VT, monospace'; g.fillStyle = CD; g.fillText((p.web || 'your-pad.xyz').replace(/^https?:\/\//, '').slice(0, 30), 292, 215);
    g.fillStyle = C; g.fillText('● live on Raydium LaunchLab', 292, 265);
    const rows = [['pad fee', (p.fee ?? 1).toFixed(2) + '% per trade'], ['creator fee', (p.cfee ?? 0).toFixed(2) + '%'], ['LP at graduation', `${p.burn ?? 90}% burned · ${p.plat ?? 0}% pad · ${p.crea ?? 10}% creator`], ['coins launched', String(p.coins ?? 0)]];
    rows.forEach(([k, v], i) => { const y = 390 + i * 62; g.fillStyle = CD; g.fillText(k, 60, y); g.fillStyle = '#effffc'; g.textAlign = 'right'; g.fillText(v, W - 60, y); g.textAlign = 'left'; g.fillStyle = 'rgba(95,245,228,.18)'; g.fillRect(60, y + 16, W - 120, 2); });
    g.fillStyle = C; g.font = '38px VT, monospace'; g.fillText('> ' + (p.status || 'ready to create') + (Math.floor(t * 2) % 2 ? '_' : ' '), 60, 700);
    scan(g, W, H); crtT.needsUpdate = true;
  }
  let raf = 0; const loop = now => { raf = requestAnimationFrame(loop); if (!visible) return; const t = now / 1000;
    cx += (tx - cx) * .05; cy += (ty - cy) * .05; pc.rotation.y = cx * .55; pc.rotation.x = cy * .06; floppy.rotation.y = pc.rotation.y; floppy.position.set(FLOPPY_IN.x * Math.cos(pc.rotation.y) + FLOPPY_IN.z * Math.sin(pc.rotation.y), FLOPPY_IN.y, FLOPPY_IN.z * Math.cos(pc.rotation.y) - FLOPPY_IN.x * Math.sin(pc.rotation.y));
    cam.position.set(Math.sin(t * .2) * .06, 1.02 + Math.sin(t * .3) * .02, 3.1); cam.lookAt(0, .42, 0); dust.rotation.y = t * .015;
    pc.position.y = Math.sin(t * .9) * .012; draw(t); S.render(); };
  raf = requestAnimationFrame(loop);
  return { stop: () => { cancelAnimationFrame(raf); S.dispose(); } };
}
