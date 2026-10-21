const cv = document.getElementById('c'), ctx = cv.getContext('2d');
const $ = id => document.getElementById(id);
const DIRS = { u: [0, -1], d: [0, 1], l: [-1, 0], r: [1, 0] };
const MAXL = 10;
let W = 8, H = 8, cell = 60, walls, spikes, coins, stars, start, exit, player, state = 'menu', nick = '';
let level = 1, score = 0, coinN = 0, starN = 0, deaths = 0, saved, t = 0, t0 = 0, deadT = 0, slideDir = null, acc = 0, tc = 0, ts = 0, dbc = null;
let parts = [], floats = [], trail = [], rings = [], flies = [], shake = 0, sq = 0, mv = 0, lastDir = null, faceS = 'idle', faceT = 0, act = null, act2 = null;
let acidT = 0, acidOn = false, acidSpeed = .12, acidOff = 2.5, acPct = -1;
for (let i = 0; i < 36; i++)flies.push({ x: Math.random(), y: Math.random(), p: Math.random() * 9, s: .3 + Math.random() });
(window.claude && claude.use ? claude.use('db') : Promise.resolve(null)).then(d => dbc = d).catch(() => { });

function rng(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296 } }
const K = (x, y) => y * W + x;
const isWall = (x, y) => x < 0 || y < 0 || x >= W || y >= H || walls.has(K(x, y));

// Gera a fase a partir de um caminho garantido: todas as moedas e moscas ficam nele
function gen(lv) {
  W = H = Math.min(14, 7 + Math.ceil(lv * .75));
  let tgt = 4 + Math.round(lv * 1.1);
  for (let att = 0; att < 800; att++) {
    if (att && att % 120 === 0) tgt = Math.max(3, tgt - 1);
    const R = rng(lv * 977 + att * 31 + 5);
    walls = new Set(); spikes = new Set(); coins = new Set(); stars = new Set();
    const dens = .12 + lv * .012;
    for (let i = 0; i < W * H; i++)if (R() < dens) walls.add(i);
    let sx, sy, n = 0;
    do { sx = R() * W | 0; sy = R() * H | 0; n++ } while (walls.has(K(sx, sy)) && n < 60);
    if (walls.has(K(sx, sy))) continue;
    start = { x: sx, y: sy };
    let c = { x: sx, y: sy }; const seen = new Set([K(sx, sy)]), stops = [c], vt = new Map(); let ok = false;
    for (let i = 0; i < tgt + 10; i++) {
      const opts = [];
      for (const d of Object.values(DIRS)) {
        let x = c.x, y = c.y, nw = 0; const cells = [];
        while (!isWall(x + d[0], y + d[1])) { x += d[0]; y += d[1]; cells.push(K(x, y)); if (!seen.has(K(x, y))) nw++ }
        if (cells.length) opts.push({ x, y, cells, nw });
      }
      if (!opts.length) break;
      const pool = opts.filter(o => o.nw > 0), src = pool.length ? pool : opts, o = src[R() * src.length | 0];
      const last = i + 1 >= tgt && !seen.has(K(o.x, o.y));
      o.cells.forEach((k, j) => { if (!vt.has(k)) vt.set(k, i * .85 + (j + 1) * .03) }); o.cells.forEach(k => seen.add(k)); c = { x: o.x, y: o.y }; stops.push(c);
      if (last) { ok = true; break }
    }
    if (!ok) continue;
    const aw = .14 + lv * .03; let spMax = 9;
    for (const [k, tt] of vt) { if (tt > 0) spMax = Math.min(spMax, (H - (k / W | 0) - .5 + 2.5) * .95 / tt) }
    if (spMax < aw * Math.max(0, .75 - att * .00108)) continue;
    acidSpeed = Math.max(.04, Math.min(aw, spMax)); acidOff = 2.5;
    exit = stops[stops.length - 1];
    const ek = K(exit.x, exit.y), sk = K(sx, sy);
    const mids = [...new Set(stops.map(s => K(s.x, s.y)))].filter(k => k !== ek && k !== sk);
    const ns = Math.min(mids.length, 1 + Math.floor(lv / 2));
    for (let i = 0; i < ns; i++)stars.add(mids.splice(R() * mids.length | 0, 1)[0]);
    for (const k of seen) if (k !== ek && k !== sk && !stars.has(k)) coins.add(k);
    const free = [];
    for (let k = 0; k < W * H; k++)if (!walls.has(k) && !seen.has(k)) free.push(k);
    const al = free.filter(k => stops.some(s => s.x === k % W || s.y === (k / W | 0)));
    const cand = al.length >= 3 ? al : free;
    const want = Math.min(cand.length, Math.round(2 + lv * 2.3));
    for (let i = 0; i < want; i++)spikes.add(cand.splice(R() * cand.length | 0, 1)[0]);
    tc = coins.size; ts = stars.size;
    return;
  }
}

function resize() {
  const s = Math.min(innerWidth - 12, innerHeight - 120, 940);
  cell = Math.max(16, Math.floor(s / W));
  cv.width = cv.height = cell * W;
}
function load() {
  gen(level); resize(); t0 = t;
  player = { x: start.x, y: start.y, px: start.x, py: start.y };
  saved = { score, coinN, starN }; acidT = 0; acidOn = false;
  state = 'play'; slideDir = null; faceT = 0; parts = []; trail = []; floats = []; rings = []; hud();
}
function hud() {
  $('lv').textContent = level; $('sc').textContent = score; $('dt').textContent = deaths;
  $('it').textContent = (tc - coins.size + ts - stars.size) + '/' + (tc + ts);
}
function setFace(s, d) { faceS = s; faceT = d }
function burst(x, y, col, n, sp, g) { for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, s = sp * (.3 + Math.random()); parts.push({ x: x + .5, y: y + .5, vx: Math.cos(a) * s, vy: Math.sin(a) * s, l: .5 + Math.random() * .5, col, g: g || 0 }) } }
function restart() {
  if (state !== 'play' && state !== 'dead') return;
  score = saved.score; coinN = saved.coinN; starN = saved.starN;
  load(); shake = 4; burst(start.x, start.y, '#9dff6a', 22, 4); rings.push({ x: start.x, y: start.y, r: 0, l: 1, col: '#9dff6a' });
}
$('rs').onclick = () => restart();

// ---------- telas e ranking ----------
const lget = () => { try { return JSON.parse(localStorage.getItem('gruta_rank') || '[]') } catch (e) { return [] } };
const lput = a => { try { localStorage.setItem('gruta_rank', JSON.stringify(a)) } catch (e) { } };
const nk = n => 'n_' + (String(n).toLowerCase().replace(/[^a-z0-9]/g, '') || 'anon');
async function saveScore() {
  const r = { nick, score, deaths, coins: coinN, stars: starN, ts: Date.now() };
  const a = lget(), i = a.findIndex(o => nk(o.nick) === nk(nick));
  if (i < 0) a.push(r); else if (a[i].score < score) a[i] = r;
  lput(a);
  if (dbc) { try { const d = dbc.collection('ranking').doc(nk(nick)), s = await d.get(); if (!s.exists || (s.data().score || 0) < score) await d.set(r) } catch (e) { } }
}
async function getRank() {
  if (dbc) { try { const s = await dbc.collection('ranking').orderBy('score', 'desc').limit(10).get(); return { list: s.docs.map(d => d.data()), shared: true } } catch (e) { } }
  return { list: lget(), shared: false };
}
function renderRank(el, { list, shared }) {
  list = list.slice().sort((a, b) => b.score - a.score || a.deaths - b.deaths).slice(0, 10);
  el.textContent = '';
  if (!list.length) { el.textContent = 'Ninguém jogou ainda. Seja o primeiro!'; return }
  const top = document.createElement('div'); top.className = 'top';
  top.textContent = '👑 Maior pontuação: ' + list[0].nick + ' (' + list[0].score + ' pts)'; el.append(top);
  list.forEach((r, i) => {
    const row = document.createElement('div'); row.className = 'row' + (nick && nk(r.nick) === nk(nick) ? ' me' : '');
    [['🥇', '🥈', '🥉'][i] || (i + 1) + 'º', String(r.nick), r.score + ' pts', '💀' + r.deaths].forEach(x => { const s = document.createElement('span'); s.textContent = x; row.append(s) });
    el.append(row);
  });
  const n = document.createElement('div'); n.className = 'note';
  n.textContent = shared ? 'Ranking compartilhado entre os jogadores' : 'Ranking salvo somente neste aparelho'; el.append(n);
}
function ov(title, msg, o) {
  $('ot').textContent = title; $('om').innerHTML = msg;
  $('nick').classList.toggle('hidden', !o.input); $('rk').classList.toggle('hidden', !o.rank);
  $('btn').textContent = o.btn; act = o.act;
  $('btn2').classList.toggle('hidden', !o.btn2); if (o.btn2) $('btn2').textContent = o.btn2; act2 = o.act2;
  $('overlay').classList.remove('hidden');
}
function showEntry() {
  state = 'menu';
  ov('Fuga da Cobra', 'Você é um sapo engolido por uma cobra! Deslize pelas paredes do estômago, pegue <b>todas</b> as moedas e moscas, desvie dos ossos de sapos mortos e fuja pelo portal antes que o <b>ácido</b> suba! Setas / WASD ou deslize o dedo.',
    { input: 1, btn: 'Começar a fuga', act: startGame, btn2: '🏆 Ranking', act2: () => showRank(false) });
}
async function showRank(final) {
  ov(final ? 'Você escapou!' : '🏆 Ranking', final ? 'Você fez <b>' + score + '</b> pontos com <b>' + deaths + '</b> mortes.' : 'Melhores fugitivos',
    { rank: 1, btn: final ? 'Jogar de novo' : 'Voltar', act: showEntry });
  $('rk').textContent = 'Carregando...';
  renderRank($('rk'), await getRank());
}
function startGame() {
  nick = $('nick').value.trim().slice(0, 12) || 'Anônimo';
  level = 1; score = coinN = starN = deaths = 0; $('overlay').classList.add('hidden'); load();
}
$('btn').onclick = () => act && act();
$('btn2').onclick = () => act2 && act2();
$('nick').addEventListener('keydown', e => { if (e.key === 'Enter') startGame() });

// ---------- controle ----------
function go(dn) { if (state !== 'play' || slideDir) return; slideDir = DIRS[dn]; lastDir = slideDir; mv = 0; acc = 0; acidOn = true }
function acidKill() { state = 'dead'; deadT = 0; slideDir = null; deaths++; hud(); setFace('dead', 9); shake = 14; burst(player.x, player.y, '#9dff6a', 40, 5, 6); burst(player.x, player.y, '#d6ffb0', 16, 4, 6) }
function acidHud() { const v = Math.max(0, Math.min(100, Math.round((acidSpeed * acidT - acidOff) / H * 100))); if (v !== acPct) { acPct = v; $('ac').textContent = v + '%' } }
function step() {
  const d = slideDir;
  if (isWall(player.x + d[0], player.y + d[1])) {
    slideDir = null;
    if (mv > 0) { shake = 6; sq = 1; setFace('hit', .8); burst(player.x, player.y, '#c9a24a', 10, 2.5); rings.push({ x: player.x + d[0] * .5, y: player.y + d[1] * .5, r: 0, l: 1, col: '#c9a24a' }) }
    return;
  }
  trail.push({ x: player.x, y: player.y, l: 1 }); player.x += d[0]; player.y += d[1]; mv++;
  const k = K(player.x, player.y);
  if (coins.delete(k)) { score += 10; coinN++; hud(); setFace('happy', .45); burst(player.x, player.y, '#ffd166', 10, 3); floats.push({ x: player.x, y: player.y, txt: '+10', col: '#ffd166', l: .7 }) }
  if (stars.delete(k)) { score += 50; starN++; hud(); setFace('happy', .7); burst(player.x, player.y, '#d8d8e0', 24, 4.5); shake = 3; rings.push({ x: player.x, y: player.y, r: 0, l: 1, col: '#d8d8e0' }); floats.push({ x: player.x, y: player.y, txt: '+50', col: '#d8d8e0', l: .9 }) }
  if (spikes.has(k)) {
    state = 'dead'; deadT = 0; slideDir = null; deaths++; hud(); setFace('dead', 9); shake = 14;
    burst(player.x, player.y, '#d62828', 34, 5.5, 9); burst(player.x, player.y, '#9dff6a', 14, 4, 9); return;
  }
  if (player.x === exit.x && player.y === exit.y) {
    slideDir = null; setFace('win', 9); shake = 6;
    const perfect = !coins.size && !stars.size;
    if (perfect) { score += 100; floats.push({ x: player.x, y: player.y - .5, txt: 'PERFEITO +100', col: '#ffd166', l: 1.4 }) }
    hud(); burst(player.x, player.y, '#6bffb8', 44, 5); rings.push({ x: player.x, y: player.y, r: 0, l: 1, col: '#6bffb8' });
    const left = coins.size + stars.size;
    if (level >= MAXL) { state = 'over'; setTimeout(async () => { await saveScore(); showRank(true) }, 900) }
    else { state = 'won'; setTimeout(() => ov('Fase ' + level + ' completa!', (perfect ? '✨ <b>PERFEITO!</b> Você pegou tudo (+100).' : 'Faltaram <b>' + left + '</b> itens. Dá para pegar todos!') + '<br>Pontos: <b>' + score + '</b> · Mortes: <b>' + deaths + '</b>', { btn: 'Fase ' + (level + 1), act: () => { $('overlay').classList.add('hidden'); level++; load() } }), 900) }
  }
}
addEventListener('keydown', e => {
  if (state !== 'play' && state !== 'dead') return;
  if (e.key === 'r' || e.key === 'R') { e.preventDefault(); restart(); return }
  const m = { ArrowUp: 'u', w: 'u', W: 'u', ArrowDown: 'd', s: 'd', S: 'd', ArrowLeft: 'l', a: 'l', A: 'l', ArrowRight: 'r', d: 'r', D: 'r' }[e.key];
  if (m) { e.preventDefault(); go(m) }
});
let tx, ty;
cv.addEventListener('touchstart', e => { tx = e.touches[0].clientX; ty = e.touches[0].clientY }, { passive: true });
cv.addEventListener('touchend', e => {
  const dx = e.changedTouches[0].clientX - tx, dy = e.changedTouches[0].clientY - ty;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 20) return;
  go(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'r' : 'l') : (dy > 0 ? 'd' : 'u'));
});
addEventListener('resize', resize);

// ---------- desenho (pixel art) ----------
const PAL = { b: '#b5485f', L: '#e8869a', D: '#6b1a30', y: '#b8860b', Y: '#ffd23f', w: '#fff6b0', o: '#e0a800', c: '#d8d8e0', W: '#ffffff', r: '#ff3b4f', x: '#e8e2cf', d: '#8a8470', f: '#cfe8ff', n: '#2b2b33', h: '#6a6a7a', k: '#1a1a1a', g: '#5c8f5a', G: '#35573a', u: '#1f3322' };
const SPR = {
  wall: ["bbbbbbbb", "bLLbbbDb", "bLbbbDDb", "bbbDDbbb", "bbDDDbLb", "bDbbbLLb", "bbbLbbbb", "DDDDDDDD"],
  coin: ["..yyyy..", ".yYYYYy.", "yYYwYYYy", "yYwYYYYy", "yYYYYYYy", "yYYYYYoy", ".yYYYYy.", "..yyyy.."],
  fly0: ["f......f", "ff....ff", ".ffnnff.", "..rnnr..", "..nnnn..", "..nhhn..", "..nnnn..", "...nn..."],
  fly1: ["........", "........", "fffnnfff", ".frnnrf.", "..nnnn..", "..nhhn..", "..nnnn..", "...nn..."],
  spike: ["xx....xx", "xxx..xxx", ".xxxxxx.", "..xxxd..", "..dxxx..", ".xxxxxx.", "xxx..xxx", "xx....xx"]
};
function spr(rows, X, Y, c, flip) {
  const n = rows.length, p = c / n;
  for (let i = 0; i < n; i++)for (let j = 0; j < n; j++) {
    const ch = rows[i][flip ? n - 1 - j : j]; if (ch === '.') continue;
    const x0 = Math.round(X + j * p), y0 = Math.round(Y + i * p);
    ctx.fillStyle = PAL[ch]; ctx.fillRect(x0, y0, Math.max(1, Math.round(X + (j + 1) * p) - x0), Math.max(1, Math.round(Y + (i + 1) * p) - y0));
  }
}
function frog(cx, cy, s, st) {
  const u = s / 14, ox = cx - s / 2, oy = cy - s * .48;
  const R = (x, y, w, h, col) => { const x0 = Math.round(ox + x * u), y0 = Math.round(oy + y * u); ctx.fillStyle = col; ctx.fillRect(x0, y0, Math.max(1, Math.round(ox + (x + w) * u) - x0), Math.max(1, Math.round(oy + (y + h) * u) - y0)) };
  const K = '#0f3a1c', G = st === 'dead' ? '#8fc9a0' : '#4cd964', Dk = st === 'dead' ? '#6aa37c' : '#2a9d44', B = '#d6f7b5', P = '#ff6b9a';
  const d = slideDir || [0, 0], fx_ = slideDir ? -d[0] * 2 : 0, fy_ = slideDir ? -d[1] * 2 : 0;
  R(2, 13, 10, 1, 'rgba(0,0,0,.35)');
  R(fx_, 11 + fy_, 5, 2, K); R(1 + fx_, 11 + fy_, 3, 1, G); R(9 + fx_, 11 + fy_, 5, 2, K); R(10 + fx_, 11 + fy_, 3, 1, G);
  R(1, 4, 12, 8, K); R(2, 5, 10, 6, G); R(5, 8, 4, 2, B); R(3, 6, 1, 1, Dk); R(10, 7, 1, 1, Dk); R(2, 9, 1, 1, Dk); R(11, 9, 1, 1, Dk);
  R(1, 0, 5, 5, K); R(8, 0, 5, 5, K); R(2, 1, 3, 3, '#fff'); R(9, 1, 3, 3, '#fff');
  for (const e of [2, 9]) {
    const L = e === 2;
    if (st === 'hit') { (L ? [[2, 1], [3, 2], [4, 2], [2, 3]] : [[11, 1], [10, 2], [9, 2], [11, 3]]).forEach(q => R(q[0], q[1], 1, 1, K)) }
    else if (st === 'dead') { [[0, 1], [2, 1], [1, 2], [0, 3], [2, 3]].forEach(q => R(e + q[0], q[1], 1, 1, '#e63946')) }
    else if (st === 'happy') { R(e, 2, 1, 1, K); R(e + 1, 1, 1, 1, K); R(e + 2, 2, 1, 1, K) }
    else if (st === 'win') { [[1, 1], [0, 2], [1, 2], [2, 2], [1, 3]].forEach(q => R(e + q[0], q[1], 1, 1, '#ffb703')) }
    else if (st === 'idle' && t % 3.4 < .14) { R(e, 1, 3, 3, G); R(e, 2, 3, 1, K) }
    else R(e + .5 + d[0] * .5, 1.5 + d[1] * .5, 2, 2, '#101010');
  }
  if (st === 'hit') { R(4, 6, 2, 1, K); R(6, 7, 2, 1, K); R(8, 6, 2, 1, K) }
  else if (st === 'dead') { R(4, 6, 6, 1, K); R(7, 7, 2, 3, P) }
  else if (st === 'happy' || st === 'win') { R(3, 5, 1, 1, K); R(10, 5, 1, 1, K); R(4, 6, 6, 1, K); R(5, 7, 4, 1, '#c1121f') }
  else if (st === 'slide') { R(5, 6, 4, 2, K) }
  else { R(3, 5, 1, 1, K); R(4, 6, 6, 1, K); R(10, 5, 1, 1, K) }
  if (st === 'happy') { const a = lastDir || [0, 1]; if (a[0] > 0) R(7, 6, 8, 1, P); else if (a[0] < 0) R(-1, 6, 8, 1, P); else if (a[1] < 0) R(6.5, -5, 1, 9, P); else R(6.5, 7, 1, 8, P) }
  if (st === 'hit') for (let i = 0; i < 3; i++) { const a = t * 8 + i * 2.09; ctx.fillStyle = '#ffd23f'; ctx.fillRect(Math.round(ox + 7 * u + Math.cos(a) * 6 * u), Math.round(oy - 1.5 * u + Math.sin(a) * 1.5 * u), Math.ceil(u * 1.4), Math.ceil(u * 1.4)) }
}
function draw() {
  const c = cell, w = cv.width, p = c / 8;
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#3a0a10'; ctx.fillRect(0, 0, w, w);
  ctx.save(); if (shake > 0) ctx.translate(Math.round((Math.random() - .5) * shake), Math.round((Math.random() - .5) * shake));
  const ready = !coins.size && !stars.size;
  for (let y = 0; y < H; y++)for (let x = 0; x < W; x++) {
    const k = K(x, y), X = x * c, Y = y * c, a = Math.min(1, Math.max(0, (t - t0) * 3 - (x + y) * .08));
    if (a <= 0) continue; ctx.globalAlpha = a;
    ctx.fillStyle = (x + y) % 2 ? '#451018' : '#3b0b12'; ctx.fillRect(X, Y, c, c);
    if ((x * 7 + y * 3) % 3 === 0) { const bp = (t * .5 + x * .37 + y * .61) % 1; ctx.fillStyle = 'rgba(255,150,150,.35)'; ctx.fillRect(Math.round(X + c * .2 + ((x * 13 + y * 5) % 5) * c * .12), Math.round(Y + c * (1 - bp)), Math.ceil(p), Math.ceil(p)) }
    if (walls.has(k)) spr(SPR.wall, X, Y + Math.round(Math.sin(t * 1.6 + x * .7 + y * .7) * p * .6), c, (x + y * 3) % 2);
    if (spikes.has(k)) spr(SPR.spike, X, Y, c, (x * 5 + y) % 2);
    if (coins.has(k)) {
      ctx.save(); ctx.translate(X + c / 2, Y + c / 2); ctx.scale(Math.max(.2, Math.abs(Math.cos(t * 3 + x + y))), 1);
      spr(SPR.coin, -c * .3, -c * .3 + Math.round(Math.sin(t * 3 + x) * p * .5), c * .6); ctx.restore();
    }
    if (stars.has(k)) {
      const jx = Math.round(Math.sin(t * 9 + x * 3) * p * .7), jy = Math.round(Math.cos(t * 11 + y * 2) * p * .7); spr(Math.floor(t * 14 + x) % 2 ? SPR.fly1 : SPR.fly0, X + c * .1 + jx, Y + c * .1 + jy, c * .8);
    }
    ctx.globalAlpha = 1;
  }
  // bolhas de ácido subindo
  ctx.strokeStyle = 'rgba(157,255,106,.3)'; ctx.lineWidth = 1;
  for (const f of flies) { const by2 = (((f.y - t * .03 * f.s) % 1) + 1) % 1 * w, bx = f.x * w + Math.sin(t * f.s + f.p) * 10; ctx.strokeRect(Math.round(bx), Math.round(by2), Math.ceil(p * 1.5), Math.ceil(p * 1.5)) }
  // portal
  const ex = exit.x * c + c / 2, ey = exit.y * c + c / 2, pc = ready ? '#ffd23f' : '#6bffb8';
  for (let i = 0; i < 14; i++) { const a = t * 3 + i * .7, r = c * (.1 + .24 * i / 13), z = Math.ceil(p * 1.4); ctx.fillStyle = i % 2 ? pc : '#e8fff1'; ctx.fillRect(Math.round(ex + Math.cos(a) * r - z / 2), Math.round(ey + Math.sin(a) * r - z / 2), z, z) }
  // rastro
  for (const q of trail) { const z = Math.ceil(c * .28 * q.l); ctx.fillStyle = 'rgba(157,255,106,' + (Math.max(0, q.l) * .5) + ')'; ctx.fillRect(Math.round((q.x + .5) * c - z / 2), Math.round((q.y + .5) * c - z / 2), z, z) }
  // ácido
  const ar = acidSpeed * acidT - acidOff;
  if (ar > 0) {
    const top = Math.round((H - ar) * c), z = Math.ceil(p);
    for (let X2 = 0; X2 < w; X2 += z) {
      const yy = top + Math.round(Math.sin(t * 5 + X2 / c * 3) * p * .8 + Math.sin(t * 9 + X2 / c * 7) * p * .4);
      ctx.fillStyle = 'rgba(110,230,40,.86)'; ctx.fillRect(X2, yy, z, w - yy);
      ctx.fillStyle = '#d6ffb0'; ctx.fillRect(X2, yy, z, z);
    }
    ctx.fillStyle = 'rgba(30,120,20,.35)';
    for (let yy = top + c * .6; yy < w; yy += c * .5)ctx.fillRect(0, Math.round(yy), w, z);
    ctx.strokeStyle = 'rgba(214,255,176,.7)'; ctx.lineWidth = 1;
    for (let i = 0; i < 14; i++) { const bx = ((i * 97) % 100) / 100 * w, by = w - ((t * .25 * (1 + i % 3) + i * .19) % 1) * (w - top); ctx.strokeRect(Math.round(bx), Math.round(by), Math.ceil(p * 1.6), Math.ceil(p * 1.6)) }
  }
  // sapo
  const cx = player.px * c + c / 2, cy = player.py * c + c / 2;
  ctx.save();
  if (state === 'dead') ctx.globalAlpha = Math.max(0, 1 - Math.max(0, deadT - .6) * 2.5);
  let sxv = 1, syv = 1;
  if (slideDir) { sxv = slideDir[0] ? 1.25 : .85; syv = slideDir[1] ? 1.25 : .85 }
  else if (state === 'dead') { sxv = 1 + Math.min(deadT * 2, .5); syv = Math.max(.4, 1 - deadT * 1.4) }
  else if (sq > 0) { const h = lastDir && lastDir[0]; sxv = h ? 1 - sq * .3 : 1 + sq * .3; syv = h ? 1 + sq * .3 : 1 - sq * .3 }
  const by = cy + (state === 'dead' ? c * .2 * Math.min(1, deadT * 2) : 0) + (state === 'play' && !slideDir ? Math.round(Math.sin(t * 3) * p * .4) : 0);
  ctx.translate(cx, by); ctx.scale(sxv, syv); ctx.translate(-cx, -by);
  frog(cx, by, c * .9, faceT > 0 ? faceS : (slideDir ? 'slide' : 'idle'));
  ctx.restore();
  // ondas, partículas e textos
  for (const r of rings) { ctx.globalAlpha = Math.max(0, r.l); ctx.strokeStyle = r.col; ctx.lineWidth = Math.ceil(p * .8); ctx.strokeRect(Math.round((r.x + .5 - r.r) * c), Math.round((r.y + .5 - r.r) * c), Math.round(r.r * 2 * c), Math.round(r.r * 2 * c)) }
  for (const q of parts) { ctx.globalAlpha = Math.max(0, q.l); ctx.fillStyle = q.col; ctx.fillRect(Math.round(q.x * c), Math.round(q.y * c), Math.ceil(c * .09), Math.ceil(c * .09)) }
  ctx.font = Math.floor(c * .26) + "px 'Press Start 2P',monospace"; ctx.textAlign = 'center';
  for (const f of floats) { ctx.globalAlpha = Math.min(1, f.l * 2); ctx.fillStyle = '#000'; ctx.fillText(f.txt, (f.x + .5) * c + 2, f.y * c + 2); ctx.fillStyle = f.col; ctx.fillText(f.txt, (f.x + .5) * c, f.y * c) }
  ctx.globalAlpha = 1;
  if (state === 'play' && acidOn && H - (acidSpeed * acidT - acidOff) - player.y < 3.2) { ctx.fillStyle = 'rgba(255,40,40,' + (.07 + .07 * Math.sin(t * 14)) + ')'; ctx.fillRect(0, 0, w, w) }
  if (state === 'dead') { ctx.fillStyle = 'rgba(214,40,40,' + Math.min(.4, deadT) + ')'; ctx.fillRect(0, 0, w, w) }
  ctx.restore();
  ctx.fillStyle = 'rgba(0,0,0,.12)'; for (let y = 0; y < w; y += 4)ctx.fillRect(0, y, w, 1);
}
function fx(dt) {
  for (const p of parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= .96; p.vy = p.vy * .96 + p.g * dt; p.l -= dt }
  parts = parts.filter(p => p.l > 0);
  for (const f of floats) { f.y -= dt * 1.2; f.l -= dt } floats = floats.filter(f => f.l > 0);
  for (const r of rings) { r.r += dt * 3; r.l -= dt * 2 } rings = rings.filter(r => r.l > 0);
  for (const q of trail) q.l -= dt * 3.5; trail = trail.filter(q => q.l > 0);
  shake = Math.max(0, shake - dt * 40); sq = Math.max(0, sq - dt * 5);
  if (faceT > 0 && faceS !== 'dead' && faceS !== 'win') faceT -= dt;
}
let last = performance.now();
function loop(now) {
  const dt = Math.min(.05, (now - last) / 1000); last = now; t += dt;
  if (state === 'play' && acidOn) { acidT += dt; if (H - (acidSpeed * acidT - acidOff) <= player.y + .5) acidKill() }
  if (state === 'play' && slideDir) { acc += dt; while (acc >= .03 && slideDir && state === 'play') { acc -= .03; step() } }
  if (state === 'dead') { deadT += dt; if (deadT > 1.2) { score = saved.score; coinN = saved.coinN; starN = saved.starN; load() } }
  player.px += (player.x - player.px) * Math.min(1, dt * 28);
  player.py += (player.y - player.py) * Math.min(1, dt * 28);
  fx(dt); draw(); acidHud();
  requestAnimationFrame(loop);
}
gen(1); resize(); player = { x: start.x, y: start.y, px: start.x, py: start.y }; hud(); showEntry();
requestAnimationFrame(loop);
