// Chargen-Rueckruf: Rueckruf-Felder an der Charge + Rueckruf-Journal (append-only,
// dokumentiert Anlass und benachrichtigte Empfaenger). Idempotent.
import PocketBase from 'pocketbase';

const URL = process.env.PB_URL ?? 'http://127.0.0.1:8090';
const ADMIN = process.env.PB_ADMIN_EMAIL ?? 'admin@example.local';
const ADMIN_PW = process.env.PB_ADMIN_PW ?? 'change-me-admin';

const pb = new PocketBase(URL);
pb.autoCancellation(false);
await pb.collection('_superusers').authWithPassword(ADMIN, ADMIN_PW);
console.log('Admin authentifiziert.');

const usersId = (await pb.collections.getOne('users')).id;
const chargenCol = await pb.collections.getOne('chargen');
const chargenId = chargenCol.id;

// 1) Rueckruf-Felder an der Charge.
const hat = (n) => (chargenCol.fields ?? []).some((f) => f.name === n);
const neu = [];
if (!hat('rueckruf')) neu.push({ name: 'rueckruf', type: 'bool' });
if (!hat('rueckruf_grund')) neu.push({ name: 'rueckruf_grund', type: 'text' });
if (!hat('rueckruf_am')) neu.push({ name: 'rueckruf_am', type: 'date' });
if (neu.length) {
  await pb.collections.update('chargen', { fields: [...chargenCol.fields, ...neu] });
  console.log('chargen: Felder ergaenzt:', neu.map((f) => f.name).join(', '));
} else {
  console.log('chargen: Rueckruf-Felder bereits vorhanden.');
}

// 2) Journal "rueckrufe" (append-only). Personal (Anbau/Ausgabe/Vorstand).
const staff = '@request.auth.rollen ~ "anbau" || @request.auth.rollen ~ "ausgabe" || @request.auth.rollen ~ "vorstand"';
try {
  await pb.collections.getOne('rueckrufe');
  console.log('rueckrufe: vorhanden.');
} catch {
  await pb.collections.create({
    name: 'rueckrufe',
    type: 'base',
    listRule: staff,
    viewRule: staff,
    createRule: staff,
    updateRule: null,
    deleteRule: null,
    fields: [
      { name: 'charge', type: 'relation', required: true, maxSelect: 1, collectionId: chargenId, cascadeDelete: false },
      { name: 'charge_nr', type: 'text' },
      { name: 'grund', type: 'text' },
      { name: 'datum', type: 'text' },
      { name: 'empfaenger_zahl', type: 'number' },
      { name: 'benachrichtigt', type: 'number' },
      { name: 'von', type: 'relation', maxSelect: 1, collectionId: usersId, cascadeDelete: false },
    ],
  });
  console.log('rueckrufe: angelegt.');
}

console.log('Fertig.');
