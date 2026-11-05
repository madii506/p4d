// p4d API: make your own launchpad on Raydium LaunchLab.
// GET  a=status · a=pad&id=|admin= · a=pads · a=coins[&pad=] · a=m (token metadata JSON)
// POST a=buildPad · a=buildLaunch · a=claim · a=send
const { Connection, PublicKey, Keypair, SystemProgram, Transaction } = require('@solana/web3.js');
const BN = require('bn.js');
const R = require('@raydium-io/raydium-sdk-v2');

const RPC = process.env.RPC_URL || 'https://api.mainnet-beta.solana.com';
const WSOL = new PublicKey('So11111111111111111111111111111111111111112');
const PROGRAM = R.LAUNCHPAD_PROGRAM, RAYDIUM_PLATFORM = R.LAUNCHPAD_PLATFORM;
const CONFIG = R.getPdaLaunchpadConfigId(PROGRAM, WSOL, 0, 0).publicKey;
// public addresses every p4d pad / every coin launched through p4d sends 0 SOL to, so the directory and coin lists can find them on-chain
const TAG_PAD = new PublicKey(process.env.P4D_TAG_PAD || '4saj27i4g4X3beMc1eVasZP83WhCHDEtNp7qiDddRHbR');
const TAG_COIN = new PublicKey(process.env.P4D_TAG_COIN || '6MjpLfEkcU9aa45DhegD3X8AqWp88ZLMJe9Y3ZGm151g');
const META_PROGRAM = new PublicKey('metaqbxxUerdq28cj1RJAWkYQm3ybzjb6a8bBuwy6NG');
const SUPPLY = new BN('1000000000000000'), SELL = new BN('793100000000000');   // 1B supply, 79.31% sold on the curve (LaunchLab's standard shape)
const PPM = 1e6, MAX_FEE_PCT = +(process.env.P4D_MAX_FEE_PCT || 5);
const conn = new Connection(RPC, 'confirmed');

const out = (res, code, body, cache) => { res.statusCode = code; res.setHeader('content-type', 'application/json'); res.setHeader('cache-control', cache || 'no-store'); res.end(JSON.stringify(body)); };
const b64u = s => Buffer.from(s).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = s => Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString();
const host = req => process.env.P4D_HOST || ('https://' + (req.headers['x-forwarded-host'] || req.headers.host));
const body = req => new Promise(ok => { if (req.body) return ok(typeof req.body === 'string' ? JSON.parse(req.body) : req.body); let d = ''; req.on('data', c => d += c); req.on('end', () => { try { ok(JSON.parse(d || '{}')); } catch { ok({}); } }); });
const clean = (s, n) => String(s || '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, n);
const str = b => Buffer.from(b).toString('utf8').replace(/\0/g, '').trim();
const pk = (s, what) => { try { return new PublicKey(String(s)); } catch { throw new Error(what || 'bad address'); } };
const padIdOf = admin => R.getPdaPlatformId(PROGRAM, admin).publicKey;
const vaultOf = padId => R.getPdaPlatformVault(PROGRAM, padId, WSOL).publicKey;

let cache = null;
async function chain() {
  if (cache && Date.now() - cache.t < 60000) return cache.v;
  const [ca, pa] = await conn.getMultipleAccountsInfo([CONFIG, RAYDIUM_PLATFORM]);
  if (!ca) throw new Error('LaunchLab config not found');
  const v = { cfg: R.LaunchpadConfig.decode(ca.data), ray: pa ? R.PlatformConfig.decode(pa.data) : null, padSize: pa ? pa.data.length : 944 };
  cache = { t: Date.now(), v }; return v;
}
async function solUsd() { try { const r = await fetch('https://lite-api.jup.ag/price/v3?ids=' + WSOL.toBase58(), { signal: AbortSignal.timeout(4000) }); const j = await r.json(); return +j[WSOL.toBase58()].usdPrice || null; } catch { return null; } }
const pct = n => +(+n.toString() / PPM * 100).toFixed(4);
function decodePad(id, data) {
  const p = R.PlatformConfig.decode(data);
  return { id: id.toBase58(), name: str(p.name), web: str(p.web), img: str(p.img), feePct: pct(p.feeRate), creatorFeePct: pct(p.creatorFeeRate),
    lp: { burn: pct(p.burnScale), platform: pct(p.platformScale), creator: pct(p.creatorScale) }, claimWallet: p.platformClaimFeeWallet.toBase58(), cpConfigId: p.cpConfigId.toBase58() };
}

let countCache = null;
async function status() {
  const [{ cfg, ray, padSize }, px] = await Promise.all([chain(), solUsd()]);
  let platforms = countCache && Date.now() - countCache.t < 600000 ? countCache.n : null;
  if (platforms == null) { try { const r = await Promise.race([conn.getProgramAccounts(PROGRAM, { filters: [{ dataSize: padSize }], dataSlice: { offset: 0, length: 0 } }), new Promise((_, no) => setTimeout(() => no(new Error('slow')), 7000))]); platforms = r.length; countCache = { t: Date.now(), n: platforms }; } catch { platforms = null; } }
  return { launchlab: true, program: PROGRAM.toBase58(), config: CONFIG.toBase58(), solUsd: px, minRaiseSol: +cfg.minFundRaisingB.toString() / 1e9, tradeFeePct: pct(cfg.tradeFeeRate), platforms,
    raydium: ray ? { feePct: pct(ray.feeRate), creatorFeePct: pct(ray.creatorFeeRate), lp: { burn: pct(ray.burnScale), platform: pct(ray.platformScale), creator: pct(ray.creatorScale) }, cpConfigId: ray.cpConfigId.toBase58() } : null,
    maxFeePct: MAX_FEE_PCT, tags: { pad: TAG_PAD.toBase58(), coin: TAG_COIN.toBase58() } };
}

async function pad(q) {
  const id = q.get('id') ? pk(q.get('id'), 'bad pad id') : padIdOf(pk(q.get('admin'), 'bad wallet'));
  const [acc, vault] = await conn.getMultipleAccountsInfo([id, vaultOf(id)]);
  if (!acc || !acc.owner.equals(PROGRAM)) return { exists: false, id: id.toBase58() };
  const p = decodePad(id, acc.data);
  let unclaimedSol = 0; if (vault && vault.data.length >= 72) unclaimedSol = Number(vault.data.readBigUInt64LE(64)) / 1e9;
  return { exists: true, ...p, vault: vaultOf(id).toBase58(), unclaimedSol };
}

async function tagged(tag, limit = 100) {
  const sigs = (await conn.getSignaturesForAddress(tag, { limit })).filter(s => !s.err).map(s => s.signature);
  const txs = []; for (let i = 0; i < sigs.length; i += 20) txs.push(...await Promise.all(sigs.slice(i, i + 20).map(s => conn.getTransaction(s, { maxSupportedTransactionVersion: 0 }).catch(() => null))));
  return txs.filter(Boolean);
}
async function pads() {
  const txs = await tagged(TAG_PAD);
  const admins = [...new Set(txs.map(t => (t.transaction.message.staticAccountKeys || t.transaction.message.accountKeys)[0].toBase58()))];
  if (!admins.length) return { pads: [] };
  const ids = admins.map(a => padIdOf(new PublicKey(a)));
  const accs = await conn.getMultipleAccountsInfo(ids);
  return { pads: ids.map((id, i) => accs[i] && accs[i].owner.equals(PROGRAM) ? decodePad(id, accs[i].data) : null).filter(Boolean) };
}
function readStr(buf, o) { const n = buf.readUInt32LE(o); return [buf.slice(o + 4, o + 4 + n).toString().replace(/\0/g, '').trim(), o + 4 + n]; }
async function coins(q) {
  const want = q.get('pad');
  const txs = await tagged(TAG_COIN);
  const mints = [...new Set(txs.map(t => {
    const m = t.transaction.message, keys = m.staticAccountKeys || m.accountKeys, ti = keys.findIndex(k => k.equals(TAG_COIN));
    const ix = (m.compiledInstructions || []).find(c => c.accountKeyIndexes.includes(ti) && keys[c.programIdIndex].equals(SystemProgram.programId));
    if (ix && ix.accountKeyIndexes.length >= 3) return keys[ix.accountKeyIndexes[2]].toBase58();
    return m.header.numRequiredSignatures >= 2 ? keys[1].toBase58() : null;
  }).filter(Boolean))];
  if (!mints.length) return { coins: [] };
  const pools = mints.map(m => R.getPdaLaunchpadPoolId(PROGRAM, new PublicKey(m), WSOL).publicKey);
  const metas = mints.map(m => PublicKey.findProgramAddressSync([Buffer.from('metadata'), META_PROGRAM.toBuffer(), new PublicKey(m).toBuffer()], META_PROGRAM)[0]);
  const accs = await conn.getMultipleAccountsInfo([...pools, ...metas]);
  const list = [];
  mints.forEach((m, i) => {
    const pa = accs[i], ma = accs[mints.length + i]; if (!pa) return; let p; try { p = R.LaunchpadPool.decode(pa.data); } catch { return; }
    if (want && p.platformId.toBase58() !== want) return;
    let name = '', symbol = '', uri = '', image = ''; if (ma) { try { let o = 65; [name, o] = readStr(ma.data, o); [symbol, o] = readStr(ma.data, o); [uri] = readStr(ma.data, o); } catch {} }
    try { const d = new URL(uri).searchParams.get('d'); if (d) image = JSON.parse(unb64u(d)).i || ''; } catch {}
    const vA = +p.virtualA.toString(), vB = +p.virtualB.toString(), rA = +p.realA.toString(), rB = +p.realB.toString(), sup = +p.supply.toString();
    const price = (vB + rB) / (vA - rA);   // lamports per base unit
    list.push({ mint: m, pool: pools[i].toBase58(), pad: p.platformId.toBase58(), name, symbol, image, graduated: p.status > 0, progress: rB / +p.totalFundRaisingB.toString(), raisedSol: rB / 1e9, raiseSol: +p.totalFundRaisingB.toString() / 1e9, mcapSol: price * sup / 1e9, platformFeeSol: +p.platformFee.toString() / 1e9 });
  });
  return { coins: list };
}

const tagIx = (from, tag, extra) => { const ix = SystemProgram.transfer({ fromPubkey: from, toPubkey: tag, lamports: 0 }); if (extra) ix.keys.push({ pubkey: extra, isSigner: false, isWritable: false }); return ix; };
const fits = t => { try { t.serialize({ requireAllSignatures: false, verifySignatures: false }); return true; } catch { return false; } };
async function finish(txs, wallet, signers, tagFn, simulate) {
  const { blockhash } = await conn.getLatestBlockhash('confirmed');
  const mk = ixs => { const t = new Transaction(); t.add(...ixs); t.feePayer = wallet; t.recentBlockhash = blockhash; const need = signers.filter(s => t.instructions.some(ix => ix.keys.some(k => k.isSigner && k.pubkey.equals(s.publicKey)))); if (need.length) t.partialSign(...need); return t; };
  let list = txs.map((tx, i) => mk(i === 0 && tagFn ? [...tx.instructions, tagFn(false)] : tx.instructions));
  if (tagFn && !fits(list[0])) { list = txs.map(tx => mk(tx.instructions)); list.push(mk([tagFn(true)])); }
  let sim = null;
  if (simulate) sim = await Promise.all(list.slice(0, 1).map(async t => { const r = await conn.simulateTransaction(t); return { err: r.value.err, units: r.value.unitsConsumed, logs: (r.value.logs || []).slice(-16) }; }));
  return { txs: list.map(t => Buffer.from(t.serialize({ requireAllSignatures: false, verifySignatures: false })).toString('base64')), sim };
}
const txsOf = m => m.transactions ? m.transactions : [{ instructions: m.transaction && m.transaction.instructions && m.transaction.instructions.length ? m.transaction.instructions : m.builder.allInstructions }];
async function sdk(owner) { const r = await R.Raydium.load({ connection: conn, owner, cluster: 'mainnet', disableLoadToken: true, disableFeatureCheck: true, blockhashCommitment: 'confirmed' }); if (module.exports._t && module.exports._t.onLoad) module.exports._t.onLoad(r); return r; }

async function buildPad(req) {
  const b = await body(req); const wallet = pk(b.wallet, 'connect a wallet first');
  const name = clean(b.name, 32), web = clean(b.web, 120), img = clean(b.img, 200);
  if (!name) throw new Error('give your pad a name');
  if (img && !/^https?:\/\//.test(img)) throw new Error('the logo must be a https:// link');
  if (web && !/^https?:\/\//.test(web)) throw new Error('the website must be a https:// link');
  const feePct = +b.feePct, creatorFeePct = +(b.creatorFeePct || 0);
  if (!(feePct >= 0 && feePct <= MAX_FEE_PCT)) throw new Error(`pick a pad fee between 0% and ${MAX_FEE_PCT}%`);
  if (!(creatorFeePct >= 0 && creatorFeePct <= 1)) throw new Error('pick a creator fee between 0% and 1%');
  const burn = Math.round(+b.lp?.burn * 1e4), creator = Math.round(+b.lp?.creator * 1e4); const platform = PPM - burn - creator;
  if (!(burn >= 0 && creator >= 0 && platform >= 0)) throw new Error('the LP split must add up to 100%');
  const id = padIdOf(wallet); const existing = await conn.getAccountInfo(id);
  if (existing) throw new Error(`this wallet already has a pad (${id.toBase58()}). one pad per wallet.`);
  const { ray } = await chain(); if (!ray) throw new Error('could not read Raydium’s platform settings');
  const raydium = await sdk(wallet);
  const made = await raydium.launchpad.createPlatformConfig({
    programId: PROGRAM, platformAdmin: wallet, platformClaimFeeWallet: wallet, platformLockNftWallet: wallet, platformVestingWallet: wallet,
    cpConfigId: ray.cpConfigId, migrateCpLockNftScale: { platformScale: new BN(platform), creatorScale: new BN(creator), burnScale: new BN(burn) },
    transferFeeExtensionAuth: wallet, creatorFeeRate: new BN(Math.round(creatorFeePct * 1e4)), feeRate: new BN(Math.round(feePct * 1e4)),
    name, web, img, txVersion: R.TxVersion.LEGACY, feePayer: wallet,
  });
  const r = await finish(txsOf(made), wallet, [], () => tagIx(wallet, TAG_PAD), !!b.simulate);
  return { pad: id.toBase58(), ...r };
}

async function buildLaunch(req) {
  const b = await body(req); const wallet = pk(b.wallet, 'connect a wallet first'), padId = pk(b.pad, 'pick a pad');
  const name = clean(b.name, 32), symbol = clean(b.symbol, 10).toUpperCase(), image = clean(b.image, 300);
  if (!name || !symbol) throw new Error('give the coin a name and a ticker');
  if (!/^https?:\/\/\S+$/.test(image)) throw new Error('add an image link (https://…)');
  const padAcc = await conn.getAccountInfo(padId); if (!padAcc || !padAcc.owner.equals(PROGRAM)) throw new Error('that pad doesn’t exist on LaunchLab');
  const { cfg } = await chain(); const minRaise = +cfg.minFundRaisingB.toString() / 1e9, raise = +b.raiseSol || 85;
  if (raise < minRaise) throw new Error(`LaunchLab's minimum raise is ${minRaise} SOL`); if (raise > 5000) throw new Error('the biggest raise here is 5,000 SOL');
  const meta = { n: name, s: symbol, i: image }; const d = clean(b.desc, 200); if (d) meta.d = d;
  let uri = host(req) + '/api/p4d?a=m&d=' + b64u(JSON.stringify(meta)); if (uri.length > 200) { delete meta.d; uri = host(req) + '/api/p4d?a=m&d=' + b64u(JSON.stringify(meta)); }
  if (uri.length > 200) throw new Error('that image link is too long for on-chain metadata. use a shorter link.');
  const buySol = Math.max(0, +b.buySol || 0); if (buySol > raise) throw new Error('the first buy is bigger than the whole curve');
  const mint = Keypair.generate(); const raydium = await sdk(wallet);
  const { transactions, extInfo } = await raydium.launchpad.createLaunchpad({
    programId: PROGRAM, mintA: mint.publicKey, decimals: 6, name, symbol, uri, migrateType: 'cpmm', configId: CONFIG, configInfo: cfg, mintBDecimals: 9, platformId: padId,
    txVersion: R.TxVersion.LEGACY, slippage: new BN(100), buyAmount: new BN(Math.round(buySol * 1e9)), createOnly: buySol === 0,
    supply: SUPPLY, totalSellA: SELL, totalFundRaisingB: new BN(Math.round(raise * 1e9)), totalLockedAmount: new BN(0), cliffPeriod: new BN(0), unlockPeriod: new BN(0),
    extraSigners: [mint], feePayer: wallet, computeBudgetConfig: { units: 600000, microLamports: 60000 },
  });
  const r = await finish(transactions, wallet, [mint], extra => tagIx(wallet, TAG_COIN, extra ? mint.publicKey : null), !!b.simulate);
  return { mint: mint.publicKey.toBase58(), pool: extInfo?.address?.poolId?.toBase58() || R.getPdaLaunchpadPoolId(PROGRAM, mint.publicKey, WSOL).publicKey.toBase58(), raiseSol: raise, uri, ...r };
}

async function claim(req) {
  const b = await body(req); const wallet = pk(b.wallet, 'connect a wallet first'), id = padIdOf(wallet);
  const acc = await conn.getAccountInfo(id); if (!acc) throw new Error('this wallet has no pad yet');
  const raydium = await sdk(wallet);
  const made = await raydium.launchpad.claimVaultPlatformFee({ programId: PROGRAM, platformId: id, mintB: WSOL, claimFeeWallet: wallet, txVersion: R.TxVersion.LEGACY, feePayer: wallet });
  return finish(txsOf(made), wallet, [], null, !!b.simulate);
}

async function sendTxs(req) {
  const b = await body(req); if (!Array.isArray(b.txs) || !b.txs.length || b.txs.length > 4) throw new Error('nothing to send');
  const sigs = [];
  for (const t of b.txs) { const sig = await conn.sendRawTransaction(Buffer.from(t, 'base64'), { skipPreflight: false, maxRetries: 3 }); sigs.push(sig);
    for (let k = 0; k < 30; k++) { const s = (await conn.getSignatureStatuses([sig])).value[0]; if (s && s.err) throw new Error('transaction failed: ' + JSON.stringify(s.err)); if (s && /confirmed|finalized/.test(s.confirmationStatus || '')) break; await new Promise(r => setTimeout(r, 800)); } }
  return { sigs };
}

module.exports = async (req, res) => {
  const q = new URL(req.url, 'http://x').searchParams, a = q.get('a');
  try {
    if (a === 'status') return out(res, 200, await status(), 's-maxage=30, stale-while-revalidate=120');
    if (a === 'pad') return out(res, 200, await pad(q), 's-maxage=10, stale-while-revalidate=30');
    if (a === 'pads') return out(res, 200, await pads(), 's-maxage=20, stale-while-revalidate=60');
    if (a === 'coins') return out(res, 200, await coins(q), 's-maxage=15, stale-while-revalidate=60');
    if (req.method === 'POST' && a === 'buildPad') return out(res, 200, await buildPad(req));
    if (req.method === 'POST' && a === 'buildLaunch') return out(res, 200, await buildLaunch(req));
    if (req.method === 'POST' && a === 'claim') return out(res, 200, await claim(req));
    if (req.method === 'POST' && a === 'send') return out(res, 200, await sendTxs(req));
    if (a === 'm') { const d = JSON.parse(unb64u(q.get('d') || '')); return out(res, 200, { name: d.n, symbol: d.s, description: d.d || `${d.n}, launched on a p4d pad on Raydium LaunchLab.`, image: d.i, createdOn: host(req) }, 'public, max-age=31536000, immutable'); }
    return out(res, 404, { error: 'unknown action' });
  } catch (e) { return out(res, 400, { error: e.message || String(e) }); }
};
module.exports._t = { buildPad, buildLaunch, claim, conn, setChain: v => { cache = { t: Date.now() + 1e9, v }; } };
