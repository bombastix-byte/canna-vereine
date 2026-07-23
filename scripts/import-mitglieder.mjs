// Mitglieder aus einer CSV importieren. Legt je Zeile ein Konto an
// (Mitgliedsnummer + zufälliges Startpasswort) und schreibt einen Report mit
// den Startpasswörtern zum Weitergeben. Idempotent über die E-Mail: bereits
// vorhandene Konten werden ÜBERSPRUNGEN (nie überschrieben — schützt echte Daten).
//
//   node --env-file=.env scripts/import-mitglieder.mjs mitglieder.csv [--dry-run] [--report out.csv]
//
// Spalten (Kopfzeile, Reihenfolge egal, deutsche/englische Namen erkannt):
//   email (Pflicht) | vorname | nachname | name (voll, alternativ) |
//   geburtsdatum (YYYY-MM-DD oder TT.MM.JJJJ) | mitgliedsnummer (optional) |
//   rollen (mit ; getrennt, z. B. "anbau;ausgabe"; leer -> mitglied)
// Trennzeichen ; oder , wird automatisch erkannt.
import PocketBase from 'pocketbase';
import { readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';

const URL = process.env.PB_URL ?? 'http://127.0.0.1:8090';
const ADMIN = process.env.PB_ADMIN_EMAIL ?? 'admin@example.local';
const ADMIN_PW = process.env.PB_ADMIN_PW ?? 'change-me-admin';
const ROLLEN = ['mitglied', 'ausgabe', 'anbau', 'praevention', 'vorstand'];

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const reportIdx = args.indexOf('--report');
const reportPfad = reportIdx >= 0 ? args[reportIdx + 1] : 'import-report.csv';
const csvPfad = args.find((a) => !a.startsWith('--') && a !== reportPfad);
if (!csvPfad) {
  console.error('Aufruf: node --env-file=.env scripts/import-mitglieder.mjs <datei.csv> [--dry-run] [--report out.csv]');
  process.exit(1);
}

// --- winziger CSV-Parser (Anführungszeichen, Zeilenumbrüche in Feldern) ---
function parseCsv(text) {
  text = text.replace(/^﻿/, ''); // BOM
  const kopfzeile = text.split('\n')[0] ?? '';
  const trenn = (kopfzeile.match(/;/g) || []).length >= (kopfzeile.match(/,/g) || []).length ? ';' : ',';
  const rows = [];
  let feld = '', zeile = [], inQ = false;
  const push = () => { zeile.push(feld); feld = ''; };
  const pushZ = () => { push(); rows.push(zeile); zeile = []; };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"' && text[i + 1] === '"') { feld += '"'; i++; }
      else if (c === '"') inQ = false;
      else feld += c;
    } else if (c === '"') inQ = true;
    else if (c === trenn) push();
    else if (c === '\r') { /* ignorieren */ }
    else if (c === '\n') pushZ();
    else feld += c;
  }
  if (feld !== '' || zeile.length) pushZ();
  return rows.filter((r) => r.some((f) => f.trim() !== ''));
}

const alias = {
  vorname: ['vorname', 'first', 'firstname', 'first_name'],
  nachname: ['nachname', 'last', 'lastname', 'last_name'],
  name: ['name', 'fullname', 'vollername'],
  email: ['email', 'e-mail', 'mail'],
  geburtsdatum: ['geburtsdatum', 'geburt', 'geb', 'birthdate', 'dob'],
  mitgliedsnummer: ['mitgliedsnummer', 'mitgliedsnr', 'nummer', 'nr', 'member', 'memberid'],
  rollen: ['rollen', 'rolle', 'roles'],
};
function findeSpalten(kopf) {
  const norm = kopf.map((h) => h.trim().toLowerCase());
  const map = {};
  for (const [feld, aliase] of Object.entries(alias)) {
    const idx = norm.findIndex((h) => aliase.includes(h));
    if (idx >= 0) map[feld] = idx;
  }
  return map;
}
function normDatum(s) {
  s = (s || '').trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return `${m[1]}-${m[2]}-${m[3]} 00:00:00.000Z`;
  m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})/.exec(s);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')} 00:00:00.000Z`;
  return null;
}
function startpasswort() {
  const teil = () => randomBytes(3).toString('base64url').slice(0, 4);
  return `Start-${teil()}-${teil()}`;
}

const rows = parseCsv(readFileSync(csvPfad, 'utf8'));
if (rows.length < 2) { console.error('CSV enthält keine Datenzeilen.'); process.exit(1); }
const sp = findeSpalten(rows[0]);
if (sp.email === undefined) { console.error('Spalte "email" nicht gefunden. Kopfzeile prüfen.'); process.exit(1); }
const daten = rows.slice(1);
const wert = (r, feld) => (sp[feld] !== undefined ? (r[sp[feld]] ?? '').trim() : '');

const pb = new PocketBase(URL);
pb.autoCancellation(false);
await pb.collection('_superusers').authWithPassword(ADMIN, ADMIN_PW);
console.log(`Admin ok. ${daten.length} Zeilen in ${csvPfad}${dryRun ? ' (DRY-RUN)' : ''}.`);

let maxNr = 0;
const belegteNummern = new Set();
for (const u of await pb.collection('users').getFullList({ fields: 'mitgliedsnummer' })) {
  const nummer = String(u.mitgliedsnummer ?? '').trim().toUpperCase();
  if (nummer) belegteNummern.add(nummer);
  const m = /^M-(\d+)$/.exec(String(u.mitgliedsnummer ?? ''));
  if (m) maxNr = Math.max(maxNr, Number(m[1]));
}

const report = [['mitgliedsnummer', 'name', 'email', 'startpasswort', 'status']];
let angelegt = 0, uebersprungen = 0, fehler = 0;

for (const r of daten) {
  const email = wert(r, 'email').toLowerCase();
  if (!email || !email.includes('@')) { fehler++; report.push(['', '', email, '', 'ungültige E-Mail']); continue; }
  try {
    await pb.collection('users').getFirstListItem(`email="${email}"`);
    uebersprungen++; report.push(['', '', email, '', 'existiert bereits']); continue;
  } catch { /* frei */ }

  const vorname = wert(r, 'vorname');
  const nachname = wert(r, 'nachname');
  const name = wert(r, 'name') || [vorname, nachname].filter(Boolean).join(' ') || email;
  let nummer = wert(r, 'mitgliedsnummer').trim().toUpperCase();
  if (!nummer) {
    do nummer = 'M-' + String(++maxNr).padStart(3, '0');
    while (belegteNummern.has(nummer));
  }
  if (!/^[A-Z0-9][A-Z0-9-]{1,31}$/.test(nummer)) {
    fehler++; report.push([nummer, name, email, '', 'ungültige Mitgliedsnummer']); continue;
  }
  if (belegteNummern.has(nummer)) {
    fehler++; report.push([nummer, name, email, '', 'Mitgliedsnummer bereits vergeben']); continue;
  }
  const rollen = wert(r, 'rollen').split(';').map((x) => x.trim()).filter((x) => ROLLEN.includes(x));
  const pw = startpasswort();

  if (dryRun) {
    belegteNummern.add(nummer);
    angelegt++; report.push([nummer, name, email, pw, 'würde angelegt']); continue;
  }
  try {
    await pb.collection('users').create({
      email, password: pw, passwordConfirm: pw,
      name, vorname, nachname, mitgliedsnummer: nummer,
      geburtsdatum: normDatum(wert(r, 'geburtsdatum')),
      rollen: rollen.length ? rollen : ['mitglied'],
      mitglied_status: 'aktiv',
    });
    belegteNummern.add(nummer);
    angelegt++; report.push([nummer, name, email, pw, 'angelegt']);
  } catch (e) {
    fehler++; report.push([nummer, name, email, '', 'FEHLER: ' + (e?.message ?? e)]);
  }
}

const csvOut = report.map((z) => z.map((f) => `"${String(f).replace(/"/g, '""')}"`).join(';')).join('\n');
writeFileSync(reportPfad, '﻿' + csvOut, 'utf8');
console.log(`\nAngelegt: ${angelegt} · Übersprungen (schon da): ${uebersprungen} · Fehler: ${fehler}`);
console.log(`Report mit Startpasswörtern: ${reportPfad}  (vertraulich behandeln!)`);
if (dryRun) console.log('DRY-RUN — nichts geschrieben. Ohne --dry-run erneut ausführen.');
