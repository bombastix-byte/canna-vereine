// Deterministische Tests der neuen Logik: Jahresmeldung-Aggregat,
// Vermehrungs-Grenzen, ZPL-Erzeugung. Ohne DB/Server.
import { aggregiereJahr } from '../src/lib/jahresmeldung.ts';
import { pruefeVermehrung } from '../src/lib/vermehrung.ts';
import { belegZpl } from '../src/lib/zpl.ts';
import { darfDienst } from '../src/lib/rollen.ts';
import { csvFeld, csvText } from '../src/lib/csv.ts';
import { hotp, totpPruefen, zeitschritt, base32Encode, base32Decode, neuesSecret } from '../src/lib/totp.ts';
import { zyklustag, aktuellePhase, istFaelligAm, offeneSchritte, kommendeSchritte } from '../src/lib/anbauplan.ts';
import { mailAufnahme, mailAntragEingang } from '../src/lib/mail-vorlagen.ts';
import { buildPain008, normIban, sepaName, centStr, xmlEsc } from '../src/lib/sepa.ts';
import { pflanzeZpl, pflanzenZplStapel } from '../src/lib/zpl.ts';

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

// --- Anbau-Plan (Zyklustag, Phasen, faellige Schritte) ---
pruefe('Zyklustag: Start heute = Tag 1', zyklustag('2026-07-03', '2026-07-03'), 1);
pruefe('Zyklustag: Start vor 24 Tagen = Tag 25', zyklustag('2026-06-09', '2026-07-03'), 25);
pruefe('Zyklustag: Start in Zukunft -> null', zyklustag('2026-08-01', '2026-07-03'), null);
pruefe('Zyklustag: ohne Start -> null', zyklustag(undefined, '2026-07-03'), null);

const P = [
  { id: 'ph1', plan: 'p', tag_von: 1, titel: 'Keimung', typ: 'phase' },
  { id: 'ph2', plan: 'p', tag_von: 10, titel: 'Vegetation', typ: 'phase' },
  { id: 'ph3', plan: 'p', tag_von: 42, titel: 'Bluete', typ: 'phase' },
  { id: 'top', plan: 'p', tag_von: 25, titel: 'Topping', typ: 'pflege' },
  { id: 'dng', plan: 'p', tag_von: 14, titel: 'Wuchsduenger', typ: 'duengung', wiederholung_tage: 3 },
];
pruefe('Phase Tag 5 = Keimung', aktuellePhase(P, 5)?.titel, 'Keimung');
pruefe('Phase Tag 25 = Vegetation', aktuellePhase(P, 25)?.titel, 'Vegetation');
pruefe('Phase Tag 60 = Bluete', aktuellePhase(P, 60)?.titel, 'Bluete');
pruefe('Einmalig: faellig genau am Tag', istFaelligAm(P[3], 25), true);
pruefe('Einmalig: nicht am Tag danach', istFaelligAm(P[3], 26), false);
pruefe('Wiederholung: Tag 14 faellig', istFaelligAm(P[4], 14), true);
pruefe('Wiederholung: Tag 17 faellig', istFaelligAm(P[4], 17), true);
pruefe('Wiederholung: Tag 18 nicht', istFaelligAm(P[4], 18), false);
pruefe('Phase nie als Aufgabe faellig', istFaelligAm(P[0], 1), false);

// offene Schritte an Tag 26: Topping (1 Tag ueberfaellig) + Duenger (juengstes Vorkommen Tag 26)
const offen26 = offeneSchritte(P, [], 'c1', 26);
pruefe('Tag 26: zwei offene Aufgaben', String(offen26.length), '2');
pruefe('Topping 1 Tag ueberfaellig zuerst', offen26[0].schritt.id === 'top' && offen26[0].ueberfaelligTage === 1, true);
pruefe('Duenger-Vorkommen = Tag 26', offen26.find((o) => o.schritt.id === 'dng')?.faelligTag, 26);
// erledigt quittiert -> verschwindet; Quittung fuer ANDEREN Tag zaehlt nicht
const erl = [{ charge_ref: 'c1', schritt: 'top', zyklustag: 25 }, { charge_ref: 'c1', schritt: 'dng', zyklustag: 23 }];
const offenNach = offeneSchritte(P, erl, 'c1', 26);
pruefe('Topping quittiert -> nur Duenger offen', offenNach.length === 1 && offenNach[0].schritt.id === 'dng', true);
pruefe('Fremde Charge unberuehrt', offeneSchritte(P, erl, 'c2', 26).length, 2);
// kommende Schritte an Tag 20: Topping in 5 Tagen, Duenger in 3 (naechstes Vorkommen Tag 23)
const kommend = kommendeSchritte(P, 20, 7);
pruefe('Vorschau: Duenger in 3 Tagen zuerst', kommend[0]?.schritt.id === 'dng' && kommend[0]?.inTagen === 3, true);
pruefe('Vorschau: Topping in 5 Tagen', kommend.find((k) => k.schritt.id === 'top')?.inTagen, 5);

// --- Mail-Vorlagen ---
const vk = { vereinsname: 'Anbauvereinigung Test e. V.', email: 'v@test.de', ort: 'Görlitz' };
const auf = mailAufnahme(vk, 'Anna Berg', 'M-101', 'anna@x.de', 'Start-ab12-cd34');
pruefeWahr('Mail Aufnahme enthaelt Startpasswort', auf.text.includes('Start-ab12-cd34'));
pruefeWahr('Mail Aufnahme enthaelt Mitgliedsnummer', auf.text.includes('M-101'));
pruefeWahr('Mail Aufnahme Betreff mit Verein', auf.betreff.includes('Anbauvereinigung Test'));
pruefeWahr('Mail Antrag-Eingang enthaelt Namen', mailAntragEingang(vk, 'Toni').text.includes('Toni'));

// --- SEPA-Helfer ---
pruefe('IBAN normalisiert (Leerzeichen weg, gross)', normIban('de89 3704 0044 0532 0130 00'), 'DE89370400440532013000');
pruefe('Cent -> String', centStr(1550), '15.50');
pruefe('Cent glatt', centStr(1500), '15.00');
pruefe('Cent krumm', centStr(2999), '29.99');
pruefe('sepaName kuerzt + saeubert', sepaName('Müller & Söhne <GmbH> ' + 'x'.repeat(80)).length <= 70, true);
pruefe('sepaName ersetzt Sonderzeichen', sepaName('a&b<c>').includes('&'), false);
pruefe('xmlEsc', xmlEsc('a&b<c>'), 'a&amp;b&lt;c&gt;');

// --- pain.008 ---
const sepa = buildPain008({
  msgId: 'SEPA-TEST-1', creDtTm: '2026-07-03T09:00:00',
  glaeubiger: { name: 'Verein e. V.', iban: 'DE89370400440532013000', bic: 'COBADEFFXXX', glaeubigerId: 'DE98ZZZ09999999999' },
  seqTyp: 'RCUR', ausfuehrungsdatum: '2026-07-15', verwendungszweck: 'Mitgliedsbeitrag 2026-07',
  mandate: [
    { name: 'Anna Berg', iban: 'DE89370400440532013000', bic: 'COBADEFFXXX', mandatsref: 'MANDAT-1', mandatsdatum: '2026-05-01', betragCent: 1500 },
    { name: 'Bengt Cordes', iban: 'DE02120300000000202051', mandatsref: 'MANDAT-2', mandatsdatum: '2026-06-01', betragCent: 2000 },
  ],
});
pruefe('pain.008 Anzahl = 2', sepa.anzahl, 2);
pruefe('pain.008 Summe = 3500 Cent', sepa.summeCent, 3500);
pruefeWahr('pain.008 CtrlSum 35.00 zweimal (GrpHdr+PmtInf)', (sepa.xml.match(/<CtrlSum>35.00<\/CtrlSum>/g) ?? []).length === 2);
pruefeWahr('pain.008 NbOfTxs 2 zweimal', (sepa.xml.match(/<NbOfTxs>2<\/NbOfTxs>/g) ?? []).length === 2);
pruefeWahr('pain.008 korrekter Namespace', sepa.xml.includes('pain.008.001.02'));
pruefeWahr('pain.008 SeqTp RCUR', sepa.xml.includes('<SeqTp>RCUR</SeqTp>'));
pruefeWahr('pain.008 Glaeubiger-ID', sepa.xml.includes('DE98ZZZ09999999999'));
pruefeWahr('pain.008 beide Schuldner-IBANs', sepa.xml.includes('DE89370400440532013000') && sepa.xml.includes('DE02120300000000202051'));
pruefeWahr('pain.008 fehlende BIC -> NOTPROVIDED', sepa.xml.includes('NOTPROVIDED'));
let warf = false;
try { buildPain008({ msgId: 'x', creDtTm: 'x', glaeubiger: { name: 'a', iban: 'b', glaeubigerId: 'c' }, seqTyp: 'RCUR', ausfuehrungsdatum: '2026-07-15', verwendungszweck: 'x', mandate: [] }); } catch { warf = true; }
pruefeWahr('pain.008 wirft bei 0 Mandaten', warf);

// --- Pflanzen-Etikett (ZPL mit QR) ---
const pz = pflanzeZpl({ verein: 'CSC', charge: '2026-0006', sorte: 'CBD Aurora', nummer: '2026-0006-P03' });
pruefeWahr('Pflanzen-ZPL beginnt ^XA/endet ^XZ', pz.startsWith('^XA') && pz.trim().endsWith('^XZ'));
pruefeWahr('Pflanzen-ZPL enthaelt QR-Befehl (^BQ)', pz.includes('^BQN'));
pruefeWahr('Pflanzen-ZPL QR-Inhalt = Nummer', pz.includes('FDLA,2026-0006-P03'));
pruefeWahr('Pflanzen-ZPL enthaelt Sorte', pz.includes('CBD Aurora'));
const stapel = pflanzenZplStapel([{ nummer: 'P1' }, { nummer: 'P2' }, { nummer: 'P3' }]);
pruefe('ZPL-Stapel = 3 Etiketten', (stapel.match(/\^XZ/g) ?? []).length, 3);

console.log(`\n${fehler === 0 ? 'ALLE ERWEITERUNGS-TESTS BESTANDEN' : fehler + ' FEHLGESCHLAGEN'}`);
process.exit(fehler ? 1 : 0);
