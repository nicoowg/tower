// Alt det, man ser: 3D-banen, figurerne og effekterne. Reglerne ligger i sim.js; her bliver de kun vist.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { TAARNE, FJENDER, FELT, VEJ } from './data.js';
import { pers, saetning, RAAB, VARIGHED, vaelgHandling, pose } from './sind.js';
import { tal, DRONEBANE, tagVed, TAGBONUS, tilVej } from './sim.js';
import { klaed, klaedOm, klaedHelt, kantLys } from './stof.js';
import { tema } from './stil.js';
import { pynt, pyntSkridt, EFFEKT } from './pynt.js';

const K = 0.05;                                   // banens enheder -> meter i rummet
const FIG = 1.3;                                  // figurerne er lidt større end deres plads på banen, så de kan ses
const X = (x) => (x - FELT.b / 2) * K, Z = (y) => (y - FELT.h / 2) * K;
// monstre med 'lign' har ingen egen model endnu og låner en andens
const NAVNE = [...TAARNE.map((t) => t.id), ...Object.keys(FJENDER).filter((k) => !FJENDER[k].lign), 'enhed', 'borg', 'jeep', 'apc', 'kampvogn'];
const M = {};
const ROED = 0xdb242e, ORANGE = 0xff9e33;

export async function hentModeller(fremskridt) {
  const l = new GLTFLoader(); let n = 0;
  // de nye monstre: tre udgaver af hver type (model/helte/monstre.py). Mangler en, bruges den gamle.
  const nye = Object.keys(FJENDER).filter((k) => !FJENDER[k].lign || FJENDER[k].egen).flatMap((t) => [0, 1, 2].map((v) => [t, v]));
  const monstre = Promise.all(nye.map(async ([t, v]) => {
    try { const g = await l.loadAsync(`model/monster/${t}_${v}.glb`); g.scene.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } }); smaaSkygge(g.scene); klaedHelt(g.scene); M[`monster:${t}:${v}`] = g.scene; } catch {}
  }));
  await Promise.all([monstre, ...NAVNE.map(async (navn) => {
    const g = await l.loadAsync(`model/${navn}.glb`);
    g.scene.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
    klaed(navn, g.scene);
    M[navn] = g.scene; fremskridt?.(++n / NAVNE.length);
  })]);
}

// De nye helte: én model pr. tårn og outfit (model/helte/spil.py). Hentes, når de skal bruges.
const heltHent = new Map();
export const heltNoegle = (id, tema_) => `helt:${id}:${tema_ || 'std'}`;
export function hentHelt(id, tema_ = 'std') {
  const k = heltNoegle(id, tema_);
  if (!heltHent.has(k)) heltHent.set(k, new GLTFLoader().loadAsync(`model/helt/${id}_${tema_}.glb`).then((g) => {
    g.scene.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
    halsLed(g.scene); smaaSkygge(g.scene); klaedHelt(g.scene); kantLys(g.scene, tema(tema_)); M[k] = g.scene; return g.scene;
  }).catch(() => { M[k] = null; return null; }));
  return heltHent.get(k);
}
// Små dele (knapper, fingre, øjne, spænder) kaster ikke skygge: i kampen er skyggen få punkter, men hver del koster en ekstra tegning i skyggekortet.
// Med 17 helte og mange monstre var det over 1200 ekstra tegninger pr. billede.
function smaaSkygge(rod) {
  rod.updateMatrixWorld(true);
  const H = new THREE.Box3().setFromObject(rod).getSize(new THREE.Vector3()).y || 1, b = new THREE.Box3(), v = new THREE.Vector3();
  rod.traverse((o) => { if (o.isMesh && b.setFromObject(o).getSize(v).length() < H * 0.15) o.castShadow = false; });
}
// Heltenes 'hoved' ligger ved fødderne i modellen, så hovedet svingede rundt om fødderne.
// Her flyttes leddet op i halsen (lige over hagen), og delene flyttes tilsvarende tilbage.
function halsLed(rod) {
  rod.updateMatrixWorld(true);
  const ledd = [];
  rod.traverse((o) => { if (/^hoved/.test(o.name) && !o.isMesh && o.position.lengthSq() < 1e-6) ledd.push(o); });
  for (const h of ledd) {
    const box = new THREE.Box3();
    h.traverse((o) => { if (o.isMesh) box.expandByObject(o); });
    if (box.isEmpty()) continue;
    const inv = h.matrixWorld.clone().invert(), lo = box.min.clone().applyMatrix4(inv), hi = box.max.clone().applyMatrix4(inv);
    const p = new THREE.Vector3((lo.x + hi.x) / 2, Math.min(lo.y, hi.y) + Math.abs(hi.y - lo.y) * 0.15, (lo.z + hi.z) / 2);
    for (const c of h.children) c.position.sub(p);
    h.position.add(p);
  }
}
export const hentHelte = (par) => Promise.all(par.map(([id, t]) => hentHelt(id, t)));
export const heltKlar = (id, t) => M[heltNoegle(id, t)] !== undefined;
const helt = (id, tema_) => M[heltNoegle(id, tema_)] || null;

// Byerne er store, så de hentes først, når man vælger banen.
export async function hentBy(navn) {
  if (M[navn]) return;
  const g = await new GLTFLoader().loadAsync(`model/${navn}.glb`);
  const bevaeger = /^(spin|tog|baad|bus|kabine|faerge|jolle)/;
  g.scene.traverse((o) => {
    if (o.isMesh) { o.castShadow = false; o.receiveShadow = true; o.frustumCulled = true; }
    let p = o, flytter = false; while (p) { if (bevaeger.test(p.name)) flytter = true; p = p.parent; }
    if (!flytter) { o.updateMatrix(); o.matrixAutoUpdate = false; }
  });
  klaed(navn, g.scene); M[navn] = g.scene;
}

// Viser de dele, der hører til tårnets trin (0-4): op<n> kommer frem fra trin n, ned<n> forsvinder fra trin n.
function visTrin(rod, trin) {
  rod.traverse((o) => {
    let m = /^op(\d)/.exec(o.name); if (m) { o.visible = trin >= +m[1]; return; }
    m = /^ned(\d)/.exec(o.name); if (m) o.visible = trin < +m[1];
  });
}

function miljoe(renderer, scene) {
  const p = new THREE.PMREMGenerator(renderer);
  scene.environment = p.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.55;
}

// Farverne på byernes grund. Nordlys ligger i sne, Tokyo har lyserøde blade overalt.
const GRUND = {
  std: { g: ['#0e1016', '#0a0b10', '#07080c'], park: '#0b1810', parkkant: 'rgba(120,210,150,.10)', plads: '#17181c', fortov: '#10121a', vand: '#06111b', vandkant: 'rgba(130,185,230,.26)', bro: '#1a1b20', vej: '#1b1c21' },
  sakura: { g: ['#120f15', '#0e0b11', '#0a080c'], park: '#24121b', parkkant: 'rgba(255,150,190,.16)', plads: '#1b161d', fortov: '#151118', vand: '#070b18', vandkant: 'rgba(255,170,200,.22)', bro: '#3a1414', vej: '#1a1720', drys: ['rgba(255,170,200,.55)', 'rgba(255,200,220,.4)'] },
  tech: { g: ['#090a16', '#070812', '#05060c'], park: '#0a0c18', parkkant: 'rgba(45,240,255,.2)', plads: '#0d0f1e', fortov: '#0b0d1a', vand: '#050814', vandkant: 'rgba(45,240,255,.3)', bro: '#121426', vej: '#10121f', gitter: true },
  sne: { g: ['#7a8594', '#6c7685', '#56606e'], park: '#8d98a6', parkkant: 'rgba(255,255,255,.18)', plads: '#7d8896', fortov: '#8a95a3', vand: '#9cb4c6', vandkant: 'rgba(255,255,255,.5)', bro: '#3a3f48', vej: '#2c3038', drys: ['rgba(255,255,255,.35)', 'rgba(210,225,240,.3)'] },
};
// Dæmpning: banerne skal se virkelige og lidt mørke ud, ikke som legetøj. Klare, lyse farver tages mest ned,
// mørke farver næsten ikke. Bruges på grunden, byens modeller, havet, himlen og disen. Lys, der gløder, røres ikke.
const DAEMP = { s: 0.7, l: 0.82, top: 0.62 };
const hsl_ = {};
function daempFarve(c) {
  c.getHSL(hsl_, THREE.SRGBColorSpace);
  const l = hsl_.l * DAEMP.l, top = DAEMP.top;
  c.setHSL(hsl_.h, hsl_.s * DAEMP.s, l > top * 0.75 ? top * 0.75 + (l - top * 0.75) * 0.45 : l, THREE.SRGBColorSpace);
  return c;
}
const daempHex = (x) => daempFarve(new THREE.Color(x)).getHex();
function daempLaerred(c) {
  const ud = document.createElement('canvas'); ud.width = c.width; ud.height = c.height;
  const k = ud.getContext('2d'); k.filter = `saturate(${DAEMP.s}) brightness(${DAEMP.l}) contrast(1.06)`; k.drawImage(c, 0, 0);
  return ud;
}
function daempModel(rod) {
  rod.traverse((o) => {
    if (!o.isMesh) return;
    for (const m of [].concat(o.material)) {
      if (!m || m.userData.daempet || !m.color) continue;
      m.userData.daempet = true;
      const gloeder = m.emissive && m.emissive.getHex() !== 0 && m.emissiveIntensity > 0;
      if (gloeder && /^(fyr|rude|neon|krone|lys|lampe|lanterne|baal|glod|lava)/.test(m.name)) continue;
      daempFarve(m.color); if (/vand|hav/.test(m.name)) daempFarve(m.color);      // vand dobbelt: ellers lyser havet op som en swimmingpool
      if (gloeder) { daempFarve(m.emissive); m.emissiveIntensity *= /vand|hav/.test(m.name) ? 0.35 : 0.7; }      // vand og flader, der lyser af sig selv, skal ikke stråle
      if (m.roughness !== undefined) m.roughness = Math.min(1, m.roughness + 0.06);
    }
  });
}
function grundBillede(bane) {
  const P = GRUND[bane.tema] || GRUND.std;
  const oe = !!bane.oe, by = !!bane.vand && !oe, pr = by ? 26 : 32, m = by ? 40 : 24, c = document.createElement('canvas');
  c.width = (FELT.b * K + m * 2) * pr; c.height = (FELT.h * K + m * 2) * pr;
  const k = c.getContext('2d'), s = pr * K;
  k.fillStyle = by ? P.g[2] : '#050506'; k.fillRect(0, 0, c.width, c.height);
  k.translate(m * pr, m * pr); k.scale(s, s);
  const flade = (p) => { k.beginPath(); p.forEach((q, i) => (i ? k.lineTo(q[0], q[1]) : k.moveTo(q[0], q[1]))); k.closePath(); };
  let f = k.createRadialGradient(FELT.b / 2, FELT.h / 2, 100, FELT.b / 2, FELT.h / 2, 1150);
  if (by) { f.addColorStop(0, P.g[0]); f.addColorStop(0.6, P.g[1]); f.addColorStop(1, P.g[2]); } else { f.addColorStop(0, '#111216'); f.addColorStop(0.55, '#0b0c0f'); f.addColorStop(1, '#050506'); }
  k.fillStyle = f; k.fillRect(-m / K, -m / K, c.width / s, c.height / s);
  f = k.createRadialGradient(260, 60, 0, 260, 60, 900);
  f.addColorStop(0, 'rgba(219,36,46,.13)'); f.addColorStop(1, 'rgba(219,36,46,0)');
  k.fillStyle = f; k.fillRect(-m / K, -m / K, c.width / s, c.height / s);
  if (by) {                              // byens grund: parker, pladser, vand og broer
    for (const p of bane.park) { flade(p); k.fillStyle = P.park; k.fill(); k.lineWidth = 1.5; k.strokeStyle = P.parkkant; k.stroke(); }
    for (const p of bane.plads) { flade(p); k.fillStyle = P.plads; k.fill(); }
    k.fillStyle = P.fortov;                       // fortove: hver karré står på sin egen flade med gader imellem
    for (const [a, b, c2, d] of bane.fortov) { k.beginPath(); k.roundRect(a - 5, b - 5, c2 - a + 10, d - b + 10, 6); k.fill(); }
  }
  k.fillStyle = 'rgba(255,255,255,.07)';
  if (!by) for (let x = 40; x < FELT.b; x += 40) for (let y = 40; y < FELT.h; y += 40) { k.beginPath(); k.arc(x, y, 1.3, 0, 7); k.fill(); }
  if (oe) {                                     // øen: græs, sten og sø. Alt uden for kysten er gennemsigtigt
    k.clearRect(-m / K, -m / K, c.width / s, c.height / s);
    k.save(); flade(bane.land); k.clip();
    const OG = bane.stil ? [bane.stil.graes[0], bane.stil.graes[1], bane.stil.sand] : { miami: ['#4f9a56', '#3a7a44', '#e8d2a6'], lagune: ['#1d4a2c', '#12301d', '#bfa77e'] }[bane.oeTema] || ['#234a2c', '#16301e', null];
    f = k.createRadialGradient(760, 430, 60, 760, 430, 900); f.addColorStop(0, OG[0]); f.addColorStop(1, OG[1]); k.fillStyle = f; k.fillRect(0, 0, FELT.b, FELT.h);
    let fr = 7; const tf = () => (fr = (fr * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 520; i++) { k.fillStyle = tf() < 0.5 ? 'rgba(10,26,14,.16)' : 'rgba(120,170,96,.07)'; k.beginPath(); k.ellipse(tf() * FELT.b, tf() * FELT.h, 8 + tf() * 34, 5 + tf() * 18, tf() * 3, 0, 7); k.fill(); }
    for (let i = 0; i < 260; i++) { k.fillStyle = 'rgba(70,74,78,.5)'; k.beginPath(); k.ellipse(tf() * FELT.b, tf() * FELT.h, 1.5 + tf() * 4, 1 + tf() * 3, tf() * 3, 0, 7); k.fill(); }
    if (OG[2]) { k.lineWidth = 90; k.strokeStyle = OG[2]; flade(bane.land); k.stroke(); k.lineWidth = 26; k.strokeStyle = 'rgba(0,0,0,.12)'; k.stroke(); }      // sandstrand langs kysten
    else { k.lineWidth = 14; k.strokeStyle = 'rgba(8,16,10,.5)'; flade(bane.land); k.stroke(); }
    for (const p of bane.vand) { flade(p); k.fillStyle = bane.stil?.soe || { miami: '#3fc8d8', lagune: '#0c4a58' }[bane.oeTema] || '#0d2733'; k.fill(); k.lineWidth = 3; k.strokeStyle = 'rgba(190,225,240,.3)'; k.stroke(); }
    k.restore();
    for (const p of bane.bro) { flade(p); k.fillStyle = '#4a3320'; k.fill(); }
  } else if (bane.vand) {
    for (const p of bane.vand) { flade(p); k.fillStyle = P.vand; k.fill(); k.lineWidth = 2.5; k.strokeStyle = P.vandkant; k.stroke(); }
    if (P.gitter) { k.lineWidth = 1.2; for (let x = -200; x < 1800; x += 40) { k.strokeStyle = x % 200 ? 'rgba(45,240,255,.05)' : 'rgba(45,240,255,.14)'; k.beginPath(); k.moveTo(x, -200); k.lineTo(x, 1100); k.stroke(); } for (let y = -200; y < 1100; y += 40) { k.strokeStyle = y % 200 ? 'rgba(255,45,154,.04)' : 'rgba(255,45,154,.12)'; k.beginPath(); k.moveTo(-200, y); k.lineTo(1800, y); k.stroke(); } }      // lysende gitter i jorden
    if (P.drys) { let fr = 5; const tf = () => (fr = (fr * 16807) % 2147483647) / 2147483647; for (let i = 0; i < 2600; i++) { k.fillStyle = P.drys[i % 2]; k.beginPath(); k.ellipse(-200 + tf() * 2000, -200 + tf() * 1300, 1 + tf() * 2.6, 0.8 + tf() * 1.6, tf() * 3, 0, 7); k.fill(); } }      // blade eller sne drysset ud over alt
    for (const p of bane.bro) { flade(p); k.fillStyle = P.bro; k.fill(); k.lineWidth = 1.5; k.strokeStyle = 'rgba(255,255,255,.16)'; k.stroke(); }
  }
  const vej = () => { k.beginPath(); bane.p.forEach((q, i) => (i ? k.lineTo(q[0], q[1]) : k.moveTo(q[0], q[1]))); };
  k.lineJoin = k.lineCap = 'round';
  vej(); k.lineWidth = VEJ + 5; k.strokeStyle = 'rgba(255,255,255,.2)'; k.stroke();
  vej(); k.lineWidth = VEJ; k.strokeStyle = bane.stil?.vej_ || (oe ? '#3a3732' : P.vej); k.stroke();
  vej(); k.lineWidth = 2; k.setLineDash([14, 22]); k.strokeStyle = 'rgba(255,255,255,.10)'; k.stroke();
  const t = new THREE.CanvasTexture(oe ? daempLaerred(c) : c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return { t, b: c.width / pr, h: c.height / pr, oe };
}

export function lavVisning(laerred, lag) {
  const renderer = new THREE.WebGLRenderer({ canvas: laerred, antialias: true, powerPreference: 'high-performance' });
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  // samme farvekurve som Blender-billederne i Shop (AgX); kontrasten lægges på bagefter i efterbehandlingen
  renderer.toneMapping = THREE.AgXToneMapping; renderer.toneMappingExposure = 1.25;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x050506);
  miljoe(renderer, scene);
  const himmellys = new THREE.HemisphereLight(0xffffff, 0x1a1a22, 0.55); scene.add(himmellys);
  const sol = new THREE.DirectionalLight(0xfff4ea, 2.6); sol.position.set(-26, 52, 24); sol.castShadow = true;
  Object.assign(sol.shadow.camera, { left: -52, right: 52, top: 36, bottom: -36, near: 5, far: 140 });
  sol.shadow.mapSize.set(2048, 2048); sol.shadow.bias = -0.0004; sol.shadow.normalBias = 0.04; sol.shadow.radius = 5;
  scene.add(sol);
  const kant = new THREE.DirectionalLight(0xff5a5a, 0.7); kant.position.set(30, 18, -40); scene.add(kant);
  const kamera = new THREE.PerspectiveCamera(32, 1, 1, 600);
  const k2 = lag.getContext('2d');
  let tagKanter = [];
  let by = null, byLiv = [], byHjul = [], byLys = {}, biler = [], hav = null, fly = null, naesteDamp = 0, naesteGlimt = 0, neonSluk = 0;
  const sort = new THREE.Color(0x050506), nat = new THREE.Color(0x0a0f1b);
  const himmel = (() => { const c = document.createElement('canvas'); c.width = 4; c.height = 256; const k = c.getContext('2d'), f = k.createLinearGradient(0, 0, 0, 256); f.addColorStop(0, '#01020a'); f.addColorStop(0.55, '#070b16'); f.addColorStop(1, '#0d1424'); k.fillStyle = f; k.fillRect(0, 0, 4, 256); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const bilG = new THREE.BoxGeometry(0.12, 0.09, 0.3), bilHvid = new THREE.MeshBasicMaterial({ color: 0xfff0cf }), bilRoed = new THREE.MeshBasicMaterial({ color: 0xff3524 });
  function nyTur(b, start) {                  // en bil får en ny gade at køre ad
    const ga = g.bane.gader[Math.random() * g.bane.gader.length | 0], frem = Math.random() < 0.5, l = Math.hypot(ga[2] - ga[0], ga[3] - ga[1]);
    Object.assign(b, { ga, frem, l, s: start ? Math.random() * l : 0, fart: 55 + Math.random() * 70, side: (frem ? 1 : -1) * (3 + Math.random() * 2) });
    b.o.material = (ga[0] === ga[2] ? frem : !frem) ? bilHvid : bilRoed;      // forlygter mod kameraet, baglygter væk fra det
    b.o.rotation.y = ga[0] === ga[2] ? 0 : Math.PI / 2;
  }
  let natTing = [], byFarve = null;
  const himmelAf = (stop, daemp) => { const c = document.createElement('canvas'); c.width = 4; c.height = 256; const k = c.getContext('2d'), f = k.createLinearGradient(0, 0, 0, 256); stop.forEach(([u, farve]) => f.addColorStop(u, daemp ? '#' + daempHex(farve).toString(16).padStart(6, '0') : farve)); k.fillStyle = f; k.fillRect(0, 0, 4, 256); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };
  const HIMMEL = {
    sakura: { h: himmelAf([[0, '#06030c'], [0.55, '#160a1e'], [1, '#2a1230']]), taage: 0x1c0f22, sol: 0xffc6dc },
    tech: { h: himmelAf([[0, '#030212'], [0.55, '#0d0628'], [1, '#22104a']]), taage: 0x120a2e, sol: 0xb9a6ff },
    sne: { h: himmelAf([[0, '#020611'], [0.5, '#0a1626'], [1, '#22344a']]), taage: 0x3c4c60, sol: 0xcfe2ff },
  };
  let vejr = null, nordlys = [];
  function vejrOp(tema_) {                     // sne, der falder, eller kirsebærblade, der flyver; altid lige omkring det, man ser på
    const n = tema_ === 'sne' ? 2600 : tema_ === 'tech' || tema_ === 'glod' ? 700 : 900, pos = new Float32Array(n * 3), fart = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { pos[i * 3] = (Math.random() - 0.5) * 120; pos[i * 3 + 1] = Math.random() * 30; pos[i * 3 + 2] = (Math.random() - 0.5) * 80; fart[i * 3] = Math.random() * 6.28; fart[i * 3 + 1] = 0.6 + Math.random() * 0.8; fart[i * 3 + 2] = Math.random(); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const c = document.createElement('canvas'); c.width = c.height = 32; const k = c.getContext('2d');
    if (tema_ === 'tech') { const f = k.createRadialGradient(16, 16, 0, 16, 16, 16); f.addColorStop(0, 'rgba(160,250,255,1)'); f.addColorStop(0.4, 'rgba(45,240,255,.6)'); f.addColorStop(1, 'rgba(45,240,255,0)'); k.fillStyle = f; k.fillRect(0, 0, 32, 32); }
    else if (tema_ === 'glod') { const f = k.createRadialGradient(16, 16, 0, 16, 16, 16); f.addColorStop(0, 'rgba(255,230,160,1)'); f.addColorStop(0.35, 'rgba(255,110,30,.7)'); f.addColorStop(1, 'rgba(255,60,10,0)'); k.fillStyle = f; k.fillRect(0, 0, 32, 32); }
    else if (tema_ === 'sne') { const f = k.createRadialGradient(16, 16, 0, 16, 16, 16); f.addColorStop(0, 'rgba(255,255,255,1)'); f.addColorStop(1, 'rgba(255,255,255,0)'); k.fillStyle = f; k.fillRect(0, 0, 32, 32); }
    else { k.fillStyle = '#ffb3c9'; k.beginPath(); k.ellipse(16, 16, 13, 7, 0.6, 0, 7); k.fill(); k.fillStyle = '#ffd6e2'; k.beginPath(); k.ellipse(13, 14, 6, 3, 0.6, 0, 7); k.fill(); }
    const t = new THREE.CanvasTexture(c);
    const o = new THREE.Points(geo, new THREE.PointsMaterial({ map: t, blending: tema_ === 'tech' || tema_ === 'glod' ? THREE.AdditiveBlending : THREE.NormalBlending, size: tema_ === 'sne' ? 0.16 : tema_ === 'tech' || tema_ === 'glod' ? 0.2 : 0.24, transparent: true, depthWrite: false, opacity: tema_ === 'sne' ? 0.85 : 0.95 }));
    o.frustumCulled = false; scene.add(o); vejr = { o, fart, tema: tema_ };
  }
  function vejrSkridt(dt) {
    if (!vejr) return;
    const p = vejr.o.geometry.attributes.position.array, f = vejr.fart, sne = vejr.tema === 'sne', mx = midte.x, mz = midte.z;
    if (vejr.tema === 'tech' || vejr.tema === 'glod') {                 // lyspartikler eller gløder, der stiger langsomt op
      for (let i = 0; i < p.length; i += 3) { p[i + 1] += f[i + 1] * 0.8 * dt; p[i] += Math.sin(tid + f[i]) * 0.1 * dt; if (p[i + 1] > 16 || Math.abs(p[i] - mx) > 60 || Math.abs(p[i + 2] - mz) > 40) { p[i] = mx + (Math.random() - 0.5) * 120; p[i + 1] = Math.random() * 0.5; p[i + 2] = mz + (Math.random() - 0.5) * 80; } }
      vejr.o.geometry.attributes.position.needsUpdate = true; return;
    }
    for (let i = 0; i < p.length; i += 3) {
      const w = f[i] + tid * (sne ? 0.6 : 1.4);
      p[i] += (Math.sin(w) * (sne ? 0.35 : 1.4) + (sne ? 0.3 : 1.6)) * dt; p[i + 1] -= f[i + 1] * (sne ? 1.1 : 0.7) * dt; p[i + 2] += Math.cos(w * 0.7) * (sne ? 0.3 : 0.9) * dt;
      if (p[i + 1] < 0 || Math.abs(p[i] - mx) > 60 || Math.abs(p[i + 2] - mz) > 40) { p[i] = mx + (Math.random() - 0.5) * 120; p[i + 1] = 12 + Math.random() * 18; p[i + 2] = mz + (Math.random() - 0.5) * 80; }
    }
    vejr.o.geometry.attributes.position.needsUpdate = true;
  }
  function nordlysOp() {                       // grønne og lilla bånd højt mod nord, der bølger langsomt
    for (let i = 0; i < 3; i++) {
      const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
        uniforms: { t: { value: 0 }, f: { value: i * 1.7 } },
        vertexShader: 'uniform float t; uniform float f; varying vec2 vUv; void main() { vUv = uv; vec3 p = position; p.z += sin(p.x * 0.02 + t * 0.25 + f) * 18.0 + sin(p.x * 0.05 - t * 0.4) * 5.0; gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }',
        fragmentShader: 'uniform float t; uniform float f; varying vec2 vUv; void main() { float b = sin(vUv.x * 40.0 + t * 0.7 + f) * 0.5 + 0.5; b = pow(b, 3.0) * 0.6 + 0.4; float h = pow(1.0 - vUv.y, 1.6) * smoothstep(0.0, 0.12, vUv.y); float s = sin(vUv.x * 3.14159); vec3 c = mix(vec3(0.15, 1.0, 0.55), vec3(0.55, 0.3, 1.0), vUv.y * 1.2); gl_FragColor = vec4(c * b * h * s * 0.55, 1.0); }' });
      const o = new THREE.Mesh(new THREE.PlaneGeometry(420, 70, 120, 1), m); o.position.set(-30 + i * 40, 58 + i * 12, -150 - i * 30); o.rotation.x = 0.25; scene.add(o); nordlys.push(o);
    }
  }
  // Diorama: byen skæres af ved banens kant og står på en sokkel af klippelag med hav rundt om, som Færøerne.
  const SKUMRING = { std: [[0, '#0a1020'], [0.55, '#1c2a40'], [0.85, '#3b4a62'], [1, '#6a6f82']], sakura: [[0, '#140a1c'], [0.55, '#2e1a36'], [0.85, '#5a3450'], [1, '#8a5a70']], sne: [[0, '#081424'], [0.55, '#1a2e48'], [0.85, '#3c5874'], [1, '#7f97ad']], tech: [[0, '#070520'], [0.55, '#1a0f40'], [0.85, '#3a1f64'], [1, '#6a3c8a']] };
  let klip = [], diorama = true;
  function dioramaOp() {
    const kant = 6, x0 = X(-kant), x1 = X(FELT.b + kant), z0 = Z(-kant), z1 = Z(FELT.h + kant);
    klip = [new THREE.Plane(new THREE.Vector3(1, 0, 0), -x0), new THREE.Plane(new THREE.Vector3(-1, 0, 0), x1), new THREE.Plane(new THREE.Vector3(0, 0, 1), -z0), new THREE.Plane(new THREE.Vector3(0, 0, -1), z1)];
    renderer.localClippingEnabled = true;
    const set = new Set();
    by.traverse((o) => { if (o.isMesh) for (const m of [].concat(o.material)) set.add(m); });
    if (grund) set.add(grund.material);
    for (const m of set) { m.clippingPlanes = klip; m.needsUpdate = true; }
    // soklen: tre klippelag, der skråner en smule udad, og en græs- eller fortovskant foroven
    const H_ = 3.2, b = x1 - x0, d = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const lag = [[0, 1.0, 0x1b1e22], [-0.9, 1.006, 0x25292e], [-1.9, 1.012, 0x1b1e22]];
    for (const [y, s_, farve] of lag) {
      const o = new THREE.Mesh(new THREE.BoxGeometry(b * s_, 1.0, d * s_), new THREE.MeshStandardMaterial({ color: farve, roughness: 0.92 }));
      o.position.set(cx, y - 0.56, cz); o.receiveShadow = true; scene.add(o); natTing.push(o);      // toppen lige under jorden, så de ikke kæmper om de samme punkter
    }
    const bund = new THREE.Mesh(new THREE.BoxGeometry(b * 1.02, H_ - 2.9 + 0.3, d * 1.02), new THREE.MeshStandardMaterial({ color: 0x25292e, roughness: 0.92 }));
    bund.position.set(cx, -2.9 - (H_ - 2.9) / 2, cz); scene.add(bund); natTing.push(bund);
    const hav_ = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400), new THREE.MeshBasicMaterial({ color: g.bane.tema === 'sne' ? 0x8ea6b8 : 0x0c2531 }));
    hav_.rotation.x = -Math.PI / 2; hav_.position.y = -H_; scene.add(hav_); natTing.push(hav_);
    const sk = SKUMRING[g.bane.tema] || SKUMRING.std;
    scene.background = himmelAf(sk); scene.fog = new THREE.Fog(new THREE.Color(sk[2][1]), 100, 330);
    sol.color.set(0xffe0bb); sol.intensity = 2.2; himmellys.intensity = 0.7; himmellys.color.set(0x9fc0dc); scene.environmentIntensity = 0.5;
  }
  function natOp() {                           // alt det, der kun hører til byen om natten
    const H = HIMMEL[g.bane.tema];
    scene.background = H ? H.h : himmel; scene.fog = new THREE.Fog(H ? H.taage : nat, 100, 330);
    sol.color.set(H ? H.sol : 0xb9c6ff); sol.intensity = g.bane.tema === 'sne' ? 1.6 : 2.1; himmellys.intensity = g.bane.tema === 'sne' ? 0.7 : 0.42; himmellys.color.set(0x9fb0e0); scene.environmentIntensity = 0.42;
    if (g.bane.tema) vejrOp(g.bane.tema);
    if (g.bane.tema === 'sne') nordlysOp();
    byLys = {}; byFarve = null;
    by.traverse((o) => {
      if (!o.isMesh) return; o.receiveShadow = true; if (/^(Skyline|Bjergene)/.test(o.name)) o.castShadow = false;
      for (const m of [].concat(o.material)) { if (m.name === 'colpatria') byFarve = m; if (/^(fyr|rude|neon|krone)/.test(m.name) && !byLys[m.name]) byLys[m.name] = { m, e: m.emissiveIntensity }; }
    });
    const plan_ = (farve, b, d, x, y, z) => { const o = new THREE.Mesh(new THREE.PlaneGeometry(b, d), new THREE.MeshBasicMaterial({ color: farve })); o.rotation.x = -Math.PI / 2; o.position.set(x, y, z); scene.add(o); natTing.push(o); };
    if (!diorama) plan_(0x07080c, 900, 900, 20, -0.03, 0);                                    // landjorden ud til horisonten
    if (g.bane.hav && !diorama) plan_(0x06111b, 900, 300, 20, -0.02, Z(1010) + 150);         // havet mod syd
    if (diorama) dioramaOp();
    else for (let i = 0; i < 90; i++) { const b = { o: new THREE.Mesh(bilG, bilHvid) }; nyTur(b, true); scene.add(b.o); biler.push(b); }
    fly = new THREE.Mesh(kugleG, new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false })); fly.scale.setScalar(0.22); scene.add(fly);
  }
  function natNed() {
    scene.background = sort; scene.fog = null; sol.color.set(0xfff4ea); sol.intensity = 2.6; himmellys.intensity = 0.55; himmellys.color.set(0xffffff); scene.environmentIntensity = 0.55;
    oeNed();
    if (klip.length && by) { by.traverse((o) => { if (o.isMesh) for (const m of [].concat(o.material)) { m.clippingPlanes = null; m.needsUpdate = true; } }); } klip = [];
    vejr?.o.removeFromParent(); vejr = null; for (const o of nordlys) o.removeFromParent(); nordlys = [];
    for (const b of biler) b.o.removeFromParent(); biler = []; for (const o of natTing) o.removeFromParent(); natTing = []; fly?.removeFromParent(); fly = null; byLys = {}; byFarve = null;
  }
  const skumring = (() => { const c = document.createElement('canvas'); c.width = 4; c.height = 256; const k = c.getContext('2d'), f = k.createLinearGradient(0, 0, 0, 256); f.addColorStop(0, '#0a1422'); f.addColorStop(0.5, '#1c3346'); f.addColorStop(0.8, '#3d5f76'); f.addColorStop(1, '#6f8ea0'); k.fillStyle = f; k.fillRect(0, 0, 4, 256); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  let faar = [], fugle = [], taager = [], naesteSkum = 0;
  let HAVDYB = 3.2;
  const OEHIMMEL = {
    miami: { h: himmelAf([[0, '#2a1b4a'], [0.45, '#7a3a6a'], [0.75, '#ff7a5a'], [1, '#ffc27a']]), taage: 0xd88a8a, hav: 0x1aa5b8, sol: 0xffc08a, solI: 2.8, himI: 0.9 },
    lagune: { h: himmelAf([[0, '#02040c'], [0.6, '#061428'], [1, '#0e2a40']]), taage: 0x061a26, hav: 0x041820, sol: 0x9fb6ff, solI: 1.1, himI: 0.45 },
  };
  // Træer og palmer står i store samlede net. Hvert træ findes som en sammenhængende klump punkter,
  // så det kan fjernes alene, når et tårn bygges ovenpå. Nettet stilles tilbage ved hver ny bane.
  let traeKlumper = [];
  function traeOp() {
    traeKlumper = [];
    by.updateMatrixWorld(true);
    by.traverse((o) => {
      // net med flere materialer bliver til børn med materialets navn (kokos, trae026), så hele stien op til byen tjekkes
      let p_ = o, erTrae = false;
      while (p_ && p_ !== by) { if (/^(Palmer|Parker|Holmtraer|Traeer|Lunde|Flora|Skov)/.test(p_.name)) erTrae = true; p_ = p_.parent; }
      if (!o.isMesh || !erTrae) return;
      const geo = o.geometry, pos = geo.attributes.position;
      if (!geo.userData.orig) geo.userData.orig = pos.array.slice();
      else { pos.array.set(geo.userData.orig); pos.needsUpdate = true; }
      if (!geo.userData.klumper) {
        const n = pos.count, far = new Int32Array(n).map((_, i) => i);
        const rod = (i) => { while (far[i] !== i) i = far[i] = far[far[i]]; return i; };
        const idx = geo.index ? geo.index.array : null;
        if (idx) for (let i = 0; i < idx.length; i += 3) { const a = rod(idx[i]), b = rod(idx[i + 1]), c = rod(idx[i + 2]); far[b] = a; far[rod(c)] = a; }
        const kl = new Map(), v = new THREE.Vector3();
        for (let i = 0; i < n; i++) { const r = rod(i); let k = kl.get(r); if (!k) kl.set(r, (k = { x: 0, z: 0, n: 0, i: [] })); v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld); k.x += v.x; k.z += v.z; k.n++; k.i.push(i); }
        geo.userData.klumper = [...kl.values()].map((k) => ({ x: k.x / k.n, z: k.z / k.n, i: k.i }));
      }
      traeKlumper.push({ o, geo });
    });
  }
  function fjernTraeer(x, y) {
    const cx = X(x), cz = Z(y), r = 34 * K;
    detaljeFjern(cx, cz, r);
    for (const { geo } of traeKlumper) {
      const pos = geo.attributes.position; let rort = false;
      for (const k of geo.userData.klumper) {
        if (Math.hypot(k.x - cx, k.z - cz) > r) continue;
        const a = k.i[0];
        for (const i of k.i) pos.setXYZ(i, pos.getX(a), pos.getY(a), pos.getZ(a));
        rort = true;
      }
      if (rort) pos.needsUpdate = true;
    }
  }
  // Småting på banen: kantsten, fodgængerfelter, lygtepæle, bænke, hegn, skilte, sten, græs og blomster,
  // og på bygningerne altaner og tagudstyr. Alt står i fem InstancedMesh (fem draw calls), farvet pr. ting,
  // og placeres med et fast frø pr. bane, så hver bane ser sådan ud hver gang, men forskellig fra de andre.
  let detalje = null, detaljeSteder = [];
  const detaljeGeo = { kasse: new THREE.BoxGeometry(1, 1, 1), roer: new THREE.CylinderGeometry(0.5, 0.5, 1, 10), kugle: new THREE.IcosahedronGeometry(0.5, 2), kegle: new THREE.ConeGeometry(0.5, 1, 6) };
  const iPoly = (p, x, y) => { let ind = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) { const [xi, yi] = p[i], [xj, yj] = p[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) ind = !ind; } return ind; };
  function detaljeOp() {
    detalje?.removeFromParent(); detalje = null; detaljeSteder = [];
    const b = g.bane, oe = !!b.oe, tm = b.tema, sne = tm === 'sne', tech = tm === 'tech';
    let fr = 1; for (const c of b.id) fr = (fr * 31 + c.charCodeAt(0)) % 2147483647;
    const tf = () => (fr = (fr * 16807) % 2147483647) / 2147483647, mel = (a, c) => a + tf() * (c - a), en = (l) => l[(tf() * l.length) | 0];
    const slut = b.p[b.p.length - 1];
    const fri = (x, y, luft = 0) => x > 24 && y > 24 && x < FELT.b - 24 && y < FELT.h - 24 && tilVej(b, x, y) > VEJ / 2 + 6 + luft
      && !(b.spaer || []).some(([a, c, d, e]) => x > a - 8 - luft && x < d + 8 + luft && y > c - 8 - luft && y < e + 8 + luft)
      && !(b.vand || []).some((p) => iPoly(p, x, y)) && !(b.bro || []).some((p) => iPoly(p, x, y))
      && (!b.land || iPoly(b.land, x, y)) && Math.hypot(x - slut[0], y - slut[1]) > 110;
    const L = { kasse: [], roer: [], kugle: [], kegle: [], lys: [] };
    const c_ = new THREE.Color();
    const farve = (hex, v = 0.06) => { c_.set(daempHex(hex)); c_.offsetHSL(0, 0, (tf() - 0.5) * v); return c_.getHex(); };
    // læg(form, x, y i banens enheder, højde over jorden i m, mål i m, drej, farve, på tag)
    const laeg = (form, x, y, h, sx, sy, sz, v, hex, tag) => { L[form].push([X(x), h, Z(y), sx, sy, sz, v, form === 'lys' ? hex : farve(hex), tag]); };
    const vejF = sne ? '#b9c0c8' : tech ? '#3a4058' : oe ? '#cdbf9f' : '#8e9196';
    const metal = sne ? '#2c3038' : tech ? '#1c2034' : oe ? '#5a4a3a' : '#2a2d33', trae = sne ? '#5a4636' : '#7a5a3e';
    const lysF = tech ? 0x7ff4ff : tm === 'sakura' ? 0xffc6d8 : 0xffd9a0;
    // 1) kantsten langs begge vejkanter og fodgængerfelter
    const P = b.p; let s = 0;
    for (let i = 1; i < P.length; i++) {
      const [ax, ay] = P[i - 1], [bx, by_] = P[i], l = Math.hypot(bx - ax, by_ - ay); if (l < 1) continue;
      const dx = (bx - ax) / l, dy = (by_ - ay) / l, v = Math.atan2(dx, dy);
      for (let t = 0; t < l; t += 20) {
        const n = Math.min(20, l - t) + 1, mx = ax + dx * (t + n / 2), my = ay + dy * (t + n / 2);
        for (const sd of [-1, 1]) {
          const x = mx - dy * sd * (VEJ / 2 + 1.2), y = my + dx * sd * (VEJ / 2 + 1.2);
          if ((b.vand || []).some((p) => iPoly(p, x, y)) || (b.land && !iPoly(b.land, x, y)) || tilVej(b, x, y) < VEJ / 2 - 1) continue;
          laeg('kasse', x, y, 0.035, 0.1, 0.07, n * K, v, vejF, 0);
        }
        s += n - 1;
        if (s > 380 && tf() < 0.06 && i > 1 && i < P.length - 2) {
          s = 0;
          for (let k = -2.5; k <= 2.5; k++) laeg('kasse', mx - dy * k * 7.5, my + dx * k * 7.5, 0.004, 0.22, 0.008, 0.7, v, sne ? '#e8eef4' : '#c8c8c2', 0);
        }
      }
    }
    // 2) lygtepæle, og ved nogle af dem en bænk, et skilt eller en pullert
    for (let t = 60 + tf() * 60; t < (b.laengde || 3000) - 120; t += mel(130, 210)) {
      let i = 1, acc = 0; for (; i < P.length; i++) { const l = Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]); if (acc + l > t) break; acc += l; }
      if (i >= P.length) break;
      const [ax, ay] = P[i - 1], [bx, by_] = P[i], l = Math.hypot(bx - ax, by_ - ay), u = (t - acc) / l, dx = (bx - ax) / l, dy = (by_ - ay) / l;
      const sd = tf() < 0.5 ? -1 : 1, x = ax + (bx - ax) * u - dy * sd * (VEJ / 2 + 9), y = ay + (by_ - ay) * u + dx * sd * (VEJ / 2 + 9);
      if (!fri(x, y, -10)) continue;
      const hp = tech ? 0.95 : 0.8;
      laeg('roer', x, y, hp / 2, 0.07, hp, 0.07, 0, metal, 0);
      laeg('roer', x, y, 0.04, 0.13, 0.08, 0.13, 0, metal, 0);
      laeg('kasse', x + dy * sd * 2.4, y - dx * sd * 2.4, hp, 0.24, 0.045, 0.06, Math.atan2(dx, dy), metal, 0);
      laeg('lys', x + dy * sd * 4.6, y - dx * sd * 4.6, hp - 0.04, 0.16, 0.08, 0.16, 0, lysF, 0);
      const r = tf(), v = Math.atan2(dx, dy);
      if (r < 0.4) {
        const bx2 = x + dx * 14, by2 = y + dy * 14;
        if (fri(bx2, by2, -10)) {
          laeg('kasse', bx2, by2, 0.12, 0.12, 0.03, 0.34, v, oe ? trae : '#4a3a30', 0);
          laeg('kasse', bx2 - dy * sd * 2.6, by2 + dx * sd * 2.6, 0.2, 0.025, 0.1, 0.34, v, oe ? trae : '#4a3a30', 0);
          for (const e of [-1, 1]) laeg('kasse', bx2 + dx * e * 5.5, by2 + dy * e * 5.5, 0.06, 0.03, 0.12, 0.1, v, metal, 0);
        }
      } else if (r < 0.6) {
        const sx = x + dx * 10, sy = y + dy * 10;
        laeg('roer', sx, sy, 0.26, 0.022, 0.52, 0.022, 0, metal, 0);
        laeg('kasse', sx, sy, 0.5, 0.2, 0.15, 0.015, v + Math.PI / 2, en(tech ? ['#2a6f86', '#7a2d6a'] : ['#3d5f86', '#86563d', '#4b7a55', '#a8a29a']), 0);
      } else if (r < 0.78 && !oe) {
        for (const e of [-1, 0, 1]) laeg('roer', x + dx * e * 8, y + dy * e * 8, 0.07, 0.05, 0.14, 0.05, 0, metal, 0);
      }
    }
    // 3) hegn i stykker langs vejen på øerne og i sneen
    if (oe || sne) for (let n = 0; n < 7; n++) {
      const t = mel(200, (b.laengde || 3000) - 300);
      let i = 1, acc = 0; for (; i < P.length; i++) { const l = Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]); if (acc + l > t) break; acc += l; }
      if (i >= P.length) continue;
      const [ax, ay] = P[i - 1], [bx, by_] = P[i], l = Math.hypot(bx - ax, by_ - ay), dx = (bx - ax) / l, dy = (by_ - ay) / l, sd = tf() < 0.5 ? -1 : 1, v = Math.atan2(dx, dy);
      for (let k = 0, u0 = t - acc; k < 9 && u0 + k * 12 < l; k++) {
        const u = u0 + k * 12, x = ax + dx * u - dy * sd * (VEJ / 2 + 16), y = ay + dy * u + dx * sd * (VEJ / 2 + 16);
        if (!fri(x, y, -14)) break;
        laeg('roer', x, y, 0.17, 0.05, 0.34, 0.05, 0, trae, 0);
        if (k) for (const hh of [0.14, 0.27]) laeg('kasse', x - dx * 6, y - dy * 6, hh, 0.03, 0.045, 12 * K, v, trae, 0);
      }
    }
    // 4) sten, græstotter og blomster i klynger; i byen kun i parkerne og ved vejen
    const blomst = tm === 'sakura' ? ['#f2b8c8', '#ffffff', '#e48aa8'] : oe ? ['#f2d15a', '#f07a6a', '#ffffff', '#c890e0'] : ['#e8d070', '#d07070', '#e8e8e8'];
    const graes = b.stil ? b.stil.graes : sne ? ['#c8d0d8', '#aab4c0'] : tech ? ['#1e2a3a', '#16202e'] : ['#3d6b3a', '#2c5530'];
    const stenF = sne ? '#d8dee6' : oe ? '#8a8478' : '#5c5e62';
    const omraade = oe ? null : (b.park || []);
    const tilfSted = () => {
      if (omraade && omraade.length && tf() < 0.7) { const p = en(omraade); let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const [x, y] of p) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); } return [mel(x0, x1), mel(y0, y1)]; }
      if (!oe) { const t = tf() * (b.p.length - 1) | 0, sd = tf() < 0.5 ? -1 : 1; return [b.p[t][0] + mel(-30, 30), b.p[t][1] + sd * mel(VEJ / 2 + 12, VEJ / 2 + 40)]; }
      return [mel(30, FELT.b - 30), mel(30, FELT.h - 30)];
    };
    const klynger = oe ? 220 : tech ? 50 : 110;
    for (let n = 0; n < klynger; n++) {
      const [cx, cy] = tilfSted(); if (!fri(cx, cy)) continue;
      const art = tf();
      for (let k = 0, m = 3 + (tf() * 6 | 0); k < m; k++) {
        const x = cx + mel(-14, 14), y = cy + mel(-14, 14); if (!fri(x, y)) continue;
        if (art < 0.25 || tech) { const st = mel(0.1, 0.32); laeg('kugle', x, y, st * 0.25, st, st * mel(0.45, 0.7), st * mel(0.7, 1), tf() * 6, stenF, 0); }
        else if (art < 0.8 && !sne) { const hh = mel(0.16, 0.3); for (let j = 0; j < 4; j++) laeg('kegle', x + mel(-2.5, 2.5), y + mel(-2.5, 2.5), hh / 2, mel(0.06, 0.1), hh * mel(0.7, 1), mel(0.06, 0.1), tf() * 6, en(graes), 0); if (tf() < 0.5) for (let j = 0; j < 3; j++) laeg('kugle', x + mel(-3, 3), y + mel(-3, 3), hh * 0.8, 0.075, 0.06, 0.075, 0, en(blomst), 0); }
        else { const st = mel(0.22, 0.42); laeg('kugle', x, y, st * 0.1, st, st * 0.55, st * mel(0.7, 1), tf() * 6, sne ? '#e4e9ef' : en(graes), 0); }
      }
    }
    // 5) bygningerne: tagudstyr på alle flade tage, altaner på facaden mod kameraet
    for (const [x0, y0, x1, y1, h] of b.tage || []) {
      const bb = x1 - x0, dd = y1 - y0;
      for (let n = 0, m = 1 + (tf() * 3 | 0); n < m; n++) {
        const x = mel(x0 + 14, x1 - 14), y = mel(y0 + 14, y1 - 14), r = tf();
        if (r < 0.35) laeg('kasse', x, y, h + 0.05, mel(0.12, 0.22), 0.1, mel(0.1, 0.16), (tf() * 2 | 0) * Math.PI / 2, '#7c8088', 1);
        else if (r < 0.55 && !oe) { laeg('roer', x, y, h + 0.22, 0.16, 0.22, 0.16, 0, '#6a5444', 1); laeg('kegle', x, y, h + 0.36, 0.17, 0.06, 0.17, 0, '#4a3c32', 1); for (const [ex, ey] of [[-2, -2], [2, 2], [-2, 2], [2, -2]]) laeg('roer', x + ex, y + ey, h + 0.05, 0.015, 0.1, 0.015, 0, metal, 1); }
        else if (r < 0.75) { const ah = mel(0.3, 0.6); laeg('roer', x, y, h + ah / 2, 0.012, ah, 0.012, 0, '#9aa0a8', 1); laeg('kasse', x, y, h + ah * 0.8, 0.12, 0.008, 0.008, tf() * 3, '#9aa0a8', 1); }
        else if (oe) laeg('kasse', x, y, h + 0.04, 0.3, 0.02, 0.18, 0, '#2a3a52', 1);
        else laeg('roer', x, y, h + 0.04, 0.09, 0.08, 0.09, 0, '#8a8e96', 1);
      }
      if (oe || h < 0.6 || bb < 40) continue;
      const etage = 0.32, nAlt = Math.max(1, Math.floor(bb / 26));
      for (let e = 1; e * etage < h - 0.15; e++) {
        if (tf() < 0.3) continue;
        for (let k = 0; k < nAlt; k++) {
          if (tf() < 0.35) continue;
          const x = x0 + (k + 0.5) * (bb / nAlt), y = y1 + 2.2;
          laeg('kasse', x, y, e * etage, 0.34, 0.03, 0.17, 0, oe ? '#efe9dc' : '#55585e', 1);
          laeg('kasse', x, y + 3.3, e * etage + 0.06, 0.34, 0.1, 0.02, 0, metal, 1);
          for (const ex of [-1, 1]) laeg('kasse', x + ex * 3.3, y + 1.6, e * etage + 0.06, 0.02, 0.1, 0.16, 0, metal, 1);
        }
      }
    }
    // byg nettene
    detalje = new THREE.Group(); detalje.name = 'detaljer';
    const mat = new THREE.MeshStandardMaterial({ roughness: 0.82, metalness: 0.05 }), lysMat = new THREE.MeshBasicMaterial({ color: lysF });
    if (klip.length) mat.clippingPlanes = lysMat.clippingPlanes = klip;
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e3 = new THREE.Euler(), v3 = new THREE.Vector3(), s3 = new THREE.Vector3();
    for (const form of Object.keys(L)) {
      const l = L[form]; if (!l.length) continue;
      const o = new THREE.InstancedMesh(form === 'lys' ? detaljeGeo.kugle : detaljeGeo[form], form === 'lys' ? lysMat : mat, l.length);
      l.forEach(([x, y, z, sx, sy, sz, v, hex, tag], i) => {
        m4.compose(v3.set(x, y, z), q.setFromEuler(e3.set(0, v, 0)), s3.set(sx, sy, sz)); o.setMatrixAt(i, m4);
        if (form !== 'lys') o.setColorAt(i, c_.setHex(hex));
        detaljeSteder.push({ o, i, x, z, m: m4.clone() });
      });
      o.castShadow = form === 'kasse' || form === 'roer'; o.receiveShadow = true;
      o.computeBoundingSphere(); detalje.add(o);
    }
    scene.add(detalje);
  }
  // fjerner småting under et nyt tårn (og på taget, hvis tårnet står der)
  const nul4 = new THREE.Matrix4().makeScale(0, 0, 0);
  function detaljeFjern(cx, cz, r) {
    const rort = new Set();
    for (const d of detaljeSteder) if (!d.vaek && Math.hypot(d.x - cx, d.z - cz) < r) { d.o.setMatrixAt(d.i, nul4); d.vaek = true; rort.add(d.o); }
    for (const o of rort) o.instanceMatrix.needsUpdate = true;
  }
  function oeOp() {                            // Færøerne i skumringen: hav hele vejen rundt, får, fugle, vandfald og tåge
    const st = g.bane.stil, hx = (f) => parseInt(f.slice(1), 16);
    const OH = st ? { h: himmelAf(st.himmel, true), taage: daempHex(hx(st.taage)), hav: daempHex(daempHex(hx(st.hav))), sol: hx(st.sol), solI: st.solI * 0.9, himI: st.himI * 0.8 } : OEHIMMEL[g.bane.oeTema]; HAVDYB = g.bane.havdyb || 3.2;
    scene.background = OH ? OH.h : skumring; scene.fog = new THREE.Fog(OH ? OH.taage : 0x2a4356, 100, 330);
    sol.color.set(OH ? OH.sol : 0xffe0bb); sol.intensity = OH ? OH.solI : 2.5; himmellys.intensity = OH ? OH.himI : 0.75; himmellys.color.set(0x9fc0dc); scene.environmentIntensity = 0.5;
    if (g.bane.oeTema === 'lagune') vejrOp('tech');      // lysende plankton, der stiger op i natten
    if (st?.vejr) vejrOp(st.vejr);                       // sne, kirsebærblade, lysprikker eller gløder fra vulkanen
    skygge.visible = false;
    by.traverse((o) => { if (/^Molen_net/.test(o.name)) o.visible = false; if (o.isMesh) { o.receiveShadow = true; if (/^(Fjerne|Sk)/.test(o.name)) o.castShadow = false; if ([].concat(o.material).some((m) => m.name === 'straale')) o.material = new THREE.MeshBasicMaterial({ color: 0xfff3d6, transparent: true, opacity: 0.05, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });} });      // fyrets stråle er svag og lysende, ikke en fast kegle
    const hav_ = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400), new THREE.MeshBasicMaterial({ color: OH ? OH.hav : 0x0c2531 })); hav_.rotation.x = -Math.PI / 2; hav_.position.y = -HAVDYB; scene.add(hav_); natTing.push(hav_);
    const form = new THREE.Shape(g.bane.land.map(([x, y]) => new THREE.Vector2(X(x), -Z(y))));          // skygger kun på selve øen
    const sk = new THREE.Mesh(new THREE.ShapeGeometry(form), new THREE.ShadowMaterial({ opacity: 0.5, depthWrite: false })); sk.rotation.x = -Math.PI / 2; sk.position.y = 0.012; sk.receiveShadow = true; sk.renderOrder = 2; scene.add(sk); natTing.push(sk);      // tegnes altid efter øen og skjuler den aldrig
    const uld = new THREE.MeshStandardMaterial({ color: 0xe9e4d8, roughness: 1 }), moerkt = new THREE.MeshStandardMaterial({ color: 0x1a1a1c, roughness: 0.8 });
    for (const [x0, y0, x1, y1] of g.bane.enge) for (let i = 0; i < Math.max(2, (x1 - x0) * (y1 - y0) / 6500); i++) {
      const o = new THREE.Group(), krop = new THREE.Mesh(kugleG, Math.random() < 0.85 ? uld : moerkt), hoved = new THREE.Mesh(kugleG, moerkt);
      krop.scale.set(0.2, 0.19, 0.3); krop.position.y = 0.3; krop.castShadow = true; hoved.scale.set(0.09, 0.1, 0.12); hoved.position.set(0, 0.36, 0.3); o.add(krop, hoved);
      const f = { o, hoved, felt: [x0 + 10, y0 + 10, x1 - 10, y1 - 10], x: x0 + 10 + Math.random() * (x1 - x0 - 20), y: y0 + 10 + Math.random() * (y1 - y0 - 20), vent: Math.random() * 6, fase: Math.random() * 6 };
      f.mx = f.x; f.my = f.y; scene.add(o); faar.push(f);
    }
    const vinge = new THREE.BoxGeometry(0.34, 0.02, 0.12), fm = new THREE.MeshBasicMaterial({ color: 0x0c0e10 });
    for (let i = 0; i < 18; i++) {
      const midt = g.bane.fugle[i % g.bane.fugle.length], o = new THREE.Group(), v1 = new THREE.Mesh(vinge, fm), v2 = new THREE.Mesh(vinge, fm);
      v1.geometry = vinge; v1.position.x = -0.17; v2.position.x = 0.17; const a1 = new THREE.Group(), a2 = new THREE.Group(); a1.add(v1); a2.add(v2); o.add(a1, a2); scene.add(o);
      fugle.push({ o, a1, a2, x: midt[0], y: midt[1], r: 40 + Math.random() * 90, h: 3 + Math.random() * 7, fart: (0.25 + Math.random() * 0.3) * (Math.random() < 0.5 ? -1 : 1), fase: Math.random() * 6 });
    }
    for (let i = 0; i < 0; i++) {      // tågebanker er slået fra: de lagde sig over øen og gjorde den blå
      const o = new THREE.Mesh(kugleG, new THREE.MeshBasicMaterial({ color: 0xa9c0cf, transparent: true, opacity: 0.02, depthWrite: false })); o.scale.set(16 + Math.random() * 12, 1.2 + Math.random(), 8 + Math.random() * 6);
      o.position.set(-60 + Math.random() * 120, 1.5 + Math.random() * 4, -30 + Math.random() * 60); o.fart = 0.4 + Math.random() * 0.6; scene.add(o); taager.push(o);
    }
  }
  function oeNed() { for (const l of [faar, fugle]) for (const f of l) f.o.removeFromParent(); for (const o of taager) o.removeFromParent(); faar = []; fugle = []; taager = []; skygge.visible = true; }
  function oeLiv(dt) {
    for (const f of faar) {                    // fårene græsser lidt, går et stykke, græsser igen
      f.vent -= dt;
      if (f.vent <= 0) { f.vent = 2 + Math.random() * 9; f.mx = f.felt[0] + Math.random() * (f.felt[2] - f.felt[0]); f.my = f.felt[1] + Math.random() * (f.felt[3] - f.felt[1]); }
      const dx = f.mx - f.x, dy = f.my - f.y, d = Math.hypot(dx, dy), gaar = d > 2;
      if (gaar) { f.x += dx / d * 9 * dt; f.y += dy / d * 9 * dt; f.o.rotation.y = drejMod(f.o.rotation.y, Math.atan2(dx, dy), Math.min(1, dt * 4)); f.fase += dt * 9; }
      f.o.position.set(X(f.x), gaar ? Math.abs(Math.sin(f.fase)) * 0.03 : 0, Z(f.y));
      f.hoved.position.y += ((gaar ? 0.36 : 0.16 + Math.sin(tid * 3 + f.fase) * 0.02) - f.hoved.position.y) * Math.min(1, dt * 3);
    }
    for (const f of fugle) {
      f.fase += dt * f.fart; const w = f.fase, slag = Math.sin(tid * 9 + f.r) * 0.7;
      f.o.position.set(X(f.x + Math.cos(w) * f.r), f.h + Math.sin(w * 2.3) * 0.8, Z(f.y + Math.sin(w) * f.r * 0.7)); f.o.rotation.y = -w + (f.fart > 0 ? 0 : Math.PI);
      f.a1.rotation.z = slag; f.a2.rotation.z = -slag;
    }
    for (const o of taager) { o.position.x += o.fart * dt; if (o.position.x > 75) o.position.x = -75; }
    const fald = g.bane.fald || [-9999, -9999];                 // vandfaldet ud over klippen (kun Færøerne)
    if (g.bane.fald) for (let i = 0; i < 2; i++) { a.set(X(fald[0] + (Math.random() - 0.5) * 16), 0, Z(fald[1])); gnist(a, (Math.random() - 0.5) * 0.3, -1.5 - Math.random(), 0.9 + Math.random() * 0.5, 1.0, 0xd8ecf6, 0.14, 0.3, 0.35); }
    if (g.bane.fald && Math.random() < dt * 14) { a.set(X(fald[0] + (Math.random() - 0.5) * 30), -HAVDYB + 0.1, Z(fald[1] + 22)); gnist(a, (Math.random() - 0.5), 0.5, (Math.random() - 0.5), 1.4, 0xd8ecf6, 0.3, 1.2, 0.12); }
    if (tid > naesteSkum) {                    // brænding langs kysten og lys på havet
      naesteSkum = tid + 0.05;
      const L = g.bane.land, i = Math.random() * L.length | 0, p = L[i], q = L[(i + 1) % L.length], t = Math.random(), ud = 1.085 + Math.random() * 0.03;
      const x = 778 + (p[0] + (q[0] - p[0]) * t - 778) * ud, y = 452 + (p[1] + (q[1] - p[1]) * t - 452) * ud, ex = (q[0] - p[0]), ey = (q[1] - p[1]), l = (14 + Math.random() * 26) / Math.hypot(ex, ey);
      a.set(X(x - ex * l), -HAVDYB + 0.04, Z(y - ey * l)); b.set(X(x + ex * l), -HAVDYB + 0.04, Z(y + ey * l)); streg(a, b, 0.09, 0xe4f2f8, 1.3 + Math.random(), 0.3);
      const sx = -900 + Math.random() * 3400, sy = -700 + Math.random() * 2300, sl = 0.5 + Math.random() * 2;
      a.set(X(sx), -HAVDYB + 0.03, Z(sy)); b.set(X(sx) + sl, -HAVDYB + 0.03, Z(sy)); streg(a, b, 0.035, 0x9fc4d8, 1.5 + Math.random(), 0.16);
    }
  }
  function natLiv(dt) {
    const blink = (sek, f) => Math.pow(Math.max(0, Math.sin(tid * 6.283 / sek + f)), 8);
    for (const [navn, l] of Object.entries(byLys)) {
      if (navn === 'fyr0') l.m.emissiveIntensity = l.e * (0.12 + blink(2.3, 0));
      else if (navn === 'fyr1') l.m.emissiveIntensity = l.e * (0.12 + blink(3.1, 1.7));
      else if (navn === 'neon0') { if (tid > neonSluk && Math.random() < dt * 0.25) neonSluk = tid + 0.05 + Math.random() * 0.25; l.m.emissiveIntensity = l.e * (tid < neonSluk && Math.sin(tid * 70) > 0 ? 0.15 : 1); }
      else if (navn.startsWith('rude')) l.m.emissiveIntensity = l.e * (0.9 + 0.1 * Math.sin(tid * 0.23 + navn.charCodeAt(4)));
    }
    for (const b of biler) {
      b.s += b.fart * dt; if (b.s > b.l) nyTur(b);
      const u = (b.frem ? b.s : b.l - b.s) / b.l, ga = b.ga, lodret = ga[0] === ga[2];
      b.o.position.set(X(ga[0] + (ga[2] - ga[0]) * u + (lodret ? b.side : 0)), 0.07, Z(ga[1] + (ga[3] - ga[1]) * u + (lodret ? 0 : b.side)));
    }
    if (tid > naesteDamp) {                    // damp fra tagene
      naesteDamp = tid + 0.12;
      const d = g.bane.damp[Math.random() * g.bane.damp.length | 0];
      if (d) { a.set(X(d[0]), d[2] + 0.3, Z(d[1])); gnist(a, 0.5 + Math.random() * 0.6, 1.1 + Math.random() * 0.6, (Math.random() - 0.5) * 0.4, 3.2, 0x7c88a6, 0.25, 1.6, 0.1); }
    }
    if (tid > naesteGlimt && g.bane.glimt?.length) {                   // lys, der spejler sig i havnen
      naesteGlimt = tid + 0.1;
      const gl = g.bane.glimt[Math.random() * g.bane.glimt.length | 0], x = gl[0] + Math.random() * (gl[2] - gl[0]), y = gl[1] + Math.random() * (gl[3] - gl[1]), l = 0.4 + Math.random() * 1.6;
      a.set(X(x), 0.03, Z(y)); b.set(X(x) + l, 0.03, Z(y)); streg(a, b, 0.03, Math.random() < 0.7 ? 0xffc98a : 0x9fc8ff, 1.2 + Math.random(), 0.22);
    }
    if (byFarve) byFarve.emissive.setHSL((tid * 0.05) % 1, 1, 0.5);       // Torre Colpatria skifter farve
    const q = (tid % 46) / 46;                 // et fly højt over byen
    fly.position.set(-70 + q * 190, 46 + q * 6, -75 + q * 20); fly.material.color.set(Math.sin(tid * 5) > 0.8 ? 0xff3b30 : 0xffffff);
  }
  let g = null, grund = null, borg = null, livring = null, bredde = 1, hoejde = 1, tid = 0, valgt = null;
  let raketMat = null, granatMat = null;
  const taarne = new Map(), fjender = new Map(), enheder = new Map(), skud = new Map(), tekster = [], doende = [];
  const verden = new THREE.Group(); scene.add(verden);
  const skygge = new THREE.Mesh(new THREE.PlaneGeometry(200, 140), new THREE.ShadowMaterial({ opacity: 0.55, depthWrite: false })); skygge.renderOrder = 2;
  skygge.rotation.x = -Math.PI / 2; skygge.position.y = 0.01; skygge.receiveShadow = true; scene.add(skygge);

  // ----- hjælpere til effekter -----
  const kugleG = new THREE.SphereGeometry(1, 14, 10), kasseG = new THREE.BoxGeometry(1, 1, 1);
  const lys = (farve, op = 1) => new THREE.MeshBasicMaterial({ color: farve, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false });
  const pulje = (antal, lav) => { const a = []; for (let i = 0; i < antal; i++) { const o = lav(); o.visible = false; o.liv = 0; scene.add(o); a.push(o); } let n = 0; return () => a[n = (n + 1) % antal]; };
  const nyGnist = pulje(220, () => new THREE.Mesh(kugleG, lys(ORANGE)));
  const nyStreg = pulje(90, () => new THREE.Mesh(kasseG, lys(0xffffff)));
  const nyRing = pulje(24, () => { const r = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 64), lys(0xffffff)); r.rotation.x = -Math.PI / 2; return r; });
  const nyLyn = pulje(10, () => { const l = new THREE.Line(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(80 * 3), 3)), new THREE.LineBasicMaterial({ color: 0xcfeeff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); l.frustumCulled = false; return l; });
  const aktive = new Set();
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), d_ = new THREE.Vector3();

  function gnist(p, vx, vy, vz, liv, farve, s0, s1, op = 0.9) {
    const o = nyGnist(); o.position.copy(p); o.v = [vx, vy, vz]; o.liv = o.max = liv; o.s = [s0, s1]; o.op = op;
    o.material.color.set(farve); o.visible = true; aktive.add(o);
  }
  function streg(p, q, tyk, farve, liv, op = 1) {
    const o = nyStreg(); o.position.copy(p).add(q).multiplyScalar(0.5); o.lookAt(q); o.scale.set(tyk, tyk, p.distanceTo(q));
    o.material.color.set(farve); o.liv = o.max = liv; o.op = op; o.v = null; o.s = null; o.visible = true; aktive.add(o);
  }
  function ringFx(x, y, r, farve, liv, op = 0.8) {
    const o = nyRing(); o.position.set(X(x), 0.06, Z(y)); o.r = r * K; o.liv = o.max = liv; o.op = op; o.erRing = 1;
    o.material.color.set(farve); o.visible = true; aktive.add(o);
  }
  function tekst(x, y, h, t, farve = 'rgba(255,255,255,.9)') { tekster.push({ x, y, h, t, farve, liv: 0.9 }); }

  // ----- markering -----
  const raekke = new THREE.Group();
  const rk = new THREE.Mesh(new THREE.RingGeometry(0.985, 1, 128), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75, depthWrite: false }));
  const rf = new THREE.Mesh(new THREE.CircleGeometry(1, 96), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.045, depthWrite: false }));
  raekke.add(rk, rf); raekke.rotation.x = -Math.PI / 2; raekke.position.y = 0.05; raekke.visible = false; scene.add(raekke);
  const spoegMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.4, depthWrite: false });
  let spoeg = null, spoegId = null;

  // ----- figurer -----
  let outfits = {};
  function lavTaarn(t) {
    const temaId = outfits[t.id] || 'std', hm = helt(t.id, temaId);
    const rod = (hm || M[t.id]).clone(true);
    if (!hm) klaedOm(rod, tema(outfits[t.id]), t.id);
    const tm = tema(outfits[t.id]);
    rod.position.set(X(t.x), 0, Z(t.y));
    const v = { rod, drej: rod.getObjectByName('drej'), vaaben: rod.getObjectByName('vaaben'), spin: rod.getObjectByName('spin'), drone: rod.getObjectByName('drone'), munding: rod.getObjectByName('munding'),
      foedt: tid, trin: -1, prikker: [], op: -9, vinkel: 0, fase: Math.random() * 6, helt: !!hm, lysFarve: tm.lys ? new THREE.Color(tm.lys).getHex() : null, neon: !!tm.gloed, temaId, effekt: EFFEKT[temaId], tromle: rod.getObjectByName('spin_tromle') };
    v.hoved = rod.getObjectByName('hoved'); v.ok = rod.getObjectByName('overkrop'); v.sk = rod.getObjectByName('skuldre'); v.benV = rod.getObjectByName('benV'); v.benH = rod.getObjectByName('benH'); v.mand = rod.getObjectByName('mand');
    // hver figur får sit eget tempo og sine egne vaner, så to ens tårne aldrig bevæger sig ens
    Object.assign(v, { puls: 1.2 + Math.random() * 0.9, n1: 0.37 + Math.random() * 0.3, n2: 0.83 + Math.random() * 0.5, stiv: 170 + Math.random() * 110, vf: 0, hv: 0, gest: null, naeste: tid + 1 + Math.random() * 5, rykAmp: 1, rykSide: 0, sidstSkud: -9 });
    if (v.benV) { v.bV0 = v.benV.rotation.x; v.bH0 = v.benH.rotation.x; }
    if (v.vaaben) v.hvil = v.vaaben.position.clone();
    if (v.drej) { v.dy = v.drej.position.y; v.d0 = v.drej.position.clone(); }
    const r = t.id === 'bjoern' ? 1.21 : 0.91;
    v.glorie = new THREE.Mesh(new THREE.RingGeometry(1.03, 1.1, 56), lys(0xffffff, 0)); v.glorie.rotation.x = -Math.PI / 2; v.glorie.position.y = 0.135; if (t.id === 'bjoern') v.glorie.scale.setScalar(1.3); rod.add(v.glorie);
    for (let i = 0; i < 4; i++) {
      const p = new THREE.Mesh(kugleG, new THREE.MeshBasicMaterial({ color: 0xffffff })); p.scale.setScalar(0.055);
      const w = (i - 1.5) * 0.2; p.position.set(Math.sin(w) * r, 0.15, Math.cos(w) * r); rod.add(p); v.prikker.push(p);
    }
    verden.add(rod); return v;
  }
  function lavFjende(f) {
    const ln = f.d?.lign, rod = (f.model || M[`monster:${f.type}:${(f.nr || 0) % 3}`] || M[f.type] || M[`monster:${ln}:${(f.nr || 0) % 3}`] || M[ln]).clone(true); rod.scale.setScalar(0.01); rod.rotation.order = 'YXZ';
    const v = { rod, krop: rod.getObjectByName('krop') || rod, benV: rod.getObjectByName('benV'), benH: rod.getObjectByName('benH'), armV: rod.getObjectByName('armV'), armH: rod.getObjectByName('armH'), vV: rod.getObjectByName('vingeV'), vH: rod.getObjectByName('vingeH'), hoved: rod.getObjectByName('hoved'), hale: rod.getObjectByName('hale'), fase: Math.random() * 6, foedt: tid,
      side: f.d.boss ? 0 : (Math.random() - 0.5) * 2 * Math.max(0, VEJ / 2 - (f.d.r || 8) - 5), takt: 0.85 + Math.random() * 0.3, vugge: 0.03 + Math.random() * 0.06 };      // hver sin plads på vejen og sin egen gang
    v.p = pers(f.type); v.naeste = tid + (f.d.boss ? 1.2 : 2 + Math.random() * 7); v.akt = null;
    verden.add(rod); return v;
  }
  // ----- monstrenes sind: handlinger, talebobler og reaktioner (se sind.js) -----
  const bobler = []; let sidsteBoble = 0, snakLyd = null;
  function goer(v, navn, ekstra) { if (v && !v.doer) v.akt = { navn, t0: tid, sek: VARIGHED[navn] || 1, ...ekstra }; }
  function sig(f, v, tekst, tving) {
    // monstrene snakker ikke længere (Nico: talebobler og pludren virkede pinlige)
    return;
    if (!f || (!tving && (bobler.length >= 6 || tid - sidsteBoble < 0.3))) return;
    if (bobler.some((b) => b.f === f)) return;
    sidsteBoble = tid;
    bobler.push({ f, x: f.x, y: f.y, h: ((f.d?.r || 10) > 15 ? 4.3 : 2.3) * (f.d?.str || 1) * FIG + (f.d?.luft ? 2.3 : 0), tekst, liv: 1.7, max: 1.7, stor: !!f.d?.boss });
    if (snakLyd && v) snakLyd(v.p.stemme, Math.min(4, 1 + tekst.split(' ').length), f.d?.boss ? 1.4 : 1);
  }
  const naermeste = (liste, x, y, r, undtag) => liste.filter((f) => f !== undtag && Math.hypot(f.x - x, f.y - y) < r);
  let alene = 0;
  function sindSkridt(f, v, str) {
    v.rod.rotation.x = 0;
    if (g.fase === 'kamp' && !g.koe.length && g.fjender.length === 1 && alene !== g.boelge && tid - v.foedt > 2) {          // den sidste i bølgen opdager, at den er alene
      alene = g.boelge; goer(v, 'kig', { vinkel: 1.2, sek: 2 }); sig(f, v, ['Hallo...?', 'Øh...', 'Gnuk?'][(Math.random() * 3) | 0], true);
    }
    if ((f.d.r || 10) >= 18 && Math.random() < 0.02) {          // de store skubber de små omkuld, når de går forbi
      for (const x of naermeste(g.fjender, f.x, f.y, 26, f)) { const w = fjender.get(x.nr); if (w && !w.akt && (x.d.r || 10) < 12) { goer(w, 'snuble'); if (Math.random() < 0.5) sig(x, w, 'Hey!'); break; } }
    }
    if (!v.akt) {
      if (f.brandT > 0 && Math.random() < 0.03) { goer(v, 'brand'); if (Math.random() < 0.4) sig(f, v, RAAB.brand[(Math.random() * 3) | 0]); }
      else if (f.bremsT > 0 && Math.random() < 0.02) { goer(v, 'ryst'); if (Math.random() < 0.4) sig(f, v, RAAB.frost[(Math.random() * 3) | 0]); }
      else if (tid > v.naeste) {
        v.naeste = tid + (3 + Math.random() * 9) / Math.sqrt(v.p.snak);
        let navn = vaelgHandling(v.p), ekstra = {};
        if (navn === 'kig' && g.taarne.length) {          // kigger over på det nærmeste tårn
          let t = null, bd = 1e9; for (const x of g.taarne) { const d = Math.hypot(x.x - f.x, x.y - f.y); if (d < bd) { bd = d; t = x; } }
          let w = (Math.PI / 2 - Math.atan2(t.y - f.y, t.x - f.x)) - (Math.PI / 2 - f.v); while (w > Math.PI) w -= 2 * Math.PI; while (w < -Math.PI) w += 2 * Math.PI;
          ekstra.vinkel = Math.max(-1.4, Math.min(1.4, w));
        }
        if (f.d.luft && navn !== 'loop' && navn !== 'vink') navn = 'loop';
        const ven = false && naermeste(g.fjender, f.x, f.y, 45, f).find((x) => { const w = fjender.get(x.nr); return w && !w.akt && !x.d.boss; });
        if (ven) {                                          // to monstre vender sig mod hinanden og snakker
          const w = fjender.get(ven.nr), side = Math.sign(v.side - w.side) || 1;
          goer(v, 'snak', { vinkel: 0.9 * side }); goer(w, 'snak', { vinkel: -0.9 * side });
          sig(f, v, saetning(v.p), false); setTimeout(() => sig(ven, w, saetning(w.p)), 650);
        } else {
          goer(v, navn, ekstra);
          const r = RAAB[navn];
          if (Math.random() < (r ? 0.5 : 0.28) * v.p.snak) sig(f, v, r && Math.random() < 0.6 ? r[(Math.random() * r.length) | 0] : saetning(v.p));
        }
      }
    }
    pose(v, str, tid);
  }
  function sindHaendelse(e) {
    if (!g) return;
    if (e.a === 'klaret' || (e.a === 'doed' && FJENDER[e.type]?.boss)) for (const v of taarne.values()) v.jubel = tid + Math.random() * 0.5;
    if (e.a === 'doed') {
      let raabt = false;
      for (const f of naermeste(g.fjender, e.x, e.y, 75)) {
        const v = fjender.get(f.nr); if (!v || f.d.boss) continue;
        const r = Math.random();
        if (r < 0.12) { goer(v, 'grin'); if (Math.random() < 0.5) sig(f, v, RAAB.grin[(Math.random() * 3) | 0]); }       // nogle synes, det er sjovt
        else if (r < 0.6) { goer(v, 'skraek'); if (!raabt && Math.random() < 0.45) { raabt = true; sig(f, v, RAAB.skraek[(Math.random() * 4) | 0]); } }
      }
    } else if (e.a === 'brag') {
      for (const f of naermeste(g.fjender, e.x, e.y, e.r * 1.6)) { const v = fjender.get(f.nr); if (v && !f.d.boss && Math.random() < 0.5) goer(v, 'skraek'); }
    } else if (e.a === 'frost') {
      let raabt = false;
      for (const f of naermeste(g.fjender, e.x, e.y, e.r)) { const v = fjender.get(f.nr); if (v && !v.akt && Math.random() < 0.3) { goer(v, 'ryst'); if (!raabt && Math.random() < 0.3) { raabt = true; sig(f, v, RAAB.frost[(Math.random() * 3) | 0]); } } }
    } else if (e.a === 'laek' && e.x != null && Math.random() < 0.7) {
      sig({ x: e.x, y: e.y, d: FJENDER[e.type] }, { p: pers(e.type) }, RAAB.laek[(Math.random() * 4) | 0], true);
    }
  }
  // Trin 5 har sine egne dele (maskinen). Her vælges, hvilke dele bevægelserne skal bruge.
  function vaelgDele(v, trin) {
    const find = (n) => (trin >= 4 && v.rod.getObjectByName(n + '5')) || v.rod.getObjectByName(n);
    v.sk = find('skuldre'); v.ok = find('overkrop'); v.hoved = find('hoved'); v.vaaben = find('vaaben'); v.munding = find('munding'); v.benV = find('benV'); v.benH = find('benH');
    v.mand = trin >= 4 ? null : v.rod.getObjectByName('mand'); v.mech = trin >= 4 && !!v.rod.getObjectByName('skuldre5'); v.platform = trin >= 4 && !!v.rod.getObjectByName('platform5');
    v.hvil = v.vaaben ? v.vaaben.position.clone() : null;
    if (v.benV) { v.bV0 = v.benV.rotation.x; v.bH0 = v.benH.rotation.x; }
  }
  function anvendTrin(v, t) {
    v.prikker.forEach((p, i) => { p.visible = i < t.trin; }); visTrin(v.rod, t.trin); vaelgDele(v, t.trin); if (!v.helt) pynt(v.rod, v.temaId, t.trin);
    v.glorie.material.color.set([0xffffff, 0xffffff, 0xffe9c4, 0xffd27a, 0xffb347][t.trin]);
  }
  const drejMod = (nu, maal, k) => { let d = maal - nu; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return nu + d * k; };
  const ind = (t) => { const u = Math.min(1, t / 0.28) - 1; return 1 + 2.2 * u * u * u + 1.2 * u * u; };   // lille hop, når noget kommer frem

  function mundingen(v, ud) { if (v.munding) v.munding.getWorldPosition(ud); else ud.copy(v.rod.position).setY(1.5); return ud; }

  // ----- hændelser fra reglerne -----
  // ----- monstrenes evner: spring, spurt og skjold vises på figuren -----
  const skjoldMat = new THREE.MeshBasicMaterial({ color: 0x7fb4ff, transparent: true, opacity: 0.16, depthWrite: false });
  function evneTegn(f, v, str) {
    const d = f.d;
    if (d.hop && f.hopT > 0) { const q = 1 - f.hopT / d.hop[2]; v.rod.position.y += Math.sin(Math.PI * q) * (d.boss ? 2.6 : 1.7); v.rod.rotation.x = -0.35 * Math.sin(Math.PI * q); }
    if (d.spurt && f.spurtT > 0) {
      v.rod.rotation.x = Math.min(0.42, (v.rod.rotation.x || 0) + 0.32);
      if (Math.random() < 0.5) { a.set(v.rod.position.x, 0.15, v.rod.position.z); gnist(a, (Math.random() - 0.5) * 0.6, 0.5, (Math.random() - 0.5) * 0.6, 0.35, 0x8c8478, 0.12, 0.35, 0.35); }
    }
    if (f.skjold > 0 && !v.skjold) { v.skjold = new THREE.Mesh(kugleG, skjoldMat); v.skjold.scale.setScalar(0.75); v.skjold.position.y = 0.75; v.rod.add(v.skjold); }
    if (v.skjold) { v.skjold.visible = f.skjold > 0; if (v.skjold.visible) v.skjold.rotation.y += 0.02; }
  }
  function evneHaendelse(e) {
    const v = e.nr != null ? fjender.get(e.nr) : null;
    if (e.a === 'hel') {
      ringFx(e.x, e.y, e.r, 0x6dff9e, 0.6, 0.45);
      for (const x of g.fjender) if (x.hp > 0 && Math.hypot(x.x - e.x, x.y - e.y) <= e.r) { a.set(X(x.x), 1.2, Z(x.y)); gnist(a, 0, 1.4, 0, 0.6, 0x6dff9e, 0.1, 0.02, 0.85); }
    } else if (e.a === 'skjold') ringFx(e.x, e.y, e.r, 0x7fb4ff, 0.7, 0.45);
    else if (e.a === 'skjoldbrud') { a.set(X(e.x), 1.1, Z(e.y)); for (let i = 0; i < 6; i++) gnist(a, (Math.random() - 0.5) * 3, 1 + Math.random() * 2, (Math.random() - 0.5) * 3, 0.35, 0x9cc6ff, 0.08, 0.02, 0.9); }
    else if (e.a === 'hop' && v) { a.set(v.rod.position.x, 0.1, v.rod.position.z); gnist(a, 0, 0.6, 0, 0.4, 0x8c8478, 0.3, 0.8, 0.35); }
  }
  function haendelse(e) {
    evneHaendelse(e);
    sindHaendelse(e);
    const v = e.t ? taarne.get(e.t) : null;
    if (e.a === 'spor' && v) {
      mundingen(v, a); b.set(X(e.x2), e.luft ? 2.6 : 0.7, Z(e.y2));
      const fv = v.lysFarve ?? ([0xfff1d0, 0xfff1d0, 0xffe9b8, 0xffd27a, 0xffb347][v.trin] ?? 0xfff1d0), tyk = (e.id === 'skytte' ? 0.07 : 0.045) * (1 + v.trin * 0.16) * (v.neon ? 1.6 : 1);
      streg(a, b, tyk, fv, e.id === 'skytte' ? 0.14 : 0.06 + v.trin * 0.008);
      if (v.lysFarve != null) { streg(a, b, tyk * 3.2, fv, 0.09, 0.28); gnist(b, 0, 1.5, 0, 0.22, fv, 0.25, 0.04, 0.9); }      // outfittets lys gløder i skuddet
      const kryds = 0.22 + v.trin * 0.05;       // et lille lyskryds, hvor skuddet rammer
      c.set(b.x - kryds, b.y, b.z); d_.set(b.x + kryds, b.y, b.z); streg(c, d_, 0.03, fv, 0.08, 0.9);
      c.set(b.x, b.y - kryds, b.z); d_.set(b.x, b.y + kryds, b.z); streg(c, d_, 0.03, fv, 0.08, 0.9);
      if (v.trin >= 2 && Math.random() < 0.35) { const t_ = g.taarne.find((x) => x.nr === e.t); if (t_) ringFx(t_.x, t_.y, 22 + v.trin * 4, v.lysFarve ?? 0x5ce0ff, 0.35, 0.45); }
      gnist(a, 0, 0, 0, 0.06, v.lysFarve ?? 0xffd9a0, 0.22 * (v.neon ? 1.6 : 1), 0.05);
      gnist(b, 0, 2, 0, 0.12, 0xffffff, 0.1, 0.02);
    } else if (e.a === 'hagl' && v) {
      mundingen(v, a);
      for (let i = 0; i < 6; i++) { const w = e.v + (i - 2.5) * 0.18, l = e.r * (0.75 + Math.random() * 0.25); b.set(X(e.x + Math.cos(w) * l), 0.6, Z(e.y + Math.sin(w) * l)); streg(a, b, 0.035, 0xfff1d0, 0.07); }
      gnist(a, 0, 0, 0, 0.08, 0xffd9a0, 0.4, 0.1);
    } else if (e.a === 'brag') {
      a.set(X(e.x), 0.4, Z(e.y)); const r = e.r * K;
      gnist(a, 0, 1.5, 0, 0.3, ORANGE, r * 0.35, r * 0.95, 0.8);
      gnist(a, 0, 3, 0, 0.16, 0xfff1d0, r * 0.25, r * 0.55, 1);
      for (let i = 0; i < 7; i++) { const w = Math.random() * 6.28, s = 4 + Math.random() * 6; gnist(a, Math.cos(w) * s, 3 + Math.random() * 5, Math.sin(w) * s, 0.4, ORANGE, 0.14, 0.02); }
      ringFx(e.x, e.y, e.r, ORANGE, 0.35);
    } else if (e.a === 'frost') ringFx(e.x, e.y, e.r, 0x9fdcff, 0.55, 0.5);
    else if (e.a === 'lyn' && v) {
      const o = nyLyn(), p = o.geometry.attributes.position; let n = 0;
      mundingen(v, a);
      const pkt = e.pkt.map((q, i) => (i ? new THREE.Vector3(X(q[0]), 0.8, Z(q[1])) : a.clone()));
      for (let i = 1; i < pkt.length && n < 72; i++) for (let j = 0; j < 6; j++) {
        c.lerpVectors(pkt[i - 1], pkt[i], j / 6); const u = j ? 0.35 : 0;
        p.setXYZ(n++, c.x + (Math.random() - 0.5) * u * 2, c.y + (Math.random() - 0.5) * u, c.z + (Math.random() - 0.5) * u * 2);
      }
      const s = pkt[pkt.length - 1]; p.setXYZ(n++, s.x, s.y, s.z);
      p.needsUpdate = true; o.geometry.setDrawRange(0, n); o.liv = o.max = 0.16; o.op = 1; o.v = null; o.s = null; o.visible = true; aktive.add(o);
      for (let i = 1; i < pkt.length; i++) gnist(pkt[i], 0, 1, 0, 0.14, 0xcfeeff, 0.3, 0.05);
    } else if (e.a === 'skinne' && v) {
      mundingen(v, a); b.set(X(e.x2), a.y * 0.5, Z(e.y2));
      streg(a, b, 0.16, 0xc98bff, 0.32); streg(a, b, 0.05, 0xffffff, 0.2);
      gnist(a, 0, 0, 0, 0.15, 0xc98bff, 0.5, 0.1);
    } else if (e.a === 'doed') {
      const fv = fjender.get(e.nr); if (fv) fv.doer = true;
      const d = FJENDER[e.type]; a.set(X(e.x), 0.8 * d.str, Z(e.y));
      gnist(a, 0, 1, 0, 0.22, ROED, d.r * K * 0.6, d.r * K * 1.5, 0.7);
      for (let i = 0; i < (d.boss ? 16 : 4); i++) { const w = Math.random() * 6.28, s = 2 + Math.random() * 4; gnist(a, Math.cos(w) * s, 2 + Math.random() * 4, Math.sin(w) * s, 0.35, ROED, 0.12, 0.02); }
      if (e.n) tekst(e.x, e.y, 2.1 * d.str, '+' + e.n);
    } else if (e.a === 'tjen') tekst(e.x, e.y, 3.4, '+' + e.n, 'rgba(92,255,156,.95)');
    if (e.a === 'byg') fjernTraeer(e.x, e.y);
    if (e.a === 'byg' || e.a === 'op') ringFx(e.x, e.y, e.a === 'op' ? 34 : 26, 0xffffff, 0.4, 0.7);
    else if (e.a === 'salg') { a.set(X(e.x), 0.8, Z(e.y)); gnist(a, 0, 2, 0, 0.25, 0xffffff, 0.3, 1.1, 0.35); }
    else if (e.a === 'enhedskud') { a.set(X(e.x1), 0.9, Z(e.y1)); b.set(X(e.x2), 0.7, Z(e.y2)); streg(a, b, 0.06, 0xfff1d0, 0.08); gnist(b, 0, 2, 0, 0.18, 0xffc45a, 0.18, 0.03); }
    else if (e.a === 'stoed') { a.set(X(e.x), 0.8, Z(e.y)); gnist(a, 0, 2, 0, 0.14, 0xffffff, 0.15, 0.5, 0.7); }
    else if (e.a === 'dump' && v) { mundingen(v, a); gnist(a, 0, 4, 0, 0.3, 0xcccccc, 0.15, 0.5, 0.4); }
    if (e.a === 'op' && v) v.op = tid;          // selve forvandlingen tegnes, når tårnet skifter trin
  }

  // ----- kameraet -----
  const ret = new THREE.Vector3(0, Math.sin(0.93), Math.cos(0.93));     // ser skråt ned
  const midte = new THREE.Vector3(0, 0, 0.5);
  const ret0 = ret.clone();
  // stående skærm: banen drejes en kvart omgang, så dens lange side følger skærmens lange side
  let drej0 = 0;
  let grundAfstand = 100, zoom = 1, forskyd = 0, drejV = 0, nik = 0.93;
  function stil() {
    ret.set(Math.sin(drejV) * Math.cos(nik), Math.sin(nik), Math.cos(drejV) * Math.cos(nik));
    const gx = FELT.b / 2 * K, gz = FELT.h / 2 * K;                     // udsnittet kan flyttes frit, så længe man ser på banen
    midte.x = Math.max(-gx, Math.min(gx, midte.x)); midte.z = Math.max(-gz + 0.5, Math.min(gz + 0.5, midte.z));
    kamera.position.copy(midte).addScaledVector(ret, grundAfstand / zoom); kamera.lookAt(midte); kamera.updateMatrixWorld();
    if (scene.fog) { scene.fog.near = grundAfstand / zoom + 55; scene.fog.far = grundAfstand / zoom + 230; }      // disen begynder altid bag banen, aldrig oven på den
  }
  function pas() {
    const staa = hoejde > bredde * 1.1;
    ret0.set(Math.sin(drej0) * Math.cos(0.93), Math.sin(0.93), Math.cos(drej0) * Math.cos(0.93));
    // stående: mål selve topbjælken og tårnbjælken, så banen ligger frit imellem dem (de flytter sig med notch og hjemlinje)
    const hudB = staa ? document.querySelector('#kamp .hud')?.getBoundingClientRect().bottom || 0 : 0, dokT = staa ? document.getElementById('dok')?.getBoundingClientRect().top || 0 : 0;
    const top = (staa ? (hudB ? hudB + 52 : 112) : 74) / hoejde * 2, bund = (staa ? (dokT ? hoejde - dokT + 10 : 118) : 128) / hoejde * 2, side = 24 / bredde * 2, m0 = new THREE.Vector3(0, 0, 0.5);
    const hj = [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([x, z]) => new THREE.Vector3(x * FELT.b / 2 * K, 0, z * FELT.h / 2 * K));
    const se_ = (d) => { kamera.position.copy(m0).addScaledVector(ret0, d); kamera.lookAt(m0); kamera.updateMatrixWorld(); let lo = 9, hi = -9, bred = 0; for (const h of hj) { a.copy(h).project(kamera); lo = Math.min(lo, a.y); hi = Math.max(hi, a.y); bred = Math.max(bred, Math.abs(a.x)); } return [lo, hi, bred]; };
    kamera.clearViewOffset(); kamera.updateProjectionMatrix();
    let lo = 20, hi = 400;
    for (let i = 0; i < 26; i++) { const d = (lo + hi) / 2, [y0, y1, bred] = se_(d); if (bred <= 1 - (staa ? 8 / bredde * 2 : side) && y1 - y0 <= 2 - top - bund) hi = d; else lo = d; }
    grundAfstand = hi;
    const [y0, y1] = se_(hi);
    forskyd = ((y0 + y1) / 2 - (bund - top) / 2) * hoejde / 2;       // skub billedet, så banen ligger midt mellem top- og bundlinjen
    kamera.setViewOffset(bredde, hoejde, 0, -forskyd, bredde, hoejde);
    stil();
  }
  // Alt, man gør med kameraet, sætter et mål. Kameraet glider derhen, så intet rykker.
  const maal = { drej: 0, nik: 0.93, zoom: 1, midte: new THREE.Vector3(0, 0, 0.5) };
  const hold = () => { const gx = FELT.b / 2 * K, gz = FELT.h / 2 * K; maal.midte.x = Math.max(-gx, Math.min(gx, maal.midte.x)); maal.midte.z = Math.max(-gz + 0.5, Math.min(gz + 0.5, maal.midte.z)); };
  function glid(dt) {
    const k = bloedt ? 1 - Math.exp(-dt * 9) : 1;
    drejV += (maal.drej - drejV) * k; nik += (maal.nik - nik) * k; zoom += (maal.zoom - zoom) * k; midte.lerp(maal.midte, k); stil();
  }
  function rul(e) {                          // to fingre drejer og vipper, knib (eller ctrl + hjul) zoomer ind mod musen
    if (!g) return;
    if (e.ctrlKey || e.metaKey) {
      const p = tilFelt(e.clientX, e.clientY), nyt = Math.max(0.7, Math.min(3.2, maal.zoom * Math.exp(-e.deltaY * 0.012)));
      if (p) { const f = maal.zoom / nyt, px = X(p.x), pz = Z(p.y); maal.midte.x = px + (maal.midte.x - px) * f; maal.midte.z = pz + (maal.midte.z - pz) * f; }
      maal.zoom = nyt; hold();
    } else if (e.shiftKey) flyt(e.deltaX || e.deltaY, e.deltaX ? e.deltaY : 0);
    else if (Math.abs(e.deltaX) >= Math.abs(e.deltaY)) drej(e.deltaX * 0.6, 0);
    else drej(0, -e.deltaY * 0.6);
  }
  function flyt(dx, dy) {                   // skub udsnittet, i den retning man ser
    const f = grundAfstand / maal.zoom * 0.0011, c = Math.cos(maal.drej), s = Math.sin(maal.drej), y = dy * 1.25; maal.midte.x += (dx * c + y * s) * f; maal.midte.z += (-dx * s + y * c) * f; hold();
  }
  function kig(x, y, z = maal.zoom) { maal.midte.set(X(x), 0, Z(y)); maal.zoom = z; hold(); midte.copy(maal.midte); zoom = z; stil(); }
  function zoomTrin(n) { maal.zoom = Math.max(0.7, Math.min(3.2, maal.zoom * n)); }
  function drej(dx, dy) { maal.drej -= dx * 0.006; maal.nik = Math.max(0.35, Math.min(1.45, maal.nik + dy * 0.004)); }      // rundt om det punkt, man ser på, og op/ned
  function ligeUd() { maal.drej = drej0 + Math.round((drejV - drej0) / (2 * Math.PI)) * 2 * Math.PI; maal.nik = 0.93; maal.zoom = 1; maal.midte.set(0, 0, 0.5); }
  function nulstilKamera() { drejV = maal.drej = drej0; nik = maal.nik = 0.93; zoom = maal.zoom = 1; midte.set(0, 0, 0.5); maal.midte.set(0, 0, 0.5); }

  // Efterbehandling: dybdeskarphed (skarpt på banen, blødt forrest og bagerst) og lys, der gløder.
  // Ét ekstra trin pr. billede. Bliver billederne for langsomme, slår den sig selv fra.
  // 2 prøver pr. punkt mod kanttakker (før 4): billedet tegnes allerede i 1,5x opløsning og sløres bagefter, så forskellen ses ikke, men grafikkortet sparer det meste af tiden
  const billede = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 2, depthTexture: new THREE.DepthTexture(4, 4) });
  const efterMat = new THREE.ShaderMaterial({
    uniforms: { tF: { value: billede.texture }, tD: { value: billede.depthTexture }, px: { value: new THREE.Vector2() }, naer: { value: 1 }, fjern: { value: 600 }, fokus: { value: 100 }, skarp: { value: 30 }, vidde: { value: 90 }, gloed: { value: 0.55 }, proj: { value: 800 }, aoR: { value: 0.7 }, aoS: { value: 1.0 }, kontrast: { value: 0.42 } },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: `uniform sampler2D tF; uniform sampler2D tD; uniform vec2 px; uniform float naer; uniform float fjern; uniform float fokus; uniform float skarp; uniform float vidde; uniform float gloed; uniform float proj; uniform float aoR; uniform float aoS; uniform float kontrast; varying vec2 vUv;
      float dybde(vec2 p) { float z = texture2D(tD, p).x * 2.0 - 1.0; return 2.0 * naer * fjern / (fjern + naer - z * (fjern - naer)); }
      void main() {
        float z = texture2D(tD, vUv).x * 2.0 - 1.0, d = 2.0 * naer * fjern / (fjern + naer - z * (fjern - naer));
        float uskarp = clamp((abs(d - fokus) - skarp) / vidde, 0.0, 1.0);
        vec3 sum = texture2D(tF, vUv).rgb, lys = vec3(0.0);
        float drej_ = fract(sin(dot(vUv, vec2(12.9898, 78.233))) * 43758.5453) * 6.2832;      // hvert punkt drejer mønstret lidt, så der ikke opstår stjerner
        for (int i = 0; i < 24; i++) {
          float v = float(i) * 2.39996 + drej_, r = sqrt((float(i) + 0.5) / 24.0); vec2 o = vec2(cos(v), sin(v)) * r * px;
          if (uskarp > 0.0) sum += texture2D(tF, vUv + o * uskarp * 7.0).rgb;
          lys += max(texture2D(tF, vUv + o * (5.0 + uskarp * 7.0)).rgb - vec3(1.0), 0.0);
        }
        // skarpe punkter (hele midten af banen) springer de 24 sløringsprøver over: samme resultat, færre opslag
        if (uskarp <= 0.0) sum *= 25.0;
        // bløde skygger i krogene (som Blenders lys, der hopper rundt): punkter, der ligger dybere end deres naboer på begge sider,
        // er i en fold, under en hjelm eller ved foden af en figur. Parvise prøver, så skrå flader ikke bliver mørke.
        float ao = 0.0;
        if (texture2D(tD, vUv).x < 0.9999) {
          float rpx = clamp(aoR * proj / d, 1.5, 36.0);
          for (int i = 0; i < 8; i++) {
            float v = float(i) * 2.39996 + drej_, r = sqrt((float(i) + 0.5) / 8.0); vec2 o = vec2(cos(v), sin(v)) * r * rpx * px;
            float d1 = dybde(vUv + o), d2 = dybde(vUv - o), dd = d - 0.5 * (d1 + d2);
            ao += smoothstep(0.04 * aoR, 0.4 * aoR, dd) * (1.0 - smoothstep(aoR * 1.5, aoR * 4.0, max(d - d1, d - d2)));
          }
          ao = 1.0 - aoS * ao / 8.0;
        } else ao = 1.0;
        vec3 c = sum / 25.0 * ao + lys / 24.0 * gloed;
        float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
        c = pow(max(c, 0.0), vec3(1.05)) * 0.98;                                        // dybere skygger, intet løft
        c *= mix(vec3(0.94, 0.98, 1.06), vec3(1.04, 1.0, 0.95), smoothstep(0.0, 0.6, lum));      // køligt i skyggerne, varmt i lyset
        c *= 1.0 - 0.42 * pow(length(vUv - 0.5) * 1.3, 2.2);                           // mørkere kant
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        vec3 t_ = clamp(gl_FragColor.rgb, 0.0, 1.0);
        t_ = pow(t_, vec3(1.14));                                                        // AgX løfter det sorte; træk det ned igen
        t_ = mix(t_, t_ * t_ * (3.0 - 2.0 * t_), kontrast);                           // AgX "Medium High Contrast" som i Blender
        float tl = dot(t_, vec3(0.2126, 0.7152, 0.0722)); gl_FragColor.rgb = max(mix(vec3(tl), t_, 1.12), 0.0);      // AgX tager lidt farve; giv den tilbage
        #include <colorspace_fragment>
      }`,
    depthTest: false, depthWrite: false,
  });
  const efterScene = new THREE.Scene(), efterKam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  efterScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), efterMat));
  let efter = true, langsom = 0, maalt = 0, skarp = true, bloedt = true, dprSkala = 1;
  let skyggeN = 0;
  function vis_(dt) {
    // solen står stille, så skyggekortet tegnes kun hvert andet billede (en tegning pr. figurdel sparet); kun det, der bevæger sig, er et billede bagud
    renderer.shadowMap.autoUpdate = false; renderer.shadowMap.needsUpdate = (skyggeN = (skyggeN + 1) % 2) === 0;
    if (efter) {
      const u = efterMat.uniforms, f = grundAfstand / zoom;
      u.naer.value = kamera.near; u.fjern.value = kamera.far; u.fokus.value = f; u.skarp.value = f * 0.09 + 2; u.vidde.value = f * 0.32;      // miniature: kun midten skarp, som i Form
      renderer.setRenderTarget(billede); renderer.render(scene, kamera); renderer.setRenderTarget(null); renderer.render(efterScene, efterKam);
      if (dt > 0) { maalt++; if (dt > 1 / 40) langsom++; if (maalt >= 240) { const f = dprSkala; if (langsom > 90) dprSkala = Math.max(0.75, dprSkala - 0.1); else if (langsom < 3 && dprSkala < 1) dprSkala = Math.min(1, dprSkala + 0.05); if (f !== dprSkala) stoerrelse(); maalt = langsom = 0; } }      // hakker det, så tegn lidt færre punkter; effekterne bliver
    } else renderer.render(scene, kamera);
  }
  function grafik(til) { const nyt = til ?? !efter; if (nyt !== efter) { efter = nyt; stoerrelse(); } return efter; }
  function stoerrelse() {
    bredde = laerred.clientWidth || 1; hoejde = laerred.clientHeight || 1;
    const lille = Math.min(bredde, hoejde) < 600;
    const dpr = Math.max(0.6, Math.min(skarp ? (lille ? 1.25 : 1.5) : 1, devicePixelRatio || 1) * dprSkala);
    renderer.setPixelRatio(dpr); renderer.setSize(bredde, hoejde, false);
    billede.setSize(Math.round(bredde * dpr), Math.round(hoejde * dpr)); efterMat.uniforms.px.value.set(1 / bredde, 1 / hoejde);
    efterMat.uniforms.proj.value = hoejde / (2 * Math.tan(THREE.MathUtils.degToRad(kamera.fov / 2)));
    lag.width = bredde * dpr; lag.height = hoejde * dpr; k2.setTransform(dpr, 0, 0, dpr, 0, 0);
    const d0 = hoejde > bredde * 1.1 ? Math.PI / 2 : 0;
    if (d0 !== drej0) { drejV += d0 - drej0; maal.drej += d0 - drej0; drej0 = d0; }
    kamera.aspect = bredde / hoejde; pas();
  }
  const straale = new THREE.Raycaster(), plan = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), tagPlan = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), mus = new THREE.Vector2();
  function tilFelt(cx, cy) {
    const r = laerred.getBoundingClientRect();
    mus.set((cx - r.left) / r.width * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    straale.setFromCamera(mus, kamera);
    // tagene først: rammer strålen et tag, man kan stå på, er det dér, man peger
    let bedst = null, bd = Infinity;
    for (const [x0, y0, x1, y1, h] of g?.bane.tage || []) {
      tagPlan.constant = -h;
      if (!straale.ray.intersectPlane(tagPlan, b)) continue;
      const fx = b.x / K + FELT.b / 2, fy = b.z / K + FELT.h / 2, d = straale.ray.origin.distanceTo(b);
      if (fx > x0 && fx < x1 && fy > y0 && fy < y1 && d < bd) { bd = d; bedst = { x: fx, y: fy, hoej: h }; }
    }
    if (bedst) return bedst;
    if (!straale.ray.intersectPlane(plan, a)) return null;
    return { x: a.x / K + FELT.b / 2, y: a.z / K + FELT.h / 2 };
  }
  function paaSkaerm(x, y, h) { a.set(X(x), h, Z(y)).project(kamera); return [(a.x + 1) / 2 * bredde, (1 - a.y) / 2 * hoejde]; }

  // ----- nyt spil -----
  function saetSpil(spil) {
    for (const m of [taarne, fjender, enheder, skud]) { for (const v of m.values()) (v.rod || v).removeFromParent(); m.clear(); }
    for (const o of aktive) o.visible = false; aktive.clear(); tekster.length = 0;
    for (const v of doende) v.rod.removeFromParent(); doende.length = 0;
    if (by) natNed();
    if (!spil) { by?.removeFromParent(); by = null; byLiv = []; byHjul = []; }
    if (grund) { grund.removeFromParent(); grund.material.map.dispose(); grund.geometry.dispose(); }
    if (borg) borg.removeFromParent();
    detalje?.removeFromParent(); detalje = null; detaljeSteder = [];
    g = spil; valgt = null; raekke.visible = false; fjernSpoegelse(); nulstilKamera();
    if (!g) return;
    const gb = grundBillede(g.bane);
    grund = new THREE.Mesh(new THREE.PlaneGeometry(gb.b, gb.h), new THREE.MeshBasicMaterial({ map: gb.t, toneMapped: false, transparent: gb.oe, alphaTest: gb.oe ? 0.5 : 0 }));
    grund.rotation.x = -Math.PI / 2; scene.add(grund);
    const s = g.bane.p[g.bane.p.length - 1];
    by?.removeFromParent(); by = null; byLiv = []; byHjul = [];
    if (g.bane.by) {                           // en rigtig by omkring vejen; byens eget rådhus er skansen
      by = M[g.bane.by]; daempModel(by); scene.add(by); if (g.bane.oe) oeOp(); else natOp();
      traeOp();
      detaljeOp();
      byLiv = (g.bane.liv || []).map((l) => ({ ...l, o: by.getObjectByName(l.knude) })).filter((l) => l.o);
      byHjul = []; by.traverse((o) => { if (o.name.startsWith('spin')) byHjul.push(o); });
      borg = new THREE.Group();
    } else { borg = M.borg.clone(true); borg.scale.setScalar(1.25); }
    borg.position.set(X(s[0]), 0, Z(s[1])); scene.add(borg);
    for (const o of tagKanter) o.removeFromParent(); tagKanter = [];
    for (const [x0, y0, x1, y1, h] of g.bane.tage || []) {
      const ind = 12, pkt = [[x0 + ind, y0 + ind], [x1 - ind, y0 + ind], [x1 - ind, y1 - ind], [x0 + ind, y1 - ind]].map(([x, y]) => new THREE.Vector3(X(x), h + 0.06, Z(y)));
      const o = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pkt), new THREE.LineBasicMaterial({ color: 0xbfe9ff, transparent: true, opacity: 0.35, depthWrite: false }));
      scene.add(o); tagKanter.push(o);
    }
    livring = new THREE.Mesh(new THREE.RingGeometry(2.25, 2.4, 96), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false }));
    livring.rotation.x = -Math.PI / 2; livring.position.y = 0.05; borg.add(livring); livring.vist = -1;
    stoerrelse();
  }

  function fjernSpoegelse() { if (spoeg) { spoeg.removeFromParent(); spoeg = null; spoegId = null; } }
  function spoegelse(id, x, y, ok, r) {
    if (!id) { fjernSpoegelse(); if (!valgt) raekke.visible = false; return; }
    if (spoegId !== id) {
      fjernSpoegelse(); spoegId = id; spoeg = M[id].clone(true);
      visTrin(spoeg, 0); spoeg.traverse((o) => { if (o.isMesh) { o.material = spoegMat; o.castShadow = false; } }); scene.add(spoeg);
    }
    spoeg.scale.setScalar(FIG); spoeg.position.set(X(x), tagVed(g.bane, x, y), Z(y)); spoegMat.color.set(ok ? 0xffffff : ROED);
    visRaekke(x, y, r, ok);
  }
  function visRaekke(x, y, r, ok = true) {
    raekke.visible = !!r; if (!r) return;
    raekke.position.set(X(x), (g ? tagVed(g.bane, x, y) : 0) + 0.05, Z(y)); raekke.scale.setScalar(r * K);
    rk.material.color.set(ok ? 0xffffff : ROED); rf.material.color.set(ok ? 0xffffff : ROED);
  }
  function vaelg(t) { valgt = t; if (!t) raekke.visible = false; }

  // ----- et billede -----
  function tegn(dt) {
    if (!g) return;
    tid += dt; glid(Math.max(dt, 0.016));
    for (const l of byLiv) {                   // metrotog og havnebus kører frem og tilbage
      const q = (tid / l.sek) % 2, u = q < 1 ? q : 2 - q, e = u * u * (3 - 2 * u);
      l.o.position.x = X(l.fra[0] + (l.til[0] - l.fra[0]) * e); l.o.position.z = Z(l.fra[1] + (l.til[1] - l.fra[1]) * e);
      if (l.hoej) l.o.position.y = l.hoej[0] + (l.hoej[1] - l.hoej[0]) * e;
    }
    for (const o of byHjul) o.rotateY(dt * (o.name.startsWith('spin_v') ? 1.6 : o.name === 'spin_fyr' ? 0.5 : 0.22));
    if (by) { if (g.bane.oe) oeLiv(dt); else natLiv(dt); }
    vejrSkridt(dt); for (const o of nordlys) o.material.uniforms.t.value = tid;
    // tårne
    const set = new Set();
    for (const t of g.taarne) {
      set.add(t.nr);
      let v = taarne.get(t.nr); if (!v) { v = lavTaarn(t); taarne.set(t.nr, v); }
      if (v.trin !== t.trin) { if (v.trin < 0) anvendTrin(v, t); else v.forv = { t0: tid, stor: t.trin === 4, skiftet: false }; v.trin = t.trin; }
      // forvandlingen: figuren trykkes sammen og drejer, gnister suges ind, så springer den nye form frem
      let fy = 1, fxz = 1, spin = 0;
      if (v.forv) {
        const f = v.forv, varig = f.stor ? 1.3 : 0.75, q = (tid - f.t0) / varig, px = v.rod.position.x, pz = v.rod.position.z;
        if (q < 0.42) {
          const e = q / 0.42; fy = 1 - 0.55 * e * e; fxz = 1 + 0.22 * e;
          if (Math.random() < dt * (f.stor ? 60 : 30)) { const w = Math.random() * 6.28, r = 2.2 + Math.random(); a.set(px + Math.cos(w) * r, 0.3 + Math.random() * 2, pz + Math.sin(w) * r); gnist(a, -Math.cos(w) * r / 0.4, 0, -Math.sin(w) * r / 0.4, 0.4, f.stor ? 0xff7ad8 : 0xffd27a, 0.09, 0.02, 1); }
        } else {
          if (!f.skiftet) {
            f.skiftet = true; anvendTrin(v, t);
            a.set(px, 0.2, pz); b.set(px, f.stor ? 14 : 9, pz); streg(a, b, f.stor ? 0.9 : 0.55, f.stor ? 0xff7ad8 : 0xfff1d0, 0.5, 0.55); streg(a, b, 0.18, 0xffffff, 0.35, 0.95);
            for (let i = 0; i < (f.stor ? 34 : 18); i++) { const w = i / (f.stor ? 34 : 18) * 6.28, s_ = 3 + Math.random() * 4; gnist(a, Math.cos(w) * s_, 3 + Math.random() * 6, Math.sin(w) * s_, 0.7, f.stor ? 0xff7ad8 : 0xffc45a, 0.14, 0.02); }
            ringFx(t.x, t.y, f.stor ? 120 : 60, f.stor ? 0xff7ad8 : 0xffffff, 0.6, 0.85);
            if (f.stor) for (let i = 0; i < 7; i++) {          // lyn rundt om maskinen, der bliver til
              const w = Math.random() * 6.28; let x0 = px + Math.cos(w) * 0.6, z0 = pz + Math.sin(w) * 0.6, y0 = 4 + Math.random() * 2;
              for (let j = 0; j < 4; j++) { const x1 = x0 + (Math.random() - 0.5) * 1.6, z1 = z0 + (Math.random() - 0.5) * 1.6, y1 = y0 - 1.1; a.set(x0, y0, z0); b.set(x1, y1, z1); streg(a, b, 0.05, 0xd8c4ff, 0.3, 1); x0 = x1; z0 = z1; y0 = y1; }
            }
          }
          const e = (q - 0.42) / 0.58, c = 1.9; fy = fxz = 1 + (c + 1) * Math.pow(e - 1, 3) + c * Math.pow(e - 1, 2);
        }
        spin = Math.min(1, q) < 1 ? (q * q * (3 - 2 * q)) * Math.PI * 2 * (f.stor ? 2 : 1) : 0;
        if (q >= 1) v.forv = null;
      }
      v.glorie.material.opacity = t.trin ? 0.16 + t.trin * 0.09 + (t.trin === 4 ? Math.sin(tid * 3 + v.fase) * 0.12 : 0) : 0;
      if (t.trin === 4 && Math.random() < dt * 2.5) { const w = Math.random() * 6.28; a.set(v.rod.position.x + Math.cos(w) * 1.35, 0.2, v.rod.position.z + Math.sin(w) * 1.35); gnist(a, 0, 1.4 + Math.random(), 0, 0.7, 0xffc45a, 0.07, 0.01, 0.9); }      // guldstøv om de fuldt opgraderede
      const alder = tid - v.foedt, siden = g.t - t.skudT, art = t.def.art;
      const sk_ = FIG * ind(alder); v.rod.scale.set(sk_ * fxz, sk_ * fy, sk_ * fxz); v.rod.rotation.y = spin;
      if (art === 'drone') {
        v.drone.position.set(Math.cos(t.drV) * DRONEBANE * K / FIG, 2.3 + Math.sin(tid * 2.2 + v.fase) * 0.08, Math.sin(t.drV) * DRONEBANE * K / FIG);
        v.vinkel = drejMod(v.vinkel, siden < 1 ? Math.PI / 2 - t.v : -t.drV, Math.min(1, dt * 10)); v.drone.rotation.set(0.12, v.vinkel, 0);
      } else if (v.drej && art !== 'moelle' && art !== 'signal' && art !== 'kaserne' && art !== 'lyn' && art !== 'frost') {
        let d = Math.PI / 2 - t.v - v.vinkel; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;       // drejer som en fjeder: lidt for langt og tilbage
        v.vf += (d * v.stiv - v.vf * 1.45 * Math.sqrt(v.stiv)) * dt; v.vinkel += v.vf * dt; v.drej.rotation.y = v.vinkel;
      } else if (art === 'frost') { v.vinkel += dt * (siden < 0.4 ? 5 : 0.4); v.drej.rotation.y = v.vinkel; }
      if (v.drej && v.dy != null && art !== 'vogn') v.drej.position.y = v.dy + Math.sin(tid * 2 + v.fase) * 0.012 + (v.platform ? 0.55 + Math.sin(tid * 1.6 + v.fase) * 0.06 : 0);      // platformen svæver og vugger
      if (v.platform && Math.random() < dt * 8) { const w = Math.random() * 6.28; a.set(v.rod.position.x + Math.cos(w) * 0.7, v.rod.position.y + 0.35, v.rod.position.z + Math.sin(w) * 0.7); gnist(a, 0, -0.6, 0, 0.5, 0x5ce0ff, 0.06, 0.01, 0.8); }
      if (v.vaaben) {
        const ryk = Math.max(0, 1 - siden / (art === 'skud' && t.id === 'skytte' ? 0.35 : 0.13));
        v.vaaben.position.copy(v.hvil);
        if (art === 'morter') v.vaaben.position.y -= ryk * 0.12;
        else if (art === 'granat') v.vaaben.position.y += ryk * 0.25;
        else if (art !== 'lyn') v.vaaben.position.z -= ryk * (t.id === 'skytte' || t.id === 'skinne' ? 0.22 : 0.1);
      }
      // bevægelser: hop og en omgang rundt ved opgradering, fald ned ved placering, arme der rykker, hoved der ser sig om
      const jq = v.jubel ? (tid - v.jubel) / 0.6 : -1, u = jq > 0 && jq < 1 ? jq : 0, hop = u ? Math.sin(Math.PI * u) * 0.32 : 0, fald = Math.max(0, 1 - alder / 0.22);      // jubel: hop med armene i vejret
      v.rod.position.y = (t.hoej || 0) + hop * 1.1 + fald * fald * 4;
      if (hop && v.sk && v.drej) v.drej.rotation.y = v.vinkel + u * u * (3 - 2 * u) * Math.PI * 2;
      if (t.skudT !== v.sidstSkud) { v.sidstSkud = t.skudT; v.rykAmp = 0.65 + Math.random() * 0.7; v.rykSide = (Math.random() - 0.5) * 0.12; }
      // små vaner, når der ikke er noget at skyde på: kigge sig om, skifte vægt, se til våbnet, strække sig, trippe
      const ledig = siden > 1.4;
      if (!ledig) { v.gest = null; v.naeste = tid + 1.5 + Math.random() * 4; }
      else if (!v.gest && tid > v.naeste) v.gest = { a: ['kig', 'kig', 'vaegt', 'tjek', 'straek', 'fod'][Math.random() * 6 | 0], t0: tid, sek: 1.1 + Math.random() * 2.4, k: (Math.random() < 0.5 ? -1 : 1) * (0.45 + Math.random() * 0.55) };
      let ge = 0, ga = '';
      if (v.gest) {
        const q = (tid - v.gest.t0) / v.gest.sek;
        if (q >= 1) { v.gest = null; v.naeste = tid + 1.5 + Math.random() * 6; }
        else { const op_ = Math.min(1, q / 0.25), ned_ = Math.min(1, (1 - q) / 0.3); ge = op_ * op_ * (3 - 2 * op_) * ned_ * ned_ * (3 - 2 * ned_) * v.gest.k; ga = v.gest.a; }
      }
      const uro = Math.sin(tid * v.n1 + v.fase) * 0.6 + Math.sin(tid * v.n2 + v.fase * 2.3) * 0.4;
      if (v.sk) {
        const ryk = Math.max(0, 1 - siden / 0.16) * v.rykAmp;
        let x = Math.sin(tid * v.puls + v.fase) * 0.018 + uro * 0.012 - ryk * (t.id === 'skytte' || t.id === 'skinne' ? 0.3 : 0.14);
        if (ga === 'tjek') x += Math.abs(ge) * 0.42; else if (ga === 'straek') x -= Math.abs(ge) * 0.38;
        if (art === 'granat') { const k = Math.min(1, siden / 0.4); x += -1.5 * (1 - k) * (1 - k) + 0.55 * Math.sin(k * Math.PI); v.vaaben.visible = siden > 0.55; }
        if (art === 'frost') x -= Math.max(0, 1 - siden / 0.5) * 0.45;
        if (art === 'morter') x = -Math.max(0, 1 - siden / 0.5) * 1.6;
        if (hop) x = -2.4 * hop;
        v.sk.rotation.x = x; v.sk.rotation.z = ryk * v.rykSide + (ga === 'vaegt' ? ge * 0.05 : 0);
        if (v.drej && art !== 'morter') v.drej.rotation.z = (ga === 'vaegt' ? ge * 0.06 : 0) + uro * 0.008;
      }
      if (v.hoved) { v.hv += ((ledig ? uro * 0.2 + (ga === 'kig' ? ge * 0.95 : 0) : 0) - v.hv) * Math.min(1, dt * 5); v.hoved.rotation.y = v.hv; }
      // heltenes overkrop (jakke, arme, våben, hoved) drejer om taljen: åndedræt, rekyl, vægtskifte, se sig om.
      // Gamle modeller uden 'overkrop' får et roligt åndedræt og rekyl på hele figuren i stedet.
      if (!v.sk && art !== 'vogn' && art !== 'moelle') {
        const tung = t.id === 'skytte' || t.id === 'skinne', ryk = Math.max(0, 1 - siden / (tung ? 0.32 : 0.16)) * v.rykAmp, aand = Math.sin(tid * v.puls + v.fase);
        if (v.ok) {
          v.ok.rotation.x = aand * 0.022 + uro * 0.01 - ryk * (tung ? 0.16 : 0.07) + (ga === 'tjek' ? Math.abs(ge) * 0.12 : 0) - (ga === 'straek' ? Math.abs(ge) * 0.1 : 0) - (art === 'morter' ? Math.max(0, 1 - siden / 0.5) * 0.18 : 0) - hop * 0.3;
          v.ok.rotation.y = (ga === 'kig' ? ge * 0.3 : 0) + uro * 0.04 + ryk * v.rykSide;
          v.ok.rotation.z = (ga === 'vaegt' ? -ge * 0.06 : 0) + Math.sin(tid * 0.31 + v.fase) * 0.02;
          v.ok.scale.set(1 + aand * 0.006, 1, 1 + aand * 0.006);
          if (v.drej && art !== 'morter') v.drej.rotation.z = (ga === 'vaegt' ? ge * 0.04 : 0) + uro * 0.006;
        } else if (v.drej && v.helt) v.drej.rotation.x = aand * 0.008 - ryk * (tung ? 0.06 : 0.03);
      }
      if (v.tromle) v.tromle.rotation.y += dt * (siden < 0.35 ? 26 : 1.5);
      if (v.temaId !== 'std') pyntSkridt(v.rod, tid);
      const ef = v.effekt;                       // outfittets synlige effekt; flere gnister jo højere trin
      if (ef && Math.random() < dt * ef.n * (0.5 + t.trin * 0.25)) {
        const w = Math.random() * 6.28, r = 0.4 + Math.random() * 0.6, px = v.rod.position.x + Math.cos(w) * r, pz = v.rod.position.z + Math.sin(w) * r, py = v.rod.position.y + 0.3 + Math.random() * 2;
        a.set(px, py, pz);
        if (ef.slags === 'op') gnist(a, 0, 1.2 + Math.random(), 0, 0.9, Math.random() < 0.5 ? ef.farve : ef.farve2, 0.05, 0.01, 0.95);
        else if (ef.slags === 'aura') { gnist(a, 0, 0.8, 0, 1.1, Math.random() < 0.6 ? ef.farve : ef.farve2, 0.07, 0.01, 1); if (Math.random() < 0.08) ringFx(t.x, t.y, 34, ef.farve, 0.9, 0.5); }
        else if (ef.slags === 'blade') gnist(a, (Math.random() - 0.5) * 0.8, -0.3, (Math.random() - 0.5) * 0.8, 1.4, ef.farve, 0.07, 0.05, 0.9);
        else if (ef.slags === 'ned') gnist(a, 0, -0.5, 0, 1.2, ef.farve, 0.05, 0.02, 0.7);
        else gnist(a, 0, 0, 0, 0.25, ef.farve, 0.02, 0.12, 0.9);
      }
      if (v.mech && v.benV) { const gang = Math.min(0.45, Math.abs(v.vf) * 0.09); v.benV.rotation.x = v.bV0 + Math.sin(tid * 10) * gang; v.benH.rotation.x = v.bH0 - Math.sin(tid * 10) * gang; v.rod.position.y += Math.abs(Math.sin(tid * 10)) * gang * 0.12; }
      else if (v.benV) { v.benV.rotation.x = v.bV0 - hop * 0.7 - (ga === 'fod' ? Math.abs(ge * Math.sin(tid * 9)) * 0.4 : 0); v.benH.rotation.x = v.bH0 + hop * 0.5; }
      if (v.mand) v.mand.position.y = -Math.max(0, 1 - siden / 0.3) * 0.16;
      if (art === 'vogn') { const ryk = Math.max(0, 1 - siden / 0.1) * 0.07; v.drej.position.x = v.d0.x - Math.sin(v.vinkel) * ryk; v.drej.position.z = v.d0.z - Math.cos(v.vinkel) * ryk; }
      if (art === 'kaserne' || art === 'moelle' || art === 'lyn') { const p = Math.max(0, 1 - siden / 0.25); v.rod.scale.y *= 1 + Math.sin(p * Math.PI) * 0.07; }
      if (v.spin) v.spin.rotateY(dt * (art === 'moelle' ? (g.fase === 'kamp' ? 1.2 : 0.5) + Math.max(0, 6 - siden * 3) : 1.1));
      if (art === 'flamme' && g.t - t.stroemT < 0.15) {
        mundingen(v, a); const s = tal(t), fart = s.r * K / 0.32;
        for (let i = 0; i < 2; i++) { const w = t.v + (Math.random() - 0.5) * 0.75; gnist(a, Math.cos(w) * fart, 0.4 + Math.random(), Math.sin(w) * fart, 0.3 + Math.random() * 0.08, i ? ORANGE : 0xffd27a, 0.1, 0.55, 0.55); }
      }
      if (art === 'straale') {
        if (!v.bjaelke) { v.bjaelke = new THREE.Mesh(kasseG, lys(0xff3b30)); v.kerne = new THREE.Mesh(kasseG, lys(0xffffff)); scene.add(v.bjaelke, v.kerne); }
        const paa = g.t - t.stroemT < 0.12; v.bjaelke.visible = v.kerne.visible = paa;
        if (paa) {
          mundingen(v, a); b.set(X(t.mx), t.mluft ? 2.6 : 0.8, Z(t.my)); const tyk = 0.05 + t.ramp * 0.045 + Math.sin(tid * 40) * 0.01, l = a.distanceTo(b);
          for (const [o, f] of [[v.bjaelke, 1], [v.kerne, 0.35]]) { o.position.copy(a).add(b).multiplyScalar(0.5); o.lookAt(b); o.scale.set(tyk * f, tyk * f, l); }
          if (Math.random() < 0.5) gnist(b, (Math.random() - 0.5) * 3, 1 + Math.random() * 2, (Math.random() - 0.5) * 3, 0.2, 0xff6a50, 0.1, 0.02);
        }
      }
    }
    for (const [nr, v] of taarne) if (!set.has(nr)) { v.rod.removeFromParent(); v.bjaelke?.removeFromParent(); v.kerne?.removeFromParent(); taarne.delete(nr); }

    // fjender og egne tropper
    for (const [liste, kort, lav] of [[g.fjender, fjender, lavFjende], [g.enheder, enheder, (u) => { const hm = helt(u.type || 'enhed', outfits.kaserne || 'std'); const v = lavFjende({ type: u.type || 'enhed', model: hm, d: { str: u.type && u.type !== 'enhed' ? 0.7 : 0.62 } }); if (!hm) klaedOm(v.rod, tema(outfits.kaserne), 'kaserne'); return v; }]]) {
      set.clear();
      for (const f of liste) {
        set.add(f.nr);
        let v = kort.get(f.nr); if (!v) { v = lav(f); kort.set(f.nr, v); }
        const fjende = liste === g.fjender, fart = fjende ? f.d.fart * f.brems : f.fart, str = (fjende ? f.d.str : f.type && f.type !== 'enhed' ? 0.7 : 0.62) * FIG;
        v.fase += dt * fart * v.takt * (fjende ? 0.16 / Math.sqrt(f.d.r / 10) : 0.14);
        v.rod.position.set(X(f.x - Math.sin(f.v) * v.side), Math.abs(Math.sin(v.fase)) * 0.07 * str, Z(f.y + Math.cos(f.v) * v.side));
        v.rod.rotation.y = fjende ? Math.PI / 2 - f.v : -Math.PI / 2 - f.v;
        v.rod.rotation.z = Math.sin(v.fase) * v.vugge;
        if (v.benV) { v.benV.rotation.x = Math.sin(v.fase) * 0.7; v.benH.rotation.x = -Math.sin(v.fase) * 0.7; }
        if (v.armV) { v.armV.rotation.x = -Math.sin(v.fase) * 0.45; v.armH.rotation.x = Math.sin(v.fase) * 0.45; }
        if (v.hoved) { v.hoved.rotation.x = Math.sin(v.fase * 2) * 0.07; v.hoved.rotation.y = Math.sin(v.fase * 0.5 + v.side) * 0.15; }      // hovedet nikker i takt med skridtene og kigger lidt rundt
        if (v.hale) v.hale.rotation.y = Math.sin(v.fase * 1.3) * 0.35;                                                                    // halen svinger
        if (fjende && f.d.luft) { const slag = Math.sin(tid * 14 + v.fase); v.rod.position.y = 2.1 + Math.sin(tid * 2 + v.fase) * 0.25; if (v.vV) { v.vV.rotation.y = -slag * 0.7; v.vH.rotation.y = slag * 0.7; } v.rod.rotation.z = 0; }
        const ramt = fjende ? Math.max(0, 1 - (g.t - (f.ramtT ?? -9)) / 0.1) : 0;
        v.rod.scale.setScalar(str * Math.min(1, (tid - v.foedt) / 0.2 + 0.3) * (1 - ramt * 0.08));
        if (fjende) {
          if (f.d.boss && !v.broelt && tid - v.foedt > 0.8) { v.broelt = true; goer(v, 'broel'); sig(f, v, saetning(v.p), true);          // chefen melder sin ankomst, og de små bliver nervøse
            for (const x of naermeste(g.fjender, f.x, f.y, 110, f)) { const w = fjender.get(x.nr); if (w && Math.random() < 0.5) goer(w, 'skraek'); } }
          if (ramt > 0.95 && !v.akt && Math.random() < 0.004) sig(f, v, RAAB.ramt[(Math.random() * 3) | 0]);
          sindSkridt(f, v, str);
          evneTegn(f, v, str);
        }
      }
      for (const [nr, v] of kort) if (!set.has(nr)) { kort.delete(nr); if (v.doer) { v.d = 0; v.s0 = v.rod.scale.x; doende.push(v); } else v.rod.removeFromParent(); }
    }
    for (let i = doende.length - 1; i >= 0; i--) {             // fjender vælter bagover og synker
      const v = doende[i]; v.d += dt / 0.45;
      if (v.d >= 1) { v.rod.removeFromParent(); doende.splice(i, 1); continue; }
      v.rod.rotation.x = -v.d * (2 - v.d) * 1.45; v.rod.rotation.z = 0; v.rod.scale.setScalar(v.s0 * (1 - v.d * v.d * 0.6)); v.rod.position.y = -v.d * v.d * 0.25;
    }

    // granater i luften
    // to fælles materialer: før fik hvert skud sit eget nye materiale, som aldrig blev frigivet
    raketMat ??= new THREE.MeshStandardMaterial({ color: 0xdb242e, roughness: 0.4, emissive: 0xff5a20, emissiveIntensity: 2 }); granatMat ??= new THREE.MeshStandardMaterial({ color: 0x2e3a24, roughness: 0.4, emissive: 0, emissiveIntensity: 2 });
    set.clear();
    for (const s of g.skud) {
      set.add(s);
      let o = skud.get(s); if (!o) { o = new THREE.Mesh(kugleG, s.raket ? raketMat : granatMat); o.scale.setScalar(s.raket ? 0.14 : 0.2); o.castShadow = true; scene.add(o); skud.set(s, o); }
      const u = Math.min(1, s.t / s.flyv);
      o.position.set(X(s.x0 + (s.tx - s.x0) * u), 1.4 * (1 - u) + Math.sin(Math.PI * u) * s.hoej * K + 0.2, Z(s.y0 + (s.ty - s.y0) * u));
      if (s.raket && Math.random() < 0.7) gnist(o.position, 0, 0.5, 0, 0.25, 0xaaaaaa, 0.08, 0.3, 0.3);
    }
    for (const [s, o] of skud) if (!set.has(s)) { o.removeFromParent(); skud.delete(s); }

    // effekter ældes
    for (const o of aktive) {
      o.liv -= dt; if (o.liv <= 0) { o.visible = false; aktive.delete(o); continue; }
      const u = 1 - o.liv / o.max;
      o.material.opacity = (o.op ?? 1) * (1 - u);
      if (o.erRing) o.scale.setScalar(o.r * (0.3 + 0.7 * Math.sqrt(u)));
      else if (o.s) { o.scale.setScalar(o.s[0] + (o.s[1] - o.s[0]) * u); o.position.x += o.v[0] * dt; o.position.y += o.v[1] * dt; o.position.z += o.v[2] * dt; }
    }

    // skansens liv som en ring om borgen
    if (livring.vist !== g.liv) {
      livring.vist = g.liv; livring.geometry.dispose();
      livring.geometry = new THREE.RingGeometry(2.25, 2.4, 96, 1, Math.PI / 2, Math.max(0.001, g.liv / 100) * Math.PI * 2);
      livring.material.color.set(g.liv <= 30 ? ORANGE : 0xffffff);
    }
    if (valgt && !spoeg) { const s = tal(valgt); visRaekke(valgt.x, valgt.y, valgt.def.art === 'drone' ? s.r + DRONEBANE : s.r || 0); if (!s.r) raekke.visible = false; }

    vis_(dt);

    // laget ovenpå: livsbjælker og tal
    k2.clearRect(0, 0, bredde, hoejde);
    for (const f of g.fjender) {
      if (f.hp >= f.max || f.d.boss) continue;
      const [x, y] = paaSkaerm(f.x, f.y, (f.d.r > 15 ? 3.9 : 1.75) * f.d.str * FIG + (f.d.luft ? 2.3 : 0)), w = Math.max(18, f.d.r * 1.6);
      k2.fillStyle = 'rgba(0,0,0,.55)'; k2.fillRect(x - w / 2, y, w, 3);
      k2.fillStyle = f.bremsT > 0 ? '#9fdcff' : f.brandT > 0 ? '#ff9e33' : '#fff'; k2.fillRect(x - w / 2, y, w * Math.max(0, f.hp / f.max), 3);
    }
    k2.font = '600 12px -apple-system, system-ui, sans-serif'; k2.textAlign = 'center';
    for (let i = tekster.length - 1; i >= 0; i--) {
      const t = tekster[i]; t.liv -= dt; if (t.liv <= 0) { tekster.splice(i, 1); continue; }
      const [x, y] = paaSkaerm(t.x, t.y, t.h); k2.globalAlpha = Math.min(1, t.liv * 2.5); k2.fillStyle = t.farve; k2.fillText(t.t, x, y - (0.9 - t.liv) * 26);
    }
    k2.globalAlpha = 1;
    // talebobler: hvide, runde, med en lille hale ned mod den, der taler
    for (let i = bobler.length - 1; i >= 0; i--) {
      const b_ = bobler[i]; b_.liv -= dt; if (b_.liv <= 0) { bobler.splice(i, 1); continue; }
      if (g.fjender.includes(b_.f)) { b_.x = b_.f.x; b_.y = b_.f.y; }
      const [x, y] = paaSkaerm(b_.x, b_.y, b_.h), q = 1 - b_.liv / b_.max, ind_ = Math.min(1, q / 0.08);
      k2.font = b_.stor ? '800 17px -apple-system, system-ui, sans-serif' : '700 12.5px -apple-system, system-ui, sans-serif';
      const w = k2.measureText(b_.tekst).width + (b_.stor ? 22 : 16), hh = b_.stor ? 30 : 24, by = y - hh - 10 - q * 8;
      k2.globalAlpha = Math.min(1, b_.liv * 3) * ind_;
      k2.save(); k2.translate(x, by + hh); k2.scale(0.6 + 0.4 * ind_, 0.6 + 0.4 * ind_); k2.translate(-x, -(by + hh));
      k2.fillStyle = 'rgba(255,255,255,.94)'; k2.beginPath(); k2.roundRect(x - w / 2, by, w, hh, hh / 2); k2.fill();
      k2.beginPath(); k2.moveTo(x - 5, by + hh - 1); k2.lineTo(x, by + hh + 7); k2.lineTo(x + 5, by + hh - 1); k2.fill();
      k2.fillStyle = b_.stor ? '#b0101a' : '#111'; k2.textAlign = 'center'; k2.textBaseline = 'middle'; k2.fillText(b_.tekst, x, by + hh / 2 + 0.5);
      k2.restore();
    }
    k2.globalAlpha = 1; k2.textBaseline = 'alphabetic';
  }

  return { scene_: scene, naarSnak: (fn) => { snakLyd = fn; }, saetSpil, tegn, haendelse, tilFelt, spoegelse, vaelg, stoerrelse, rul, zoomTrin, kig, paaSkaerm, drej, flyt, ligeUd, grafik, saetOutfits: (o) => { outfits = o || {}; }, saetSkarp: (v) => { if (skarp !== v) { skarp = v; stoerrelse(); } }, saetGlid: (v) => { bloedt = v; }, saetDiorama: (v) => { diorama = v; }, skygger: (paa) => { renderer.shadowMap.enabled = paa; scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { m.needsUpdate = true; }); }); } };
}

// Et tårn som færdig figur med trin, outfit og pynt, som i spillet. Bruges til kataloget i Form.
export function figurTil(id, trin = 0, temaId = 'std') {
  const hm = helt(id, temaId);
  const f = (hm || M[id]).clone(true); if (!hm) klaedOm(f, tema(temaId), id); visTrin(f, trin);
  if (trin >= 4 && f.getObjectByName('platform5')) f.getObjectByName('drej').position.y += 0.55;
  if (!hm) pynt(f, temaId, trin); return f;
}

// Arsenalets drejeskive: én figur ad gangen, i samme lys som banen.
// Hvert tårns temperament i garderoben: hvor rolig (ro), hvor nysgerrig (kig) og hvor utålmodig (uro) personen er,
// og hvilke vaner den helst har, mens den venter.
const LAUNE = {
  std: { ro: 1, kig: 0.5, uro: 0.3, vaner: ['vaegt', 'kig', 'hvil', 'nik', 'aande'] },
  vagt: { ro: 0.9, kig: 0.7, uro: 0.4, vaner: ['kig', 'kig', 'vaegt', 'nik', 'hvil'] },
  skytte: { ro: 1.4, kig: 0.9, uro: 0.1, vaner: ['kig', 'sigt', 'aande', 'vaegt'] },
  moelle: { ro: 1.3, kig: 0.4, uro: 0.2, vaner: ['aande', 'nik', 'vaegt', 'hvil'] },
  hagl: { ro: 0.7, kig: 0.5, uro: 0.7, vaner: ['uro', 'vaegt', 'hvil', 'kig'] },
  kaster: { ro: 0.8, kig: 0.6, uro: 0.6, vaner: ['uro', 'kig', 'nik', 'vaegt'] },
  garder: { ro: 1.6, kig: 0.2, uro: 0, vaner: ['aande', 'vaegt', 'nik'] },
  frost: { ro: 1.2, kig: 0.5, uro: 0.2, vaner: ['aande', 'kig', 'hvil', 'vaegt'] },
  braender: { ro: 0.6, kig: 0.6, uro: 0.8, vaner: ['uro', 'uro', 'kig', 'hvil'] },
  kaserne: { ro: 1.3, kig: 0.4, uro: 0.2, vaner: ['nik', 'vaegt', 'aande', 'kig'] },
  signal: { ro: 1, kig: 1, uro: 0.3, vaner: ['kig', 'kig', 'nik', 'vaegt'] },
  morter: { ro: 1.1, kig: 0.5, uro: 0.3, vaner: ['hvil', 'vaegt', 'kig', 'aande'] },
  drone: { ro: 0.9, kig: 1, uro: 0.4, vaner: ['kig', 'kig', 'uro', 'nik'] },
  lyn: { ro: 0.7, kig: 0.7, uro: 0.7, vaner: ['uro', 'kig', 'vaegt'] },
  skinne: { ro: 1.4, kig: 0.8, uro: 0.1, vaner: ['sigt', 'kig', 'aande'] },
  straale: { ro: 1.2, kig: 0.6, uro: 0.3, vaner: ['aande', 'kig', 'hvil', 'nik'] },
  bjoern: { ro: 1.5, kig: 0.3, uro: 0.1, vaner: ['aande', 'vaegt'] },
};
const TOMT = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
export function lavFremviser(laerred, valg = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas: laerred, antialias: true, alpha: true });
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.2;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene(); miljoe(renderer, scene); scene.environmentIntensity = 0.8;
  scene.add(new THREE.HemisphereLight(0xffffff, 0x1a1a22, 0.6));
  const sol = new THREE.DirectionalLight(0xfff4ea, 2.8); sol.position.set(-4, 7, 5); sol.castShadow = true; sol.shadow.mapSize.set(1024, 1024);
  Object.assign(sol.shadow.camera, { left: -3, right: 3, top: 4, bottom: -2, near: 1, far: 20 }); sol.shadow.normalBias = 0.03; scene.add(sol);
  const kant = new THREE.DirectionalLight(0xff4a4a, 1.4); kant.position.set(4, 3, -6); scene.add(kant);
  const gulv = new THREE.Mesh(new THREE.CircleGeometry(4, 64), new THREE.ShadowMaterial({ opacity: 0.45 })); gulv.rotation.x = -Math.PI / 2; gulv.receiveShadow = true; scene.add(gulv);
  const kamera = new THREE.PerspectiveCamera(28, 1, 0.5, 60);
  // Menuens farvetone: figurerne skal ligne appen (sort glas, dyb rød), ikke en lys legetøjsbutik.
  // Kun her i fremviseren; spillets egen visning røres ikke. Lyset dæmpes og varmes, og et trin bagefter
  // tager lidt farve ud, gør skyggerne dybe og rødsorte og lyset varmt, og mørkner kanten. Gennemsigtigheden bevares.
  scene.children.forEach((o) => { if (o.isHemisphereLight) { o.intensity = 0.42; o.groundColor.set(0x2a0c0e); } });
  sol.intensity = 2.5; sol.color.set(0xffe9d6); kant.intensity = 2.0; kant.color.set(0xff3a3a);
  renderer.toneMappingExposure = 1.05;
  const tone = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 4 });
  const toneMat = new THREE.ShaderMaterial({
    uniforms: { tF: { value: tone.texture } },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: `uniform sampler2D tF; varying vec2 vUv;
      void main() {
        vec4 f = texture2D(tF, vUv); vec3 c = f.a > 0.0 ? f.rgb / max(f.a, 0.001) : f.rgb;
        float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
        c = mix(vec3(lum), c, 0.8);                                                    // mindre farve
        c = pow(max(c, 0.0), vec3(1.07));                                              // dybere skygger
        c *= mix(vec3(1.06, 0.9, 0.9), vec3(1.04, 1.0, 0.94), smoothstep(0.0, 0.5, lum));      // rødsort i skyggen, varmt i lyset
        c *= 1.0 - 0.3 * pow(length(vUv - 0.5) * 1.4, 2.4);
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        gl_FragColor.rgb *= f.a; gl_FragColor.a = f.a;
      }`,
    depthTest: false, depthWrite: false, transparent: true, premultipliedAlpha: true,
  });
  const toneScene = new THREE.Scene(), toneKam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  toneScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), toneMat));
  function tegnBillede() {
    const st = renderer.getDrawingBufferSize(new THREE.Vector2());
    if (tone.width !== st.x || tone.height !== st.y) tone.setSize(st.x, st.y);
    renderer.setRenderTarget(tone); renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(scene, kamera);
    renderer.setRenderTarget(null); renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(toneScene, toneKam);
  }
  // dronen flyver i en rolig cirkel rundt om ham, lidt over hovedhøjde, vipper ind i svinget og gynger lidt
  let drone_ = null, droneV = 0.9;
  function droneSted(a, t = 0) { drone_.position.set(Math.cos(a) * 1.0, 2.25 + Math.sin(t * 2.1) * 0.06, Math.sin(a) * 1.0); drone_.rotation.set(0.04, -a, 0.12); }
  let vane = null, naesteVane = 2, laune = null, vaegt = 0, vaegtMaal = 0;
  let figur = null, spin = null, hoved = null, sk = null, v = -0.55, maalV = -0.55, tid = 0, senest = '', traek = null, vaaben_ = null, vaabenHvil = 0, hilsT = -9, mus = { x: 0, y: 0 }, blik = 0, naesteBlik = 0, tjek = -9;
  addEventListener('pointermove', (e) => { const r = laerred.getBoundingClientRect(); if (r.width) mus = { x: Math.max(-1.5, Math.min(1.5, (e.clientX - (r.left + r.width / 2)) / r.width * 2)), y: Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height * 0.3)) / r.height * 2)) }; });
  laerred.addEventListener('pointerdown', (e) => { traek = { x: e.clientX, v }; laerred.setPointerCapture?.(e.pointerId); });
  // zoom: rul eller knib med to fingre på figuren; dobbeltklik zoomer ud igen. Jo tættere på, jo højere oppe kigger kameraet (mod ansigtet).
  let grundKam = null, zoomF = 1, zoomMaal = 1;
  laerred.addEventListener('wheel', (e) => { e.preventDefault(); zoomMaal = Math.max(1, Math.min(4, zoomMaal * Math.exp(-e.deltaY * (e.ctrlKey ? 0.012 : 0.0025)))); }, { passive: false });
  laerred.addEventListener('dblclick', () => { zoomMaal = 1; });
  function zoomKamera(dt) {
    if (!grundKam) return;
    zoomF += (zoomMaal - zoomF) * Math.min(1, dt * 8);
    const q = (zoomF - 1) / 3, se_ = grundKam.se.clone(); se_.y += q * 0.45;
    kamera.position.copy(se_).add(grundKam.p.clone().sub(grundKam.se).multiplyScalar(1 / zoomF)); kamera.lookAt(se_);
  }
  laerred.addEventListener('pointermove', (e) => { if (traek) { v = traek.v + (e.clientX - traek.x) * 0.012; maalV = v; } });
  addEventListener('pointerup', () => { traek = null; });
  function vis(id, trin = 0, temaId = 'std') {
    const hm = helt(id, temaId);
    senest = `${id}:${trin}:${temaId}`;
    // helten er ikke hentet endnu: behold den figur, der står, til den rigtige er kommet (ellers ses den gamle klodsfigur et øjeblik)
    if (!hm && M[heltNoegle(id, temaId)] === undefined) { hentHelt(id, temaId).then(() => { if (senest === `${id}:${trin}:${temaId}`) vis(id, trin, temaId); }); return; }
    figur?.removeFromParent(); figur = (hm || M[id]).clone(true); if (!hm) klaedOm(figur, tema(temaId), id);
    // trin 5 svæver på sin platform
    if (trin >= 4 && figur.getObjectByName('platform5') && !valg.staa) figur.getObjectByName('drej').position.y += 0.55;
    // garderobe og kort: personen står på gulvet, ingen metalplade og ingen svævende platform
    if (valg.staa) { figur.traverse((o) => { if (/^(fod_net|sokkel|platform5|op4\.?001)/.test(o.name)) o.visible = false; }); const d_ = figur.getObjectByName('drej'); if (d_ && hm) d_.position.y -= 0.12; }
    if (!hm) pynt(figur, temaId, trin);
    if (valg.udenSokkel) figur.traverse((o) => { if (/^(fod_net|sokkel|platform5|op4\.?001)/.test(o.name)) o.visible = false; });      // forsiden: kun personen, ingen plade
    vaaben_ = figur.getObjectByName('vaaben'); if (vaaben_) vaabenHvil = vaaben_.rotation.x;
    drone_ = figur.getObjectByName('drone'); if (drone_) droneSted(0.9);      // dronen starter ved siden af ham, ikke oven i hovedet
    spin = figur.getObjectByName('spin'); hoved = figur.getObjectByName('hoved'); sk = figur.getObjectByName('skuldre'); visTrin(figur, trin); scene.add(figur);
    if (valg.staa || valg.udenSokkel) figur.traverse((o) => { if (/^(fod_net|sokkel|platform5|lysstraale)/.test(o.name) || (o.isMesh && [].concat(o.material).some((m) => /^(svaeveskaer|auralys|partikellys)/.test(m.name)))) o.visible = false; });      // efter visTrin, som ellers tænder trin-delene igen
    const stor = (id === 'bjoern' ? 1.25 : 1) * (hm ? 1.12 : 1), op_ = hm && trin >= 4 && !valg.staa ? 0.35 : 0;
    vane = null; naesteVane = tid + 1.5; laune = LAUNE[id] || LAUNE.std;
    if (valg.udenSokkel) { kamera.position.set(0, 2.6, 6.6); kamera.lookAt(0, 1.55, 0); maalV = -0.22; }        // forsiden: tættere på, og figuren vender sig næsten mod en
    else { kamera.position.set(0, 2.7 * stor + op_, 7.0 * stor); kamera.lookAt(0, (hm ? 1.4 : 1.25) + op_, 0); }      // tættere på end før: figuren fylder billedet
    grundKam = { p: kamera.position.clone(), se: new THREE.Vector3(0, valg.udenSokkel ? 1.55 : (hm ? 1.4 : 1.25) + op_, 0) };
  }
  function tegn(dt) {
    if (!figur) return;
    const b = laerred.clientWidth, h = laerred.clientHeight, dpr = Math.min(2, devicePixelRatio || 1);
    if (laerred.width !== Math.round(b * dpr) || laerred.height !== Math.round(h * dpr)) { renderer.setPixelRatio(dpr); renderer.setSize(b, h, false); kamera.aspect = b / h; kamera.updateProjectionMatrix(); }
    // figuren lever: når man kommer ind, vender den sig mod en, sænker våbnet og nikker. Bagefter følger den musen med blikket,
    // skifter vægt, trækker vejret, kigger væk en gang imellem og ser til våbnet. Træk med musen for at dreje den selv.
    tid += dt;
    const hq = tid - hilsT, glat = (q) => q * q * (3 - 2 * q);
    let krop = maalV + Math.sin(tid * 0.31) * 0.06, nik = 0, vaabenNed = 0;
    if (hq >= 0 && hq < 3.2) {
      const vend = glat(Math.min(1, hq / 1.1));
      krop = -1.25 + (maalV + 1.25) * vend;
      vaabenNed = Math.sin(Math.PI * Math.min(1, Math.max(0, (hq - 0.6) / 2.2))) * 0.12;
      nik = Math.max(0, Math.sin(Math.PI * Math.min(1, Math.max(0, (hq - 1.3) / 0.7)))) * 0.28 + Math.max(0, Math.sin(Math.PI * Math.min(1, Math.max(0, (hq - 2.0) / 0.5)))) * 0.14;
    }
    if (tid > naesteBlik) { naesteBlik = tid + 3 + Math.random() * 5; blik = Math.random() < 0.35 * (laune?.kig ?? 0.5) * 2 ? (Math.random() - 0.5) * 1.6 : 0; if (Math.random() < 0.25) tjek = tid; }
    const tq = (tid - tjek) / 1.6; if (tq > 0 && tq < 1) vaabenNed += Math.sin(Math.PI * tq) * 0.08;          // ser til våbnet
    // vaner, mens den venter: en ad gangen, med pauser imellem. Hver vane bløder ind og ud (bue 0..1..0).
    const L = laune || LAUNE.std;
    if (!vane && tid > naesteVane && hq > 3.2) { const n = L.vaner[Math.random() * L.vaner.length | 0]; vane = { n, t0: tid, l: { vaegt: 0.9, kig: 2.6, hvil: 3.2, nik: 1.1, aande: 2.4, uro: 1.8, sigt: 2.8 }[n] * (0.8 + L.ro * 0.4), s: Math.random() < 0.5 ? -1 : 1 }; }
    let bue = 0, kropDrej = 0, loeft = 0, hovedX = 0, hovedY = 0;
    if (vane) {
      const q = (tid - vane.t0) / vane.l;
      if (q >= 1) { vane = null; naesteVane = tid + (2.5 + Math.random() * 4) * L.ro; }
      else {
        bue = q < 0.25 ? glat(q / 0.25) : q > 0.75 ? glat((1 - q) / 0.25) : 1;         // ind, hold, ud
        if (vane.n === 'vaegt') vaegtMaal = vane.s;                                        // lægger vægten over på det andet ben og bliver der
        else if (vane.n === 'kig') { hovedY = vane.s * 0.75 * bue; kropDrej = vane.s * 0.22 * bue; }      // kigger sig over skulderen
        else if (vane.n === 'hvil') { vaabenNed += 0.32 * bue; hovedX = 0.12 * bue; }       // sænker våbnet og slapper af
        else if (vane.n === 'nik') { hovedX = Math.max(0, Math.sin(Math.PI * q * 2)) * 0.3; hovedY = -0.1 * bue; }      // nikker til en
        else if (vane.n === 'aande') { loeft = Math.sin(Math.PI * q) * 0.025; hovedX = -0.12 * Math.sin(Math.PI * q); }      // et dybt åndedrag, hovedet lidt op
        else if (vane.n === 'uro') { loeft = Math.abs(Math.sin(q * Math.PI * 4)) * 0.035 * bue; kropDrej = Math.sin(q * Math.PI * 3) * 0.12 * bue; }      // vipper utålmodigt på tæerne
        else if (vane.n === 'sigt') { vaabenNed -= 0.06 * bue; hovedX = 0.1 * bue; hovedY = vane.s * 0.35 * bue; kropDrej = vane.s * 0.3 * bue; }      // tager sigte mod noget i det fjerne
      }
    }
    vaegt += (vaegtMaal - vaegt) * Math.min(1, dt * 1.6);
    krop += kropDrej;
    if (!traek) v += (krop - v) * Math.min(1, dt * 4);
    figur.rotation.y = v; spin?.rotateY(dt * 1.2); pyntSkridt(figur, tid);
    if (drone_) { droneV += dt * 0.55; droneSted(droneV, tid); hovedX -= 0.1 + Math.max(0, Math.sin(droneV)) * 0.12; if (!vane) hovedY = Math.max(-0.6, Math.min(0.6, Math.cos(droneV) * 0.5)); }      // han følger sin drone med blikket
    figur.scale.y = 1 + Math.sin(tid * 1.9 / L.ro) * 0.006 + loeft * 0.4;      // vejrtrækning, roligere hos de rolige
    const drej_ = figur.getObjectByName('drej'); if (drej_) { drej_.rotation.z = vaegt * 0.03 + Math.sin(tid * 0.42) * 0.01; drej_.rotation.x = loeft * 0.6; }     // vægten på det ene ben
    if (hoved) {
      const kig = (hovedY || blik || -mus.x * 0.55) - (v - maalV) * 0.6;            // kigger på musen (eller væk et øjeblik, eller efter en vane)
      hoved.rotation.y += (kig - hoved.rotation.y) * Math.min(1, dt * 3);
      hoved.rotation.x += ((mus.y * 0.18) + nik + hovedX - hoved.rotation.x) * Math.min(1, dt * 6);
    }
    if (vaaben_) vaaben_.rotation.x = vaabenHvil + vaabenNed;
    if (sk) sk.rotation.x = Math.sin(tid * 1.7) * 0.05;
    const ok_ = figur.getObjectByName('overkrop');
    if (ok_) ok_.rotation.set(Math.sin(tid * 1.9 / L.ro) * 0.018 + loeft * 0.5 + vaabenNed * 0.25, kropDrej * 0.5, -vaegt * 0.035);
    zoomKamera(dt);
    tegnBillede();
  }
  // Et stillbillede af et tårn i et outfit, til butikkens kort
  // Portræt: lavt kamera der kigger lidt op, figuren drejet så våbnet peger skråt frem mod en,
  // hovedet vendt mod kameraet, og kantlys i outfittets egne farver fra begge sider bagfra.
  const fotos = new Map();
  const kantH = new THREE.DirectionalLight(0xffffff, 0); kantH.position.set(-5, 4, -4); scene.add(kantH);
  const fyld = new THREE.DirectionalLight(0xffffff, 0); fyld.position.set(3, 1.2, 6); scene.add(fyld);
  function foto(id, temaId, trin = 4, o = {}) {
    if (o.buste && id === 'bjoern') o = { form: o.form, fyldes: 0.85, hoejde: 0.55, rul: 0, laen: 0, v: 0.6 };
    if (o.buste) o = { v: 0.7, rul: 0, laen: 0, fov: 28, hoved: -0.3, ...o };
    const P = { v: 0.5, hoved: -0.4, hoejde: 0.12, fov: 34, fyldes: 0.8, kant: 8, rul: -0.08, laen: 0.04, str: 520, ...o };
    if (!helt(id, temaId) && M[heltNoegle(id, temaId)] === undefined) { hentHelt(id, temaId); return TOMT; }      // ikke hentet endnu: tomt kort, siden tegnes igen, når helten er her
    const n = `${id}:${temaId}:${trin}:${helt(id, temaId) ? 'h' : 'g'}:${JSON.stringify(o)}`;
    if (fotos.has(n)) return fotos.get(n);
    const gl = v, kp = kamera.position.clone(), kf = kamera.fov, kantFoer = [kant.color.getHex(), kant.intensity];
    vis(id, trin, temaId); v = P.v; figur.rotation.y = v;
    if (hoved) hoved.rotation.set(-0.06, P.hoved, 0);
    figur.getObjectByName('overkrop')?.rotation.set(0, 0, 0);
    if (vaaben_) vaaben_.rotation.x = vaabenHvil - 0.04;
    const dr = figur.getObjectByName('drej'); if (dr) dr.rotation.x = P.laen;
    figur.updateMatrixWorld(true);
    // indramning efter det man faktisk ser (ikke usynlige trin-dele)
    const boks = new THREE.Box3(), b_ = new THREE.Box3();
    figur.traverseVisible((m) => { if (m.isMesh && !m.isPoints) { m.geometry.boundingBox || m.geometry.computeBoundingBox(); boks.union(b_.copy(m.geometry.boundingBox).applyMatrix4(m.matrixWorld)); } });
    const H = boks.max.y - Math.max(0, boks.min.y), midt = boks.getCenter(new THREE.Vector3());
    const form = P.form || 1, bred = Math.max(boks.max.x - boks.min.x, boks.max.z - boks.min.z) * 0.8, fyldH = Math.max(H, bred * form);
    kamera.fov = P.fov; kamera.aspect = 1 / form;
    if (P.buste) {
      // som Shop-kortene: hoved og overkrop fylder billedet, kameraet i brysthøjde. Toppen er hovedet (ikke flag og antenner).
      const hb = new THREE.Box3(); (hoved || figur).traverseVisible((m) => { if (m.isMesh) { m.geometry.boundingBox || m.geometry.computeBoundingBox(); hb.union(b_.copy(m.geometry.boundingBox).applyMatrix4(m.matrixWorld)); } });
      const top = (hb.isEmpty() ? boks.max.y : hb.max.y) + H * 0.06, bund = Math.max(0, boks.min.y) + H * P.buste, vin = top - bund, cy = (top + bund) / 2;
      const afst = (vin / 2) / Math.tan(THREE.MathUtils.degToRad(P.fov / 2));
      kamera.position.set(midt.x * 0.3, cy + vin * 0.08, afst);
      kamera.lookAt(midt.x * 0.3, cy, 0);
    } else {
    const afst = (fyldH / 2 / P.fyldes) / Math.tan(THREE.MathUtils.degToRad(P.fov / 2)) * 1.06;
    kamera.position.set(midt.x * 0.5, Math.max(0, boks.min.y) + H * P.hoejde, afst);
    kamera.lookAt(midt.x * 0.5, Math.max(0, boks.min.y) + H * 0.5, 0);
    }
    kamera.rotateZ(P.rul || 0);
    kamera.updateProjectionMatrix();
    const t = tema(temaId), farve = new THREE.Color(t.lys || t.k1 || '#db242e'), farve2 = new THREE.Color(t.k2 && t.id !== 'std' ? t.lys || t.k2 : '#ff4a4a');
    kant.color.copy(farve); kant.intensity = P.kant ?? 3.2; kantH.color.copy(farve2).lerp(new THREE.Color(0xffffff), 0.35); kantH.intensity = (P.kant ?? 3.2) * 0.7; fyld.intensity = 0.7;
    renderer.setPixelRatio(1); renderer.setSize(P.str, Math.round(P.str * form), false);
    tegnBillede(); const url = laerred.toDataURL('image/png'); fotos.set(n, url);
    v = gl; kamera.position.copy(kp); kamera.fov = kf; kamera.updateProjectionMatrix(); kant.color.setHex(kantFoer[0]); kant.intensity = kantFoer[1]; kantH.intensity = 0; fyld.intensity = 0;
    laerred.width = 0; return url;
  }
  return { vis, tegn, foto, hils: () => { hilsT = tid; v = -1.25; } };
}
