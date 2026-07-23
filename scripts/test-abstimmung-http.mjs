// E2E: Abstimmungen (anlegen als Vorstand, abstimmen als zwei Mitglieder,
// eine Stimme pro Person garantiert, Ergebnis-Zaehlung, schliessen) und
// QR-Etiketten je Pflanze (Seite + ZPL-Download).
import PocketBase from 'pocketbase';

const BASE = process.env.APP_URL ?? 'http://127.0.0.1:4321';
const PB_URL = process.env.PB_URL ?? 'http://127.0.0.1:8090';
const ADMIN = process.env.PB_ADMIN_EMAIL ?? 'admin@goerlitz.local';
const ADMIN_PW = process.env.PB_ADMIN_PW ?? 'change-me-admin';
const STAFF = process.env.PB_STAFF_EMAIL ?? 'ausgabe@example.local'; // vorstand
const STAFF_PW = process.env.PB_STAFF_PW ?? 'change-me-staff';
const DUMMY_PW = process.env.PB_DUMMY_PW ?? 'DummyDemo2026!';
const ANBAU = process.env.PB_ANBAU_EMAIL ?? 'anbau@example.local';
const ANBAU_PW = process.env.PB_ANBAU_PW ?? 'change-me-anbau';

const pb = new PocketBase(PB_URL);
pb.autoCancellation(false);
await pb.collection('_superusers').authWithPassword(ADMIN, ADMIN_PW);

let fehler = 0;
function pruefe(name, ist, soll) {
  const ok = ist === soll;
  if (!ok) fehler++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  (ist=${ist}, soll=${soll})`}`);
}
function pruefeWahr(name, bed, info) { if (!bed) fehler++; console.log(`${bed ? 'PASS' : 'FAIL'}  ${name}${bed ? '' : `  ${info ?? ''}`}`); }
const anmelden = async (email, pw) => {
  const r = await fetch(`${BASE}/mitglieder/anmelden`, { method: 'POST', redirect: 'manual', headers: { origin: BASE, 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ email, passwort: pw }) });
  return (r.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).find((c) => c.startsWith('pb_token='));
};
const post = (pfad, felder, cookie) => fetch(`${BASE}${pfad}`, { method: 'POST', redirect: 'manual', headers: { origin: BASE, 'content-type': 'application/x-www-form-urlencoded', cookie }, body: new URLSearchParams(felder) });

// Aufraeumen
for (const a of await pb.collection('abstimmungen').getFullList({ filter: 'titel~"E2E-Abstimmung"' })) await pb.collection('abstimmungen').delete(a.id);

// --- 1. Vorstand legt Abstimmung an ---
const vorstand = await anmelden(STAFF, STAFF_PW);
const neuLoc = (await post('/mitglieder/abstimmungen/neu', { titel: 'E2E-Abstimmung', beschreibung: 'Test', optionen: 'Apfel\nBirne\nKirsche', ende: '' }, vorstand)).headers.get('location') ?? '';
pruefeWahr('Abstimmung anlegen -> ok', neuLoc.includes('ok=neu'), neuLoc);
const ab = await pb.collection('abstimmungen').getFirstListItem('titel="E2E-Abstimmung"');
pruefe('3 Optionen gespeichert', Array.isArray(ab.optionen) ? ab.optionen.length : 0, 3);
// zu wenige Optionen -> Fehler
pruefeWahr('Nur 1 Option -> fehler=optionen', ((await post('/mitglieder/abstimmungen/neu', { titel: 'E2E-Abstimmung X', optionen: 'nur eine' }, vorstand)).headers.get('location') ?? '').includes('fehler=optionen'));

// --- 2. Zwei Mitglieder stimmen ab ---
const eva = await anmelden('eva@dummy.local', DUMMY_PW);
const anbau = await anmelden(ANBAU, ANBAU_PW);
for (const c of await pb.collection('stimmen').getFullList({ filter: `abstimmung="${ab.id}"` })) await pb.collection('stimmen').delete(c.id);
pruefeWahr('Eva stimmt (Birne) -> ok', ((await post('/mitglieder/abstimmungen/stimme', { abstimmung: ab.id, option_index: '1' }, eva)).headers.get('location') ?? '').includes('ok=1'));
pruefeWahr('Anbau stimmt (Birne) -> ok', ((await post('/mitglieder/abstimmungen/stimme', { abstimmung: ab.id, option_index: '1' }, anbau)).headers.get('location') ?? '').includes('ok=1'));
// zweite Stimme derselben Person -> abgelehnt (Unique-Index)
pruefeWahr('Eva erneut -> fehler=schon', ((await post('/mitglieder/abstimmungen/stimme', { abstimmung: ab.id, option_index: '0' }, eva)).headers.get('location') ?? '').includes('fehler=schon'));
// direkte API-Zweitstimme (Ballot-Stuffing) muss der DB-Index blocken
const evaUser = await pb.collection('users').getFirstListItem('mitgliedsnummer="M-105"');
let stuffBlocked = false;
try {
  const evaPb = new PocketBase(PB_URL);
  await evaPb.collection('users').authWithPassword('eva@dummy.local', DUMMY_PW);
  await evaPb.collection('stimmen').create({ abstimmung: ab.id, mitglied: evaUser.id, option_index: 2 });
} catch { stuffBlocked = true; }
pruefeWahr('Direkte API-Zweitstimme blockiert (Unique-Index)', stuffBlocked);
pruefe('Gesamt genau 2 Stimmen', (await pb.collection('stimmen').getFullList({ filter: `abstimmung="${ab.id}"` })).length, 2);

// Ergebnis auf der Seite (Eva hat abgestimmt -> sieht Ergebnis)
const html = await (await fetch(`${BASE}/mitglieder/abstimmungen`, { headers: { origin: BASE, cookie: eva } })).text();
pruefeWahr('Ergebnis zeigt 2 Stimmen', html.includes('2 Stimmen'));

// --- 3. Schliessen (Vorstand) + Abstimmen danach gesperrt ---
pruefeWahr('Schliessen -> ok', ((await post('/mitglieder/abstimmungen/status', { abstimmung: ab.id, status: 'geschlossen' }, vorstand)).headers.get('location') ?? '').includes('ok=status'));
const greta = await anmelden('greta@dummy.local', DUMMY_PW);
pruefeWahr('Abstimmen nach Schliessen -> fehler=geschlossen', ((await post('/mitglieder/abstimmungen/stimme', { abstimmung: ab.id, option_index: '0' }, greta)).headers.get('location') ?? '').includes('fehler=geschlossen'));
// Mitglied darf keine Abstimmung anlegen
pruefeWahr('Mitglied anlegen -> keinzugriff', ((await post('/mitglieder/abstimmungen/neu', { titel: 'boese', optionen: 'a\nb' }, eva)).headers.get('location') ?? '').includes('keinzugriff'));
await pb.collection('abstimmungen').delete(ab.id);

// --- 4. QR-Etiketten je Pflanze ---
const charge = await pb.collection('chargen').getFirstListItem('status="anbau"', { sort: '-created' }).catch(() => null);
if (charge) {
  const anzahl = (await pb.collection('pflanzen').getFullList({ filter: `charge_ref="${charge.id}" && status!="vernichtet"` })).length;
  const seite = await fetch(`${BASE}/mitglieder/wawi/etiketten/${charge.id}`, { headers: { origin: BASE, cookie: anbau } });
  const shtml = await seite.text();
  pruefe('Etiketten-Seite -> 200', seite.status, 200);
  pruefeWahr('Etiketten-Seite zeigt QR (svg)', shtml.includes('<svg') && shtml.includes(charge.charge_nr));
  const zplR = await fetch(`${BASE}/mitglieder/wawi/etiketten/${charge.id}/zpl`, { method: 'POST', headers: { origin: BASE, cookie: anbau }, redirect: 'manual' });
  const zplBody = await zplR.text();
  pruefe('ZPL-Etiketten -> 200 Download', zplR.status, 200);
  pruefeWahr('ZPL enthaelt QR-Befehle', zplBody.includes('^BQN') && (zplBody.match(/\^XZ/g) ?? []).length === anzahl && anzahl > 0);
  // Rollen-Gate
  const evaEt = await fetch(`${BASE}/mitglieder/wawi/etiketten/${charge.id}`, { headers: { origin: BASE, cookie: eva }, redirect: 'manual' });
  pruefe('Etiketten als Mitglied -> blockiert', evaEt.status, 303);
} else {
  console.log('(keine Anbau-Charge fuer Etiketten-Test)');
}

console.log(`\n${fehler === 0 ? 'HTTP-E2E ABSTIMMUNG/ETIKETTEN BESTANDEN' : fehler + ' FEHLGESCHLAGEN'}`);
process.exit(fehler ? 1 : 0);
