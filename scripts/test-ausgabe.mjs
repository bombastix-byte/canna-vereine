// Deterministischer Test der KCanG-Limit-Logik (reine Funktionen, ohne DB/Server).
// Prueft die gesetzlichen Grenzen an konkreten Szenarien. Beendet mit Code 1,
// wenn ein Fall fehlschlaegt.  Aufruf:  node scripts/test-ausgabe.mjs
import {
  pruefeLimit,
  pruefeAbgabePositionen,
  istU21,
  alterAmTag,
  beitragEuro,
  LIMIT_TAG_G,
  LIMIT_MONAT_G,
  LIMIT_MONAT_U21_G,
} from '../src/lib/ausgabe.ts';

let fehler = 0;
function pruefe(name, ist, soll) {
  const ok = ist === soll;
  if (!ok) fehler++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  (ist=${ist}, soll=${soll})`}`);
}

const erwachsen = { u21: false, alterBekannt: true };
const jung = { u21: true, alterBekannt: true };

// --- Menge ungueltig ---
pruefe('Menge 0 -> abgelehnt', pruefeLimit({ ...erwachsen, thcProzent: 18, mengeHeuteBisher: 0, mengeMonatBisher: 0, mengeNeu: 0 }).code, 'menge');
pruefe('Menge negativ -> abgelehnt', pruefeLimit({ ...erwachsen, thcProzent: 18, mengeHeuteBisher: 0, mengeMonatBisher: 0, mengeNeu: -5 }).code, 'menge');

// --- Tageslimit (25 g) ---
pruefe('Erwachsen 10 g frisch -> ok', pruefeLimit({ ...erwachsen, thcProzent: 18, mengeHeuteBisher: 0, mengeMonatBisher: 0, mengeNeu: 10 }).ok, true);
pruefe('Erwachsen genau auf 25 g -> ok', pruefeLimit({ ...erwachsen, thcProzent: 18, mengeHeuteBisher: 20, mengeMonatBisher: 20, mengeNeu: 5 }).ok, true);
pruefe('Erwachsen 25 g + 1 g -> Tageslimit', pruefeLimit({ ...erwachsen, thcProzent: 18, mengeHeuteBisher: 24, mengeMonatBisher: 24, mengeNeu: 2 }).code, 'tageslimit');

// --- Monatslimit (50 g Erwachsene) ---
pruefe('Erwachsen Monat 48 + 2 g -> ok', pruefeLimit({ ...erwachsen, thcProzent: 18, mengeHeuteBisher: 0, mengeMonatBisher: 48, mengeNeu: 2 }).ok, true);
pruefe('Erwachsen Monat 48 + 3 g -> Monatslimit', pruefeLimit({ ...erwachsen, thcProzent: 18, mengeHeuteBisher: 0, mengeMonatBisher: 48, mengeNeu: 3 }).code, 'monatslimit');

// --- U21: THC-Grenze (<=10 %) ---
pruefe('U21 THC 9 % -> ok', pruefeLimit({ ...jung, thcProzent: 9, mengeHeuteBisher: 0, mengeMonatBisher: 0, mengeNeu: 10 }).ok, true);
pruefe('U21 THC 18 % -> u21_thc', pruefeLimit({ ...jung, thcProzent: 18, mengeHeuteBisher: 0, mengeMonatBisher: 0, mengeNeu: 5 }).code, 'u21_thc');
pruefe('U21 THC unbekannt -> u21_thc', pruefeLimit({ ...jung, thcProzent: null, mengeHeuteBisher: 0, mengeMonatBisher: 0, mengeNeu: 5 }).code, 'u21_thc');
pruefe('U21 THC genau 10 % -> ok', pruefeLimit({ ...jung, thcProzent: 10, mengeHeuteBisher: 0, mengeMonatBisher: 0, mengeNeu: 5 }).ok, true);

// --- U21: Monatslimit (30 g) ---
pruefe('U21 Monat 28 + 2 g -> ok', pruefeLimit({ ...jung, thcProzent: 9, mengeHeuteBisher: 0, mengeMonatBisher: 28, mengeNeu: 2 }).ok, true);
pruefe('U21 Monat 28 + 3 g -> Monatslimit', pruefeLimit({ ...jung, thcProzent: 9, mengeHeuteBisher: 0, mengeMonatBisher: 28, mengeNeu: 3 }).code, 'monatslimit');
pruefe('U21 Monatslimit-Wert = 30', pruefeLimit({ ...jung, thcProzent: 9, mengeHeuteBisher: 0, mengeMonatBisher: 0, mengeNeu: 1 }).monatslimit, LIMIT_MONAT_U21_G);

// --- Bestand ---
pruefe('Bestand 5 g, will 10 g -> bestand', pruefeLimit({ ...erwachsen, thcProzent: 18, mengeHeuteBisher: 0, mengeMonatBisher: 0, mengeNeu: 10, bestandGramm: 5 }).code, 'bestand');
pruefe('Bestand 20 g, will 10 g -> ok', pruefeLimit({ ...erwachsen, thcProzent: 18, mengeHeuteBisher: 0, mengeMonatBisher: 0, mengeNeu: 10, bestandGramm: 20 }).ok, true);

// --- Restmengen-Anzeige ---
const rest = pruefeLimit({ ...erwachsen, thcProzent: 18, mengeHeuteBisher: 22, mengeMonatBisher: 40, mengeNeu: 3 });
pruefe('Rest heute korrekt (25-22=3)', rest.restTag, 3);
pruefe('Rest Monat korrekt (50-40=10)', rest.restMonat, 10);

// --- Alter / U21-Einstufung (Stichtag 2026-07-02) ---
const stichtag = '2026-07-02';
pruefe('Alter 20 (2006-01-10)', alterAmTag('2006-01-10', stichtag), 20);
pruefe('Alter 18 kurz nach Geburtstag', alterAmTag('2008-07-01', stichtag), 18);
pruefe('Alter 17 (Geburtstag morgen)', alterAmTag('2008-07-03', stichtag), 17);
pruefe('U21 bei 20 Jahren -> true', istU21('2006-01-10', stichtag), true);
pruefe('U21 bei genau 21 -> false', istU21('2005-07-02', stichtag), false);
pruefe('U21 bei 21 + 1 Tag -> false', istU21('2005-07-01', stichtag), false);
pruefe('U21 bei fehlendem Geburtsdatum -> true (streng)', istU21(undefined, stichtag), true);

// --- Mehrfach-Positionen (ein Vorgang, gemeinsamer Beleg) ---
const multi = (p, extra = {}) =>
  pruefeAbgabePositionen({ u21: false, alterBekannt: true, mengeHeuteBisher: 0, mengeMonatBisher: 0, positionen: p, ...extra });
// Das kritische Schlupfloch: Limit darf nicht durch Aufteilen umgehbar sein.
pruefe('Multi: 22g heute + (2g+2g) -> Tageslimit', multi([{ thcProzent: 18, menge: 2 }, { thcProzent: 20, menge: 2 }], { mengeHeuteBisher: 22 }).code, 'tageslimit');
pruefe('Multi: 22g heute + (2g+1g) -> ok (genau 25)', multi([{ thcProzent: 18, menge: 2 }, { thcProzent: 20, menge: 1 }], { mengeHeuteBisher: 22 }).ok, true);
pruefe('Multi: 2 Positionen ok, gesamt korrekt', multi([{ thcProzent: 18, menge: 5 }, { thcProzent: 20, menge: 3 }]).gesamt, 8);
pruefe('Multi: Monat 48 + (1g+2g) -> Monatslimit', multi([{ thcProzent: 18, menge: 1 }, { thcProzent: 20, menge: 2 }], { mengeMonatBisher: 48 }).code, 'monatslimit');
pruefe('Multi U21: eine Position 18% -> u21_thc', multi([{ thcProzent: 9, menge: 2 }, { thcProzent: 18, menge: 2 }], { u21: true }).code, 'u21_thc');
pruefe('Multi U21: beide <=10% -> ok', multi([{ thcProzent: 9, menge: 2 }, { thcProzent: 10, menge: 2 }], { u21: true }).ok, true);
pruefe('Multi: Bestand je Position (5g da, 8g gewollt) -> bestand', multi([{ thcProzent: 18, menge: 8, bestandGramm: 5 }]).code, 'bestand');
pruefe('Multi: keine Positionen -> menge', multi([]).code, 'menge');
pruefe('Multi: Position mit 0g -> menge', multi([{ thcProzent: 18, menge: 0 }]).code, 'menge');

// --- Beitrag (8,50 EUR/g) ---
pruefe('Beitrag 10 g = 85,00', beitragEuro(10), 85);
pruefe('Beitrag 3,5 g = 29,75', beitragEuro(3.5), 29.75);

// --- Konstanten ---
pruefe('Tageslimit = 25', LIMIT_TAG_G, 25);
pruefe('Monatslimit = 50', LIMIT_MONAT_G, 50);

console.log(`\n${fehler === 0 ? 'ALLE TESTS BESTANDEN' : fehler + ' TEST(S) FEHLGESCHLAGEN'}`);
process.exit(fehler === 0 ? 0 : 1);
