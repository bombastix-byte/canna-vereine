// Macht das Feld chargen.sorte OPTIONAL, damit Produkte ohne einzelne Sorte
// (Mix / freie Herkunft) aufgenommen werden koennen. Idempotent.
import PocketBase from 'pocketbase';

const URL = process.env.PB_URL ?? 'http://127.0.0.1:8090';
const ADMIN = process.env.PB_ADMIN_EMAIL ?? 'admin@example.local';
const ADMIN_PW = process.env.PB_ADMIN_PW ?? 'change-me-admin';

const pb = new PocketBase(URL);
pb.autoCancellation(false);
await pb.collection('_superusers').authWithPassword(ADMIN, ADMIN_PW);
console.log('Admin authentifiziert.');

const col = await pb.collections.getOne('chargen');
const feld = (col.fields ?? []).find((f) => f.name === 'sorte');
if (!feld) {
  console.log('Feld sorte nicht gefunden - nichts zu tun.');
} else if (feld.required === false) {
  console.log('chargen.sorte ist bereits optional.');
} else {
  feld.required = false;
  await pb.collections.update('chargen', { fields: col.fields });
  console.log('chargen.sorte -> optional gesetzt.');
}

console.log('seed-produkte fertig.');
