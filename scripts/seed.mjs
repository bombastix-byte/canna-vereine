// Einmaliges Einrichten/Befuellen von PocketBase fuer die Demo.
// Legt die drei Collections an (idempotent), ein Testmitglied und ein paar
// Beispielinhalte. Reines Entwicklungs-/Demo-Werkzeug.
import PocketBase from 'pocketbase';

// Zugangsdaten kommen aus Umgebungsvariablen (lokal aus .env, nicht im Repo).
// Die Fallbacks sind bewusst neutrale Platzhalter, keine echten Geheimnisse.
const URL = process.env.PB_URL ?? 'http://127.0.0.1:8090';
const ADMIN = process.env.PB_ADMIN_EMAIL ?? 'admin@example.local';
const ADMIN_PW = process.env.PB_ADMIN_PW ?? 'change-me-admin';
const MITGLIED = process.env.PB_MEMBER_EMAIL ?? 'mitglied@example.local';
const MITGLIED_PW = process.env.PB_MEMBER_PW ?? 'change-me-member';

const pb = new PocketBase(URL);
pb.autoCancellation(false);
await pb.collection('_superusers').authWithPassword(ADMIN, ADMIN_PW);
console.log('Admin authentifiziert.');

const lesen = '@request.auth.id != ""'; // nur angemeldete Mitglieder duerfen lesen

async function ensureCollection(def) {
  try {
    await pb.collections.getOne(def.name);
    console.log('Collection vorhanden:', def.name);
  } catch {
    await pb.collections.create(def);
    console.log('Collection angelegt:', def.name);
  }
}

await ensureCollection({
  name: 'mitteilungen',
  type: 'base',
  listRule: lesen,
  viewRule: lesen,
  fields: [
    { name: 'titel', type: 'text', required: true },
    { name: 'inhalt', type: 'text', required: true },
    { name: 'datum', type: 'date', required: true },
  ],
});

await ensureCollection({
  name: 'termine',
  type: 'base',
  listRule: lesen,
  viewRule: lesen,
  fields: [
    { name: 'titel', type: 'text', required: true },
    { name: 'datum', type: 'date', required: true },
    { name: 'ort', type: 'text' },
    { name: 'beschreibung', type: 'text' },
  ],
});

await ensureCollection({
  name: 'dokumente',
  type: 'base',
  listRule: lesen,
  viewRule: lesen,
  fields: [
    { name: 'titel', type: 'text', required: true },
    { name: 'kategorie', type: 'text' },
    { name: 'datei', type: 'file', required: true, maxSelect: 1, maxSize: 5242880 },
  ],
});

// Testmitglied
async function ensureMitglied() {
  try {
    const u = await pb.collection('users').getFirstListItem(`email="${MITGLIED}"`);
    console.log('Mitglied vorhanden:', MITGLIED);
    return u;
  } catch {
    const u = await pb.collection('users').create({
      email: MITGLIED,
      password: MITGLIED_PW,
      passwordConfirm: MITGLIED_PW,
      name: 'Demo Mitglied',
      verified: true,
    });
    console.log('Mitglied angelegt:', MITGLIED);
    return u;
  }
}
await ensureMitglied();

// Beispielinhalte nur einspielen, wenn die Collection leer ist
async function seedWennLeer(collection, datensaetze) {
  const liste = await pb.collection(collection).getList(1, 1);
  if (liste.totalItems > 0) {
    console.log('Inhalte vorhanden, ueberspringe:', collection);
    return;
  }
  for (const d of datensaetze) {
    await pb.collection(collection).create(d);
  }
  console.log('Inhalte eingespielt:', collection, datensaetze.length);
}

await seedWennLeer('mitteilungen', [
  {
    titel: 'Einladung zur Mitgliederversammlung',
    inhalt:
      'Die naechste ordentliche Mitgliederversammlung findet im Vereinsraum statt. Die Tagesordnung liegt im Dokumentenbereich bereit.',
    datum: '2026-06-12 10:00:00.000Z',
  },
  {
    titel: 'Aktualisierte Hausordnung',
    inhalt:
      'Die Hausordnung wurde redaktionell ueberarbeitet. Die aktuelle Fassung steht unter Dokumente zur Verfuegung.',
    datum: '2026-06-05 09:00:00.000Z',
  },
]);

await seedWennLeer('termine', [
  {
    titel: 'Ordentliche Mitgliederversammlung',
    datum: '2026-07-04 17:00:00.000Z',
    ort: 'Vereinsraum',
    beschreibung: 'Berichte des Vorstands, Aussprache, Beschluesse.',
  },
  {
    titel: 'Offene Sprechstunde des Praeventionsbeauftragten',
    datum: '2026-06-25 16:00:00.000Z',
    ort: 'Vereinsraum',
    beschreibung: 'Vertrauliche Fragen rund um Gesundheit und Praevention.',
  },
]);

// Dokument inkl. Beispieldatei
async function seedDokument() {
  const liste = await pb.collection('dokumente').getList(1, 1);
  if (liste.totalItems > 0) {
    console.log('Dokumente vorhanden, ueberspringe.');
    return;
  }
  const inhalt =
    'Beispieldokument der Anbauvereinigung Goerlitz e. V.\nPlatzhalter fuer die echte Hausordnung.';
  const fd = new FormData();
  fd.set('titel', 'Hausordnung (Stand 06/2026)');
  fd.set('kategorie', 'Vereinsdokumente');
  fd.set('datei', new File([inhalt], 'hausordnung.txt', { type: 'text/plain' }));
  await pb.collection('dokumente').create(fd);
  console.log('Dokument eingespielt.');
}
await seedDokument();

console.log('\nFertig. Login zum Testen: ' + MITGLIED + ' / ' + MITGLIED_PW);
