// Eindeutige Mitgliedsnummern sind fuer Nummern-Login und QR-Ausweise zwingend.
// Der partielle Unique-Index erlaubt mehrere leere Werte bei Alt-/Systemkonten,
// blockiert aber jede doppelte belegte Kennung. Vorhandene Dubletten werden
// bewusst NICHT automatisch umnummeriert: ihre fachliche Identitaet muss ein
// Vorstand klaeren.
import PocketBase from 'pocketbase';

const URL = process.env.PB_URL ?? 'http://127.0.0.1:8090';
const ADMIN = process.env.PB_ADMIN_EMAIL;
const ADMIN_PW = process.env.PB_ADMIN_PW;
if (!ADMIN || !ADMIN_PW) {
  console.error('PB_ADMIN_EMAIL und PB_ADMIN_PW muessen gesetzt sein.');
  process.exit(2);
}

const pb = new PocketBase(URL);
pb.autoCancellation(false);
await pb.collection('_superusers').authWithPassword(ADMIN, ADMIN_PW);

const users = await pb.collection('users').getFullList({ fields: 'id,mitgliedsnummer,created' });
const gruppen = new Map();
for (const u of users) {
  const nr = String(u.mitgliedsnummer ?? '').trim().toUpperCase();
  if (!nr) continue;
  const liste = gruppen.get(nr) ?? [];
  liste.push(u);
  gruppen.set(nr, liste);
}
const doppelt = [...gruppen.entries()].filter(([, liste]) => liste.length > 1);
if (doppelt.length) {
  console.error('Doppelte Mitgliedsnummern gefunden. Vor dem Index fachlich bereinigen:');
  for (const [nr, liste] of doppelt) {
    console.error(`- ${nr}: ${liste.map((u) => u.id).join(', ')}`);
  }
  process.exit(1);
}

const col = await pb.collections.getOne('users');
const name = 'idx_users_mitgliedsnummer_unique';
const pflicht = `CREATE UNIQUE INDEX ${name} ON users (mitgliedsnummer COLLATE NOCASE) WHERE mitgliedsnummer != ''`;
const andere = (col.indexes ?? []).filter((index) => !index.includes(name));
await pb.collections.update('users', { indexes: [...andere, pflicht] });
console.log('users: Mitgliedsnummern eindeutig, Unique-Index gesetzt.');
