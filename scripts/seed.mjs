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

// Angebot der Woche: rein interne, sachliche Info zur aktuellen Abgabe an
// Mitglieder (kein oeffentliches Marketing, KCanG Paragraf 6). Pflegt der Vorstand.
await ensureCollection({
  name: 'wochenangebot',
  type: 'base',
  listRule: lesen,
  viewRule: lesen,
  fields: [
    { name: 'titel', type: 'text', required: true },
    { name: 'inhalt', type: 'text', required: true },
    // Sortenliste als JSON: [{ name, typ, thc, cbd }]
    { name: 'sorten', type: 'json', maxSize: 2000000 },
    { name: 'gueltig_von', type: 'date' },
    { name: 'gueltig_bis', type: 'date' },
  ],
});

// Sortenberichte: sachliche Beschreibungen der angebauten Sorten.
await ensureCollection({
  name: 'sortenberichte',
  type: 'base',
  listRule: lesen,
  viewRule: lesen,
  fields: [
    { name: 'titel', type: 'text', required: true },
    { name: 'sorte', type: 'text' },
    { name: 'inhalt', type: 'text', required: true },
    { name: 'datum', type: 'date', required: true },
  ],
});

// Vorbestellungen zur spaeteren Abholung. Anders als die uebrigen Collections
// duerfen Mitglieder hier selbst Datensaetze ANLEGEN, aber nur eigene sehen.
// Aendern/Loeschen bleibt dem Vorstand vorbehalten (Status-Pflege).
const usersId = (await pb.collections.getOne('users')).id;
const eigene = '@request.auth.id != "" && mitglied = @request.auth.id';
// Strenge Anlege-Regel referenziert Felder (@request.data.*) und kann erst
// gesetzt werden, wenn die Felder existieren -> erst anlegen, dann Regel nachziehen.
const anlegenStreng =
  '@request.auth.id != "" && @request.data.mitglied = @request.auth.id && @request.data.status = "offen"';
await ensureCollection({
  name: 'vorbestellungen',
  type: 'base',
  listRule: eigene,
  viewRule: eigene,
  createRule: '@request.auth.id != ""',
  updateRule: null,
  deleteRule: null,
  fields: [
    { name: 'mitglied', type: 'relation', required: true, maxSelect: 1, collectionId: usersId, cascadeDelete: false },
    { name: 'sorte', type: 'text', required: true },
    { name: 'menge_gramm', type: 'number', required: true },
    { name: 'abholdatum', type: 'date' },
    { name: 'hinweis', type: 'text' },
    { name: 'status', type: 'select', maxSelect: 1, values: ['offen', 'bestaetigt', 'abgeholt', 'storniert'] },
    // PocketBase 0.23+ legt created/updated nicht mehr automatisch an -> explizit.
    { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
    { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
  ],
});
// Strenge Anlege-Regel nachziehen (jetzt existieren die Felder).
try {
  await pb.collections.update('vorbestellungen', { createRule: anlegenStreng });
  console.log('Anlege-Regel fuer vorbestellungen gesetzt.');
} catch (e) {
  console.log('Hinweis: strenge Anlege-Regel nicht gesetzt:', e?.message ?? e);
}

// ---------- Helferplan ----------
// Helferdienste pflegt der Vorstand (anlegen/aendern nur per Admin). Mitglieder
// duerfen lesen, um zu sehen, wo Hilfe gebraucht wird.
await ensureCollection({
  name: 'helferdienste',
  type: 'base',
  listRule: lesen,
  viewRule: lesen,
  fields: [
    { name: 'titel', type: 'text', required: true },
    { name: 'rhythmus', type: 'select', maxSelect: 1, values: ['taeglich', 'woechentlich', 'monatlich', 'einmalig'] },
    { name: 'wochentag', type: 'number' }, // 1=Mo..7=So, nur bei woechentlich
    { name: 'monatstag', type: 'number' }, // 1..31, nur bei monatlich
    { name: 'datum', type: 'date' }, // nur bei einmalig
    { name: 'bedarf', type: 'number', required: true },
    { name: 'beschreibung', type: 'text' },
    { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
    { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
  ],
});

// Eintragungen legen Mitglieder selbst an (nur fuer sich), loeschen nur die
// eigenen. Lesen duerfen alle Angemeldeten, damit die Belegung sichtbar ist.
const dienstId = (await pb.collections.getOne('helferdienste')).id;
await ensureCollection({
  name: 'helfer_eintragungen',
  type: 'base',
  listRule: lesen,
  viewRule: lesen,
  createRule: '@request.auth.id != ""',
  updateRule: null,
  deleteRule: '@request.auth.id != "" && mitglied = @request.auth.id',
  fields: [
    { name: 'mitglied', type: 'relation', required: true, maxSelect: 1, collectionId: usersId, cascadeDelete: true },
    { name: 'dienst', type: 'relation', required: true, maxSelect: 1, collectionId: dienstId, cascadeDelete: true },
    { name: 'datum', type: 'date', required: true }, // konkreter Tag der Eintragung
    { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
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
      'Die nächste ordentliche Mitgliederversammlung findet im Vereinsraum statt. Die Tagesordnung liegt im Dokumentenbereich bereit.',
    datum: '2026-06-12 10:00:00.000Z',
  },
  {
    titel: 'Aktualisierte Hausordnung',
    inhalt:
      'Die Hausordnung wurde redaktionell überarbeitet. Die aktuelle Fassung steht unter Dokumente zur Verfügung.',
    datum: '2026-06-05 09:00:00.000Z',
  },
]);

await seedWennLeer('termine', [
  {
    titel: 'Ordentliche Mitgliederversammlung',
    datum: '2026-07-04 17:00:00.000Z',
    ort: 'Vereinsraum',
    beschreibung: 'Berichte des Vorstands, Aussprache, Beschlüsse.',
  },
  {
    titel: 'Offene Sprechstunde des Präventionsbeauftragten',
    datum: '2026-06-25 16:00:00.000Z',
    ort: 'Vereinsraum',
    beschreibung: 'Vertrauliche Fragen rund um Gesundheit und Prävention.',
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
    'Beispieldokument der Anbauvereinigung Görlitz e. V.\nPlatzhalter für die echte Hausordnung.';
  const fd = new FormData();
  fd.set('titel', 'Hausordnung (Stand 06/2026)');
  fd.set('kategorie', 'Vereinsdokumente');
  fd.set('datei', new File([inhalt], 'hausordnung.txt', { type: 'text/plain' }));
  await pb.collection('dokumente').create(fd);
  console.log('Dokument eingespielt.');
}
await seedDokument();

await seedWennLeer('wochenangebot', [
  {
    titel: 'Aktuelle Abgabe diese Woche',
    inhalt:
      'Die Abgabe erfolgt zum Selbstkostenbeitrag im Rahmen der Satzung, Abholung zu den ausgehängten Vereinszeiten. Alle THC- und CBD-Werte stammen aus eigener Messung der Vereinigung.',
    sorten: [
      { name: 'Pineapple Express', typ: 'Sativa', thc: '30,0 %', cbd: '2,0 %' },
      { name: 'Hulk Berry', typ: 'Sativa', thc: '24,0 %', cbd: '2,0 %' },
      { name: 'Fat Bastard', typ: 'Hybrid', thc: '30,0 %', cbd: '2,0 %' },
      { name: 'Orbital Banana', typ: 'Hybrid', thc: '25,0 %', cbd: '2,0 %' },
      { name: 'Gushers', typ: 'Indica', thc: '26,0 %', cbd: '2,0 %' },
      { name: 'Watermelon', typ: 'Indica', thc: '20,0 %', cbd: '2,0 %' },
    ],
    gueltig_von: '2026-06-29 00:00:00.000Z',
    gueltig_bis: '2026-07-05 00:00:00.000Z',
  },
]);

await seedWennLeer('sortenberichte', [
  {
    titel: 'Pineapple Express',
    sorte: 'Pineapple Express',
    inhalt:
      'Sativa-Sorte mit fruchtigem Aroma. Anbau aus dem laufenden Vereinszyklus. Diese Angaben dienen der sachlichen Information der Mitglieder, nicht der Bewerbung.',
    datum: '2026-06-14 09:00:00.000Z',
  },
  {
    titel: 'Gushers',
    sorte: 'Gushers',
    inhalt:
      'Indica-betonte Sorte. Ernte aus dem aktuellen Anbau der Vereinigung. Sachliche Sortenbeschreibung für Mitglieder.',
    datum: '2026-06-10 09:00:00.000Z',
  },
]);

await seedWennLeer('helferdienste', [
  {
    titel: 'Gießen',
    rhythmus: 'taeglich',
    bedarf: 1,
    beschreibung: 'Tägliches Gießen der Pflanzen im Vereinsraum.',
  },
  {
    titel: 'Kontrolle und Lüften',
    rhythmus: 'taeglich',
    bedarf: 1,
    beschreibung: 'Täglicher Kontrollgang: Temperatur und Luftfeuchte prüfen, lüften.',
  },
  {
    titel: 'Düngen',
    rhythmus: 'woechentlich',
    wochentag: 1,
    bedarf: 2,
    beschreibung: 'Wöchentliche Düngung nach Plan (montags).',
  },
  {
    titel: 'Beschneiden und Pflege',
    rhythmus: 'woechentlich',
    wochentag: 4,
    bedarf: 2,
    beschreibung: 'Wöchentlicher Schnitt und Pflege (donnerstags).',
  },
  {
    titel: 'Umtopfen',
    rhythmus: 'monatlich',
    monatstag: 5,
    bedarf: 3,
    beschreibung: 'Pflanzen in größere Töpfe umsetzen (Monatsanfang).',
  },
  {
    titel: 'Arbeitseinsatz: Ernte vorbereiten',
    rhythmus: 'einmalig',
    datum: '2026-07-15 09:00:00.000Z',
    bedarf: 5,
    beschreibung: 'Gemeinsamer Arbeitseinsatz Mitte Juli, viele Hände gesucht.',
  },
]);

console.log('\nFertig. Login zum Testen: ' + MITGLIED + ' / ' + MITGLIED_PW);
