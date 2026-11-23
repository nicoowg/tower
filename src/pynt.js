// Outfittets egne former: hatte, hjelme og udstyr, der passer til outfittets navn, og som vokser på trin 4-5.
// Lægges på tårnets hoved, skuldre og fod efter navn, så det passer på alle figurer.
// De dyre outfits får også synlige effekter (ingen kampfordele): Sjælden lidt, Episk partikler, Legendarisk aura og funklen.
import * as THREE from 'three';

const kugle = (r) => new THREE.SphereGeometry(r, 24, 16);
const kapsel = (r, l) => new THREE.CapsuleGeometry(r, l, 8, 20);
const ring = (r, t) => new THREE.TorusGeometry(r, t, 12, 40);
const kegle = (r, h) => new THREE.ConeGeometry(r, h, 24);
const M = {};
const mat = (navn, farve, o = {}) => (M[navn] ||= new THREE.MeshStandardMaterial({ color: farve, roughness: o.ru ?? 0.5, metalness: o.metal ?? 0, emissive: o.lys ? new THREE.Color(o.lys) : new THREE.Color(0), emissiveIntensity: o.lys ? (o.styrke ?? 2.5) : 0, transparent: !!o.alfa, opacity: o.alfa ?? 1, depthWrite: !o.alfa, side: o.alfa ? THREE.DoubleSide : THREE.FrontSide }));
function del(geo, m, mor, pos, rot = [0, 0, 0], skala) {
  const o = new THREE.Mesh(geo, m); o.position.set(...pos); o.rotation.set(...rot.map((v) => v * Math.PI / 180)); if (skala) o.scale.set(...skala);
  o.castShadow = !m.transparent; mor.add(o); return o;
}

// Figurerne er bygget i Blender (Z op); efter indlæsning er Y op og Z bagud. Hovedet sidder i y 2.0 i hovedets knude.
const HOVED = [0, 2.0, 0], FREM = -1;      // fremad er -Z efter indlæsning (Blenders -Y)

const MENNESKE = {
  nat(h, s, f, trin, top, bred) {
    if (top < 2.42) del(kugle(0.36), mat('nat_hjelm', 0x1c1f26, { ru: 0.35, metal: 0.4 }), h, [0, 2.1, 0.02], [0, 0, 0], [1, 0.75, 1.05]);      // kun hjelm, hvis figuren ikke har hat på i forvejen
    for (const x of [-0.1, 0.1]) del(kapsel(0.055, 0.12), mat('nat_kikkert', 0x2a2d35, { metal: 0.6 }), h, [x, 2.08, -0.33], [90, 0, 0]), del(kugle(0.05), mat('nat_glas', 0xffb347, { lys: 0xffb347 }), h, [x, 2.08, -0.44]);
    if (trin >= 3) del(new THREE.PlaneGeometry(0.9, 1.1, 1, 6), mat('nat_kappe', 0x14161c, { ru: 0.9, alfa: 0.95 }), f, [0, 1.15, 0.33], [8, 0, 0]);
  },
  arktis(h, s, f, trin, top, bred) {
    del(ring(0.3, 0.1), mat('arktis_pels', 0xf4f1ea, { ru: 1 }), h, [0, 2.0, 0.03], [0, 0, 0], [1, 1, 1.15]);
    if (top < 2.42) del(kugle(0.34), mat('arktis_haette', 0xe8edf1, { ru: 0.9 }), h, [0, 2.06, 0.06], [0, 0, 0], [1, 1.02, 1.05]);      // hætte kun, hvis der ikke er hat i forvejen
    for (const x of [-1, 1]) for (let i = 0; i < (trin >= 3 ? 3 : 1); i++) del(kegle(0.07, 0.36 - i * 0.08), mat('arktis_is', 0x7fd4ff, { lys: 0x7fd4ff, styrke: 1.6, ru: 0.1 }), s, [x * (0.5 + i * 0.06), 0.22 + i * 0.12, 0.05 - i * 0.06], [0, 0, -x * (18 + i * 14)]);
  },
  kbh(h, s, f, trin, top, bred) {
    del(kapsel(Math.max(0.27, bred * 0.5), 0.34), mat('kbh_bjoerneskind', 0x15161a, { ru: 1 }), h, [0, Math.max(2.4, top + 0.02), 0.02]);
    del(ring(0.29, 0.025), mat('kbh_rem', 0xffd27a, { metal: 0.8, ru: 0.3 }), h, [0, 2.02, -0.02], [90, 0, 0]);
    for (const x of [-1, 1]) del(new THREE.BoxGeometry(0.08, 0.9, 0.03), mat('kbh_hvid', 0xf4f5f7, { ru: 0.6 }), f, [0, 1.3, -0.26], [0, 0, x * 32]);
    if (trin >= 3) {
      del(new THREE.CylinderGeometry(0.02, 0.02, 1.6, 8), mat('kbh_stang', 0xd9dbe0, { metal: 0.6 }), f, [0.18, 2.0, 0.34]);
      const flag = new THREE.Group(); flag.position.set(0.18 + 0.33, 2.62, 0.34); f.add(flag);
      del(new THREE.PlaneGeometry(0.66, 0.44), mat('kbh_roed', 0xc8102e, { ru: 0.7, alfa: 0.99 }), flag, [0, 0, 0]);
      del(new THREE.PlaneGeometry(0.66, 0.08), mat('kbh_kors', 0xffffff, { ru: 0.7, alfa: 0.99 }), flag, [0, 0, 0.002]);
      del(new THREE.PlaneGeometry(0.08, 0.44), mat('kbh_kors', 0xffffff, { ru: 0.7, alfa: 0.99 }), flag, [-0.09, 0, 0.002]);
      flag.userData.vaj = true;
    }
  },
  sakura(h, s, f, trin, top, bred) {
    const r = Math.max(0.62, bred * 0.62 + 0.08), y = Math.max(2.38, top + 0.08);
    del(kegle(r, 0.26), mat('sakura_kasa', 0xe8d2b0, { ru: 0.9 }), h, [0, y, 0]);
    del(ring(r * 0.97, 0.018), mat('sakura_baand', 0xff7aa8, { ru: 0.6 }), h, [0, y - 0.12, 0], [90, 0, 0]);
    if (trin >= 3) for (const x of [-1, 1]) del(kugle(0.17), mat('sakura_blomst', 0xf7b8cb, { ru: 0.8 }), s, [x * 0.55, 0.12, 0], [0, 0, 0], [1, 0.6, 1]);
  },
  krom(h, s, f, trin, top, bred) {
    const k = 1, harHat = top > 2.42;
    if (!harHat) del(kugle(0.36), mat('krom_hjelm', 0xd9dde4, { metal: 1, ru: 0.12 }), h, [0, 2.05, 0], [0, 0, 0], [1, 1, 1.05]);
    del(new THREE.SphereGeometry(0.3, 24, 12, Math.PI * 0.15, Math.PI * 0.7, Math.PI * 0.3, Math.PI * 0.35), mat('krom_visir', 0x0e1522, { metal: 0.8, ru: 0.05 }), h, [0, 2.04, -0.06], [0, 180, 0]);
    const ty = harHat ? top : 2.42;
    del(new THREE.CylinderGeometry(0.012, 0.012, 0.45, 6), mat('krom_hjelm', 0), h, [0.2, ty + 0.2, 0.05]);
    del(kugle(0.04), mat('krom_lys', 0xbfe9ff, { lys: 0xbfe9ff }), h, [0.2, ty + 0.44, 0.05]);
    if (trin >= 3) for (const x of [-1, 1]) del(kugle(0.24), mat('krom_hjelm', 0), s, [x * 0.55, 0.08, 0], [0, 0, 0], [1.1, 0.7, 1.1]);
  },
  neon(h, s, f, trin, top, bred) {
    del(new THREE.BoxGeometry(0.62, 0.11, 0.12), mat('neon_visir', 0x2df0ff, { lys: 0x2df0ff, styrke: 3 }), h, [0, 2.04, -0.28]);
    const glorie = del(ring(Math.max(0.36, bred * 0.55), 0.02), mat('neon_ring', 0xff2d9a, { lys: 0xff2d9a, styrke: 3 }), h, [0, top + 0.18, 0], [90, 0, 0]); glorie.userData.drej = 1.4;
    if (trin >= 3) for (const x of [-1, 1]) { const v = del(new THREE.PlaneGeometry(0.9, 0.5), mat('neon_vinge', 0x2df0ff, { lys: 0x2df0ff, styrke: 1.2, alfa: 0.35 }), f, [x * 0.55, 1.55, 0.35], [0, x * 35, x * 18]); v.userData.slag = x; }
  },
  lava(h, s, f, trin, top, bred) {
    for (const x of [-1, 1]) {
      const horn = del(kegle(0.09, 0.42), mat('lava_horn', 0x1a1214, { ru: 0.5 }), h, [x * Math.max(0.24, bred * 0.4), Math.max(2.35, top + 0.05), 0], [0, 0, -x * 28]);
      del(kugle(0.045), mat('lava_glod', 0xff6a1a, { lys: 0xff4a10, styrke: 3.5 }), horn, [0, 0.21, 0]);
    }
    if (trin >= 3) del(ring(0.42, 0.04), mat('lava_ring', 0xff6a1a, { lys: 0xff4a10, styrke: 2.5 }), f, [0, 0.16, 0], [90, 0, 0]);
  },
  guld(h, s, f, trin, top, bred) {
    const krone = new THREE.Group(); krone.position.set(0, Math.max(2.32, top + 0.04), 0); h.add(krone);
    del(ring(0.27, 0.05), mat('guld_metal', 0xffcf6a, { metal: 1, ru: 0.22 }), krone, [0, 0, 0], [90, 0, 0]);
    for (let i = 0; i < 6; i++) { const w = i / 6 * Math.PI * 2; del(kegle(0.06, 0.2), mat('guld_metal', 0), krone, [Math.cos(w) * 0.27, 0.12, Math.sin(w) * 0.27]); del(kugle(0.035), mat('guld_sten', 0xff3b6b, { lys: 0xff3b6b, styrke: 1.5 }), krone, [Math.cos(w) * 0.27, 0.24, Math.sin(w) * 0.27]); }
    if (trin >= 3) for (const x of [-1, 1]) del(new THREE.TorusGeometry(0.33, 0.04, 8, 24, Math.PI * 0.8), mat('guld_laurbaer', 0xd6b24a, { metal: 0.8, ru: 0.3 }), h, [0, 2.05, 0], [90, 0, x > 0 ? 20 : 200]);
  },
};

// Maskinerne (Mølle, Kaserne, Signal, Lyn, Drone, Bjørn) får pynt omkring foden og et mærke på toppen.
const MASKINE = {
  nat: (f, trin) => { for (let i = 0; i < 4; i++) { const w = i / 4 * Math.PI * 2 + 0.4; del(kugle(0.16), mat('nat_sandsaek', 0x2a2d35, { ru: 0.9 }), f, [Math.cos(w) * 0.85, 0.2, Math.sin(w) * 0.85], [0, 0, 0], [1.4, 0.6, 0.9]); } },
  arktis: (f) => { for (let i = 0; i < 6; i++) { const w = i / 6 * Math.PI * 2; del(kegle(0.08, 0.35 + (i % 2) * 0.2), mat('arktis_is', 0x7fd4ff, { lys: 0x7fd4ff, styrke: 1.6, ru: 0.1 }), f, [Math.cos(w) * 0.9, 0.3, Math.sin(w) * 0.9]); } },
  kbh: (f) => { del(new THREE.CylinderGeometry(0.02, 0.02, 1.8, 8), mat('kbh_stang', 0xd9dbe0, { metal: 0.6 }), f, [0.8, 1.0, 0.6]); const fl = new THREE.Group(); fl.position.set(1.13, 1.7, 0.6); f.add(fl); del(new THREE.PlaneGeometry(0.66, 0.44), mat('kbh_roed', 0xc8102e, { alfa: 0.99 }), fl, [0, 0, 0]); del(new THREE.PlaneGeometry(0.66, 0.08), mat('kbh_kors', 0xffffff, { alfa: 0.99 }), fl, [0, 0, 0.002]); del(new THREE.PlaneGeometry(0.08, 0.44), mat('kbh_kors', 0xffffff, { alfa: 0.99 }), fl, [-0.09, 0, 0.002]); fl.userData.vaj = true; },
  sakura: (f) => { for (let i = 0; i < 3; i++) { const w = i / 3 * Math.PI * 2 + 0.6; del(kugle(0.22), mat('sakura_blomst', 0xf7b8cb, { ru: 0.8 }), f, [Math.cos(w) * 0.85, 0.35, Math.sin(w) * 0.85], [0, 0, 0], [1, 0.8, 1]); } },
  krom: (f) => { del(ring(0.98, 0.04), mat('krom_hjelm', 0xd9dde4, { metal: 1, ru: 0.12 }), f, [0, 0.16, 0], [90, 0, 0]); },
  neon: (f) => { const r = del(ring(1.0, 0.03), mat('neon_ring', 0xff2d9a, { lys: 0xff2d9a, styrke: 3 }), f, [0, 0.3, 0], [90, 0, 0]); r.userData.drej = 0.8; del(ring(0.92, 0.02), mat('neon_visir', 0x2df0ff, { lys: 0x2df0ff, styrke: 3 }), f, [0, 0.16, 0], [90, 0, 0]); },
  lava: (f) => { del(ring(0.95, 0.05), mat('lava_ring', 0xff6a1a, { lys: 0xff4a10, styrke: 2.5 }), f, [0, 0.16, 0], [90, 0, 0]); },
  guld: (f) => { const k = new THREE.Group(); k.position.set(0, 3.4, 0); f.add(k); k.userData.svaev = true; del(ring(0.3, 0.06), mat('guld_metal', 0xffcf6a, { metal: 1, ru: 0.22 }), k, [0, 0, 0], [90, 0, 0]); for (let i = 0; i < 6; i++) { const w = i / 6 * Math.PI * 2; del(kegle(0.07, 0.22), mat('guld_metal', 0), k, [Math.cos(w) * 0.3, 0.13, Math.sin(w) * 0.3]); } },
};

// Effekter efter sjældenhed: hvilken farve gnisterne har, og hvor mange.
export const EFFEKT = {
  sakura: { farve: 0xffb3c9, n: 3, slags: 'blade' },
  krom: { farve: 0xffffff, n: 1.5, slags: 'glimt' },
  neon: { farve: 0x2df0ff, n: 6, slags: 'op', farve2: 0xff2d9a },
  lava: { farve: 0xff6a1a, n: 7, slags: 'op', farve2: 0xffd27a },
  guld: { farve: 0xffd27a, n: 9, slags: 'aura', farve2: 0xffffff },
  arktis: { farve: 0xd8f2ff, n: 2, slags: 'ned' },
};

// Sætter pynten på (og fjerner gammel pynt). Kaldes, når tårnet skabes, og når det skifter trin.
export function pynt(rod, temaId, trin) {
  rod.getObjectByName('pynt_h')?.removeFromParent(); rod.getObjectByName('pynt_s')?.removeFromParent(); rod.getObjectByName('pynt_f')?.removeFromParent();
  if (!temaId || temaId === 'std') return;
  const hoved = rod.getObjectByName('hoved'), sk = rod.getObjectByName('skuldre'), drej = rod.getObjectByName('drej'), fod = rod.getObjectByName('fod');
  const ny = (navn, mor) => { const g = new THREE.Group(); g.name = navn; mor.add(g); return g; };
  if (hoved && sk && MENNESKE[temaId]) {
    const h = ny('pynt_h', hoved), s = ny('pynt_s', sk), f = ny('pynt_f', drej || rod);
    // mål hovedet (med hat), så pynten lægger sig ovenpå og udenom det, der allerede er der
    const box = new THREE.Box3(), inv = new THREE.Matrix4(); rod.updateMatrixWorld(true); inv.copy(hoved.matrixWorld).invert();
    hoved.traverse((o) => { if (!o.isMesh || o.parent?.name?.startsWith('pynt')) return; o.geometry.computeBoundingBox(); box.union(o.geometry.boundingBox.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld))); });
    const top = box.isEmpty() ? 2.3 : box.max.y, bred = box.isEmpty() ? 0.62 : Math.max(box.max.x - box.min.x, box.max.z - box.min.z);
    MENNESKE[temaId](h, s, f, trin, top, bred);
    // skuldre-knuden sidder i skulderhøjde, så skuldrepynten flyttes ned i dens eget koordinatsystem
    s.position.y = 0;
  } else if (fod && MASKINE[temaId]) MASKINE[temaId](ny('pynt_f', fod), trin);
}

// Små bevægelser i pynten: glorier drejer, flag vajer, vinger slår, kronen svæver.
export function pyntSkridt(rod, tid) {
  rod.traverse((o) => {
    const u = o.userData; if (!u) return;
    if (u.drej) o.rotation.z = tid * u.drej;
    if (u.vaj) o.rotation.y = Math.sin(tid * 3 + o.id) * 0.25;
    if (u.slag) o.rotation.z = u.slag * (18 + Math.sin(tid * 4) * 12) * Math.PI / 180;
    if (u.svaev) o.position.y = 3.4 + Math.sin(tid * 1.5) * 0.12, o.rotation.y = tid * 0.6;
  });
}
