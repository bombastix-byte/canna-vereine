// Push-Abos (idempotent): ein Datensatz je Browser/Geraet eines Mitglieds.
// Unique-Index auf endpoint (ein Abo pro Browser). Vorstand darf alle lesen
// (zum Senden), Mitglied nur die eigenen.
import PocketBase from 'pocketbase';

const URL = process.env.PB_URL ?? 'http://127.0.0.1:8090';
const ADMIN = process.env.PB_ADMIN_EMAIL ?? 'admin@example.local';
const ADMIN_PW = process.env.PB_ADMIN_PW ?? 'change-me-admin';

const pb = new PocketBase(URL);
pb.autoCancellation(false);
await pb.collection('_superusers').authWithPassword(ADMIN, ADMIN_PW);

const usersId = (await pb.collections.getOne('users')).id;
const sicht =
  '@request.auth.id != "" && (mitglied = @request.auth.id || @request.auth.rollen ~ "vorstand")';

let neu = false;
try {
  await pb.collections.getOne('push_abos');
  console.log('Collection vorhanden: push_abos');
} catch {
  await pb.collections.create({
    name: 'push_abos',
    type: 'base',
    listRule: sicht,
    viewRule: sicht,
    createRule: '@request.auth.id != ""',
    updateRule: null,
    deleteRule: sicht,
    fields: [
      { name: 'mitglied', type: 'relation', required: true, maxSelect: 1, collectionId: usersId, cascadeDelete: true },
      { name: 'endpoint', type: 'text', required: true },
      { name: 'p256dh', type: 'text' },
      { name: 'auth', type: 'text' },
      { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
    ],
  });
  neu = true;
  console.log('Collection angelegt: push_abos');
}
if (neu) {
  const col = await pb.collections.getOne('push_abos');
  await pb.collections.update('push_abos', {
    indexes: [...(col.indexes ?? []), 'CREATE UNIQUE INDEX `idx_push_endpoint` ON `push_abos` (`endpoint`)'],
  });
  console.log('push_abos: Unique-Index gesetzt.');
}

console.log('Fertig. Push-Abos eingerichtet.');
