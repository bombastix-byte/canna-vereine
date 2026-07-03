// Richtet das Ausgabe-/Compliance-Modul in PocketBase ein (idempotent).
//  - erweitert die users-Collection um geburtsdatum, mitgliedsnummer, rolle
//  - legt die Sorten-Stammdaten an (numerischer THC-Wert fuer die U21-Pruefung)
//  - legt die append-only Abgabe-Collection 'ausgaben' an (rollenbasiert)
//  - spielt ein paar Demo-Sorten + Demo-Rollen ein
// Reines Einrichtungswerkzeug. Vor Live echte Daten importieren.
import PocketBase from 'pocketbase';

const URL = process.env.PB_URL ?? 'http://127.0.0.1:8090';
const ADMIN = process.env.PB_ADMIN_EMAIL ?? 'admin@example.local';
const ADMIN_PW = process.env.PB_ADMIN_PW ?? 'change-me-admin';
const MITGLIED = process.env.PB_MEMBER_EMAIL ?? 'mitglied@example.local';
const STAFF = process.env.PB_STAFF_EMAIL ?? 'ausgabe@example.local';
const STAFF_PW = process.env.PB_STAFF_PW ?? 'change-me-staff';
const U21 = process.env.PB_U21_EMAIL ?? 'u21@example.local';
const U21_PW = process.env.PB_U21_PW ?? 'change-me-u21';

const pb = new PocketBase(URL);
pb.autoCancellation(false);
await pb.collection('_superusers').authWithPassword(ADMIN, ADMIN_PW);
console.log('Admin authentifiziert.');

const angemeldet = '@request.auth.id != ""';
// Nur Vorstand/Ausgabekraft darf am Tresen buchen bzw. Bestand fortschreiben.
const istPersonal =
  '@request.auth.rolle = "vorstand" || @request.auth.rolle = "ausgabe"';

async function ensureCollection(def) {
  try {
    await pb.collections.getOne(def.name);
    console.log('Collection vorhanden:', def.name);
    return false;
  } catch {
    await pb.collections.create(def);
    console.log('Collection angelegt:', def.name);
    return true;
  }
}

// ---------- users um Compliance-Felder erweitern ----------
{
  const users = await pb.collections.getOne('users');
  const vorhanden = new Set((users.fields ?? []).map((f) => f.name));
  const neu = [];
  if (!vorhanden.has('rolle')) {
    neu.push({ name: 'rolle', type: 'select', maxSelect: 1, values: ['mitglied', 'vorstand', 'ausgabe'] });
  }
  if (!vorhanden.has('mitgliedsnummer')) {
    neu.push({ name: 'mitgliedsnummer', type: 'text' });
  }
  if (!vorhanden.has('geburtsdatum')) {
    neu.push({ name: 'geburtsdatum', type: 'date' });
  }
  if (neu.length) {
    // Vollstaendige Feldliste (bestehende + neue) zuruecksenden.
    await pb.collections.update('users', { fields: [...users.fields, ...neu] });
    console.log('users erweitert um:', neu.map((f) => f.name).join(', '));
  } else {
    console.log('users bereits erweitert.');
  }
  // Personal darf Mitglieder listen/ansehen (fuer die Tresen-Auswahl);
  // Mitglieder sehen nur sich selbst.
  const mitgliedSicht =
    '@request.auth.id != "" && (id = @request.auth.id || @request.auth.rolle = "vorstand" || @request.auth.rolle = "ausgabe")';
  await pb.collections.update('users', { listRule: mitgliedSicht, viewRule: mitgliedSicht });
  console.log('users Sichtbarkeitsregeln gesetzt.');
}

// ---------- Sorten-Stammdaten ----------
// THC/CBD als Zahl (Prozent), damit die U21-Grenze (<=10 %) maschinell greift.
// Pflegt der Vorstand im CMS; Mitglieder duerfen nur lesen.
await ensureCollection({
  name: 'sorten',
  type: 'base',
  listRule: angemeldet,
  viewRule: angemeldet,
  createRule: null,
  updateRule: istPersonal, // Ausgabe schreibt den Bestand fort
  deleteRule: null,
  fields: [
    { name: 'name', type: 'text', required: true },
    { name: 'typ', type: 'select', maxSelect: 1, values: ['Indica', 'Sativa', 'Hybrid'] },
    { name: 'thc_prozent', type: 'number' },
    { name: 'cbd_prozent', type: 'number' },
    { name: 'charge', type: 'text' },
    { name: 'bestand_gramm', type: 'number' },
    { name: 'aktiv', type: 'bool' },
    { name: 'notiz', type: 'text' },
    { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
    { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
  ],
});

// ---------- Abgabe-Protokoll (append-only) ----------
// Bucht ausschliesslich das Personal am Tresen. Mitglieder sehen nur die
// eigenen Abgaben, das Personal sieht alle. Kein Aendern/Loeschen ueber die
// API (Revisionssicherheit); Korrekturen laufen spaeter ueber Storno-Saetze.
const usersId = (await pb.collections.getOne('users')).id;
const sortenId = (await pb.collections.getOne('sorten')).id;
const sichtbar =
  '@request.auth.id != "" && (mitglied = @request.auth.id || @request.auth.rolle = "vorstand" || @request.auth.rolle = "ausgabe")';
await ensureCollection({
  name: 'ausgaben',
  type: 'base',
  listRule: sichtbar,
  viewRule: sichtbar,
  createRule: istPersonal,
  updateRule: null,
  deleteRule: null,
  fields: [
    { name: 'mitglied', type: 'relation', required: true, maxSelect: 1, collectionId: usersId, cascadeDelete: false },
    { name: 'mitgliedsnummer', type: 'text' }, // Snapshot fuer den Beleg
    { name: 'sorte', type: 'relation', maxSelect: 1, collectionId: sortenId, cascadeDelete: false },
    { name: 'sorte_name', type: 'text', required: true }, // Snapshot (Sorte kann spaeter geloescht werden)
    { name: 'charge', type: 'text' },
    { name: 'thc_prozent', type: 'number' },
    { name: 'cbd_prozent', type: 'number' },
    { name: 'menge_gramm', type: 'number', required: true },
    { name: 'beitrag_euro', type: 'number' },
    { name: 'tag', type: 'text', required: true }, // 'YYYY-MM-DD' Berlin-lokal
    { name: 'monat', type: 'text', required: true }, // 'YYYY-MM' Berlin-lokal
    { name: 'abgegeben_von', type: 'relation', maxSelect: 1, collectionId: usersId, cascadeDelete: false },
    { name: 'belegnr', type: 'text' },
    { name: 'notiz', type: 'text' },
    { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
    { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
  ],
});

// ---------- Demo-Rollen / Geburtsdaten ----------
async function setzeMitgliedsdaten(email, patch) {
  try {
    const u = await pb.collection('users').getFirstListItem(`email="${email}"`);
    await pb.collection('users').update(u.id, patch);
    console.log('Mitgliedsdaten gesetzt:', email);
    return u;
  } catch {
    console.log('Mitglied nicht gefunden (uebersprungen):', email);
    return null;
  }
}

async function ensureUser(email, password, patch) {
  try {
    const u = await pb.collection('users').getFirstListItem(`email="${email}"`);
    await pb.collection('users').update(u.id, patch);
    console.log('Nutzer vorhanden/aktualisiert:', email);
    return u;
  } catch {
    const u = await pb.collection('users').create({
      email,
      password,
      passwordConfirm: password,
      verified: true,
      ...patch,
    });
    console.log('Nutzer angelegt:', email);
    return u;
  }
}

// Bestehendes Demo-Mitglied als volljaehrig (>=21) markieren.
await setzeMitgliedsdaten(MITGLIED, {
  geburtsdatum: '1990-05-05 00:00:00.000Z',
  mitgliedsnummer: 'M-001',
  rolle: 'mitglied',
});
// Ausgabekraft (Vorstand) fuer den Tresen.
await ensureUser(STAFF, STAFF_PW, {
  name: 'Demo Ausgabe',
  geburtsdatum: '1985-03-03 00:00:00.000Z',
  mitgliedsnummer: 'V-001',
  rolle: 'vorstand',
});
// Junges Demo-Mitglied (unter 21) zum Testen der U21-Sperre.
await ensureUser(U21, U21_PW, {
  name: 'Demo U21',
  geburtsdatum: '2006-08-08 00:00:00.000Z',
  mitgliedsnummer: 'M-002',
  rolle: 'mitglied',
});

// ---------- Demo-Sorten ----------
async function seedWennLeer(collection, datensaetze) {
  const liste = await pb.collection(collection).getList(1, 1);
  if (liste.totalItems > 0) {
    console.log('Inhalte vorhanden, ueberspringe:', collection);
    return;
  }
  for (const d of datensaetze) await pb.collection(collection).create(d);
  console.log('Inhalte eingespielt:', collection, datensaetze.length);
}

await seedWennLeer('sorten', [
  { name: 'CBD Aurora', typ: 'Hybrid', thc_prozent: 9, cbd_prozent: 8, charge: '2026-06-A', bestand_gramm: 400, aktiv: true, notiz: 'Synthetischer Testfall fuer den U21-Pfad - der Verein fuehrt aktuell keine echte Sorte <=10 % THC. Unter 10 % THC, auch fuer unter 21-Jaehrige zulaessig.' },
  { name: 'Gushers', typ: 'Indica', thc_prozent: 26, cbd_prozent: 2, charge: '2026-06-B', bestand_gramm: 600, aktiv: true, notiz: 'Ueber 10 % THC - nicht an unter 21-Jaehrige.' },
  { name: 'Pineapple Express', typ: 'Sativa', thc_prozent: 30, cbd_prozent: 2, charge: '2026-06-C', bestand_gramm: 500, aktiv: true, notiz: 'Ueber 10 % THC - nicht an unter 21-Jaehrige.' },
]);

console.log('\nFertig. Tresen-Login (Demo): ' + STAFF + ' / ' + STAFF_PW);
