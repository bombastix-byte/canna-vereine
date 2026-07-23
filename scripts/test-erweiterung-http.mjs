// E2E der Erweiterungen: Verwaltung (Rollen speichern), Vermehrung (Grenze),
// Jahresmeldung (Seite) und ZPL-Druck (Datei-Fallback). Als Vorstand angemeldet.
import PocketBase from 'pocketbase';
import { berlinTag, berlinMonat } from '../src/lib/ausgabe.ts';

const BASE = process.env.APP_URL ?? 'http://127.0.0.1:4321';
const PB_URL = process.env.PB_URL ?? 'http://127.0.0.1:8090';
const ADMIN = process.env.PB_ADMIN_EMAIL ?? 'admin@goerlitz.local';
const ADMIN_PW = process.env.PB_ADMIN_PW ?? 'change-me-admin';
const STAFF = process.env.PB_STAFF_EMAIL ?? 'ausgabe@example.local'; // rollen: vorstand
const STAFF_PW = process.env.PB_STAFF_PW ?? 'change-me-staff';

const pb = new PocketBase(PB_URL);
pb.autoCancellation(false);
await pb.collection('_superusers').authWithPassword(ADMIN, ADMIN_PW);
const anna = await pb.collection('users').getFirstListItem('mitgliedsnummer="M-101"');

// Vermehrungs-Stand von Anna fuer diesen Monat leeren (deterministisch).
const monat = berlinMonat(berlinTag());
for (const v of await pb.collection('vermehrung_ausgaben').getFullList({ filter: `mitglied="${anna.id}" && monat="${monat}"` })) {
  await pb.collection('vermehrung_ausgaben').delete(v.id);
}

const login = await fetch(`${BASE}/mitglieder/anmelden`, {
  method: 'POST', redirect: 'manual',
  headers: { origin: BASE, 'content-type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ email: STAFF, passwort: STAFF_PW }),
});
const cookie = (login.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).find((c) => c.startsWith('pb_token='));
if (!cookie) { console.log('LOGIN FEHLGESCHLAGEN', login.status); process.exit(1); }
console.log('Vorstand angemeldet.\n');

const post = (pfad, felder) =>
  fetch(`${BASE}${pfad}`, {
    method: 'POST', redirect: 'manual',
    headers: { origin: BASE, 'content-type': 'application/x-www-form-urlencoded', cookie },
    body: felder instanceof URLSearchParams ? felder : new URLSearchParams(felder),
  });

let fehler = 0;
function pruefe(name, ist, soll) {
  const ok = ist === soll;
  if (!ok) fehler++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  (ist=${ist}, soll=${soll})`}`);
}
function pruefeWahr(name, bed, info) {
  if (!bed) fehler++;
  console.log(`${bed ? 'PASS' : 'FAIL'}  ${name}${bed ? '' : `  ${info ?? ''}`}`);
}

// 1. Verwaltung: Anna zusaetzlich Rolle "ausgabe" geben
const vform = new URLSearchParams([
  ['mitglied', anna.id], ['mitgliedsnummer', 'M-101'], ['geburtsdatum', '1988-02-14'],
  ['rollen', 'mitglied'], ['rollen', 'ausgabe'],
]);
const vloc = (await post('/mitglieder/verwaltung/speichern', vform)).headers.get('location') ?? '';
pruefeWahr('Verwaltung speichern -> ok', vloc.includes('ok=1'), vloc);
const annaNeu = await pb.collection('users').getOne(anna.id);
pruefeWahr('Anna hat jetzt Rolle ausgabe', (annaNeu.rollen ?? []).includes('ausgabe'));
// zuruecksetzen
await pb.collection('users').update(anna.id, { rollen: ['mitglied'] });

// 2. Vermehrung: 7 Samen ok, +1 Samen ueber Limit
pruefeWahr('Vermehrung 7 Samen -> ok', (await post('/mitglieder/vermehrung/buchen', { mitglied: anna.id, art: 'samen', anzahl: '7' })).headers.get('location').includes('ok=1'));
pruefeWahr('Vermehrung +1 Samen -> Monatsgrenze', (await post('/mitglieder/vermehrung/buchen', { mitglied: anna.id, art: 'samen', anzahl: '1' })).headers.get('location').includes('Monatsgrenze'));
pruefeWahr('Vermehrung 5 Stecklinge -> ok', (await post('/mitglieder/vermehrung/buchen', { mitglied: anna.id, art: 'stecklinge', anzahl: '5' })).headers.get('location').includes('ok=1'));

// 2b. Vermehrung: Samen UND Stecklinge in EINEM Vorgang (Doppel-Felder)
const bengt = await pb.collection('users').getFirstListItem('mitgliedsnummer="M-102"');
for (const v of await pb.collection('vermehrung_ausgaben').getFullList({ filter: `mitglied="${bengt.id}" && monat="${monat}"` })) {
  await pb.collection('vermehrung_ausgaben').delete(v.id);
}
const dualLoc = (await post('/mitglieder/vermehrung/buchen', { mitglied: bengt.id, anzahl_samen: '3', anzahl_stecklinge: '2' })).headers.get('location') ?? '';
pruefeWahr('Dual (3 Samen + 2 Stecklinge) -> ok', dualLoc.includes('ok=1'), dualLoc);
const bengtSaetze = await pb.collection('vermehrung_ausgaben').getFullList({ filter: `mitglied="${bengt.id}" && monat="${monat}"` });
pruefe('Dual: 2 Zeilen gebucht', bengtSaetze.length, 2);
pruefeWahr('Dual: gemeinsame Belegnr', bengtSaetze.length === 2 && bengtSaetze[0].belegnr === bengtSaetze[1].belegnr);
// Alles-oder-nichts: Stecklinge wuerden Limit reissen -> auch Samen NICHT gebucht.
const dualFehlLoc = (await post('/mitglieder/vermehrung/buchen', { mitglied: bengt.id, anzahl_samen: '2', anzahl_stecklinge: '4' })).headers.get('location') ?? '';
pruefeWahr('Dual ueber Limit -> Fehlermeldung Stecklinge', decodeURIComponent(dualFehlLoc).includes('Stecklinge'), dualFehlLoc);
const nachher = await pb.collection('vermehrung_ausgaben').getFullList({ filter: `mitglied="${bengt.id}" && monat="${monat}"` });
pruefe('Dual ueber Limit: nichts gebucht (weiter 2 Zeilen)', nachher.length, 2);

// 3. Jahresmeldung: Seite laedt (200)
const jm = await fetch(`${BASE}/mitglieder/jahresmeldung`, { headers: { origin: BASE, cookie }, redirect: 'manual' });
pruefe('Jahresmeldung Seite -> 200', jm.status, 200);

// 4. ZPL-Druck (Datei-Fallback, kein Drucker konfiguriert)
const letzte = await pb.collection('ausgaben').getList(1, 1, { sort: '-created' });
if (letzte.items.length) {
  const r = await post(`/mitglieder/ausgabe/beleg/${letzte.items[0].id}/drucken`, {});
  const body = await r.text();
  pruefe('ZPL-Druck -> 200', r.status, 200);
  pruefeWahr('ZPL-Antwort ist ZPL (^XA)', body.startsWith('^XA'));
  pruefeWahr('ZPL als Download geliefert', (r.headers.get('content-disposition') ?? '').includes('.zpl'));
} else {
  console.log('(keine Abgabe fuer ZPL-Test vorhanden)');
}

console.log(`\n${fehler === 0 ? 'HTTP-E2E ERWEITERUNGEN BESTANDEN' : fehler + ' FEHLGESCHLAGEN'}`);
process.exit(fehler ? 1 : 0);
