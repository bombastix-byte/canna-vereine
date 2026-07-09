// Schlanker-Start-Paket (Wunsch Vereinspräsident):
//  - mitteilungen (Aushang): Vorstand darf anlegen/bearbeiten/löschen
//  - users.reset_email: freiwillige E-Mail nur für späteren Passwort-Reset
//  - vorbestellungen: Vorstand sieht ALLE + darf Status ändern
// Idempotent.
import PocketBase from 'pocketbase';

const URL = process.env.PB_URL ?? 'http://127.0.0.1:8090';
const ADMIN = process.env.PB_ADMIN_EMAIL ?? 'admin@example.local';
const ADMIN_PW = process.env.PB_ADMIN_PW ?? 'change-me-admin';

const pb = new PocketBase(URL);
pb.autoCancellation(false);
await pb.collection('_superusers').authWithPassword(ADMIN, ADMIN_PW);
console.log('Admin authentifiziert.');

const vorstand = '@request.auth.rollen ~ "vorstand"';
const angemeldet = '@request.auth.id != ""';

// 1) Aushang (mitteilungen): Vorstand pflegt.
await pb.collections.update('mitteilungen', {
  listRule: angemeldet,
  viewRule: angemeldet,
  createRule: vorstand,
  updateRule: vorstand,
  deleteRule: vorstand,
});
console.log('mitteilungen: Vorstand darf pflegen.');
// created-Feld für stabile Sortierung, falls nicht vorhanden.
const mit = await pb.collections.getOne('mitteilungen');
if (!mit.fields.some((f) => f.name === 'created')) {
  await pb.collections.update('mitteilungen', { fields: [...mit.fields, { name: 'created', type: 'autodate', onCreate: true, onUpdate: false }] });
  console.log('mitteilungen: created ergänzt.');
}

// 2) users.reset_email (optional, freiwillig).
const users = await pb.collections.getOne('users');
if (!users.fields.some((f) => f.name === 'reset_email')) {
  await pb.collections.update('users', { fields: [...users.fields, { name: 'reset_email', type: 'email', required: false }] });
  console.log('users: reset_email ergänzt.');
} else {
  console.log('users: reset_email vorhanden.');
}

// 2b) manageRule: Vorstand darf fremde Passwörter/E-Mails setzen (ohne
//     Alt-Passwort) — für den Passwort-Zurücksetzen-Knopf in der Verwaltung.
await pb.collections.update('users', { manageRule: vorstand });
console.log('users: manageRule = Vorstand (Passwort-Reset).');

// 2c) users.alias: frei wählbarer Anzeigename (statt „Mitglied M-…").
const usersA = await pb.collections.getOne('users');
if (!usersA.fields.some((f) => f.name === 'alias')) {
  await pb.collections.update('users', { fields: [...usersA.fields, { name: 'alias', type: 'text', max: 40 }] });
  console.log('users: alias ergänzt.');
} else {
  console.log('users: alias vorhanden.');
}

// 3) vorbestellungen: Vorstand sieht alle + darf Status setzen.
await pb.collections.update('vorbestellungen', {
  listRule: `${angemeldet} && (mitglied = @request.auth.id || ${vorstand})`,
  viewRule: `${angemeldet} && (mitglied = @request.auth.id || ${vorstand})`,
  updateRule: vorstand,
});
console.log('vorbestellungen: Vorstand sieht alle + Status änderbar.');

console.log('Fertig.');
