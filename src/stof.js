// Stof og overflader. Modellerne kommer med rene farver; her får de vævning, mønstre og struktur.
// Mønstrene er små grå billeder, der ganges på farven (midtgrå ændrer intet) og lægges på fra tre sider,
// så de passer på alle former uden at modellerne skal have noget særligt med.
import * as THREE from 'three';

const N = 128;
function billede(tegn) {
  const c = document.createElement('canvas'); c.width = c.height = N;
  const k = c.getContext('2d'); k.fillStyle = 'rgb(128,128,128)'; k.fillRect(0, 0, N, N); tegn(k);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.NoColorSpace; t.anisotropy = 4;
  return t;
}
const graa = (v, a = 1) => `rgba(${v},${v},${v},${a})`;
const tal = (froe) => { let s = froe; return () => (s = (s * 16807) % 2147483647) / 2147483647; };
// tegner noget, så det går pænt over kanten og kan gentages
const rundt = (k, f) => { for (const dx of [-N, 0, N]) for (const dy of [-N, 0, N]) { k.save(); k.translate(dx, dy); f(); k.restore(); } };

const M = {
  vaev: () => billede((k) => { for (let y = 0; y < N; y += 4) for (let x = 0; x < N; x += 4) { const op = ((x + y) / 4) % 2 === 0; k.fillStyle = graa(op ? 150 : 104); k.fillRect(x, y, 4, 4); k.fillStyle = graa(op ? 170 : 88, 0.6); if (op) k.fillRect(x, y + 1, 4, 1); else k.fillRect(x + 1, y, 1, 4); } }),
  twill: () => billede((k) => { k.lineWidth = 2.2; for (let i = -N; i < N * 2; i += 8) { k.strokeStyle = graa(98); k.beginPath(); k.moveTo(i, 0); k.lineTo(i + N, N); k.stroke(); k.strokeStyle = graa(152); k.beginPath(); k.moveTo(i + 4, 0); k.lineTo(i + 4 + N, N); k.stroke(); } }),
  camo: () => billede((k) => { const r = tal(7); for (const [v, n] of [[84, 9], [166, 8], [112, 7]]) for (let i = 0; i < n; i++) { const x = r() * N, y = r() * N, a = 10 + r() * 16, b = 7 + r() * 12, w = r() * 3; k.fillStyle = graa(v); rundt(k, () => { k.beginPath(); k.ellipse(x, y, a, b, w, 0, 7); k.ellipse(x + a * 0.7, y + b * 0.5, a * 0.6, b * 0.7, w + 1, 0, 7); k.fill(); }); } }),
  tern: () => billede((k) => { for (const [p, b, v] of [[0, 20, 88], [44, 8, 170], [64, 20, 100], [108, 6, 160]]) { k.fillStyle = graa(v, 0.55); k.fillRect(p, 0, b, N); k.fillRect(0, p, N, b); } k.fillStyle = graa(70, 0.5); for (const p of [30, 94]) { k.fillRect(p, 0, 1.5, N); k.fillRect(0, p, N, 1.5); } }),
  sildeben: () => billede((k) => { k.lineWidth = 1.6; for (let x = 0; x < N; x += 16) for (let y = -8; y < N + 8; y += 5) { const op = (x / 16) % 2 === 0; k.strokeStyle = graa(op ? 96 : 158); k.beginPath(); k.moveTo(x, y + (op ? 8 : 0)); k.lineTo(x + 16, y + (op ? 0 : 8)); k.stroke(); } }),
  quilt: () => billede((k) => { const f = k.createLinearGradient(0, 0, 32, 32); f.addColorStop(0, graa(150)); f.addColorStop(1, graa(112)); for (let x = 0; x < N; x += 32) for (let y = 0; y < N; y += 32) { k.save(); k.translate(x, y); k.fillStyle = f; k.fillRect(0, 0, 32, 32); k.restore(); } k.strokeStyle = graa(70); k.lineWidth = 1.6; for (let i = -N; i <= N * 2; i += 32) { k.beginPath(); k.moveTo(i, 0); k.lineTo(i + N, N); k.moveTo(i, 0); k.lineTo(i - N, N); k.stroke(); } }),
  stribe: () => billede((k) => { k.lineWidth = 22; k.strokeStyle = graa(74); for (let i = -N; i < N * 2; i += 64) { k.beginPath(); k.moveTo(i, -10); k.lineTo(i + N + 20, N + 10); k.stroke(); } }),
  fiber: () => billede((k) => { for (let y = 0; y < N; y += 8) for (let x = 0; x < N; x += 8) { const op = ((x + y) / 8) % 2 === 0, f = op ? k.createLinearGradient(x, y, x + 8, y) : k.createLinearGradient(x, y, x, y + 8); f.addColorStop(0, graa(84)); f.addColorStop(0.5, graa(168)); f.addColorStop(1, graa(84)); k.fillStyle = f; k.fillRect(x, y, 8, 8); } }),
  trae: () => billede((k) => { const r = tal(3); for (let y = 0; y < N; y += 2) { k.fillStyle = graa(100 + r() * 60, 0.7); k.fillRect(0, y, N, 1 + r() * 2); } k.strokeStyle = graa(72, 0.7); for (let i = 0; i < 5; i++) { const y = r() * N; k.beginPath(); k.ellipse(r() * N, y, 14 + r() * 10, 2.5, 0, 0, 7); k.stroke(); } }),
  boerste: () => billede((k) => { const r = tal(5); for (let y = 0; y < N; y++) { k.fillStyle = graa(112 + r() * 34); k.fillRect(0, y, N, 1); } }),
  beton: () => billede((k) => { const r = tal(9); for (let i = 0; i < 900; i++) { k.fillStyle = graa(100 + r() * 56, 0.5); k.fillRect(r() * N, r() * N, 1 + r() * 3, 1 + r() * 3); } }),
  mursten: () => billede((k) => { const r = tal(4); for (let y = 0; y < N; y += 16) for (let x = -32; x < N; x += 32) { k.fillStyle = graa(108 + r() * 44); k.fillRect(x + ((y / 16) % 2) * 16 + 1, y + 1, 30, 14); } k.fillStyle = graa(178, 0.9); for (let y = 0; y < N; y += 16) k.fillRect(0, y, N, 1.5); }),
  tegl: () => billede((k) => { for (let y = 0; y < N; y += 16) for (let x = -16; x < N; x += 16) { const f = k.createLinearGradient(0, y, 0, y + 16); f.addColorStop(0, graa(162)); f.addColorStop(1, graa(92)); k.fillStyle = f; k.beginPath(); k.roundRect(x + ((y / 16) % 2) * 8 + 0.5, y, 15, 17, [0, 0, 7, 7]); k.fill(); } }),
  loev: () => billede((k) => { const r = tal(6); for (let i = 0; i < 220; i++) { const x = r() * N, y = r() * N, s = 3 + r() * 6; k.fillStyle = graa(r() < 0.5 ? 84 + r() * 24 : 150 + r() * 34, 0.75); rundt(k, () => { k.beginPath(); k.ellipse(x, y, s, s * 0.6, r() * 3, 0, 7); k.fill(); }); } }),
  skael: () => billede((k) => { for (let y = 0; y < N + 16; y += 12) for (let x = -16; x < N + 16; x += 16) { const f = k.createRadialGradient(x + ((y / 12) % 2) * 8, y, 1, x + ((y / 12) % 2) * 8, y, 10); f.addColorStop(0, graa(158)); f.addColorStop(1, graa(94)); k.fillStyle = f; k.beginPath(); k.arc(x + ((y / 12) % 2) * 8, y, 9, 0, 7); k.fill(); } }),
  blomst: () => billede((k) => { const r = tal(11); for (let i = 0; i < 26; i++) { const x = r() * N, y = r() * N, s = 3 + r() * 3.5, w0 = r() * 6; rundt(k, () => { k.fillStyle = graa(172); for (let p = 0; p < 5; p++) { const w = w0 + p * 1.2566; k.beginPath(); k.ellipse(x + Math.cos(w) * s, y + Math.sin(w) * s, s * 0.8, s * 0.5, w, 0, 7); k.fill(); } k.fillStyle = graa(84); k.beginPath(); k.arc(x, y, s * 0.4, 0, 7); k.fill(); }); } }),
  graes: () => billede((k) => { const r = tal(8); k.lineWidth = 1.2; for (let i = 0; i < 520; i++) { const x = r() * N, y = r() * N; k.strokeStyle = graa(r() < 0.5 ? 96 : 160, 0.7); k.beginPath(); k.moveTo(x, y); k.lineTo(x + (r() - 0.5) * 3, y - 3 - r() * 5); k.stroke(); } }),
};
const gemt = {};
const moenster = (n) => (gemt[n] ||= M[n]());

function laeg(m, navn, skala, styrke, relief = 0) {
  if (m.userData.stof || m.emissiveIntensity > 0.3 && m.emissive?.getHex()) return;
  m.userData.stof = navn;
  const t = moenster(navn);
  m.onBeforeCompile = (sh) => {
    sh.uniforms.sT = { value: t }; sh.uniforms.sK = { value: skala }; sh.uniforms.sS = { value: styrke }; sh.uniforms.sR = { value: relief };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 sP; varying vec3 sN;').replace('#include <begin_vertex>', '#include <begin_vertex>\nsP = position; sN = normal;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D sT; uniform float sK; uniform float sS; uniform float sR; varying vec3 sP; varying vec3 sN;')
      .replace('#include <map_fragment>', `#include <map_fragment>
        vec3 sW = pow(abs(normalize(sN)), vec3(6.0)); sW /= (sW.x + sW.y + sW.z);
        float sV = texture2D(sT, sP.zy * sK).r * sW.x + texture2D(sT, sP.xz * sK).r * sW.y + texture2D(sT, sP.xy * sK).r * sW.z;
        diffuseColor.rgb *= mix(1.0, sV * 2.0, sS);`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        if (sR > 0.0) {            // stoffets relief: mønsteret buler overfladen, så vævning og skæl fanger lyset
          vec3 dpx = dFdx(-vViewPosition), dpy = dFdy(-vViewPosition); float dhx = dFdx(sV) * sR, dhy = dFdy(sV) * sR;
          vec3 r1 = cross(dpy, normal), r2 = cross(normal, dpx); float det = dot(dpx, r1);
          normal = normalize(abs(det) * normal - sign(det) * (dhx * r1 + dhy * r2));
        }`);
  };
  m.customProgramCacheKey = () => `stof-${navn}-${skala}-${styrke}-${relief}`;
  m.needsUpdate = true;
}

// ---------- outfits ----------
// Materialerne deles mellem alle figurer af samme slags. Et outfit laver sine egne kopier én gang og genbruger dem.
const K1 = /^(jeepgroen|apcgraa|vogngroen|jakke|haette|hue|hjelm|poncho|kappe|mur$|bunker|panser$|panser2|skab|daek|dronekrop|skaal|lade|silo|flaske|tank$|tank2|kasse$|hjelm\d?)/;
const K2 = /^(bukser|vest|rygsaek|hat$|baret|forklaede|pels|tag$|bunkertag|ladetag|vest2|saek)/;
const METAL = /^(staal|moerk|kobber|fjendestaal)/;
const kopier = new Map();
export function klaedOm(rod, t, noegle) {
  if (!t || t.id === 'std') return;
  rod.traverse((o) => {
    if (!o.isMesh) return;
    const nye = [].concat(o.material).map((m) => {
      const lyser = m.emissive && m.emissive.getHex() !== 0 && m.emissiveIntensity > 0.3;      // kun det, der virkelig lyser (alle materialer fra Blender har en sort lysfarve)
      const n = m.name, k = (K1.test(n) ? 'k1' : K2.test(n) ? 'k2' : METAL.test(n) ? 'metal' : lyser ? 'lys' : null);
      if (!k || (k === 'metal' && !t.metal) || (k === 'lys' && !t.lys)) return m;
      const id = `${noegle}:${t.id}:${n}`;
      if (!kopier.has(id)) {
        const c = m.clone(); c.userData = {}; c.onBeforeCompile = () => {};
        if (k === 'lys') { c.emissive.set(t.lys); c.color.set(t.lys); }
        else c.color.set(k === 'metal' ? t.metal : t[k]);
        if (k === 'metal' || ((k === 'k1' || k === 'k2') && t.blank)) { c.metalness = t.blank ? 1 : 0.6; c.roughness = t.blank ? 0.22 : 0.4; }
        if ((k === 'k1' || k === 'k2') && t.moenster) laeg(c, ...t.moenster);
        if (k === 'k2' && t.gloed) { c.emissive.set(t.gloed); c.emissiveIntensity = 0.55; }      // Neon og Lava gløder tydeligt
        if (k === 'lys' && t.gloed) c.emissiveIntensity = Math.max(c.emissiveIntensity, 3.5);
        if (k === 'k1' && t.gloed) { c.emissive.set(t.gloed); c.emissiveIntensity = 0.22; }      // et svagt skær over hele kroppen
        kopier.set(id, c);
      }
      return kopier.get(id);
    });
    o.material = Array.isArray(o.material) ? nye : nye[0];
  });
}

// Hvem går i hvad. [mønster, gentagelser pr. meter, styrke]
const JAKKE = { vagt: ['twill', 5, 0.4], garder: ['camo', 1.5, 0.55], skytte: ['sildeben', 3, 0.5], hagl: ['tern', 1.6, 0.6], kaster: ['camo', 1.8, 0.5], braender: ['stribe', 1.3, 0.3],
  frost: ['quilt', 1.7, 0.55], morter: ['vaev', 5, 0.45], skinne: ['fiber', 4, 0.5], straale: ['fiber', 6, 0.3], enhed: ['vaev', 5, 0.4] };
const FAST = [
  [/^bukser/, ['twill', 6, 0.4]], [/^(vest|rygsaek|kasse|saek|flag|vinge|poncho|haette|baret|hat|pels|forklaede)/, ['vaev', 6, 0.5]], [/^(trae$|traehus|lamel|kolbe)/, ['trae', 2.5, 0.5]],
  [/^(staal|moerk|skab|daek|kobber|fjendestaal|bakkestaal|silo$|flaske|tank)/, ['boerste', 3, 0.22]], [/^(bunker|panser)/, ['camo', 0.9, 0.5]], [/^(mur$|beton|sandsten|borgmur|bromur|fieldsmur)/, ['beton', 1.2, 0.35]],
  [/^(tag$|tegl|skifer|roed$|pagode|bunkertag)/, ['tegl', 2.2, 0.5]], [/^(sten|raadhusmur|glyptotekmur|lade)/, ['mursten', 1.6, 0.45]], [/^(fjende$|skygge)/, ['skael', 2.4, 0.4]],
  [/^(trae\d|groenttag|park)/, ['loev', 1.1, 0.55]], [/^mur#(5a2f27|4a342c|59402e|3f3a3a)/, ['mursten', 1.4, 0.4]], [/^mur#/, ['beton', 0.5, 0.25]], [/^(graes|toerv)/, ['graes', 1.4, 0.6]], [/^(klippe|fjeld)/, ['beton', 0.4, 0.5]],
];
export function klaed(navn, rod) {
  rod.traverse((o) => {
    if (!o.isMesh) return;
    for (const m of [].concat(o.material)) {
      const valg = m.name === 'jakke' && JAKKE[navn] ? JAKKE[navn] : FAST.find(([re]) => re.test(m.name))?.[1];
      if (valg) laeg(m, ...valg);
    }
  });
}

// De nye helte har stoffet i materialets navn: "jakke|#3d4a3a|twill". [mønster, gentagelser pr. meter, styrke]
const HELTESTOF = { vaev: ['vaev', 48, 0.16, 0.25], twill: ['twill', 40, 0.2, 0.3], strik: ['vaev', 26, 0.25, 0.4], laeder: ['beton', 10, 0.1, 0.03], pels: ['graes', 16, 0.25, 0.4],
  camo: ['camo', 3.5, 0.4, 0.05], kulfiber: ['fiber', 36, 0.25, 0.25], skael: ['skael', 12, 0.3, 0.4] };
export function klaedHelt(rod) {
  rod.traverse((o) => {
    if (!o.isMesh) return;
    for (const m of [].concat(o.material)) { const s = m.name.split('|')[2]; if (HELTESTOF[s]) laeg(m, ...HELTESTOF[s]); }
  });
}

// Kantlys: figurens omrids lyser svagt i outfittets egen farve, som studielyset bagfra i Shop-billederne.
// Så kan en mørk figur (Natpatrulje, Neon) ses mod en mørk by. Lægges oven på stoffet, hvis der er et.
export function kantLys(rod, t) {
  const f = new THREE.Color(t?.id && t.id !== 'std' ? t.lys || t.k1 : '#ffd9c4').lerp(new THREE.Color(0xffffff), 0.3);
  rod.traverse((o) => {
    if (!o.isMesh) return;
    for (const m of [].concat(o.material)) {
      if (m.userData.kant || !m.isMeshStandardMaterial) continue;
      m.userData.kant = true;
      const foer = m.onBeforeCompile, noegle = m.customProgramCacheKey?.bind(m);
      m.onBeforeCompile = (sh, r) => {
        foer?.call(m, sh, r);
        sh.uniforms.kF = { value: f }; sh.uniforms.kS = { value: 0.55 };
        sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 kF; uniform float kS;')
          .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
            float kR = pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 3.0);
            totalEmissiveRadiance += kF * kR * kS;`);
      };
      m.customProgramCacheKey = () => (noegle ? noegle() : '') + '-kant';
      m.needsUpdate = true;
    }
  });
}
