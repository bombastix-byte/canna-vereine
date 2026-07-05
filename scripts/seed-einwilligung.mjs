// Einwilligungs-/Kenntnisnahme-Nachweis: Felder hinweise_version /
// hinweise_bestaetigt_am am Mitglied. Idempotent.
import PocketBase from 'pocketbase';

const URL = process.env.PB_URL ?? 'http://127.0.0.1:8090';
const ADMIN = process.env.PB_ADMIN_EMAIL ?? 'admin@example.local';
const ADMIN_PW = process.env.PB_ADMIN_PW ?? 'change-me-admin';

const pb = new PocketBase(URL);
pb.autoCancellation(false);
await pb.collection('_superusers').authWithPassword(ADMIN, ADMIN_PW);
console.log('Admin authentifiziert.');

const col = await pb.collections.getOne('users');
const hat = (n) => (col.fields ?? []).some((f) => f.name === n);
const neu = [];
if (!hat('hinweise_version')) neu.push({ name: 'hinweise_version', type: 'text' });
if (!hat('hinweise_bestaetigt_am')) neu.push({ name: 'hinweise_bestaetigt_am', type: 'text' });

if (neu.length) {
  await pb.collections.update('users', { fields: [...col.fields, ...neu] });
  console.log('users: Felder ergaenzt:', neu.map((f) => f.name).join(', '));
} else {
  console.log('users: Einwilligungs-Felder bereits vorhanden.');
}
console.log('Fertig.');
