// E2E der Verfahrensbibliothek + Helferplan-Verzahnung:
//  - Anleitungen-Seite lesbar fuer normales Mitglied (inkl. rollen-beschraenkter SOPs)
//  - Rollen-Gate: Mitglied ohne Rolle darf sich nicht in anbau-Dienst eintragen
//  - Erste Uebernahme eines Dienstes -> "erstesmal"-Hinweis mit Anleitung
// Voraussetzung: PB + astro dev laufen, Seeds (inkl. seed-anleitungen) eingespielt.
import PocketBase from 'pocketbase';

const BASE = process.env.APP_URL ?? 'http://127.0.0.1:4321';
const PB_URL = process.env.PB_URL ?? 'http://127.0.0.1:8090';
const ADMIN = process.env.PB_ADMIN_EMAIL ?? 'admin@goerlitz.local';
const ADMIN_PW = process.env.PB_ADMIN_PW ?? 'change-me-admin';
const DUMMY_PW = process.env.PB_DUMMY_PW ?? 'DummyDemo2026!';
const ANBAU = process.env.PB_ANBAU_EMAIL ?? 'anbau@example.local';
const ANBAU_PW = process.env.PB_ANBAU_PW ?? 'change-me-anbau';

const pb = new PocketBase(PB_URL);
pb.autoCancellation(false);
await pb.collection('_superusers').authWithPassword(ADMIN, ADMIN_PW);

const beschneiden = await pb.collection('helferdienste').getFirstListItem('titel="Beschneiden und Pflege"');
const giessen = await pb.collection('helferdienste').getFirstListItem('titel="Gießen"');
const eva = await pb.collection('users').getFirstListItem('mitgliedsnummer="M-105"');

// Deterministisch: alte Eintragungen der Test-Nutzer loeschen (Eva + Anbau).
const anbauUser = await pb.collection('users').getFirstListItem(`email="${ANBAU}"`);
for (const uid of [eva.id, anbauUser.id]) {
  for (const e of await pb.collection('helfer_eintragungen').getFullList({ filter: `mitglied="${uid}"` })) {
    await pb.collection('helfer_eintragungen').delete(e.id);
  }
}

async function anmelden(email, pw) {
  const r = await fetch(`${BASE}/mitglieder/anmelden`, {
    method: 'POST', redirect: 'manual',
    headers: { origin: BASE, 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ email, passwort: pw }),
  });
  return (r.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).find((c) => c.startsWith('pb_token='));
}
const eintragen = (cookie, dienst, datum) =>
  fetch(`${BASE}/mitglieder/helferplan/eintragen`, {
    method: 'POST', redirect: 'manual',
    headers: { origin: BASE, 'content-type': 'application/x-www-form-urlencoded', cookie },
    body: new URLSearchParams({ dienst, datum }),
  }).then((r) => r.headers.get('location') ?? '');

let fehler = 0;
function pruefe(name, bed, info) {
  if (!bed) fehler++;
  console.log(`${bed ? 'PASS' : 'FAIL'}  ${name}${bed ? '' : `  ${info ?? ''}`}`);
}

// 1. Als einfaches Mitglied (Eva): Bibliothek lesbar, auch rollen-beschraenkte SOPs
const evaCookie = await anmelden(eva.email, DUMMY_PW);
if (!evaCookie) { console.log('LOGIN Eva fehlgeschlagen'); process.exit(1); }
const seite = await fetch(`${BASE}/mitglieder/anleitungen`, { headers: { origin: BASE, cookie: evaCookie } });
const html = await seite.text();
pruefe('Anleitungen-Seite -> 200', seite.status === 200, String(seite.status));
pruefe('SOP "Bestand wiegen" fuer Mitglied lesbar', html.includes('Bestand wiegen'));
pruefe('Rollen-Badge sichtbar (nur Anbau-Team)', html.includes('Anbau-Team'));

// 2. Rollen-Gate: Eva (nur mitglied) in anbau-Dienst -> abgelehnt
const gateLoc = await eintragen(evaCookie, beschneiden.id, '2027-01-07');
pruefe('Eva in Beschneiden (anbau) -> fehler=rolle', gateLoc.includes('fehler=rolle'), gateLoc);

// 3. Erste Uebernahme: Eva in Giessen (frei) -> ok + erstesmal-Hinweis
const ersteLoc = await eintragen(evaCookie, giessen.id, '2027-01-05');
pruefe('Eva in Giessen -> ok', ersteLoc.includes('ok=1'), ersteLoc);
pruefe('Erste Uebernahme -> erstesmal-Param', ersteLoc.includes(`erstesmal=${giessen.id}`), ersteLoc);
// Der Helferplan zeigt daraufhin den Anleitungs-Kasten:
const planHtml = await (await fetch(`${BASE}${ersteLoc}`, { headers: { origin: BASE, cookie: evaCookie } })).text();
pruefe('Helferplan zeigt Erste-Mal-Kasten mit Anleitung', planHtml.includes('zum ersten Mal'), '');
// 4. Zweite Uebernahme (anderer Tag) -> ok OHNE erstesmal
const zweiteLoc = await eintragen(evaCookie, giessen.id, '2027-01-06');
pruefe('Zweite Uebernahme -> ohne erstesmal', zweiteLoc.includes('ok=1') && !zweiteLoc.includes('erstesmal'), zweiteLoc);

// 5. Anbau-User darf in den anbau-Dienst
const anbauCookie = await anmelden(ANBAU, ANBAU_PW);
const anbauLoc = await eintragen(anbauCookie, beschneiden.id, '2027-01-07');
pruefe('Anbau-User in Beschneiden -> ok', anbauLoc.includes('ok=1'), anbauLoc);

// 6. Pflege-Oberflaeche: Vorstand legt eine Anleitung an, Mitglied darf nicht
const STAFF = process.env.PB_STAFF_EMAIL ?? 'ausgabe@example.local'; // rollen: vorstand
const STAFF_PW = process.env.PB_STAFF_PW ?? 'change-me-staff';
const vorstandCookie = await anmelden(STAFF, STAFF_PW);
// Alte Testanleitung aufraeumen (idempotent)
try {
  const alt = await pb.collection('anleitungen').getFirstListItem('titel="E2E-Testanleitung"');
  await pb.collection('anleitungen').delete(alt.id);
} catch { /* nicht vorhanden */ }
const speichern = (cookie, felder) =>
  fetch(`${BASE}/mitglieder/anleitungen/speichern`, {
    method: 'POST', redirect: 'manual',
    headers: { origin: BASE, 'content-type': 'application/x-www-form-urlencoded', cookie },
    body: new URLSearchParams(felder),
  }).then((r) => r.headers.get('location') ?? '');
const neuLoc = await speichern(vorstandCookie, {
  titel: 'E2E-Testanleitung', kategorie: 'allgemein', zweck: 'Test',
  schritte: 'Schritt eins\nSchritt zwei', hinweise: '', benoetigte_rolle: '', aktiv: 'on',
});
pruefe('Vorstand legt Anleitung an -> Bibliothek', neuLoc.includes('/mitglieder/anleitungen?a='), neuLoc);
const neuId = neuLoc.split('a=')[1]?.split('#')[0];
const gespeichert = neuId ? await pb.collection('anleitungen').getOne(neuId) : null;
pruefe('Anleitung in DB mit 2 Schritten', gespeichert?.schritte === 'Schritt eins\nSchritt zwei', gespeichert?.schritte);
// Bearbeiten: Titel aendern + deaktivieren
const editLoc = await speichern(vorstandCookie, {
  id: neuId, titel: 'E2E-Testanleitung', kategorie: 'allgemein', zweck: 'Test',
  schritte: 'Nur noch ein Schritt', hinweise: 'Wichtig!', benoetigte_rolle: 'anbau',
});
pruefe('Vorstand bearbeitet Anleitung -> ok', editLoc.includes(`a=${neuId}`), editLoc);
const nachEdit = await pb.collection('anleitungen').getOne(neuId);
pruefe('Bearbeitung gespeichert (inaktiv + anbau)', nachEdit.aktiv === false && nachEdit.benoetigte_rolle === 'anbau', JSON.stringify({ aktiv: nachEdit.aktiv, rolle: nachEdit.benoetigte_rolle }));
// Einfaches Mitglied darf NICHT speichern
const evaSpeichern = await speichern(evaCookie, { titel: 'Boese', kategorie: 'allgemein', schritte: 'x' });
pruefe('Mitglied darf nicht anlegen -> keinzugriff', evaSpeichern.includes('keinzugriff'), evaSpeichern);
// Aufraeumen
await pb.collection('anleitungen').delete(neuId);

console.log(`\n${fehler === 0 ? 'HTTP-E2E ANLEITUNGEN BESTANDEN' : fehler + ' FEHLGESCHLAGEN'}`);
process.exit(fehler ? 1 : 0);
