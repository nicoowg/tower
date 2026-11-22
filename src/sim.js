// Spillets regler. Ingen tegning og ingen skærm herinde, så det samme kan køres i en test uden vindue.
import { TAARNE, FJENDER, BOELGER, BANER, FELT, VEJ, START, SALG, MAKS_MOELLER } from './data.js';

const T = Object.fromEntries(TAARNE.map((t) => [t.id, t]));
export const taarnDef = (id) => T[id];
export const R_TAARN = 26;
export const TAGBONUS = 1.25;
// Kasernen sender bedre tropper for hvert trin: soldater, en hurtig jeep, en pansret vogn og til sidst en kampvogn, der også skyder.
const ENHEDER = [{ type: 'enhed', fart: 62, hp: 1 }, { type: 'enhed', fart: 62, hp: 1 }, { type: 'jeep', fart: 118, hp: 0.8 }, { type: 'apc', fart: 72, hp: 1.7 }, { type: 'kampvogn', fart: 52, hp: 2.6, skud: 0.12 }];
// Er punktet på et tag, man kan stå på? Giver tagets højde, ellers 0.
export function tagVed(bane, x, y) { for (const [x0, y0, x1, y1, h] of bane.tage || []) if (x > x0 + 20 && x < x1 - 20 && y > y0 + 20 && y < y1 - 20) return h; return 0; }
// De tårne, der kan ramme flyvende fjender. Resten skyder eller kaster langs jorden.
export const LUFT = new Set(['skud', 'drone', 'vogn', 'lyn', 'skinne', 'straale']);
export const DRONEBANE = 70;
const hpFaktor = (w) => Math.pow(1.07, w - 1);
const dusoerFaktor = (w) => 1 + 0.045 * (w - 1);

// ---------- banen ----------
function rund(pkt, radius = 70, trin = 8) {
  const ud = [pkt[0]];
  for (let i = 1; i < pkt.length - 1; i++) {
    const [ax, ay] = pkt[i - 1], [bx, by] = pkt[i], [cx, cy] = pkt[i + 1];
    const la = Math.hypot(ax - bx, ay - by), lc = Math.hypot(cx - bx, cy - by);
    const r = Math.min(radius, la / 2, lc / 2);
    const p0 = [bx + (ax - bx) / la * r, by + (ay - by) / la * r], p2 = [bx + (cx - bx) / lc * r, by + (cy - by) / lc * r];
    for (let k = 0; k <= trin; k++) {
      const u = k / trin, v = 1 - u;
      ud.push([v * v * p0[0] + 2 * v * u * bx + u * u * p2[0], v * v * p0[1] + 2 * v * u * by + u * u * p2[1]]);
    }
  }
  ud.push(pkt[pkt.length - 1]);
  return ud;
}
export function lavBane(id) {
  const b = BANER.find((x) => x.id === id) || BANER[0];
  const p = rund(b.punkter), l = [0];
  for (let i = 1; i < p.length; i++) l.push(l[i - 1] + Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]));
  return { ...b, p, l, laengde: l[l.length - 1] };
}
export function sted(bane, s, ud = {}) {
  const { p, l } = bane;
  s = Math.max(0, Math.min(bane.laengde - 0.001, s));
  let lo = 0, hi = l.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (l[m] <= s) lo = m; else hi = m; }
  const f = (s - l[lo]) / (l[hi] - l[lo] || 1);
  ud.x = p[lo][0] + (p[hi][0] - p[lo][0]) * f; ud.y = p[lo][1] + (p[hi][1] - p[lo][1]) * f;
  ud.v = Math.atan2(p[hi][1] - p[lo][1], p[hi][0] - p[lo][0]);
  return ud;
}
function iFlade(p, x, y) {
  let inde = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) if ((p[i][1] > y) !== (p[j][1] > y) && x < (p[j][0] - p[i][0]) * (y - p[i][1]) / (p[j][1] - p[i][1]) + p[i][0]) inde = !inde;
  return inde;
}
export function tilVej(bane, x, y) {
  const p = bane.p; let bedst = Infinity;
  for (let i = 1; i < p.length; i++) {
    const ax = p[i - 1][0], ay = p[i - 1][1], dx = p[i][0] - ax, dy = p[i][1] - ay;
    const u = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
    const d = Math.hypot(x - ax - dx * u, y - ay - dy * u);
    if (d < bedst) bedst = d;
  }
  return bedst;
}

// ---------- nyt spil ----------
export function nytSpil(baneId, udstyr) {
  return { bane: lavBane(baneId), udstyr: [...udstyr], penge: START.penge, liv: START.liv, boelge: 0, klaret: 0, fase: 'vent', vent: 20,
    koe: [], ekstra: [], bt: 0, fjender: [], taarne: [], skud: [], enheder: [], fx: [], t: 0, nr: 1, draebt: 0 };
}
export const antalBoelger = BOELGER.length;
// Online fortsætter efter bølge 30: de sidste ti bølger kører i ring og bliver ved med at blive stærkere.
const boelgeDef = (w) => BOELGER[w - 1] || BOELGER[BOELGER.length - 10 + ((w - BOELGER.length - 1) % 10)];
export function boelgeIndhold(w) {            // hvad kommer der i bølge w: [[type, antal], ...]
  const ud = {}; for (const [type, n] of boelgeDef(w) || []) ud[type] = (ud[type] || 0) + n;
  return Object.entries(ud);
}

function startBoelge(g) {
  g.boelge++; g.fase = 'kamp'; g.bt = 0; g.koe = [];
  let t = 0;
  for (const [type, n, gab, pause] of boelgeDef(g.boelge)) {
    for (let i = 0; i < n; i++) g.koe.push({ t: t + i * gab, type });
    t += Math.max(0, (n - 1) * gab + pause);
  }
  g.koe.sort((a, b) => a.t - b.t);
  g.fx.push({ a: 'boelge', n: g.boelge });
}
export function tilfoej(g, type, antal) {
  const t0 = Math.max(g.t, g.ekstra.length ? g.ekstra[g.ekstra.length - 1].t : 0) + 0.4;
  for (let i = 0; i < antal; i++) g.ekstra.push({ t: t0 + i * 0.55, type });
  g.fx.push({ a: 'angreb' });
}
export function spring(g) { if (g.fase === 'vent') g.vent = 0; }

function nyFjende(g, type, s = 0) {
  const d = FJENDER[type], hp = Math.round(d.hp * hpFaktor(g.boelge));
  const f = { nr: g.nr++, type, d, hp, max: hp, s, x: 0, y: 0, v: 0, brems: 1, bremsT: 0, brand: 0, brandT: 0, yngelT: d.yngel ? d.yngel[1] : 0 };
  sted(g.bane, s, f); g.fjender.push(f); return f;
}

// ---------- tårne ----------
export function tal(t) {               // tårnets tal lige nu, med støtte fra et signal i nærheden og en fjerdedel længere rækkevidde fra et tag
  const s0 = t.def.trin[t.trin], s = t.hoej && s0.r ? { ...s0, r: s0.r * TAGBONUS } : s0, b = t.buff;
  if (!b || t.def.art === 'signal') return s;
  return { ...s, takt: s.takt * (1 - b.fart), r: s.r ? s.r * (1 + b.vidde) : s.r, ser: s.ser || b.syn };
}
function regnStoette(g) {
  for (const t of g.taarne) {
    t.buff = null;
    if (t.def.art === 'signal' || t.def.art === 'moelle') continue;
    for (const s of g.taarne) {
      if (s.def.art !== 'signal') continue;
      const d = s.def.trin[s.trin];
      if (Math.hypot(s.x - t.x, s.y - t.y) > d.r) continue;
      if (!t.buff || d.fart > t.buff.fart) t.buff = { fart: d.fart, vidde: d.vidde || 0, syn: d.syn || 0 };
    }
  }
}
export function kanPlacere(g, id, x, y) {
  const d = T[id];
  if (!d || g.penge < d.trin[0].pris) return false;
  if (x < 26 || y < 26 || x > FELT.b - 26 || y > FELT.h - 26) return false;
  const paaTag = tagVed(g.bane, x, y);
  if (!paaTag && tilVej(g.bane, x, y) < VEJ / 2 + 21) return false;
  if (!paaTag && g.bane.spaer?.some(([x0, y0, x1, y1]) => x > x0 - 14 && x < x1 + 14 && y > y0 - 14 && y < y1 + 14)) return false;      // bygninger og lunde
  if (g.bane.vand?.some((v) => iFlade(v, x, y))) return false;
  if (g.bane.land && !iFlade(g.bane.land, x, y)) return false;                // på en ø kan man kun bygge på øen
  const slut = g.bane.p[g.bane.p.length - 1];
  if (Math.hypot(x - slut[0], y - slut[1]) < 85) return false;
  if (d.art === 'moelle' && g.taarne.filter((t) => t.def.art === 'moelle').length >= MAKS_MOELLER) return false;
  const eget = id === 'bjoern' ? 33 : R_TAARN;
  return !g.taarne.some((t) => Math.hypot(t.x - x, t.y - y) < eget + (t.id === 'bjoern' ? 33 : R_TAARN) + 1);
}
export function placer(g, id, x, y) {
  if (!kanPlacere(g, id, x, y)) return null;
  const d = T[id];
  const t = { nr: g.nr++, id, def: d, trin: 0, x, y, hoej: tagVed(g.bane, x, y), v: Math.PI / 2, cd: 0.2, brugt: d.trin[0].pris, maal: 'foerst', buff: null, skudT: -9, drV: Math.random() * 6, raketCd: 2, ramp: 0, laast: 0, stroemT: -9 };
  g.penge -= d.trin[0].pris; g.taarne.push(t); regnStoette(g);
  g.fx.push({ a: 'byg', x, y });
  return t;
}
export function opgraderPris(t) { const n = t.def.trin[t.trin + 1]; return n ? n.pris : null; }
export function opgrader(g, t) {
  const p = opgraderPris(t);
  if (p == null || g.penge < p) return false;
  g.penge -= p; t.brugt += p; t.trin++; regnStoette(g);
  g.fx.push({ a: 'op', x: t.x, y: t.y, t: t.nr });
  return true;
}
export function salgspris(t) { return Math.round(t.brugt * SALG); }
export function saelg(g, t) {
  const i = g.taarne.indexOf(t); if (i < 0) return;
  g.taarne.splice(i, 1); g.penge += salgspris(t); regnStoette(g);
  g.fx.push({ a: 'salg', x: t.x, y: t.y });
}

function ramt(g, f, skade, gennem, slags) {
  if (f.hp <= 0) return;
  if (slags && f.d.modstand?.[slags]) skade = Math.max(1, Math.round(skade * f.d.modstand[slags]));      // svagheder og modstand
  const p = f.d.panser || 0;
  f.hp -= gennem || !p ? skade : Math.max(1, skade - p);
  f.ramtT = g.t;
  if (f.hp <= 0) {
    const n = Math.round(f.d.dusoer * dusoerFaktor(g.boelge));
    g.penge += n; g.draebt++;
    g.fx.push({ a: 'doed', x: f.x, y: f.y, type: f.type, n, nr: f.nr });
  }
}
function brag(g, x, y, radius, skade) {
  for (const f of g.fjender) if (f.hp > 0 && !f.d.luft && Math.hypot(f.x - x, f.y - y) <= radius + f.d.r) ramt(g, f, skade, false, 'spraeng');
  g.fx.push({ a: 'brag', x, y, r: radius });
}
function vaelg(g, x, y, r, ser, maal, luft) {
  let bedst = null, tal_ = -Infinity;
  for (const f of g.fjender) {
    if (f.hp <= 0 || (f.d.skjult && !ser) || (f.d.luft && !luft)) continue;
    const d = Math.hypot(f.x - x, f.y - y);
    if (d > r + f.d.r) continue;
    const v = maal === 'foerst' ? f.s : maal === 'sidst' ? -f.s : maal === 'staerk' ? f.hp : -d;
    if (v > tal_) { tal_ = v; bedst = f; }
  }
  return bedst;
}
const vinkelFra = (a, b) => { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return Math.abs(d); };

function taarnSkridt(g, t, dt) {
  const art = t.def.art;
  if (art === 'moelle' || art === 'signal') return;
  const s = tal(t);
  t.cd -= dt;
  if (art === 'kaserne') {
    if (g.fase === 'kamp' && t.cd <= 0) {
      t.cd = s.takt;
      const e = ENHEDER[t.trin], hp = Math.round(s.skade * e.hp);
      g.enheder.push({ nr: g.nr++, type: e.type, s: g.bane.laengde - 30, hp, max: hp, fart: e.fart, skud: e.skud ? { skade: s.skade * e.skud, cd: 0.5 } : null, x: 0, y: 0, v: 0 });
      t.skudT = g.t;
    }
    if (t.cd < 0) t.cd = 0;
    return;
  }
  if (art === 'frost') {
    if (t.cd <= 0) {
      let nogen = false;
      for (const f of g.fjender) {
        if (f.hp <= 0 || f.d.luft || Math.hypot(f.x - t.x, f.y - t.y) > s.r + f.d.r) continue;
        nogen = true;
        const b = f.d.boss ? 1 - (1 - s.brems) * 0.5 : s.brems;
        if (b <= f.brems || f.bremsT <= 0) f.brems = b;
        f.bremsT = 1.6;
        if (s.skade) ramt(g, f, s.skade, true);
      }
      if (nogen) { t.cd = s.takt; t.skudT = g.t; g.fx.push({ a: 'frost', x: t.x, y: t.y, r: s.r }); } else t.cd = 0;
    }
    return;
  }
  let ox = t.x, oy = t.y;
  if (art === 'drone') { t.drV += dt * 0.9; ox += Math.cos(t.drV) * DRONEBANE; oy += Math.sin(t.drV) * DRONEBANE; }
  const f = vaelg(g, ox, oy, s.r, s.ser, t.maal, LUFT.has(art));
  if (art === 'vogn') t.raketCd -= dt;
  if (!f) { if (t.cd < 0) t.cd = 0; t.ramp = 0; t.laast = 0; return; }
  t.v = Math.atan2(f.y - oy, f.x - ox);
  if (art === 'straale') {
    if (t.laast !== f.nr) { t.laast = f.nr; t.ramp = 0; }
    t.ramp = Math.min(3, t.ramp + dt);
    t.stroemT = g.t; t.mx = f.x; t.my = f.y; t.mluft = f.d.luft;
  }
  if (art === 'flamme') t.stroemT = g.t;
  if (art === 'vogn' && t.raketCd <= 0) {
    t.raketCd = 4 * (t.buff ? 1 - t.buff.fart : 1);
    g.skud.push({ x0: t.x, y0: t.y, tx: f.x, ty: f.y, t: 0, flyv: 0.55, skade: s.raket, spraeng: 70, hoej: 40, raket: 1 });
  }
  if (t.cd > 0) return;
  t.cd += s.takt; if (t.cd < 0) t.cd = 0;
  t.skudT = g.t;
  if (art === 'skud' || art === 'drone' || art === 'vogn') {
    ramt(g, f, s.skade);
    g.fx.push({ a: 'spor', x1: ox, y1: oy, x2: f.x, y2: f.y, t: t.nr, id: t.id, luft: f.d.luft });
  } else if (art === 'hagl') {
    let n = 0;
    const ofre = g.fjender.filter((e) => e.hp > 0 && !e.d.luft && (!e.d.skjult || s.ser) && Math.hypot(e.x - t.x, e.y - t.y) <= s.r + e.d.r && vinkelFra(Math.atan2(e.y - t.y, e.x - t.x), t.v) < 0.5)
      .sort((a, b) => Math.hypot(a.x - t.x, a.y - t.y) - Math.hypot(b.x - t.x, b.y - t.y));
    for (const e of ofre) { if (n++ >= s.antal) break; ramt(g, e, s.skade); }
    g.fx.push({ a: 'hagl', x: t.x, y: t.y, v: t.v, r: s.r, t: t.nr });
  } else if (art === 'granat') {
    const d = Math.hypot(f.x - t.x, f.y - t.y), flyv = 0.35 + d / 520, m = sted(g.bane, f.s + f.d.fart * f.brems * flyv);
    g.skud.push({ x0: t.x, y0: t.y, tx: m.x, ty: m.y, t: 0, flyv, skade: s.skade, spraeng: s.spraeng, hoej: 70 });
    g.fx.push({ a: 'kast', t: t.nr });
  } else if (art === 'morter') {
    const flyv = 1.3, m = sted(g.bane, f.s + f.d.fart * f.brems * flyv);
    g.skud.push({ x0: t.x, y0: t.y, tx: m.x, ty: m.y, t: 0, flyv, skade: s.skade, spraeng: s.spraeng, hoej: 260 });
    g.fx.push({ a: 'dump', x: t.x, y: t.y, t: t.nr });
  } else if (art === 'flamme') {
    for (const e of g.fjender) {
      if (e.hp <= 0 || e.d.luft || Math.hypot(e.x - t.x, e.y - t.y) > s.r + e.d.r || vinkelFra(Math.atan2(e.y - t.y, e.x - t.x), t.v) > 0.5) continue;
      ramt(g, e, s.skade, true, 'ild');
      if (s.brand >= e.brand) { e.brand = s.brand; e.brandT = 3; }
    }
  } else if (art === 'lyn') {
    const pkt = [[t.x, t.y], [f.x, f.y]], taget = new Set([f.nr]);
    let sidst = f, skade = s.skade;
    ramt(g, f, skade, false, 'lyn');
    for (let i = 1; i < s.kaede; i++) {
      let naeste = null, bd = 125;
      for (const e of g.fjender) {
        if (e.hp <= 0 || taget.has(e.nr)) continue;
        const d = Math.hypot(e.x - sidst.x, e.y - sidst.y);
        if (d < bd) { bd = d; naeste = e; }
      }
      if (!naeste) break;
      skade *= 0.75; taget.add(naeste.nr); pkt.push([naeste.x, naeste.y]);
      ramt(g, naeste, Math.max(1, Math.round(skade)), false, 'lyn'); sidst = naeste;
    }
    g.fx.push({ a: 'lyn', pkt, t: t.nr });
  } else if (art === 'skinne') {
    const dx = Math.cos(t.v), dy = Math.sin(t.v), l = s.r + 40;
    for (const e of g.fjender) {
      if (e.hp <= 0) continue;
      const u = (e.x - t.x) * dx + (e.y - t.y) * dy;
      if (u < 0 || u > l) continue;
      if (Math.abs((e.x - t.x) * dy - (e.y - t.y) * dx) <= 13 + e.d.r) ramt(g, e, s.skade, true);
    }
    g.fx.push({ a: 'skinne', x1: t.x, y1: t.y, x2: t.x + dx * l, y2: t.y + dy * l, t: t.nr });
  } else if (art === 'straale') {
    ramt(g, f, Math.max(1, Math.round(s.skade * (1 + t.ramp))), true);
  }
}

// ---------- et skridt frem ----------
export function skridt(g, dt) {
  if (g.fase === 'tabt' || g.fase === 'vundet') return;
  g.t += dt;
  if (g.fase === 'vent') { g.vent -= dt; if (g.vent <= 0) startBoelge(g); }
  while (g.ekstra.length && g.ekstra[0].t <= g.t) nyFjende(g, g.ekstra.shift().type);      // monstre sendt af modstanderne
  if (g.fase === 'kamp') {
    g.bt += dt;
    while (g.koe.length && g.koe[0].t <= g.bt) nyFjende(g, g.koe.shift().type);
  }
  for (const f of g.fjender) {
    if (f.hp <= 0) continue;
    if (f.bremsT > 0) { f.bremsT -= dt; if (f.bremsT <= 0) f.brems = 1; }
    if (f.brandT > 0) {
      f.brandT -= dt; f.brandRest = (f.brandRest || 0) + f.brand * dt;
      if (f.brandRest >= 1) { const n = Math.floor(f.brandRest); f.brandRest -= n; ramt(g, f, n, true, 'ild'); }
      if (f.brandT <= 0) f.brand = 0;
      if (f.hp <= 0) continue;
    }
    if (f.d.yngel) {
      f.yngelT -= dt;
      if (f.yngelT <= 0) { f.yngelT = f.d.yngel[1]; nyFjende(g, f.d.yngel[0], f.s + 30); }
    }
    f.s += f.d.fart * f.brems * dt * (g.bane.fart || 1);          // på øen går det op ad bakke, så alle er lidt langsommere
    if (f.s >= g.bane.laengde) {
      f.hp = 0; g.liv -= f.d.liv;
      g.fx.push({ a: 'laek', n: f.d.liv });
      if (g.liv <= 0 && g.udoedelig) g.liv = 1;
      if (g.liv <= 0) { g.liv = 0; g.fase = 'tabt'; g.fx.push({ a: 'tabt' }); return; }
      continue;
    }
    sted(g.bane, f.s, f);
  }
  for (const t of g.taarne) taarnSkridt(g, t, dt);
  for (const k of g.skud) {
    k.t += dt;
    if (k.t >= k.flyv) { k.faerdig = 1; brag(g, k.tx, k.ty, k.spraeng, k.skade); }
  }
  for (const u of g.enheder) {
    u.s -= u.fart * dt;
    if (u.s <= 0) { u.hp = 0; continue; }
    sted(g.bane, u.s, u);
    if (u.skud) {                              // kampvognen skyder på den nærmeste fjende
      u.skud.cd -= dt;
      if (u.skud.cd <= 0) { const f = vaelg(g, u.x, u.y, 160, true, 'naer', false); if (f) { u.skud.cd = 0.7; ramt(g, f, u.skud.skade); g.fx.push({ a: 'enhedskud', x1: u.x, y1: u.y, x2: f.x, y2: f.y }); } else u.skud.cd = 0; }
    }
    for (const f of g.fjender) {
      if (f.hp <= 0 || f.d.luft || Math.abs(f.s - u.s) > f.d.r + 10) continue;
      const d = Math.min(u.hp, f.hp);
      ramt(g, f, d, true); u.hp -= d;
      g.fx.push({ a: 'stoed', x: u.x, y: u.y });
      if (u.hp <= 0) break;
    }
  }
  if (g.skud.some((k) => k.faerdig)) g.skud = g.skud.filter((k) => !k.faerdig);
  if (g.enheder.some((u) => u.hp <= 0)) g.enheder = g.enheder.filter((u) => u.hp > 0);
  if (g.fjender.some((f) => f.hp <= 0)) g.fjender = g.fjender.filter((f) => f.hp > 0);

  if (g.fase === 'kamp' && !g.koe.length && !g.fjender.length) {
    g.klaret = g.boelge;
    let bonus = 120 + 25 * g.boelge;
    for (const t of g.taarne) if (t.def.art === 'moelle') { const n = t.def.trin[t.trin].tjen; bonus += n; t.skudT = g.t; g.fx.push({ a: 'tjen', x: t.x, y: t.y, n }); }
    g.penge += bonus;
    g.fx.push({ a: 'klaret', n: bonus });
    if (g.boelge >= BOELGER.length && !g.versus) { g.fase = 'vundet'; g.fx.push({ a: 'vundet' }); } else { g.fase = 'vent'; g.vent = 8; }
  }
}

export function moenterFor(g) {         // hvad et spil giver til arsenalet
  let n = 0; for (let w = 1; w <= g.klaret; w++) n += 5 + w;
  return n + (g.fase === 'vundet' ? 300 : 0);
}
