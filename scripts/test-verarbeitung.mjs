// Deterministischer Test der Weiterverarbeitungs-Logik (reine Funktionen).
// Aufruf:  node scripts/test-verarbeitung.mjs
import {
  pruefeVerarbeitung,
  produktTyp,
  produktLabel,
  meldeKategorie,
  ausbeuteProzent,
  VERARBEITUNG_TYPEN,
} from '../src/lib/verarbeitung.ts';

let fehler = 0;
function pruefe(name, ist, soll) {
  const ok = ist === soll;
  if (!ok) fehler++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  (ist=${ist}, soll=${soll})`}`);
}

const basis = { typ: 'haschisch', einsatzG: 50, ertragG: 8, verfuegbarG: 100, quelleTyp: '', quelleStatus: 'freigegeben' };

// --- Typen / Altdaten ---
pruefe('leerer produkt_typ = bluete', produktTyp(''), 'bluete');
pruefe('null produkt_typ = bluete', produktTyp(null), 'bluete');
pruefe('rosin bleibt rosin', produktTyp('rosin'), 'rosin');
pruefe('Label Haschisch', produktLabel('haschisch'), 'Haschisch');
pruefe('Label Altdaten = Blüte', produktLabel(undefined), 'Blüte');
pruefe('genau zwei Verarbeitungs-Typen', VERARBEITUNG_TYPEN.length, 2);

// --- Meldekategorie (Paragraf 26: Marihuana vs. Haschisch) ---
pruefe('Bluete zaehlt als Marihuana', meldeKategorie('bluete'), 'marihuana');
pruefe('Altdaten zaehlen als Marihuana', meldeKategorie(undefined), 'marihuana');
pruefe('Haschisch zaehlt als Haschisch', meldeKategorie('haschisch'), 'haschisch');
pruefe('Rosin zaehlt als Haschisch (Harz)', meldeKategorie('rosin'), 'haschisch');

// --- Gutfall ---
pruefe('gueltige Verarbeitung ok', pruefeVerarbeitung(basis).ok, true);
pruefe('rosin ok', pruefeVerarbeitung({ ...basis, typ: 'rosin' }).ok, true);
pruefe('Einsatz = kompletter Bestand ok', pruefeVerarbeitung({ ...basis, einsatzG: 100 }).ok, true);
pruefe('Ertrag = Einsatz ok (Grenzfall)', pruefeVerarbeitung({ ...basis, ertragG: 50 }).ok, true);

// --- Fehlerfaelle ---
pruefe('unbekannter Typ gesperrt', pruefeVerarbeitung({ ...basis, typ: 'oel' }).ok, false);
pruefe('bluete als Ziel gesperrt', pruefeVerarbeitung({ ...basis, typ: 'bluete' }).ok, false);
pruefe('Haschisch-Quelle gesperrt', pruefeVerarbeitung({ ...basis, quelleTyp: 'haschisch' }).ok, false);
pruefe('nicht freigegebene Quelle gesperrt', pruefeVerarbeitung({ ...basis, quelleStatus: 'geerntet' }).ok, false);
pruefe('Einsatz 0 gesperrt', pruefeVerarbeitung({ ...basis, einsatzG: 0 }).ok, false);
pruefe('Ertrag 0 gesperrt', pruefeVerarbeitung({ ...basis, ertragG: 0 }).ok, false);
pruefe('Ertrag > Einsatz gesperrt', pruefeVerarbeitung({ ...basis, ertragG: 51 }).ok, false);
pruefe('Einsatz > Bestand gesperrt', pruefeVerarbeitung({ ...basis, einsatzG: 101 }).ok, false);
pruefe('unbekannter Bestand gesperrt', pruefeVerarbeitung({ ...basis, verfuegbarG: null }).ok, false);
pruefe('NaN-Einsatz gesperrt', pruefeVerarbeitung({ ...basis, einsatzG: NaN }).ok, false);

// --- Ausbeute ---
pruefe('Ausbeute 50 -> 8 = 16 %', ausbeuteProzent(50, 8), 16);
pruefe('Ausbeute 30 -> 4,5 = 15 %', ausbeuteProzent(30, 4.5), 15);
pruefe('Ausbeute ohne Einsatz = null', ausbeuteProzent(0, 5), null);

// --- Erweiterbare Produktliste + Meldekategorie ---
const { PRODUKTE, PRODUKT_TYPEN: PT } = await import('../src/lib/verarbeitung.ts');
pruefe('Produktliste hat 3 Eintraege', PRODUKTE.length, 3);
pruefe('PRODUKT_TYPEN aus Liste abgeleitet', PT.join(','), 'bluete,haschisch,rosin');
pruefe('jede Produktart hat gueltige Kategorie', PRODUKTE.every((p) => ['marihuana', 'haschisch'].includes(p.kategorie)), true);
pruefe('Bluete = Marihuana', meldeKategorie('bluete'), 'marihuana');
pruefe('Haschisch = Haschisch', meldeKategorie('haschisch'), 'haschisch');
pruefe('Rosin = Haschisch', meldeKategorie('rosin'), 'haschisch');
pruefe('unbekannter Typ -> bluete/marihuana (kein Fehlsplit)', meldeKategorie('phantasie'), 'marihuana');
pruefe('produktTyp unbekannt = bluete', produktTyp('kief'), 'bluete');

// --- Gebinde-Etikett (ZPL): QR = Chargennummer, N Kopien ---
const { gebindeZpl, gebindeZplStapel } = await import('../src/lib/zpl.ts');
const et = { verein: 'AVG', chargeNr: '2026-0024', sorte: 'CBD Aurora', produkt: 'Haschisch', thcProzent: 32 };
const zpl = gebindeZpl(et);
pruefe('Gebinde-ZPL QR-Inhalt = Chargennummer', zpl.includes('^FDLA,2026-0024^FS'), true);
pruefe('Gebinde-ZPL Kopfzeile Produkt · Sorte', zpl.includes('Haschisch · CBD Aurora'), true);
pruefe('Gebinde-ZPL THC-Zeile', zpl.includes('THC 32 %'), true);
pruefe('Gebinde-Stapel = 5 Etiketten', (gebindeZplStapel(et, 5).match(/\^XA/g) ?? []).length, 5);
pruefe('Gebinde-Stapel mindestens 1', (gebindeZplStapel(et, 0).match(/\^XA/g) ?? []).length, 1);

// --- Mehrquellen-Verarbeitung (In-Haus-Mix) ---
const { pruefeVerarbeitungMulti, verteileErtrag } = await import('../src/lib/verarbeitung.ts');
const q = (einsatzG, verfuegbarG = 100) => ({ einsatzG, verfuegbarG, typ: 'bluete', status: 'freigegeben' });
pruefe('Multi: zwei Quellen ok', pruefeVerarbeitungMulti({ typ: 'haschisch', quellen: [q(50), q(30)], ertragG: 12 }).ok, true);
pruefe('Multi: keine Quelle gesperrt', pruefeVerarbeitungMulti({ typ: 'haschisch', quellen: [], ertragG: 12 }).ok, false);
pruefe('Multi: Ertrag > Gesamteinsatz gesperrt', pruefeVerarbeitungMulti({ typ: 'rosin', quellen: [q(20), q(10)], ertragG: 31 }).ok, false);
pruefe('Multi: Ertrag = Gesamteinsatz ok', pruefeVerarbeitungMulti({ typ: 'rosin', quellen: [q(20), q(10)], ertragG: 30 }).ok, true);
pruefe('Multi: eine Quelle zu wenig Bestand', pruefeVerarbeitungMulti({ typ: 'haschisch', quellen: [q(50), q(30, 20)], ertragG: 10 }).ok, false);
pruefe('Multi: Haschisch-Quelle gesperrt', pruefeVerarbeitungMulti({ typ: 'haschisch', quellen: [{ einsatzG: 10, verfuegbarG: 100, typ: 'haschisch', status: 'freigegeben' }], ertragG: 5 }).ok, false);
pruefe('Multi: nicht freigegebene Quelle gesperrt', pruefeVerarbeitungMulti({ typ: 'haschisch', quellen: [{ einsatzG: 10, verfuegbarG: 100, typ: 'bluete', status: 'geerntet' }], ertragG: 5 }).ok, false);
// Ertrag proportional verteilen, Summe exakt
const v = verteileErtrag([50, 30, 20], 10);
pruefe('Verteilung Summe = Ertrag', Math.round(v.reduce((s, x) => s + x, 0) * 100) / 100, 10);
pruefe('Verteilung proportional (50g -> 5g)', v[0], 5);
const v2 = verteileErtrag([1, 1, 1], 10); // 3.33/3.33/3.34
pruefe('Verteilung Rundung Summe = 10', Math.round(v2.reduce((s, x) => s + x, 0) * 100) / 100, 10);

// --- Jahresmeldung: Split Marihuana / Haschisch (Paragraf 26) ---
const { aggregiereJahr } = await import('../src/lib/jahresmeldung.ts');
const w = aggregiereJahr('2026', {
  chargen: [],
  vernichtungen: [],
  mitgliederzahl: 10,
  ausgaben: [
    { menge_gramm: 10, monat: '2026-05' }, // Altdaten ohne produkt_typ = Marihuana
    { menge_gramm: 5, monat: '2026-06', produkt_typ: 'bluete' },
    { menge_gramm: 2, monat: '2026-06', produkt_typ: 'haschisch' },
    { menge_gramm: 1, monat: '2026-07', produkt_typ: 'rosin' },
    { menge_gramm: 99, monat: '2025-12', produkt_typ: 'haschisch' }, // anderes Jahr
  ],
  verarbeitungen: [
    { ertrag_g: 8, datum: '2026-07-03' },
    { ertrag_g: 4, datum: '2025-01-01' }, // anderes Jahr
  ],
});
pruefe('abgegeben gesamt = 18', w.abgegeben_g, 18);
pruefe('davon Marihuana = 15', w.abgegeben_marihuana_g, 15);
pruefe('davon Haschisch (inkl. Rosin) = 3', w.abgegeben_haschisch_g, 3);
pruefe('hergestellt Haschisch = 8', w.hergestellt_haschisch_g, 8);

// Alte Aufrufe ohne verarbeitungen bleiben gueltig.
const alt = aggregiereJahr('2026', { chargen: [], ausgaben: [], vernichtungen: [], mitgliederzahl: 0 });
pruefe('alt-Aufruf: hergestellt = 0', alt.hergestellt_haschisch_g, 0);

if (fehler > 0) {
  console.log(`\n${fehler} TEST(S) FEHLGESCHLAGEN`);
  process.exit(1);
}
console.log('\nALLE VERARBEITUNGS-TESTS BESTANDEN');
