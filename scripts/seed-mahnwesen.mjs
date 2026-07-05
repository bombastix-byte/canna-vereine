// Beitrags-/Mahnwesen: Zahlungs-Journal (append-only) + Mahn-Felder am Mitglied.
// Idempotent.
import PocketBase from 'pocketbase';

const URL = process.env.PB_URL ?? 'http://127.0.0.1:8090';
const ADMIN = process.env.PB_ADMIN_EMAIL ?? 'admin@example.local';
const ADMIN_PW = process.env.PB_ADMIN_PW ?? 'change-me-admin';

const pb = new PocketBase(URL);
pb.autoCancellation(false);
await pb.collection('_superusers').authWithPassword(ADMIN, ADMIN_PW);
console.log('Admin authentifiziert.');

const usersCol = await pb.collections.getOne('users');
const usersId = usersCol.id;

// Personal (Ausgabe/Vorstand) darf Zahlungen sehen/erfassen.
const staff = '@request.auth.rollen ~ "ausgabe" || @request.auth.rollen ~ "vorstand"';

// 1) Collection "zahlungen" (Journal, append-only).
let zahlungen;
try {
  zahlungen = await pb.collections.getOne('zahlungen');
  console.log('zahlungen: vorhanden.');
} catch {
  zahlungen = await pb.collections.create({
    name: 'zahlungen',
    type: 'base',
    listRule: staff,
    viewRule: staff,
    createRule: staff,
    updateRule: null,
    deleteRule: null,
    fields: [
      { name: 'mitglied', type: 'relation', required: true, maxSelect: 1, collectionId: usersId, cascadeDelete: false },
      { name: 'datum', type: 'text', required: true },
      { name: 'betrag_euro', type: 'number', required: true },
      { name: 'monate', type: 'number' },
      { name: 'methode', type: 'select', maxSelect: 1, values: ['bar', 'ueberweisung', 'sepa', 'sonstige'] },
      { name: 'zeitraum_bis', type: 'text' },
      { name: 'notiz', type: 'text' },
      { name: 'von', type: 'relation', maxSelect: 1, collectionId: usersId, cascadeDelete: false },
    ],
  });
  console.log('zahlungen: angelegt.');
}

// 2) Mahn-Felder am Mitglied.
const hat = (n) => (usersCol.fields ?? []).some((f) => f.name === n);
const neu = [];
if (!hat('mahnstufe')) neu.push({ name: 'mahnstufe', type: 'number' });
if (!hat('gemahnt_am')) neu.push({ name: 'gemahnt_am', type: 'date' });
if (neu.length) {
  await pb.collections.update('users', { fields: [...usersCol.fields, ...neu] });
  console.log('users: Felder ergaenzt:', neu.map((f) => f.name).join(', '));
} else {
  console.log('users: Mahn-Felder bereits vorhanden.');
}

console.log('Fertig.');
