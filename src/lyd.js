// Al lyd laves i browseren, så der ikke ligger lydfiler nogen steder.
// Hver lyd spilles lidt forskelligt hver gang (tonehøjde og styrke), så det ikke lyder som en maskine.
let ac = null, ud = null, rum = null, paa = true, stemning = null, faktor = 1;
// Hver lyds styrke i forhold til de andre, sat efter måling (test/lyd.mjs), så de ligger nogenlunde lige højt.
const NIVEAU = { spor_drone: 3, kast: 4, ild: 3, straale: 3, klik: 1.8, lyn: 2, frost: 1.6, spor_garder: 1.5, doed: 1.6, stoed: 1.6, skinne: 0.45, doed_stor: 0.8, maskine: 0.8, chef: 0.75 };
const sidst = {};
const lidt = (n = 0.07) => 1 + (Math.random() * 2 - 1) * n;

function klar() {
  if (ac) return true;
  try {
    ac = new AudioContext();
    const tryk = ac.createDynamicsCompressor(); tryk.threshold.value = -16; tryk.ratio.value = 5; const graense = ac.createDynamicsCompressor(); graense.threshold.value = -4; graense.knee.value = 0; graense.ratio.value = 20; graense.attack.value = 0.001; graense.release.value = 0.12; const loft = ac.createGain(); loft.gain.value = 0.82; tryk.connect(graense).connect(loft).connect(ac.destination);
    ud = ac.createGain(); ud.gain.value = 0.85; ud.connect(tryk);
    // et rum at klinge i: støj, der dør ud
    const l = ac.sampleRate * 1.8, b = ac.createBuffer(2, l, ac.sampleRate);
    for (let k = 0; k < 2; k++) { const d = b.getChannelData(k); for (let i = 0; i < l; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / l, 2.6); }
    rum = ac.createConvolver(); rum.buffer = b; const rg = ac.createGain(); rg.gain.value = 0.5; rum.connect(rg).connect(ud);
  } catch { return false; }
  return true;
}
let stoej = null;
function stoejkilde() {
  if (!stoej) { stoej = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate); const d = stoej.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  const s = ac.createBufferSource(); s.buffer = stoej; s.loop = true; s.loopStart = Math.random(); return s;
}
// tone(fra Hz, til Hz, sekunder, bølgeform, styrke, klang 0-1, ansats)
function tone(f0, f1, tid, type = 'sine', styrke = 1, klang = 0, ansats = 0.003, naar = 0) {
  const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime + naar, p = lidt();
  o.type = type; o.frequency.setValueAtTime(f0 * p, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1 * p), t + tid);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(styrke * faktor * lidt(0.15), t + ansats); g.gain.exponentialRampToValueAtTime(0.001, t + tid);
  o.connect(g); g.connect(ud); if (klang) { const k = ac.createGain(); k.gain.value = klang; g.connect(k).connect(rum); }
  o.start(t); o.stop(t + tid + 0.03);
}
// sus(sekunder, frekvens, styrke, skarphed, klang, type, slutfrekvens)
function sus(tid, frekvens, styrke = 1, q = 1, klang = 0, type = 'bandpass', slut = 0, naar = 0) {
  const s = stoejkilde(), f = ac.createBiquadFilter(), g = ac.createGain(), t = ac.currentTime + naar, p = lidt();
  f.type = type; f.frequency.setValueAtTime(frekvens * p, t); if (slut) f.frequency.exponentialRampToValueAtTime(slut * p, t + tid); f.Q.value = q;
  g.gain.setValueAtTime(styrke * faktor * lidt(0.15), t); g.gain.exponentialRampToValueAtTime(0.001, t + tid);
  s.connect(f).connect(g); g.connect(ud); if (klang) { const k = ac.createGain(); k.gain.value = klang; g.connect(k).connect(rum); }
  s.start(t); s.stop(t + tid + 0.03);
}
const akkord = (toner, tid, type, styrke, mellem = 0, klang = 0.4) => toner.forEach((f, i) => tone(f, f, tid, type, styrke, klang, 0.01, i * mellem));

// [mindste antal ms mellem to af samme slags, lyden]
const L = {
  // tårnenes skud
  spor_vagt: [40, () => { sus(0.06, 2400, 0.5, 0.8); tone(240, 90, 0.07, 'triangle', 0.5); tone(150, 55, 0.13, 'sine', 0.45); sus(0.22, 1400, 0.22, 0.6, 0.7, 'lowpass', 300); }],
  spor_garder: [45, () => { sus(0.05, 3200, 0.45, 0.7); tone(170, 70, 0.05, 'square', 0.22); tone(130, 60, 0.09, 'sine', 0.35); sus(0.16, 1600, 0.15, 0.6, 0.6, 'lowpass', 400); }],
  spor_skytte: [80, () => { sus(0.05, 4200, 0.9, 0.6); sus(0.6, 900, 0.55, 0.5, 0.9, 'lowpass', 200); tone(140, 45, 0.18, 'sine', 0.7); }],
  spor_drone: [50, () => { tone(1300, 600, 0.06, 'square', 0.14); sus(0.1, 2600, 0.12, 1, 0.4); }],
  spor_bjoern: [70, () => { sus(0.16, 500, 0.8, 0.5, 0.3, 'lowpass', 120); tone(95, 38, 0.2, 'sine', 0.9); }],
  hagl: [90, () => { sus(0.22, 700, 1.1, 0.5, 0.5, 'lowpass', 150); tone(110, 42, 0.2, 'sine', 0.9); sus(0.04, 5200, 0.5); }],
  kast: [80, () => { sus(0.22, 700, 0.3, 1.5, 0.2, 'bandpass', 2400); tone(320, 180, 0.12, 'triangle', 0.15); }],
  dump: [80, () => { tone(180, 60, 0.16, 'sine', 0.9); sus(0.1, 400, 0.5, 0.6, 0.3); }],
  brag: [70, () => { sus(0.5, 320, 1.4, 0.4, 0.8, 'lowpass', 60); tone(130, 32, 0.38, 'sine', 1); sus(0.08, 3000, 0.4); }],
  lyn: [70, () => { sus(0.14, 5200, 0.6, 4, 0.4); tone(1800, 300, 0.12, 'sawtooth', 0.22); tone(90, 60, 0.12, 'square', 0.2); }],
  skinne: [90, () => { tone(300, 2400, 0.12, 'sawtooth', 0.25); sus(0.4, 2600, 0.7, 1.5, 0.9, 'bandpass', 500, 0.1); tone(160, 40, 0.3, 'sine', 0.8, 0.3, 0.003, 0.1); }],
  frost: [220, () => { tone(2100, 1400, 0.3, 'sine', 0.14, 0.7); tone(3150, 2300, 0.25, 'sine', 0.09, 0.7); sus(0.25, 6500, 0.14, 3, 0.5); }],
  ild: [90, () => { sus(0.2, 900 + Math.random() * 500, 0.24, 0.5, 0.2, 'bandpass'); sus(0.2, 220, 0.18, 0.5, 0, 'lowpass'); }],
  straale: [110, () => { tone(520, 540, 0.14, 'sawtooth', 0.07); tone(1040, 1090, 0.14, 'sine', 0.06); }],
  enhedskud: [80, () => { tone(130, 50, 0.16, 'sine', 0.5); sus(0.2, 900, 0.3, 0.6, 0.4, 'lowpass', 200); }],
  stoed: [70, () => { tone(200, 90, 0.08, 'triangle', 0.5); sus(0.06, 1400, 0.3); }],
  // fjender
  doed: [35, () => { tone(360 * lidt(0.3), 110, 0.1, 'triangle', 0.3); sus(0.07, 800, 0.25, 1.2); }],
  doed_stor: [200, () => { tone(120, 30, 0.7, 'sawtooth', 0.6, 0.6); sus(0.8, 260, 1.0, 0.5, 0.9, 'lowpass', 50); akkord([196, 147, 98], 0.9, 'sine', 0.3, 0.09); }],
  laek: [150, () => { tone(196, 185, 0.22, 'square', 0.3, 0.3); tone(147, 139, 0.3, 'square', 0.3, 0.3, 0.003, 0.16); }],
  // spilleren
  byg: [0, () => { tone(150, 70, 0.1, 'sine', 0.7); sus(0.08, 600, 0.35, 0.8, 0.2); tone(660, 660, 0.14, 'sine', 0.2, 0.5, 0.005, 0.05); }],
  op: [0, () => { sus(0.45, 300, 0.3, 0.8, 0.5, 'bandpass', 3000); akkord([523, 659, 784, 1047], 0.3, 'triangle', 0.3, 0.06, 0.6); }],
  maskine: [0, () => { sus(0.9, 150, 0.6, 0.7, 0.8, 'bandpass', 2400); tone(55, 220, 0.9, 'sawtooth', 0.25, 0.8, 0.3); akkord([392, 523, 659, 784, 1047, 1319], 0.6, 'triangle', 0.22, 0.07, 0.8); }],
  salg: [0, () => akkord([880, 660], 0.14, 'sine', 0.3, 0.07, 0.3)],
  tjen: [60, () => { tone(1320, 1320, 0.12, 'sine', 0.2, 0.5); tone(1760, 1760, 0.2, 'sine', 0.16, 0.5, 0.004, 0.07); }],
  klik: [0, () => tone(900, 640, 0.04, 'sine', 0.22)],
  nej: [0, () => { tone(260, 220, 0.07, 'triangle', 0.25); tone(200, 170, 0.09, 'triangle', 0.25, 0.5, 0.003, 0.08); }],
  angreb: [300, () => { tone(392, 392, 0.18, 'square', 0.18, 0.5); tone(311, 311, 0.3, 'square', 0.18, 0.5, 0.003, 0.15); }],
  // bølger og slutninger
  boelge: [0, () => { for (const f of [110, 165, 220]) tone(f, f * 1.004, 1.1, 'sawtooth', 0.14, 0.7, 0.18); sus(1.0, 400, 0.12, 0.5, 0.6, 'lowpass'); }],
  chef: [0, () => { for (const f of [55, 82.4, 110]) tone(f, f * 0.94, 2.2, 'sawtooth', 0.22, 0.9, 0.4); sus(2, 180, 0.3, 0.5, 0.9, 'lowpass'); }],
  klaret: [0, () => akkord([659, 784, 988], 0.5, 'sine', 0.26, 0.09, 0.7)],
  tabt: [0, () => { akkord([220, 185, 147, 110], 1.4, 'sawtooth', 0.2, 0.22, 0.9); sus(2, 200, 0.4, 0.5, 0.9, 'lowpass', 40); }],
  vundet: [0, () => akkord([523, 659, 784, 1047, 1319, 1568], 0.7, 'triangle', 0.26, 0.12, 0.8)],
};
// Outfittet giver skuddet sin egen klang oven i våbnets lyd.
const KLANG_STYRKE = 2.2;
const KLANG = {
  neon: [60, () => tone(1900, 260, 0.11, 'sawtooth', 0.16)],
  lava: [70, () => sus(0.14, 600, 0.35, 0.6, 0.2, 'lowpass', 160)],
  krom: [70, () => tone(2600, 2500, 0.16, 'sine', 0.1, 0.5)],
  guld: [90, () => { tone(1760, 1760, 0.22, 'sine', 0.08, 0.6); tone(2637, 2637, 0.18, 'sine', 0.05, 0.6, 0.003, 0.03); }],
  sakura: [90, () => tone(1318, 1318, 0.3, 'triangle', 0.07, 0.7)],
  arktis: [80, () => sus(0.12, 7000, 0.12, 3, 0.4)],
  nat: [60, () => tone(90, 45, 0.1, 'sine', 0.25)],
  kbh: [80, () => tone(988, 988, 0.08, 'square', 0.04)],
};
// Monstrenes eget sprog: korte stavelser gennem to formantfiltre (en mund, der åbner og lukker). Små monstre har lyse stemmer.
const VOKAL = [[730, 1090], [270, 2290], [300, 870], [530, 1840], [570, 840], [400, 1600]];
export function pludre(hoejde = 1, n = 2, styrke = 1) {
  if (!paa || !klar()) return;
  const nu = performance.now(); if (nu - (sidst.pludre || 0) < 240) return; sidst.pludre = nu;
  if (ac.state === 'suspended') ac.resume();
  let t = ac.currentTime + 0.01;
  for (let i = 0; i < n; i++) {
    const d = 0.06 + Math.random() * 0.1, f0 = 150 * hoejde * lidt(0.2), v = VOKAL[(Math.random() * VOKAL.length) | 0];
    const o = ac.createOscillator(), g = ac.createGain(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(f0, t); o.frequency.linearRampToValueAtTime(f0 * (Math.random() < 0.5 ? 1.3 : 0.78), t + d);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.09 * styrke, t + 0.012); g.gain.exponentialRampToValueAtTime(0.001, t + d);
    for (const F of v) { const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = F * (0.85 + Math.min(hoejde, 2) * 0.15); f.Q.value = 5; o.connect(f).connect(g); }
    g.connect(ud); const k = ac.createGain(); k.gain.value = 0.25; g.connect(k).connect(rum);
    o.start(t); o.stop(t + d + 0.02); t += d + 0.015 + Math.random() * 0.05;
  }
}
export function spil(navn, tema) {
  if (tema && KLANG[tema] && paa && klar()) { const k = KLANG[tema], nu = performance.now(); if (nu - (sidst['k' + tema] || 0) > k[0]) { sidst['k' + tema] = nu; faktor = KLANG_STYRKE; k[1](); faktor = 1; } }
  const l = L[navn] || (navn.startsWith('spor_') ? L.spor_vagt : null); if (!l || !paa || !klar()) return;
  if (ac.state === 'suspended') ac.resume();
  const nu = performance.now(); if (nu - (sidst[navn] || 0) < l[0] * lidt(0.2)) return;
  sidst[navn] = nu; faktor = NIVEAU[navn] || 1; l[1](); faktor = 1;
}

// Stemningen under det hele: by om natten, hav og vind på øen, eller en stille dyb tone i de tomme rum.
export function saetStemning(slags) {
  if (stemning) { const s = stemning; s.g.gain.setTargetAtTime(0, ac.currentTime, 0.4); setTimeout(() => { s.dele.forEach((d) => { try { d.stop(); } catch {} }); clearInterval(s.ur); }, 1500); stemning = null; }
  if (!slags || !paa || !klar()) return;
  const g = ac.createGain(); g.gain.value = 0; g.connect(ud); g.gain.setTargetAtTime(0.28, ac.currentTime, 1.2);      // under skuddene, ikke over dem
  const dele = [];
  const lag = (frekvens, q, styrke, type = 'lowpass', svaj = 0, svajtid = 7) => {
    const s = stoejkilde(), f = ac.createBiquadFilter(), v = ac.createGain(); f.type = type; f.frequency.value = frekvens; f.Q.value = q; v.gain.value = styrke;
    s.connect(f).connect(v).connect(g); s.start(); dele.push(s);
    if (svaj) { const o = ac.createOscillator(), og = ac.createGain(); o.frequency.value = 1 / svajtid; og.gain.value = styrke * svaj; o.connect(og).connect(v.gain); o.start(); dele.push(o); }
  };
  const bund = (f, styrke) => { const o = ac.createOscillator(), v = ac.createGain(); o.type = 'sine'; o.frequency.value = f; v.gain.value = styrke; o.connect(v).connect(g); o.start(); dele.push(o); };
  let ur = 0;
  if (slags === 'by') {
    lag(160, 0.4, 0.5, 'lowpass', 0.3, 11); lag(1200, 0.6, 0.035, 'bandpass', 0.6, 5); bund(55, 0.05); bund(82.6, 0.03);
    ur = setInterval(() => { if (!paa) return; const r = Math.random();
      if (r < 0.35) { for (let i = 0; i < 5; i++) { tone(620, 820, 0.5, 'sine', 0.018, 1, 0.1, i * 1.0); tone(820, 620, 0.5, 'sine', 0.018, 1, 0.1, i * 1.0 + 0.5); } }      // sirene langt væk
      else if (r < 0.7) tone(196, 190, 0.5, 'sawtooth', 0.02, 1, 0.05);                                                                                              // et horn
    }, 17000);
  } else if (slags === 'sne') {               // stille vinternat: vind og kirkeklokker langt væk
    lag(380, 0.6, 0.16, 'bandpass', 0.8, 10); lag(140, 0.4, 0.22, 'lowpass', 0.5, 14); bund(65.4, 0.03);
    ur = setInterval(() => { if (!paa) return; for (let i = 0; i < 4; i++) for (const f of [392, 784, 1176]) tone(f * (i % 2 ? 0.89 : 1), f * (i % 2 ? 0.89 : 1), 2.2, 'sine', 0.018 / (f / 392), 1, 0.005, i * 1.1); }, 21000);
  } else if (slags === 'tech') {              // en dyb, svævende synth-flade og elektrisk summen
    lag(150, 0.4, 0.3, 'lowpass', 0.3, 12); bund(55, 0.05); bund(82.4, 0.04); bund(110.3, 0.025); lag(3200, 2, 0.015, 'bandpass', 0.9, 3);
    ur = setInterval(() => { if (!paa) return; for (let i = 0; i < 3; i++) tone([880, 1320, 1760][i], [880, 1320, 1760][i], 0.25, 'square', 0.012, 1, 0.01, i * 0.12); }, 11000);
  } else if (slags === 'sakura') {             // by om natten med vindspil i træerne
    lag(170, 0.4, 0.42, 'lowpass', 0.3, 11); lag(900, 0.6, 0.04, 'bandpass', 0.7, 6); bund(55, 0.04);
    ur = setInterval(() => { if (!paa) return; const n = 3 + (Math.random() * 4 | 0); for (let i = 0; i < n; i++) { const f = [1568, 1760, 2093, 2349, 2637][Math.random() * 5 | 0]; tone(f, f, 1.6, 'sine', 0.02, 1, 0.003, i * (0.12 + Math.random() * 0.2)); } }, 9000);
  } else if (slags === 'oe') {
    lag(500, 0.5, 0.22, 'bandpass', 0.7, 9); lag(260, 0.4, 0.3, 'lowpass', 0.8, 6.5); lag(2400, 0.8, 0.03, 'bandpass', 0.8, 4);
    ur = setInterval(() => { if (!paa || Math.random() < 0.4) return; const n = 2 + (Math.random() * 3 | 0); for (let i = 0; i < n; i++) tone(1500 + Math.random() * 500, 950, 0.22, 'triangle', 0.03, 0.9, 0.03, i * 0.3); }, 6500);      // måger
  } else { lag(120, 0.4, 0.25, 'lowpass', 0.4, 13); bund(49, 0.05); bund(73.5, 0.03); }
  stemning = { g, dele, ur, slags };
}
export function saetLyd(til) { paa = til; if (!til) saetStemning(null); }

// Optager en lyd uden højttaler (til at måle og gemme den). Giver lydens tal for begge kanaler.
export async function optag(navn, tema, sek = 1.5) {
  const gl = { ac, ud, rum, stoej, paa, stemning };
  const sr = 44100, off = new OfflineAudioContext(2, Math.round(sr * sek), sr);
  ac = off; stoej = null; paa = true; stemning = null;
  const tryk = ac.createDynamicsCompressor(); tryk.threshold.value = -16; tryk.ratio.value = 5; const graense = ac.createDynamicsCompressor(); graense.threshold.value = -4; graense.knee.value = 0; graense.ratio.value = 20; graense.attack.value = 0.001; graense.release.value = 0.12; const loft = ac.createGain(); loft.gain.value = 0.82; tryk.connect(graense).connect(loft).connect(ac.destination);
  ud = ac.createGain(); ud.gain.value = 0.85; ud.connect(tryk);
  const l = sr * 1.8, b = ac.createBuffer(2, l, sr);
  for (let k = 0; k < 2; k++) { const d = b.getChannelData(k); for (let i = 0; i < l; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / l, 2.6); }
  rum = ac.createConvolver(); rum.buffer = b; const rg = ac.createGain(); rg.gain.value = 0.5; rum.connect(rg).connect(ud);
  try {
    if (navn.startsWith('stemning:')) saetStemning(navn.slice(9));
    else if (navn.startsWith('pludre:')) { sidst.pludre = 0; pludre(+navn.slice(7), 3); }
    else { if (tema && KLANG[tema]) { faktor = KLANG_STYRKE; KLANG[tema][1](); } faktor = NIVEAU[navn] || 1; if (L[navn]) L[navn][1](); faktor = 1; }
    const buf = await off.startRendering();
    if (stemning) clearInterval(stemning.ur);
    return [buf.getChannelData(0), buf.getChannelData(1)];
  } finally { ({ ac, ud, rum, stoej, paa, stemning } = gl); }
}
export const LYDE = () => Object.keys(L);

// Optager en hel kamp uden højttaler: hændelserne [{t, navn, tema}] spilles på deres tidspunkt oven i baggrundslyden.
// Giver lyden og hvor meget kompressoren måtte dæmpe undervejs (til at måle, om det bliver for højt og rodet).
export async function optagKamp(haendelser, sek, stemning_ = 'by') {
  const gl = { ac, ud, rum, stoej, paa, stemning };
  const sr = 44100, off = new OfflineAudioContext(2, Math.round(sr * sek), sr);
  ac = off; stoej = null; paa = true; stemning = null;
  const tryk = ac.createDynamicsCompressor(); tryk.threshold.value = -16; tryk.ratio.value = 5; const graense = ac.createDynamicsCompressor(); graense.threshold.value = -4; graense.knee.value = 0; graense.ratio.value = 20; graense.attack.value = 0.001; graense.release.value = 0.12; const loft = ac.createGain(); loft.gain.value = 0.82; tryk.connect(graense).connect(loft).connect(ac.destination);
  ud = ac.createGain(); ud.gain.value = 0.85; ud.connect(tryk);
  const l = sr * 1.8, b = ac.createBuffer(2, l, sr);
  for (let k = 0; k < 2; k++) { const d = b.getChannelData(k); for (let i = 0; i < l; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / l, 2.6); }
  rum = ac.createConvolver(); rum.buffer = b; const rg = ac.createGain(); rg.gain.value = 0.5; rum.connect(rg).connect(ud);
  const daemp = [], vindue = 0.1, sidstLokal = {};
  try {
    saetStemning(stemning_);
    for (let t = vindue; t < sek - 0.05; t += vindue) {
      const fra = t - vindue, her = haendelser.filter((h) => h.t >= fra && h.t < t);
      off.suspend(t).then(() => {
        daemp.push(tryk.reduction);
        for (const h of her) {                     // samme regler for hvor tit en lyd må gentages som i spillet
          const l_ = L[h.navn] || (h.navn.startsWith('spor_') ? L.spor_vagt : null); if (!l_) continue;
          if (t * 1000 - (sidstLokal[h.navn] || -1e9) < l_[0]) continue; sidstLokal[h.navn] = t * 1000;
          if (h.tema && KLANG[h.tema] && t * 1000 - (sidstLokal['k' + h.tema] || -1e9) > KLANG[h.tema][0]) { sidstLokal['k' + h.tema] = t * 1000; faktor = KLANG_STYRKE; KLANG[h.tema][1](); }
          faktor = NIVEAU[h.navn] || 1; l_[1](); faktor = 1;
        }
        off.resume();
      });
    }
    const buf = await off.startRendering();
    if (stemning) clearInterval(stemning.ur);
    return { l: buf.getChannelData(0), r: buf.getChannelData(1), daemp };
  } finally { ({ ac, ud, rum, stoej, paa, stemning } = gl); }
}
