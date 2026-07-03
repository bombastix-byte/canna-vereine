// E2E: Mandats-Pflege in der Verwaltung + SEPA-Datei-Erzeugung, plus die
// "SMTP nicht konfiguriert"-Pfade (lokal ist kein SMTP gesetzt -> Ablaeufe
// laufen trotzdem, Aufnahme zeigt Startpasswort).
import PocketBase from 'pocketbase';

const BASE = process.env.APP_URL ?? 'http://127.0.0.1:4321';
const PB_URL = process.env.PB_URL ?? 'http://127.0.0.1:8090';
const ADMIN = process.env.PB_ADMIN_EMAIL ?? 'admin@goerlitz.local';
const ADMIN_PW = process.env.PB_ADMIN_PW ?? 'change-me-admin';
const STAFF = process.env.PB_STAFF_EMAIL ?? 'ausgabe@example.local'; // vorstand
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
const anmelden = async (email, pw) => {
  const r = await fetch(`${BASE}/mitglieder/anmelden`, {
    method: 'POST', redirect: 'manual',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ email, passwort: pw }),
  });
  return (r.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).find((c) => c.startsWith('pb_token='));
};
const post = (pfad, felder, cookie, raw = false) =>
  fetch(`${BASE}${pfad}`, {
    method: 'POST', redirect: 'manual',
    headers: { 'content-type': 'application/x-www-form-urlencoded', cookie },
    body: felder instanceof URLSearchParams ? felder : new URLSearchParams(felder),
  });

const vorstand = await anmelden(STAFF, STAFF_PW);
const anna = await pb.collection('users').getFirstListItem('mitgliedsnummer="M-101"');

// --- Mandat in der Verwaltung speichern ---
const form = new URLSearchParams([
  ['mitglied', anna.id], ['mitgliedsnummer', 'M-101'], ['geburtsdatum', '1988-02-14'],
  ['beitrag_monatlich', '15'], ['iban', 'de89 3704 0044 0532 0130 00'], ['bic', 'cobadeffxxx'],
  ['mandatsref', 'MANDAT-M-101'], ['mandatsdatum', '2026-05-01'], ['rollen', 'mitglied'],
]);
const saveLoc = (await post('/mitglieder/verwaltung/speichern', form, vorstand)).headers.get('location') ?? '';
pruefe('Mandat speichern -> ok', saveLoc.includes('ok=1'), saveLoc);
const annaNeu = await pb.collection('users').getOne(anna.id);
pruefe('IBAN normalisiert gespeichert', annaNeu.iban === 'DE89370400440532013000', annaNeu.iban);
pruefe('Beitrag gespeichert', annaNeu.beitrag_monatlich === 15);
pruefe('Mandatsref gespeichert', annaNeu.mandatsref === 'MANDAT-M-101');

// --- Beitraege-Seite laedt ---
const seite = await fetch(`${BASE}/mitglieder/beitraege`, { headers: { cookie: vorstand } });
const html = await seite.text();
pruefe('Beitraege-Seite -> 200', seite.status === 200, String(seite.status));
pruefe('Mit-Mandat-Zaehler zeigt >=1', /Mit Mandat[\s\S]{0,80}[1-9]/.test(html));

// --- SEPA-Datei erzeugen ---
const r = await fetch(`${BASE}/mitglieder/beitraege/sepa`, {
  method: 'POST', redirect: 'manual',
  headers: { 'content-type': 'application/x-www-form-urlencoded', cookie: vorstand },
  body: new URLSearchParams({ ausfuehrungsdatum: '2026-08-01', seq_typ: 'RCUR', verwendungszweck: 'Mitgliedsbeitrag 2026-08' }),
});
const hasGlaeubiger = !!process.env.SEPA_GLAEUBIGER_IBAN;
if (hasGlaeubiger) {
  const xml = await r.text();
  pruefe('SEPA-Datei -> XML 200', r.status === 200 && (r.headers.get('content-type') ?? '').includes('xml'), String(r.status));
  pruefe('SEPA-Datei enthaelt pain.008 + Anna-IBAN', xml.includes('pain.008.001.02') && xml.includes('DE89370400440532013000'));
} else {
  // Ohne Glaeubiger-Env: sauber auf die Seite mit Fehlerhinweis leiten.
  pruefe('Ohne Glaeubiger -> Redirect mit Fehler', (r.headers.get('location') ?? '').includes('fehler=glaeubiger'), r.headers.get('location'));
}

// --- Rollen-Gate ---
const eva = await anmelden('eva@dummy.local', DUMMY_PW);
const evaR = await fetch(`${BASE}/mitglieder/beitraege`, { headers: { cookie: eva }, redirect: 'manual' });
pruefe('Beitraege als Mitglied -> blockiert', evaR.status === 303, String(evaR.status));
const evaSepa = await fetch(`${BASE}/mitglieder/beitraege/sepa`, { method: 'POST', headers: { cookie: eva, 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ ausfuehrungsdatum: '2026-08-01' }), redirect: 'manual' });
pruefe('SEPA-Export als Mitglied -> blockiert', (evaSepa.headers.get('location') ?? '').includes('keinzugriff'));

// --- Testmail-Endpoint (ohne SMTP -> testmail_aus, kein Crash) ---
const testmail = (await post('/mitglieder/antraege/testmail', {}, vorstand)).headers.get('location') ?? '';
pruefe('Testmail-Endpoint reagiert sauber', testmail.includes('ok=testmail'), testmail);

console.log(`\n${fehler === 0 ? 'HTTP-E2E SEPA/MAIL BESTANDEN' : fehler + ' FEHLGESCHLAGEN'}`);
process.exit(fehler ? 1 : 0);
