// Mitglieds-Lebenszyklus: Felder mitglied_status / austritt_zum / status_notiz.
// Bestehende Mitglieder werden auf „aktiv" gesetzt. Idempotent.
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
if (!hat('mitglied_status')) {
  neu.push({ name: 'mitglied_status', type: 'select', maxSelect: 1, values: ['aktiv', 'ruhend', 'gekuendigt', 'ausgetreten'] });
}
if (!hat('austritt_zum')) neu.push({ name: 'austritt_zum', type: 'date' });
if (!hat('status_notiz')) neu.push({ name: 'status_notiz', type: 'text' });

if (neu.length) {
  await pb.collections.update('users', { fields: [...col.fields, ...neu] });
  console.log('users: Felder ergaenzt:', neu.map((f) => f.name).join(', '));
} else {
  console.log('users: Status-Felder bereits vorhanden.');
}

// Bestehende Mitglieder ohne Status auf „aktiv" setzen.
let gesetzt = 0;
const alle = await pb.collection('users').getFullList({ fields: 'id,mitglied_status' });
for (const u of alle) {
  if (!u.mitglied_status) {
    try {
      await pb.collection('users').update(u.id, { mitglied_status: 'aktiv' });
      gesetzt += 1;
    } catch {
      /* weiter */
    }
  }
}
console.log(`users: ${gesetzt} auf „aktiv" gesetzt (${alle.length} gesamt).`);
console.log('Fertig.');
