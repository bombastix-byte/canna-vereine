// Ergaenzt die users um optionale Felder vorname/nachname (fuer die getrennte
// Anzeige auf dem Ausweis). Bleibt leer -> wird automatisch aus `name`
// aufgeteilt. Idempotent.
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
if (!hat('vorname')) neu.push({ name: 'vorname', type: 'text' });
if (!hat('nachname')) neu.push({ name: 'nachname', type: 'text' });
if (neu.length) {
  await pb.collections.update('users', { fields: [...col.fields, ...neu] });
  console.log('users: Felder ergaenzt:', neu.map((f) => f.name).join(', '));
} else {
  console.log('users: vorname/nachname bereits vorhanden.');
}
