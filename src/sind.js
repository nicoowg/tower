// Monstrenes sind. Hvert monster har sit eget temperament, taler sit eget sprog og reagerer på det, der sker omkring det.
// Det er kun til at se på: reglerne i sim.js mærker intet af det, så det ændrer ikke spillet.

// ord = monsterets sprog, snak = hvor snakkesalig den slags er, stemme = tonehøjde, lyst = hvad den har lyst til at gøre
export const PERS = {
  kryb: { ord: ['nik', 'blub', 'grb', 'nam', 'bo', 'gnuk', 'mip'], snak: 1, stemme: 1.25, lyst: { vink: 3, hop: 2, snuble: 2, kig: 3, grin: 2, dans: 1 } },
  loeber: { ord: ['zip', 'wii', 'hup', 'tsk', 'zum', 'fiu'], snak: 0.8, stemme: 1.5, lyst: { hop: 3, snuble: 4, vink: 1, dans: 1 } },
  klods: { ord: ['hrumf', 'dunk', 'bonk', 'ugh', 'brok'], snak: 0.5, stemme: 0.8, lyst: { kig: 2, pust: 3, snuble: 1, vink: 1 } },
  skygge: { ord: ['psst', 'shh', 'ssk', 'muah', 'hihi', 'snik'], snak: 0.7, stemme: 1.1, lyst: { kig: 3, grin: 3, snig: 4 } },
  flyver: { ord: ['wiii', 'flap', 'kraa', 'pip', 'skrii'], snak: 0.9, stemme: 1.7, lyst: { loop: 3, vink: 1 } },
  panser: { ord: ['klonk', 'tink', 'hmpf', 'bam', 'skrot'], snak: 0.5, stemme: 0.9, lyst: { kig: 2, pust: 2, vink: 1, broel: 1 } },
  svaerm: { ord: ['pip', 'pi', 'bzz', 'ii', 'tik'], snak: 1.1, stemme: 2.1, lyst: { hop: 4, dans: 2, snuble: 1 } },
  kaempe: { ord: ['BRUM', 'HAA', 'GRONK', 'MØF', 'BUH'], snak: 0.5, stemme: 0.55, lyst: { broel: 3, pust: 2, kig: 1 } },
  vogter: { ord: ['VOGT', 'GRAAH', 'HRR', 'STOP'], snak: 0.6, stemme: 0.5, lyst: { broel: 4, kig: 1 } },
  hersker: { ord: ['KNÆL', 'MØRK', 'HAHA', 'MIN'], snak: 0.6, stemme: 0.45, lyst: { broel: 3, grin: 2 } },
  hoevding: { ord: ['UGA', 'HØV', 'GRAAAH', 'BUM'], snak: 0.7, stemme: 0.4, lyst: { broel: 3, dans: 2 } },
};
const STD = PERS.kryb;
export const pers = (type) => PERS[type] || STD;

const valg = (l) => l[(Math.random() * l.length) | 0];
const stort = (o) => o[0].toUpperCase() + o.slice(1);
// En sætning på monsterets eget sprog: et til tre ord, tit med et ord gentaget, som børn og hunde taler.
export function saetning(p) {
  const n = Math.random() < 0.45 ? 1 : Math.random() < 0.75 ? 2 : 3, ord = [];
  for (let i = 0; i < n; i++) ord.push(i && Math.random() < 0.35 ? ord[i - 1] : valg(p.ord));
  const s = ord.join(' ');
  return (s === s.toUpperCase() ? s : stort(s)) + valg(['!', '!', '?', '...', '!?']);
}
// Ting, alle monstre siger på samme måde, når noget sker
export const RAAB = {
  skraek: ['!?', 'Nej!', 'Gnuk?!', 'Øh...'],
  frost: ['Brrr!', 'Brrrr...', 'Iiih!'],
  brand: ['Av av!', 'Hed hed!', 'Aaaah!'],
  ramt: ['Av!', 'Uf!', 'Hey!'],
  laek: ['Hæhæ!', 'Bøh!', 'Haha!', 'Nam!'],
  snuble: ['Uf!', 'Ups!', 'Øv!'],
  grin: ['Hæhæhæ', 'Hihihi', 'Muhaha'],
  pust: ['Pust...', 'Puh...', 'Hvæs...'],
  snig: ['Shh...', 'Psst...'],
  boss: ['Uuh...', '!!', 'Gnuk...'],
};

// Varighed i sekunder for hver handling
export const VARIGHED = { vink: 1.4, hop: 0.6, snuble: 1.1, kig: 1.6, grin: 1.3, dans: 1.0, pust: 1.8, snig: 2.0, loop: 1.0, broel: 1.5, skraek: 0.7, ryst: 1.2, brand: 1.0, snak: 1.6 };

export function vaelgHandling(p) {
  let sum = 0; for (const k in p.lyst) sum += p.lyst[k];
  let r = Math.random() * sum; for (const k in p.lyst) { r -= p.lyst[k]; if (r <= 0) return k; }
  return 'kig';
}

const blid = (q) => { const op = Math.min(1, q / 0.2), ned = Math.min(1, (1 - q) / 0.25); return op * op * (3 - 2 * op) * ned * ned * (3 - 2 * ned); };
// Lægger handlingen oven på gangen. v er figuren, str dens størrelse, tid spillets ur.
export function pose(v, str, tid) {
  const h = v.akt; if (!h) return;
  const q = Math.min(1, (tid - h.t0) / h.sek), e = blid(q), r = v.rod;
  switch (h.navn) {
    case 'vink': if (v.armV) v.armV.rotation.x = -2.7 * e + Math.sin(tid * 15) * 0.45 * e; break;
    case 'hop': r.position.y += Math.sin(Math.PI * q) * 0.5 * str; r.scale.y *= 1 + Math.sin(Math.PI * q) * 0.12; break;
    case 'snuble': r.rotation.x += (q < 0.35 ? q / 0.35 : Math.max(0, 1 - (q - 0.35) / 0.4)) * 0.75 + Math.sin(tid * 20) * 0.05 * e; r.position.y -= Math.sin(Math.PI * Math.min(1, q / 0.6)) * 0.08 * str; break;
    case 'kig': r.rotation.y += (h.vinkel || 0) * e; break;
    case 'grin': r.rotation.z += Math.sin(tid * 32) * 0.1 * e; r.scale.y *= 1 + Math.abs(Math.sin(tid * 16)) * 0.08 * e; if (v.armV) { v.armV.rotation.x = -0.9 * e; v.armH.rotation.x = -0.9 * e; } break;
    case 'dans': r.rotation.y += q * Math.PI * 2; r.position.y += Math.abs(Math.sin(q * Math.PI * 3)) * 0.18 * str; if (v.armV) { v.armV.rotation.x = -2.2 * e; v.armH.rotation.x = -2.2 * e * Math.sin(tid * 12); } break;
    case 'pust': r.scale.y *= 1 - 0.13 * e; r.rotation.x += 0.25 * e; if (v.armV) { v.armV.rotation.x *= 1 - e; v.armH.rotation.x *= 1 - e; } break;
    case 'snig': r.scale.y *= 1 - 0.2 * e; r.rotation.x += 0.3 * e; r.rotation.y += Math.sin(tid * 3) * 0.5 * e; break;
    case 'loop': r.rotation.z += q * Math.PI * 2; break;
    case 'broel': r.rotation.x -= 0.3 * e; r.scale.multiplyScalar(1 + 0.12 * e); if (v.armV) { v.armV.rotation.x = -2.5 * e; v.armH.rotation.x = -2.5 * e; } r.rotation.z += Math.sin(tid * 40) * 0.03 * e; break;
    case 'skraek': r.position.y += Math.sin(Math.PI * q) * 0.45 * str; r.rotation.x -= 0.5 * e; if (v.armV) { v.armV.rotation.x = -2.8 * e; v.armH.rotation.x = -2.8 * e; } break;
    case 'ryst': r.rotation.z += Math.sin(tid * 70) * 0.06 * e; r.scale.y *= 1 - 0.06 * e; break;
    case 'brand': r.position.y += Math.abs(Math.sin(tid * 18)) * 0.18 * str * e; if (v.armV) { v.armV.rotation.x = -2.4 * e + Math.sin(tid * 26) * 0.8; v.armH.rotation.x = -2.4 * e - Math.sin(tid * 26) * 0.8; } break;
    case 'snak': r.rotation.y += (h.vinkel || 0) * e; r.rotation.x += Math.sin(tid * 11) * 0.08 * e; if (v.armV) v.armV.rotation.x = -1.2 * e + Math.sin(tid * 9) * 0.4 * e; break;
  }
  if (q >= 1) v.akt = null;
}
