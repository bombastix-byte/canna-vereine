// Sortenbewertung durch Mitglieder: Sterne (1-5) + Kurzkommentar je Sorte.
// Eine Bewertung je Mitglied und Sorte (Upsert im Endpoint). Idempotent.
import PocketBase from 'pocketbase';

const URL = process.env.PB_URL ?? 'http://127.0.0.1:8090';
const ADMIN = process.env.PB_ADMIN_EMAIL ?? 'admin@example.local';
const ADMIN_PW = process.env.PB_ADMIN_PW ?? 'change-me-admin';

const pb = new PocketBase(URL);
pb.autoCancellation(false);
await pb.collection('_superusers').authWithPassword(ADMIN, ADMIN_PW);
console.log('Admin authentifiziert.');

const usersId = (await pb.collections.getOne('users')).id;
const sortenId = (await pb.collections.getOne('sorten')).id;

const angemeldet = '@request.auth.id != ""';
const selbst = '@request.auth.id != "" && mitglied = @request.auth.id';
const selbstOderVorstand = 'mitglied = @request.auth.id || @request.auth.rollen ~ "vorstand"';

try {
  await pb.collections.getOne('sorten_bewertungen');
  console.log('sorten_bewertungen: vorhanden.');
} catch {
  await pb.collections.create({
    name: 'sorten_bewertungen',
    type: 'base',
    listRule: angemeldet,
    viewRule: angemeldet,
    createRule: selbst,
    updateRule: selbst,
    deleteRule: selbstOderVorstand,
    fields: [
      { name: 'sorte', type: 'relation', required: true, maxSelect: 1, collectionId: sortenId, cascadeDelete: true },
      { name: 'mitglied', type: 'relation', required: true, maxSelect: 1, collectionId: usersId, cascadeDelete: true },
      { name: 'sterne', type: 'number', required: true, min: 1, max: 5 },
      { name: 'kommentar', type: 'text', max: 500 },
      { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
      { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
    ],
  });
  console.log('sorten_bewertungen: angelegt.');
}

console.log('Fertig.');
