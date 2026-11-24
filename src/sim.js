// Spillets regler. Ingen tegning og ingen skærm herinde, så det samme kan køres i en test uden vindue.
import { TAARNE, FJENDER, BOELGER, BANER, FELT, VEJ, START, SALG, MAKS_MOELLER, MAKS_TAARNE } from './data.js';
// Hvilken slags skade hvert tårn gør. Monstrene vænner sig til den slags, der har ramt dem mest (se laer).
const KILDE = { skud: 'kugle', drone: 'kugle', vogn: 'kugle', hagl: 'kugle', granat: 'spraeng', morter: 'spraeng', flamme: 'ild', lyn: 'lyn', skinne: 'energi', straale: 'energi', frost: 'energi' };
export const SLAGS = { kugle: 'kugler', skarp: 'skarpskud', kanon: 'kanoner', spraeng: 'sprængning', ild: 'ild', lyn: 'lyn', energi: 'energi' };
// Skytten og Bjørnen tæller for sig, så man kan blande allerede med de første tårne.
const KILDE_ID = { skytte: 'skarp', bjoern: 'kanon' };

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
const hpFaktor = (w, v = 1.062) => Math.pow(v, w - 1);          // fjenderne bliver 6,2 % stærkere pr. bølge: jævnt op, ingen mur ved bølge 20
// Sværhedsgraderne: hvor mange bølger, hvor stærke fjenderne er, og hvad man starter med. Et spil tager cirka 15-30 minutter.
export const SVAER = {
  // vaekst: hvor meget stærkere de almindelige monstre bliver pr. bølge. boss: ekstra liv til bosserne. dusoer: andel af dusøren man får.
  // min: hvor mange minutter et spil tager på en bane af normal længde, hvis man lader urene løbe ud. Hver bølge har sit eget ur; når uret er ude, kommer den næste, også selvom der stadig er monstre på vejen.
  // elite: chance for at et almindeligt monster er en elite (større, mere liv, dobbelt dusør). laer: hvor hurtigt monstrene vænner sig til den skade, man bruger mest; laerMaks: højst så meget.
  // flok: flere eller færre monstre i hver gruppe. kald: hvor mange bosserne kalder til hjælp.
  let: { navn: 'Let', boelger: 20, min: 15, hp: 0.75, vaekst: 1.085, boss: 0.42, dusoer: 1, penge: 900, liv: 150, moenter: 0.7, elite: 0, laer: 0, laerMaks: 0, flok: 0.85, kald: 0.7 },
  normal: { navn: 'Normal', boelger: 30, min: 24, hp: 1, vaekst: 1.12, boss: 1, dusoer: 1, penge: 700, liv: 100, moenter: 1, elite: 0.03, laer: 0.02, laerMaks: 0.08, flok: 1, kald: 1 },
  svaer: { navn: 'Svær', boelger: 30, min: 26, hp: 1.1, vaekst: 1.13, boss: 1.25, dusoer: 0.9, penge: 600, liv: 60, moenter: 1.5, elite: 0.07, laer: 0.03, laerMaks: 0.15, flok: 1.08, kald: 1.3 },
  mareridt: { navn: 'Mareridt', boelger: 30, min: 28, hp: 1.2, vaekst: 1.14, boss: 1.25, dusoer: 0.8, penge: 650, liv: 40, moenter: 2.2, elite: 0.12, laer: 0.04, laerMaks: 0.22, flok: 1.15, kald: 1.6 },
};
// Hvert bølge-ur: tiden det tager at sende gruppen af sted, plus en del af turen ned ad vejen med monstrenes gennemsnitsfart. Bosbølger får mere.
// Alt skaleres, så spillet rammer sværhedsgradens minutter (min) på en bane af normal længde; længere veje giver lidt længere spil.
function bolgeUre(bane, S) {
  const raa = [];
  for (let w = 1; w <= S.boelger; w++) {
    let t = 0, span = 0, fart = 0, antal = 0, boss = 0, bund = 0;
    for (const [type, n, gab, pause] of boelgeDef(w)) {
      span = Math.max(span, t + (n - 1) * gab * (S.flok || 1)); t += Math.max(0, (n - 1) * gab * (S.flok || 1) + pause);
      const d = FJENDER[type];
      if (d.boss) boss = 1; else { fart += d.fart * n; antal += n; }
      // Bosser og kæmper er langsomme: uret giver dem tid til at nå godt halvvejs, før næste bølge kommer.
      if (d.fart < 30) bund = Math.max(bund, span + bane.laengde / (d.fart * (bane.fart || 1)) * (d.boss ? 0.5 : 0.35));
    }
    const tur = bane.laengde / ((fart / (antal || 1)) * (bane.fart || 1));
    raa.push({ bund: Math.max(span + tur * 0.26 + 6, bund), v: (span + tur * 0.35 + 10) * (boss ? 1.45 : 1) });
  }
  // Først får de langsomme bølger deres bund; resten af tiden fordeles efter vægt.
  const maal = S.min * 60 * Math.sqrt(bane.laengde / 4000) - 20;
  let k = 1;
  for (let i = 0; i < 12; i++) { const sum = raa.reduce((a, r) => a + Math.max(r.bund, r.v * k), 0); k *= maal / sum; }
  // Et spil må højst vare en fjerdedel længere end sværhedsgradens minutter, også på de længste veje.
  const ure = raa.map((r) => Math.max(r.bund, r.v * k)), loft = S.min * 60 * 1.25 - 20, alt = ure.reduce((a, b) => a + b, 0);
  return ure.map((u) => Math.round(u * Math.min(1, loft / alt)));
}
// Hvor mange minutter et spil på banen tager, hvis man lader urene løbe ud.
export const spilMinutter = (baneId, svaer) => { const S = SVAER[svaer] || SVAER.normal; return Math.round((20 + bolgeUre(lavBane(baneId), S).reduce((a, b) => a + b, 0)) / 60); };
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
export function nytSpil(baneId, udstyr, svaer = 'normal') {
  const S = SVAER[svaer] || SVAER.normal, bane = lavBane(baneId), baneNr = Math.max(0, BANER.findIndex((b) => b.id === bane.id));
  // Banerne bliver lidt sværere i den rækkefølge, de låses op (1 % mere liv pr. bane), og giver lidt flere mønter.
  return { bane, baneNr, udstyr: [...udstyr], svaer: S, svaerId: svaer, antal: S.boelger, penge: S.penge, liv: S.liv, boelge: 0, klaret: 0, fase: 'vent', vent: 20,
    koe: [], ekstra: [], bt: 0, fjender: [], taarne: [], skud: [], enheder: [], fx: [], t: 0, nr: 1, draebt: 0,
    ure: bolgeUre(bane, S), ur: 0, vaen: {}, skadeLog: {}, kilde: null, stat: { tidligt: 0, laek: 0, ren: 0, bosser: [], hund: 0, eliter: 0, moeller: 0, flestTaarne: 0 } };
}
export const antalBoelger = BOELGER.length;
// Online fortsætter efter bølge 30: de sidste ti bølger kører i ring og bliver ved med at blive stærkere.
const boelgeDef = (w) => BOELGER[w - 1] || BOELGER[BOELGER.length - 10 + ((w - BOELGER.length - 1) % 10)];
export function boelgeIndhold(w) {            // hvad kommer der i bølge w: [[type, antal], ...]
  const ud = {}; for (const [type, n] of boelgeDef(w) || []) ud[type] = (ud[type] || 0) + n;
  return Object.entries(ud);
}

function startBoelge(g) {
  g.boelge++; g.fase = 'kamp'; g.bt = 0;
  // Bølgens ur. Den sidste bølge har intet ur: den er slut, når Dæmonen er væk.
  g.ur = g.versus || g.boelge >= g.antal ? Infinity : g.ure?.[g.boelge - 1] || 45;
  // Køen bruger spillets egen tid, så en ny bølge kan komme oven i resterne af den forrige.
  let t = g.t;
  const flok = g.versus ? 1 : g.svaer?.flok || 1;
  for (const [type, n0, gab, pause] of boelgeDef(g.boelge)) {
    const n = FJENDER[type].boss ? n0 : Math.max(1, Math.round(n0 * flok));
    for (let i = 0; i < n; i++) g.koe.push({ t: t + i * gab, type });
    t += Math.max(0, (n - 1) * gab + pause);
  }
  const hund = FJENDER.hrhund;
  // Den sidste bølge: Hr Hund med 7 % chance, og til sidst, når alt andet er sendt af sted, Dæmonen.
  if (!g.versus && g.boelge === g.antal) {
    const slut = Math.max(t, ...g.koe.map((k) => k.t));
    if (Math.random() < hund.sjaelden) g.koe.push({ t: slut + 4, type: 'hrhund' });
    g.koe.push({ t: slut + 12, type: 'daemon' });
  }
  g.koe.sort((a, b) => a.t - b.t);
  g.fx.push({ a: 'boelge', n: g.boelge });
}
export function tilfoej(g, type, antal) {
  const t0 = Math.max(g.t, g.ekstra.length ? g.ekstra[g.ekstra.length - 1].t : 0) + 0.4;
  for (let i = 0; i < antal; i++) g.ekstra.push({ t: t0 + i * 0.55, type });
  g.fx.push({ a: 'angreb' });
}
// Starter man næste bølge før tid, får man penge for hvert sekund, man sparer.
export const tidligBonus = (g) => (g.fase === 'vent' && g.vent > 1 && !g.versus ? Math.round(g.vent * (3 + g.boelge)) : 0);
export function spring(g) {
  if (g.fase !== 'vent') return;
  const n = tidligBonus(g);
  if (n) { g.penge += n; g.stat.tidligt++; g.fx.push({ a: 'tidligt', n }); }
  g.vent = 0;
}

function nyFjende(g, type, s = 0) {
  // Almindelige monstre vokser efter sværhedsgradens vaekst, bosserne efter den rolige kurve, så de ikke bliver en mur.
  // Eliter: en egen, lidt større og hurtigere udgave af monstret, med mere liv og dobbelt dusør.
  let d = FJENDER[type];
  const elite = !d.boss && !g.versus && Math.random() < (g.svaer?.elite || 0) && g.boelge >= 4;
  if (elite) { d = { ...d, str: d.str * 1.22, fart: d.fart * 1.08, dusoer: d.dusoer * 2, liv: d.liv + 1, panser: (d.panser || 0) + 1, elite: 1 }; g.stat.eliter++; }
  const hp0 = d.hp * hpFaktor(g.boelge, d.boss ? 1.062 : g.svaer?.vaekst) * (d.boss ? g.svaer?.boss || 1 : 1) * (1 + 0.01 * (g.baneNr || 0)) * (elite ? 1.7 : 1);
  const hp = Math.round(hp0 * (g.svaer?.hp || 1));
  const f = { nr: g.nr++, type, d, elite, hp, max: hp, s, fase: [], skalT: 0, raseriT: 0, x: 0, y: 0, v: 0, brems: 1, bremsT: 0, brand: 0, brandT: 0, yngelT: d.yngel ? d.yngel[1] : 0, skjold: 0, evneT: { hel: d.hel ? d.hel[2] * 0.5 : 0, skjold: d.skjold ? 1 : 0, spurt: d.spurt ? d.spurt[0] * (0.4 + Math.random() * 0.6) : 0, hop: d.hop ? d.hop[0] * (0.4 + Math.random() * 0.6) : 0 }, spurtT: 0, hopT: 0 };
  if (type === 'hrhund' || type === 'daemon') g.fx.push({ a: 'chef' }, { a: type, nr: f.nr });
  if (type === 'hrhund') g.stat.hund = 1;
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
  if (g.taarne.length >= MAKS_TAARNE) return false;
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
  // En boss i sin skal kan ikke tage skade (den lyser blåt, så man kan se det).
  if (f.skalT > 0) return;
  slags ||= g.kilde;
  if (slags && f.d.modstand?.[slags]) skade = Math.max(1, Math.round(skade * f.d.modstand[slags]));      // svagheder og modstand
  // Monstrene har vænnet sig til den skade, man har brugt mest.
  if (slags && g.vaen?.[slags]) skade = Math.max(1, Math.round(skade * (1 - g.vaen[slags])));
  const p = f.d.panser || 0;
  let s_ = gennem || !p ? skade : Math.max(1, skade - p);
  if (f.skjold > 0) { const t_ = Math.min(f.skjold, s_); f.skjold -= t_; s_ -= t_; if (f.skjold <= 0) g.fx.push({ a: 'skjoldbrud', nr: f.nr, x: f.x, y: f.y }); }
  if (slags && g.skadeLog) g.skadeLog[slags] = (g.skadeLog[slags] || 0) + Math.min(s_, Math.max(0, f.hp));
  f.hp -= s_;
  f.ramtT = g.t;
  if (f.hp <= 0) {
    const n = Math.round(f.d.dusoer * dusoerFaktor(g.boelge) * (g.svaer?.dusoer || 1));
    g.penge += n; g.draebt++;
    if (f.d.boss && g.stat) g.stat.bosser.push(f.type);
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
    if (f.hp <= 0 || f.hopT > 0 || (f.d.skjult && !ser) || (f.d.luft && !luft)) continue;
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
  g.kilde = KILDE_ID[t.id] || KILDE[art] || null;
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
    const ofre = g.fjender.filter((e) => e.hp > 0 && !(e.hopT > 0) && !e.d.luft && (!e.d.skjult || s.ser) && Math.hypot(e.x - t.x, e.y - t.y) <= s.r + e.d.r && vinkelFra(Math.atan2(e.y - t.y, e.x - t.x), t.v) < 0.5)
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

// ---------- bossernes faser ----------
// Når en boss kommer under en vis del af sit liv, gør den noget nyt. Den siger det højt (fx 'fase'), så det er til at nå at reagere på.
function fase(g, f, h) {
  if (h.kald) {
    const [type, n0] = h.kald, n = Math.max(1, Math.round(n0 * (g.svaer?.kald || 1)));
    for (let i = 0; i < n; i++) nyFjende(g, type, Math.max(0, f.s - 30 - i * 16));
  }
  if (h.skjold) for (const x of g.fjender) if (x.hp > 0 && x !== f && !x.d.boss && Math.hypot(x.x - f.x, x.y - f.y) <= 160) x.skjold = Math.max(x.skjold || 0, Math.round(x.max * h.skjold));
  if (h.skjold) g.fx.push({ a: 'skjold', x: f.x, y: f.y, r: 160, nr: f.nr });
  if (h.skal) f.skalT = h.skal;
  if (h.raseri) { f.raseriT = h.raseri[0]; f.raseriX = h.raseri[1]; }
  if (h.panser) f.d = { ...f.d, panser: (f.d.panser || 0) + h.panser };
  g.fx.push({ a: 'fase', nr: f.nr, x: f.x, y: f.y, tekst: h.tekst, type: f.type });
}
// ---------- monstrenes evner ----------
function evner(g, f, dt) {
  const d = f.d, e = f.evneT;
  if (f.spurtT > 0) f.spurtT -= dt;
  if (f.hopT > 0) f.hopT -= dt;
  if (f.skalT > 0) f.skalT -= dt;
  if (f.raseriT > 0) f.raseriT -= dt;
  if (d.faser && !g.versus) d.faser.forEach(([andel, h], i) => { if (!f.fase[i] && f.hp > 0 && f.hp <= f.max * andel) { f.fase[i] = 1; fase(g, f, h); } });
  if (d.regen && f.hp < f.max) f.hp = Math.min(f.max, f.hp + f.max * d.regen * dt);
  if (d.hel && (e.hel -= dt) <= 0) {
    e.hel = d.hel[2];
    let n = 0;
    for (const x of g.fjender) if (x.hp > 0 && x !== f && !x.d.boss && x.hp < x.max && Math.hypot(x.x - f.x, x.y - f.y) <= d.hel[0]) { x.hp = Math.min(x.max, x.hp + Math.max(1, Math.round(x.max * d.hel[1]))); n++; }
    if (n) g.fx.push({ a: 'hel', x: f.x, y: f.y, r: d.hel[0], nr: f.nr });
  }
  if (d.skjold && (e.skjold -= dt) <= 0) {
    e.skjold = d.skjold[2];
    for (const x of g.fjender) if (x.hp > 0 && x !== f && !x.d.boss && Math.hypot(x.x - f.x, x.y - f.y) <= d.skjold[0]) x.skjold = Math.max(x.skjold || 0, Math.round(x.max * d.skjold[1]));
    if (d.boss) f.skjold = Math.max(f.skjold, Math.round(f.max * 0.04));
    g.fx.push({ a: 'skjold', x: f.x, y: f.y, r: d.skjold[0], nr: f.nr });
  }
  if (d.spurt && f.spurtT <= 0 && f.hopT <= 0 && (e.spurt -= dt) <= 0) { e.spurt = d.spurt[0] * (0.8 + Math.random() * 0.4); f.spurtT = d.spurt[1]; g.fx.push({ a: 'spurt', nr: f.nr }); }
  if (d.hop && f.hopT <= 0 && f.spurtT <= 0 && f.brems >= 1 && (e.hop -= dt) <= 0) { e.hop = d.hop[0] * (0.8 + Math.random() * 0.4); f.hopT = d.hop[2]; g.fx.push({ a: 'hop', nr: f.nr }); }
}
// ---------- et skridt frem ----------
export function skridt(g, dt) {
  if (g.fase === 'tabt' || g.fase === 'vundet') return;
  g.t += dt;
  if (g.fase === 'vent') { g.vent -= dt; if (g.vent <= 0) startBoelge(g); }
  while (g.ekstra.length && g.ekstra[0].t <= g.t) nyFjende(g, g.ekstra.shift().type);      // monstre sendt af modstanderne
  if (g.fase === 'kamp') {
    g.bt += dt; g.ur -= dt;
    while (g.koe.length && g.koe[0].t <= g.t) nyFjende(g, g.koe.shift().type);
    // Uret er ude: bølgen tæller som overlevet, og den næste kommer, uanset hvad der stadig går på vejen.
    if (g.ur <= 0 && g.boelge < g.antal && !g.versus) { slutBoelge(g, false); startBoelge(g); }
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
    evner(g, f, dt);
    f.s += f.d.fart * f.brems * (f.spurtT > 0 ? f.d.spurt[2] : 1) * (f.raseriT > 0 ? f.raseriX : 1) * dt * (g.bane.fart || 1) + (f.hopT > 0 ? f.d.hop[1] / f.d.hop[2] * dt : 0);          // på øen går det op ad bakke, så alle er lidt langsommere
    if (f.s >= g.bane.laengde) {
      f.hp = 0; g.liv -= f.d.liv; if (g.stat) g.stat.laek += f.d.liv;
      g.fx.push({ a: 'laek', n: f.d.liv, x: f.x, y: f.y, type: f.type });
      if (g.liv <= 0 && g.udoedelig) g.liv = 1;
      if (g.liv <= 0) { g.liv = 0; g.fase = 'tabt'; g.fx.push({ a: 'tabt' }); return; }
      continue;
    }
    sted(g.bane, f.s, f);
  }
  for (const t of g.taarne) taarnSkridt(g, t, dt);
  g.kilde = null;
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
    slutBoelge(g, true);
    // Pausen er resten af bølgens ur, så spillet tager lige lang tid, uanset hvor hurtigt man rydder vejen. Man kan selv starte før tid og få en bonus.
    if (g.boelge >= (g.antal || BOELGER.length) && !g.versus) { g.fase = 'vundet'; g.fx.push({ a: 'vundet' }); } else { g.fase = 'vent'; g.vent = g.versus ? 8 : Math.max(5, g.ur); }
  }
  if (g.stat && g.taarne.length > g.stat.flestTaarne) g.stat.flestTaarne = g.taarne.length;
}
// En bølge er slut: ryddet (fuld bonus) eller overlevet, da uret løb ud (60 % bonus). Møllerne betaler altid.
function slutBoelge(g, ren) {
  g.klaret = g.boelge;
  let bonus = Math.round((120 + 25 * g.boelge) * (ren ? 1 : 0.6));
  for (const t of g.taarne) if (t.def.art === 'moelle') { const n = t.def.trin[t.trin].tjen; bonus += n; t.skudT = g.t; g.fx.push({ a: 'tjen', x: t.x, y: t.y, n }); }
  g.penge += bonus;
  if (ren && g.stat) g.stat.ren++;
  g.fx.push({ a: 'klaret', n: bonus, ren });
  laer(g);
}
// Monstrene lærer: står én slags skade for mere end 55 % af bølgens skade, tåler de næste monstre den lidt bedre. Resten glemmes langsomt igen.
// Det kan ses i spillet, så man kan svare igen ved at blande sine tårne.
function laer(g) {
  const S = g.svaer, log = g.skadeLog || {}; g.skadeLog = {};
  if (!S?.laer || g.versus) return;
  const sum = Object.values(log).reduce((a, b) => a + b, 0);
  let top = null; for (const k in log) if (!top || log[k] > log[top]) top = k;
  for (const k in g.vaen) if (k !== top) g.vaen[k] = Math.max(0, +(g.vaen[k] - S.laer / 2).toFixed(3));
  if (!top || sum <= 0 || log[top] / sum < 0.55) return;
  const foer = g.vaen[top] || 0;
  g.vaen[top] = Math.min(S.laerMaks, +(foer + S.laer).toFixed(3));
  if (g.vaen[top] > foer) g.fx.push({ a: 'laer', slags: top, v: g.vaen[top] });
}

export function moenterFor(g) {         // hvad et spil giver til arsenalet, mere jo sværere
  let n = 0; for (let w = 1; w <= g.klaret; w++) n += 5 + w;
  return Math.round((n + (g.fase === 'vundet' ? 300 : 0)) * (g.svaer?.moenter || 1) * (1 + 0.02 * (g.baneNr || 0)));
}
