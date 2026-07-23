// E2E des "Augenhoehe-Pakets": Beitrittsantrag (oeffentlich) + Aufnahme,
// Transportbescheinigung, Labor-Upload, CSV-Exporte, Tresen-Schnellauswahl,
// Beitrag-Hinweis, Mitgliedsausweis.
import PocketBase from 'pocketbase';

const BASE = process.env.APP_URL ?? 'http://127.0.0.1:4321';
const PB_URL = process.env.PB_URL ?? 'http://127.0.0.1:8090';
const ADMIN = process.env.PB_ADMIN_EMAIL ?? 'admin@goerlitz.local';
const ADMIN_PW = process.env.PB_ADMIN_PW ?? 'change-me-admin';
const STAFF = process.env.PB_STAFF_EMAIL ?? 'ausgabe@example.local';
const STAFF_PW = process.env.PB_STAFF_PW ?? 'change-me-staff';
const DUMMY_PW = process.env.PB_DUMMY_PW ?? 'DummyDemo2026!';

const pb = new PocketBase(PB_URL);
pb.autoCancellation(false);
await pb.collection('_superusers').authWithPassword(ADMIN, ADMIN_PW);

let fehler = 0;
function pruefe(name, bed, info) {
  if (!bed) fehler++;
  console.log(`${bed ? 'PASS' : 'FAIL'}  ${name}${bed ? '' : `  ${info ?? ''}`}`);
}
async function anmelden(email, pw) {
  const r = await fetch(`${BASE}/mitglieder/anmelden`, {
    method: 'POST', redirect: 'manual',
    headers: { origin: BASE, 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ email, passwort: pw }),
  });
  return (r.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).find((c) => c.startsWith('pb_token='));
}
const post = (pfad, felder, cookie) =>
  fetch(`${BASE}${pfad}`, {
    method: 'POST', redirect: 'manual',
    headers: { origin: BASE, 'content-type': 'application/x-www-form-urlencoded', ...(cookie ? { cookie } : {}) },
    body: new URLSearchParams(felder),
  });

// Aufraeumen: alte Testdaten
for (const a of await pb.collection('antraege').getFullList()) await pb.collection('antraege').delete(a.id);
try {
  const altUser = await pb.collection('users').getFirstListItem('email="antrag-test@dummy.local"');
  await pb.collection('users').delete(altUser.id);
} catch { /* ok */ }

// ---------- 1. Beitrittsantrag ----------
// Ohne oeffentlichen Web-Auftritt (site.oeffentlich=false) ist der oeffentliche
// Antrags-Endpoint deaktiviert (404, Beitritt laeuft ueber Papierformulare);
// der Antrag wird dann direkt angelegt. Mit Web-Auftritt bleibt der oeffent-
// liche Weg getestet.
const absenden = await post('/mitglied-werden/absenden', {
  name: 'Toni Test', email: 'antrag-test@dummy.local', geburtsdatum: '1999-04-04',
  telefon: '0123', nachricht: 'Hallo', website: '',
});
const oeffentlichAus = absenden.status === 404;
if (oeffentlichAus) {
  pruefe('Antrags-Endpoint deaktiviert (kein Web-Auftritt)', absenden.status === 404, String(absenden.status));
  await pb.collection('antraege').create({
    name: 'Toni Test', email: 'antrag-test@dummy.local', telefon: '0123',
    geburtsdatum: '1999-04-04', nachricht: 'Hallo', status: 'offen', notiz: '',
  });
  pruefe('Antrag in DB (Status offen)', (await pb.collection('antraege').getFullList({ filter: 'status="offen"' })).length === 1);
} else {
  pruefe('Antrag (oeffentlich) -> ok', (absenden.headers.get('location') ?? '').includes('ok=1'));
  pruefe('Antrag in DB (Status offen)', (await pb.collection('antraege').getFullList({ filter: 'status="offen"' })).length === 1);
  // Honeypot: gefuellt -> ok angezeigt, aber NICHT gespeichert
  await post('/mitglied-werden/absenden', { name: 'Bot', email: 'bot@x.de', geburtsdatum: '1990-01-01', website: 'spam' });
  pruefe('Honeypot: Bot-Antrag NICHT gespeichert', (await pb.collection('antraege').getFullList()).length === 1);
  // Minderjaehrig -> abgelehnt
  const jung = await post('/mitglied-werden/absenden', { name: 'Kind', email: 'kind@x.de', geburtsdatum: '2015-01-01', website: '' });
  pruefe('Unter 18 -> fehler=alter', (jung.headers.get('location') ?? '').includes('fehler=alter'));
}

// ---------- 2. Vorstand: Warteliste + Aufnahme ----------
const vorstand = await anmelden(STAFF, STAFF_PW);
const antrag = await pb.collection('antraege').getFirstListItem('email="antrag-test@dummy.local"');
await post('/mitglieder/antraege/aktion', { antrag: antrag.id, aktion: 'warteliste' }, vorstand);
pruefe('Auf Warteliste gesetzt', (await pb.collection('antraege').getOne(antrag.id)).status === 'warteliste');
const aufLoc = (await post('/mitglieder/antraege/aktion', { antrag: antrag.id, aktion: 'aufnehmen' }, vorstand)).headers.get('location') ?? '';
pruefe('Aufnehmen -> ok mit Startpasswort', aufLoc.includes('ok=aufgenommen') && aufLoc.includes('pw='), aufLoc);
const neuesMitglied = await pb.collection('users').getFirstListItem('email="antrag-test@dummy.local"');
pruefe('Mitgliedskonto angelegt (M-Nummer, Rolle mitglied)', /^M-\d+$/.test(neuesMitglied.mitgliedsnummer) && (neuesMitglied.rollen ?? []).includes('mitglied'), neuesMitglied.mitgliedsnummer);

// ---------- 3. Transportbescheinigung ----------
const charge = await pb.collection('chargen').getFirstListItem('status="freigegeben"');
const anbau = await anmelden(process.env.PB_ANBAU_EMAIL ?? 'anbau@example.local', process.env.PB_ANBAU_PW ?? 'change-me-anbau');
const tLoc = (await post('/mitglieder/wawi/transport', {
  charge: charge.id, menge_gramm: '50', von: 'Anbauraum 1', nach: 'Ausgabestelle Vereinsheim', zweck: 'Umlagerung',
}, anbau)).headers.get('location') ?? '';
pruefe('Transport -> Bescheinigungs-Seite', tLoc.includes('/mitglieder/wawi/transport/'), tLoc);
const tSeite = await fetch(`${BASE}${tLoc}`, { headers: { origin: BASE, cookie: anbau } });
const tHtml = await tSeite.text();
pruefe('Bescheinigung 200 + Paragraf 22', tSeite.status === 200 && tHtml.includes('22'), String(tSeite.status));
const verfNachher = (await pb.collection('chargen').getOne(charge.id)).verfuegbar_g;
pruefe('Transport aendert Bestand NICHT', verfNachher === charge.verfuegbar_g, `${charge.verfuegbar_g} -> ${verfNachher}`);

// ---------- 4. Labor: Datei + Link ----------
const fd = new FormData();
fd.set('charge', charge.id);
fd.set('coa', new File(['%PDF-1.4 test'], 'coa-test.pdf', { type: 'application/pdf' }));
fd.set('testergebnis_url', 'https://beispiel-messapp.de/probe/123');
const labor = await fetch(`${BASE}/mitglieder/wawi/labor`, { method: 'POST', redirect: 'manual', headers: { origin: BASE, cookie: anbau }, body: fd });
pruefe('Labor-Upload -> ok', (labor.headers.get('location') ?? '').includes('ok=labor'));
const chargeNach = await pb.collection('chargen').getOne(charge.id);
pruefe('COA-Datei an Charge', !!chargeNach.coa, chargeNach.coa);
pruefe('Testergebnis-Link an Charge', chargeNach.testergebnis_url === 'https://beispiel-messapp.de/probe/123');

// ---------- 5. CSV-Exporte ----------
for (const art of ['jahresmeldung', 'abgaben', 'vernichtungen', 'transporte']) {
  const r = await fetch(`${BASE}/mitglieder/exporte/${art}?jahr=2026`, { headers: { origin: BASE, cookie: vorstand } });
  const text = await r.text();
  pruefe(`Export ${art} -> CSV`, r.status === 200 && (r.headers.get('content-type') ?? '').includes('csv') && text.length > 10, String(r.status));
}
// Mitglied darf nicht exportieren
const evaCookie = await anmelden('eva@dummy.local', DUMMY_PW);
const evaExp = await fetch(`${BASE}/mitglieder/exporte/abgaben`, { headers: { origin: BASE, cookie: evaCookie }, redirect: 'manual' });
pruefe('Export als Mitglied -> blockiert', evaExp.status === 303);

// ---------- 6. Tresen-Schnellauswahl + Beitrag-Hinweis ----------
const tresenNr = await (await fetch(`${BASE}/mitglieder/ausgabe?nr=M-101`, { headers: { origin: BASE, cookie: vorstand } })).text();
pruefe('Tresen ?nr=M-101 waehlt Anna', tresenNr.includes('Anna Berg') && tresenNr.includes('Darf jetzt noch'));
pruefe('Beitrag-Hinweis (kein Eintrag)', tresenNr.includes('Beitragsstatus'));
const tresenFalsch = await (await fetch(`${BASE}/mitglieder/ausgabe?nr=M-999`, { headers: { origin: BASE, cookie: vorstand } })).text();
pruefe('Tresen ?nr=M-999 -> nicht gefunden', tresenFalsch.includes('nicht gefunden'));

// ---------- 7. Mitgliedsausweis ----------
const ausweis = await (await fetch(`${BASE}/mitglieder/ausweis`, { headers: { origin: BASE, cookie: evaCookie } })).text();
pruefe('Ausweis zeigt QR (svg) + Nummer', ausweis.includes('<svg') && ausweis.includes('M-105'));

console.log(`\n${fehler === 0 ? 'HTTP-E2E AUGENHOEHE BESTANDEN' : fehler + ' FEHLGESCHLAGEN'}`);
process.exit(fehler ? 1 : 0);
