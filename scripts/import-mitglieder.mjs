// Importiert Mitglieder aus einer CSV in PocketBase (idempotent, upsert per
// E-Mail). Spalten (Kopfzeile): mitgliedsnummer,name,email,geburtsdatum,rollen,passwort
//  - geburtsdatum: YYYY-MM-DD (leer erlaubt, aber fuer die U21-Regel noetig)
//  - rollen: mehrere mit ; getrennt, z. B. "anbau;ausgabe" (leer -> mitglied)
//  - passwort: leer -> Startpasswort "Start-<mitgliedsnummer>!" (dann aendern lassen)
// Aufruf:  node --env-file=.env scripts/import-mitglieder.mjs [pfad.csv]
import { readFileSync } from 'node:fs';
import PocketBase from 'pocketbase';
import { ROLLEN } from '../src/lib/rollen.ts';

const URL = process.env.PB_URL ?? 'http://127.0.0.1:8090';
const ADMIN = process.env.PB_ADMIN_EMAIL ?? 'admin@example.local';
const ADMIN_PW = process.env.PB_ADMIN_PW ?? 'change-me-admin';
const CSV = process.argv[2] ?? process.env.MITGLIEDER_CSV ?? 'data/mitglieder.csv';

// Kleiner CSV-Parser mit Anfuehrungszeichen-Unterstuetzung.
function parseCsv(text) {
  const rows = [];
  let feld = '', zeile = [], inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"' && text[i + 1] === '"') { feld += '"'; i++; }
      else if (c === '"') inQ = false;
      else feld += c;
    } else if (c === '"') inQ = true;
    else if (c === ',') { zeile.push(feld); feld = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      if (feld !== '' || zeile.length) { zeile.push(feld); rows.push(zeile); zeile = []; feld = ''; }
    } else feld += c;
  }
  if (feld !== '' || zeile.length) { zeile.push(feld); rows.push(zeile); }
  return rows;
}

const text = readFileSync(CSV, 'utf8');
const rows = parseCsv(text).filter((r) => r.some((z) => z.trim() !== ''));
if (rows.length < 2) { console.log('Keine Datenzeilen in', CSV); process.exit(1); }
const kopf = rows[0].map((h) => h.trim().toLowerCase());
const idx = (name) => kopf.indexOf(name);

const pb = new PocketBase(URL);
pb.autoCancellation(false);
await pb.collection('_superusers').authWithPassword(ADMIN, ADMIN_PW);
console.log('Admin authentifiziert. Quelle:', CSV);

let neu = 0, aktualisiert = 0, fehler = 0;
for (const row of rows.slice(1)) {
  const get = (name) => (idx(name) >= 0 ? String(row[idx(name)] ?? '').trim() : '');
  const email = get('email');
  if (!email) { console.log('Zeile ohne E-Mail uebersprungen.'); fehler++; continue; }
  const mitgliedsnummer = get('mitgliedsnummer');
  const vorname = get('vorname');
  const nachname = get('nachname');
  // name aus Spalte ODER aus Vor-/Nachname zusammengesetzt.
  const name = get('name') || [vorname, nachname].filter(Boolean).join(' ');
  const gb = get('geburtsdatum');
  const rollen = (get('rollen').split(';').map((r) => r.trim()).filter((r) => ROLLEN.includes(r)));
  const passwort = get('passwort') || `Start-${mitgliedsnummer || email.split('@')[0]}!`;

  const patch = {
    name,
    vorname,
    nachname,
    mitgliedsnummer,
    geburtsdatum: gb ? `${gb} 00:00:00.000Z` : null,
    rollen: rollen.length ? rollen : ['mitglied'],
  };

  try {
    const u = await pb.collection('users').getFirstListItem(`email="${email}"`);
    await pb.collection('users').update(u.id, patch);
    aktualisiert++;
  } catch {
    try {
      await pb.collection('users').create({ email, password: passwort, passwordConfirm: passwort, verified: true, ...patch });
      neu++;
    } catch (e) {
      console.log('Fehler bei', email, '-', e?.message ?? e);
      fehler++;
    }
  }
}

console.log(`\nFertig. Neu: ${neu}, aktualisiert: ${aktualisiert}, Fehler: ${fehler}.`);
console.log('Hinweis: Neue Mitglieder ohne passwort-Spalte haben ein Startpasswort "Start-<Nr>!" - bitte aendern lassen.');
