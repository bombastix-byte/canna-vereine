// Nebenlaeufigkeits-Test (T5, siehe SPEC-AUSGABE.md): feuert parallele
// Buchungen ueber HTTP gegen den laufenden Astro-Dev-Server + PocketBase und
// prueft, dass weder das Tageslimit noch der Chargen-Bestand durch eine
// Race-Condition unterlaufen werden koennen. Voraussetzung: PB (8090) +
// astro dev (4321) + Seeds (wie test-tresen-http.mjs).
import PocketBase from 'pocketbase';
import { berlinTag, berlinMonat, beitragEuro } from '../src/lib/ausgabe.ts';

const BASE = process.env.APP_URL ?? 'http://127.0.0.1:4321';
const PB_URL = process.env.PB_URL ?? 'http://127.0.0.1:8090';
const ADMIN = process.env.PB_ADMIN_EMAIL ?? 'admin@goerlitz.local';
const ADMIN_PW = process.env.PB_ADMIN_PW ?? 'change-me-admin';
const STAFF = process.env.PB_STAFF_EMAIL ?? 'ausgabe@example.local';
const STAFF_PW = process.env.PB_STAFF_PW ?? 'change-me-staff';

const pb = new PocketBase(PB_URL);
pb.autoCancellation(false);
await pb.collection('_superusers').authWithPassword(ADMIN, ADMIN_PW);

const uid = async (nr) => (await pb.collection('users').getFirstListItem(`mitgliedsnummer="${nr}"`)).id;
const anna = await uid('M-101'); // Erwachsen
const bengt = await uid('M-102'); // Erwachsen, frisch (keine Vorbuchungen)

const heute = berlinTag();
const monat = berlinMonat(heute);

const chargeVon = async (sorteName) =>
  await pb.collection('chargen').getFirstListItem(`sorte_name="${sorteName}" && status="freigegeben"`);
const chNL = await chargeVon('Gushers'); // 26 % THC - beide Testmitglieder sind Erwachsene, THC egal

let fehler = 0;
function pruefe(name, ist, soll) {
  const ok = JSON.stringify(ist) === JSON.stringify(soll);
  if (!ok) fehler++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  (ist=${JSON.stringify(ist)}, soll=${JSON.stringify(soll)})`}`);
}

const login = await fetch(`${BASE}/mitglieder/anmelden`, {
  method: 'POST', redirect: 'manual',
  headers: { origin: BASE, 'content-type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ email: STAFF, passwort: STAFF_PW }),
});
const cookie = (login.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).find((c) => c.startsWith('pb_token='));
if (!cookie) { console.log('LOGIN FEHLGESCHLAGEN', login.status); process.exit(1); }
console.log('Personal angemeldet.\n');

async function buchen(mitglied, charge, menge) {
  const r = await fetch(`${BASE}/mitglieder/ausgabe/buchen`, {
    method: 'POST', redirect: 'manual',
    headers: { origin: BASE, 'content-type': 'application/x-www-form-urlencoded', cookie },
    body: new URLSearchParams({ mitglied, charge, menge_gramm: String(menge) }),
  });
  return r.headers.get('location') ?? '';
}

// --- Teil 1 (T5): Tageslimit-Race - zwei parallele Buchungen fuer
// DASSELBE Mitglied. Anna auf 20 g heute setzen, dann zweimal parallel 3 g
// buchen (20+3=23 ok, +3 weitere waere 26 -> ueber dem Limit). Dank
// In-Prozess-Serialisierung (inReihe) darf NUR eine durchgehen.
for (const a of await pb.collection('ausgaben').getFullList({ filter: `mitglied="${anna}"` })) {
  await pb.collection('ausgaben').delete(a.id);
}
await pb.collection('ausgaben').create({
  mitglied: anna, mitgliedsnummer: 'M-101', sorte_name: 'Gushers',
  menge_gramm: 20, beitrag_euro: beitragEuro(20), tag: heute, monat, belegnr: 'RACE-RESET',
});

const [r1, r2] = await Promise.all([buchen(anna, chNL.id, 3), buchen(anna, chNL.id, 3)]);
const treffer = (loc) => (loc.includes('/beleg/') ? 'beleg' : loc.includes('Tageslimit') ? 'limit' : 'sonstiges');
const ergebnisse = [treffer(r1), treffer(r2)].sort();
pruefe('Race Tageslimit: genau eine Buchung kommt durch, die andere wird geblockt', ergebnisse, ['beleg', 'limit']);

const annaHeute = await pb.collection('ausgaben').getFullList({
  filter: `mitglied="${anna}" && tag="${heute}" && storniert!=true`,
});
const summeAnna = annaHeute.reduce((s, r) => s + (Number(r.menge_gramm) || 0), 0);
pruefe('Race Tageslimit: Summe heute <= 25 g', summeAnna <= 25, true);

// --- Teil 2 (T4/T5): Bestands-Race - Charge mit verfuegbar_g=10 anlegen,
// zwei parallele Buchungen a 8 g fuer ZWEI verschiedene Mitglieder (Bengt +
// Anna). Beide vorher auf 0 g heute setzen, damit hier NUR die Bestandsgrenze
// (nicht das Tageslimit) getestet wird. Erwartung (SPEC T4.c): hoechstens
// eine der beiden erreicht den Beleg, und verfuegbar_g ist danach exakt
// 10 minus der Summe der tatsaechlich gebuchten Mengen (kein stiller
// Verlust) - egal wie das Timing ausfaellt.
let testCharge;
try {
  testCharge = await pb.collection('chargen').getFirstListItem('charge_nr="RACE-TEST"');
  await pb.collection('chargen').update(testCharge.id, { verfuegbar_g: 10, status: 'freigegeben' });
} catch {
  testCharge = await pb.collection('chargen').create({
    sorte: chNL.sorte, charge_nr: 'RACE-TEST', sorte_name: chNL.sorte_name,
    status: 'freigegeben', verfuegbar_g: 10, thc_prozent: chNL.thc_prozent,
    cbd_prozent: chNL.cbd_prozent ?? 0,
  });
}
testCharge = await pb.collection('chargen').getOne(testCharge.id);

// Bengt und Anna beide auf 0 g heute, damit das Tageslimit hier nicht dazwischenfunkt.
for (const a of await pb.collection('ausgaben').getFullList({ filter: `mitglied="${bengt}"` })) {
  await pb.collection('ausgaben').delete(a.id);
}
for (const a of await pb.collection('ausgaben').getFullList({ filter: `mitglied="${anna}"` })) {
  await pb.collection('ausgaben').delete(a.id);
}

const [b1, b2] = await Promise.all([
  buchen(bengt, testCharge.id, 8),
  buchen(anna, testCharge.id, 8),
]);
const erfolge = [b1, b2].filter((l) => l.includes('/beleg/')).length;
const warnungKam = [b1, b2].some((l) => l.includes('warnung='));

const chargeNachher = await pb.collection('chargen').getOne(testCharge.id);
const gebuchteMenge = await pb.collection('ausgaben').getFullList({
  filter: `charge_ref="${testCharge.id}" && storniert!=true`,
});
const summeGebucht = gebuchteMenge.reduce((s, r) => s + (Number(r.menge_gramm) || 0), 0);
const erwarteterBestand = 10 - summeGebucht;

// SPEC T4.c: beide Ausgaenge sind zulaessig - entweder kommt hoechstens eine
// der beiden Buchungen durch (Bestandspruefung hat die zweite geblockt),
// ODER beide kommen durch und der Bestand ist ehrlich negativ + eine
// Warnmeldung kam mit. Assertiert wird die KONSISTENZ Bestand <-> Summe
// gebuchter Mengen, nicht ein bestimmtes Timing-Ergebnis.
const bestandOk = erfolge <= 1 || (Number(chargeNachher.verfuegbar_g) < 0 && warnungKam);
pruefe('Race Bestand: hoechstens 1 Buchung ODER Bestand negativ+Warnung (Timing-abhaengig, beides zulaessig)', bestandOk, true);
pruefe('Race Bestand: verfuegbar_g konsistent zur Summe gebuchter Mengen (kein stiller Verlust)', Number(chargeNachher.verfuegbar_g), erwarteterBestand);

console.log(`\n${fehler === 0 ? 'HTTP-RACE-TEST BESTANDEN' : fehler + ' FEHLGESCHLAGEN'}`);
process.exit(fehler ? 1 : 0);
