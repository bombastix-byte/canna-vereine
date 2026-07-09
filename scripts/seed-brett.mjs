// Schwarzes Brett: Beiträge der Mitglieder mit einer Antwort-Ebene.
// Kein Live-Chat — eine ruhige Pinnwand. Löschen: Verfasser oder Vorstand.
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
const angemeldet = '@request.auth.id != ""';
const selbst = '@request.auth.id != "" && mitglied = @request.auth.id';
const selbstOderVorstand = 'mitglied = @request.auth.id || @request.auth.rollen ~ "vorstand"';

let col;
try {
  col = await pb.collections.getOne('brett_beitraege');
  console.log('brett_beitraege: vorhanden.');
} catch {
  col = await pb.collections.create({
    name: 'brett_beitraege',
    type: 'base',
    listRule: angemeldet,
    viewRule: angemeldet,
    createRule: selbst,
    updateRule: null, // bewusst kein Editieren - loeschen und neu schreiben
    deleteRule: selbstOderVorstand,
    fields: [
      { name: 'mitglied', type: 'relation', required: true, maxSelect: 1, collectionId: usersId, cascadeDelete: true },
      { name: 'text', type: 'text', required: true, max: 2000 },
      { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
    ],
  });
  console.log('brett_beitraege: angelegt.');
}

// Selbst-Relation (Antwort auf einen Beitrag) nach dem Anlegen ergaenzen.
const frisch = await pb.collections.getOne('brett_beitraege');
if (!(frisch.fields ?? []).some((f) => f.name === 'antwort_auf')) {
  await pb.collections.update('brett_beitraege', {
    fields: [...frisch.fields, { name: 'antwort_auf', type: 'relation', maxSelect: 1, collectionId: frisch.id, cascadeDelete: true }],
  });
  console.log('brett_beitraege: Feld antwort_auf ergaenzt.');
}

console.log('Fertig.');
