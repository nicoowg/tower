// Spil med venner. Den, der opretter lobbyen, er vært; de andre joiner med en kode på fem tegn.
// Beskederne går gennem en gratis offentlig beskedserver (MQTT). Alle forbinder kun udad, så det virker gennem enhver firewall,
// og der kører aldrig en server på nogens computer. Forbindelsen findes kun, mens man er i en lobby eller en kamp.
// Hver spiller kører sin egen bane, så ingen lagger for de andre. Kun små beskeder sendes: liv, bølge og angreb.
import { BANER } from './data.js';

export const WEB = 'https://nicoowg.github.io/tower/';
export const SERVERE = ['wss://broker.hivemq.com:8884/mqtt', 'wss://test.mosquitto.org:8081/mqtt', 'wss://broker.emqx.io:8084/mqtt'];
const ROD = 'tower-skanse/v1/';
const TILSTANDE = { '1v1': { hold: 2, pr: 1, navn: '1 mod 1' }, '2v2': { hold: 2, pr: 2, navn: '2 mod 2' }, '3v3': { hold: 2, pr: 3, navn: '3 mod 3' }, alle: { hold: 8, pr: 1, navn: 'Alle mod alle' } };
export const SEND = [
  { type: 'kryb', antal: 6, pris: 140, navn: 'Monstre' },
  { type: 'loeber', antal: 5, pris: 260, navn: 'Løbere' },
  { type: 'panser', antal: 3, pris: 520, navn: 'Pansere' },
  { type: 'kaempe', antal: 1, pris: 1500, navn: 'Kæmpe' },
];
const nyKode = () => Array.from({ length: 5 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.random() * 32 | 0]).join('');
const nyId = () => Math.random().toString(36).slice(2, 10);
const html = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

function hentMqtt() {
  if (window.mqtt) return Promise.resolve();
  return new Promise((ok, fejl) => { const s = document.createElement('script'); s.src = 'lib/mqtt.min.js'; s.onload = ok; s.onerror = fejl; document.head.append(s); });
}
// Forbinder til den første server, der svarer. will = beskeden, serveren sender for os, hvis vi forsvinder uden at sige farvel.
function forbind(url, will) {
  return new Promise((ok, fejl) => {
    const k = window.mqtt.connect(url, { clientId: 'tower_' + nyId(), clean: true, keepalive: 20, reconnectPeriod: 2000, connectTimeout: 6000, will });
    const t = setTimeout(() => { k.end(true); fejl(new Error('intet svar')); }, 7000);
    k.once('connect', () => { clearTimeout(t); ok(k); });
  });
}

export function lavOnline(api) {
  // api: { tilladt(), navn(), ejer(), bane(), lyd(n), tegn(), start(spil), angreb(type, antal, fra), modstand(liste), slut(resultat), forbundet(url | null) }
  let k = null, vaert = false, kode = null, mig = null, server = null;
  let lobby = null, status = '', fejl = '', valgtTilstand = '1v1', iKamp = false, stand = {}, sidstSet = {};
  const sti = (...d) => ROD + kode + '/' + d.join('/');

  function nulstil(farvel = true) {
    if (k) {
      try {
        if (farvel && vaert && kode) { k.publish(sti('info'), '', { retain: true }); k.publish(sti('alle'), JSON.stringify({ t: 'vaertVaek' })); }
        else if (farvel && kode && mig) k.publish(sti('til'), JSON.stringify({ t: 'farvel', fra: mig }));
      } catch {}
      const gl = k; setTimeout(() => gl.end(true), 300);
    }
    k = null; vaert = false; kode = null; mig = null; lobby = null; iKamp = false; stand = {}; server = null; api.forbundet?.(null);
  }
  const tegn = () => api.tegn();
  const pub = (emne, b) => { try { k?.publish(emne, JSON.stringify(b)); } catch {} };
  const sendAlle = (b) => pub(sti('alle'), b);
  const sendTil = (id, b) => { if (id === mig) modtag(b); else pub(sti('til', id), b); };
  function tilV(b) { if (vaert) modtagHosVaert(mig, b); else pub(sti('til'), { ...b, fra: mig }); }
  const conns = { get: (id) => ({ send: (d) => sendTil(id, JSON.parse(d)) }), delete() {} };

  // ---------- værten holder styr på lobbyen ----------
  function delLobby() { sendAlle({ t: 'lobby', lobby }); tegn(); }
  function fordelHold() {
    const T = TILSTANDE[lobby.tilstand];
    if (lobby.tilstand === 'alle') lobby.spillere.forEach((s, i) => { s.hold = i; });
    else { const n = [0, 0]; for (const s of lobby.spillere) { if (s.hold == null || s.hold > 1 || n[s.hold] >= T.pr) s.hold = n[0] <= n[1] ? 0 : 1; n[s.hold]++; } }
  }
  function modtagHosVaert(fra, b) {
    const s = lobby?.spillere.find((x) => x.id === fra);
    if (b.t === 'hej') {
      if (lobby.spillere.some((x) => x.id === fra)) return;
      if (!lobby || iKamp || lobby.spillere.length >= TILSTANDE[lobby.tilstand].hold * TILSTANDE[lobby.tilstand].pr) { sendTil(fra, { t: 'afvist', grund: iKamp ? 'Kampen er i gang' : 'Lobbyen er fuld' }); return; }
      lobby.spillere.push({ id: fra, navn: String(b.navn).slice(0, 16), ejer: !!b.ejer, klar: false, hold: null }); fordelHold(); delLobby(); api.lyd('klik');
    } else if (b.t === 'klar' && s) { s.klar = !!b.klar; delLobby(); }
    else if (b.t === 'hold' && s && lobby.tilstand !== 'alle') {
      const T = TILSTANDE[lobby.tilstand], nyt = s.hold ? 0 : 1;
      if (lobby.spillere.filter((x) => x.hold === nyt).length < T.pr) { s.hold = nyt; s.klar = false; delLobby(); }
    } else if (b.t === 'status' && iKamp) {
      stand[fra] = { ...b, id: fra }; sendAlle({ t: 'stand', stand }); api.modstand(liste());
      tjekSlut();
    } else if (b.t === 'send' && iKamp && s) {
      // sendte monstre rammer modstanderne, der stadig er med: hele det andet hold, eller i alle mod alle den, der klarer sig bedst
      let maal = lobby.spillere.filter((x) => x.hold !== s.hold && !stand[x.id]?.ude);
      if (lobby.tilstand === 'alle' && maal.length) maal = [maal.sort((a, c) => (stand[c.id]?.boelge || 0) - (stand[a.id]?.boelge || 0) || (stand[c.id]?.liv || 0) - (stand[a.id]?.liv || 0))[0]];
      for (const m of maal) sendTil(m.id, { t: 'angreb', type: b.type, antal: b.antal, fra: s.navn });
    }
  }
  function tjekSlut() {
    const levende = new Set(lobby.spillere.filter((x) => !stand[x.id]?.ude).map((x) => x.hold));
    if (levende.size <= 1 && iKamp) {
      const vinder = [...levende][0] ?? null, r = { t: 'slut', vinder, navne: lobby.spillere.filter((x) => x.hold === vinder).map((x) => x.navn) };
      sendAlle(r); modtag(r);
    }
  }
  function forlodVaert(id) {
    if (!lobby) return;
    lobby.spillere = lobby.spillere.filter((x) => x.id !== id);
    if (iKamp) { stand[id] = { ...(stand[id] || {}), ude: true, liv: 0, id }; sendAlle({ t: 'stand', stand }); api.modstand(liste()); tjekSlut(); }
    else { fordelHold(); delLobby(); }
  }

  // ---------- alle (også værten) modtager ----------
  function modtag(b) {
    if (b.t === 'lobby') { lobby = b.lobby; tegn(); }
    else if (b.t === 'afvist') { fejl = b.grund; nulstil(false); tegn(); }
    else if (b.t === 'start') { iKamp = true; stand = {}; const s = b.spil, jeg = s.spillere.find((x) => x.id === mig); api.start({ ...s, hold: jeg.hold, mig }); }
    else if (b.t === 'stand') { stand = b.stand; api.modstand(liste()); }
    else if (b.t === 'angreb') api.angreb(b.type, b.antal, b.fra);
    else if (b.t === 'slut') { iKamp = false; api.slut({ vandt: b.vinder != null && lobby.spillere.find((x) => x.id === mig)?.hold === b.vinder, navne: b.navne }); for (const s of lobby.spillere) s.klar = false; }
  }
  function liste() {
    return (lobby?.spillere || []).map((s) => ({ navn: s.navn, hold: s.hold, mig: s.id === mig, liv: stand[s.id]?.liv ?? 100, boelge: stand[s.id]?.boelge ?? 0, ude: !!stand[s.id]?.ude, tilstand: lobby.tilstand }));
  }

  // ---------- opret og forbind ----------
  async function klar_(url, will) {
    await hentMqtt();
    for (const u of url ? [url] : SERVERE) { try { const c = await forbind(u, will); server = u; return c; } catch {} }
    throw new Error('ingen server');
  }
  async function opret() {
    if (!api.tilladt()) { fejl = 'Online er slået fra'; tegn(); return; }
    nulstil(false); fejl = ''; status = 'Opretter lobby'; tegn();
    kode = nyKode(); mig = nyId(); vaert = true;
    const will = { topic: ROD + kode + '/info', payload: '', retain: true, qos: 0 };
    try { k = await klar_(null, will); } catch { fejl = 'Kunne ikke nå beskedserveren'; status = ''; vaert = false; kode = null; tegn(); return; }
    api.forbundet?.(server);
    k.subscribe(sti('til'));
    k.on('message', (emne, data) => { if (!data.length) return; try { const b = JSON.parse(data); if (emne === sti('til')) { if (b.t === 'farvel') forlodVaert(b.fra); else modtagHosVaert(b.fra, b); } } catch {} });
    lobby = { kode, tilstand: valgtTilstand, bane: api.bane(), spillere: [{ id: mig, navn: api.navn(), ejer: api.ejer(), klar: false, hold: 0, vaert: true }] };
    fordelHold(); status = '';
    k.publish(sti('info'), JSON.stringify({ aaben: true }), { retain: true });       // så andre kan se, at lobbyen findes
    tegn();
  }
  async function join(kd) {
    if (!api.tilladt()) { fejl = 'Online er slået fra'; tegn(); return; }
    kd = String(kd || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (kd.length !== 5) { fejl = 'Koden har fem tegn'; tegn(); return; }
    nulstil(false); fejl = ''; status = 'Forbinder til ' + kd; tegn();
    try { await hentMqtt(); } catch { fejl = 'Kunne ikke hente forbindelsen'; status = ''; tegn(); return; }
    // find den server, lobbyen ligger på
    for (const u of SERVERE) {
      let c; try { c = await forbind(u); } catch { continue; }
      const findes = await new Promise((ok) => { const t = setTimeout(() => ok(false), 2500); c.on('message', (e, d) => { if (e === ROD + kd + '/info' && d.length) { clearTimeout(t); ok(true); } }); c.subscribe(ROD + kd + '/info'); });
      if (!findes) { c.end(true); continue; }
      kode = kd; mig = nyId(); server = u; k = c; break;
    }
    if (!k) { fejl = 'Lobbyen findes ikke'; status = ''; tegn(); return; }
    api.forbundet?.(server);
    k.options.will = { topic: sti('til'), payload: JSON.stringify({ t: 'farvel', fra: mig }), qos: 0, retain: false };
    k.unsubscribe(sti('info'));
    k.subscribe([sti('alle'), sti('til', mig)]);
    k.removeAllListeners('message');
    k.on('message', (emne, data) => { if (!data.length) return; try { const b = JSON.parse(data); if (b.t === 'vaertVaek') { const varKamp = iKamp; fejl = 'Værten forlod lobbyen'; nulstil(false); tegn(); if (varKamp) api.slut({ afbrudt: true }); } else modtag(b); } catch {} });
    const tid = setTimeout(() => { if (!lobby && k) { fejl = 'Lobbyen svarer ikke'; nulstil(); status = ''; tegn(); } }, 9000);
    k.on('message', () => { if (lobby) { clearTimeout(tid); status = ''; } });
    pub(sti('til'), { t: 'hej', fra: mig, navn: api.navn(), ejer: api.ejer() });
  }
  function startKamp() {
    if (!vaert || !lobby) return;
    const spil = { bane: lobby.bane, tilstand: lobby.tilstand, spillere: lobby.spillere.map(({ id, navn, hold }) => ({ id, navn, hold })) };
    iKamp = true; stand = {}; sendAlle({ t: 'start', spil }); modtag({ t: 'start', spil });
  }

  // ---------- siden ----------
  function side(el) {
    const T = lobby && TILSTANDE[lobby.tilstand];
    if (!lobby) {
      el.innerHTML = `<h2>Online</h2>
        <div class="tilstande">${Object.entries(TILSTANDE).map(([k, t]) => `<button class="tilstand ${valgtTilstand === k ? 'paa' : ''}" data-t="${k}"><b>${k === 'alle' ? 'Alle' : k}</b><span>${t.navn}</span></button>`).join('')}</div>
        <button class="knap hvid stor" id="opret" ${status || !api.tilladt() ? 'disabled' : ''}>${status || (api.tilladt() ? 'Opret lobby' : 'Online er slået fra')}</button>
        <div class="feltlinje"><input id="kode" maxlength="5" placeholder="Kode" spellcheck="false" autocomplete="off"><button class="knap glas" id="join" ${status ? 'disabled' : ''}>Join</button></div>
        <span class="fejl">${html(fejl)}</span>`;
      el.querySelectorAll('[data-t]').forEach((b) => { b.onclick = () => { valgtTilstand = b.dataset.t; api.lyd('klik'); tegn(); }; });
      el.querySelector('#opret').onclick = opret;
      const f = el.querySelector('#kode'); el.querySelector('#join').onclick = () => join(f.value); f.onkeydown = (e) => { if (e.key === 'Enter') join(f.value); };
      return;
    }
    const jeg = lobby.spillere.find((s) => s.id === mig), fuld = lobby.spillere.length >= 2, alleKlar = lobby.spillere.every((s) => s.klar || s.vaert);
    const holdOk = lobby.tilstand === 'alle' || [0, 1].every((h) => lobby.spillere.some((s) => s.hold === h));
    const bane = BANER.find((b) => b.id === lobby.bane);
    const spiller = (s) => `<div class="spiller ${s.klar || s.vaert ? 'klar' : ''}"><span class="prik"></span>${html(s.navn)}${s.ejer ? ' <span class="sj sj-Legendarisk">Ejer</span>' : ''}<em>${s.vaert ? 'Vært' : s.klar ? 'Klar' : ''}</em></div>`;
    const holdene = lobby.tilstand === 'alle'
      ? `<div class="holdkort"><h5>Spillere ${lobby.spillere.length}/${T.hold}</h5>${lobby.spillere.map(spiller).join('')}</div>`
      : `<div class="hold to">${[0, 1].map((h) => `<div class="holdkort"><h5>${h ? 'Blå' : 'Rød'} ${lobby.spillere.filter((s) => s.hold === h).length}/${T.pr}</h5>${lobby.spillere.filter((s) => s.hold === h).map(spiller).join('')}</div>`).join('')}</div>`;
    el.innerHTML = `<div class="lobby glas">
        <div class="lobbykode"><div><span class="svag">${T.navn} · ${html(bane?.navn || '')}</span><br><b>${lobby.kode}</b></div>
          <div class="raekke-knapper"><button class="lille-knap" id="kopier">${ikon('link')} Kopiér link</button><button class="lille-knap" id="forladL">Forlad</button></div></div>
        ${holdene}
        <div class="raekke-knapper">
          ${lobby.tilstand !== 'alle' ? '<button class="knap glas" id="skift">Skift hold</button>' : ''}
          ${vaert ? `<button class="knap hvid" id="startL" ${fuld && alleKlar && holdOk ? '' : 'disabled'}>Start</button>` : `<button class="knap ${jeg?.klar ? 'glas' : 'hvid'}" id="klar">${jeg?.klar ? 'Ikke klar' : 'Klar'}</button>`}
        </div>
      </div><span class="fejl">${html(fejl)}</span>`;
    el.querySelector('#kopier').onclick = async (e) => { try { await navigator.clipboard.writeText(WEB + '?lobby=' + lobby.kode); e.currentTarget.textContent = 'Kopieret'; } catch {} };
    el.querySelector('#forladL').onclick = () => { forlad(); tegn(); };
    el.querySelector('#skift')?.addEventListener('click', () => tilV({ t: 'hold' }));
    el.querySelector('#klar')?.addEventListener('click', () => tilV({ t: 'klar', klar: !jeg?.klar }));
    el.querySelector('#startL')?.addEventListener('click', startKamp);
  }
  function forlad() { if (k) nulstil(); }
  const ikon = (n) => `<span class="i" style="--u:url(ikon/${n}.svg)"></span>`;

  return {
    side, join, forlad, opret,
    iLobby: () => !!lobby, vaert: () => vaert, forbundet: () => (k ? server : null),
    skiftBane: (id) => { if (vaert && lobby && !iKamp) { lobby.bane = id; delLobby(); } },
    status: (g) => { if (iKamp) tilV({ t: 'status', liv: g.liv, boelge: g.boelge, ude: g.liv <= 0 }); },
    send: (s) => tilV({ t: 'send', type: s.type, antal: s.antal }),
  };
}
