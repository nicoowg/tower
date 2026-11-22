// Outfits, butik og ejerkonto.
// Et outfit er et tema lagt på ét tårn: farver på tøj og bygning, et mønster, metal og lys.
// Butikken viser fire outfits om dagen, valgt ud fra datoen, så alle ser den samme butik.
import { TAARNE } from './data.js';

// k1 = jakke, hjelm, bygningens mur; k2 = bukser, vest, tag; metal = våben og maskiner; lys = det, der gløder
export const TEMAER = [
  { id: 'std', navn: 'Standard', pris: 0 },
  { id: 'nat', navn: 'Natpatrulje', pris: 1100, k1: '#16181e', k2: '#24272f', moenster: ['twill', 5, 0.45], lys: '#ffb347', metal: '#2a2d35' },
  { id: 'arktis', navn: 'Arktis', pris: 1100, k1: '#e8edf1', k2: '#aebbc4', moenster: ['camo', 1.6, 0.35], lys: '#7fd4ff' },
  { id: 'kbh', navn: 'København', pris: 1250, k1: '#1f3a63', k2: '#c8102e', moenster: ['sildeben', 3, 0.4], lys: '#fff3d6' },
  { id: 'sakura', navn: 'Sakura', pris: 1750, k1: '#f7d6df', k2: '#f0a2b8', moenster: ['blomst', 2.2, 0.55], lys: '#ff7aa8' },
  { id: 'krom', navn: 'Krom', pris: 2000, k1: '#c9ccd4', k2: '#8a8f9a', moenster: ['boerste', 3, 0.3], metal: '#d9dde4', blank: 1, lys: '#bfe9ff' },
  { id: 'neon', navn: 'Neon', pris: 2500, k1: '#0f0f18', k2: '#1a1a28', moenster: ['fiber', 4, 0.45], lys: '#ff2d9a', gloed: '#2df0ff', metal: '#15151f' },
  { id: 'lava', navn: 'Lava', pris: 3000, k1: '#1b1012', k2: '#2a1414', moenster: ['skael', 2.4, 0.5], lys: '#ff6a1a', gloed: '#ff4a10', metal: '#1a1214' },
  { id: 'guld', navn: 'Guld', pris: 4000, k1: '#e3a93f', k2: '#f3d38a', moenster: ['quilt', 1.8, 0.35], metal: '#ffcf6a', blank: 1, lys: '#fff3d6' },
];
const T = Object.fromEntries(TEMAER.map((t) => [t.id, t]));
export const tema = (id) => T[id] || T.std;
export const sjaeldenhed = (pris) => (pris >= 3750 ? 'Legendarisk' : pris >= 2500 ? 'Episk' : pris >= 1750 ? 'Sjælden' : 'Almindelig');
export const outfitId = (taarn, temaId) => `${taarn}:${temaId}`;
export const ALLE = TAARNE.flatMap((d) => TEMAER.filter((t) => t.id !== 'std').map((t) => ({ id: outfitId(d.id, t.id), taarn: d.id, tema: t.id, pris: t.pris })));

// ---------- dagens butik ----------
export function dag(nu = new Date()) { return `${nu.getFullYear()}-${String(nu.getMonth() + 1).padStart(2, '0')}-${String(nu.getDate()).padStart(2, '0')}`; }
function froe(tekst) { let h = 2166136261; for (const c of tekst) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return () => ((h = Math.imul(h ^ (h >>> 15), 2246822507) ^ Math.imul(h ^ (h >>> 13), 3266489909)) >>> 0) / 4294967296; }
export function dagensButik(nu = new Date()) {
  const r = froe('tower-butik-' + dag(nu)), valgt = [], taarne = new Set(), temaer = new Set();
  // fire forskellige tårne og fire forskellige temaer, og altid ét til den dyre ende
  const efter = [...ALLE].sort(() => r() - 0.5);
  const dyr = efter.find((o) => o.pris >= 2500); valgt.push(dyr); taarne.add(dyr.taarn); temaer.add(dyr.tema);
  for (const o of efter) { if (valgt.length >= 4) break; if (taarne.has(o.taarn) || temaer.has(o.tema)) continue; valgt.push(o); taarne.add(o.taarn); temaer.add(o.tema); }
  return valgt;
}
export function tidTilNyButik(nu = new Date()) {
  const midnat = new Date(nu); midnat.setHours(24, 0, 0, 0);
  const s = Math.max(0, Math.floor((midnat - nu) / 1000));
  return [s / 3600 | 0, (s / 60 | 0) % 60, s % 60].map((n) => String(n).padStart(2, '0')).join(':');
}

// ---------- ejerkonto ----------
// Kun navnet "Nico" kræver adgangskode. Adgangskoden ligger ikke her, kun et saltet aftryk af den.
const SALT = 'd9075d8c5484bcad875b9a3b242e75a3', AFTRYK = '4d5c01b5110b4026d19b8d531195c07159ee584d51ae56484e41d28cb365e985';
export const ejerNavn = (navn) => navn.trim().toLowerCase() === 'nico';
export async function tjekEjer(kode) {
  const hex = (b) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
  const salt = new Uint8Array(SALT.match(/../g).map((x) => parseInt(x, 16)));
  const noegle = await crypto.subtle.importKey('raw', new TextEncoder().encode(kode), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 150000 }, noegle, 256);
  return hex(bits) === AFTRYK;
}
