import kbh from './by_kbh.js';
import tokyo from './by_tokyo.js';
import nordlys from './by_nordlys.js';
import neon from './by_neon.js';
import faero from './by_faero.js';

// Alt, der kan justeres uden at røre reglerne: tårne, fjender, bølger og baner.
// Mål er i banens egne enheder: banen er 1600 x 900.

export const FELT = { b: 1600, h: 900 };
export const VEJ = 46;                 // vejens bredde
export const START = { penge: 700, liv: 100, moenter: 400, ejer: ['vagt', 'skytte', 'moelle'], udstyr: ['vagt', 'skytte', 'moelle'] };
export const SALG = 0.6;               // andel af det brugte, man får igen
export const MAKS_MOELLER = 5;

// art bestemmer, hvordan tårnet virker (se sim.js). trin[0] er prisen for at stille det; resten er opgraderinger.
export const TAARNE = [
  { id: 'vagt', navn: 'Vagt', art: 'skud', moent: 0, skadeart: 'Enkelt', tekst: 'Billig og hurtig på aftrækkeren. God fra første bølge.',
    trin: [ { pris: 200, skade: 2, takt: .7, r: 170 }, { pris: 150, skade: 3, takt: .75, r: 180 }, { pris: 400, skade: 5, takt: .6, r: 190, ser: 1 }, { pris: 1000, skade: 10, takt: .5, r: 205, ser: 1 }, { pris: 2400, skade: 20, takt: .4, r: 220, ser: 1 } ] },
  { id: 'skytte', navn: 'Skytte', art: 'skud', moent: 0, skadeart: 'Enkelt', tekst: 'Rammer hårdt på lang afstand, men lader langsomt.',
    trin: [ { pris: 350, skade: 12, takt: 3, r: 420 }, { pris: 300, skade: 20, takt: 2.8, r: 450, ser: 1 }, { pris: 800, skade: 40, takt: 2.4, r: 480, ser: 1 }, { pris: 2000, skade: 90, takt: 2, r: 520, ser: 1 }, { pris: 4500, skade: 220, takt: 1.6, r: 560, ser: 1 } ] },
  { id: 'moelle', navn: 'Mølle', art: 'moelle', moent: 0, skadeart: 'Ingen', tekst: 'Skyder ikke. Giver penge, hver gang en bølge er slået. Højst fem.',
    trin: [ { pris: 300, tjen: 60 }, { pris: 250, tjen: 120 }, { pris: 600, tjen: 240 }, { pris: 1500, tjen: 500 }, { pris: 3500, tjen: 1100 } ] },
  { id: 'hagl', navn: 'Hagl', art: 'hagl', moent: 400, skadeart: 'Spredning', tekst: 'Rammer flere fjender på én gang helt tæt på.',
    trin: [ { pris: 400, skade: 3, antal: 4, takt: 1.4, r: 120 }, { pris: 300, skade: 4, antal: 5, takt: 1.4, r: 120 }, { pris: 750, skade: 6, antal: 6, takt: 1.3, r: 130 }, { pris: 1800, skade: 11, antal: 7, takt: 1.2, r: 135 }, { pris: 4000, skade: 22, antal: 8, takt: 1, r: 145 } ] },
  { id: 'kaster', navn: 'Kaster', art: 'granat', moent: 400, skadeart: 'Sprængning', tekst: 'Kaster granater, der rammer alt i nærheden, også skjulte.',
    trin: [ { pris: 450, skade: 6, spraeng: 55, takt: 2.2, r: 190 }, { pris: 350, skade: 9, spraeng: 60, takt: 2.2, r: 190 }, { pris: 900, skade: 16, spraeng: 68, takt: 2, r: 200 }, { pris: 2200, skade: 34, spraeng: 78, takt: 1.8, r: 210 }, { pris: 5000, skade: 75, spraeng: 90, takt: 1.5, r: 230 } ] },
  { id: 'garder', navn: 'Garder', art: 'skud', moent: 750, skadeart: 'Enkelt', tekst: 'Automatriffel. Mange små skud i træk.',
    trin: [ { pris: 600, skade: 4, takt: .3, r: 200 }, { pris: 450, skade: 6, takt: .28, r: 200 }, { pris: 1100, skade: 9, takt: .22, r: 215, ser: 1 }, { pris: 2800, skade: 16, takt: .18, r: 230, ser: 1 }, { pris: 6000, skade: 30, takt: .14, r: 250, ser: 1 } ] },
  { id: 'frost', navn: 'Frost', art: 'frost', moent: 900, skadeart: 'Bremser', tekst: 'Sænker farten på alle fjender omkring sig.',
    trin: [ { pris: 500, brems: .7, takt: 1.2, r: 130 }, { pris: 400, brems: .62, takt: 1.2, r: 135 }, { pris: 900, brems: .55, skade: 3, takt: 1.1, r: 150 }, { pris: 2000, brems: .45, skade: 8, takt: 1, r: 160 }, { pris: 4500, brems: .35, skade: 20, takt: 1, r: 175 } ] },
  { id: 'braender', navn: 'Brænder', art: 'flamme', moent: 1000, skadeart: 'Ild', tekst: 'Ild i en kegle. Brænder igennem panser og bliver ved lidt efter.',
    trin: [ { pris: 700, skade: 2, brand: 4, takt: .12, r: 105 }, { pris: 500, skade: 3, brand: 6, takt: .12, r: 110 }, { pris: 1300, skade: 5, brand: 10, takt: .12, r: 118 }, { pris: 3000, skade: 9, brand: 20, takt: .12, r: 126 }, { pris: 6500, skade: 16, brand: 40, takt: .12, r: 138 } ] },
  { id: 'kaserne', navn: 'Kaserne', art: 'kaserne', moent: 1250, skadeart: 'Tropper', tekst: 'Sender skjoldbærere ned ad vejen fra skansen. De går lige i fjenden.',
    trin: [ { pris: 800, skade: 30, takt: 9 }, { pris: 600, skade: 55, takt: 9 }, { pris: 1500, skade: 110, takt: 8 }, { pris: 3500, skade: 260, takt: 7 }, { pris: 8000, skade: 700, takt: 6 } ] },
  { id: 'signal', navn: 'Signal', art: 'signal', moent: 1500, skadeart: 'Støtte', tekst: 'Får tårnene omkring sig til at skyde hurtigere. Fra trin 2 ser de også skjulte.',
    trin: [ { pris: 900, fart: .10, r: 150 }, { pris: 700, fart: .15, r: 150, syn: 1 }, { pris: 1800, fart: .20, vidde: .10, r: 170, syn: 1 }, { pris: 4000, fart: .27, vidde: .10, r: 180, syn: 1 }, { pris: 9000, fart: .35, vidde: .15, r: 200, syn: 1 } ] },
  { id: 'morter', navn: 'Morter', art: 'morter', moent: 1750, skadeart: 'Sprængning', tekst: 'Når næsten hele banen. Granaten er længe undervejs, men slår hårdt.',
    trin: [ { pris: 1200, skade: 30, spraeng: 80, takt: 5, r: 600 }, { pris: 900, skade: 50, spraeng: 84, takt: 5, r: 620 }, { pris: 2200, skade: 100, spraeng: 90, takt: 4.5, r: 650 }, { pris: 5000, skade: 220, spraeng: 100, takt: 4, r: 700 }, { pris: 10000, skade: 520, spraeng: 115, takt: 3.5, r: 760 } ] },
  { id: 'drone', navn: 'Drone', art: 'drone', moent: 2250, skadeart: 'Enkelt', tekst: 'Kredser om sin plads og ser alt, også de skjulte.',
    trin: [ { pris: 1400, skade: 5, takt: .25, r: 150, ser: 1 }, { pris: 1000, skade: 8, takt: .25, r: 155, ser: 1 }, { pris: 2600, skade: 13, takt: .2, r: 160, ser: 1 }, { pris: 6000, skade: 24, takt: .16, r: 170, ser: 1 }, { pris: 12000, skade: 48, takt: .12, r: 190, ser: 1 } ] },
  { id: 'lyn', navn: 'Lyn', art: 'lyn', moent: 2500, skadeart: 'Kæde', tekst: 'Lynet springer videre fra fjende til fjende.',
    trin: [ { pris: 1500, skade: 14, kaede: 3, takt: 1.3, r: 190 }, { pris: 1100, skade: 20, kaede: 4, takt: 1.3, r: 190 }, { pris: 2800, skade: 34, kaede: 5, takt: 1.1, r: 200 }, { pris: 6500, skade: 62, kaede: 6, takt: 1, r: 205 }, { pris: 13000, skade: 130, kaede: 8, takt: .85, r: 220 } ] },
  { id: 'skinne', navn: 'Skinne', art: 'skinne', moent: 3250, skadeart: 'Gennemborer', tekst: 'Skuddet går gennem alle på linjen og lige igennem panser.',
    trin: [ { pris: 2200, skade: 90, takt: 4, r: 500 }, { pris: 1500, skade: 150, takt: 4, r: 500, ser: 1 }, { pris: 3500, skade: 280, takt: 3.6, r: 520, ser: 1 }, { pris: 8000, skade: 560, takt: 3.2, r: 550, ser: 1 }, { pris: 16000, skade: 1300, takt: 2.8, r: 600, ser: 1 } ] },
  { id: 'straale', navn: 'Stråle', art: 'straale', moent: 4000, skadeart: 'Stråle', tekst: 'Jo længere strålen holder fast i samme fjende, jo mere skade. God mod de største.',
    trin: [ { pris: 2600, skade: 2, takt: .1, r: 210, ser: 1 }, { pris: 1800, skade: 3, takt: .1, r: 215, ser: 1 }, { pris: 4500, skade: 5, takt: .1, r: 225, ser: 1 }, { pris: 10000, skade: 9, takt: .1, r: 235, ser: 1 }, { pris: 20000, skade: 18, takt: .1, r: 250, ser: 1 } ] },
  { id: 'bjoern', navn: 'Bjørn', art: 'vogn', moent: 5500, skadeart: 'Enkelt og sprængning', tekst: 'Kampvogn med dobbeltkanon og raketter. Dyr, men afgør de sene bølger.',
    trin: [ { pris: 4500, skade: 22, takt: .2, r: 230, raket: 120 }, { pris: 3500, skade: 34, takt: .2, r: 235, raket: 180 }, { pris: 8000, skade: 55, takt: .17, r: 245, raket: 300, ser: 1 }, { pris: 16000, skade: 90, takt: .14, r: 255, raket: 600, ser: 1 }, { pris: 30000, skade: 160, takt: .11, r: 270, raket: 1400, ser: 1 } ] },
];

// hp og dusør ganges op for hver bølge (se sim.js). liv = hvad den koster skansen, hvis den slipper igennem. str = størrelse i spillet.
export const FJENDER = {
  kryb:     { navn: 'Monster', fl: 'monstre',   hp: 6,    fart: 52,  dusoer: 9,    liv: 1,   r: 10, str: 1 },
  loeber:   { navn: 'Løber', fl: 'løbere',   hp: 5,    fart: 104, dusoer: 10,   liv: 1,   r: 9,  str: 1 },
  klods:    { navn: 'Klods', fl: 'klodser',   hp: 36,   fart: 34,  dusoer: 34,   liv: 2,   r: 14, str: 1 },
  skygge:   { navn: 'Skygge', fl: 'skygger',   hp: 12,   fart: 60,  dusoer: 18,   liv: 1,   r: 10, str: 1, skjult: 1, modstand: { ild: 0.5 } },
  flyver:   { navn: 'Flyver', fl: 'flyvere', hp: 16,   fart: 72,  dusoer: 22,   liv: 2,   r: 10, str: 1, luft: 1, modstand: { lyn: 1.5 } },
  panser:   { navn: 'Panser', fl: 'pansere',   hp: 50,   fart: 44,  dusoer: 45,   liv: 3,   r: 13, str: 1, panser: 2, modstand: { spraeng: 0.5 } },
  svaerm:   { navn: 'Sværm', fl: 'i sværm',   hp: 3,    fart: 80,  dusoer: 4,    liv: 1,   r: 6,  str: 1 },
  kaempe:   { navn: 'Kæmpe', fl: 'kæmper',   hp: 420,  fart: 26,  dusoer: 320,  liv: 20,  r: 20, str: .8 },
  vogter:   { navn: 'Vogter',   hp: 900,  fart: 24,  dusoer: 900,  liv: 50,  r: 24, str: 1, boss: 1 },
  hersker:  { navn: 'Hersker',  hp: 2600, fart: 22,  dusoer: 2600, liv: 100, r: 26, str: 1.15, boss: 1, panser: 3, modstand: { lyn: 0.5 } },
  hoevding: { navn: 'Høvding',  hp: 9000, fart: 18,  dusoer: 0,    liv: 999, r: 30, str: 1.4, boss: 1, panser: 4, yngel: ['loeber', 2.5] },
};

// En bølge er grupper: [fjende, antal, sekunder imellem, pause efter gruppen]. Negativ pause = næste gruppe kommer samtidig.
const g = (type, antal, gab = 1, pause = 2) => [type, antal, gab, pause];
export const BOELGER = [
  [g('kryb', 8, 1.3)],
  [g('kryb', 13, 1.0)],
  [g('kryb', 10, 0.9), g('loeber', 5, 0.8)],
  [g('loeber', 12, 0.6), g('kryb', 8, 0.8)],
  [g('klods', 4, 2.2), g('kryb', 14, 0.6)],
  [g('kryb', 20, 0.5), g('loeber', 10, 0.5)],
  [g('klods', 9, 1.5), g('loeber', 8, 0.5)],
  [g('kryb', 16, 0.5), g('skygge', 6, 1.2)],
  [g('svaerm', 34, 0.22), g('klods', 6, 1.4)],
  [g('kryb', 16, 0.5, -6), g('vogter', 1)],
  [g('panser', 6, 1.6), g('loeber', 16, 0.4)],
  [g('skygge', 12, 0.8), g('klods', 10, 1.1)],
  [g('svaerm', 44, 0.18), g('panser', 8, 1.3)],
  [g('klods', 22, 0.7)],
  [g('loeber', 22, 0.35), g('kaempe', 2, 5)],
  [g('panser', 16, 0.9), g('skygge', 12, 0.6)],
  [g('svaerm', 70, 0.14), g('klods', 12, 0.8)],
  [g('kaempe', 4, 4), g('klods', 16, 0.7)],
  [g('skygge', 26, 0.45), g('panser', 14, 0.8)],
  [g('panser', 12, 0.9, -8), g('hersker', 1)],
  [g('loeber', 40, 0.22), g('kaempe', 3, 3)],
  [g('klods', 30, 0.45), g('skygge', 20, 0.4)],
  [g('panser', 30, 0.55), g('svaerm', 60, 0.12)],
  [g('kaempe', 8, 2.4), g('skygge', 20, 0.4)],
  [g('vogter', 3, 6), g('panser', 24, 0.5)],
  [g('svaerm', 120, 0.09), g('kaempe', 6, 2)],
  [g('panser', 40, 0.4), g('skygge', 36, 0.3)],
  [g('kaempe', 14, 1.5), g('hersker', 1)],
  [g('hersker', 3, 7), g('klods', 40, 0.3), g('skygge', 30, 0.3)],
  [g('kaempe', 8, 2, -14), g('panser', 30, 0.5, -10), g('hoevding', 1)],
];

// Flyvere blandes ind i bølgerne fra bølge 6. Dem kan kun nogle tårne ramme.
for (const [w, n] of [[6, 5], [9, 8], [12, 10], [14, 12], [17, 16], [19, 18], [22, 22], [24, 26], [27, 30], [29, 36]]) BOELGER[w - 1].push(g('flyver', n, 0.6, 1));

// Vejen fra indgang til skanse som hjørnepunkter. Hjørnerne rundes af i sim.js.
export const BANER = [
  // Byerne: planerne laves af model/byplan.py, og selve byen bygges af model/by.py
  { id: 'kbh', navn: 'København', punkter: kbh.vej, by: 'by_kbh', ...kbh },
  { id: 'tokyo', navn: 'Tokyo', punkter: tokyo.vej, by: 'by_tokyo', ...tokyo },
  { id: 'nordlys', navn: 'Nordlys', punkter: nordlys.vej, by: 'by_nordlys', ...nordlys },
  { id: 'neon', navn: 'Neon', punkter: neon.vej, by: 'by_neon', ...neon },
  { id: 'faero', navn: 'Færøerne', punkter: faero.vej, by: 'by_faero', ...faero },          // en ø: planen laves af model/faero_plan.py, øen bygges af model/oe.py
];
