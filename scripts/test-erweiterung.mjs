// Deterministische Tests der neuen Logik: Jahresmeldung-Aggregat,
// Vermehrungs-Grenzen, ZPL-Erzeugung. Ohne DB/Server.
import { aggregiereJahr } from '../src/lib/jahresmeldung.ts';
import { pruefeVermehrung } from '../src/lib/vermehrung.ts';
import { belegZpl } from '../src/lib/zpl.ts';

let fehler = 0;
function pruefe(name, ist, soll) {
  const ok = ist === soll;
  if (!ok) fehler++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  (ist=${ist}, soll=${soll})`}`);
}
function pruefeWahr(name, bed) {
  if (!bed) fehler++;
  console.log(`${bed ? 'PASS' : 'FAIL'}  ${name}`);
}

// --- Jahresmeldung ---
const daten = {
  chargen: [
    { ernte_datum: '2026-06-15 00:00:00.000Z', trockengewicht_g: 400 },
    { ernte_datum: '2026-05-01 00:00:00.000Z', trockengewicht_g: 600 },
    { ernte_datum: '2025-08-01 00:00:00.000Z', trockengewicht_g: 999 }, // anderes Jahr
    { ernte_datum: '', trockengewicht_g: 111 }, // ohne Datum -> ignoriert
  ],
  ausgaben: [
    { menge_gramm: 25, monat: '2026-06' },
    { menge_gramm: 10, monat: '2026-07' },
    { menge_gramm: 50, monat: '2025-12' }, // anderes Jahr
  ],
  vernichtungen: [
    { menge_gramm: 30, datum: '2026-06-20' },
    { menge_gramm: 5, datum: '2025-01-01' }, // anderes Jahr
  ],
  mitgliederzahl: 42,
};
const w = aggregiereJahr('2026', daten);
pruefe('Jahresmeldung angebaut = 1000', w.angebaut_g, 1000);
pruefe('Jahresmeldung abgegeben = 35', w.abgegeben_g, 35);
pruefe('Jahresmeldung vernichtet = 30', w.vernichtet_g, 30);
pruefe('Jahresmeldung Abgaben-Zahl = 2', w.anzahl_abgaben, 2);
pruefe('Jahresmeldung Chargen-Zahl = 2', w.anzahl_chargen, 2);
pruefe('Jahresmeldung Mitglieder = 42', w.mitgliederzahl, 42);

// --- Vermehrung ---
pruefe('Samen 5 bisher + 2 -> ok', pruefeVermehrung({ art: 'samen', bisherMonat: 5, anzahlNeu: 2 }).ok, true);
pruefe('Samen 5 bisher + 3 -> limit', pruefeVermehrung({ art: 'samen', bisherMonat: 5, anzahlNeu: 3 }).code, 'limit');
pruefe('Stecklinge 5 bisher + 1 -> limit', pruefeVermehrung({ art: 'stecklinge', bisherMonat: 5, anzahlNeu: 1 }).code, 'limit');
pruefe('Stecklinge 4 bisher + 1 -> ok', pruefeVermehrung({ art: 'stecklinge', bisherMonat: 4, anzahlNeu: 1 }).ok, true);
pruefe('Vermehrung anzahl 0 -> anzahl', pruefeVermehrung({ art: 'samen', bisherMonat: 0, anzahlNeu: 0 }).code, 'anzahl');
pruefe('Vermehrung unbekannte Art -> art', pruefeVermehrung({ art: 'blumen', bisherMonat: 0, anzahlNeu: 1 }).code, 'art');
pruefe('Samen-Limit = 7', pruefeVermehrung({ art: 'samen', bisherMonat: 0, anzahlNeu: 1 }).limit, 7);
pruefe('Stecklinge-Limit = 5', pruefeVermehrung({ art: 'stecklinge', bisherMonat: 0, anzahlNeu: 1 }).limit, 5);

// --- ZPL ---
const zpl = belegZpl({ verein: 'Verein e.V.', belegnr: 'A-1', sorte: 'Northern Lights', charge: '2026-0001', menge_gramm: 5, thc_prozent: 18, cbd_prozent: 0.6, beitrag_euro: 42.5 });
pruefeWahr('ZPL beginnt mit ^XA', zpl.startsWith('^XA'));
pruefeWahr('ZPL endet mit ^XZ', zpl.trim().endsWith('^XZ'));
pruefeWahr('ZPL enthaelt Sorte', zpl.includes('Northern Lights'));
pruefeWahr('ZPL enthaelt Menge', zpl.includes('5 g'));
const zplBoes = belegZpl({ verein: 'A^B~C\\D' });
pruefeWahr('ZPL entschaerft Sonderzeichen', !zplBoes.includes('A^B'));

console.log(`\n${fehler === 0 ? 'ALLE ERWEITERUNGS-TESTS BESTANDEN' : fehler + ' FEHLGESCHLAGEN'}`);
process.exit(fehler ? 1 : 0);
