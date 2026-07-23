import { strict as assert } from 'node:assert';
import {
  angebotIstAktuell,
  aktuelleAngebote,
  redaktionellerHinweis,
  redaktionellerTitel,
  sortenAusAngeboten,
} from '../src/lib/angebot.ts';
import {
  mitgliedsnummerGueltig,
  normalisiereMitgliedsnummer,
} from '../src/lib/mitgliedsnummer.ts';
import { istVereinsarbeitPfad } from '../src/lib/vereinsarbeit.ts';

assert.equal(angebotIstAktuell({ gueltig_von: '2026-07-14', gueltig_bis: '2026-07-14' }, '2026-07-14'), true);
assert.equal(angebotIstAktuell({ gueltig_bis: '2026-07-13' }, '2026-07-14'), false);
assert.equal(angebotIstAktuell({ gueltig_von: '2026-07-15' }, '2026-07-14'), false);
assert.equal(aktuelleAngebote([{ id: 'alt', gueltig_bis: '2026-01-01' }, { id: 'aktuell' }], '2026-07-14')[0].id, 'aktuell');
assert.deepEqual(
  sortenAusAngeboten([
    { sorten: [{ name: 'Zulu' }, { name: '  Alpha ' }, { name: 'Zulu' }] },
    { gueltig_bis: '2025-01-01', sorten: [{ name: 'Alt' }] },
  ], '2026-07-14'),
  ['Alpha', 'Zulu'],
);
assert.equal(redaktionellerTitel('Test3'), 'Aktuelle Abgabe');
assert.equal(redaktionellerTitel('Sommer-Ausgabe'), 'Sommer-Ausgabe');
assert.equal(redaktionellerHinweis('x'), '');
assert.equal(redaktionellerHinweis('Hinweis mit Inhalt'), 'Hinweis mit Inhalt');

assert.equal(normalisiereMitgliedsnummer(' m-101 '), 'M-101');
assert.equal(mitgliedsnummerGueltig('M-101'), true);
assert.equal(mitgliedsnummerGueltig('M'), false);
assert.equal(mitgliedsnummerGueltig('M 101'), false);

assert.equal(istVereinsarbeitPfad('/mitglieder/verwaltung'), true);
assert.equal(istVereinsarbeitPfad('/mitglieder/wawi/charge/1'), true);
assert.equal(istVereinsarbeitPfad('/mitglieder/bereich'), false);

console.log('UX-/INTEGRITAETSTESTS BESTANDEN');
