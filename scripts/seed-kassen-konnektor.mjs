// Kassen-Konnektor: Anbindung einer externen Kassensoftware (JTL o. a.).
// - einstellungen.kasse_extern (json): { typ, url, token }
// - kassenvorgaenge: dauerhaftes, weiterleitbares Protokoll jedes Barvorgangs
//   (Abgabe-Beitrag, Aufnahmebeitrag) samt Zustellstatus an die externe Kasse.
// Idempotent.
import PocketBase from 'pocketbase';

const URL = process.env.PB_URL ?? 'http://127.0.0.1:8090';
const ADMIN = process.env.PB_ADMIN_EMAIL ?? 'admin@example.local';
const ADMIN_PW = process.env.PB_ADMIN_PW ?? 'change-me-admin';

const pb = new PocketBase(URL);
pb.autoCancellation(false);
await pb.collection('_superusers').authWithPassword(ADMIN, ADMIN_PW);
console.log('Admin authentifiziert.');

const usersId = (await pb.collections.getOne('users')).id;
const staff = '@request.auth.rollen ~ "ausgabe" || @request.auth.rollen ~ "anbau" || @request.auth.rollen ~ "vorstand"';
const vorstand = '@request.auth.rollen ~ "vorstand"';

// 1) einstellungen um kasse_extern (json) erweitern.
const col = await pb.collections.getOne('einstellungen');
if (!(col.fields ?? []).some((f) => f.name === 'kasse_extern')) {
  await pb.collections.update('einstellungen', { fields: [...col.fields, { name: 'kasse_extern', type: 'json', maxSize: 4000 }] });
  console.log('einstellungen: Feld kasse_extern ergaenzt.');
} else {
  console.log('einstellungen: kasse_extern bereits vorhanden.');
}

// 2) kassenvorgaenge-Collection.
try {
  await pb.collections.getOne('kassenvorgaenge');
  console.log('kassenvorgaenge: vorhanden.');
} catch {
  await pb.collections.create({
    name: 'kassenvorgaenge',
    type: 'base',
    listRule: staff,
    viewRule: staff,
    createRule: staff,
    updateRule: vorstand, // nur fuer Retry/Status-Korrektur
    deleteRule: null,
    fields: [
      { name: 'art', type: 'select', maxSelect: 1, values: ['abgabe', 'aufnahme'] },
      { name: 'mitglied', type: 'relation', maxSelect: 1, collectionId: usersId, cascadeDelete: false },
      { name: 'mitgliedsnummer', type: 'text' },
      { name: 'belegnr', type: 'text' },
      { name: 'positionen', type: 'json', maxSize: 20000 },
      { name: 'betrag_euro', type: 'number' },
      { name: 'datum', type: 'text' },
      // offen = noch nicht zugestellt, gesendet = ok, fehler = Zustellung fehlgeschlagen,
      // lokal = kein externer Konnektor aktiv (nur intern protokolliert).
      { name: 'extern_status', type: 'select', maxSelect: 1, values: ['offen', 'gesendet', 'fehler', 'lokal'] },
      { name: 'extern_antwort', type: 'text' },
      { name: 'von', type: 'relation', maxSelect: 1, collectionId: usersId, cascadeDelete: false },
      { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
    ],
  });
  console.log('kassenvorgaenge: angelegt.');
}

console.log('Fertig.');
