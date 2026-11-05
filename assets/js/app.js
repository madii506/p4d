// p4d: make your own launchpad on Raydium LaunchLab
(() => {
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches, HOVER = matchMedia('(hover: hover)').matches;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const S = { sol: null, st: null, wallet: null, provider: null, mine: null, coins: 0,
  pad: { name: '', img: '', web: '', fee: 1, cfee: .05, burn: 100 } };
const trim = x => x.replace(/\.0+$|(\.\d*?)0+$/, '$1');
const fmtN = n => n >= 1e9 ? trim((n / 1e9).toFixed(2)) + 'B' : n >= 1e6 ? trim((n / 1e6).toFixed(2)) + 'M' : n >= 1e3 ? trim((n / 1e3).toFixed(1)) + 'K' : trim(n.toFixed(n >= 100 ? 0 : 2));
const set$ = (sel, v) => { const el = $(sel); if (el) el.textContent = v; };
const usd = sol => S.sol ? '$' + fmtN(sol * S.sol) : fmtN(sol) + ' SOL';
const solf = n => (n >= 1000 ? Math.round(n).toLocaleString('en-US') : n >= 10 ? n.toFixed(1) : n.toFixed(3)) + ' SOL';
const short = a => a ? a.slice(0, 4) + '…' + a.slice(-4) : '';
const toast = m => { const t = $('#toast'); t.textContent = m; t.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('on'), 2600); };
async function api(a, body, q = '') { const r = await fetch('/api/p4d?a=' + a + q, body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {}); const j = await r.json().catch(() => ({ error: 'bad response' })); if (!r.ok || j.error) throw new Error(j.error || r.statusText); return j; }
const site = () => location.origin;
window.P4D = Object.assign(window.P4D || {}, {
  pad: () => ({ name: S.pad.name || 'my pad', web: S.pad.web, img: S.pad.img, fee: S.pad.fee, cfee: S.pad.cfee, burn: S.pad.burn, plat: 100 - S.pad.burn, crea: 0, coins: S.coins, status: S.mine ? 'your pad is live' : 'ready to create', mode: S.mine ? 'your pad' : 'pad preview' }),
  liveLine: () => S.st && S.st.platforms ? `LaunchLab · ${S.st.platforms.toLocaleString('en-US')} pads live` : 'linking Raydium LaunchLab',
});

// ---------------------------------------------------------------- nav, progress, reveals
const nav = $('#nav'), prog = $('#prog');
addEventListener('scroll', () => { const h = document.documentElement, m = h.scrollHeight - h.clientHeight; prog.style.transform = `scaleX(${m > 0 ? h.scrollTop / m : 0})`; nav.classList.toggle('solid', h.scrollTop > 30); how(); }, { passive: true });
const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: .15 });
// windows open from a thin line (clip-path), so they need a threshold of 0 to be seen at all
const io0 = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io0.unobserve(e.target); } }), { threshold: 0, rootMargin: '0px 0px -6% 0px' });
$$('.rv').forEach((el, i) => { el.style.transitionDelay = (i % 3) * 70 + 'ms'; (el.classList.contains('win') ? io0 : io).observe(el); });
$$('h2').forEach(h => { h.classList.add('split'); h.innerHTML = h.innerHTML.split(/(\s+)/).map(w => /^\s+$/.test(w) ? w : `<span class="w"><span>${w}</span></span>`).join(''); h.querySelectorAll('.w>span').forEach((s, i) => s.style.transitionDelay = (i * 55) + 'ms'); });
$$('.kicker').forEach(k => io.observe(k));
const links = $$('#nav nav a'); const lio = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) links.forEach(a => a.classList.toggle('on', a.getAttribute('href') === '#' + e.target.id)); }), { rootMargin: '-45% 0px -50% 0px' });
links.forEach(a => { const s = $(a.getAttribute('href')); s && lio.observe(s); });
(() => { const nv = $('#nav nav'), pill = document.createElement('span'); pill.className = 'pill'; nv.prepend(pill);
  const move = a => { if (!a) { pill.style.opacity = 0; return; } pill.style.opacity = 1; pill.style.width = a.offsetWidth + 'px'; pill.style.transform = `translateX(${a.offsetLeft}px)`; };
  new MutationObserver(() => move(nv.querySelector('a.on'))).observe(nv, { subtree: true, attributes: true, attributeFilter: ['class'] });
  nv.addEventListener('pointerleave', () => move(nv.querySelector('a.on'))); links.forEach(a => a.addEventListener('pointerenter', () => move(a))); })();
$$('input[type=range]').forEach(r => { const p = () => r.style.setProperty('--p', (100 * (r.value - r.min) / (r.max - r.min)) + '%'); p(); r.addEventListener('input', p); });

// ---------------------------------------------------------------- the studio: dust, a light that follows you, the grid leaning with the mouse
(() => { const c = $('#dust'), spot = $('#spot'); const g = c.getContext('2d'); let W, H, P = [], mx = -9999, my = -9999, lastY = scrollY, vel = 0;
  const size = () => { const d = Math.min(2, devicePixelRatio || 1); W = innerWidth; H = innerHeight; c.width = W * d; c.height = H * d; g.setTransform(d, 0, 0, d, 0, 0); P = Array.from({ length: Math.min(200, Math.round(W * H / 8000)) }, () => { const z = Math.random(); return { x: Math.random() * W, y: Math.random() * H, z, r: .5 + z * 1.6, a: .1 + z * .4, ox: 0, oy: 0, p: Math.random() * 6.3 }; }); };
  size(); addEventListener('resize', size);
  addEventListener('pointermove', e => { mx = e.clientX; my = e.clientY; document.body.classList.add('moved'); spot.style.left = mx + 'px'; spot.style.top = my + 'px'; document.documentElement.style.setProperty('--mx', (mx / W - .5).toFixed(3)); }, { passive: true });
  if (RM) return; let hidden = false; document.addEventListener('visibilitychange', () => hidden = document.hidden);
  const tick = now => { requestAnimationFrame(tick); if (hidden) return; const dy = scrollY - lastY; lastY = scrollY; vel += (dy - vel) * .15; g.clearRect(0, 0, W, H);
    for (const s of P) { s.y += (-.08 - s.z * .15) - vel * (.1 + s.z * .4); s.x += Math.sin(now / 2600 + s.p) * .1; if (s.y < -10) { s.y = H + 10; s.x = Math.random() * W; } if (s.y > H + 10) { s.y = -10; s.x = Math.random() * W; }
      const dx = s.x + s.ox - mx, dy2 = s.y + s.oy - my, d2 = dx * dx + dy2 * dy2, R = 120; if (d2 < R * R) { const d = Math.sqrt(d2) || 1, f = (1 - d / R) * 20 * (.4 + s.z); s.ox += (dx / d * f - s.ox) * .12; s.oy += (dy2 / d * f - s.oy) * .12; } else { s.ox *= .94; s.oy *= .94; }
      g.fillStyle = `rgba(200,240,234,${s.a})`; g.beginPath(); g.arc(s.x + s.ox, s.y + s.oy, s.r, 0, 7); g.fill(); } };
  requestAnimationFrame(tick); })();
if (!RM && HOVER) { $$('.dcard, .padcard, .earn>div').forEach(el => { el.addEventListener('pointermove', e => { const r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5; el.style.transform = `perspective(900px) rotateX(${(-y * 4).toFixed(2)}deg) rotateY(${(x * 5).toFixed(2)}deg)`; }); el.addEventListener('pointerleave', () => el.style.transform = ''); });
  $$('.btn').forEach(b => { b.addEventListener('pointermove', e => { const r = b.getBoundingClientRect(); b.style.transform = `translate(${((e.clientX - r.left) / r.width - .5) * 8}px, ${((e.clientY - r.top) / r.height - .5) * 6 - 2}px)`; }); b.addEventListener('pointerleave', () => b.style.transform = ''); }); }

// ---------------------------------------------------------------- how it works: a setup window that installs step by step as you scroll
const SW = [
  () => `<div class="ln on">&gt; setup.exe /new-pad</div><div class="ln on">  name ........ <b>${esc(S.pad.name || 'my pad')}</b></div><div class="ln on">  logo ........ <b>${S.pad.img ? 'linked' : 'pixel p4d'}</b></div><div class="ln on">  website ..... <b>${esc((S.pad.web || 'your-pad.xyz').replace(/^https?:\/\//, ''))}</b></div><div class="bar"><i style="width:25%"></i></div><div class="ln on c">  step 1 of 4 · name your pad</div>`,
  () => `<div class="ln on">&gt; set fees</div><div class="ln on">  pad fee ..... <b>${S.pad.fee.toFixed(2)}%</b> per trade</div><div class="ln on">  creator ..... <b>${S.pad.cfee.toFixed(2)}%</b></div><div class="ln on">  LaunchLab ... <b>0.25%</b> protocol</div><div class="bar"><i style="width:50%"></i></div><div class="ln on c">  step 2 of 4 · set your fee</div>`,
  () => `<div class="ln on">&gt; graduation rule</div><div class="ln on">  pool ........ <b>Raydium CPMM</b></div><div class="ln on">  LP burned ... <b>${S.pad.burn}%</b></div><div class="ln on">  LP kept ..... <b>${100 - S.pad.burn}%</b> as a fee key</div><div class="bar"><i style="width:75%"></i></div><div class="ln on c">  step 3 of 4 · pick the LP rule</div>`,
  () => `<div class="ln on">&gt; create platform on LaunchLab</div><div class="ln on">  signer ...... <b>your wallet</b></div><div class="ln on">  link ........ <b>p4d/?pad=…</b></div><div class="ln on">  status ...... <b class="c">live</b></div><div class="bar"><i style="width:100%"></i></div><div class="ln on c">  step 4 of 4 · share your link</div>`];
const steps = $$('.step'); let curStep = -1;
function how() { const box = $('.steps').getBoundingClientRect(), vh = innerHeight, k = Math.max(0, Math.min(1, (vh * .5 - box.top - vh * .3) / (box.height - vh * .6))), i = Math.min(3, Math.floor(k * 4 + .0001));
  if (i !== curStep) { curStep = i; $('#sw').innerHTML = SW[i](); $$('#sw .ln').forEach((l, j) => { l.classList.remove('on'); setTimeout(() => l.classList.add('on'), 60 + j * 90); }); }
  steps.forEach((el, j) => el.classList.toggle('on', j === i)); $('#stepN').textContent = '0' + (i + 1); }

// ---------------------------------------------------------------- the pad card (builder preview, launch page, directory)
function padCard(p, opts = {}) {
  const lg = p.img ? `<div class="lg" style="background-image:url('${esc(p.img)}')"></div>` : `<div class="lg"><span class="px">p4d</span></div>`;
  return `<div class="ph">${lg}<div><h3>${esc(p.name || 'my pad')}</h3><div class="web">${esc((p.web || '').replace(/^https?:\/\//, '') || 'no website')}</div><div class="live">${opts.preview ? 'preview · not created yet' : 'live on Raydium LaunchLab'}</div></div></div>
  <div class="kv"><span>pad fee</span><b>${(+p.feePct).toFixed(2)}% per trade</b></div><div class="kv"><span>creator fee</span><b>${(+p.creatorFeePct).toFixed(2)}%</b></div>
  <div class="kv"><span>LP at graduation</span><b>${p.lp.burn}% burned · ${p.lp.platform}% kept</b></div>${opts.extra || ''}${p.id ? `<div class="kv"><span>pad</span><b class="mono">${short(p.id)}</b></div>` : ''}`;
}
const builderPad = () => ({ name: S.pad.name, img: S.pad.img, web: S.pad.web, feePct: S.pad.fee, creatorFeePct: S.pad.cfee, lp: { burn: S.pad.burn, platform: 100 - S.pad.burn } });

// ---------------------------------------------------------------- the builder wizard
const wiz = $('#wiz'); let wstep = 0;
function setStep(n) { wstep = Math.max(0, Math.min(3, n)); $$('.wp').forEach(p => p.classList.toggle('on', +p.dataset.s === wstep)); $$('#wtabs button').forEach(b => b.classList.toggle('on', +b.dataset.s === wstep)); $('#wPrev').style.visibility = wstep ? 'visible' : 'hidden'; $('#wNext').style.display = wstep === 3 ? 'none' : ''; if (wstep === 3) review(); }
$$('#wtabs button').forEach(b => b.addEventListener('click', () => setStep(+b.dataset.s))); $('#wPrev').addEventListener('click', () => setStep(wstep - 1)); $('#wNext').addEventListener('click', () => setStep(wstep + 1));
function syncPad() {
  const f = wiz; S.pad.name = f.name.value.trim(); S.pad.img = f.img.value.trim(); S.pad.web = f.web.value.trim(); S.pad.fee = +$('#fee').value; S.pad.cfee = +$('#cfee').value; S.pad.burn = +$('#burn').value;
  $('#vFee').textContent = S.pad.fee.toFixed(2) + '%'; $('#vCfee').textContent = S.pad.cfee.toFixed(2) + '%'; $('#vBurn').textContent = S.pad.burn + '%';
  $('#sBurn').style.width = S.pad.burn + '%'; $('#sKeep').style.width = (100 - S.pad.burn) + '%'; $('#lBurn').textContent = S.pad.burn + '%'; $('#lKeep').textContent = (100 - S.pad.burn) + '%';
  $('#padcard').innerHTML = padCard(builderPad(), { preview: !S.mine }); if (curStep >= 0) $('#sw').innerHTML = SW[curStep]().replace(/class="ln"/g, 'class="ln on"');
  const f2 = $('#fee2'); if (document.activeElement !== f2) { f2.value = S.pad.fee; f2.dispatchEvent(new Event('input')); }
  if (wstep === 3) review();
}
['input', 'change'].forEach(ev => wiz.addEventListener(ev, syncPad));
function review() { const total = S.pad.fee + S.pad.cfee + (S.st ? S.st.tradeFeePct : .25);
  $('#review').innerHTML = [['name', S.pad.name || '—'], ['website', S.pad.web || 'none'], ['pad fee', S.pad.fee.toFixed(2) + '%'], ['creator fee', S.pad.cfee.toFixed(2) + '%'], ['total per trade', total.toFixed(2) + '% with LaunchLab'], ['LP at graduation', `${S.pad.burn}% burned · ${100 - S.pad.burn}% kept`], ['admin', S.wallet ? short(S.wallet) : 'your wallet'], ['runs on', 'Raydium LaunchLab']].map(([k, v]) => `<div><small>${k}</small><b>${esc(v)}</b></div>`).join(''); }

// ---------------------------------------------------------------- wallet + signing
const providers = () => [['Phantom', window.phantom && window.phantom.solana], ['Solflare', window.solflare], ['Backpack', window.backpack]].filter(([, p]) => p);
async function connect() {
  if (S.wallet) return S.wallet; const ps = providers(); if (!ps.length) { toast('no Solana wallet found. install Phantom, Solflare or Backpack.'); throw new Error('no wallet'); }
  const [name, p] = ps[0]; const r = await p.connect(); S.wallet = ((r && r.publicKey) || p.publicKey).toString(); S.provider = p;
  ['#wAddr', '#wAddr2'].forEach(s => $(s).textContent = name + ' · ' + short(S.wallet)); ['#wBtn', '#wBtn2'].forEach(s => $(s).textContent = 'connected');
  $('#mkBtn').disabled = false; $('#mkBtn').textContent = 'create my pad on Raydium'; $('#lBtn').disabled = false; $('#lBtn').textContent = 'launch on this pad';
  loadMine(); return S.wallet;
}
['#wBtn', '#wBtn2'].forEach(s => $(s).addEventListener('click', () => connect().catch(() => {})));
document.addEventListener('click', e => { if (e.target.closest('#wBtn3')) connect().catch(() => {}); });
async function signSend(b64s, stat) {
  const { Transaction } = solanaWeb3; const txs = b64s.map(t => Transaction.from(Uint8Array.from(atob(t), c => c.charCodeAt(0))));
  stat('check it in your wallet…'); const signed = S.provider.signAllTransactions ? await S.provider.signAllTransactions(txs) : [await S.provider.signTransaction(txs[0])];
  stat('sending…'); return api('send', { txs: signed.map(t => btoa(String.fromCharCode(...t.serialize()))) });
}
const statOf = el => (m, cls = '') => { el.className = 'lstat ' + cls; el.innerHTML = m; };

// create the pad
wiz.addEventListener('submit', async e => {
  e.preventDefault(); const st = statOf($('#mkStat')), btn = $('#mkBtn'); btn.disabled = true;
  try { await connect(); if (!S.pad.name) { setStep(0); throw new Error('give your pad a name first'); }
    st('building the LaunchLab transaction…');
    const r = await api('buildPad', { wallet: S.wallet, name: S.pad.name, web: S.pad.web, img: S.pad.img, feePct: S.pad.fee, creatorFeePct: S.pad.cfee, lp: { burn: S.pad.burn } });
    const s = await signSend(r.txs, st);
    const link = `${site()}/?pad=${r.pad}#launch`;
    st(`your pad is live on Raydium LaunchLab.\nshare it: <a href="${link}">${esc(link)}</a> · <a href="https://solscan.io/tx/${s.sigs[0]}" target="_blank" rel="noopener">transaction ↗</a>`, 'ok');
    setTimeout(() => { loadMine(); loadPads(); }, 3000);
  } catch (err) { st(esc(err.message), 'err'); }
  btn.disabled = false;
});

// ---------------------------------------------------------------- earnings calculator
const volOf = k => k <= 0 ? 0 : 10 * Math.pow(100000 / 10, k / 1000);   // 10 SOL to 100K SOL a day, log scale
function earn() { const v = volOf(+$('#vol').value), f = +$('#fee2').value / 100; $('#vVol').textContent = solf(v) + (S.sol ? ` (${usd(v)})` : ''); $('#vFee2').textContent = (+$('#fee2').value).toFixed(2) + '%';
  const d = v * f; roll('#eDay', d); roll('#eMonth', d * 30); roll('#eYear', d * 365); }
function roll(sel, to) { const el = $(sel); if (!el) return; const from = +el.dataset.v || 0; el.dataset.v = to; if (RM || Math.abs(to - from) < 1e-9) { el.textContent = solf(to); return; }
  cancelAnimationFrame(el._r); const t0 = performance.now(), D = 520; const st = now => { const k = Math.min(1, (now - t0) / D), e = 1 - Math.pow(1 - k, 3); el.textContent = solf(from + (to - from) * e); if (k < 1) el._r = requestAnimationFrame(st); }; el._r = requestAnimationFrame(st); }
['#vol', '#fee2'].forEach(s => $(s).addEventListener('input', earn));

// ---------------------------------------------------------------- launch on a pad
const lform = $('#lform'); let raise = 85, curPad = null;
$$('#raise button').forEach(b => b.addEventListener('click', () => { $$('#raise button').forEach(x => x.classList.toggle('on', x === b)); raise = +b.dataset.v; coinPrev(); }));
// the coin you're launching, drawn from the form as you type
function coinPrev() { const el = $('#cPrev'); if (!el) return; const f = Object.fromEntries(new FormData(lform)); const name = (f.name || '').trim(), sym = (f.symbol || '').trim().toUpperCase(), img = (f.image || '').trim(), pad = (f.pad || '').trim(), buy = +f.buy || 0;
  const pic = /^https?:\/\//.test(img) ? `<img src="${esc(img)}" alt="" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'cpx',textContent:'?'}))">` : `<span class="cpx">${esc((sym || name || '?').slice(0, 1))}</span>`;
  el.innerHTML = `<div class="cph">${pic}<div><b>${esc(name || 'your coin')}</b><span>$${esc(sym || 'TICKER')}</span></div><em>${name && sym && img ? 'ready' : 'draft'}</em></div>`
    + `<div class="cpbar"><i style="width:0%"></i></div><div class="cprow"><span>curve</span><b>0 / ${raise} SOL raised</b></div><div class="cprow"><span>graduates into</span><b>Raydium CPMM</b></div><div class="cprow"><span>first buy</span><b>${buy ? buy + ' SOL' : 'none'}</b></div><div class="cprow"><span>pad</span><b>${pad ? esc(pad.slice(0, 4) + '…' + pad.slice(-4)) : '—'}</b></div>`; }
lform.addEventListener('input', coinPrev); coinPrev();
async function openPad(id, scroll) {
  if (!id) return; $('#lPad').value = id; const card = $('#lPadCard'); card.innerHTML = '<div class="empty">reading the pad from LaunchLab…</div>';
  try { const p = await api('pad', null, '&id=' + encodeURIComponent(id)); if (!p.exists) { card.innerHTML = `<div class="empty">no LaunchLab pad at ${esc(short(id))}.</div>`; curPad = null; return; }
    curPad = p; card.innerHTML = padCard(p);
    const { coins } = await api('coins', null, '&pad=' + encodeURIComponent(p.id)); $('#lCoins').innerHTML = coins.length ? coins.map(coinRow).join('') : '<div class="empty">no coins launched here through p4d yet.</div>';
  } catch (e) { card.innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
  if (scroll) $('#launch').scrollIntoView({ behavior: 'smooth' });
}
const coinRow = c => `<a class="cc" href="https://raydium.io/launchpad/token/?mint=${c.mint}" target="_blank" rel="noopener"><img src="${esc(c.image)}" alt="" onerror="this.style.visibility='hidden'"><div><b>${esc(c.name)}</b><span>$${esc(c.symbol)} · ${c.graduated ? 'graduated' : (c.progress * 100).toFixed(1) + '% filled'}</span></div><div class="pb"><i style="width:${Math.min(100, c.progress * 100).toFixed(1)}%"></i></div></a>`;
$('#lPad').addEventListener('change', () => openPad($('#lPad').value.trim()));
lform.addEventListener('submit', async e => {
  e.preventDefault(); const st = statOf($('#lStat')), btn = $('#lBtn'); btn.disabled = true; const f = Object.fromEntries(new FormData(lform));
  try { await connect(); if (!curPad) await openPad(f.pad.trim()); if (!curPad) throw new Error('pick a pad that exists');
    st('building the LaunchLab transaction…');
    const r = await api('buildLaunch', { wallet: S.wallet, pad: curPad.id, name: f.name.trim(), symbol: f.symbol.trim(), image: f.image.trim(), raiseSol: raise, buySol: +f.buy || 0 });
    const s = await signSend(r.txs, st);
    st(`launched on ${esc(curPad.name)}.\n<a href="https://raydium.io/launchpad/token/?mint=${r.mint}" target="_blank" rel="noopener">open on Raydium ↗</a> · <a href="https://solscan.io/tx/${s.sigs[0]}" target="_blank" rel="noopener">transaction ↗</a>`, 'ok');
    setTimeout(() => openPad(curPad.id), 4000);
  } catch (err) { st(esc(err.message), 'err'); }
  btn.disabled = false;
});

// ---------------------------------------------------------------- my pad: fees, claim, share
async function loadMine() {
  if (!S.wallet) return; const box = $('#dbody'); box.innerHTML = '<div class="empty">reading your pad…</div>';
  try { const p = await api('pad', null, '&admin=' + S.wallet);
    if (!p.exists) { S.mine = null; box.innerHTML = `<div class="empty">this wallet doesn't have a pad yet.<a class="btn sm" href="#build">create your pad</a></div>`; return; }
    S.mine = p; const link = `${site()}/?pad=${p.id}#launch`; const { coins } = await api('coins', null, '&pad=' + p.id); S.coins = coins.length;
    box.innerHTML = `<div class="dgrid"><div class="padcard">${padCard(p)}</div><div><small class="mono">unclaimed pad fees</small><div class="big">${solf(p.unclaimedSol)}</div><p class="hint">${S.sol ? '≈ ' + usd(p.unclaimedSol) + ' · ' : ''}collected in your pad's LaunchLab fee vault</p>
      <button class="btn" id="claimBtn" ${p.unclaimedSol > 0 ? '' : 'disabled'}>claim to my wallet</button><div class="lstat" id="claimStat"></div>
      <p class="mono" style="margin:22px 0 8px">your launch page</p><div class="share"><input readonly value="${esc(link)}" id="shareIn"><button class="btn sm" id="copyBtn" type="button">copy</button></div>
      <p class="mono" style="margin:22px 0 8px">coins on your pad · ${coins.length}</p><div class="ccoins">${coins.length ? coins.map(coinRow).join('') : '<div class="empty">no coins yet. share your link.</div>'}</div></div></div>`;
    $('#copyBtn').addEventListener('click', () => { navigator.clipboard && navigator.clipboard.writeText(link); toast('link copied'); });
    $('#claimBtn').addEventListener('click', async () => { const st = statOf($('#claimStat')); try { st('building the claim…'); const r = await api('claim', { wallet: S.wallet }); const s = await signSend(r.txs, st); st(`claimed. <a href="https://solscan.io/tx/${s.sigs[0]}" target="_blank" rel="noopener">transaction ↗</a>`, 'ok'); setTimeout(loadMine, 3000); } catch (e) { st(esc(e.message), 'err'); } });
    syncPad();
  } catch (e) { box.innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
}

// ---------------------------------------------------------------- pads directory
async function loadPads() {
  const g = $('#pgrid');
  try { const { pads } = await api('pads'); set$('#sMine', pads.length);
    g.innerHTML = pads.length ? pads.map(p => `<a class="padcard" href="/?pad=${p.id}#launch" data-pad="${p.id}">${padCard(p)}</a>`).join('') : slots();
    $$('#pgrid a[data-pad]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); history.replaceState(null, '', '/?pad=' + a.dataset.pad + '#launch'); openPad(a.dataset.pad, true); }));
  } catch (e) { g.innerHTML = `<div class="empty">couldn't read the chain right now (${esc(e.message)}).</div>`; set$('#sMine', '—'); }
}

const slots = () => Array.from({ length: 6 }, (_, i) => `<a class="slot${i ? '' : ' first'}" href="#build"><img src="/assets/pc.png" alt="" width="64" height="68"><span class="sn">#${String(i + 1).padStart(3, '0')}</span><b>${i ? 'open' : 'yours could be the first'}</b><i>${i ? 'empty slot' : 'create your pad →'}</i></a>`).join('');

// ---------------------------------------------------------------- live status
const statusP = api('status').then(s => { S.st = s; S.sol = s.solUsd;
  set$('#sSol', s.solUsd ? '$' + s.solUsd.toFixed(2) : '—'); set$('#sPads', s.platforms ? s.platforms.toLocaleString('en-US') : '—'); if (s.platforms) { $('#pTotal').textContent = s.platforms.toLocaleString('en-US'); $('#pTotalL').hidden = false; }
  earn(); review(); ticker(); return s; }).catch(() => { set$('#sPads', 'offline'); return null; });
function ticker() { const it = [['get your own p4d', ''], ['make a launchpad on Raydium', ''], [S.st && S.st.platforms ? S.st.platforms.toLocaleString('en-US') : 'thousands of', 'LaunchLab pads live'], ['your fee: 0–5% per trade', ''], ['graduates into a Raydium pool', ''], ['one transaction from your wallet', ''], ['type / for the terminal', '']];
  const tk = $('#tk'); if (!tk) return; const h = it.map(([a, b]) => `<span><b>${a}</b>${b ? ` <i>${b}</i>` : ''}</span><span>·</span>`).join(''); tk.innerHTML = h + h; }
ticker();

// ---------------------------------------------------------------- terminal
const tOut = $('#tOut'), tIn = $('#tIn'), tCmd = $('#tCmd'), tWin = $('#termWin'), hist = []; let hi = -1;
const P = (h, cls = '') => { tOut.insertAdjacentHTML('beforeend', `<div class="${cls}">${h}</div>`); tOut.scrollTop = tOut.scrollHeight; };
const set = (id, v) => { const el = id.startsWith('#') ? $(id) : wiz[id]; el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); };
const goTo = id => { const el = id && document.getElementById(id); if (!el) return false; tWin.classList.remove('float'); $('#tFab').classList.remove('on'); el.scrollIntoView({ behavior: 'smooth' }); return true; };
const CMDS = {
  help: () => P(`<span class="w">commands</span>
  <span class="c">pad</span>                 show the pad you're building
  <span class="c">name</span> my pad          set the pad name
  <span class="c">fee</span> 1.5             set your pad fee (0–5%)
  <span class="c">cfee</span> 0.1            set the creator fee (0–0.5%)
  <span class="c">burn</span> 80             LP burned at graduation (the rest your pad keeps)
  <span class="c">logo</span> https://…      set the logo link
  <span class="c">create</span>              review and create your pad
  <span class="c">connect</span> · <span class="c">mypad</span> · <span class="c">claim</span>   your wallet, your pad, your fees
  <span class="c">pads</span> · <span class="c">open</span> PAD     the p4d directory, open a pad's launch page
  <span class="c">earn</span> 500           what 500 SOL a day of volume pays at your fee
  <span class="c">raydium</span> · <span class="c">price</span>     LaunchLab rules and the SOL price, live
  <span class="c">goto</span> section · <span class="c">clear</span> · <span class="c">about</span>`),
  pad: () => { const p = builderPad(); P(`name ........ <span class="w">${esc(p.name || '—')}</span>\nwebsite ..... ${esc(p.web || 'none')}\nlogo ........ ${p.img ? 'linked' : 'pixel p4d'}\npad fee ..... <span class="c">${p.feePct.toFixed(2)}%</span> per trade\ncreator fee . ${p.creatorFeePct.toFixed(2)}%\nLP .......... ${p.lp.burn}% burned · ${p.lp.platform}% kept by your pad`); },
  name: a => { if (!a.length) return P('usage: <span class="c">name my pad</span>', 'e'); set('name', a.join(' ').slice(0, 32)); P('name set: <span class="w">' + esc(S.pad.name) + '</span>'); },
  fee: a => { const v = +a[0]; if (!(v >= 0 && v <= 5)) return P('fee must be 0 to 5', 'e'); set('#fee', v); P(`pad fee set: <span class="c">${S.pad.fee.toFixed(2)}%</span>`); },
  cfee: a => { const v = +a[0]; if (!(v >= 0 && v <= .5)) return P('creator fee must be 0 to 0.5', 'e'); set('#cfee', v); P(`creator fee set: ${S.pad.cfee.toFixed(2)}%`); },
  burn: a => { const v = +a[0]; if (!(v >= 0 && v <= 100)) return P('burn must be 0 to 100', 'e'); set('#burn', Math.round(v / 5) * 5); P(`LP: ${S.pad.burn}% burned · ${100 - S.pad.burn}% kept by your pad`); },
  logo: a => { if (!/^https?:\/\//.test(a[0] || '')) return P('give a https:// link', 'e'); set('img', a[0]); P('logo linked'); },
  create: () => { setStep(3); goTo('build'); P('review your pad and press <span class="c">create my pad on Raydium</span>. your wallet signs it.'); },
  connect: () => connect().then(w => P('connected ' + short(w))).catch(e => P(esc(e.message), 'e')),
  mypad: async () => { if (!S.wallet) return P('connect first: <span class="c">connect</span>', 'e'); const p = await api('pad', null, '&admin=' + S.wallet); if (!p.exists) return P('no pad on this wallet yet. type <span class="c">create</span>.'); P(`your pad ...... <span class="w">${esc(p.name)}</span>\nid ............ ${p.id}\nfee ........... ${p.feePct}%\nunclaimed ..... <span class="c">${solf(p.unclaimedSol)}</span>\nlink .......... <a href="/?pad=${p.id}#launch">/?pad=${short(p.id)}</a>`); },
  claim: () => { goTo('mine'); P('opening your dashboard. press <span class="c">claim to my wallet</span>.'); },
  pads: async () => { const { pads } = await api('pads'); P(pads.length ? pads.map(p => `<a href="/?pad=${p.id}#launch">${esc(p.name)}</a> · ${p.feePct}% · ${short(p.id)}`).join('\n') : 'no p4d pads yet.'); },
  open: a => { if (!a[0]) return P('usage: <span class="c">open PAD_ADDRESS</span>', 'e'); openPad(a[0], true); P('opening ' + esc(short(a[0]))); },
  earn: a => { const v = +a[0] || 100, d = v * S.pad.fee / 100; P(`${solf(v)} a day at ${S.pad.fee.toFixed(2)}% → <span class="c">${solf(d)}</span> a day, ${solf(d * 30)} a month${S.sol ? ' (' + usd(d * 30) + ')' : ''}\n<span class="m">what the fee implies, not a promise.</span>`); },
  raydium: async () => { const s = S.st || await statusP; if (!s) return P('LaunchLab is unreachable right now.', 'e'); P(`program ...... ${s.program}\npads live .... ${s.platforms ? s.platforms.toLocaleString('en-US') : '—'}\nprotocol fee . ${s.tradeFeePct}% per trade\nmin raise .... ${s.minRaiseSol} SOL\nRaydium pad .. ${s.raydium ? s.raydium.feePct + '% fee · ' + s.raydium.lp.burn + '% LP burned' : '—'}\npad limits ... fee 0–${s.maxFeePct}% · creator 0–0.5% · LP burned or kept`); },
  price: () => P(S.sol ? `SOL <span class="w">$${S.sol.toFixed(2)}</span>` : 'price unavailable', S.sol ? '' : 'e'),
  goto: a => { if (!goTo(a[0])) P('sections: why, how, build, earn, launch, mine, pads, faq', 'e'); },
  clear: () => { tOut.innerHTML = ''; },
  about: () => P(`<span class="w">p4d</span>: make your own launchpad on Raydium LaunchLab.\n<span class="m">independent. not affiliated with Raydium. not financial advice.</span>`),
};
async function run(line) { P(`<span class="c">C:\\P4D&gt;</span> <span class="w">${esc(line)}</span>`); const parts = line.match(/"[^"]*"|\S+/g) || []; const c = (parts.shift() || '').toLowerCase(); if (!c) return; if (!CMDS[c]) return P(`'${esc(c)}' is not a command. type <span class="c">help</span>`, 'e'); try { await CMDS[c](parts.map(p => p.replace(/^"|"$/g, ''))); } catch (e) { P(esc(e.message), 'e'); } }
tIn.addEventListener('submit', e => { e.preventDefault(); const v = tCmd.value.trim(); tCmd.value = ''; if (!v) return; hist.push(v); hi = hist.length; run(v); });
tCmd.addEventListener('keydown', e => { if (e.key === 'ArrowUp') { e.preventDefault(); if (hi > 0) tCmd.value = hist[--hi] || ''; } else if (e.key === 'ArrowDown') { e.preventDefault(); hi = Math.min(hist.length, hi + 1); tCmd.value = hist[hi] || ''; } else if (e.key === 'Tab') { e.preventDefault(); const v = tCmd.value.toLowerCase(), m = Object.keys(CMDS).filter(k => k.startsWith(v)); if (m.length === 1) tCmd.value = m[0] + ' '; else if (m.length) P(m.join('  '), 'm'); } else if (e.key === 'Escape') { tWin.classList.remove('float'); $('#tFab').classList.remove('on'); } });
const toggleFloat = () => { const f = tWin.classList.toggle('float'); $('#tFab').classList.toggle('on', f); if (f) setTimeout(() => tCmd.focus(), 50); };
$('#tFab').addEventListener('click', toggleFloat); $('#tPop').addEventListener('click', toggleFloat); tWin.addEventListener('click', e => { if (!e.target.closest('a,button')) tCmd.focus(); });
addEventListener('keydown', e => { if (e.key === '/' && !/input|textarea/i.test(document.activeElement.tagName)) { e.preventDefault(); if (!tWin.classList.contains('float')) toggleFloat(); else tCmd.focus(); } });
$('#tChips').innerHTML = ['help', 'name my pad', 'fee 1.5', 'burn 80', 'pad', 'earn 500', 'raydium', 'pads'].map(c => `<button type="button">${c}</button>`).join('');
$$('#tChips button').forEach(b => b.addEventListener('click', () => run(b.textContent)));
P(`<span class="w">P4D 98</span> <span class="m">· type</span> <span class="c">help</span> <span class="m">· ↑↓ history · tab completes</span>`);
(() => { const f = $('#tFab'); const o = new IntersectionObserver(es => f.classList.toggle('away', es.some(e => e.isIntersecting)), { threshold: .05 }); ['#faq', '.foot'].forEach(s => $(s) && o.observe($(s))); })();

// ---------------------------------------------------------------- v2 motion: big section letters, scroll bands, a cursor light, the essay lighting up
(() => {
  const GLY = '▓▒░#%&@$*+=/\\<>01';
  $$('.bigk').forEach(b => { const w = b.querySelector('.bw'), word = w.textContent; w.setAttribute('aria-label', word);
    w.innerHTML = [...word].map((c, i) => `<span class="ch" style="transition-delay:${i * 45}ms">${c === ' ' ? '&nbsp;' : esc(c)}</span>`).join('');
    const chs = [...w.querySelectorAll('.ch')];
    const scramble = () => { if (RM) return; chs.forEach((ch, i) => { const real = word[i]; if (real === ' ') return; let n = 0; const max = 6 + i * 2;
      const it = setInterval(() => { ch.textContent = ++n >= max ? real : GLY[Math.floor(Math.random() * GLY.length)]; if (n >= max) clearInterval(it); }, 42); }); };
    const o = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { b.classList.add('in'); scramble(); o.unobserve(b); } }), { threshold: .4 }); o.observe(b);
    if (HOVER) b.parentElement.addEventListener('pointerenter', () => { if (b.classList.contains('in')) scramble(); });
  });
  // the essay: each word lights up as it passes the middle of the screen
  const words = []; $$('.essay p').forEach(p => { p.innerHTML = p.textContent.split(/(\s+)/).map(w => /^\s+$/.test(w) ? w : `<span class="wd">${esc(w)}</span>`).join(''); words.push(...p.querySelectorAll('.wd')); });
  // the scroll bands and the big letters drift sideways with the scroll
  const mqs = $$('.mqi').map(m => { m.innerHTML = m.innerHTML.repeat(4); return { m, x: 0 }; }), bigs = $$('.bigk .bw');
  let lastY = scrollY, v = 0; let wins = $$('.win.rv');
  const tick = now => { requestAnimationFrame(tick); const y = scrollY, dy = y - lastY; lastY = y; v += (dy - v) * .1; const vh = innerHeight;
    for (const q of mqs) { const r = q.m.parentElement.getBoundingClientRect(); if (r.bottom < -50 || r.top > vh + 50) continue; q.x -= .45 + Math.abs(v) * .35; const half = q.m.scrollWidth / 2; if (-q.x > half) q.x += half; q.m.style.transform = `translate3d(${q.x}px,0,0) skewX(${Math.max(-8, Math.min(8, -v * .4))}deg)`; }
    if (!RM) for (const b of bigs) { const r = b.getBoundingClientRect(); if (r.bottom < -100 || r.top > vh + 100) continue; const k = (r.top + r.height / 2 - vh / 2) / vh; b.style.transform = `translate3d(${(k * -60).toFixed(1)}px,0,0)`; }
    for (const w of words) { const r = w.getBoundingClientRect(); w.classList.toggle('lit', RM || r.top < vh * .72); }
    if (wins.length) wins = wins.filter(w => { if (w.classList.contains('in')) return false; const r = w.getBoundingClientRect(); if (r.top < vh * .9 && r.bottom > 0) { w.classList.add('in'); return false; } return true; });
  };
  requestAnimationFrame(tick);
  // a light that follows the cursor across cards and windows
  if (HOVER) $$('.dcard, .win, .padcard').forEach(el => el.addEventListener('pointermove', e => { const r = el.getBoundingClientRect(); el.style.setProperty('--mx', (e.clientX - r.left) + 'px'); el.style.setProperty('--my', (e.clientY - r.top) + 'px'); }, { passive: true }));
})();

// ---------------------------------------------------------------- v3: headline words, section rail, cursor ring, hero parallax
(() => {
  const h1 = $('.hl h1'); if (h1) { let i = 0; const wrap = w => `<span class="hw"><span style="transition-delay:${(i++) * 90}ms">${w}</span></span>`;
    h1.innerHTML = [...h1.childNodes].map(n => n.nodeType === 3 ? n.textContent.split(/(\s+)/).map(w => /^\s+$/.test(w) || !w ? w : wrap(esc(w))).join('') : n.outerHTML.replace('<em', `<em class="hwe" style="transition-delay:${(i++) * 90}ms"`)).join(''); }
  const rail = $$('#rail a'); const rio = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { const id = e.target.id || 'top'; rail.forEach(a => a.classList.toggle('on', a.getAttribute('href') === '#' + id)); } }), { rootMargin: '-45% 0px -50% 0px' });
  rail.forEach(a => { const t = $(a.getAttribute('href')); t && rio.observe(t.id === 'top' ? $('.hero') : t); });
  const cur = $('#cur'); let cx = -100, cy = -100, tx = -100, ty = -100;
  if (HOVER && cur && !RM) { addEventListener('pointermove', e => { tx = e.clientX; ty = e.clientY; const t = e.target.closest && e.target.closest('a,button,input,label,summary,.dcard,.padcard'); cur.classList.toggle('big', !!t); }, { passive: true });
    const loop = () => { requestAnimationFrame(loop); cx += (tx - cx) * .2; cy += (ty - cy) * .2; cur.style.transform = `translate3d(${cx}px,${cy}px,0)`; }; loop(); }
  const pcw = $('.hero .hr'), hl = $('.hero .hl');
  if (!RM && pcw) { const par = () => { const y = scrollY, vh = innerHeight; if (y > vh * 1.2) return; const k = y / vh; pcw.style.transform = `translate3d(0,${(y * .18).toFixed(1)}px,0) scale(${(1 - k * .08).toFixed(3)})`; hl && (hl.style.transform = `translate3d(0,${(y * .08).toFixed(1)}px,0)`); hl && (hl.style.opacity = String(Math.max(0, 1 - k * 1.1))); };
    addEventListener('scroll', par, { passive: true }); par(); }
})();

// ---------------------------------------------------------------- go
syncPad(); setStep(0); earn(); how(); loadPads();
const qp = new URLSearchParams(location.search).get('pad'); if (qp) openPad(qp, false);
})();
