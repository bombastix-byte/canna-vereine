// Aufnahmebeitrag in der Kasse: erweitert kassenbewegung um die Kategorie
// 'aufnahme' (Einnahme) und eine optionale Mitglieds-Zuordnung. Idempotent.
import PocketBase from 'pocketbase';

const URL = process.env.PB_URL ?? 'http://127.0.0.1:8090';
const ADMIN = process.env.PB_ADMIN_EMAIL ?? 'admin@example.local';
const ADMIN_PW = process.env.PB_ADMIN_PW ?? 'change-me-admin';

const pb = new PocketBase(URL);
pb.autoCancellation(false);
await pb.collection('_superusers').authWithPassword(ADMIN, ADMIN_PW);
console.log('Admin authentifiziert.');

const usersId = (await pb.collections.getOne('users')).id;
const col = await pb.collections.getOne('kassenbewegung');
const felder = col.fields ?? [];

// 1) typ-Select um 'aufnahme' erweitern.
const typ = felder.find((f) => f.name === 'typ');
if (typ && !typ.values.includes('aufnahme')) {
  typ.values = [...typ.values, 'aufnahme'];
  await pb.collections.update('kassenbewegung', { fields: felder });
  console.log('kassenbewegung.typ: Wert aufnahme ergaenzt.');
} else {
  console.log('kassenbewegung.typ: aufnahme bereits vorhanden.');
}

// 2) Optionale Mitglieds-Zuordnung.
const frisch = await pb.collections.getOne('kassenbewegung');
if (!(frisch.fields ?? []).some((f) => f.name === 'mitglied')) {
  await pb.collections.update('kassenbewegung', {
    fields: [...frisch.fields, { name: 'mitglied', type: 'relation', maxSelect: 1, collectionId: usersId, cascadeDelete: false }],
  });
  console.log('kassenbewegung: Feld mitglied ergaenzt.');
} else {
  console.log('kassenbewegung: mitglied bereits vorhanden.');
}

console.log('Fertig.');
