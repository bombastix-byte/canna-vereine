// End-to-End-Test der Warenwirtschaft: meldet sich als Anbauverantwortliche(r)
// an und fuehrt eine Charge durch den ganzen Lebenszyklus - anlegen -> Ernte ->
// Freigabe -> Vernichtung - und prueft nach jedem Schritt den Zustand in der DB.
import PocketBase from 'pocketbase';

const BASE = process.env.APP_URL ?? 'http://127.0.0.1:4321';
const PB_URL = process.env.PB_URL ?? 'http://127.0.0.1:8090';
const ADMIN = process.env.PB_ADMIN_EMAIL ?? 'admin@goerlitz.local';
const ADMIN_PW = process.env.PB_ADMIN_PW ?? 'change-me-admin';
const ANBAU = process.env.PB_ANBAU_EMAIL ?? 'anbau@example.local';
const ANBAU_PW = process.env.PB_ANBAU_PW ?? 'change-me-anbau';

const pb = new PocketBase(PB_URL);
pb.autoCancellation(false);
await pb.collection('_superusers').authWithPassword(ADMIN, ADMIN_PW);
const sorteId = (await pb.collection('sorten').getFirstListItem('name="CBD Aurora"')).id;

const login = await fetch(`${BASE}/mitglieder/anmelden`, {
  method: 'POST', redirect: 'manual',
  headers: { origin: BASE, 'content-type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ email: ANBAU, passwort: ANBAU_PW }),
});
const cookie = (login.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).find((c) => c.startsWith('pb_token='));
if (!cookie) { console.log('LOGIN FEHLGESCHLAGEN', login.status); process.exit(1); }
console.log('Anbau angemeldet.\n');

const post = (pfad, felder) =>
  fetch(`${BASE}${pfad}`, {
    method: 'POST', redirect: 'manual',
    headers: { origin: BASE, 'content-type': 'application/x-www-form-urlencoded', cookie },
    body: new URLSearchParams(felder),
  });

let fehler = 0;
function pruefe(name, ist, soll) {
  const ok = ist === soll;
  if (!ok) fehler++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  (ist=${ist}, soll=${soll})`}`);
}

// 1. Charge anlegen
await post('/mitglieder/wawi/charge-neu', { sorte: sorteId, herkunft: 'Test-Stecklinge', pflanzenzahl: '10', anbau_start: '2026-05-01' });
const charge = await pb.collection('chargen').getFirstListItem('sorte_name="CBD Aurora" && status="anbau"', { sort: '-created' });
pruefe('Charge angelegt, Status anbau', charge.status, 'anbau');
const id = charge.id;

// 2. Ernte erfassen
await post('/mitglieder/wawi/aktion', { charge: id, aktion: 'ernte', frischgewicht_g: '1000', ernte_datum: '2026-06-20' });
let c = await pb.collection('chargen').getOne(id);
pruefe('Nach Ernte Status geerntet', c.status, 'geerntet');
pruefe('Frischgewicht gespeichert', c.frischgewicht_g, 1000);

// 3. Freigabe (Trocknung fertig)
await post('/mitglieder/wawi/aktion', { charge: id, aktion: 'freigabe', trockengewicht_g: '250', thc_prozent: '9', cbd_prozent: '8' });
c = await pb.collection('chargen').getOne(id);
pruefe('Nach Freigabe Status freigegeben', c.status, 'freigegeben');
pruefe('Verfuegbar = Trockengewicht (250)', c.verfuegbar_g, 250);

// 4. Vernichtung (50 g Schwund)
await post('/mitglieder/wawi/vernichten', { charge: id, menge_gramm: '50', grund: 'Trocknungsschwund', zeuge: 'Testzeuge' });
c = await pb.collection('chargen').getOne(id);
pruefe('Nach Vernichtung verfuegbar 200', c.verfuegbar_g, 200);
const vern = await pb.collection('vernichtungen').getFirstListItem(`charge_ref="${id}"`);
pruefe('Vernichtungssatz dokumentiert (50 g)', vern.menge_gramm, 50);
pruefe('Vernichtung mit Zeuge', vern.zeuge, 'Testzeuge');

console.log(`\n${fehler === 0 ? 'HTTP-E2E WARENWIRTSCHAFT BESTANDEN' : fehler + ' FEHLGESCHLAGEN'}`);
process.exit(fehler ? 1 : 0);
