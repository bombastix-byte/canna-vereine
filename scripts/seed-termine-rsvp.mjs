// Termine mit Zu-/Absage (RSVP): Zusagen-Collection + Termine im App-Verwalten
// durch den Vorstand freischalten. Idempotent.
import PocketBase from 'pocketbase';

const URL = process.env.PB_URL ?? 'http://127.0.0.1:8090';
const ADMIN = process.env.PB_ADMIN_EMAIL ?? 'admin@example.local';
const ADMIN_PW = process.env.PB_ADMIN_PW ?? 'change-me-admin';

const pb = new PocketBase(URL);
pb.autoCancellation(false);
await pb.collection('_superusers').authWithPassword(ADMIN, ADMIN_PW);
console.log('Admin authentifiziert.');

const usersId = (await pb.collections.getOne('users')).id;
const termineCol = await pb.collections.getOne('termine');
const termineId = termineCol.id;

const angemeldet = '@request.auth.id != ""';
const vorstand = '@request.auth.rollen ~ "vorstand"';
const selbst = '@request.auth.id != "" && mitglied = @request.auth.id';
const selbstOderVorstand = 'mitglied = @request.auth.id || @request.auth.rollen ~ "vorstand"';

// 1) Termine dürfen vom Vorstand in der App verwaltet werden.
const upd = {};
if (termineCol.createRule !== vorstand) upd.createRule = vorstand;
if (termineCol.updateRule !== vorstand) upd.updateRule = vorstand;
if (termineCol.deleteRule !== vorstand) upd.deleteRule = vorstand;
if (Object.keys(upd).length) {
  await pb.collections.update('termine', upd);
  console.log('termine: Verwaltungs-Regeln (Vorstand) gesetzt.');
} else {
  console.log('termine: Regeln bereits gesetzt.');
}

// 2) Zusagen-Collection.
try {
  await pb.collections.getOne('termin_zusagen');
  console.log('termin_zusagen: vorhanden.');
} catch {
  await pb.collections.create({
    name: 'termin_zusagen',
    type: 'base',
    listRule: angemeldet,
    viewRule: angemeldet,
    createRule: selbst,
    updateRule: selbstOderVorstand,
    deleteRule: selbstOderVorstand,
    fields: [
      { name: 'termin', type: 'relation', required: true, maxSelect: 1, collectionId: termineId, cascadeDelete: true },
      { name: 'mitglied', type: 'relation', required: true, maxSelect: 1, collectionId: usersId, cascadeDelete: true },
      { name: 'antwort', type: 'select', maxSelect: 1, values: ['zu', 'vielleicht', 'ab'] },
      { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
      { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
    ],
  });
  console.log('termin_zusagen: angelegt.');
}

console.log('Fertig.');
