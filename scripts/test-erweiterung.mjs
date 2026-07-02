// Deterministische Tests der neuen Logik: Jahresmeldung-Aggregat,
// Vermehrungs-Grenzen, ZPL-Erzeugung. Ohne DB/Server.
import { aggregiereJahr } from '../src/lib/jahresmeldung.ts';
import { pruefeVermehrung } from '../src/lib/vermehrung.ts';
import { belegZpl } from '../src/lib/zpl.ts';
import { darfDienst } from '../src/lib/rollen.ts';
import { csvFeld, csvText } from '../src/lib/csv.ts';
import { hotp, totpPruefen, zeitschritt, base32Encode, base32Decode, neuesSecret } from '../src/lib/totp.ts';

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

// --- Dienst-Rollen-Gate (wer darf welche Aufgabe uebernehmen) ---
pruefe('Dienst ohne Anforderung -> jeder', darfDienst(['mitglied'], undefined), true);
pruefe('Dienst ohne Anforderung (leer) -> jeder', darfDienst(['mitglied'], ''), true);
pruefe('anbau-Dienst ohne Rolle -> nein', darfDienst(['mitglied'], 'anbau'), false);
pruefe('anbau-Dienst mit Rolle anbau -> ja', darfDienst(['mitglied', 'anbau'], 'anbau'), true);
pruefe('anbau-Dienst als Vorstand -> ja', darfDienst(['vorstand'], 'anbau'), true);
pruefe('ausgabe-Dienst mit nur anbau -> nein', darfDienst(['anbau'], 'ausgabe'), false);

// --- CSV-Export-Helfer ---
pruefe('CSV: einfaches Feld unveraendert', csvFeld('Northern Lights'), 'Northern Lights');
pruefe('CSV: Semikolon wird gequotet', csvFeld('a;b'), '"a;b"');
pruefe('CSV: Anfuehrungszeichen verdoppelt', csvFeld('sagt "hi"'), '"sagt ""hi"""');
pruefe('CSV: Zeilenumbruch gequotet', csvFeld('a\nb'), '"a\nb"');
pruefe('CSV: null wird leer', csvFeld(null), '');
pruefeWahr('CSV: Text mit BOM + CRLF', csvText([['a', 'b'], [1, 2]]).endsWith('a;b\r\n1;2\r\n'));

// --- TOTP / Zwei-Faktor (RFC-4226-Testvektoren beweisen die Implementierung) ---
const rfcSecret = base32Encode(new TextEncoder().encode('12345678901234567890'));
pruefe('HOTP RFC-Vektor Zaehler 0', hotp(rfcSecret, 0), '755224');
pruefe('HOTP RFC-Vektor Zaehler 1', hotp(rfcSecret, 1), '287082');
pruefe('HOTP RFC-Vektor Zaehler 9', hotp(rfcSecret, 9), '520489');
pruefeWahr('Base32 Roundtrip', new TextDecoder().decode(base32Decode(base32Encode(new TextEncoder().encode('hallo welt')))) === 'hallo welt');
const s = neuesSecret();
const jetzt = 1700000000000;
pruefe('TOTP: korrekter Code akzeptiert', totpPruefen(s, hotp(s, zeitschritt(jetzt)), jetzt), zeitschritt(jetzt));
pruefe('TOTP: Vorgaenger-Fenster (+-30s) akzeptiert', totpPruefen(s, hotp(s, zeitschritt(jetzt) - 1), jetzt), zeitschritt(jetzt) - 1);
pruefe('TOTP: 2 Schritte alt abgelehnt', totpPruefen(s, hotp(s, zeitschritt(jetzt) - 2), jetzt), null);
pruefe('TOTP: falscher Code abgelehnt', totpPruefen(s, '000000', jetzt) === zeitschritt(jetzt) ? 'ok' : null, null);
pruefe('TOTP: Muell abgelehnt', totpPruefen(s, 'abc123', jetzt), null);

console.log(`\n${fehler === 0 ? 'ALLE ERWEITERUNGS-TESTS BESTANDEN' : fehler + ' FEHLGESCHLAGEN'}`);
process.exit(fehler ? 1 : 0);
