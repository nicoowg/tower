// Skærmene: forside, arsenal og kamp. Reglerne er i sim.js, det man ser i se.js.
import { TAARNE, FJENDER, BANER, START, MAKS_MOELLER } from './data.js';
import * as sim from './sim.js';
import { hentModeller, hentBy, lavVisning, lavFremviser } from './se.js';
import { spil as lyd, saetLyd, saetStemning } from './lyd.js';
import { TEMAER, tema, sjaeldenhed, outfitId, dagensButik, tidTilNyButik, dag, ejerNavn, tjekEjer } from './stil.js';
import { lavOnline, SEND } from './online.js';

const $ = (id) => document.getElementById(id);
const h = (tag, klasse, indhold) => { const e = document.createElement(tag); if (klasse) e.className = klasse; if (indhold != null) e.innerHTML = indhold; return e; };
const ikon = (n) => `<span class="i" style="--u:url(ikon/${n}.svg)"></span>`;
const tal = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const komma = (n) => String(Math.round(n * 100) / 100).replace('.', ',');
const T = Object.fromEntries(TAARNE.map((t) => [t.id, t]));
if (/Electron/.test(navigator.userAgent)) document.body.classList.add('app');

// ---------- det, der huskes ----------
const NOEGLE = 'skanse-1';
let gem;
try { gem = JSON.parse(localStorage.getItem(NOEGLE)); } catch {}
if (!gem || !Array.isArray(gem.ejer)) gem = { moenter: START.moenter, ejer: [...START.ejer], udstyr: [...START.udstyr], bedst: {}, bane: BANER[0].id, lyd: true };
if (!BANER.some((b) => b.id === gem.bane)) gem.bane = BANER[0].id;      // banen findes ikke mere
gem.outfits ||= [];                // de outfits, man ejer
gem.paa ||= {};                    // hvilket outfit hvert tårn har på
gem.indst = { grafik: true, skygger: true, skarp: true, stemning: true, glid: true, online: true, ...(gem.indst || {}) };
let macTillader = true;            // i Mac-appen kan zfeeka slå online fra
const husk = () => { try { localStorage.setItem(NOEGLE, JSON.stringify(gem)); } catch {} };
const ejerKonto = () => !!gem.ejerKonto;
const ejerTaarn = (id) => ejerKonto() || gem.ejer.includes(id);
const ejerOutfit = (id) => ejerKonto() || id.endsWith(':std') || gem.outfits.includes(id);
saetLyd(gem.lyd);

// ---------- skærmskift ----------
let side = null;
function vis(navn) { side = navn; for (const s of ['hub', 'kamp']) $(s).hidden = s !== navn; document.querySelector('.lys').hidden = navn === 'kamp'; }

function linjer(d, s) {
  const l = [];
  if (s.skade != null) l.push(['Skade', d.art === 'flamme' || d.art === 'straale' ? tal(s.skade / s.takt) + ' i sek.' : d.art === 'hagl' ? `${s.skade} × ${s.antal}` : d.art === 'kaserne' ? tal(s.skade) + ' pr. mand' : tal(s.skade)]);
  if (s.tjen) l.push(['Giver', tal(s.tjen) + ' pr. bølge']);
  if (s.raket) l.push(['Raket', tal(s.raket)]);
  if (s.takt && d.art !== 'flamme' && d.art !== 'straale') l.push([d.art === 'kaserne' ? 'Ny mand hver' : 'Mellem skud', komma(s.takt) + ' sek.']);
  if (s.r) l.push(['Rækkevidde', tal(s.r)]);
  if (s.spraeng) l.push(['Sprængning', tal(s.spraeng)]);
  if (s.kaede) l.push(['Springer til', s.kaede + ' fjender']);
  if (s.brems) l.push(['Bremser', Math.round((1 - s.brems) * 100) + ' %']);
  if (s.brand) l.push(['Brand', s.brand + ' i sek.']);
  if (s.fart) l.push(['Hurtigere skud', Math.round(s.fart * 100) + ' %']);
  if (s.vidde) l.push(['Længere rækkevidde', Math.round(s.vidde * 100) + ' %']);
  if (s.ser || s.syn) l.push([s.syn ? 'Viser skjulte' : 'Ser skjulte', 'Ja']);
  if (!['moelle', 'signal'].includes(d.art)) l.push(['Rammer flyvere', sim.LUFT.has(d.art) ? 'Ja' : 'Nej']);
  return l;
}
const billede = (id) => `<img src="billeder/${id}.jpg" alt="" draggable="false">`;

// ---------- forsiden: seks sider ved siden af hinanden ----------
const SIDER = ['spil', 'online', 'arsenal', 'garderobe', 'butik', 'indstillinger'];
let nr = 0, fremviser = null, fremviser2 = null, fotograf = null;
function gaaTil(n, lydløs) {
  nr = Math.max(0, Math.min(SIDER.length - 1, n));
  $('spor').style.transform = `translateX(${-nr * 100}%)`;
  document.querySelectorAll('.flade').forEach((f, i) => f.classList.toggle('paa', i === nr));
  document.querySelectorAll('#faner button').forEach((b, i) => b.classList.toggle('paa', i === nr));
  const kn = document.querySelector(`#faner button[data-s="${nr}"]`), m = $('markoer');
  m.style.width = kn.offsetWidth + 'px'; m.style.transform = `translateX(${kn.offsetLeft - 4}px)`;
  $('prikker').innerHTML = SIDER.map((_, i) => `<i class="${i === nr ? 'paa' : ''}"></i>`).join('');
  if (!lydløs) lyd('klik');
  tegnSide();
}
function tegnSide() {
  $('moenter').textContent = ejerKonto() ? '∞' : tal(gem.moenter);
  $('navnvis').textContent = gem.navn || ''; $('ejerprik').classList.toggle('ejer', ejerKonto());
  ({ spil: spilSide, online: onlineSide, arsenal, garderobe, butik, indstillinger })[SIDER[nr]]();
}
function hub(n = nr) { vis('hub'); gaaTil(n, true); }
document.querySelectorAll('#faner button').forEach((b) => { b.onclick = () => gaaTil(+b.dataset.s); });
// to fingre til siden på pegefeltet, eller træk med musen, skifter side
let sveip = 0, sveipT = 0;
$('hub').addEventListener('wheel', (e) => {
  if (Math.abs(e.deltaX) < Math.abs(e.deltaY) * 1.5 || e.target.closest('.rul, .taarnvalg')) return;
  const nu = performance.now(); if (nu - sveipT < 650) return;
  sveip += e.deltaX; if (Math.abs(sveip) > 70) { gaaTil(nr + Math.sign(sveip)); sveip = 0; sveipT = nu; }
}, { passive: true });
let traek = null;
$('spor').addEventListener('pointerdown', (e) => { if (e.target.closest('button, input, canvas, .rul')) return; traek = { x: e.clientX, t: performance.now() }; });
addEventListener('pointerup', (e) => { if (!traek) return; const dx = e.clientX - traek.x; if (Math.abs(dx) > 80) gaaTil(nr - Math.sign(dx)); traek = null; });
addEventListener('keydown', (e) => {
  if (side !== 'hub' || e.target.tagName === 'INPUT') return;
  if (e.key === 'ArrowRight') gaaTil(nr + 1); else if (e.key === 'ArrowLeft') gaaTil(nr - 1);
  else if (e.key === 'Enter' && SIDER[nr] === 'spil') startKamp();
  else if (e.key >= '1' && e.key <= '6') gaaTil(+e.key - 1);
});
addEventListener('resize', () => { if (side === 'hub') gaaTil(nr, true); });

// ---------- Spil ----------
function tegnBane(c, b) {
  const bane = sim.lavBane(b.id), k = c.getContext('2d'); c.width = 640; c.height = 360;
  k.scale(0.4, 0.4); k.lineJoin = k.lineCap = 'round';
  const flade = (p, farve) => { k.beginPath(); p.forEach((q, i) => (i ? k.lineTo(q[0], q[1]) : k.moveTo(q[0], q[1]))); k.closePath(); k.fillStyle = farve; k.fill(); };
  if (bane.land) { flade(bane.land, 'rgba(92,255,156,.10)'); bane.vand.forEach((p) => flade(p, 'rgba(110,170,230,.3)')); }
  else if (bane.vand) { bane.park.forEach((p) => flade(p, bane.tema === 'sakura' ? 'rgba(255,140,180,.14)' : 'rgba(92,255,156,.07)')); bane.spaer.forEach(([a, b, c, d]) => flade([[a, b], [c, b], [c, d], [a, d]], bane.tema === 'sne' ? 'rgba(220,235,255,.12)' : 'rgba(255,255,255,.07)')); bane.vand.forEach((p) => flade(p, bane.tema === 'sne' ? 'rgba(200,230,255,.35)' : 'rgba(110,170,230,.22)')); }
  const vej = () => { k.beginPath(); bane.p.forEach((q, i) => (i ? k.lineTo(q[0], q[1]) : k.moveTo(q[0], q[1]))); };
  vej(); k.lineWidth = 50; k.strokeStyle = 'rgba(255,255,255,.14)'; k.stroke();
  vej(); k.lineWidth = 6; k.strokeStyle = 'rgba(255,255,255,.7)'; k.stroke();
  const s = bane.p[bane.p.length - 1]; k.fillStyle = '#db242e'; k.beginPath(); k.arc(s[0], s[1], 26, 0, 7); k.fill();
}
function udstyrRaekke(el, klik) {
  el.innerHTML = '';
  for (let i = 0; i < 5; i++) {
    const id = gem.udstyr[i], p = h('div', 'plads' + (id ? '' : ' tom') + (bytter && klik ? ' byt' : ''), id ? billede(id) + `<span>${T[id].navn}</span>` : '');
    if (klik) p.onclick = () => klik(i, id);
    el.append(p);
  }
}
let banekort = null;
function spilSide() {
  const el = $('baner');
  if (!banekort) {                          // tegnes kun én gang; derefter skiftes kun markeringen
    banekort = BANER.map((b) => {
      const k = h('button', 'bane glas', `<canvas></canvas><b>${b.navn}</b><span></span>`);
      tegnBane(k.querySelector('canvas'), b);
      k.onclick = () => { gem.bane = b.id; husk(); lyd('klik'); online.skiftBane(b.id); spilSide(); };
      el.append(k); return [b, k];
    });
  }
  for (const [b, k] of banekort) {
    k.classList.toggle('paa', gem.bane === b.id);
    k.querySelector('span').textContent = gem.bedst[b.id] ? (gem.bedst[b.id] >= sim.antalBoelger ? 'Holdt alle ' + sim.antalBoelger + ' bølger' : 'Nåede bølge ' + gem.bedst[b.id]) : '';
  }
  udstyrRaekke($('udstyr'));
  $('spil').disabled = !gem.udstyr.length;
}
$('spil').onclick = () => { lyd('klik'); startKamp(); };

// ---------- Arsenal ----------
let valgtKort = 'vagt', valgtTrin = 0, bytter = null;
function arsenal() {
  fremviser ||= lavFremviser($('skive'));
  const el = $('kort'); el.innerHTML = '';
  for (const d of TAARNE) {
    const ejer = ejerTaarn(d.id);
    const k = h('button', 'kort' + (valgtKort === d.id ? ' paa' : '') + (ejer ? '' : ' laast') + (gem.udstyr.includes(d.id) ? ' med' : ''), billede(d.id) + `<b>${d.navn}</b><span>${ejer ? d.skadeart : ikon('gem') + tal(d.moent)}</span>`);
    k.onclick = () => { valgtKort = d.id; valgtTrin = 0; bytter = null; lyd('klik'); arsenal(); };
    el.append(k);
  }
  udstyrRaekke($('udstyr2'), (i, id) => {
    if (bytter) { gem.udstyr[i] = bytter; bytter = null; } else if (id) gem.udstyr.splice(i, 1); else return;
    husk(); lyd('klik'); arsenal();
  });
  const d = T[valgtKort], ejer = ejerTaarn(d.id), med = gem.udstyr.includes(d.id);
  fremviser.vis(d.id, valgtTrin, gem.paa[d.id]);
  $('dNavn').textContent = d.navn; $('dTekst').textContent = d.tekst;
  $('dTal').innerHTML = [['Pris på banen', tal(d.trin[0].pris)], ['Virker som', d.skadeart], ...linjer(d, d.trin[valgtTrin])].map(([a, b]) => `<div>${a}<b>${b}</b></div>`).join('');
  $('dTrin').innerHTML = d.trin.map((s, i) => `<div class="${i === valgtTrin ? 'paa' : ''}">Trin ${i + 1}<b>${tal(s.pris)}</b></div>`).join('');
  [...$('dTrin').children].forEach((el, i) => { el.onclick = () => { valgtTrin = i; lyd('klik'); arsenal(); }; });
  const kn = $('dKnap');
  kn.disabled = false;
  if (!ejer) { kn.innerHTML = `Køb for ${tal(d.moent)}`; kn.disabled = gem.moenter < d.moent; kn.onclick = () => { gem.moenter -= d.moent; gem.ejer.push(d.id); if (gem.udstyr.length < 5) gem.udstyr.push(d.id); husk(); lyd('op'); tegnSide(); }; }
  else if (med) { kn.textContent = 'Tag af'; kn.onclick = () => { gem.udstyr = gem.udstyr.filter((x) => x !== d.id); husk(); lyd('klik'); arsenal(); }; }
  else if (gem.udstyr.length < 5) { kn.textContent = 'Udstyr'; kn.onclick = () => { gem.udstyr.push(d.id); husk(); lyd('klik'); arsenal(); }; }
  else { kn.textContent = bytter ? 'Vælg pladsen, den skal have' : 'Byt ind'; kn.disabled = !!bytter; kn.onclick = () => { bytter = d.id; lyd('klik'); arsenal(); }; }
}

// ---------- Garderobe ----------
let gTaarn = 'vagt', gTema = null, gTrin = 4;
function farveprikker(t) { return t.id === 'std' ? '' : `<div class="farver">${[t.k1, t.k2, t.lys].filter(Boolean).map((f) => `<i style="background:${f}"></i>`).join('')}</div>`; }
function garderobe() {
  fremviser2 ||= lavFremviser($('skive2')); fotograf ||= lavFremviser(document.createElement('canvas'));
  const tv = $('gTaarne'); tv.innerHTML = '';
  for (const d of TAARNE) { const b = h('button', gTaarn === d.id ? 'paa' : '', billede(d.id)); b.title = d.navn; b.onclick = () => { gTaarn = d.id; gTema = null; lyd('klik'); garderobe(); }; tv.append(b); }
  const valgt = gTema || gem.paa[gTaarn] || 'std';
  const el = $('gOutfits'); el.innerHTML = '';
  for (const t of TEMAER) {
    const id = outfitId(gTaarn, t.id), ejer = ejerOutfit(id), paa = (gem.paa[gTaarn] || 'std') === t.id;
    const k = h('button', 'kort outfit' + (valgt === t.id ? ' paa' : '') + (ejer ? '' : ' laast') + (paa ? ' med' : ''), `<div class="mini" style="--glod:${t.lys || t.k1 || '#db242e'}44"><img src="${fotograf.foto(gTaarn, t.id, 2)}" alt="" draggable="false"></div><b>${t.navn}</b><span class="sj sj-${sjaeldenhed(t.pris)}">${t.id === 'std' ? 'Standard' : sjaeldenhed(t.pris)}</span>${farveprikker(t)}<span>${ejer ? (paa ? 'På' : 'Ejet') : ikon('gem') + tal(t.pris)}</span>`);
    k.onclick = () => { gTema = t.id; lyd('klik'); garderobe(); };
    el.append(k);
  }
  const t = tema(valgt), id = outfitId(gTaarn, valgt), ejer = ejerOutfit(id);
  fremviser2.vis(gTaarn, gTrin, valgt);
  $('gNavn').textContent = `${T[gTaarn].navn} · ${t.navn}`;
  $('gSjaeld').innerHTML = valgt === 'std' ? '' : `<span class="sj sj-${sjaeldenhed(t.pris)}">${sjaeldenhed(t.pris)}</span>`;
  $('gTrin').innerHTML = [0, 1, 2, 3, 4].map((i) => `<div class="${i === gTrin ? 'paa' : ''}">Trin<b>${i + 1}</b></div>`).join('');
  [...$('gTrin').children].forEach((el, i) => { el.onclick = () => { gTrin = i; lyd('klik'); garderobe(); }; });
  const kn = $('gKnap'); kn.disabled = false;
  if (!ejer) {
    const iButik = dagensButik().some((o) => o.id === id);
    kn.textContent = iButik ? `Køb for ${tal(t.pris)}` : 'Kommer i butikken';
    kn.disabled = !iButik || gem.moenter < t.pris;
    kn.onclick = () => koeb(id, t.pris, () => garderobe());
  } else if ((gem.paa[gTaarn] || 'std') === valgt) { kn.textContent = 'Har det på'; kn.disabled = true; }
  else { kn.textContent = 'Tag på'; kn.onclick = () => { gem.paa[gTaarn] = valgt; husk(); lyd('op'); garderobe(); }; }
}
function koeb(id, pris, saa) {
  if (ejerOutfit(id) || gem.moenter < pris) return;
  gem.moenter -= pris; gem.outfits.push(id); husk(); lyd('op'); tegnSide(); saa?.();
}

// ---------- Butik ----------
let butikDag = null, butikUr = 0;
function butik() {
  fotograf ||= lavFremviser(document.createElement('canvas'));
  const varer = dagensButik(), el = $('butik');
  if (butikDag !== dag() || el.dataset.ejer !== String(ejerKonto()) || el.dataset.n !== String(gem.outfits.length)) {
    butikDag = dag(); el.dataset.ejer = ejerKonto(); el.dataset.n = gem.outfits.length; el.innerHTML = '';
    for (const o of varer) {
      const t = tema(o.tema), ejer = ejerOutfit(o.id);
      const k = h('button', 'vare glas' + (ejer ? ' ejet' : ''), `<div class="foto" style="--glod:${t.lys || t.k1}55"><img src="${fotograf.foto(o.taarn, o.tema)}" alt="" draggable="false"></div><b>${t.navn}</b><span>${T[o.taarn].navn} · <span class="sj sj-${sjaeldenhed(o.pris)}">${sjaeldenhed(o.pris)}</span></span><div class="pris">${ejer ? 'Ejet' : ikon('gem') + tal(o.pris)}</div>`);
      k.onclick = () => { if (!ejer) koeb(o.id, o.pris, () => butik()); else { gTaarn = o.taarn; gTema = o.tema; gaaTil(3); } };
      el.append(k);
    }
  }
  const ur = () => { $('nedtaelling').textContent = tidTilNyButik(); if (butikDag !== dag() && SIDER[nr] === 'butik') butik(); };
  ur(); clearInterval(butikUr); butikUr = setInterval(() => { if (SIDER[nr] === 'butik' && side === 'hub') ur(); }, 1000);
}

// ---------- Indstillinger ----------
const INDST = [
  ['Billede', [['grafik', 'Dybdeskarphed og glød'], ['skygger', 'Skygger'], ['skarp', 'Høj opløsning'], ['glid', 'Bløde kamerabevægelser']]],
  ['Lyd', [['lyd', 'Lyd'], ['stemning', 'Baggrundslyd']]],
  ['Spil', [['auto', 'Start næste bølge selv'], ['online', 'Online']]],
];
function indstillinger() {
  const el = $('indst');
  el.innerHTML = INDST.map(([gruppe, l]) => `<h4>${gruppe}</h4>` + l.map(([k, navn]) => `<div class="raekke" data-k="${k}">${navn}<span class="kontakt ${vaerdi(k) ? 'paa' : ''}"></span></div>`).join('')).join('')
    + `<h4>Profil</h4><div class="raekke">Navn<button class="lille-knap" id="skiftNavn">${gem.navn || ''}</button></div>`
    + (ejerKonto() ? `<div class="raekke">Ejerkonto<button class="lille-knap" id="logUd">Log ud</button></div>` : '');
  el.querySelectorAll('[data-k]').forEach((r) => { r.onclick = () => { saetVaerdi(r.dataset.k, !vaerdi(r.dataset.k)); lyd('klik'); indstillinger(); }; });
  $('skiftNavn').onclick = () => spoergNavn(true);
  if ($('logUd')) $('logUd').onclick = () => { gem.ejerKonto = false; husk(); tegnSide(); };
}
const vaerdi = (k) => (k === 'lyd' ? gem.lyd : k === 'auto' ? !!gem.auto : gem.indst[k]);
function saetVaerdi(k, v) {
  if (k === 'lyd') { gem.lyd = v; saetLyd(v); } else if (k === 'auto') gem.auto = v; else gem.indst[k] = v;
  husk(); brugIndst();
  if (k === 'online' && !v) online.forlad();
}
function brugIndst() {
  if (!se) return;
  se.grafik(gem.indst.grafik); se.skygger(gem.indst.skygger); se.saetSkarp?.(gem.indst.skarp); se.saetGlid?.(gem.indst.glid);
}

const stemningFor = (b) => (b.oe ? 'oe' : b.tema || (b.by ? 'by' : 'rum'));

// ---------- Online ----------
const online = lavOnline({
  tilladt: () => gem.indst.online && macTillader,
  navn: () => gem.navn || 'Spiller', ejer: ejerKonto, bane: () => gem.bane, lyd,
  tegn: () => { if (side === 'hub' && SIDER[nr] === 'online') onlineSide(); },
  start: (s) => startKamp(s),
  angreb: (type, antal, fra) => { if (g && g.liv > 0) { sim.tilfoej(g, type, antal); visBesked(`${fra.replace(/[<>&]/g, '')} sendte ${antal > 1 ? antal + ' ' : ''}${((SEND.find((x) => x.type === type) || {}).navn || '').toLowerCase()}`); } },
  modstand: tegnModstand,
  slut: versusSlut,
});
function onlineSide() { online.side($('online')); }
window.towerOnline = (til) => { macTillader = til; if (!til) online.forlad(); if (side === 'hub') tegnSide(); };
if (document.body.classList.contains('app')) fetch('__online').then((r) => r.json()).then((s) => { macTillader = s.til; }).catch(() => {});
let beskedUr = 0;
function visBesked(t) { const el = $('naeste'); $('naesteTekst').textContent = t; $('naesteHvad').innerHTML = ''; el.hidden = false; el.classList.add('besked'); clearTimeout(beskedUr); beskedUr = setTimeout(() => el.classList.remove('besked'), 2600); }

// ---------- navn og ejerkonto ----------
function spoergNavn(skift) {
  return new Promise((ok) => {
    const el = $('hilsen'), nf = $('navnfelt'), kf = $('kodefelt'), fejl = $('navnfejl');
    el.hidden = false; nf.value = skift ? gem.navn || '' : ''; kf.value = ''; kf.hidden = true; fejl.textContent = ''; nf.focus();
    const tjekFelt = () => { kf.hidden = !ejerNavn(nf.value); };
    nf.oninput = tjekFelt; tjekFelt();
    const videre = async () => {
      const navn = nf.value.trim().replace(/\s+/g, ' ');
      if (navn.length < 2) { fejl.textContent = 'Skriv mindst to tegn'; return; }
      if (ejerNavn(navn)) {
        if (!(await tjekEjer(kf.value))) { fejl.textContent = 'Forkert adgangskode'; kf.value = ''; kf.focus(); return; }
        gem.ejerKonto = true; gem.ejer = TAARNE.map((d) => d.id);
      } else gem.ejerKonto = false;
      gem.navn = navn; husk(); el.hidden = true; lyd('op'); ok(); if (side === 'hub') tegnSide();
    };
    $('navnok').onclick = videre;
    nf.onkeydown = kf.onkeydown = (e) => { if (e.key === 'Enter') videre(); };
  });
}
$('profil').onclick = () => spoergNavn(true);

// ---------- kampen ----------
let se = null, g = null, placerer = null, valgt = null, fart = 1, pause = false, mus = null, udbetalt = false;
const vist = {};
const saet = (id, v) => { if (vist[id] !== v) { vist[id] = v; $(id).textContent = v; } };

async function startKamp(vs) {
  const baneId = vs ? vs.bane : gem.bane, valgt_ = BANER.find((b) => b.id === baneId) || BANER[0];
  if (valgt_.by) { $('hent').classList.remove('vaek'); $('hentLinje').style.width = '35%'; await hentBy(valgt_.by); $('hentLinje').style.width = '100%'; $('hent').classList.add('vaek'); }      // byerne hentes, når de skal bruges
  vis('kamp'); se ||= lavVisning($('rum'), $('lag'));
  g = sim.nytSpil(baneId, gem.udstyr); if (vs) g.versus = vs; placerer = null; valgt = null; pause = false; udbetalt = false; fart = 1;
  $('fart').textContent = '1×'; document.body.classList.remove('pauset'); $('slut').hidden = true; $('valgt').hidden = true;
  se.saetOutfits(gem.paa); brugIndst(); se.saetSpil(g); se.stoerrelse();
  const dok = $('dok'); dok.innerHTML = '';
  g.udstyr.forEach((id, i) => {
    const d = T[id], s = h('button', 'slot', `<kbd>${i + 1}</kbd>${billede(id)}<div><b>${d.navn}</b><span>${tal(d.trin[0].pris)}</span></div>`);
    s.dataset.id = id; s.onclick = () => vaelgSlot(id); dok.append(s);
  });
  saetStemning(stemningFor(g.bane));
  $('send').hidden = $('modstand').hidden = !vs;
  if (vs) {
    $('send').innerHTML = SEND.map((s, i) => `<button data-i="${i}">${s.antal > 1 ? s.antal + ' ' : ''}${s.navn}<span>${tal(s.pris)}</span></button>`).join('');
    $('send').querySelectorAll('button').forEach((b) => { b.onclick = () => sendAngreb(SEND[+b.dataset.i]); });
  }
  window.skanse = { g, sim, se };
}
function vaelgSlot(id) {
  placerer = placerer === id ? null : id; if (placerer) vaelgTaarn(null);
  if (!placerer) se.spoegelse(null); else if (mus) flytMus();
  lyd('klik');
}
function raekkeFor(id, s) { return (s.r || 0) + (id === 'drone' ? sim.DRONEBANE : 0); }
function flytMus() {
  if (!placerer || !mus) return;
  se.spoegelse(placerer, mus.x, mus.y, sim.kanPlacere(g, placerer, mus.x, mus.y), raekkeFor(placerer, T[placerer].trin[0]));
}
function vaelgTaarn(t) { valgt = t; se.vaelg(t); tegnValgt(); }
function tegnValgt() {
  const el = $('valgt'); el.hidden = !valgt; if (!valgt) return;
  const t = valgt, d = t.def, nu = d.trin[t.trin], naeste = d.trin[t.trin + 1], pris = sim.opgraderPris(t);
  const a = linjer(d, nu), b = naeste ? Object.fromEntries(linjer(d, naeste)) : {};
  if (naeste) for (const [k] of linjer(d, naeste)) if (!a.some((x) => x[0] === k)) a.push([k, '']);
  const skyder = !['moelle', 'signal', 'kaserne', 'frost', 'flamme'].includes(d.art);
  el.innerHTML = `<header><h3>${d.navn}</h3><span>Trin ${t.trin + 1} af ${d.trin.length}</span></header>
    <div class="tal">${a.map(([k, v]) => `<div>${k}<b>${v}${b[k] && b[k] !== v ? `${v ? ' → ' : ''}<em>${b[k]}</em>` : ''}</b></div>`).join('')}</div>
    ${skyder ? `<div class="vaelger">${[['foerst', 'Første'], ['sidst', 'Sidste'], ['staerk', 'Stærkeste'], ['naer', 'Nærmeste']].map(([k, n]) => `<button data-m="${k}" class="${t.maal === k ? 'paa' : ''}">${n}</button>`).join('')}</div>` : ''}
    ${pris != null ? `<button class="knap hvid" id="op" ${g.penge < pris ? 'disabled' : ''}><span>Opgrader</span><span>${tal(pris)}</span></button>` : ''}
    <button class="knap salg" id="salg"><span>Sælg</span><span>${tal(sim.salgspris(t))}</span></button>`;
  el.dataset.raad = pris != null && g.penge >= pris ? 1 : 0;
  el.querySelectorAll('[data-m]').forEach((k) => { k.onclick = () => { t.maal = k.dataset.m; lyd('klik'); tegnValgt(); }; });
  if ($('op')) $('op').onclick = opgrader;
  $('salg').onclick = saelg;
}
function sendAngreb(s) {
  if (!g?.versus || g.penge < s.pris || g.liv <= 0) return;
  g.penge -= s.pris; online.send(s); lyd('kast');
}
function tegnModstand(l) {
  const el = $('modstand'); if (!g?.versus) return;
  const andre = l.filter((x) => !x.mig);
  el.innerHTML = andre.map((x) => `<div class="m hold-${x.tilstand === 'alle' ? 0 : x.hold} ${x.ude ? 'ude' : ''}"><b>${x.navn.replace(/[<>&]/g, '')}</b><span>${x.ude ? 'Ude' : 'Bølge ' + Math.max(1, x.boelge)}</span><i><u style="width:${Math.max(0, x.liv)}%"></u></i></div>`).join('');
}
function versusSlut(r) {
  if (!g) return;
  g.vandt = !!r.vandt; const n = udbetal(), el = $('slut');
  placerer = null; se.spoegelse(null); vaelgTaarn(null);
  el.innerHTML = `<h3>${r.afbrudt ? 'Værten forlod kampen' : r.vandt ? 'I vandt' : 'I tabte'}</h3><p>${r.navne?.length ? 'Sidst tilbage: ' + r.navne.map((x) => x.replace(/[<>&]/g, '')).join(', ') + '<br>' : ''}${n ? `Du får ${tal(n)} mønter.` : ''}</p>
    <div class="to"><button class="knap" id="hjem">Forside</button><button class="knap hvid" id="tilLobby">Lobby</button></div>`;
  el.hidden = false; lyd(r.vandt ? 'vundet' : 'tabt');
  const ud = () => { g = null; se.saetSpil(null); saetStemning(null); };
  $('hjem').onclick = () => { online.forlad(); ud(); hub(0); };
  $('tilLobby').onclick = () => { ud(); hub(1); };
}
function opgrader() { if (valgt && sim.opgrader(g, valgt)) tegnValgt(); }
function saelg() { if (valgt) { sim.saelg(g, valgt); vaelgTaarn(null); } }

const rum = $('rum');
let drejet = 0, traekker = false, trukket = 0;
rum.addEventListener('pointermove', (e) => {
  if ((e.buttons & 1) && traekker) { trukket += Math.abs(e.movementX) + Math.abs(e.movementY); se.flyt(-e.movementX, -e.movementY); }      // træk i banen flytter udsnittet
  if (e.buttons & 2) { drejet += Math.abs(e.movementX) + Math.abs(e.movementY); se.drej(e.movementX, e.movementY); }     // højre museknap holdt nede drejer kameraet
  mus = se.tilFelt(e.clientX, e.clientY); flytMus();
});
rum.addEventListener('wheel', (e) => { e.preventDefault(); se.rul(e); mus = se.tilFelt(e.clientX, e.clientY); }, { passive: false });
rum.addEventListener('pointerup', (e) => { if (e.button === 0 && traekker) { traekker = false; if (trukket < 5) vaelgTaarn(null); } });
rum.addEventListener('pointerleave', () => { mus = null; if (placerer) se.spoegelse(null); });
rum.addEventListener('contextmenu', (e) => { e.preventDefault(); if (drejet > 4) return; if (placerer) vaelgSlot(placerer); else vaelgTaarn(null); });
rum.addEventListener('pointerdown', (e) => {
  if (e.button === 2) { drejet = 0; rum.setPointerCapture(e.pointerId); }
  if (e.button !== 0 || !g) return;
  const p = se.tilFelt(e.clientX, e.clientY); if (!p) return;
  if (placerer) {
    const t = sim.placer(g, placerer, p.x, p.y);
    if (t && !e.shiftKey) { placerer = null; se.spoegelse(null); } else flytMus();
    return;
  }
  let bedst = null, bd = 34;
  for (const t of g.taarne) { const d = Math.hypot(t.x - p.x, t.y - p.y); if (d < bd) { bd = d; bedst = t; } }
  if (bedst) return vaelgTaarn(bedst);
  traekker = true; trukket = 0; rum.setPointerCapture(e.pointerId);        // tom bane: træk flytter, et klik slipper det valgte tårn
});
addEventListener('keydown', (e) => {
  if (side !== 'kamp' || !g || e.metaKey || e.ctrlKey) return;
  const k = e.key.toLowerCase();
  if (k >= '1' && k <= '5' && g.udstyr[k - 1]) vaelgSlot(g.udstyr[k - 1]);
  else if (k === 'escape' || k === 'q') { if (placerer) vaelgSlot(placerer); else vaelgTaarn(null); }
  else if (k === 'e') opgrader();
  else if (k === 'x' || k === 'backspace') saelg();
  else if (k === ' ') { e.preventDefault(); if (!e.repeat && !mellemrum) mellemrum = { t: performance.now(), spoler: false }; }
  else if (k === 'enter') sim.spring(g);
  else if (k === 'g') se.grafik();
  else if (k === 'f') $('fart').click();
  else if (k === 'a') $('auto').click();
  else if (k === 'arrowleft') se.drej(40, 0);
  else if (k === 'arrowright') se.drej(-40, 0);
  else if (k === 'arrowup') se.drej(0, 30);
  else if (k === 'arrowdown') se.drej(0, -30);
  else if (k === '0') se.ligeUd();
  else if (k === 'p') $('pause').click();
  else if (k === '+' || k === '=') se.zoomTrin(1.25);
  else if (k === '-') se.zoomTrin(0.8);
});
addEventListener('resize', () => { if (side === 'kamp') se?.stoerrelse(); });
// Mellemrum: et kort tryk sætter på pause; holdes den nede, kører spillet fire gange så hurtigt, til man slipper.
let mellemrum = null;
addEventListener('keyup', (e) => {
  if (e.key !== ' ' || !mellemrum) return;
  if (!mellemrum.spoler && side === 'kamp' && g) $('pause').click();
  mellemrum = null; $('fart').classList.remove('paa'); $('fart').textContent = fart + '×';
});
addEventListener('blur', () => { mellemrum = null; });
$('fart').onclick = () => { fart = fart === 1 ? 2 : fart === 2 ? 3 : 1; $('fart').textContent = fart + '×'; lyd('klik'); };
$('pause').onclick = () => { pause = !pause; $('pause').innerHTML = ikon(pause ? 'play' : 'pause'); $('pause').classList.toggle('paa', pause); document.body.classList.toggle('pauset', pause); };
const visAuto = () => { $('auto').classList.toggle('paa', !!gem.auto); };
$('auto').onclick = () => { gem.auto = !gem.auto; husk(); visAuto(); lyd('klik'); };
visAuto();
const visLyd = () => { $('lyd').innerHTML = ikon(gem.lyd ? 'volume-2' : 'volume-x'); };
$('lyd').onclick = () => { gem.lyd = !gem.lyd; saetLyd(gem.lyd); husk(); visLyd(); if (gem.lyd && g) saetStemning(stemningFor(g.bane)); };
visLyd();
$('spring').onclick = () => { sim.spring(g); lyd('klik'); };
$('forlad').onclick = () => { online.forlad(); udbetal(); g = null; se.saetSpil(null); saetStemning(null); hub(); };

function udbetal() {
  if (!g || udbetalt) return 0; udbetalt = true;
  const n = sim.moenterFor(g) + (g.versus ? 120 + (g.vandt ? 400 : 0) : 0); gem.moenter += n; gem.bedst[g.bane.id] = Math.max(gem.bedst[g.bane.id] || 0, g.klaret); husk(); return n;
}
function slut(vundet) {
  if (g.versus) { online.status(g); const el = $('slut'); el.innerHTML = '<h3>Du er ude</h3><p>Venter på de andre</p>'; el.hidden = false; return; }
  const n = udbetal(), el = $('slut');
  placerer = null; se.spoegelse(null); vaelgTaarn(null);
  el.innerHTML = `<h3>${vundet ? 'Skansen holdt' : 'Skansen faldt'}</h3><p>${vundet ? `Alle ${sim.antalBoelger} bølger er slået.` : `Du nåede bølge ${g.boelge} af ${sim.antalBoelger}.`}<br>${n ? `Du får ${tal(n)} mønter til arsenalet.` : ''}</p>
    <div class="to"><button class="knap" id="hjem">Forside</button><button class="knap hvid" id="igen">Igen</button></div>`;
  el.hidden = false;
  $('hjem').onclick = () => { online.forlad(); g = null; se.saetSpil(null); saetStemning(null); hub(); };
  $('igen').onclick = () => startKamp();
}

function hud() {
  saet('liv', g.liv); saet('penge', tal(g.penge)); saet('boelge', `${Math.max(1, g.boelge + (g.fase === 'vent' ? 1 : 0))}${g.versus ? '' : ' / ' + sim.antalBoelger}`);
  if (g.versus) { for (const b of $('send').children) b.classList.toggle('dyr', g.penge < SEND[+b.dataset.i].pris); if (g.t - (g.sidstStatus || -9) > 1) { g.sidstStatus = g.t; online.status(g); } }
  $('liv').parentElement.classList.toggle('lav', g.liv <= 30);
  for (const s of $('dok').children) {
    const id = s.dataset.id, d = T[id];
    s.classList.toggle('dyr', g.penge < d.trin[0].pris || (d.art === 'moelle' && g.taarne.filter((t) => t.def.art === 'moelle').length >= MAKS_MOELLER));
    s.classList.toggle('paa', placerer === id);
  }
  const venter = g.fase === 'vent';
  if (!$('naeste').classList.contains('besked')) $('naeste').hidden = !venter;
  if (venter && !$('naeste').classList.contains('besked')) {
    vist.naesteTekst = null; saet('naesteTekst', `Bølge ${g.boelge + 1} om ${Math.ceil(g.vent)}`);
    if (vist.hvad !== g.boelge) { vist.hvad = g.boelge; $('naesteHvad').innerHTML = sim.boelgeIndhold(g.boelge + 1).map(([type, n]) => `<span>${FJENDER[type].boss ? `<em>${FJENDER[type].navn}</em>` : `${n} ${n === 1 ? FJENDER[type].navn.toLowerCase() : FJENDER[type].fl || FJENDER[type].navn.toLowerCase()}`}</span>`).join(''); }
  }
  let boss = null; for (const f of g.fjender) if (f.d.boss && (!boss || f.max > boss.max)) boss = f;
  $('boss').hidden = !boss || venter;
  if (boss) { saet('bossNavn', boss.d.navn); $('bossLiv').style.width = Math.max(0, boss.hp / boss.max * 100) + '%'; }
  if (valgt) { const p = sim.opgraderPris(valgt), raad = p != null && g.penge >= p ? 1 : 0; if (+$('valgt').dataset.raad !== raad) tegnValgt(); }
}

let sidst = performance.now();
function ramme(nu) {
  requestAnimationFrame(ramme);
  const dt = Math.min(0.05, (nu - sidst) / 1000); sidst = nu;
  if (side === 'hub') { if (SIDER[nr] === 'arsenal') fremviser?.tegn(dt); else if (SIDER[nr] === 'garderobe') fremviser2?.tegn(dt); }
  if (side !== 'kamp' || !g) return;
  if (mellemrum && !mellemrum.spoler && nu - mellemrum.t > 220) { mellemrum.spoler = true; if (pause) $('pause').click(); $('fart').classList.add('paa'); $('fart').textContent = '4×'; }
  const skridt_ = mellemrum?.spoler ? 4 : fart;
  if (!pause) for (let i = 0; i < skridt_; i++) {
    sim.skridt(g, dt);
    for (const e of g.fx) {
      se.haendelse(e);
      if (e.a === 'op') { const t_ = g.taarne.find((x) => x.nr === e.t); lyd(t_ && t_.trin === 4 ? 'maskine' : 'op'); }
      else lyd(e.a === 'spor' ? 'spor_' + e.id : e.a === 'doed' && FJENDER[e.type].r >= 20 ? 'doed_stor' : e.a, e.a === 'spor' || e.a === 'hagl' || e.a === 'lyn' || e.a === 'skinne' ? gem.paa[e.id || (g.taarne.find((x) => x.nr === e.t) || {}).id] : null);
      if (e.a === 'boelge' && sim.boelgeIndhold(e.n).some(([type]) => FJENDER[type].boss)) lyd('chef');
      if (e.a === 'tabt') slut(false); else if (e.a === 'vundet') slut(true);
    }
    g.fx.length = 0;
  }
  if (gem.auto && !pause && g.fase === 'vent' && g.boelge >= 1 && g.vent < 7) sim.spring(g);     // autostart: næste bølge et sekund efter den forrige
  if (!pause) for (const t of g.taarne) if (g.t - t.stroemT < 0.15) lyd(t.def.art === 'flamme' ? 'ild' : 'straale');      // ild og stråle lyder, så længe de er tændt
  if (placerer) flytMus();
  se.tegn(pause ? 0 : dt);
  hud();
}

hentModeller((u) => { $('hentLinje').style.width = u * 100 + '%'; }).then(async () => {
  $('hent').classList.add('vaek');
  const q = new URLSearchParams(location.search);
  requestAnimationFrame(ramme);
  if (!gem.navn && !q.get('side')) await spoergNavn();
  if (q.get('lobby')) { hub(1); online.join(q.get('lobby')); return; }
  if (q.get('side') === 'kamp') startKamp();
  else { if (q.get('kort')) valgtKort = q.get('kort'); hub(Math.max(0, SIDER.indexOf(q.get('side')))); }
});
